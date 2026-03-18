-- =====================================================
-- Migration: Tabel Pengeluaran
-- Jalankan di phpMyAdmin → tab SQL
-- =====================================================
USE parfum_stock;

CREATE TABLE IF NOT EXISTS pengeluaran (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    cabang_id   INT NOT NULL,
    nama_item   VARCHAR(255) NOT NULL,
    nominal     DECIMAL(15,2) NOT NULL,
    keterangan  VARCHAR(255) DEFAULT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
    FOREIGN KEY (cabang_id) REFERENCES cabang(id)  ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_keluar_cabang  ON pengeluaran(cabang_id);
CREATE INDEX IF NOT EXISTS idx_keluar_tgl     ON pengeluaran(created_at);
CREATE INDEX IF NOT EXISTS idx_keluar_cab_tgl ON pengeluaran(cabang_id, created_at);
