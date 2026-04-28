const express  = require("express")
const mysql    = require("mysql2")
const path     = require('path')
const dotenv   = require("dotenv")
const multer   = require('multer')
const axios    = require('axios')
const FormData = require('form-data')
dotenv.config()

let dbConn = mysql.createPool({
    host:     process.env.HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port:     process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false
    }
})

// dbConn.connect(function(err){
//     if(err) throw err;
//     console.log(`Connected DB: ${process.env.DB_NAME}`)
// })

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

const rawDbQuery = dbConn.query.bind(dbConn)
const transientDbErrorCodes = new Set([
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'EPIPE',
    'ENOTFOUND',
    'EAI_AGAIN',
    'ENETDOWN',
    'ENETUNREACH',
    'EHOSTUNREACH',
    'ER_CON_COUNT_ERROR',
    'PROTOCOL_CONNECTION_LOST',
    'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
    'PROTOCOL_ENQUEUE_AFTER_QUIT',
    'ER_SERVER_SHUTDOWN'
])

let aivenWakePromise = null

function isTransientDbError(err) {
    if (!err) return false

    return transientDbErrorCodes.has(err.code)
        || transientDbErrorCodes.has(err.errno)
        || /connect|connection|closed|lost|refused|timeout|shutdown|getaddrinfo|notfound|dns/i.test(err.message || '')
}

function getAivenServiceUrl() {
    const configuredUrl =
        process.env.AIVEN_SERVICE_URL ||
        process.env.AIVEN_WAKE_URL ||
        process.env.AIVEN_SERVICE_START_URL

    if (configuredUrl) {
        return configuredUrl.replace(/\/start\/?$/, '').replace(/\/$/, '')
    }

    if (!process.env.AIVEN_PROJECT || !process.env.AIVEN_SERVICE_NAME) return null

    return `https://api.aiven.io/v1/project/${encodeURIComponent(process.env.AIVEN_PROJECT)}/service/${encodeURIComponent(process.env.AIVEN_SERVICE_NAME)}`
}

function getAivenHeaders() {
    const headers = {}
    if (process.env.AIVEN_AUTH_HEADER) {
        headers.Authorization = process.env.AIVEN_AUTH_HEADER
    } else if (process.env.AIVEN_API_TOKEN) {
        headers.Authorization = `Bearer ${process.env.AIVEN_API_TOKEN}`
    }

    return headers
}

function extractAivenServiceInfo(responseData) {
    const service = responseData?.service || responseData || {}

    return {
        state: service.state,
        serviceType: service.service_type,
        plan: service.plan,
        cloud: service.cloud_name,
        updateTime: service.update_time
    }
}

async function getAivenServiceStatus() {
    const serviceUrl = getAivenServiceUrl()
    if (!serviceUrl) {
        return {
            ok: false,
            configured: false,
            message: 'Aiven service URL is not configured'
        }
    }

    try {
        const response = await axios.get(serviceUrl, {
            headers: getAivenHeaders(),
            timeout: 15000
        })

        return {
            ok: true,
            configured: true,
            httpStatus: response.status,
            service: extractAivenServiceInfo(response.data)
        }
    } catch (err) {
        return {
            ok: false,
            configured: true,
            httpStatus: err.response?.status,
            message: err.response?.data?.message || err.message,
            errors: err.response?.data?.errors
        }
    }
}

async function wakeAivenService() {
    const serviceUrl = getAivenServiceUrl()
    if (!serviceUrl) {
        return {
            ok: false,
            configured: false,
            message: 'Aiven service URL is not configured'
        }
    }

    if (aivenWakePromise) return aivenWakePromise

    aivenWakePromise = axios.put(serviceUrl, { powered: true }, {
        headers: {
            ...getAivenHeaders(),
            'Content-Type': 'application/json'
        },
        timeout: 30000
    })
        .then((response) => ({
            ok: true,
            configured: true,
            httpStatus: response.status,
            service: extractAivenServiceInfo(response.data)
        }))
        .catch((err) => {
            console.error('Aiven wake-up failed:', err.response?.data?.message || err.message)
            return {
                ok: false,
                configured: true,
                httpStatus: err.response?.status,
                message: err.response?.data?.message || err.message,
                errors: err.response?.data?.errors
            }
        })
        .finally(() => {
            aivenWakePromise = null
        })

    return aivenWakePromise
}

function queryWithWakeup(sql, values, callback) {
    if (typeof values === 'function') {
        callback = values
        values = undefined
    }

    if (typeof callback !== 'function') {
        return rawDbQuery(sql, values)
    }

    let attempt = 0
    const maxAttempts = 3

    const execute = () => {
        rawDbQuery(sql, values, (err, results, fields) => {
            if (!err) {
                callback(null, results, fields)
                return
            }

            if (attempt >= maxAttempts - 1 || !isTransientDbError(err)) {
                callback(err, results, fields)
                return
            }

            attempt += 1
            const retryDelayMs = attempt === 1 ? 1500 : 3000

            const wakePromise = attempt === 1 ? wakeAivenService() : Promise.resolve(null)
            wakePromise.then((wakeResult) => {
                if (wakeResult?.configured && !wakeResult.ok) {
                    const wakeErr = new Error(`Failed to wake Aiven MySQL: ${wakeResult.message || 'unknown API error'}`)
                    wakeErr.code = 'AIVEN_WAKE_FAILED'
                    wakeErr.statusCode = 503
                    callback(wakeErr)
                    return
                }

                if (wakeResult?.ok && wakeResult.service?.state && wakeResult.service.state !== 'RUNNING') {
                    const wakeErr = new Error(`Aiven MySQL is waking up (${wakeResult.service.state}). Try again in a few minutes.`)
                    wakeErr.code = 'AIVEN_WAKE_IN_PROGRESS'
                    wakeErr.statusCode = 503
                    callback(wakeErr)
                    return
                }

                setTimeout(execute, retryDelayMs)
            }).catch(() => {
                setTimeout(execute, retryDelayMs)
            })
        })
    }

    return execute()
}

dbConn.query = queryWithWakeup

// Helper: upload image buffer to ImgBB, returns the image URL
async function uploadToImgBB(fileBuffer) {
    const base64Image = fileBuffer.toString('base64')

    const form = new FormData()
    form.append('image', base64Image)

    const response = await axios.post(
        `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
        form,
        { headers: form.getHeaders() }
    )

    return response.data.data.url  // permanent display URL
}

// Helper: write a ProductLog entry
// Action codes: 1=Added, 2=Updated, 3=Deleted
function writeLog(accountID, productID, action) {
    const sql = `INSERT INTO ProductLog (AccountID, ProductID, action, dateAndTime) VALUES (?, ?, ?, NOW())`
    dbConn.query(sql, [accountID, productID, action], (err) => {
        if (err) console.error('ProductLog error:', err.message)
    })
}

function sendDbError(res, err) {
    return res.status(err.statusCode || 500).json({
        success: false,
        code: err.code,
        message: err.message
    })
}

router.get('/db/status', async (req, res) => {
    const status = await getAivenServiceStatus()

    if (!status.configured) {
        return res.status(500).json({ success: false, message: status.message })
    }

    if (!status.ok) {
        return res.status(status.httpStatus || 503).json({
            success: false,
            message: status.message,
            errors: status.errors
        })
    }

    res.json({ success: true, service: status.service })
})

router.post('/db/wake', async (req, res) => {
    const wakeResult = await wakeAivenService()

    if (!wakeResult.configured) {
        return res.status(500).json({ success: false, message: wakeResult.message })
    }

    if (!wakeResult.ok) {
        return res.status(wakeResult.httpStatus || 503).json({
            success: false,
            message: wakeResult.message,
            errors: wakeResult.errors
        })
    }

    const state = wakeResult.service?.state
    res.status(state === 'RUNNING' ? 200 : 202).json({
        success: true,
        message: state === 'RUNNING'
            ? 'Aiven MySQL is already running'
            : `Aiven MySQL is waking up (${state || 'unknown state'}). Try the app again in a few minutes.`,
        service: wakeResult.service
    })
})

// -------------------------------------------------------
// Testing No Criteria Search (Return All Results)
// method: GET
// URL: http://localhost:3000/products
// body: none
//
// Testing Criteria Search (Multiple Filters)
// method: GET
// URL: http://localhost:3000/products?name=Solar&type=Rooftop&minPrice=10000
// body: none
// -------------------------------------------------------
router.get('/products', (req, res) => {
    const { name, type, minPrice, maxPrice } = req.query

    let sql = `SELECT * FROM Product WHERE isDeleted = FALSE`
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
    sql += ` ORDER BY status DESC`

    dbConn.query(sql, params, (err, results) => {
        if (err) return sendDbError(res, err)
        res.json({ success: true, count: results.length, data: results })
    })
})

// -------------------------------------------------------
// Testing GET product detail by id (Pass)
// method: GET
// URL: http://localhost:3000/products/PRD00001
// body: none
//
// -------------------------------------------------------
// Testing GET product product detail by id (Fail)
// method: GET
// URL: http://localhost:3000/products/PRD54321
// body: none
//
// GET /products/:id  — single product detail
router.get('/products/:id', (req, res) => {
    const sql = `SELECT * FROM Product WHERE ProductID = ? AND isDeleted = FALSE`
    dbConn.query(sql, [req.params.id], (err, results) => {
        if (err) return sendDbError(res, err)
        if (results.length === 0) return res.status(404).json({ success: false, message: 'Product not found' })
        res.json({ success: true, data: results[0] })
    })
})


// ============================================================
// PRODUCT MANAGEMENT (Admin)
// ============================================================

// -------------------------------------------------------
// Testing Insert a new Product with image upload (success case)
// method: POST
// URL: http://localhost:3000/products
// body: form-data  ← must be form-data (NOT raw JSON) when sending an image
//   ProductID  : PRD00100
//   name       : Growatt SPF 5000
//   type       : Inverter
//   price      : 27500
//   description: 5kW Hybrid Solar Inverter with built-in MPPT controller
//   status     : 1
//   accountID  : ACC00001
//   image      : test_create.png (provided in repository)
//
// Testing Insert a new Product (missing required fields)
// method: POST
// URL: http://localhost:3000/products
// body: form-data
//   ProductID  : PRD000101
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
            try {
                image_url = await uploadToImgBB(req.file.buffer)
            } catch (imgErr) {
                console.error('ImgBB upload failed (product will be saved without image):', imgErr.message)
            }
        }

        const sql = `INSERT INTO Product (ProductID, name, type, price, description, image_url, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`
        const params = [ProductID, name, type, price, description || null, image_url, parseInt(status ?? 1)]

        dbConn.query(sql, params, (err) => {
            if (err) return sendDbError(res, err)
            writeLog(accountID, ProductID, 1)
            res.status(201).json({ success: true, message: 'Product created successfully', ProductID, image_url })
        })

    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to create product: ' + err.message })
    }
})

// -------------------------------------------------------
// Testing Update a Product with a new image (success case)
// method: PUT
// URL: http://localhost:3000/products/PRD000100
// body: form-data  ← must be form-data (NOT raw JSON) when sending an image
//   price      : 29000
//   description: 5kW Hybrid Solar Inverter with built-in MPPT controller - Updated model
//   accountID  : ACC00002
//   image      : test_update.jpg (provided in repository)
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
        if (status      !== undefined) { fields.push('status = ?');      params.push(parseInt(status)) }

        // Only upload and replace image_url if a new file was attached
        if (req.file) {
            try {
                const image_url = await uploadToImgBB(req.file.buffer)
                fields.push('image_url = ?')
                params.push(image_url)
            } catch (imgErr) {
                console.error('ImgBB upload failed (product will be updated without new image):', imgErr.message)
            }
        }

        if (fields.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' })

        params.push(id)
        const sql = `UPDATE Product SET ${fields.join(', ')} WHERE ProductID = ?`

        dbConn.query(sql, params, (err, result) => {
            if (err) return sendDbError(res, err)
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
// Testing Delete (soft-delete) a Product (success case)
// method: DELETE
// URL: http://localhost:3000/products/PRD00100
// body: raw JSON
// {
//   "accountID": "ACC00001"
// }
//
// Testing Delete (soft-delete) a Product (product not found)
// method: DELETE
// URL: http://localhost:3000/products/PRD99999
// body: raw JSON
// {
//   "accountID": "ACC00001"
// }
// -------------------------------------------------------

// DELETE /products/:id  — soft-delete (sets isDeleted = TRUE)
// Body: raw JSON with accountID
router.delete('/products/:id', (req, res) => {
    const { accountID } = req.body
    const { id } = req.params

    if (!accountID) return res.status(400).json({ success: false, message: 'accountID is required' })

    const sql = `UPDATE Product SET isDeleted = TRUE WHERE ProductID = ? AND isDeleted = FALSE`
    dbConn.query(sql, [id], (err, result) => {
        if (err) return sendDbError(res, err)
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Product not found' })
        writeLog(accountID, id, 3)
        res.json({ success: true, message: 'Product deleted successfully' })
    })
})


// -------------------------------------------------------
// Testing Administrator Login (Pass)
// method: POST
// URL: http://localhost:3000/login
// body: raw JSON
// {
//   "username" : "somchai_super",
//   "password" : "Passw0rd1!"
// }
// 
// Testing Administrator Login (Fail)
// method: POST
// URL: http://localhost:3000/login
// body: raw JSON
// {
//   "username" : "somchai_super",
//   "password" : "WrongPassword123"
// }
// -------------------------------------------------------
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
        if (err) return sendDbError(res, err)

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
            if (updateErr) return sendDbError(res, updateErr)

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
