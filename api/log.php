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

    $db = getDB();

    // WHERE clause cabang untuk pengeluaran
    $where_kel = isAdmin()
        ? ($cabang_id ? "AND p.cabang_id = $cabang_id" : "")
        : "AND p.cabang_id = {$user['cabang_id']}";

    // WHERE clause tanggal untuk pengeluaran
    $where_tgl_kel = $tanggal ? "AND DATE(p.created_at) = " . $db->quote($tanggal) : "";

    // WHERE clause keyword untuk pengeluaran
    $where_kw_kel = $keyword
        ? "AND (p.nama_item LIKE " . $db->quote("%$keyword%") .
          " OR u.nama LIKE " . $db->quote("%$keyword%") .
          " OR c.nama LIKE " . $db->quote("%$keyword%") . ")"
        : "";

    // Ambil pengeluaran — selalu tampil (tidak hanya saat filter tanggal)
    $stmt_kel = $db->prepare("
        SELECT p.id, p.nama_item, p.nominal, p.keterangan,
               p.created_at, u.nama AS user_nama, c.nama AS cabang_nama
        FROM pengeluaran p
        JOIN users  u ON p.user_id   = u.id
        JOIN cabang c ON p.cabang_id = c.id
        WHERE 1=1
        $where_kel
        $where_tgl_kel
        $where_kw_kel
        ORDER BY p.created_at DESC
        LIMIT 100
    ");
    $stmt_kel->execute();
    $pengeluaran = $stmt_kel->fetchAll();

    $result = getLogsPaginated($cabang_id, $tanggal, $page, $per_page, $keyword);

    jsonResponse([
        'success'       => true,
        'logs'          => $result['logs'],
        'total_kurang'  => $result['total_kurang'],
        'total_tambah'  => $result['total_tambah'],
        'pagination'    => $result['pagination'],
        'pengeluaran'   => $pengeluaran,
    ]);
}

// Admin bisa hapus semua log
if ($method === 'DELETE') {
    requireAdmin();
    $db = getDB();
    $db->exec("DELETE FROM log_aktivitas");
    jsonResponse(['success' => true, 'message' => 'Semua log dihapus']);
}