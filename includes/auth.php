<?php
// =====================================================
// includes/auth.php — Fungsi autentikasi & session
// =====================================================

require_once __DIR__ . '/../config/database.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// ---- SESSION TIMEOUT (1 jam tidak aktif) --------
define('SESSION_TIMEOUT',   3600); // 1 jam dalam detik
define('LOGIN_MAX_ATTEMPT', 5);    // maks percobaan login
define('LOGIN_LOCKOUT_MIN', 1);   // lama kunci dalam menit

function checkSessionTimeout(): void {
    if (!isset($_SESSION['user_id'])) return;

    $now = time();

    // Cek apakah sudah timeout
    if (isset($_SESSION['last_activity'])) {
        if ($now - $_SESSION['last_activity'] > SESSION_TIMEOUT) {
            // Session expired — hapus dan redirect
            session_unset();
            session_destroy();

            $isApi = (strpos($_SERVER['REQUEST_URI'] ?? '', '/api/') !== false);
            if ($isApi) {
                http_response_code(401);
                header('Content-Type: application/json');
                echo json_encode(['success' => false, 'message' => 'Sesi habis, silakan login ulang', 'timeout' => true]);
                exit;
            }
            header('Location: /parfum-stock/index.php?timeout=1');
            exit;
        }
    }

    // Update waktu aktivitas terakhir
    $_SESSION['last_activity'] = $now;
}

// Jalankan pengecekan timeout setiap request
checkSessionTimeout();

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
    // Kalau request dari fetch/AJAX, kembalikan JSON bukan redirect
    $isApi = (strpos($_SERVER['REQUEST_URI'] ?? '', '/api/') !== false);

    if (!isLoggedIn()) {
        if ($isApi) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'message' => 'Sesi habis, silakan login ulang']);
            exit;
        }
        header('Location: /parfum-stock/index.php');
        exit;
    }

    if (!isAdmin()) {
        if ($isApi) {
            http_response_code(403);
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'message' => 'Akses ditolak']);
            exit;
        }
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

// ---- LOGIN ATTEMPT HELPERS --------------------------------

function getLoginAttempts(string $username, string $ip): int {
    $db      = getDB();
    $cutoff  = date('Y-m-d H:i:s', time() - LOGIN_LOCKOUT_MIN * 60);
    $stmt    = $db->prepare("
        SELECT COUNT(*) FROM login_attempts
        WHERE (username = ? OR ip_address = ?) AND attempted_at > ?
    ");
    $stmt->execute([$username, $ip, $cutoff]);
    return (int)$stmt->fetchColumn();
}

function recordLoginAttempt(string $username, string $ip): void {
    $db   = getDB();
    $stmt = $db->prepare("INSERT INTO login_attempts (username, ip_address) VALUES (?, ?)");
    $stmt->execute([$username, $ip]);
}

function clearLoginAttempts(string $username, string $ip): void {
    $db   = getDB();
    $stmt = $db->prepare("DELETE FROM login_attempts WHERE username = ? OR ip_address = ?");
    $stmt->execute([$username, $ip]);
}

function getRemainingLockTime(string $username, string $ip): int {
    $db     = getDB();
    $cutoff = date('Y-m-d H:i:s', time() - LOGIN_LOCKOUT_MIN * 60);
    $stmt   = $db->prepare("
        SELECT attempted_at FROM login_attempts
        WHERE (username = ? OR ip_address = ?) AND attempted_at > ?
        ORDER BY attempted_at ASC LIMIT 1
    ");
    $stmt->execute([$username, $ip, $cutoff]);
    $first = $stmt->fetchColumn();
    if (!$first) return 0;
    $unlockAt = strtotime($first) + LOGIN_LOCKOUT_MIN * 60;
    return max(0, (int)ceil(($unlockAt - time()) / 60));
}

// Proses login
function doLogin(string $username, string $password): array {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $db = getDB();

    // Cek apakah sedang dikunci
    $attempts = getLoginAttempts($username, $ip);
    if ($attempts >= LOGIN_MAX_ATTEMPT) {
        $remaining = getRemainingLockTime($username, $ip);
        return [
            'success' => false,
            'message' => "Akun dikunci karena terlalu banyak percobaan. Coba lagi dalam {$remaining} menit.",
            'locked'  => true,
        ];
    }

    $stmt = $db->prepare("
        SELECT u.*, c.nama AS cabang_nama
        FROM users u
        LEFT JOIN cabang c ON u.cabang_id = c.id
        WHERE u.username = ? AND u.aktif = 1
    ");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        // Catat percobaan gagal
        recordLoginAttempt($username, $ip);
        $attempts++;
        $sisa = LOGIN_MAX_ATTEMPT - $attempts;

        if ($sisa <= 0) {
            return [
                'success' => false,
                'message' => 'Akun dikunci selama ' . LOGIN_LOCKOUT_MIN . ' menit karena terlalu banyak percobaan.',
                'locked'  => true,
            ];
        }

        return [
            'success' => false,
            'message' => 'Username atau password salah. Sisa percobaan: ' . $sisa . 'x',
        ];
    }

    // Login berhasil — hapus catatan percobaan
    clearLoginAttempts($username, $ip);

    // Simpan ke session
    $_SESSION['user_id']       = $user['id'];
    $_SESSION['nama']          = $user['nama'];
    $_SESSION['username']      = $user['username'];
    $_SESSION['role']          = $user['role'];
    $_SESSION['cabang_id']     = $user['cabang_id'];
    $_SESSION['cabang_nama']   = $user['cabang_nama'] ?? null;
    $_SESSION['last_activity'] = time();

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