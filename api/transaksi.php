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
    $body   = json_decode(file_get_contents('php://input'), true);
    $action = $body['action'] ?? '';

    // ---- Jika action reward, proses reward dulu ----
    if ($action === 'reward') {
        $items     = $body['items']     ?? [];
        $member_id = (int)($body['member_id'] ?? 0);
        $reward_id = (int)($body['reward_id'] ?? 0);
        $cabang_id = isAdmin()
            ? (int)($body['cabang_id'] ?? $user['cabang_id'])
            : (int)$user['cabang_id'];

        if (empty($items))   jsonResponse(['success' => false, 'message' => 'Tidak ada item'], 400);
        if (!$member_id)     jsonResponse(['success' => false, 'message' => 'Member tidak valid'], 400);
        if (!$reward_id)     jsonResponse(['success' => false, 'message' => 'Reward tidak valid'], 400);

        foreach ($items as $i => $item) {
            if (!isset($item['bibit_id'], $item['jumlah_jual'], $item['jumlah_stok'])) {
                jsonResponse(['success' => false, 'message' => "Item ke-" . ($i+1) . " tidak lengkap"], 400);
            }
            if ((float)$item['jumlah_jual'] <= 0) {
                jsonResponse(['success' => false, 'message' => "Jumlah item ke-" . ($i+1) . " harus lebih dari 0"], 400);
            }
        }

        $result = simpanRewardTransaksi($user['id'], $cabang_id, $member_id, $reward_id, $items);
        jsonResponse($result, $result['success'] ? 200 : 400);
    }

    // ---- Transaksi biasa (kode lama tidak berubah) ----
    $items      = $body['items']      ?? [];
    $catatan    = clean($body['catatan']   ?? '');
    $member_id  = isset($body['member_id']) ? (int)$body['member_id'] : null;
    $stamp_data = $body['stamp_data'] ?? [];
    $cabang_id  = isAdmin()
        ? (int)($body['cabang_id'] ?? $user['cabang_id'])
        : (int)$user['cabang_id'];

    if (empty($items)) {
        jsonResponse(['success' => false, 'message' => 'Tidak ada item transaksi'], 400);
    }

    foreach ($items as $i => $item) {
        if (!isset($item['bibit_id'], $item['jumlah_jual'], $item['harga_satuan'])) {
            jsonResponse(['success' => false, 'message' => "Item ke-" . ($i + 1) . " tidak lengkap"], 400);
        }
        if ((float)$item['jumlah_jual'] <= 0) {
            jsonResponse(['success' => false, 'message' => "Jumlah item ke-" . ($i + 1) . " harus lebih dari 0"], 400);
        }
        if ((float)$item['harga_satuan'] < 0) {
            jsonResponse(['success' => false, 'message' => "Harga tidak boleh negatif"], 400);
        }
    }

    if ($member_id) {
        $cekMember = getDB()->prepare("SELECT id, stamp_available FROM members WHERE id = ? AND aktif = 1");
        $cekMember->execute([$member_id]);
        $memberData = $cekMember->fetch();
        if (!$memberData) {
            jsonResponse(['success' => false, 'message' => 'Member tidak ditemukan atau tidak aktif'], 400);
        }
    }

    $result = simpanTransaksiDenganStamp(
        $user['id'], $cabang_id, $items, $catatan, $member_id, $stamp_data
    );
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