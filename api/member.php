<?php
// =====================================================
// api/member.php — API endpoint sistem member
// =====================================================

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/functions.php';

requireLogin();

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$user   = currentUser();
$db     = getDB();

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function generateKodeMember(): string {
    $db   = getDB();
    $year = date('Y');
    $stmt = $db->prepare("SELECT COUNT(*) FROM members WHERE YEAR(created_at) = ?");
    $stmt->execute([$year]);
    $count = (int)$stmt->fetchColumn() + 1;
    return 'MW-' . $year . '-' . str_pad($count, 4, '0', STR_PAD_LEFT);
}

function generateKodeReward(): string {
    return 'RWD-' . strtoupper(substr(uniqid(), -8)) . '-' . date('Ymd');
}

function getMemberById(int $id): ?array {
    $db   = getDB();
    $stmt = $db->prepare("
        SELECT m.*, c.nama AS cabang_terakhir_nama
        FROM members m
        LEFT JOIN cabang c ON m.cabang_terakhir_id = c.id
        WHERE m.id = ?
    ");
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
}

function getMemberByKode(string $kode): ?array {
    $db   = getDB();
    $stmt = $db->prepare("
        SELECT m.*, c.nama AS cabang_terakhir_nama
        FROM members m
        LEFT JOIN cabang c ON m.cabang_terakhir_id = c.id
        WHERE m.kode_member = ?
    ");
    $stmt->execute([$kode]);
    return $stmt->fetch() ?: null;
}

function getMemberByHP(string $hp): ?array {
    $db   = getDB();
    // Normalisasi nomor HP
    $hp = preg_replace('/\D/', '', $hp);
    if (str_starts_with($hp, '0')) $hp = '62' . substr($hp, 1);
    if (!str_starts_with($hp, '62')) $hp = '62' . $hp;

    $stmt = $db->prepare("
        SELECT m.*, c.nama AS cabang_terakhir_nama
        FROM members m
        LEFT JOIN cabang c ON m.cabang_terakhir_id = c.id
        WHERE REGEXP_REPLACE(m.no_hp, '[^0-9]', '') = ?
           OR REGEXP_REPLACE(m.no_hp, '[^0-9]', '') = ?
    ");
    $local = '0' . substr($hp, 2);
    $stmt->execute([$hp, $local]);
    return $stmt->fetch() ?: null;
}

function getRewardPending(int $member_id): ?array {
    $db   = getDB();
    $stmt = $db->prepare("
        SELECT * FROM member_rewards
        WHERE member_id = ? AND status = 'pending'
        ORDER BY created_at DESC LIMIT 1
    ");
    $stmt->execute([$member_id]);
    return $stmt->fetch() ?: null;
}

function getMemberDetail(array $member): array {
    $db = getDB();

    // Stamps terbaru
    $stmt = $db->prepare("
        SELECT ms.*, c.nama AS cabang_nama, t.kode_nota
        FROM member_stamps ms
        LEFT JOIN cabang c ON ms.cabang_id = c.id
        LEFT JOIN transaksi t ON ms.transaksi_id = t.id
        WHERE ms.member_id = ?
        ORDER BY ms.created_at DESC
        LIMIT 20
    ");
    $stmt->execute([$member['id']]);
    $stamps = $stmt->fetchAll();

    // Rewards
    $stmt2 = $db->prepare("
        SELECT mr.*, c.nama AS cabang_klaim_nama
        FROM member_rewards mr
        LEFT JOIN cabang c ON mr.cabang_klaim_id = c.id
        WHERE mr.member_id = ?
        ORDER BY mr.created_at DESC
        LIMIT 10
    ");
    $stmt2->execute([$member['id']]);
    $rewards = $stmt2->fetchAll();

    // Reward pending
    $reward_pending = getRewardPending($member['id']);

    return array_merge($member, [
        'stamps'         => $stamps,
        'rewards'        => $rewards,
        'reward_pending' => $reward_pending,
        'rata_transaksi' => $member['jumlah_transaksi'] > 0
            ? round($member['total_transaksi'] / $member['jumlah_transaksi'])
            : 0,
    ]);
}

// =====================================================
// GET — ambil data member
// =====================================================
if ($method === 'GET') {
    $action = $_GET['action'] ?? 'list';

    // Cari by kode QR
    if ($action === 'scan') {
        $kode = trim($_GET['kode'] ?? '');
        if (!$kode) jsonResponse(['success'=>false,'message'=>'Kode tidak valid'], 400);
        $member = getMemberByKode($kode);
        if (!$member) jsonResponse(['success'=>false,'message'=>'Member tidak ditemukan'], 404);
        jsonResponse(['success'=>true,'member'=>getMemberDetail($member)]);
    }

    // Cari by nomor HP
    if ($action === 'cari_hp') {
        $hp = trim($_GET['hp'] ?? '');
        if (!$hp) jsonResponse(['success'=>false,'message'=>'Nomor HP tidak valid'], 400);
        $member = getMemberByHP($hp);
        if (!$member) jsonResponse(['success'=>false,'message'=>'Member tidak ditemukan'], 404);
        jsonResponse(['success'=>true,'member'=>getMemberDetail($member)]);
    }

    // List semua member (admin only)
    if ($action === 'list') {
        if (!isAdmin()) jsonResponse(['success'=>false,'message'=>'Akses ditolak'], 403);
        $page     = max(1, (int)($_GET['page'] ?? 1));
        $per_page = min(50, max(1, (int)($_GET['per_page'] ?? 25)));
        $keyword  = trim($_GET['keyword'] ?? '');
        $offset   = ($page - 1) * $per_page;

        $where  = [];
        $params = [];
        if ($keyword) {
            $where[]  = "(m.nama LIKE ? OR m.no_hp LIKE ? OR m.kode_member LIKE ?)";
            $k        = "%$keyword%";
            $params[] = $k; $params[] = $k; $params[] = $k;
        }
        $whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        $stmtCount = $db->prepare("SELECT COUNT(*) FROM members m $whereSQL");
        $stmtCount->execute($params);
        $total = (int)$stmtCount->fetchColumn();

        $stmt = $db->prepare("
            SELECT m.*, c.nama AS cabang_terakhir_nama
            FROM members m
            LEFT JOIN cabang c ON m.cabang_terakhir_id = c.id
            $whereSQL
            ORDER BY m.total_stamp DESC, m.total_transaksi DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute(array_merge($params, [$per_page, $offset]));
        $members = $stmt->fetchAll();

        // Statistik
        $stats = $db->query("
            SELECT
                COUNT(*) AS total_member,
                SUM(total_transaksi) AS total_omzet_member,
                SUM(jumlah_transaksi) AS total_trx_member,
                COUNT(CASE WHEN total_stamp >= 10 THEN 1 END) AS member_bonus_ready
            FROM members
        ")->fetch();

        jsonResponse([
            'success' => true,
            'members' => $members,
            'stats'   => $stats,
            'pagination' => [
                'total'       => $total,
                'page'        => $page,
                'per_page'    => $per_page,
                'total_pages' => ceil($total / $per_page),
            ],
        ]);
    }

    // Detail satu member (admin)
    if ($action === 'detail') {
        if (!isAdmin()) jsonResponse(['success'=>false,'message'=>'Akses ditolak'], 403);
        $id     = (int)($_GET['id'] ?? 0);
        $member = getMemberById($id);
        if (!$member) jsonResponse(['success'=>false,'message'=>'Member tidak ditemukan'], 404);
        jsonResponse(['success'=>true,'member'=>getMemberDetail($member)]);
    }
}

// =====================================================
// POST — registrasi member baru
// =====================================================
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $nama = clean($body['nama'] ?? '');
    $hp   = clean($body['no_hp'] ?? '');

    if (!$nama || !$hp) jsonResponse(['success'=>false,'message'=>'Nama dan nomor HP wajib diisi'], 400);

    // Cek duplikat HP
    $existing = getMemberByHP($hp);
    if ($existing) jsonResponse(['success'=>false,'message'=>'Nomor HP sudah terdaftar sebagai member'], 400);

    // Normalisasi HP
    $hp_clean = preg_replace('/\D/', '', $hp);
    if (str_starts_with($hp_clean, '0')) $hp_clean = '62' . substr($hp_clean, 1);

    $kode = generateKodeMember();

    $stmt = $db->prepare("
        INSERT INTO members (kode_member, nama, no_hp, cabang_terakhir_id)
        VALUES (?, ?, ?, ?)
    ");
    $ok = $stmt->execute([
        $kode,
        $nama,
        $hp_clean,
        (int)$user['cabang_id'] ?: null
    ]);

    if (!$ok) jsonResponse(['success'=>false,'message'=>'Gagal menyimpan member'], 500);

    $member_id = (int)$db->lastInsertId();

    // Log registrasi
    $db->prepare("
        INSERT INTO member_log (member_id, user_id, cabang_id, tipe, keterangan)
        VALUES (?, ?, ?, 'registrasi', ?)
    ")->execute([
        $member_id,
        $user['id'],
        $user['cabang_id'] ?: 0,
        'Registrasi member baru'
    ]);

    $member = getMemberById($member_id);
    jsonResponse(['success'=>true,'message'=>'Member berhasil didaftarkan','member'=>$member]);
}

// =====================================================
// PATCH — proses stamp & reward
// =====================================================
if ($method === 'PATCH') {
    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $body['action'] ?? '';

    // Tambah stamp dari transaksi
    if ($action === 'tambah_stamp') {
        $member_id    = (int)($body['member_id']    ?? 0);
        $transaksi_id = (int)($body['transaksi_id'] ?? 0);
        $jumlah_stamp = (int)($body['jumlah_stamp'] ?? 0);
        $cabang_id    = (int)($body['cabang_id']    ?? $user['cabang_id'] ?? 0);

        if (!$member_id || !$jumlah_stamp || !$cabang_id) {
            jsonResponse(['success'=>false,'message'=>'Data tidak lengkap'], 400);
        }

        $member = getMemberById($member_id);
        if (!$member) jsonResponse(['success'=>false,'message'=>'Member tidak ditemukan'], 404);

        // Cek apakah sudah ada reward pending — tidak bisa tambah stamp kalau belum diklaim
        $pending = getRewardPending($member_id);
        if ($pending) {
            jsonResponse([
                'success' => false,
                'message' => 'Member masih memiliki reward yang belum diklaim. Klaim dulu sebelum transaksi.',
                'reward_pending' => $pending
            ], 400);
        }

        $db->beginTransaction();
        try {
            // Simpan stamp
            $db->prepare("
                INSERT INTO member_stamps (member_id, transaksi_id, cabang_id, jumlah_stamp, keterangan)
                VALUES (?, ?, ?, ?, ?)
            ")->execute([
                $member_id,
                $transaksi_id ?: null,
                $cabang_id,
                $jumlah_stamp,
                "Stamp dari transaksi"
            ]);

            // Update total stamp member
            $stamp_baru = $member['total_stamp'] + $jumlah_stamp;
            $reward_dibuat = false;
            $reward = null;

            // Cek apakah stamp penuh (>= 10)
            if ($stamp_baru >= 10) {
                // Hitung rata-rata transaksi
                $rata = $member['jumlah_transaksi'] > 0
                    ? round($member['total_transaksi'] / $member['jumlah_transaksi'])
                    : 0;

                // Buat reward
                $kode_reward = generateKodeReward();
                $db->prepare("
                    INSERT INTO member_rewards (member_id, kode_reward, rata_transaksi)
                    VALUES (?, ?, ?)
                ")->execute([$member_id, $kode_reward, $rata]);
                $reward_id = (int)$db->lastInsertId();

                // Reset stamp ke sisa (kalau stamp > 10, sisa stamp dilanjutkan)
                $stamp_baru = $stamp_baru - 10;
                $reward_dibuat = true;

                // Log reward dibuat
                $db->prepare("
                    INSERT INTO member_log (member_id, user_id, cabang_id, tipe, keterangan)
                    VALUES (?, ?, ?, 'reward_dibuat', ?)
                ")->execute([
                    $member_id, $user['id'], $cabang_id,
                    "Reward dibuat: $kode_reward (rata transaksi: Rp " . number_format($rata, 0, ',', '.') . ")"
                ]);

                $reward = $db->prepare("SELECT * FROM member_rewards WHERE id = ?")->execute([$reward_id]);
                $reward = $db->query("SELECT * FROM member_rewards WHERE id = $reward_id")->fetch();
            }

            // Update data member
            $db->prepare("
                UPDATE members SET
                    total_stamp = ?,
                    cabang_terakhir_id = ?,
                    updated_at = NOW()
                WHERE id = ?
            ")->execute([$stamp_baru, $cabang_id, $member_id]);

            // Log stamp
            $db->prepare("
                INSERT INTO member_log (member_id, user_id, cabang_id, tipe, keterangan)
                VALUES (?, ?, ?, 'stamp', ?)
            ")->execute([
                $member_id, $user['id'], $cabang_id,
                "+$jumlah_stamp stamp dari transaksi"
            ]);

            $db->commit();

            $member_updated = getMemberById($member_id);
            jsonResponse([
                'success'       => true,
                'message'       => $reward_dibuat
                    ? "🎉 Selamat! Member mendapat bonus parfum gratis!"
                    : "+$jumlah_stamp stamp berhasil ditambahkan",
                'stamp_baru'    => $stamp_baru,
                'reward_dibuat' => $reward_dibuat,
                'reward'        => $reward,
                'member'        => $member_updated,
            ]);

        } catch (Exception $e) {
            $db->rollBack();
            jsonResponse(['success'=>false,'message'=>'Gagal memproses stamp: '.$e->getMessage()], 500);
        }
    }

    // Klaim reward
    if ($action === 'klaim_reward') {
        $reward_id     = (int)($body['reward_id']     ?? 0);
        $aroma_pilihan = clean($body['aroma_pilihan'] ?? '');
        $cabang_id     = (int)($body['cabang_id']     ?? $user['cabang_id'] ?? 0);

        if (!$reward_id || !$aroma_pilihan) {
            jsonResponse(['success'=>false,'message'=>'Reward ID dan aroma pilihan wajib diisi'], 400);
        }

        $stmt = $db->prepare("SELECT * FROM member_rewards WHERE id = ? AND status = 'pending'");
        $stmt->execute([$reward_id]);
        $reward = $stmt->fetch();
        if (!$reward) jsonResponse(['success'=>false,'message'=>'Reward tidak ditemukan atau sudah diklaim'], 404);

        $db->prepare("
            UPDATE member_rewards SET
                status = 'diklaim',
                aroma_pilihan = ?,
                cabang_klaim_id = ?,
                diklaim_at = NOW()
            WHERE id = ?
        ")->execute([$aroma_pilihan, $cabang_id, $reward_id]);

        // Log
        $db->prepare("
            INSERT INTO member_log (member_id, user_id, cabang_id, tipe, keterangan)
            VALUES (?, ?, ?, 'reward_diklaim', ?)
        ")->execute([
            $reward['member_id'],
            $user['id'],
            $cabang_id,
            "Reward diklaim: aroma $aroma_pilihan"
        ]);

        jsonResponse(['success'=>true,'message'=>'Reward berhasil diklaim! Berikan parfum aroma '.$aroma_pilihan.' kepada customer.']);
    }

    // Update total transaksi member (dipanggil setelah simpan transaksi)
    if ($action === 'update_transaksi') {
        $member_id = (int)($body['member_id'] ?? 0);
        $total     = (float)($body['total']   ?? 0);
        $cabang_id = (int)($body['cabang_id'] ?? $user['cabang_id'] ?? 0);

        if (!$member_id || !$total) jsonResponse(['success'=>false,'message'=>'Data tidak lengkap'], 400);

        $db->prepare("
            UPDATE members SET
                total_transaksi   = total_transaksi + ?,
                jumlah_transaksi  = jumlah_transaksi + 1,
                cabang_terakhir_id = ?,
                updated_at        = NOW()
            WHERE id = ?
        ")->execute([$total, $cabang_id, $member_id]);

        jsonResponse(['success'=>true,'message'=>'Data transaksi member diperbarui']);
    }
}

// =====================================================
// DELETE — hapus member (admin only)
// =====================================================
if ($method === 'DELETE') {
    if (!isAdmin()) jsonResponse(['success'=>false,'message'=>'Akses ditolak'], 403);
    $body = json_decode(file_get_contents('php://input'), true);
    $id   = (int)($body['id'] ?? 0);
    if (!$id) jsonResponse(['success'=>false,'message'=>'ID tidak valid'], 400);

    $stmt = $db->prepare("DELETE FROM members WHERE id = ?");
    $ok   = $stmt->execute([$id]);
    jsonResponse(['success'=>$ok,'message'=>$ok?'Member dihapus':'Gagal menghapus']);
}

jsonResponse(['success'=>false,'message'=>'Method tidak diizinkan'], 405);