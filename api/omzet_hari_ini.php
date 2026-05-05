<?php
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

header('Content-Type: application/json');

try {
    $db = getDB();
    
    $tanggal = isset($_GET['tanggal']) ? $_GET['tanggal'] : date('Y-m-d');
    
    // Validasi format tanggal
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $tanggal)) {
        $tanggal = date('Y-m-d');
    }

    // Ambil semua cabang dulu agar cabang omzet 0 tetap muncul
    $stmtCabang = $db->query("SELECT id, nama FROM cabang ORDER BY nama");
    $cabangs = $stmtCabang->fetchAll(PDO::FETCH_ASSOC);

    // Hitung omzet per cabang langsung di SQL
    $stmt = $db->prepare("
        SELECT 
            c.id as cabang_id,
            c.nama as cabang_nama,
            COALESCE(SUM(t.total), 0) as omzet
        FROM cabang c
        LEFT JOIN transaksi t 
            ON t.cabang_id = c.id 
            AND DATE(t.created_at) = ?
            AND t.kode_nota NOT LIKE 'BATAL-%'
        GROUP BY c.id, c.nama
        ORDER BY c.nama
    ");
    $stmt->execute([$tanggal]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $omzet = [];
    foreach ($rows as $row) {
        $omzet[$row['cabang_nama']] = (float)$row['omzet'];
    }

    $totalOmzet = array_sum($omzet);

    echo json_encode([
        'success' => true,
        'omzet_per_cabang' => $omzet,
        'total' => $totalOmzet,
        'tanggal' => $tanggal,
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}