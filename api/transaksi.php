<?php
// =====================================================
// api/transaksi.php — API endpoint transaksi penjualan
// =====================================================

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/functions.php';

requireLogin();

$method = $_SERVER['REQUEST_METHOD'];
$user   = currentUser();

// GET single — ambil 1 transaksi by id
if ($method === 'GET' && isset($_GET['id'])) {
    $trx = getTransaksiById((int)$_GET['id']);
    if (!$trx) jsonResponse(['success' => false, 'message' => 'Transaksi tidak ditemukan'], 404);
    jsonResponse(['success' => true, 'transaksi' => $trx]);
}

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


// ---- Tautkan member ke transaksi yang sudah ada ----
if ($action === 'tautkan_member') {
    $transaksi_id = (int)($body['transaksi_id'] ?? 0);
    $member_id    = (int)($body['member_id']    ?? 0);
    $stamp_data   = $body['stamp_data']          ?? [];
    $cabang_id    = (int)$user['cabang_id'];

    if (!$transaksi_id) jsonResponse(['success' => false, 'message' => 'ID transaksi tidak valid'], 400);
    if (!$member_id)    jsonResponse(['success' => false, 'message' => 'Pilih member terlebih dahulu'], 400);

    $db = getDB();

    // Validasi transaksi — dalam 3 hari terakhir
    $stmtTrx = $db->prepare("
        SELECT * FROM transaksi
        WHERE id = ?
        AND cabang_id = ?
        AND created_at >= DATE_SUB(NOW(), INTERVAL 3 DAY)
        AND kode_nota NOT LIKE 'BATAL-%'
        AND kode_nota NOT LIKE 'REWARD-%'
    ");
    $stmtTrx->execute([$transaksi_id, $cabang_id]);
    $trx = $stmtTrx->fetch();

    if (!$trx) jsonResponse(['success' => false, 'message' => 'Transaksi tidak ditemukan atau sudah lebih dari 3 hari'], 404);
    if ($trx['member_id']) jsonResponse(['success' => false, 'message' => 'Transaksi ini sudah terhubung ke member'], 400);

    // Validasi member
    $stmtMember = $db->prepare("SELECT * FROM members WHERE id = ? AND aktif = 1");
    $stmtMember->execute([$member_id]);
    $member = $stmtMember->fetch();
    if (!$member) jsonResponse(['success' => false, 'message' => 'Member tidak ditemukan'], 404);

    // Ambil semua item transaksi untuk validasi
    $stmtItems = $db->prepare("
        SELECT td.*, b.kategori, b.nama AS bibit_nama
        FROM transaksi_detail td
        JOIN bibit b ON td.bibit_id = b.id
        WHERE td.transaksi_id = ?
        ORDER BY td.id ASC
    ");
    $stmtItems->execute([$transaksi_id]);
    $allItems = $stmtItems->fetchAll();

    // Validasi stamp_data dari frontend
    // stamp_data berisi: [{bibit_id, mix_group}] untuk item yang di-stamp
    $mixNominalMap    = [];
    $singleNominalMap = [];
    $validStampData   = [];

    // Buat map item dari transaksi
    $itemMap = [];
    foreach ($allItems as $item) {
        $itemMap[$item['bibit_id']] = $item;
    }

    // Validasi setiap stamp_data
    foreach ($stamp_data as $sd) {
        $bibit_id  = (int)($sd['bibit_id']  ?? 0);
        $mix_group = isset($sd['mix_group']) && $sd['mix_group'] ? (int)$sd['mix_group'] : null;
        $type      = $mix_group ? 'mix' : 'single';

        if (!isset($itemMap[$bibit_id])) continue;

        $item        = $itemMap[$bibit_id];
        $isAksesoris = ($item['kategori'] ?? '') === 'aksesoris';
        $subtotal    = (float)$item['subtotal'];

        // Aksesoris tidak boleh single stamp
        if ($isAksesoris && !$mix_group) continue;

        if ($mix_group) {
            if (!isset($mixNominalMap[$mix_group])) $mixNominalMap[$mix_group] = 0;
            $mixNominalMap[$mix_group] += $subtotal;
        } else {
            $singleNominalMap[$bibit_id] = $subtotal;
        }

        $validStampData[] = [
            'type'     => $type,
            'bibit_id' => $bibit_id,
            'mix_group'=> $mix_group,
        ];
    }

    // Validasi mix group: harus ada bibit non-aksesoris di setiap mix group
    $mixHasBibit = [];
    foreach ($validStampData as $sd) {
        if ($sd['mix_group']) {
            $bibit_id    = $sd['bibit_id'];
            $isAksesoris = ($itemMap[$bibit_id]['kategori'] ?? '') === 'aksesoris';
            if (!$isAksesoris) {
                $mixHasBibit[$sd['mix_group']] = true;
            }
        }
    }

    // Filter: hapus aksesoris dari mix group yang tidak punya bibit
    $validStampData = array_filter($validStampData, function($sd) use ($mixHasBibit, $itemMap) {
        if (!$sd['mix_group']) return true;
        $isAksesoris = ($itemMap[$sd['bibit_id']]['kategori'] ?? '') === 'aksesoris';
        if ($isAksesoris && !isset($mixHasBibit[$sd['mix_group']])) return false;
        return true;
    });
    $validStampData = array_values($validStampData);

    $db->beginTransaction();
    try {
        // Update transaksi set member_id
        $db->prepare("UPDATE transaksi SET member_id = ? WHERE id = ?")
           ->execute([$member_id, $transaksi_id]);

        $stamp_ditambahkan = 0;
        $reward_baru       = 0;

        if (!empty($validStampData)) {
            // Ambil last stamp_ke member
            $stmtLastKe = $db->prepare("
                SELECT COALESCE(MAX(stamp_ke), 0)
                FROM member_stamps WHERE member_id = ?
            ");
            $stmtLastKe->execute([$member_id]);
            $last_stamp_ke    = (int)$stmtLastKe->fetchColumn();
            $current_stamp_ke = $last_stamp_ke;

            $total_stamp_before = (int)$member['total_stamp'];
            $mixGroupInserted   = [];

            foreach ($validStampData as $sd) {
                $type      = $sd['type'];
                $mix_group = $sd['mix_group'] ?? null;
                $bibit_id  = $sd['bibit_id'];

                if ($type === 'mix') {
                    if (in_array($mix_group, $mixGroupInserted)) continue;
                    $mixGroupInserted[] = $mix_group;
                    $current_stamp_ke++;
                    $nominal = (float)($mixNominalMap[$mix_group] ?? 0);

                    $db->prepare("
                        INSERT INTO member_stamps
                            (member_id, stamp_ke, transaksi_id, cabang_id,
                             jumlah_stamp, stamp_type, mix_group, nominal)
                        VALUES (?, ?, ?, ?, 1, 'mix', ?, ?)
                    ")->execute([
                        $member_id, $current_stamp_ke, $transaksi_id,
                        $cabang_id, $mix_group, $nominal
                    ]);

                    // Update stamp_counted & stamp_group di transaksi_detail
                    // untuk semua item dalam mix group ini
                    foreach ($validStampData as $sdInner) {
                        if ($sdInner['mix_group'] === $mix_group) {
                            $db->prepare("
                                UPDATE transaksi_detail
                                SET stamp_counted = 1, stamp_group = ?
                                WHERE transaksi_id = ? AND bibit_id = ?
                            ")->execute([$mix_group, $transaksi_id, $sdInner['bibit_id']]);
                        }
                    }
                } else {
                    $current_stamp_ke++;
                    $nominal = (float)($singleNominalMap[$bibit_id] ?? 0);

                    $db->prepare("
                        INSERT INTO member_stamps
                            (member_id, stamp_ke, transaksi_id, cabang_id,
                             jumlah_stamp, stamp_type, bibit_id, nominal)
                        VALUES (?, ?, ?, ?, 1, 'single', ?, ?)
                    ")->execute([
                        $member_id, $current_stamp_ke, $transaksi_id,
                        $cabang_id, $bibit_id, $nominal
                    ]);

                    // Update stamp_counted di transaksi_detail
                    $db->prepare("
                        UPDATE transaksi_detail
                        SET stamp_counted = 1
                        WHERE transaksi_id = ? AND bibit_id = ?
                    ")->execute([$transaksi_id, $bibit_id]);
                }
                $stamp_ditambahkan++;
            }

            if ($stamp_ditambahkan > 0) {
                $db->prepare("
                    UPDATE members
                    SET total_stamp     = total_stamp + ?,
                        stamp_available = stamp_available + ?
                    WHERE id = ?
                ")->execute([$stamp_ditambahkan, $stamp_ditambahkan, $member_id]);

                $total_stamp_after = $total_stamp_before + $stamp_ditambahkan;
                $reward_baru = (int)floor($total_stamp_after / 10) -
                               (int)floor($total_stamp_before / 10);

                for ($r = 0; $r < $reward_baru; $r++) {
                    $reward_ke    = (int)floor($total_stamp_before / 10) + $r + 1;
                    $offset_stamp = ($reward_ke - 1) * 10;

                    $stmtCek = $db->prepare("
                        SELECT COUNT(*) FROM member_rewards
                        WHERE member_id = ? AND stamp_snapshot = ?
                    ");
                    $stmtCek->execute([$member_id, $reward_ke * 10]);
                    if ((int)$stmtCek->fetchColumn() > 0) continue;

                    $stmtNominal = $db->prepare("
                        SELECT SUM(nominal) FROM (
                            SELECT nominal FROM member_stamps
                            WHERE member_id = ?
                            ORDER BY stamp_ke ASC
                            LIMIT 10 OFFSET ?
                        ) AS batch
                    ");
                    $stmtNominal->execute([$member_id, $offset_stamp]);
                    $total_nominal = (float)($stmtNominal->fetchColumn() ?? 0);
                    $rata_nominal  = $total_nominal > 0 ? round($total_nominal / 10) : 0;

                    $db->prepare("
                        INSERT INTO member_rewards
                            (member_id, stamp_snapshot, total_nominal, rata_nominal,
                             reward_type, status, issued_by, cabang_issued)
                        VALUES (?, ?, ?, ?, 'bibit_bebas', 'pending', ?, ?)
                    ")->execute([
                        $member_id, $reward_ke * 10,
                        $total_nominal, $rata_nominal,
                        $user['id'], $cabang_id,
                    ]);
                }
            }
        }

        $db->commit();
        jsonResponse([
            'success'           => true,
            'message'           => "Berhasil ditautkan ke member {$member['nama']}",
            'stamp_ditambahkan' => $stamp_ditambahkan,
            'reward_baru'       => $reward_baru,
        ]);
    } catch (Exception $e) {
        $db->rollBack();
        jsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
    }
}
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


// ---- DELETE — batalkan transaksi -------------------------
if ($method === 'DELETE') {
    $body = json_decode(file_get_contents('php://input'), true);
    $id   = (int)($body['id'] ?? 0);

    if (!$id) jsonResponse(['success' => false, 'message' => 'ID transaksi tidak valid'], 400);

    $result = batalTransaksi($id, $user['id']);
    jsonResponse($result, $result['success'] ? 200 : 400);
}