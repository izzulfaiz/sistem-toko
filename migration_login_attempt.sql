-- =====================================================
-- Migration: Tabel login attempts (limit percobaan)
-- Jalankan di phpMyAdmin → tab SQL
-- =====================================================
USE parfum_stock;

CREATE TABLE IF NOT EXISTS login_attempts (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(100) NOT NULL,
    ip_address  VARCHAR(45)  NOT NULL,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_username_time (username, attempted_at),
    INDEX idx_ip_time       (ip_address, attempted_at)
);
