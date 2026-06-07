<?php
// =====================================================
// api/rekap.php — API rekap bulanan
// =====================================================

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/functions.php';

requireLogin();

$method    = $_SERVER['REQUEST_METHOD'];
$user      = currentUser();
$db        = getDB();

if ($method === 'GET') {
    $bulan = (int)($_GET['bulan'] ?? date('n'));
$tahun = (int)($_GET['tahun'] ?? date('Y'));

// Support filter rentang tanggal
$tgl_dari   = $_GET['tgl_dari']  ?? null;
$tgl_sampai = $_GET['tgl_sampai'] ?? null;

    // Support multi cabang (cabang_ids) atau single cabang (cabang_id)
    if (!isAdmin()) {
        $cabang_id  = (int)$user['cabang_id'];
        $cabang_ids = [$cabang_id];
    } elseif (isset($_GET['cabang_ids']) && $_GET['cabang_ids'] !== '') {
        $cabang_ids = array_filter(array_map('intval', explode(',', $_GET['cabang_ids'])));
        $cabang_id  = count($cabang_ids) === 1 ? $cabang_ids[0] : null;
    } else {
        $cabang_id  = null;
        $cabang_ids = [];
    }

    // Bangun IN clause aman dengan prepared statement
if (count($cabang_ids) > 0) {
    $ph          = implode(',', array_fill(0, count($cabang_ids), '?'));
    $where_trx   = "AND t.cabang_id IN ($ph)";
    $where_cab_c = "AND c.id IN ($ph)";
    $where_kel_p = "AND cabang_id IN ($ph)";
    $where_kel2  = "AND p.cabang_id IN ($ph)";
} else {
    $ph          = '';
    $where_trx   = "";
    $where_cab_c = "";
    $where_kel_p = "";
    $where_kel2  = "";
}
$cab_params = $cabang_ids; // array nilai cabang, dipakai di execute()

    // Jika ada filter rentang, pakai itu. Kalau tidak, pakai seluruh bulan
if ($tgl_dari && $tgl_sampai) {
    $tgl_awal  = $tgl_dari;
    $tgl_akhir = $tgl_sampai;
} else {
    $tgl_awal  = sprintf('%04d-%02d-01', $tahun, $bulan);
    $tgl_akhir = date('Y-m-t', strtotime($tgl_awal));
}

    // ---- 1. OMZET HARIAN ----
    $stmt = $db->prepare("
        SELECT DATE(t.created_at) AS tanggal,
               COUNT(t.id)        AS jumlah_transaksi,
               SUM(t.total)       AS omzet
        FROM transaksi t
        WHERE DATE(t.created_at) BETWEEN ? AND ?
          AND t.kode_nota NOT LIKE 'BATAL-%'
          $where_trx
        GROUP BY DATE(t.created_at)
        ORDER BY tanggal ASC
    ");
    $stmt->execute(array_merge([$tgl_awal, $tgl_akhir], $cab_params));
    $omzet_harian = $stmt->fetchAll();

    // Bangun map omzet dari hasil query
$omzet_map = [];
foreach ($omzet_harian as $row) {
    $omzet_map[$row['tanggal']] = $row;
}

// Pengeluaran harian
$stmt_kel_harian = $db->prepare("
    SELECT DATE(created_at) AS tanggal, SUM(nominal) AS total_keluar
    FROM pengeluaran
    WHERE created_at BETWEEN ? AND ?
    $where_kel_p
    GROUP BY DATE(created_at)
");
$stmt_kel_harian->execute(array_merge(
    [$tgl_awal . ' 00:00:00', $tgl_akhir . ' 23:59:59'],
    $cab_params
));
$kel_map = [];
foreach ($stmt_kel_harian->fetchAll() as $row) {
    $kel_map[$row['tanggal']] = (float)$row['total_keluar'];
}

// Loop berdasarkan rentang tanggal aktual, bukan asumsi 1 bulan penuh
$grafik_labels = [];
$grafik_omzet  = [];
$grafik_trx    = [];
$grafik_laba   = [];

$current = new DateTime($tgl_awal);
$end     = new DateTime($tgl_akhir);

while ($current <= $end) {
    $tgl    = $current->format('Y-m-d');
    $omzet  = isset($omzet_map[$tgl]) ? (float)$omzet_map[$tgl]['omzet'] : 0;
    $keluar = $kel_map[$tgl] ?? 0;

    $grafik_labels[] = (int)$current->format('j'); // tanggal angka saja
    $grafik_omzet[]  = $omzet;
    $grafik_trx[]    = isset($omzet_map[$tgl]) ? (int)$omzet_map[$tgl]['jumlah_transaksi'] : 0;
    $grafik_laba[]   = $omzet - $keluar;

    $current->modify('+1 day');
}

    // ---- 2. RINGKASAN PER CABANG ----
    $stmt2 = $db->prepare("
        SELECT c.id            AS cabang_id,
               c.nama          AS cabang_nama,
               COUNT(t.id)     AS jumlah_transaksi,
               SUM(t.total)    AS total_omzet,
               AVG(t.total)    AS rata_transaksi
        FROM cabang c
        LEFT JOIN transaksi t ON t.cabang_id = c.id
            AND DATE(t.created_at) BETWEEN ? AND ?
            AND t.kode_nota NOT LIKE 'BATAL-%'
        WHERE 1=1 $where_cab_c
        GROUP BY c.id, c.nama
        ORDER BY total_omzet DESC
    ");
    $stmt2->execute(array_merge([$tgl_awal, $tgl_akhir], $cab_params));
    $per_cabang = $stmt2->fetchAll();

    // ---- 3. PRODUK TERLARIS ----
    $stmt3 = $db->prepare("
        SELECT b.id                AS bibit_id,
               b.nama              AS bibit_nama,
               b.satuan_dasar      AS satuan,
               SUM(td.jumlah_jual) AS total_terjual,
               SUM(td.subtotal)    AS total_omzet,
               COUNT(td.id)        AS frekuensi,
               td.satuan_jual
        FROM transaksi_detail td
        JOIN transaksi t ON td.transaksi_id = t.id
        JOIN bibit     b ON td.bibit_id     = b.id
        WHERE DATE(t.created_at) BETWEEN ? AND ?
          AND t.kode_nota NOT LIKE 'BATAL-%'
          $where_trx
        GROUP BY b.id, b.nama, td.satuan_jual
        ORDER BY total_omzet DESC
        LIMIT 20
    ");
    $stmt3->execute(array_merge([$tgl_awal, $tgl_akhir], $cab_params));
    $produk_terlaris = $stmt3->fetchAll();

    // ---- 4. TOTAL PENGELUARAN ----
    $stmt_kel = $db->prepare("
        SELECT SUM(nominal) AS total_keluar, COUNT(*) AS jml_keluar
        FROM pengeluaran
        WHERE created_at BETWEEN ? AND ?
        $where_kel_p
    ");
    $stmt_kel->execute(array_merge([$tgl_awal . ' 00:00:00', $tgl_akhir . ' 23:59:59'], $cab_params));
    $kel_data     = $stmt_kel->fetch();
    $total_keluar = (float)($kel_data['total_keluar'] ?? 0);
    $jml_keluar   = (int)($kel_data['jml_keluar'] ?? 0);

    // Pengeluaran per cabang
    $stmt_kel2 = $db->prepare("
        SELECT c.id AS cabang_id, c.nama AS cabang_nama,
               COUNT(p.id) AS jml_keluar, SUM(p.nominal) AS total_keluar
        FROM cabang c
        LEFT JOIN pengeluaran p ON p.cabang_id = c.id
            AND p.created_at BETWEEN ? AND ?
        WHERE 1=1 $where_cab_c
        GROUP BY c.id, c.nama
        ORDER BY total_keluar DESC
    ");
    $stmt_kel2->execute(array_merge(
    [$tgl_awal . ' 00:00:00', $tgl_akhir . ' 23:59:59'],
    $cab_params
));
    $keluar_per_cabang = $stmt_kel2->fetchAll();

    // ---- 5. RINGKASAN TOTAL ----
    $total_omzet_bulan   = array_sum(array_column($per_cabang, 'total_omzet'));
    $total_trx_bulan     = array_sum(array_column($per_cabang, 'jumlah_transaksi'));
    $hari_aktif          = count(array_filter($grafik_omzet, fn($v) => $v > 0));
    $rata_omzet_per_hari = $hari_aktif > 0 ? $total_omzet_bulan / $hari_aktif : 0;
    $laba_bersih         = $total_omzet_bulan - $total_keluar;

    $nama_bulan = ['','Januari','Februari','Maret','April','Mei','Juni',
                   'Juli','Agustus','September','Oktober','November','Desember'];

    jsonResponse([
        'success'             => true,
        'periode'             => $nama_bulan[$bulan] . ' ' . $tahun,
        'bulan'               => $bulan,
        'tahun'               => $tahun,
        'tgl_awal'            => $tgl_awal,
        'tgl_akhir'           => $tgl_akhir,
        'grafik_labels'       => $grafik_labels,
        'grafik_omzet'        => $grafik_omzet,
        'grafik_trx'          => $grafik_trx,
        'grafik_laba'         => $grafik_laba,
        'per_cabang'          => $per_cabang,
        'produk_terlaris'     => $produk_terlaris,
        'total_omzet'         => $total_omzet_bulan,
        'total_transaksi'     => $total_trx_bulan,
        'hari_aktif'          => $hari_aktif,
        'rata_omzet_per_hari' => $rata_omzet_per_hari,
        'total_keluar'        => $total_keluar,
        'jml_keluar'          => $jml_keluar,
        'laba_bersih'         => $laba_bersih,
        'keluar_per_cabang'   => $keluar_per_cabang,
    ]);
}