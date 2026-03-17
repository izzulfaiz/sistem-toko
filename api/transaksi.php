<?php
// =====================================================
// api/transaksi.php — API endpoint transaksi penjualan
// =====================================================

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/functions.php';

requireLogin();

$method = $_SERVER['REQUEST_METHOD'];
$user   = currentUser();

// GET — ambil transaksi harian dengan pagination
if ($method === 'GET') {
    $cabang_id = isAdmin() ? ($_GET['cabang_id'] ?? null) : $user['cabang_id'];
    $tanggal   = $_GET['tanggal'] ?? null;
    $page      = max(1, (int)($_GET['page']     ?? 1));
    $per_page  = min(100, max(1, (int)($_GET['per_page'] ?? 25)));

    $result = getTransaksiHarianPaginated($cabang_id, $tanggal, $page, $per_page);

    jsonResponse([
        'success'         => true,
        'transaksis'      => $result['transaksis'],
        'total_omzet'     => $result['total_omzet'],
        'total_transaksi' => $result['total_transaksi'],
        'pagination'      => $result['pagination'],
    ]);
}

// POST — simpan transaksi baru
if ($method === 'POST') {
    $body    = json_decode(file_get_contents('php://input'), true);
    $items   = $body['items']   ?? [];
    $catatan = clean($body['catatan'] ?? '');
    $cabang_id = isAdmin()
        ? (int)($body['cabang_id'] ?? $user['cabang_id'])
        : (int)$user['cabang_id'];

    if (empty($items)) {
        jsonResponse(['success' => false, 'message' => 'Tidak ada item transaksi'], 400);
    }

    // Validasi tiap item
    foreach ($items as $i => $item) {
        if (empty($item['bibit_id']) || empty($item['jumlah_jual']) || empty($item['harga_satuan'])) {
            jsonResponse(['success' => false, 'message' => "Item ke-" . ($i+1) . " tidak lengkap"], 400);
        }
        if ((float)$item['jumlah_jual'] <= 0) {
            jsonResponse(['success' => false, 'message' => "Jumlah item ke-" . ($i+1) . " harus lebih dari 0"], 400);
        }
        if ((float)$item['harga_satuan'] < 0) {
            jsonResponse(['success' => false, 'message' => "Harga tidak boleh negatif"], 400);
        }
    }

    $result = simpanTransaksi($user['id'], $cabang_id, $items, $catatan);
    jsonResponse($result, $result['success'] ? 200 : 400);
}

// GET single — ambil 1 transaksi by id
if ($method === 'GET' && isset($_GET['id'])) {
    $trx = getTransaksiById((int)$_GET['id']);
    if (!$trx) jsonResponse(['success' => false, 'message' => 'Transaksi tidak ditemukan'], 404);
    jsonResponse(['success' => true, 'transaksi' => $trx]);
}

// ---- DELETE — batalkan transaksi -------------------------
if ($method === 'DELETE') {
    $body = json_decode(file_get_contents('php://input'), true);
    $id   = (int)($body['id'] ?? 0);

    if (!$id) jsonResponse(['success' => false, 'message' => 'ID transaksi tidak valid'], 400);

    $result = batalTransaksi($id, $user['id']);
    jsonResponse($result, $result['success'] ? 200 : 400);
}