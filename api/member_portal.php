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
            SELECT m.*, c.nama AS cabang_asal_nama
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

        // Riwayat transaksi (dengan stamp)
        $stmtT = $db->prepare("
            SELECT
                t.id,
                t.kode_nota,
                t.created_at,
                t.total,
                c.nama AS cabang_nama,
                COUNT(ms.id)    AS stamp_didapat,
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

        // Detail item per transaksi
        $trxIds = array_column($riwayatRows, 'id');
        $itemsMap = [];

        if (!empty($trxIds)) {
            $placeholders = implode(',', array_fill(0, count($trxIds), '?'));
            $stmtItems = $db->prepare("
                SELECT
                    td.transaksi_id,
                    td.bibit_id,
                    b.nama AS bibit_nama,
                    td.jumlah_jual,
                    td.satuan_jual,
                    td.harga_satuan,
                    td.subtotal,
                    td.stamp_counted,
                    td.mix_group
                FROM transaksi_detail td
                JOIN bibit b ON td.bibit_id = b.id
                WHERE td.transaksi_id IN ($placeholders)
                ORDER BY td.id ASC
            ");
            $stmtItems->execute($trxIds);
            foreach ($stmtItems->fetchAll() as $item) {
                $itemsMap[$item['transaksi_id']][] = $item;
            }
        }

        // Gabungkan
        $riwayat = array_map(function($row) use ($itemsMap) {
            $row['items'] = $itemsMap[$row['id']] ?? [];
            return $row;
        }, $riwayatRows);

        // Statistik ringkas
        $totalBelanja = array_sum(array_column($riwayatRows, 'total'));
        $totalTrx     = count($riwayatRows);

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