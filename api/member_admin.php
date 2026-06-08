<?php
// =====================================================
// api/member_admin.php — CRUD member untuk admin
// =====================================================

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/functions.php';

requireLogin();
requireAdmin();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ================================================
// GET
// ================================================
if ($method === 'GET') {
  $action = $_GET['action'] ?? '';

  // ---- Statistik global ----
  if ($action === 'stats') {
    $stmt = $db->query("SELECT COUNT(*) FROM members");
    $total_member = (int)$stmt->fetchColumn();

    $stmt = $db->query("SELECT COUNT(*) FROM members WHERE aktif = 1");
    $total_aktif = (int)$stmt->fetchColumn();

    $stmt = $db->query("SELECT COUNT(*) FROM member_rewards WHERE status = 'pending'");
    $total_reward_pending = (int)$stmt->fetchColumn();

    $stmt = $db->query("SELECT COALESCE(SUM(total_stamp),0) FROM members");
    $total_stamp_all = (int)$stmt->fetchColumn();

    jsonResponse([
      'success'              => true,
      'total_member'         => $total_member,
      'total_aktif'          => $total_aktif,
      'total_reward_pending' => $total_reward_pending,
      'total_stamp_all'      => $total_stamp_all,
    ]);
  }

  // ---- List member dengan filter & pagination ----
  if ($action === 'list') {
    $cabang_id = $_GET['cabang_id'] ?? 'all';
    $keyword   = trim($_GET['keyword'] ?? '');
    $page      = max(1, (int)($_GET['page']     ?? 1));
    $per_page  = min(100, (int)($_GET['per_page'] ?? 25));

    $where  = [];
    $params = [];

    if ($cabang_id !== 'all' && is_numeric($cabang_id)) {
      $where[]  = "m.cabang_asal_id = ?";
      $params[] = (int)$cabang_id;
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

    // Sort
    $sortKey  = $_GET['sort_key']  ?? 'created_at';
    $sortAsc  = ($_GET['sort_asc'] ?? '0') === '1';
    $allowedSort = ['nama', 'cabang_asal_nama', 'total_stamp', 'reward_pending', 'created_at'];
    if (!in_array($sortKey, $allowedSort)) $sortKey = 'created_at';
    $sortDir  = $sortAsc ? 'ASC' : 'DESC';

    // reward_pending & cabang_asal_nama are aliases — sort via subquery/join column
    $orderSQL = match($sortKey) {
      'cabang_asal_nama' => "c.nama $sortDir",
      'reward_pending'   => "reward_pending $sortDir",
      default            => "m.$sortKey $sortDir",
    };

    $offset = ($page - 1) * $per_page;
    $stmt   = $db->prepare("
      SELECT m.*,
             c.nama AS cabang_asal_nama,
             (SELECT COUNT(*) FROM member_rewards mr
              WHERE mr.member_id = m.id AND mr.status = 'pending') AS reward_pending
      FROM members m
      JOIN cabang c ON m.cabang_asal_id = c.id
      $whereSQL
      ORDER BY $orderSQL
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

  // ---- Detail member ----
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

    // Rewards
    $stmtR = $db->prepare("
      SELECT mr.*, b.nama AS bibit_nama, u.nama AS redeemed_by_nama
      FROM member_rewards mr
      LEFT JOIN bibit b ON mr.bibit_id   = b.id
      LEFT JOIN users u ON mr.redeemed_by = u.id
      WHERE mr.member_id = ?
      ORDER BY mr.created_at DESC
    ");
    $stmtR->execute([$id]);
    $rewards = $stmtR->fetchAll();

    // Riwayat transaksi
   // Riwayat transaksi
    $stmtT = $db->prepare("
        SELECT t.id, t.kode_nota, t.created_at, t.total,
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
        LIMIT 20
    ");
    $stmtT->execute([$id, $id]);
    $riwayatRows = $stmtT->fetchAll();

    $trxIds = array_column($riwayatRows, 'id');

    // Ambil reward ranges untuk mapping siklus
    $stmtRewardRange = $db->prepare("
        SELECT
            id AS reward_id,
            stamp_snapshot,
            (stamp_snapshot - 10 + 1) AS stamp_ke_dari,
            stamp_snapshot            AS stamp_ke_sampai
        FROM member_rewards
        WHERE member_id = ?
        ORDER BY stamp_snapshot ASC
    ");
    $stmtRewardRange->execute([$id]);
    $rewardRanges = $stmtRewardRange->fetchAll();

    $stampItemsMap = [];
    $detailRewardMap = [];

    if (!empty($trxIds)) {
        $placeholders = implode(',', array_fill(0, count($trxIds), '?'));

        // Query 1: ambil semua stamp per transaksi
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

        // Query 2: ambil detail item per transaksi
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
            ORDER BY td.id ASC
        ");
        $stmtDetails->execute($trxIds);
        $allDetails = $stmtDetails->fetchAll();

        // Pisahkan: detail untuk stamp dan detail untuk transaksi REWARD
        $detailRewardMap = [];
        foreach ($allDetails as $d) {
            $detailRewardMap[$d['transaksi_id']][] = $d;
        }

        // Filter hanya stamp_counted untuk map stamp
        $allDetails = array_filter($allDetails, fn($d) => $d['stamp_counted'] == 1);

        // Map detail per transaksi
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

        // Bangun stampItemsMap (sama dengan member.php)
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

    // Mapping riwayat dengan items_per_reward (sama dengan member.php)
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
        $row['items']              = $detailRewardMap[$row['id']] ?? [];
        return $row;
    }, $riwayatRows);

    jsonResponse([
        'success' => true,
        'member'  => $member,
        'rewards' => $rewards,
        'riwayat' => $riwayat,
    ]);
  }

  jsonResponse(['success' => false, 'message' => 'Action tidak dikenal'], 400);
}

// ================================================
// POST — Tambah member baru
// ================================================
if ($method === 'POST') {
  $body      = json_decode(file_get_contents('php://input'), true) ?? [];
  $nama      = clean($body['nama']      ?? '');
  $no_hp     = clean($body['no_hp']     ?? '');
  $catatan   = clean($body['catatan']   ?? '');
  $cabang_id = (int)($body['cabang_id'] ?? 0);

  if (!$nama)      jsonResponse(['success' => false, 'message' => 'Nama wajib diisi'], 400);
  if (!$no_hp)     jsonResponse(['success' => false, 'message' => 'No HP wajib diisi'], 400);
  if (!$cabang_id) jsonResponse(['success' => false, 'message' => 'Cabang wajib dipilih'], 400);

  // Cek duplikat
  $cek = $db->prepare("SELECT id FROM members WHERE no_hp = ?");
  $cek->execute([$no_hp]);
  if ($cek->fetch()) {
    jsonResponse(['success' => false, 'message' => 'No HP sudah terdaftar sebagai member'], 409);
  }

  $qr_code = 'MWI-' . strtoupper(substr(md5($no_hp . time()), 0, 10));
  $stmt    = $db->prepare("
    INSERT INTO members (nama, no_hp, cabang_asal_id, qr_code, catatan)
    VALUES (?, ?, ?, ?, ?)
  ");
  $stmt->execute([$nama, $no_hp, $cabang_id, $qr_code, $catatan]);

  jsonResponse(['success' => true, 'message' => "Member $nama berhasil didaftarkan"]);
}

// ================================================
// PUT — Edit member
// ================================================
if ($method === 'PUT') {
  $body  = json_decode(file_get_contents('php://input'), true) ?? [];
  $id    = (int)($body['id']    ?? 0);
  $nama  = clean($body['nama']  ?? '');
  $no_hp = clean($body['no_hp'] ?? '');

  if (!$id)    jsonResponse(['success' => false, 'message' => 'ID tidak valid'], 400);
  if (!$nama)  jsonResponse(['success' => false, 'message' => 'Nama wajib diisi'], 400);
  if (!$no_hp) jsonResponse(['success' => false, 'message' => 'No HP wajib diisi'], 400);

  // Cek duplikat no HP (exclude diri sendiri)
  $cek = $db->prepare("SELECT id FROM members WHERE no_hp = ? AND id != ?");
  $cek->execute([$no_hp, $id]);
  if ($cek->fetch()) {
    jsonResponse(['success' => false, 'message' => 'No HP sudah digunakan member lain'], 409);
  }

  $stmt = $db->prepare("UPDATE members SET nama = ?, no_hp = ? WHERE id = ?");
  $stmt->execute([$nama, $no_hp, $id]);

  jsonResponse(['success' => true, 'message' => 'Member berhasil diperbarui']);
}

// ================================================
// DELETE — Hapus member
// ================================================
if ($method === 'DELETE') {
  $body = json_decode(file_get_contents('php://input'), true) ?? [];
  $id   = (int)($body['id'] ?? 0);
  if (!$id) jsonResponse(['success' => false, 'message' => 'ID tidak valid'], 400);

  $db->beginTransaction();
  try {
    // Hapus data terkait dulu
    $db->prepare("DELETE FROM member_stamps  WHERE member_id = ?")->execute([$id]);
    $db->prepare("DELETE FROM member_rewards WHERE member_id = ?")->execute([$id]);
    $db->prepare("UPDATE transaksi SET member_id = NULL WHERE member_id = ?")->execute([$id]);
    $db->prepare("DELETE FROM members WHERE id = ?")->execute([$id]);
    $db->commit();
    jsonResponse(['success' => true, 'message' => 'Member berhasil dihapus']);
  } catch (Exception $e) {
    $db->rollBack();
    jsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
  }
}