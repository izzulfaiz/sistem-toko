-- Migration: Tabel notifikasi stok kritis
USE parfum_stock;

CREATE TABLE IF NOT EXISTS notifikasi (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    cabang_id   INT NOT NULL,
    bibit_id    INT NOT NULL,
    tipe        ENUM('kritis','rendah') NOT NULL,
    jumlah      DECIMAL(10,2) NOT NULL,
    satuan      VARCHAR(20) DEFAULT 'ml',
    is_read     TINYINT(1) DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cabang_id) REFERENCES cabang(id) ON DELETE CASCADE,
    FOREIGN KEY (bibit_id)  REFERENCES bibit(id)  ON DELETE CASCADE
);

-- Index untuk query cepat
CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifikasi(is_read, created_at);
