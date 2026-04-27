# 682-projectphase2-68_section2_group01

## How to initialize database, create user, and set permission for database connection

1. On your computer, open MySQL Workbench

2. Connect to Local instance MySQL80

![alt text](README_img/step2.png)

3. Go to File > Open SQL Script > Choose "sec2_gr01_database.sql" file and click Open

![alt text](README_img/step3-1.png)![alt text](README_img/step3-2.png)

4. In the file, press Ctrl+A to select all the code, then press the lightning button to execute the script

![alt text](README_img/step4.png)

5. On MySQL Workbench, go to Server > Users and Privileges

![alt text](README_img/step5.png)

6. On Users and Privileges page, click Add Account button

![alt text](README_img/step6.png)

7. On login page, fill in following information

```
Login name: araimairu
Limit to Hosts Matching: localhost
Password: ict555
Confirm Password: ict555
```

![alt text](README_img/step7.png)

Then, click Apply

8. Go to Schema Privileges. Click Add Entry...
   ![alt text](README_img/step8.png)

9. Choose Selected schema: araimairu

![alt text](README_img/step9.png)

Then, click Ok

10. In Object Rights, check SELECT, INSERT, UPDATE, DELETE

![alt text](README_img/step10.png)

Then, click Apply

## How to start server

### Frontend Server

```
cd sec2_gr01_fe_src
npm install
npm start
```

### Web Services Server

```
cd sec2_gr01_ws_src
npm install
npm start
```

After that, you can visit http://localhost:8000

## How to access product management page

![alt text](README_img/login-info.png)

Please use the following username and password to login

```
Username: somchai_super
Password: Passw0rd1!
```
