const express  = require("express")
const mysql    = require("mysql2")
const path     = require('path')
const dotenv   = require("dotenv")
const multer   = require('multer')
const axios    = require('axios')
const FormData = require('form-data')
dotenv.config()

let dbConn = mysql.createConnection({
    host:     process.env.HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
})

dbConn.connect(function(err){
    if(err) throw err;
    console.log(`Connected DB: ${process.env.DB_NAME}`)
})

const app = express()
var cors = require('cors');
app.use(cors());
const router = express.Router()
app.use(router)
router.use(express.json())
router.use(express.urlencoded({extended: true}))

// Store file in memory so we can send it as base64 to ImgBB
const upload = multer({ storage: multer.memoryStorage() })


// ============================================================
// HELPERS
// ============================================================

// Helper: upload image buffer to ImgBB, returns the image URL
async function uploadToImgBB(fileBuffer) {
    const base64Image = fileBuffer.toString('base64')

    const form = new FormData()
    form.append('key',   process.env.IMGBB_API_KEY)
    form.append('image', base64Image)

    const response = await axios.post('https://api.imgbb.com/1/upload', form, {
        headers: form.getHeaders()
    })

    return response.data.data.url  // permanent display URL
}

// Helper: write a ProductLog entry
// Action codes: 1=Added, 2=Updated, 3=Deleted
function writeLog(accountID, productID, action) {
    const sql = `INSERT INTO ProductLog (AccountID, ProductID, action, dateAndTime) VALUES (?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE action = VALUES(action), dateAndTime = NOW()`
    dbConn.query(sql, [accountID, productID, action], (err) => {
        if (err) console.error('ProductLog error:', err.message)
    })
}


// ============================================================
// 1. PRODUCT SEARCH & DETAILS
// ============================================================

// GET /products  — no criteria → all, with criteria → filtered
// Query params: name, type (comma-separated), minPrice, maxPrice
router.get('/products', (req, res) => {
    const { name, type, minPrice, maxPrice } = req.query

    let sql = `SELECT * FROM Product WHERE status = 1`
    const params = []

    if (name) {
        sql += ` AND name LIKE ?`
        params.push(`%${name}%`)
    }

    if (type) {
        const types = type.split(',').map(t => t.trim())
        const placeholders = types.map(() => '?').join(', ')
        sql += ` AND type IN (${placeholders})`
        params.push(...types)
    }

    if (minPrice) {
        sql += ` AND price >= ?`
        params.push(parseFloat(minPrice))
    }

    if (maxPrice) {
        sql += ` AND price <= ?`
        params.push(parseFloat(maxPrice))
    }

    dbConn.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message })
        res.json({ success: true, count: results.length, data: results })
    })
})

// GET /products/:id  — single product detail
router.get('/products/:id', (req, res) => {
    const sql = `SELECT * FROM Product WHERE ProductID = ?`
    dbConn.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message })
        if (results.length === 0) return res.status(404).json({ success: false, message: 'Product not found' })
        res.json({ success: true, data: results[0] })
    })
})


// ============================================================
// 2. PRODUCT MANAGEMENT (Admin)
// ============================================================

// -------------------------------------------------------
// Testing Insert a new Product with image upload (success case)
// method: POST
// URL: http://localhost:3000/products
// body: form-data  ← must be form-data (NOT raw JSON) when sending an image
//   ProductID  : PRD00021
//   name       : Growatt SPF 5000
//   type       : Inverter
//   price      : 27500
//   description: 5kW Hybrid Solar Inverter with built-in MPPT controller
//   status     : 1
//   accountID  : ACC00001
//   image      : (select a .jpg/.png file)
//
// Testing Insert a new Product (missing required fields)
// method: POST
// URL: http://localhost:3000/products
// body: form-data
//   ProductID  : PRD00023
//   description: Missing name, type, price and accountID
// -------------------------------------------------------

// POST /products  — insert a new product (with optional ImgBB image upload)
// Body: form-data with fields: ProductID, name, type, price, description, status, accountID
// File: image (optional) — any jpg/png file
router.post('/products', upload.single('image'), async (req, res) => {
    const { ProductID, name, type, price, description, status, accountID } = req.body

    if (!ProductID || !name || !type || price == null || !accountID) {
        return res.status(400).json({ success: false, message: 'ProductID, name, type, price, and accountID are required' })
    }

    try {
        // Upload image to ImgBB if a file was attached, otherwise null
        let image_url = null
        if (req.file) {
            image_url = await uploadToImgBB(req.file.buffer)
        }

        const sql = `INSERT INTO Product (ProductID, name, type, price, description, image_url, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`
        const params = [ProductID, name, type, price, description || null, image_url, status ?? 1]

        dbConn.query(sql, params, (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message })
            writeLog(accountID, ProductID, 1)
            res.status(201).json({ success: true, message: 'Product created successfully', ProductID, image_url })
        })

    } catch (err) {
        // Catches ImgBB network errors or API rejections (e.g. invalid key, bad file)
        res.status(500).json({ success: false, message: 'Image upload failed: ' + err.message })
    }
})

// -------------------------------------------------------
// Testing Update a Product with a new image (success case)
// method: PUT
// URL: http://localhost:3000/products/PRD00021
// body: form-data  ← must be form-data (NOT raw JSON) when sending an image
//   price      : 29000
//   description: 5kW Hybrid Solar Inverter with built-in MPPT controller - Updated model
//   accountID  : ACC00002
//   image      : (select a new .jpg/.png file)
//
// Testing Update a Product without changing the image (success case)
// method: PUT
// URL: http://localhost:3000/products/PRD00021
// body: form-data
//   price     : 31000
//   accountID : ACC00001
//   (no image field — existing image_url is kept as-is)
//
// Testing Update a Product (product not found)
// method: PUT
// URL: http://localhost:3000/products/PRD99999
// body: form-data
//   price     : 15000
//   accountID : ACC00001
// -------------------------------------------------------

// PUT /products/:id  — update an existing product (with optional ImgBB image upload)
// Body: form-data with any updatable fields + accountID
// File: image (optional) — if provided, uploads to ImgBB and replaces the old image_url
router.put('/products/:id', upload.single('image'), async (req, res) => {
    const { name, type, price, description, status, accountID } = req.body
    const { id } = req.params

    if (!accountID) return res.status(400).json({ success: false, message: 'accountID is required' })

    try {
        const fields = []
        const params = []

        if (name        !== undefined) { fields.push('name = ?');        params.push(name) }
        if (type        !== undefined) { fields.push('type = ?');        params.push(type) }
        if (price       !== undefined) { fields.push('price = ?');       params.push(price) }
        if (description !== undefined) { fields.push('description = ?'); params.push(description) }
        if (status      !== undefined) { fields.push('status = ?');      params.push(status) }

        // Only upload and replace image_url if a new file was attached
        if (req.file) {
            const image_url = await uploadToImgBB(req.file.buffer)
            fields.push('image_url = ?')
            params.push(image_url)
        }

        if (fields.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' })

        params.push(id)
        const sql = `UPDATE Product SET ${fields.join(', ')} WHERE ProductID = ?`

        dbConn.query(sql, params, (err, result) => {
            if (err) return res.status(500).json({ success: false, message: err.message })
            if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Product not found' })
            writeLog(accountID, id, 2)
            res.json({ success: true, message: 'Product updated successfully' })
        })

    } catch (err) {
        // Catches ImgBB network errors or API rejections (e.g. invalid key, bad file)
        res.status(500).json({ success: false, message: 'Image upload failed: ' + err.message })
    }
})

// -------------------------------------------------------
// Testing Delete (deactivate) a Product (success case)
// method: DELETE
// URL: http://localhost:3000/products/PRD00021
// body: raw JSON
// {
//   "accountID": "ACC00001"
// }
//
// Testing Delete (deactivate) a Product (missing accountID)
// method: DELETE
// URL: http://localhost:3000/products/PRD00021
// body: raw JSON
// {
// }
// -------------------------------------------------------

// DELETE /products/:id  — soft-delete (sets status = 0)
// Body: raw JSON with accountID
router.delete('/products/:id', (req, res) => {
    const { accountID } = req.body
    const { id } = req.params

    if (!accountID) return res.status(400).json({ success: false, message: 'accountID is required' })

    const sql = `UPDATE Product SET status = 0 WHERE ProductID = ?`

    dbConn.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message })
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Product not found' })
        writeLog(accountID, id, 3)
        res.json({ success: true, message: 'Product deactivated successfully' })
    })
})


// ============================================================
// 3. AUTHENTICATION - LOGIN
// ============================================================

// -------------------------------------------------------
// Testing Login (success case)
// method: POST
// URL: http://localhost:3000/login
// body: raw JSON
// {
//   "username": "somchai_super",
//   "password": "Passw0rd1!"
// }
//
// Testing Login (wrong password)
// method: POST
// URL: http://localhost:3000/login
// body: raw JSON
// {
//   "username": "somchai_super",
//   "password": "wrongpassword"
// }
//
// Testing Login (username not found)
// method: POST
// URL: http://localhost:3000/login
// body: raw JSON
// {
//   "username": "ghost_user",
//   "password": "Passw0rd1!"
// }
// -------------------------------------------------------

// POST /login
// Body: raw JSON with username, password
router.post('/login', (req, res) => {
    const { username, password } = req.body

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required' })
    }

    // Step 1: Find the account by username and join with Admin for full profile
    const sql = `
        SELECT 
            ac.AccountID,
            ac.username,
            ac.password,
            ac.role,
            ac.loginLog,
            ad.AdminID,
            ad.fname,
            ad.lname,
            ad.email,
            ad.tel
        FROM Account ac
        JOIN Admin ad ON ac.AdminID = ad.AdminID
        WHERE ac.username = ?
    `

    dbConn.query(sql, [username], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message })

        // Step 2: Check if username exists
        if (results.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' })
        }

        const account = results[0]

        // Step 3: Check if password matches
        if (account.password !== password) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' })
        }

        // Step 4: Update loginLog with current timestamp
        const updateSql = `UPDATE Account SET loginLog = NOW() WHERE AccountID = ?`
        dbConn.query(updateSql, [account.AccountID], (updateErr) => {
            if (updateErr) return res.status(500).json({ success: false, message: updateErr.message })

            // Step 5: Return account info (exclude password from response)
            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    AccountID: account.AccountID,
                    username:  account.username,
                    role:      account.role,
                    AdminID:   account.AdminID,
                    fname:     account.fname,
                    lname:     account.lname,
                    email:     account.email,
                    tel:       account.tel
                }
            })
        })
    })
})


app.listen(process.env.PORT, function(){
    console.log(`Server listening on port: ${process.env.PORT}`)
})