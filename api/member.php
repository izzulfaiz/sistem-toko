<?php
ob_start();
ini_set('display_errors', 1);
ini_set('log_errors', 1);
error_reporting(E_ALL);

register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => $error['message'],
            'file'    => $error['file'],
            'line'    => $error['line'],
        ]);
    }
});
// =====================================================
// api/member.php
// =====================================================

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/functions.php';

requireLogin();

$method = $_SERVER['REQUEST_METHOD'];
$user   = currentUser();
$db     = getDB();

if ($method === 'GET') {
    $action = $_GET['action'] ?? '';

    // ---- Summary statistik member cabang ----
    if ($action === 'summary') {
        $cabang_id = (int)($_GET['cabang_id'] ?? $user['cabang_id']);

        $total = (int)$db->prepare("SELECT COUNT(*) FROM members WHERE cabang_asal_id = ?")->execute([$cabang_id]) ? 0 : 0;
        $stmt = $db->prepare("SELECT COUNT(*) FROM members WHERE cabang_asal_id = ?");
        $stmt->execute([$cabang_id]);
        $total_member = (int)$stmt->fetchColumn();

        $stmt2 = $db->prepare("SELECT COUNT(*) FROM members WHERE cabang_asal_id = ? AND aktif = 1");
        $stmt2->execute([$cabang_id]);
        $total_aktif = (int)$stmt2->fetchColumn();

        $stmt3 = $db->prepare("
            SELECT COUNT(*) FROM member_rewards mr
            JOIN members m ON mr.member_id = m.id
            WHERE m.cabang_asal_id = ? AND mr.status = 'pending'
        ");
        $stmt3->execute([$cabang_id]);
        $total_reward_pending = (int)$stmt3->fetchColumn();

        jsonResponse([
            'success'              => true,
            'total_member'         => $total_member,
            'total_aktif'          => $total_aktif,
            'total_reward_pending' => $total_reward_pending,
        ]);
    }

    // ---- List member cabang dengan pagination ----
    if ($action === 'list') {
    $cabang_id  = (int)($_GET['cabang_id'] ?? $user['cabang_id']);
    $filter     = $_GET['filter'] ?? 'semua'; // 'semua' atau 'cabang'
    $page       = max(1, (int)($_GET['page'] ?? 1));
    $per_page   = 20;
    $keyword    = trim($_GET['keyword'] ?? '');

    $where  = [];
    $params = [];

    // Filter cabang asal
    if ($filter === 'cabang') {
        $where[]  = "m.cabang_asal_id = ?";
        $params[] = $cabang_id;
    }

    if ($keyword) {
        $where[]  = "(m.nama LIKE ? OR m.no_hp LIKE ?)";
        $params[] = "%$keyword%";
        $params[] = "%$keyword%";
    }

    $whereSQL = $where ? "WHERE " . implode(" AND ", $where) : "";

    $stmtCount = $db->prepare("SELECT COUNT(*) FROM members m $whereSQL");
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetchColumn();

    $offset = ($page - 1) * $per_page;
    $stmt   = $db->prepare("
        SELECT m.*,
               c.nama AS cabang_asal_nama,
               (SELECT COUNT(*) FROM member_rewards mr
                WHERE mr.member_id = m.id AND mr.status = 'pending') AS reward_pending
        FROM members m
        JOIN cabang c ON m.cabang_asal_id = c.id
        $whereSQL
        ORDER BY reward_pending DESC, m.updated_at DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute(array_merge($params, [$per_page, $offset]));
    $members = $stmt->fetchAll();

    jsonResponse([
        'success'    => true,
        'members'    => $members,
        'pagination' => buildPagination($total, $page, $per_page),
    ]);
}

   // ---- Detail member by ID ----
if ($action === 'detail') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) jsonResponse(['success' => false, 'message' => 'ID tidak valid'], 400);

    $stmt = $db->prepare("
        SELECT m.*, c.nama AS cabang_asal_nama
        FROM members m
        JOIN cabang c ON m.cabang_asal_id = c.id
        WHERE m.id = ?
    ");
    $stmt->execute([$id]);
    $member = $stmt->fetch();
    if (!$member) jsonResponse(['success' => false, 'message' => 'Member tidak ditemukan'], 404);

    // Reward list
    $stmtR = $db->prepare("
        SELECT mr.*, b.nama AS bibit_nama
        FROM member_rewards mr
        LEFT JOIN bibit b ON mr.bibit_id = b.id
        WHERE mr.member_id = ?
        ORDER BY mr.created_at DESC
        LIMIT 10
    ");
    $stmtR->execute([$id]);
    $rewards = $stmtR->fetchAll();

    // Ambil reward ranges dulu
$stmtRewardRange = $db->prepare("
    SELECT
        id AS reward_id,
        stamp_snapshot,
        (stamp_snapshot - 10 + 1) AS stamp_ke_dari,
        stamp_snapshot AS stamp_ke_sampai
    FROM member_rewards
    WHERE member_id = ?
    ORDER BY stamp_snapshot ASC
");
$stmtRewardRange->execute([$id]);
$rewardRanges = $stmtRewardRange->fetchAll();

// Riwayat transaksi — nominal dihitung dari SUM stamp_ke yang masuk range reward ATAU progress
// Tidak bisa langsung di SQL karena perlu tahu context per transaksi
// Jadi ambil semua stamp per transaksi dulu
$stmtT = $db->prepare("
    SELECT
        t.id,
        t.kode_nota,
        t.created_at,
        c.nama AS cabang_nama,
        COUNT(ms.id) AS stamp_didapat,
        MIN(ms.stamp_ke) AS stamp_ke_min,
        MAX(ms.stamp_ke) AS stamp_ke_max
    FROM transaksi t
    JOIN cabang c ON t.cabang_id = c.id
    JOIN member_stamps ms ON ms.transaksi_id = t.id AND ms.member_id = ?
    WHERE t.member_id = ? AND t.kode_nota NOT LIKE 'BATAL-%'
    GROUP BY t.id, t.kode_nota, t.created_at, c.nama
    ORDER BY t.created_at DESC
    LIMIT 20
");
$stmtT->execute([$id, $id]);
$riwayatRows = $stmtT->fetchAll();

// Query detail item per transaksi dengan stamp_ke
$trxIds = array_column($riwayatRows, 'id');
$stampItemsMap = [];

if (!empty($trxIds)) {
    $placeholders = implode(',', array_fill(0, count($trxIds), '?'));

    // Query 1: ambil semua stamp (single & mix) per transaksi
    $stmtStamps = $db->prepare("
        SELECT
            ms.id AS stamp_id,
            ms.transaksi_id,
            ms.stamp_ke,
            ms.stamp_type,
            ms.mix_group,
            ms.bibit_id,
            ms.nominal
        FROM member_stamps ms
        WHERE ms.member_id = ? AND ms.transaksi_id IN ($placeholders)
        ORDER BY ms.stamp_ke ASC
    ");
    $stmtStamps->execute(array_merge([$id], $trxIds));
    $allStamps = $stmtStamps->fetchAll();

    // Query 2: ambil detail item per transaksi (semua item yang stamp_counted)
    $stmtDetails = $db->prepare("
        SELECT
            td.transaksi_id,
            td.bibit_id,
            td.stamp_group,
            td.stamp_counted,
            td.jumlah_jual,
            td.satuan_jual,
            td.subtotal,
            b.nama AS bibit_nama
        FROM transaksi_detail td
        JOIN bibit b ON td.bibit_id = b.id
        WHERE td.transaksi_id IN ($placeholders)
        AND td.stamp_counted = 1
        ORDER BY td.id ASC
    ");
    $stmtDetails->execute($trxIds);
    $allDetails = $stmtDetails->fetchAll();

    // Buat map detail per transaksi
    // single: [transaksi_id][bibit_id] => detail
    // mix:    [transaksi_id][mix_group] => [detail, ...]
    $detailSingleMap = [];
    $detailMixMap    = [];
    foreach ($allDetails as $d) {
        $tid = $d['transaksi_id'];
        if ($d['stamp_group']) {
            $detailMixMap[$tid][$d['stamp_group']][] = $d;
        } else {
            $detailSingleMap[$tid][$d['bibit_id']] = $d;
        }
    }

    // Bangun stampItemsMap dari stamp — join ke detail secara manual
    // Sehingga tidak ada cross-join antar mix group
    foreach ($allStamps as $stamp) {
        $tid      = $stamp['transaksi_id'];
        $stamp_ke = $stamp['stamp_ke'];
        $type     = $stamp['stamp_type'];

        if (!isset($stampItemsMap[$tid])) $stampItemsMap[$tid] = [];

        if ($type === 'mix') {
            $mg     = $stamp['mix_group'];
            $mixKey = 'mix_' . $mg;

            if (!isset($stampItemsMap[$tid][$mixKey])) {
                $mixDetails = $detailMixMap[$tid][$mg] ?? [];
                $mixItems   = [];
                foreach ($mixDetails as $md) {
                    $mixItems[] = $md['bibit_nama'] . ' ' .
                                  (float)$md['jumlah_jual'] . ' ' .
                                  $md['satuan_jual'];
                }
                $stampItemsMap[$tid][$mixKey] = [
                    'stamp_ke' => $stamp_ke,
                    'is_mix'   => true,
                    'items'    => $mixItems,
                    'subtotal' => (float)$stamp['nominal'],
                ];
            }
        } else {
            $bibit_id   = $stamp['bibit_id'];
            $singleKey  = 'single_' . $stamp_ke;
            $detail     = $detailSingleMap[$tid][$bibit_id] ?? null;

            $stampItemsMap[$tid][$singleKey] = [
                'stamp_ke'   => $stamp_ke,
                'is_mix'     => false,
                'bibit_nama' => $detail['bibit_nama'] ?? '-',
                'jumlah'     => $detail ? (float)$detail['jumlah_jual'] : 0,
                'satuan'     => $detail['satuan_jual'] ?? '',
                'subtotal'   => (float)$stamp['nominal'],
            ];
        }
    }
}

// Merge dengan filter stamp_ke per reward
// Ambil stamp_available sekarang untuk tahu progress
$stamp_available_now = (int)$member['stamp_available'];
$total_stamp_now     = (int)$member['total_stamp'];

// Reward terakhir stamp_ke sampai berapa
$last_reward_stamp_ke = !empty($rewardRanges)
    ? (int)end($rewardRanges)['stamp_ke_sampai']
    : 0;

$riwayat = array_map(function($row) use ($stampItemsMap, $rewardRanges) {
    $allStampItems = $stampItemsMap[$row['id']] ?? [];
    uasort($allStampItems, fn($a, $b) => $a['stamp_ke'] - $b['stamp_ke']);

    $itemsPerReward = [];
    $nominalPerReward = []; // ← tambah ini

    foreach ($allStampItems as $item) {
        $ske = $item['stamp_ke'];
        $reward_group = 'progress';

        foreach ($rewardRanges as $range) {
            if ($ske >= $range['stamp_ke_dari'] && $ske <= $range['stamp_ke_sampai']) {
                $reward_group = 'reward_' . $range['reward_id'];
                break;
            }
        }

        if (!isset($itemsPerReward[$reward_group])) {
            $itemsPerReward[$reward_group] = [];
            $nominalPerReward[$reward_group] = 0; // ← init nominal per group
        }
        $itemsPerReward[$reward_group][] = $item;
        $nominalPerReward[$reward_group] += (float)$item['subtotal']; // ← akumulasi
    }

    // Hitung total_stamp_nominal: hanya dari reward group (bukan progress)
    // Ambil nominal reward group yang ada di transaksi ini
    $total_stamp_nominal = 0;
    foreach ($nominalPerReward as $groupKey => $nominal) {
        if ($groupKey !== 'progress') {
            $total_stamp_nominal += $nominal;
        }
    }
    // Kalau semua masuk progress (belum ada reward), tampilkan semua
    if ($total_stamp_nominal === 0) {
        $total_stamp_nominal = array_sum($nominalPerReward);
    }

    $row['total_stamp_nominal'] = $total_stamp_nominal;
    $row['items_per_reward']    = $itemsPerReward;
    $row['nominal_per_reward']  = $nominalPerReward;
    $row['stamp_items']         = array_values($allStampItems);
    return $row;
}, $riwayatRows);

    jsonResponse([
        'success' => true,
        'member'  => $member,
        'rewards' => $rewards,
        'riwayat' => $riwayat,
    ]);
}

    // ---- Search member (untuk nota transaksi) ----
    if ($action === 'search') {
        $q = trim($_GET['q'] ?? '');
        if (strlen($q) < 2) jsonResponse(['success' => true, 'members' => []]);

        $stmt = $db->prepare("
            SELECT m.id, m.nama, m.no_hp, m.total_stamp, m.stamp_available,
                   c.nama AS cabang_asal_nama
            FROM members m
            JOIN cabang c ON m.cabang_asal_id = c.id
            WHERE m.aktif = 1 AND (m.nama LIKE ? OR m.no_hp LIKE ?)
            ORDER BY m.nama
            LIMIT 10
        ");
        $stmt->execute(["%$q%", "%$q%"]);
        jsonResponse(['success' => true, 'members' => $stmt->fetchAll()]);
    }

    // ---- Search member by QR code ----
    if ($action === 'search_qr') {
        $qr = trim($_GET['qr'] ?? '');
        if (!$qr) jsonResponse(['success' => false, 'message' => 'QR kosong'], 400);

        $stmt = $db->prepare("SELECT id, nama, no_hp FROM members WHERE qr_code = ? AND aktif = 1");
        $stmt->execute([$qr]);
        $member = $stmt->fetch();

        jsonResponse(['success' => true, 'member' => $member ?: null]);
    }
}

// ---- POST ----
if ($method === 'POST') {
    $body   = json_decode(file_get_contents('php://input'), true);
    $action = $body['action'] ?? '';

    // ---- Daftar member baru ----
    if ($action === 'daftar') {
        $nama      = clean($body['nama']      ?? '');
        $no_hp     = clean($body['no_hp']     ?? '');
        $catatan   = clean($body['catatan']   ?? '');
        $cabang_id = (int)($body['cabang_id'] ?? $user['cabang_id']);

        if (!$nama)  jsonResponse(['success' => false, 'message' => 'Nama wajib diisi'], 400);
        if (!$no_hp) jsonResponse(['success' => false, 'message' => 'No HP wajib diisi'], 400);

        // Cek duplikat no HP
        $cek = $db->prepare("SELECT id FROM members WHERE no_hp = ?");
        $cek->execute([$no_hp]);
        if ($cek->fetch()) {
            jsonResponse(['success' => false, 'message' => 'No HP sudah terdaftar sebagai member'], 409);
        }

        // Generate QR code unik
        $qr_code = 'MWI-' . strtoupper(substr(md5($no_hp . time()), 0, 10));

        $stmt = $db->prepare("
            INSERT INTO members (nama, no_hp, cabang_asal_id, qr_code, catatan)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$nama, $no_hp, $cabang_id, $qr_code, $catatan]);
        $member_id = (int)$db->lastInsertId();

        jsonResponse([
            'success'   => true,
            'member_id' => $member_id,
            'qr_code'   => $qr_code,
            'message'   => "Member $nama berhasil didaftarkan",
        ]);
    }

    // ---- Redeem reward ----
    if ($action === 'redeem') {
        $reward_id = (int)($body['reward_id'] ?? 0);
        $bibit_id  = (int)($body['bibit_id']  ?? 0);
        $cabang_id = (int)($body['cabang_id'] ?? $user['cabang_id']);

        if (!$reward_id) jsonResponse(['success' => false, 'message' => 'Reward ID tidak valid'], 400);
        if (!$bibit_id)  jsonResponse(['success' => false, 'message' => 'Pilih bibit terlebih dahulu'], 400);

        // Ambil reward & validasi
        $stmt = $db->prepare("SELECT * FROM member_rewards WHERE id = ? AND status = 'pending'");
        $stmt->execute([$reward_id]);
        $reward = $stmt->fetch();
        if (!$reward) jsonResponse(['success' => false, 'message' => 'Reward tidak ditemukan atau sudah ditukar'], 404);

        $db->beginTransaction();
        try {
            // Update reward
            $stmt2 = $db->prepare("
                UPDATE member_rewards
                SET status = 'redeemed',
                    bibit_id = ?,
                    redeemed_by = ?,
                    cabang_redeemed = ?,
                    redeemed_at = NOW()
                WHERE id = ?
            ");
            $stmt2->execute([$bibit_id, $user['id'], $cabang_id, $reward_id]);

            // Kurangi stamp_available member sebesar 10
            $stmt3 = $db->prepare("
                UPDATE members
                SET stamp_available = GREATEST(stamp_available - 10, 0)
                WHERE id = ?
            ");
            $stmt3->execute([$reward['member_id']]);

            $db->commit();
            jsonResponse(['success' => true, 'message' => 'Reward berhasil ditukar']);
        } catch (Exception $e) {
            $db->rollBack();
            jsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
}