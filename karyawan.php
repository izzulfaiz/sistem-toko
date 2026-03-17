<?php
require_once __DIR__ . '/includes/auth.php';
requireLogin();
if (isAdmin()) { header('Location: admin.php'); exit; }
$user = currentUser();
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Karyawan — Parfum Stock</title>
  <link rel="stylesheet" href="assets/style.css"/>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
  <style>
    /* Karyawan-specific styles */
    body { padding-bottom: 70px; }

    .k-tabs { display:flex; background:#fff; border-bottom:0.5px solid var(--border); overflow-x:auto; }
    .k-tab-btn {
      flex:1; padding:13px 8px; font-size:13px; font-weight:500;
      border:none; background:transparent; color:var(--text2);
      cursor:pointer; border-bottom:2px solid transparent;
      white-space:nowrap; font-family:inherit; transition:all .15s;
      display:flex; flex-direction:column; align-items:center; gap:4px;
    }
    .k-tab-btn svg { width:20px; height:20px; flex-shrink:0; }
    .k-tab-btn.active { color:var(--amber); border-bottom-color:var(--amber); }
    .k-tab-btn:hover:not(.active) { background:var(--bg2); }
    .k-tab-label { font-size:12px; }

    .k-page { padding:1rem; max-width:700px; margin:0 auto; }
    .k-card { background:#fff; border:0.5px solid var(--border); border-radius:12px; padding:1.25rem; margin-bottom:14px; }
    .k-card-title { font-size:13px; font-weight:600; color:var(--text2); text-transform:uppercase; letter-spacing:.4px; margin-bottom:12px; }

    .search-box { position:relative; }
    .search-box svg { position:absolute; left:11px; top:50%; transform:translateY(-50%); width:16px; height:16px; color:var(--text2); pointer-events:none; }
    .search-box input { padding-left:35px; }
    .sdrop { position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:99; background:#fff; border:0.5px solid var(--border); border-radius:10px; box-shadow:0 4px 20px rgba(0,0,0,.1); max-height:240px; overflow-y:auto; }
    .sdrop-item { padding:10px 14px; font-size:13px; cursor:pointer; border-bottom:0.5px solid var(--border); transition:background .1s; }
    .sdrop-item:last-child { border-bottom:none; }
    .sdrop-item:hover { background:var(--bg2); }
    .sdrop-item .sdrop-sub { font-size:11px; color:var(--text2); margin-top:2px; }
    .sdrop-empty { padding:14px; text-align:center; color:var(--text2); font-size:13px; }
    .sdrop.hide { display:none; }

    .selected-prod { display:flex; align-items:center; justify-content:space-between; margin-top:8px; padding:9px 12px; background:var(--teal-l); border:0.5px solid #9fe1cb; border-radius:8px; font-size:13px; color:var(--teal); }
    .selected-prod button { border:none; background:none; color:var(--teal); font-size:18px; cursor:pointer; line-height:1; padding:0; }

    .detail-form { margin-top:14px; display:none; }
    .subtotal-box { background:var(--teal-l); border:0.5px solid #9fe1cb; border-radius:8px; padding:10px 12px; font-size:15px; font-weight:700; color:var(--teal); }
    .stok-hint { font-size:12px; color:var(--text2); padding:6px 10px; background:var(--bg2); border-radius:6px; margin-bottom:10px; }

    .nota-wrap { border:1.5px dashed var(--amber-m); background:#fffcf5; border-radius:12px; padding:1.25rem; margin-bottom:14px; }
    .nota-title { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
    .nota-item { display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:0.5px solid var(--border); }
    .nota-item:last-child { border-bottom:none; }
    .nota-item-info { flex:1; }
    .nota-item-nama { font-size:13px; font-weight:500; }
    .nota-item-sub { font-size:11px; color:var(--text2); margin-top:2px; }
    .nota-item-price { text-align:right; }
    .nota-item-total { font-size:14px; font-weight:700; color:var(--amber); }
    .nota-item-unit  { font-size:11px; color:var(--text2); }
    .nota-del { width:28px; height:28px; border-radius:50%; border:none; background:var(--red-l); color:var(--red); font-size:16px; cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
    .nota-total-row { display:flex; justify-content:space-between; align-items:center; padding:12px 0 8px; border-top:0.5px solid var(--border); margin-top:8px; }
    .nota-total-label { font-size:14px; font-weight:600; }
    .nota-total-val   { font-size:24px; font-weight:700; color:var(--amber); }

    .trx-card { background:#fff; border:0.5px solid var(--border); border-radius:12px; padding:1rem; margin-bottom:10px; }
    .trx-head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; }
    .trx-kode { font-size:13px; font-weight:600; }
    .trx-jumlah { font-size:15px; font-weight:700; color:var(--amber); }
    .trx-meta { font-size:11px; color:var(--text2); margin-top:2px; }
    .trx-items { border-top:0.5px solid var(--border); padding-top:8px; margin-top:8px; }
    .trx-row { display:flex; justify-content:space-between; font-size:12px; padding:3px 0; }
    .trx-row span:last-child { color:var(--amber); font-weight:500; }

    .sum-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
    .sum-card { background:#fff; border:0.5px solid var(--border); border-radius:10px; padding:12px; text-align:center; }
    .sum-val { font-size:22px; font-weight:700; }
    .sum-lbl { font-size:11px; color:var(--text2); margin-top:3px; }

    .user-block { display:flex; flex-direction:column; align-items:flex-end; }
    .user-block .u-nama { font-size:13px; font-weight:500; color:var(--text); }
    .user-block .u-cab  { font-size:11px; color:var(--text2); }
  </style>
</head>
<body>

<div class="topbar">
  <div class="topbar-left">
    <span class="brand">Parfum Stock</span>
    <span class="role-badge role-karyawan">Karyawan</span>
  </div>
  <div class="topbar-right">
    <div class="user-block">
      <span class="u-nama"><?= htmlspecialchars($user['nama']) ?></span>
      <?php if($user['cabang_nama']): ?>
      <span class="u-cab"><?= htmlspecialchars($user['cabang_nama']) ?></span>
      <?php endif; ?>
    </div>
    <a href="logout.php" class="btn btn-sm">Keluar</a>
  </div>
</div>

<!-- TAB NAV -->
<div class="k-tabs">
  <button class="k-tab-btn active" id="ktab-btn-transaksi" onclick="kTab('transaksi')">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59L5.25 14c-.16.28-.25.61-.25.96C5 16.1 5.9 17 7 17h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0023.46 4H5.21l-.94-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
    <span class="k-tab-label">Transaksi</span>
  </button>
  <button class="k-tab-btn" id="ktab-btn-riwayat" onclick="kTab('riwayat')">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
    <span class="k-tab-label">Riwayat</span>
  </button>
  <button class="k-tab-btn" id="ktab-btn-stok" onclick="kTab('stok')">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.72V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.72c.57-.38 1-1 1-1.72V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4l16-.02V7z"/></svg>
    <span class="k-tab-label">Cek Stok</span>
  </button>
  <button class="k-tab-btn" id="ktab-btn-rekap" onclick="kTab('rekap')">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/></svg>
    <span class="k-tab-label">Rekap</span>
  </button>
</div>

<div class="k-page">

  <!-- TAB: TRANSAKSI -->
  <div id="ktab-transaksi">

    <div class="k-card">
      <div class="k-card-title">Tambah Item ke Nota</div>

      <!-- Search produk -->
      <div class="search-box" id="search-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input type="text" id="k-search" placeholder="Ketik nama produk..." oninput="filterProduk()" autocomplete="off"/>
        <div id="k-dropdown" class="sdrop hide"></div>
      </div>

      <!-- Produk terpilih -->
      <div id="k-selected" class="selected-prod" style="display:none">
        <span id="k-selected-nama"></span>
        <button onclick="clearProduk()">×</button>
      </div>

      <!-- Form detail -->
      <div class="detail-form" id="k-detail-form">
        <div id="k-stok-hint" class="stok-hint"></div>
        <div class="form-row">
          <div class="form-group">
            <label>Satuan</label>
            <select id="k-satuan" onchange="hitungSubtotal()"></select>
          </div>
          <div class="form-group">
            <label>Jumlah</label>
            <input type="number" id="k-jumlah" min="0.01" step="0.01" placeholder="0" oninput="hitungSubtotal()"/>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Harga / Satuan (Rp)</label>
            <input type="number" id="k-harga" min="0" step="100" placeholder="0" oninput="hitungSubtotal()"/>
          </div>
          <div class="form-group">
            <label>Subtotal</label>
            <div class="subtotal-box" id="k-subtotal">Rp 0</div>
          </div>
        </div>
        <button class="btn btn-primary btn-block" onclick="tambahItem()">+ Tambah ke Nota</button>
      </div>
    </div>

    <!-- NOTA -->
    <div class="nota-wrap" id="k-nota-wrap" style="display:none">
      <div class="nota-title">
        <div>
          <strong style="font-size:14px">Nota Penjualan</strong>
          <div id="k-nota-count" style="font-size:12px;color:var(--text2)"></div>
        </div>
        <span class="live-badge"><span class="pulse"></span>Draft</span>
      </div>

      <div id="k-nota-items"></div>

      <div class="nota-total-row">
        <span class="nota-total-label">Total</span>
        <span class="nota-total-val" id="k-total">Rp 0</span>
      </div>
      <div class="form-group" style="margin-top:8px">
        <label>Catatan (opsional)</label>
        <input type="text" id="k-catatan" placeholder="e.g. pelanggan reguler, COD"/>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-danger" style="flex:1" onclick="batalNota()">Batalkan</button>
        <button class="btn btn-primary" style="flex:2" onclick="simpanTransaksi()">Simpan Transaksi</button>
      </div>
    </div>

  </div><!-- end transaksi -->

  <!-- TAB: RIWAYAT -->
  <div id="ktab-riwayat" style="display:none">
    <div class="k-card" style="padding:12px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input type="date" id="riwayat-tgl" style="flex:1;min-width:140px" onchange="loadRiwayat()"/>
        <button class="btn btn-green btn-sm" onclick="exportPDFKaryawan()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:4px"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          Export PDF
        </button>
      </div>
    </div>
    <div id="riwayat-content"><div class="empty">Pilih tanggal untuk melihat riwayat</div></div>
  </div>

  <!-- TAB: REKAP BULANAN -->
  <div id="ktab-rekap" style="display:none">
    <div class="k-card" style="padding:12px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select id="k-rekap-bulan" onchange="loadRekapKaryawan()" style="flex:1;min-width:120px"></select>
        <select id="k-rekap-tahun" onchange="loadRekapKaryawan()" style="width:90px"></select>
        <button class="btn btn-green btn-sm" onclick="exportPDFRekap(false)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:4px"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          PDF
        </button>
      </div>
    </div>
    <div id="k-rekap-content"><div class="empty">Pilih bulan untuk melihat rekap</div></div>
  </div>

  <!-- TAB: STOK -->
  <div id="ktab-stok" style="display:none">
    <div class="k-card">
      <div class="k-card-title">Stok <?= htmlspecialchars($user['cabang_nama'] ?? '') ?></div>
      <input type="text" id="stok-search" placeholder="Cari produk..." oninput="filterStokTable()" style="margin-bottom:10px"/>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Produk</th><th>Stok</th><th>Satuan</th><th>Status</th></tr></thead>
          <tbody id="k-stok-tbody"><tr><td colspan="4" class="loading">Memuat...</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

</div><!-- end k-page -->

<script>
const CURRENT_USER = {
  id:          <?= (int)$user['id'] ?>,
  nama:        <?= json_encode($user['nama']) ?>,
  role:        'karyawan',
  cabang_id:   <?= (int)$user['cabang_id'] ?>,
  cabang_nama: <?= json_encode($user['cabang_nama']) ?>
};
</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script src="assets/app.js"></script>
</body>
</html>