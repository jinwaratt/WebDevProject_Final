// Import libraries
const express = require('express')
const path = require('path')

// Config dotenv
const dotenv = require('dotenv')
dotenv.config()

const app = express()

// Router object
const router = express.Router()
app.use('/', express.static(path.join(__dirname, 'public')))
app.use(router)

// Routing
router.get('/', (req, res) =>{
    res.sendFile(path.join(`${__dirname}/html/home-page.html`))
})

router.get('/login', (req, res) =>{
    res.sendFile(path.join(`${__dirname}/html/login.html`))
})

router.get('/search', (req, res) =>{
    res.sendFile(path.join(`${__dirname}/html/search.html`))
})

router.get('/team', (req, res) =>{
    res.sendFile(path.join(`${__dirname}/html/team-page.html`))
})

router.get('/add-product', (req, res) =>{
    res.sendFile(path.join(`${__dirname}/html/add-product.html`))
})

router.get('/edit-product', (req, res) =>{
    res.sendFile(path.join(`${__dirname}/html/edit-product.html`))
})

router.get('/product-details', (req, res) =>{
    res.sendFile(path.join(`${__dirname}/html/product-details.html`))
})

router.get('/product-management', (req, res) =>{
    res.sendFile(path.join(`${__dirname}/html/product-management.html`))
})

// Handle other unspecific paths
router.use((req, res, next)=>{
    console.log("404: Invalid accessed")
    res.status(404).send("Invalid path")
})

// Listen
app.listen(process.env.PORT, function(){
    console.log(`Server listening at Port ${process.env.PORT}`)
})