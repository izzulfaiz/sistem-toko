<?php
// =====================================================
// config/app.php — Konfigurasi terpusat aplikasi

return [
    // Nama toko (tampil di topbar & PDF)
    'toko_nama'     => 'Mekar Wangi System',

    // Threshold stok (satuan dasar: ml, gram, liter, kg)
    'stok_warning'  => 70,   // batas kuning (rendah)
    'stok_critical' => 40,   // batas merah (kritis)

    // Threshold stok satuan pcs/botol/dll
    'stok_warning_pcs'  => 5,
    'stok_critical_pcs' => 2,
];