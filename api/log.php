<?php
// =====================================================
// api/log.php — API endpoint untuk log aktivitas
// =====================================================

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/functions.php';

requireLogin();

$method = $_SERVER['REQUEST_METHOD'];
$user   = currentUser();

if ($method === 'GET') {
    $cabang_id = isAdmin() ? ($_GET['cabang_id'] ?? null) : $user['cabang_id'];
    $tanggal   = $_GET['tanggal'] ?? null;
    $page      = max(1, (int)($_GET['page']     ?? 1));
    $per_page  = min(100, max(1, (int)($_GET['per_page'] ?? 25)));
    $keyword   = trim($_GET['keyword'] ?? '');

    // Validasi format tanggal jika ada
    if ($tanggal && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $tanggal)) {
        jsonResponse(['success' => false, 'message' => 'Format tanggal tidak valid'], 400);
    }

    $result = getLogsPaginated($cabang_id, $tanggal, $page, $per_page, $keyword);

    jsonResponse([
        'success'       => true,
        'logs'          => $result['logs'],
        'total_kurang'  => $result['total_kurang'],
        'total_tambah'  => $result['total_tambah'],
        'pagination'    => $result['pagination'],
    ]);
}

// Admin bisa hapus semua log
if ($method === 'DELETE') {
    requireAdmin();
    $db = getDB();
    $db->exec("DELETE FROM log_aktivitas");
    jsonResponse(['success' => true, 'message' => 'Semua log dihapus']);
}