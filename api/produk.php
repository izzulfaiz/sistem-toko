<?php
// =====================================================
// api/produk.php — API publik untuk Landing Page
// Tidak butuh login — hanya baca data produk
// =====================================================

require_once __DIR__ . '/../config/database.php';

// Izinkan akses dari domain landing page
// GANTI dengan domain Anda jika berbeda hosting
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300'); // cache 5 menit

$db     = getDB();
$action = $_GET['action'] ?? 'produk';

// =====================================================
// ACTION: produk — ambil produk berdasarkan kategori
// Params:
//   kategori : parfum_baju | parfum_religi | parfum_spiritual | parfum_laundry
//   limit    : jumlah produk (default 8, max 100)
//   page     : halaman (default 1)
//   semua    : 1 = tampilkan semua, 0 = hanya yang tampil_landing=1
// =====================================================
if ($action === 'produk') {
    $kategori = $_GET['kategori'] ?? '';
    $limit    = min(500, max(1, (int)($_GET['limit'] ?? 8)));
    $page     = max(1, (int)($_GET['page'] ?? 1));
    $semua    = ($_GET['semua'] ?? '0') === '1';
    $offset   = ($page - 1) * $limit;

    $valid_kategori = ['parfum_baju','parfum_religi','parfum_spiritual','parfum_laundry'];

    // Bangun WHERE clause
    $where  = ["b.kategori != 'aksesoris'"];
    $params = [];

    if ($kategori && in_array($kategori, $valid_kategori)) {
        $where[]  = "b.kategori = ?";
        $params[] = $kategori;
    } else {
        // Kalau tidak ada filter, ambil semua kategori parfum
        $where[] = "b.kategori IN ('parfum_baju','parfum_religi','parfum_spiritual','parfum_laundry')";
    }

    if (!$semua) {
        $where[] = "b.tampil_landing = 1";
    }

    $whereStr = implode(' AND ', $where);

    // Hitung total untuk pagination
    $stmtCount = $db->prepare("SELECT COUNT(*) FROM bibit b WHERE $whereStr");
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetchColumn();

    // Ambil data produk beserta total stok semua cabang
    $sql = "
        SELECT
            b.id,
            b.nama,
            b.kategori,
            b.deskripsi,
            b.foto,
            b.satuan,
            b.tampil_landing,
            COALESCE(SUM(s.jumlah), 0) AS total_stok
        FROM bibit b
        LEFT JOIN stok s ON s.bibit_id = b.id
        WHERE $whereStr
        GROUP BY b.id
        ORDER BY b.tampil_landing DESC, b.nama ASC
        LIMIT ? OFFSET ?
    ";

    $params[] = $limit;
    $params[] = $offset;

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $produk = $stmt->fetchAll();

    // Format response
    foreach ($produk as &$p) {
        $p['total_stok']     = (float)$p['total_stok'];
        $p['tampil_landing'] = (bool)$p['tampil_landing'];
        $p['tersedia']       = $p['total_stok'] > 0;
        // URL foto kalau ada
        $p['foto_url'] = $p['foto']
            ? 'images/produk/' . $p['foto']
            : null;
    }

    echo json_encode([
        'success'    => true,
        'data'       => $produk,
        'pagination' => [
            'page'        => $page,
            'limit'       => $limit,
            'total'       => $total,
            'total_page'  => ceil($total / $limit),
            'has_next'    => ($page * $limit) < $total,
            'has_prev'    => $page > 1,
        ],
        'kategori'   => $kategori ?: 'semua',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// =====================================================
// ACTION: kategori — ambil ringkasan per kategori
// Berguna untuk landing page (tampilkan jumlah produk)
// =====================================================
if ($action === 'kategori') {
    $stmt = $db->query("
        SELECT
            kategori,
            COUNT(*) AS jumlah_produk,
            SUM(tampil_landing) AS jumlah_unggulan
        FROM bibit
        WHERE kategori != 'aksesoris'
        GROUP BY kategori
        ORDER BY kategori
    ");
    $data = $stmt->fetchAll();

    $label = [
        'parfum_baju'      => 'Parfum Baju',
        'parfum_religi'    => 'Parfum Religi',
        'parfum_spiritual' => 'Parfum Spiritual',
        'parfum_laundry'   => 'Parfum Laundry',
    ];

    foreach ($data as &$d) {
        $d['label']          = $label[$d['kategori']] ?? $d['kategori'];
        $d['jumlah_produk']  = (int)$d['jumlah_produk'];
        $d['jumlah_unggulan']= (int)$d['jumlah_unggulan'];
    }

    echo json_encode([
        'success' => true,
        'data'    => $data,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// =====================================================
// ACTION: cabang — ambil semua data cabang
// =====================================================
if ($action === 'cabang') {
    $stmt = $db->query("SELECT id, nama, alamat FROM cabang ORDER BY nama");
    echo json_encode([
        'success' => true,
        'data'    => $stmt->fetchAll(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Default: aksi tidak dikenal
echo json_encode(['success' => false, 'message' => 'Aksi tidak dikenal']);
