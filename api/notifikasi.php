<?php
// =====================================================
// api/notifikasi.php — API notifikasi stok kritis
// =====================================================

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/functions.php';

requireAdmin();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ---- GET — ambil notifikasi & generate baru jika perlu ----
if ($method === 'GET') {

    // Cek stok saat ini dan generate notifikasi baru
    $stoks = getAllStok();
    foreach ($stoks as $s) {
        $v      = (float)$s['jumlah'];
        $sat    = $s['satuan_dasar'] ?: ($s['satuan'] ?: 'ml');
        $isMl   = in_array($sat, ['ml','liter','gram','kg']);
        $batas_kritis = $isMl ? 40 : 2;
        $batas_rendah = $isMl ? 70 : 5;

        if ($v <= $batas_kritis) $tipe = 'kritis';
        elseif ($v <= $batas_rendah) $tipe = 'rendah';
        else continue;

        // Cek apakah notifikasi serupa sudah ada dalam 1 jam terakhir
        $cek = $db->prepare("
            SELECT id FROM notifikasi
            WHERE cabang_id = ? AND bibit_id = ? AND tipe = ?
            AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
            AND is_read = 0
        ");
        $cek->execute([$s['cabang_id'], $s['bibit_id'], $tipe]);
        if ($cek->fetch()) continue; // sudah ada, skip

        // Insert notifikasi baru
        $ins = $db->prepare("
            INSERT INTO notifikasi (cabang_id, bibit_id, tipe, jumlah, satuan)
            VALUES (?, ?, ?, ?, ?)
        ");
        $ins->execute([$s['cabang_id'], $s['bibit_id'], $tipe, $v, $sat]);
    }

    // Ambil semua notifikasi belum dibaca
    $stmt = $db->query("
        SELECT n.*, c.nama AS cabang_nama, b.nama AS bibit_nama
        FROM notifikasi n
        JOIN cabang c ON n.cabang_id = c.id
        JOIN bibit  b ON n.bibit_id  = b.id
        WHERE n.is_read = 0
        ORDER BY n.tipe ASC, n.created_at DESC
        LIMIT 50
    ");
    $notifs = $stmt->fetchAll();

    $total_kritis = count(array_filter($notifs, fn($n) => $n['tipe'] === 'kritis'));
    $total_rendah = count(array_filter($notifs, fn($n) => $n['tipe'] === 'rendah'));

    jsonResponse([
        'success'       => true,
        'notifikasi'    => $notifs,
        'total_unread'  => count($notifs),
        'total_kritis'  => $total_kritis,
        'total_rendah'  => $total_rendah,
    ]);
}

// ---- POST — tandai notifikasi sebagai sudah dibaca --------
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $id   = $body['id'] ?? 'all';

    if ($id === 'all') {
        $db->exec("UPDATE notifikasi SET is_read = 1 WHERE is_read = 0");
    } else {
        $stmt = $db->prepare("UPDATE notifikasi SET is_read = 1 WHERE id = ?");
        $stmt->execute([(int)$id]);
    }

    jsonResponse(['success' => true]);
}

// ---- DELETE — hapus semua notifikasi yang sudah dibaca ----
if ($method === 'DELETE') {
    $db->exec("DELETE FROM notifikasi WHERE is_read = 1");
    jsonResponse(['success' => true]);
}