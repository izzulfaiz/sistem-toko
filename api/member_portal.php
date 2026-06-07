<?php
// =====================================================
// api/member_portal.php — API untuk portal member
// Tidak perlu requireLogin() karena member bukan user sistem
// =====================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/functions.php';

session_start();

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ---- Helper response ----
function portalResponse(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ---- Cek session member ----
function getMemberSession(): ?array {
    return $_SESSION['portal_member'] ?? null;
}

// ================================================
// GET
// ================================================
if ($method === 'GET') {
    $action = $_GET['action'] ?? '';

    // ---- Cek status session ----
    if ($action === 'check_session') {
        $member = getMemberSession();
        if (!$member) {
            portalResponse(['logged_in' => false]);
        }
        // Refresh data member dari DB
        $stmt = $db->prepare("
            SELECT m.*, c.nama AS cabang_asal_nama
            FROM members m
            JOIN cabang c ON m.cabang_asal_id = c.id
            WHERE m.id = ? AND m.aktif = 1
        ");
        $stmt->execute([$member['id']]);
        $fresh = $stmt->fetch();
        if (!$fresh) {
            unset($_SESSION['portal_member']);
            portalResponse(['logged_in' => false]);
        }
        portalResponse(['logged_in' => true, 'member' => $fresh]);
    }

    // ---- Data lengkap member (harus login) ----
    if ($action === 'my_data') {
        $member = getMemberSession();
        if (!$member) portalResponse(['success' => false, 'message' => 'Belum login'], 401);

        $id = (int)$member['id'];

        // Info dasar
        $stmt = $db->prepare("
    SELECT m.*, c.nama AS cabang_asal_nama,
           COALESCE((
               SELECT SUM(ms.nominal)
               FROM member_stamps ms
               WHERE ms.member_id = m.id
           ), 0) AS total_belanja
    FROM members m
    JOIN cabang c ON m.cabang_asal_id = c.id
    WHERE m.id = ? AND m.aktif = 1
");
$stmt->execute([$id]);
$m = $stmt->fetch();
        if (!$m) portalResponse(['success' => false, 'message' => 'Member tidak ditemukan'], 404);

        // Rewards
        $stmtR = $db->prepare("
            SELECT mr.*, b.nama AS bibit_nama, u.nama AS redeemed_by_nama,
                   c.nama AS cabang_redeemed_nama
            FROM member_rewards mr
            LEFT JOIN bibit b   ON mr.bibit_id         = b.id
            LEFT JOIN users u   ON mr.redeemed_by       = u.id
            LEFT JOIN cabang c  ON mr.cabang_redeemed   = c.id
            WHERE mr.member_id = ?
            ORDER BY mr.created_at DESC
        ");
        $stmtR->execute([$id]);
        $rewards = $stmtR->fetchAll();

        // Reward ranges untuk mapping siklus
        $stmtRewardRange = $db->prepare("
            SELECT
                id AS reward_id,
                stamp_snapshot,
                (stamp_snapshot - 10 + 1) AS stamp_ke_dari,
                stamp_snapshot             AS stamp_ke_sampai
            FROM member_rewards
            WHERE member_id = ?
            ORDER BY stamp_snapshot ASC
        ");
        $stmtRewardRange->execute([$id]);
        $rewardRanges = $stmtRewardRange->fetchAll();

        // Riwayat transaksi
        $stmtT = $db->prepare("
            SELECT
                t.id,
                t.kode_nota,
                t.created_at,
                t.total,
                c.nama AS cabang_nama,
                COUNT(ms.id)     AS stamp_didapat,
                MIN(ms.stamp_ke) AS stamp_ke_min,
                MAX(ms.stamp_ke) AS stamp_ke_max
            FROM transaksi t
            JOIN cabang c ON t.cabang_id = c.id
            LEFT JOIN member_stamps ms ON ms.transaksi_id = t.id AND ms.member_id = ?
            WHERE t.member_id = ?
              AND t.kode_nota NOT LIKE 'BATAL-%'
            GROUP BY t.id, t.kode_nota, t.created_at, t.total, c.nama
            ORDER BY t.created_at DESC
            LIMIT 30
        ");
        $stmtT->execute([$id, $id]);
        $riwayatRows = $stmtT->fetchAll();

        $trxIds        = array_column($riwayatRows, 'id');
        $stampItemsMap = [];
        $detailRewardMap = [];

        if (!empty($trxIds)) {
            $placeholders = implode(',', array_fill(0, count($trxIds), '?'));

            // Query 1: stamp per transaksi
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

            // Query 2: detail item per transaksi
            $stmtDetails = $db->prepare("
                SELECT
                    td.transaksi_id,
                    td.bibit_id,
                    td.stamp_group,
                    td.stamp_counted,
                    td.jumlah_jual,
                    td.satuan_jual,
                    td.harga_satuan,
                    td.subtotal,
                    b.nama AS bibit_nama
                FROM transaksi_detail td
                JOIN bibit b ON td.bibit_id = b.id
                WHERE td.transaksi_id IN ($placeholders)
GROUP BY td.id, td.transaksi_id, td.bibit_id, td.stamp_group,
         td.stamp_counted, td.jumlah_jual, td.satuan_jual,
         td.harga_satuan, td.subtotal, b.nama
ORDER BY td.id ASC
            ");
            $stmtDetails->execute($trxIds);
            $allDetails = $stmtDetails->fetchAll();
            // Map detail per transaksi
            $detailSingleMap = [];
$detailMixMap    = [];
$detailRewardMap = []; // untuk transaksi REWARD-
foreach ($allDetails as $d) {
    $tid = $d['transaksi_id'];
    if ($d['stamp_group']) {
        $detailMixMap[$tid][$d['stamp_group']][] = $d;
    } else {
        $detailSingleMap[$tid][$d['bibit_id']] = $d;
    }
    // Semua item masuk reward map juga
    $detailRewardMap[$tid][] = $d;
}

            // Bangun stampItemsMap
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
                    $bibit_id  = $stamp['bibit_id'];
                    $singleKey = 'single_' . $stamp_ke;
                    $detail    = $detailSingleMap[$tid][$bibit_id] ?? null;

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

        // Mapping riwayat dengan items_per_reward
        $riwayat = array_map(function($row) use ($stampItemsMap, $rewardRanges, $detailRewardMap) {
            $allStampItems = $stampItemsMap[$row['id']] ?? [];
            uasort($allStampItems, fn($a, $b) => $a['stamp_ke'] - $b['stamp_ke']);

            $itemsPerReward   = [];
            $nominalPerReward = [];

            foreach ($allStampItems as $item) {
                $ske          = $item['stamp_ke'];
                $reward_group = 'progress';

                foreach ($rewardRanges as $range) {
                    if ($ske >= $range['stamp_ke_dari'] && $ske <= $range['stamp_ke_sampai']) {
                        $reward_group = 'reward_' . $range['reward_id'];
                        break;
                    }
                }

                if (!isset($itemsPerReward[$reward_group])) {
                    $itemsPerReward[$reward_group]   = [];
                    $nominalPerReward[$reward_group] = 0;
                }
                $itemsPerReward[$reward_group][]      = $item;
                $nominalPerReward[$reward_group]      += (float)$item['subtotal'];
            }

            $row['items_per_reward']   = $itemsPerReward;
$row['nominal_per_reward'] = $nominalPerReward;
$row['stamp_items']        = array_values($allStampItems);
// Tambah raw items untuk transaksi REWARD-
$row['items'] = $detailRewardMap[$row['id']] ?? [];
return $row;
        }, $riwayatRows);

// Statistik ringkas — pakai total_belanja dari query member
$totalBelanja = (float)($m['total_belanja'] ?? 0);
$totalTrx     = count(array_filter($riwayatRows, function($row) {
    return !str_starts_with($row['kode_nota'], 'REWARD-');
}));

        portalResponse([
            'success'        => true,
            'member'         => $m,
            'rewards'        => $rewards,
            'riwayat'        => $riwayat,
            'stats'          => [
                'total_belanja' => $totalBelanja,
                'total_trx'     => $totalTrx,
            ],
        ]);
    }

    portalResponse(['success' => false, 'message' => 'Action tidak dikenal'], 400);
}

// ================================================
// POST
// ================================================
if ($method === 'POST') {
    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $body['action'] ?? '';

    // ---- Login dengan no HP ----
    if ($action === 'login') {
        $no_hp = trim($body['no_hp'] ?? '');
        if (!$no_hp) portalResponse(['success' => false, 'message' => 'No HP wajib diisi'], 400);

        // Rate limiting — maksimal 5 percobaan per 5 menit
        $now        = time();
        $attempts   = $_SESSION['login_attempts']  ?? 0;
        $last_try   = $_SESSION['login_last_try']  ?? 0;

        // Reset counter jika sudah lebih dari 5 menit
        if ($now - $last_try > 300) {
            $attempts = 0;
        }

        if ($attempts >= 5) {
            $sisa = 300 - ($now - $last_try);
            portalResponse([
                'success' => false,
                'message' => 'Terlalu banyak percobaan login. Coba lagi dalam ' . ceil($sisa / 60) . ' menit.'
            ], 429);
        }

        $_SESSION['login_attempts'] = $attempts + 1;
        $_SESSION['login_last_try'] = $now;

        // Normalisasi: hapus strip/spasi, ganti 08 -> 628
        $no_hp_clean = preg_replace('/[\s\-()]/', '', $no_hp);

        $stmt = $db->prepare("
            SELECT m.*, c.nama AS cabang_asal_nama
            FROM members m
            JOIN cabang c ON m.cabang_asal_id = c.id
            WHERE (m.no_hp = ? OR m.no_hp = ?)
              AND m.aktif = 1
            LIMIT 1
        ");
        $stmt->execute([$no_hp_clean, $no_hp]);
        $member = $stmt->fetch();

        if (!$member) {
            portalResponse(['success' => false, 'message' => 'No HP tidak terdaftar sebagai member aktif'], 404);
        }

        // Reset counter login setelah berhasil
        $_SESSION['login_attempts'] = 0;
        $_SESSION['login_last_try'] = 0;

        // Regenerate session ID setelah login berhasil
// Mencegah session fixation attack
session_regenerate_id(true);

        // Simpan session
        $_SESSION['portal_member'] = [
            'id'    => $member['id'],
            'nama'  => $member['nama'],
            'no_hp' => $member['no_hp'],
        ];

        portalResponse(['success' => true, 'member' => $member]);
    }

    // ---- Logout ----
    if ($action === 'logout') {
        unset($_SESSION['portal_member']);
        portalResponse(['success' => true]);
    }

    portalResponse(['success' => false, 'message' => 'Action tidak dikenal'], 400);
}