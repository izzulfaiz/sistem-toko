-- =====================================================
-- MIGRATION — Fitur Baru
-- Jalankan query ini di phpMyAdmin → tab SQL
-- SETELAH database parfum_stock sudah ada
-- =====================================================

USE parfum_stock;

-- 1. Update tabel bibit — tambah kolom satuan & konversi
ALTER TABLE bibit
  ADD COLUMN satuan_dasar VARCHAR(20)  DEFAULT 'ml'  AFTER satuan,
  ADD COLUMN konversi     DECIMAL(10,4) DEFAULT 1    AFTER satuan_dasar,
  ADD COLUMN harga_default DECIMAL(15,2) DEFAULT 0   AFTER konversi;

-- Contoh data satuan:
-- satuan = 'lusin', satuan_dasar = 'pcs', konversi = 12
-- satuan = 'ml',    satuan_dasar = 'ml',  konversi = 1
-- satuan = 'pcs',   satuan_dasar = 'pcs', konversi = 1
-- satuan = 'gram',  satuan_dasar = 'gram',konversi = 1

-- 2. Tabel transaksi (header / nota)
CREATE TABLE IF NOT EXISTS transaksi (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    kode_nota    VARCHAR(30)  NOT NULL UNIQUE,       -- e.g. TRX-20260316-001
    user_id      INT NOT NULL,
    cabang_id    INT NOT NULL,
    total        DECIMAL(15,2) DEFAULT 0,
    catatan      VARCHAR(255)  DEFAULT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)   REFERENCES users(id)  ON DELETE CASCADE,
    FOREIGN KEY (cabang_id) REFERENCES cabang(id) ON DELETE CASCADE
);

-- 3. Tabel detail transaksi (item per nota)
CREATE TABLE IF NOT EXISTS transaksi_detail (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    transaksi_id   INT NOT NULL,
    bibit_id       INT NOT NULL,
    satuan_jual    VARCHAR(20)   NOT NULL,   -- satuan saat dijual (lusin/pcs/ml)
    jumlah_jual    DECIMAL(10,2) NOT NULL,   -- jumlah dalam satuan_jual
    jumlah_stok    DECIMAL(10,2) NOT NULL,   -- jumlah setelah konversi (yang dikurangi dari stok)
    harga_satuan   DECIMAL(15,2) DEFAULT 0,
    subtotal       DECIMAL(15,2) DEFAULT 0,
    FOREIGN KEY (transaksi_id) REFERENCES transaksi(id)  ON DELETE CASCADE,
    FOREIGN KEY (bibit_id)     REFERENCES bibit(id)      ON DELETE CASCADE
);

-- 4. Tambah kolom transaksi_id ke log_aktivitas (opsional, untuk link ke nota)
ALTER TABLE log_aktivitas
  ADD COLUMN transaksi_id INT DEFAULT NULL AFTER NULL,

-- 5. Update data bibit yang sudah ada — set satuan default ml
UPDATE bibit SET satuan_dasar = 'ml', konversi = 1 WHERE satuan_dasar IS NULL OR satuan_dasar = '';
