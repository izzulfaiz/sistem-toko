<?php
// =====================================================
// includes/auth.php — Fungsi autentikasi & session
// =====================================================

require_once __DIR__ . '/../config/database.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Cek apakah sudah login
function isLoggedIn(): bool {
    return isset($_SESSION['user_id']);
}

// Cek role user
function isAdmin(): bool {
    return isLoggedIn() && $_SESSION['role'] === 'admin';
}

function isKaryawan(): bool {
    return isLoggedIn() && $_SESSION['role'] === 'karyawan';
}

// Paksa login — redirect ke index.php jika belum login
function requireLogin(): void {
    if (!isLoggedIn()) {
        header('Location: /parfum-stock/index.php');
        exit;
    }
}

// Paksa role admin
function requireAdmin(): void {
    requireLogin();
    if (!isAdmin()) {
        header('Location: /parfum-stock/karyawan.php');
        exit;
    }
}

// Paksa role karyawan
function requireKaryawan(): void {
    requireLogin();
    if (isAdmin()) {
        header('Location: /parfum-stock/admin.php');
        exit;
    }
}

// Proses login
function doLogin(string $username, string $password): array {
    $db   = getDB();
    $stmt = $db->prepare("
        SELECT u.*, c.nama AS cabang_nama
        FROM users u
        LEFT JOIN cabang c ON u.cabang_id = c.id
        WHERE u.username = ? AND u.aktif = 1
    ");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        return ['success' => false, 'message' => 'Username atau password salah'];
    }

    // Simpan ke session
    $_SESSION['user_id']     = $user['id'];
    $_SESSION['nama']        = $user['nama'];
    $_SESSION['username']    = $user['username'];
    $_SESSION['role']        = $user['role'];
    $_SESSION['cabang_id']   = $user['cabang_id'];
    $_SESSION['cabang_nama'] = $user['cabang_nama'] ?? null;

    return ['success' => true, 'role' => $user['role']];
}

// Ambil data session user saat ini
function currentUser(): array {
    return [
        'id'          => $_SESSION['user_id']     ?? null,
        'nama'        => $_SESSION['nama']         ?? '',
        'username'    => $_SESSION['username']     ?? '',
        'role'        => $_SESSION['role']         ?? '',
        'cabang_id'   => $_SESSION['cabang_id']    ?? null,
        'cabang_nama' => $_SESSION['cabang_nama']  ?? null,
    ];
}