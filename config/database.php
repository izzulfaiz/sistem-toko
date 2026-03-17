<?php
// =====================================================
// config/database.php — Koneksi MySQL via PDO
// =====================================================
// Ganti nilai di bawah sesuai setup XAMPP Anda
// =====================================================

define('DB_HOST', 'localhost');
define('DB_NAME', 'parfum_stock');
define('DB_USER', 'root');       // user MySQL XAMPP default
define('DB_PASS', '');           // password MySQL XAMPP default (kosong)
define('DB_CHAR', 'utf8mb4');

function getDB(): PDO {
    static $pdo = null;

    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHAR;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode(['error' => 'Koneksi database gagal: ' . $e->getMessage()]));
        }
    }

    return $pdo;
}