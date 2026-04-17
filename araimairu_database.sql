-- Create the database
CREATE DATABASE IF NOT EXISTS `araimairu`;
USE `araimairu`;

-- --------------------------------------------------------
-- Drop existing tables to allow clean reruns
-- (Child tables must be dropped before Parent tables)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `ProductLog`;
DROP TABLE IF EXISTS `Account`;
DROP TABLE IF EXISTS `Product`;
DROP TABLE IF EXISTS `Admin`;

-- --------------------------------------------------------
-- Create Tables
-- --------------------------------------------------------

-- Table: Admin
CREATE TABLE `Admin` (
    `AdminID` CHAR(8) NOT NULL,
    `fname` NVARCHAR(30) NOT NULL,
    `lname` NVARCHAR(30) NOT NULL,
    `address` NVARCHAR(150) NOT NULL,
    `birthDate` DATE NOT NULL,
    `email` VARCHAR(50) NOT NULL,
    `tel` CHAR(10) NOT NULL,
    PRIMARY KEY (`AdminID`)
);

-- Table: Account
CREATE TABLE `Account` (
    `AccountID` CHAR(8) NOT NULL,
    `username` VARCHAR(20) NOT NULL,
    `password` NVARCHAR(20) NOT NULL,
    `role` VARCHAR(20) NOT NULL,
    `loginLog` DATETIME NOT NULL,
    `AdminID` CHAR(8) NOT NULL,
    PRIMARY KEY (`AccountID`),
    FOREIGN KEY (`AdminID`) REFERENCES `Admin`(`AdminID`)
);

-- Table: Product
CREATE TABLE `Product` (
    `ProductID` CHAR(8) NOT NULL,
    `name` VARCHAR(30) NOT NULL,
    `type` VARCHAR(30) NOT NULL,
    `price` DECIMAL(15,2) NOT NULL,
    `description` NVARCHAR(150) NULL,
    `image_url` VARCHAR(255) NULL,
    `status` BIT NOT NULL,
    PRIMARY KEY (`ProductID`)
);

-- Table: ProductLog
CREATE TABLE `ProductLog` (
    `AccountID` CHAR(8) NOT NULL,
    `ProductID` CHAR(8) NOT NULL,
    `action` INT NOT NULL,
    `dateAndTime` DATETIME NOT NULL,
    PRIMARY KEY (`AccountID`, `ProductID`),
    FOREIGN KEY (`AccountID`) REFERENCES `Account`(`AccountID`),
    FOREIGN KEY (`ProductID`) REFERENCES `Product`(`ProductID`)
);


-- --------------------------------------------------------
-- Insert Data
-- --------------------------------------------------------

-- 1. Insert Data into Admin Table
INSERT INTO `Admin` (`AdminID`, `fname`, `lname`, `address`, `birthDate`, `email`, `tel`) VALUES
('ADM00001', 'Somchai', 'Jaidee', '123 Sukhumvit Rd, Bangkok, Thailand', '1985-05-14', 'somchai.j@araimairu.com', '0812345678'),
('ADM00002', 'Nattapong', 'Srisawat', '45 Silom Rd, Bangkok, Thailand', '1990-11-20', 'nattapong.s@araimairu.com', '0823456789'),
('ADM00003', 'Kanya', 'Ruenrom', '67 Asok Rd, Bangkok, Thailand', '1988-02-15', 'kanya.r@araimairu.com', '0834567890'),
('ADM00004', 'John', 'Smith', '89 Sathorn Rd, Bangkok, Thailand', '1982-07-30', 'john.s@araimairu.com', '0845678901'),
('ADM00005', 'Mali', 'Wan', '12 Rama IV Rd, Bangkok, Thailand', '1995-10-10', 'mali.w@araimairu.com', '0856789012'),
('ADM00006', 'Prasert', 'Makmai', '34 Ladprao Rd, Bangkok, Thailand', '1987-03-25', 'prasert.m@araimairu.com', '0867890123'),
('ADM00007', 'Suda', 'Yodying', '56 Ratchada Rd, Bangkok, Thailand', '1992-08-05', 'suda.y@araimairu.com', '0878901234'),
('ADM00008', 'Wasan', 'Charoen', '78 Phayathai Rd, Bangkok, Thailand', '1986-12-12', 'wasan.c@araimairu.com', '0889012345'),
('ADM00009', 'Alice', 'Brown', '90 Thong Lo, Bangkok, Thailand', '1991-04-18', 'alice.b@araimairu.com', '0890123456'),
('ADM00010', 'Chai', 'Phat', '112 Ekkamai, Bangkok, Thailand', '1984-09-22', 'chai.p@araimairu.com', '0901234567');

-- 2. Insert Data into Account Table
INSERT INTO `Account` (`AccountID`, `username`, `password`, `role`, `loginLog`, `AdminID`) VALUES
('ACC00001', 'somchai_super', 'Passw0rd1!', 'SuperAdmin', '2024-03-01 08:30:00', 'ADM00001'),
('ACC00002', 'natt_mgr', 'S3cureP@ss', 'Manager', '2024-03-02 09:15:00', 'ADM00002'),
('ACC00003', 'kanya_ed', 'Ed1t0rKanya', 'Editor', '2024-03-03 10:45:00', 'ADM00003'),
('ACC00004', 'john_mgr', 'J0hnM@nager', 'Manager', '2024-03-04 11:20:00', 'ADM00004'),
('ACC00005', 'mali_ed', 'Mali2024!!', 'Editor', '2024-03-05 13:10:00', 'ADM00005'),
('ACC00006', 'prasert_ed', 'Pr@sertLog', 'Editor', '2024-03-06 14:05:00', 'ADM00006'),
('ACC00007', 'suda_ed', 'SudaP@ss', 'Editor', '2024-03-07 15:30:00', 'ADM00007'),
('ACC00008', 'wasan_mgr', 'W@sanMGR', 'Manager', '2024-03-08 16:25:00', 'ADM00008'),
('ACC00009', 'alice_ed', 'Al1ceW0rks', 'Editor', '2024-03-09 17:10:00', 'ADM00009'),
('ACC00010', 'chai_super', 'ChaiM@ster', 'SuperAdmin', '2024-03-10 18:40:00', 'ADM00010');

-- 3. Insert Data into Product Table
INSERT INTO `Product` (`ProductID`, `name`, `type`, `price`, `description`, `image_url`, `status`) VALUES
('PRD00001', 'SunPower Maxeon 3', 'Rooftop', 12500.00, '400W High Efficiency Monocrystalline Solar Panel', 'https://i.ibb.co/LDj5rDmx/PRD00001.png', 1),
('PRD00002', 'Canadian Solar 350W', 'Rooftop', 8500.00, '350W Poly/Mono Hybrid Panel for residential roofs', 'https://i.ibb.co/whYfKrFf/PRD00002.png', 1),
('PRD00003', 'Huawei SUN2000', 'Rooftop', 25000.00, '5kW Smart String Inverter with active arcing protection', 'https://i.ibb.co/QvpJJNJG/PRD00003.png', 1),
('PRD00004', 'SolarEdge HD-Wave', 'Rooftop', 28000.00, 'Single Phase Inverter engineered for high performance', 'https://i.ibb.co/kV3gKnXz/PRD00004.png', 1),
('PRD00005', 'Tesla Powerwall 2', 'Rooftop', 250000.00, '13.5kWh Home Battery Storage System for backup power', 'https://i.ibb.co/LD3bZ8xW/PRD00005.png', 1),
('PRD00006', 'LG Chem RESU10H', 'Rooftop', 180000.00, '9.8kWh High Voltage Battery, compact and powerful', 'https://i.ibb.co/npy7pxQ/PRD00006.png', 0),
('PRD00007', 'Wallbox Pulsar Plus', 'Services', 32000.00, '22kW Smart EV Charger with Bluetooth and Wi-Fi', 'https://i.ibb.co/Jjsb2qsq/PRD00007.png', 1),
('PRD00008', 'ABB Terra AC Wallbox', 'Services', 35000.00, '11kW AC Wallbox for reliable electric vehicle charging', 'https://i.ibb.co/wN0CN7j3/PRD00008.png', 1),
('PRD00009', 'Google Nest Hub', 'Services', 3500.00, 'Smart Home Control Center to monitor energy ecosystem', 'https://i.ibb.co/B5fK3Yy7/PRD00009.png', 1),
('PRD00010', 'Philips Hue Starter', 'Services', 4500.00, 'Smart Lighting System to integrate with home automation', 'https://i.ibb.co/4Zjm7Dvh/PRD00010.png', 1),
('PRD00011', 'Jinko Solar Tiger Pro', 'Rooftop', 9500.00, '415W Monocrystalline PERC Solar Panel', 'https://i.ibb.co/mkfgs4j/PRD00011.png', 1),
('PRD00012', 'Trina Solar Vertex S', 'Rooftop', 9200.00, '400W High Efficiency Solar Panel for residential', 'https://i.ibb.co/JF06frx2/PRD00012.png', 1),
('PRD00013', 'Schletter Roof Kit', 'Rooftop', 3500.00, 'Durable aluminum roof mounting structure for solar panels', 'https://i.ibb.co/NdkG6Ygs/PRD00013.png', 1),
('PRD00014', 'Clenergy Ground Mount', 'Ground', 8500.00, 'Ground mounting system for residential solar arrays', 'https://i.ibb.co/wFskbfgh/PRD00014.png', 1),
('PRD00015', 'Fronius Primo 5.0-1', 'Rooftop', 32000.00, '5kW Single Phase Inverter with advanced grid features', 'https://i.ibb.co/5hrtPGy6/PRD00015.png', 1),
('PRD00016', 'BYD Battery-Box Premium', 'Rooftop', 160000.00, '10.2kWh Modular Lithium-iron Phosphate Battery Storage', 'https://i.ibb.co/0jtyXB4v/PRD00016.png', 1),
('PRD00017', 'JuiceBox 40 Smart', 'Services', 28000.00, '9.6kW Smart EV Charger with WiFi connectivity and app control', 'https://i.ibb.co/TNZNy9h/PRD00017.png', 1),
('PRD00018', 'Echo Show 10', 'Services', 8900.00, 'Smart display for home automation and energy monitoring', 'https://i.ibb.co/KxwBVvLL/PRD00018.png', 1),
('PRD00019', 'Ecobee Smart Thermostat', 'Services', 7500.00, 'Smart thermostat to optimize home temperature and save energy', 'https://i.ibb.co/M5Zqvr19/PRD00019.png', 1),
('PRD00020', 'Enphase IQ Battery 10', 'Rooftop', 220000.00, '10.08kWh All-in-one AC-coupled storage system for backup', 'https://i.ibb.co/qM1cXzR8/PRD00020.png', 0);

-- 4. Insert Data into ProductLog Table
-- (Action 1 indicates "Added")
INSERT INTO `ProductLog` (`AccountID`, `ProductID`, `action`, `dateAndTime`) VALUES
('ACC00001', 'PRD00001', 1, '2024-02-15 09:00:00'),
('ACC00002', 'PRD00002', 1, '2024-02-16 10:30:00'),
('ACC00003', 'PRD00003', 1, '2024-02-17 11:15:00'),
('ACC00004', 'PRD00004', 1, '2024-02-18 13:45:00'),
('ACC00005', 'PRD00005', 1, '2024-02-19 14:20:00'),
('ACC00006', 'PRD00006', 1, '2024-02-20 15:10:00'), 
('ACC00007', 'PRD00007', 1, '2024-02-21 16:05:00'),
('ACC00008', 'PRD00008', 1, '2024-02-22 09:50:00'),
('ACC00009', 'PRD00009', 1, '2024-02-23 11:30:00'),
('ACC00010', 'PRD00010', 1, '2024-02-24 14:00:00'),
('ACC00001', 'PRD00011', 1, '2024-02-25 09:15:00'),
('ACC00002', 'PRD00012', 1, '2024-02-26 10:45:00'),
('ACC00003', 'PRD00013', 1, '2024-02-27 11:20:00'),
('ACC00004', 'PRD00014', 1, '2024-02-28 13:30:00'),
('ACC00005', 'PRD00015', 1, '2024-02-29 14:15:00'),
('ACC00006', 'PRD00016', 1, '2024-03-01 15:00:00'),
('ACC00007', 'PRD00017', 1, '2024-03-02 16:10:00'),
('ACC00008', 'PRD00018', 1, '2024-03-03 09:30:00'),
('ACC00009', 'PRD00019', 1, '2024-03-04 11:00:00'),
('ACC00010', 'PRD00020', 1, '2024-03-05 14:45:00');