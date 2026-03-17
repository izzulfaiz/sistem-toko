-- =====================================================
-- PARFUM STOCK SYSTEM — Database Schema
-- Import file ini lewat phpMyAdmin atau terminal MySQL
-- =====================================================

CREATE DATABASE IF NOT EXISTS parfum_stock CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE parfum_stock;

-- -----------------------------------------------------
-- Tabel: cabang
-- -----------------------------------------------------
CREATE TABLE cabang (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    nama       VARCHAR(100) NOT NULL,
    alamat     VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- Tabel: bibit
-- -----------------------------------------------------
CREATE TABLE bibit (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    nama       VARCHAR(100) NOT NULL,
    satuan     VARCHAR(20)  DEFAULT 'ml',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- Tabel: stok
-- (menyimpan jumlah stok per bibit per cabang)
-- -----------------------------------------------------
CREATE TABLE stok (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    cabang_id  INT NOT NULL,
    bibit_id   INT NOT NULL,
    jumlah     DECIMAL(10,2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_stok (cabang_id, bibit_id),
    FOREIGN KEY (cabang_id) REFERENCES cabang(id) ON DELETE CASCADE,
    FOREIGN KEY (bibit_id)  REFERENCES bibit(id)  ON DELETE CASCADE
);

-- -----------------------------------------------------
-- Tabel: users
-- -----------------------------------------------------
CREATE TABLE users (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    nama       VARCHAR(100) NOT NULL,
    username   VARCHAR(50)  NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,          -- bcrypt hash
    role       ENUM('admin','karyawan') DEFAULT 'karyawan',
    cabang_id  INT DEFAULT NULL,               -- NULL = admin (semua cabang)
    aktif      TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cabang_id) REFERENCES cabang(id) ON DELETE SET NULL
);

-- -----------------------------------------------------
-- Tabel: log_aktivitas
-- -----------------------------------------------------
CREATE TABLE log_aktivitas (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    cabang_id  INT NOT NULL,
    bibit_id   INT NOT NULL,
    tipe       ENUM('kurang','tambah','set') NOT NULL,
    jumlah     DECIMAL(10,2) NOT NULL,
    sisa       DECIMAL(10,2) NOT NULL,
    keterangan VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)   REFERENCES users(id)  ON DELETE CASCADE,
    FOREIGN KEY (cabang_id) REFERENCES cabang(id) ON DELETE CASCADE,
    FOREIGN KEY (bibit_id)  REFERENCES bibit(id)  ON DELETE CASCADE
);

-- =====================================================
-- DATA AWAL
-- =====================================================

-- Cabang
INSERT INTO cabang (nama, alamat) VALUES
('Cabang Pusat',    'Jl. Sudirman No. 1, Jakarta'),
('Cabang Selatan',  'Jl. TB Simatupang No. 5, Jakarta Selatan'),
('Cabang Timur',    'Jl. Raya Bekasi No. 20, Jakarta Timur'),
('Cabang Barat',    'Jl. Daan Mogot No. 15, Jakarta Barat'),
('Cabang Utara',    'Jl. Pluit Raya No. 8, Jakarta Utara'),
('Cabang Bandung',  'Jl. Asia Afrika No. 10, Bandung'),
('Cabang Surabaya', 'Jl. Tunjungan No. 3, Surabaya');

-- Bibit parfum
INSERT INTO bibit (nama) VALUES
('Oud Arabia'),
('Rose de Grasse'),
('Musk Blanc'),
('Vanilla Orientale'),
('Amber Wood');

-- Stok awal (semua cabang x semua bibit = 500ml)
INSERT INTO stok (cabang_id, bibit_id, jumlah)
SELECT c.id, b.id, 500
FROM cabang c CROSS JOIN bibit b;

-- Admin utama (password: admin123)
INSERT INTO users (nama, username, password, role, cabang_id) VALUES
('Admin Utama', 'admin', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', NULL);

-- Karyawan per cabang (password: kar123)
INSERT INTO users (nama, username, password, role, cabang_id) VALUES
('Karyawan Pusat',    'kar1', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'karyawan', 1),
('Karyawan Selatan',  'kar2', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'karyawan', 2),
('Karyawan Timur',    'kar3', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'karyawan', 3),
('Karyawan Barat',    'kar4', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'karyawan', 4),
('Karyawan Utara',    'kar5', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'karyawan', 5),
('Karyawan Bandung',  'kar6', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'karyawan', 6),
('Karyawan Surabaya', 'kar7', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'karyawan', 7);

-- Catatan password hash di atas adalah hash dari 'password' (demo)
-- Ganti password lewat menu Admin setelah login pertama kali