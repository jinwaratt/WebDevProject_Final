// Import libraries
const express = require('express')
const path = require('path')

// Config dotenv
const dotenv = require('dotenv')
dotenv.config()

const app = express()

// Router object
const router = express.Router()
app.use(router)
// app.use('/', express.static(path.join(__dirname, 'public')))

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

// Handle other unspecific paths
router.use((req, res, next)=>{
    console.log("404: Invalid accessed")
    res.status(404).send("Invalid path")
})

// Listen
app.listen(process.env.PORT, function(){
    console.log(`Server listening at Port ${process.env.PORT}`)
})