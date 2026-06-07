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

// Validasi cabang_id kalau ada
$cabang_id = isset($_GET['cabang_id']) ? (int)$_GET['cabang_id'] : null;

// Bangun WHERE clause dan params
$where_cab = "";
$params    = [$tanggal];
if ($cabang_id) {
    $where_cab = "AND t.cabang_id = ?";
    $params[]  = $cabang_id;
}

$stmt = $db->prepare("
    SELECT 
        c.id   AS cabang_id,
        c.nama AS cabang_nama,
        COALESCE(SUM(t.total), 0) AS omzet
    FROM cabang c
    LEFT JOIN transaksi t 
        ON t.cabang_id = c.id 
        AND DATE(t.created_at) = ?
        AND t.kode_nota NOT LIKE 'BATAL-%'
        $where_cab
    GROUP BY c.id, c.nama
    ORDER BY c.nama
");
$stmt->execute($params);
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