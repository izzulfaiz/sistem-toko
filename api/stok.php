<?php
// =====================================================
// api/stok.php — API endpoint untuk stok
// Method: GET, POST, PUT
// =====================================================

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/functions.php';

// Load config terpusat
$appConfig = require __DIR__ . '/../config/app.php';

requireLogin();

$method = $_SERVER['REQUEST_METHOD'];
$user   = currentUser();

// ---- GET — ambil data stok ----------------------------
if ($method === 'GET') {
    $cabang_id = isAdmin() ? ($_GET['cabang_id'] ?? null) : $user['cabang_id'];
    $page      = max(1, (int)($_GET['page']     ?? 1));
    $per_page  = min(100, max(1, (int)($_GET['per_page'] ?? 25)));
    $keyword   = trim($_GET['keyword'] ?? '');
    $paginate  = isset($_GET['paginate']) && $_GET['paginate'] === '1';

    if ($paginate) {
        $result = getAllStokPaginated($cabang_id, $page, $per_page, $keyword);
        jsonResponse([
            'success'    => true,
            'stok'       => $result['stok'],
            'cabang'     => getAllCabang(),
            'bibit'      => getAllBibit(),
            'ringkasan'  => getRingkasan($cabang_id),
            'pagination' => $result['pagination'],
            'config'     => $appConfig,
        ]);
    } else {
        jsonResponse([
            'success'   => true,
            'stok'      => getAllStok($cabang_id),
            'cabang'    => getAllCabang(),
            'bibit'     => getAllBibit(),
            'ringkasan' => getRingkasan($cabang_id),
            'config'    => $appConfig,
        ]);
    }
}

// ---- POST — kurangi stok (karyawan) -------------------
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);

    $bibit_id  = (int)($body['bibit_id']  ?? 0);
    $jumlah    = (float)($body['jumlah']  ?? 0);
    $ket       = clean($body['keterangan'] ?? '');
    $cabang_id = isAdmin()
        ? (int)($body['cabang_id'] ?? 0)
        : (int)$user['cabang_id'];

    if (!$bibit_id || $jumlah <= 0 || !$cabang_id) {
        jsonResponse(['success' => false, 'message' => 'Data tidak lengkap'], 400);
    }

    $saat_ini = getStokSaatIni($cabang_id, $bibit_id);
    if ($jumlah > $saat_ini) {
        jsonResponse(['success' => false, 'message' => "Stok tidak cukup. Sisa: {$saat_ini}ml"], 400);
    }

    $jumlah_baru = $saat_ini - $jumlah;
    $ok = updateStok($cabang_id, $bibit_id, $jumlah_baru, $user['id'], 'kurang', $jumlah, $ket);

    jsonResponse([
        'success' => $ok,
        'message' => $ok ? 'Stok berhasil dikurangi' : 'Gagal menyimpan',
        'sisa'    => $jumlah_baru,
    ]);
}

// ---- PUT — set / tambah stok (admin) ------------------
if ($method === 'PUT') {
    requireAdmin();
    $body = json_decode(file_get_contents('php://input'), true);

    $cabang_ids = [];
    if (!empty($body['cabang_ids']) && is_array($body['cabang_ids'])) {
        $cabang_ids = array_map('intval', $body['cabang_ids']);
    } elseif (!empty($body['cabang_id'])) {
        $cabang_ids = [(int)$body['cabang_id']];
    }

    $bibit_id  = (int)($body['bibit_id']  ?? 0);
    $jumlah    = (float)($body['jumlah']  ?? 0);
    $tipe      = in_array($body['tipe'] ?? '', ['tambah','set']) ? $body['tipe'] : 'set';
    $ket       = clean($body['keterangan'] ?? '');

    if (empty($cabang_ids) || !$bibit_id || $jumlah < 0) {
        jsonResponse(['success' => false, 'message' => 'Data tidak lengkap'], 400);
    }

    $results = [];
    foreach ($cabang_ids as $cabang_id) {
        $saat_ini    = getStokSaatIni($cabang_id, $bibit_id);
        $jumlah_baru = $tipe === 'tambah' ? $saat_ini + $jumlah : $jumlah;
        $delta       = abs($jumlah_baru - $saat_ini);

        // ✅ Fix: tipe log ditentukan dari naik/turun, bukan dari parameter tipe
        if ($tipe === 'tambah') {
            $tipe_log = 'tambah';
            $ket_log  = $ket ?: 'Tambah stok';
        } elseif ($jumlah_baru > $saat_ini) {
            $tipe_log = 'tambah';
            $ket_log  = $ket ?: 'Set stok (naik dari ' . $saat_ini . ' → ' . $jumlah_baru . ')';
        } elseif ($jumlah_baru < $saat_ini) {
            $tipe_log = 'kurang';
            $ket_log  = $ket ?: 'Set stok (turun dari ' . $saat_ini . ' → ' . $jumlah_baru . ')';
        } else {
            $tipe_log = 'tambah';
            $ket_log  = $ket ?: 'Set stok (tidak berubah)';
        }

        $ok        = updateStok($cabang_id, $bibit_id, $jumlah_baru, $user['id'], $tipe_log, $delta, $ket_log);
        $results[] = $ok;
    }

    $allOk = !in_array(false, $results);
    jsonResponse([
        'success' => $allOk,
        'message' => $allOk
            ? 'Stok berhasil diperbarui ke ' . count($cabang_ids) . ' cabang'
            : 'Sebagian cabang gagal diperbarui',
        'total'   => count($cabang_ids),
    ]);
}

// ---- DELETE — hapus bibit/cabang (admin) ---------------
if ($method === 'DELETE') {
    requireAdmin();
    $body   = json_decode(file_get_contents('php://input'), true);
    $target = $body['target'] ?? '';
    $id     = (int)($body['id'] ?? 0);

    if (!$id || !in_array($target, ['bibit', 'cabang'])) {
        jsonResponse(['success' => false, 'message' => 'Parameter tidak valid'], 400);
    }

    $db   = getDB();
    $tbl  = $target === 'bibit' ? 'bibit' : 'cabang';
    $stmt = $db->prepare("DELETE FROM $tbl WHERE id = ?");
    $ok   = $stmt->execute([$id]);

    jsonResponse(['success' => $ok]);
}