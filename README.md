# 682-projectphase2-68_section2_group01_extra-score

## Extra Score

### For this project, we used the following tools:

- Render: a cloud platform for deploy our frontend and web services
- Aiven: a service providing a cloud-based MySQL database

### Changes from original code:

- In app.js (web service)

We changed from using createConnection() to createPool().

```
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
```

We no longer use dbConn.connect, so we comment it out.

```
// dbConn.connect(function(err){
//     if(err) throw err;
//     console.log(`Connected DB: ${process.env.DB_NAME}`)
// })
```

- We modified .env files to connect to Aiven database and upload them directly to Render

```
PORT = 3000

DB_USER = "avnadmin"
DB_PASS = "EXAMPLE_PASSWORD"
DB_NAME = "araimairu"
DB_PORT = 11405
HOST = "EXAMPLE_HOST"

IMGBB_API_KEY = "EXAMPLE_IMGBB_KEY"
```

- We changed API_BASE in javascript part in the frontend from http://localhost:8000 to https://six82-projectphase2-68-section2-group01.onrender.com/

Note: As we are using free tier of Render, you may need to wait a few minutes for it to work properly.

---

### Link

- Extra Score Repository: [View on GitHub](https://github.com/jinwaratt/682-projectphase2-68_section2_group01_extra-score)
- Link to Frontend: [Visit Deployed Website](https://six82-projectphase2-68-section2-group01-zq3y.onrender.com/)
- Link to Web Service: https://six82-projectphase2-68-section2-group01.onrender.com/
