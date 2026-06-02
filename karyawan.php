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
  <title>Karyawan — Mekar Wangi System</title>
  <link rel="icon" href="assets/logo.png" type="image/png">
  <link rel="stylesheet" href="assets/style.css?v=<?php echo filemtime('assets/style.css'); ?>">
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
    <div style="display:flex;align-items:center;gap:8px">
      <img src="assets/logo.png" alt="MW" style="width:30px;height:30px;object-fit:contain;border-radius:7px;background:#3D52A0;padding:3px"/>
      <span class="brand">Mekar Wangi</span>
    </div>
    <span class="role-badge role-karyawan">Karyawan</span>
  </div>
  <div class="topbar-right">
    <div class="user-block">
      <span class="u-nama"><?= htmlspecialchars($user['nama']) ?></span>
      <?php if($user['cabang_nama']): ?>
      <span class="u-cab"><?= htmlspecialchars($user['cabang_nama']) ?></span>
      <?php endif; ?>
    </div>
    <button onclick="toggleDarkMode()" id="btn-theme"
  style="background:none;border:none;cursor:pointer;font-size:18px;padding:4px 6px;border-radius:8px;line-height:1"
  title="Toggle Dark Mode">🌙</button>
    <a href="logout.php" class="btn btn-sm">Keluar</a>
  </div>
</div>

<!-- TAB NAV -->
<div class="k-tabs">
  <button class="k-tab-btn active" id="ktab-btn-transaksi" onclick="kTab('transaksi')">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59L5.25 14c-.16.28-.25.61-.25.96C5 16.1 5.9 17 7 17h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0023.46 4H5.21l-.94-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
    <span class="k-tab-label">Pemasukan</span>
  </button>
  <button class="k-tab-btn" id="ktab-btn-keluar" onclick="kTab('keluar')">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17 12h-5v3l-4-4 4-4v3h5v2zm4-9H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/></svg>
    <span class="k-tab-label">Pengeluaran</span>
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
  <button class="k-tab-btn" id="ktab-btn-member" onclick="kTab('member')">
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
  <span class="k-tab-label">Member</span>
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

  <!-- Input member (opsional) -->
  <div id="k-member-section" style="margin-bottom:12px;padding:10px;background:var(--bg2);border-radius:10px;border:0.5px solid var(--border)">
    <div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Member (opsional)</div>

    <!-- State: belum pilih member -->
    <div id="k-member-search-wrap">
      <div style="display:flex;gap:8px">
        <input type="text" id="k-member-search"
          placeholder="Cari no HP atau nama member..."
          style="flex:1;font-size:13px"
          oninput="cariMember(this.value)"
          autocomplete="off"/>
        <button class="btn btn-sm" onclick="clearMemberPilih()" style="white-space:nowrap">Tanpa Member</button>
      </div>
      <div id="k-member-dropdown" style="display:none;background:var(--bg);border:0.5px solid var(--border);border-radius:8px;margin-top:4px;overflow:hidden;max-height:160px;overflow-y:auto"></div>
    </div>

    <!-- State: member terpilih -->
    <div id="k-member-terpilih" style="display:none">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;color:var(--teal)" id="k-member-nama-display">-</div>
          <div style="font-size:11px;color:var(--text2)" id="k-member-info-display">-</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:11px;color:var(--text2)">Stamp saat ini</div>
          <div style="font-size:18px;font-weight:700;color:var(--amber)" id="k-member-stamp-display">0</div>
        </div>
        <button onclick="clearMemberPilih()" style="border:none;background:none;font-size:18px;cursor:pointer;color:var(--text2);padding:0 4px">×</button>
      </div>
      <!-- Stamp progress bar -->
      <div style="margin-top:8px">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text2);margin-bottom:3px">
          <span id="k-stamp-progress-label">0 / 10 menuju reward</span>
          <span id="k-stamp-next-label"></span>
        </div>
        <div style="height:6px;background:var(--bg2);border-radius:99px;overflow:hidden">
          <div id="k-stamp-progressbar" style="height:100%;background:var(--amber);border-radius:99px;width:0%;transition:width .3s"></div>
        </div>
      </div>
    </div>
  </div>

  <div id="k-nota-items"></div>

  <!-- Stamp preview (muncul kalau ada item yang dicentang + ada member) -->
  <div id="k-stamp-preview" style="display:none;align-items:center;gap:6px;padding:8px 10px;background:var(--teal-l);border-radius:8px;margin:8px 0;border:0.5px solid #9fe1cb"></div>

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

  <!-- TAB: TRANSAKSI KELUAR -->
  <div id="ktab-keluar" style="display:none">

    <div class="k-card">
      <div class="k-card-title">Catat Pengeluaran</div>
      <div class="form-group">
        <label>Nama Item / Keperluan</label>
        <input type="text" id="kel-nama" placeholder="e.g. Beli galon, Beli plastik, Bayar listrik"/>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Nominal (Rp)</label>
          <input type="number" id="kel-nominal" min="1" step="100" placeholder="0" oninput="previewKeluar()"/>
        </div>
        <div class="form-group">
          <label>Preview</label>
          <div id="kel-preview" style="padding:9px 11px;background:var(--red-l);border-radius:8px;font-weight:700;font-size:15px;color:var(--red);border:0.5px solid #f7c1c1">Rp 0</div>
        </div>
      </div>
      <div class="form-group">
        <label>Keterangan (opsional)</label>
        <input type="text" id="kel-ket" placeholder="e.g. untuk operasional cabang"/>
      </div>
      <div id="kel-msg"></div>
      <button class="btn btn-danger" style="width:100%;padding:11px;font-size:14px" onclick="simpanKeluar()">
        Catat Pengeluaran
      </button>
    </div>

    <!-- Riwayat pengeluaran hari ini -->
    <div class="k-card">
      <div class="k-card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Pengeluaran Hari Ini</span>
        <span class="live-badge"><span class="pulse"></span>Live</span>
      </div>
      <div id="kel-list"><div class="loading">Memuat...</div></div>
    </div>

  </div><!-- end keluar -->

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
<!-- TAB: MEMBER -->
<div id="ktab-member" style="display:none">

  <!-- Summary card -->
  <div class="k-card" style="padding:12px 14px">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:4px">
      <div style="text-align:center">
        <div style="font-size:22px;font-weight:700;color:var(--blue)" id="m-total-member">-</div>
        <div style="font-size:11px;color:var(--text2)">Total Member</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:22px;font-weight:700;color:var(--teal)" id="m-total-aktif">-</div>
        <div style="font-size:11px;color:var(--text2)">Aktif</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:22px;font-weight:700;color:var(--amber)" id="m-total-reward">-</div>
        <div style="font-size:11px;color:var(--text2)">Reward Pending</div>
      </div>
    </div>
  </div>

  <!-- Toolbar: search + daftar member baru -->
  <div class="k-card" style="padding:10px 12px">
  <!-- Toggle filter -->
  <div style="display:flex;gap:6px;margin-bottom:10px">
    <button id="m-filter-semua" onclick="setMemberFilter('semua')"
      class="btn btn-sm btn-primary"
      style="flex:1;font-size:12px">
      🌐 Semua Member
    </button>
    <button id="m-filter-cabang" onclick="setMemberFilter('cabang')"
      class="btn btn-sm"
      style="flex:1;font-size:12px;background:var(--bg2);border:0.5px solid var(--border)">
      🏪 Cabang Ini
    </button>
  </div>

  <!-- Search + Daftar -->
  <div style="display:flex;gap:8px;margin-bottom:10px">
    <input type="text" id="m-search" placeholder="Cari nama atau no HP..."
      style="flex:1;font-size:13px" oninput="debounceMemberSearch(this.value)"/>
    <button class="btn btn-primary btn-sm" onclick="openModalDaftarMember()" style="white-space:nowrap">+ Daftar</button>
  </div>

  <!-- QR scan button -->
  <button onclick="startQRScan()"
    style="width:100%;padding:9px;border:1.5px dashed var(--amber-m);border-radius:8px;background:var(--bg2);cursor:pointer;font-size:13px;color:var(--amber);font-weight:500;display:flex;align-items:center;justify-content:center;gap:6px">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9.5 6.5v3h-3v-3h3M11 5H5v6h6V5zm-1.5 9.5v3h-3v-3h3M11 13H5v6h6v-6zm6.5-6.5v3h-3v-3h3M19 5h-6v6h6V5zm-6 8h1.5v1.5H13V13zm1.5 1.5H16V16h-1.5v-1.5zM16 13h1.5v1.5H16V13zm-3 3h1.5v1.5H13V16zm1.5 1.5H16V19h-1.5v-1.5zM16 16h1.5v1.5H16V16zm1.5-1.5H19V16h-1.5v-1.5zM19 13h1.5v1.5H19V13zm-1.5 4.5H19V19h-1.5v-1.5z"/></svg>
    Scan QR Code Member
  </button>
</div>

  <!-- Daftar member -->
  <div id="m-list-wrap"><div class="empty" style="padding:2rem">Memuat data member...</div></div>

</div>
  <!-- TAB: STOK -->
  <div id="ktab-stok" style="display:none">
    <div class="k-card">
      <div class="k-card-title" id="k-stok-title">Stok <?= htmlspecialchars($user['cabang_nama'] ?? '') ?></div>
      <div style="position:relative;margin-bottom:10px">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#888780;pointer-events:none">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="text" id="stok-search" placeholder="Cari produk..."
          oninput="filterKaryawanStok(this.value)" style="padding-left:32px"/>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Produk</th><th>Stok</th><th>Satuan</th><th>Status</th></tr></thead>
          <tbody id="k-stok-tbody"><tr><td colspan="4" class="loading">Memuat...</td></tr></tbody>
        </table>
      </div>
      <div id="k-stok-pagination"></div>
    </div>
  </div>

</div><!-- end k-page -->

<!-- Modal: Daftar Member Baru -->
<div class="modal-bg" id="modal-daftar-member">
  <div class="modal" style="max-width:400px;width:90%">
    <div class="modal-header">
      <span class="modal-title">Daftar Member Baru</span>
      <button class="modal-close" onclick="closeModal('modal-daftar-member')">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Nama <span style="color:var(--red)">*</span></label>
        <input type="text" id="dm-nama" placeholder="Nama lengkap customer"/>
      </div>
      <div class="form-group">
        <label>No HP <span style="color:var(--red)">*</span></label>
        <input type="tel" id="dm-hp" placeholder="08xxxxxxxxxx"/>
      </div>
      <div class="form-group">
        <label>Catatan (opsional)</label>
        <input type="text" id="dm-catatan" placeholder="e.g. pelanggan tetap"/>
      </div>
      <div id="dm-err" style="color:var(--red);font-size:12px;min-height:16px"></div>
    </div>
    <div class="modal-footer" style="display:flex;gap:8px">
      <button class="btn" style="flex:1" onclick="closeModal('modal-daftar-member')">Batal</button>
      <button class="btn btn-primary" style="flex:2" onclick="simpanDaftarMember()">Daftar Sekarang</button>
    </div>
  </div>
</div>

<!-- Modal: Detail Member -->
<div class="modal-bg" id="modal-detail-member">
  <div class="modal" style="max-width:440px;width:90%">
    <div class="modal-header">
      <span class="modal-title" id="mdm-nama-title">Detail Member</span>
      <button class="modal-close" onclick="closeModal('modal-detail-member')">×</button>
    </div>
    <div class="modal-body" id="mdm-body">
      <!-- diisi JS -->
    </div>
  </div>
</div>

<!-- Modal: QR Scanner -->
<div class="modal-bg" id="modal-qr-scanner">
  <div class="modal" style="max-width:380px;width:90%">
    <div class="modal-header">
      <span class="modal-title">Scan QR Member</span>
      <button class="modal-close" onclick="stopQRScan()">×</button>
    </div>
    <div class="modal-body" style="text-align:center">
      <div id="qr-reader" style="width:100%;border-radius:10px;overflow:hidden"></div>
      <div id="qr-result" style="margin-top:10px;font-size:13px;color:var(--text2)">Arahkan kamera ke QR Code member</div>
    </div>
  </div>
</div>
<script>
const CURRENT_USER = {
  id:          <?= (int)$user['id'] ?>,
  nama:        <?= json_encode($user['nama']) ?>,
  role:        'karyawan',
  cabang_id:   <?= (int)$user['cabang_id'] ?>,
  cabang_nama: <?= json_encode($user['cabang_nama']) ?>,
  cabang_alamat:<?= json_encode($cabang['alamat'] ?? '') ?>,
};
const WA_NUMBER = "6285738894427"; // ← ganti dengan nomor WA admin
</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script src="assets/app.js?v=<?php echo filemtime('assets/app.js'); ?>"></script>
<div id="toast-container"></div>
<!-- Modal: Tukar Reward -->
<div class="modal-bg" id="modal-tukar-reward">
  <div class="modal" style="max-width:500px;width:95%">
    <div class="modal-header">
      <span class="modal-title">Tukar Reward Member</span>
      <button class="modal-close" onclick="tutupModalReward()">×</button>
    </div>
    <div class="modal-body">

      <!-- Info reward -->
      <div id="reward-modal-info" style="padding:10px 12px;background:var(--bg2);border-radius:8px;margin-bottom:14px;font-size:12px;color:var(--text2)"></div>

      <!-- Search bibit (mirip tab pemasukan) -->
      <div class="form-group">
        <label>Tambah Bibit Reward</label>
        <div style="position:relative" id="reward-search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#888780;pointer-events:none">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" id="reward-search" placeholder="Ketik nama bibit..."
            style="padding-left:34px" oninput="filterRewardBibit(this.value)" autocomplete="off"/>
          <div id="reward-bibit-dropdown" class="sdrop hide"></div>
        </div>
      </div>

      <!-- Produk terpilih -->
      <div id="reward-selected-wrap" style="display:none;margin-bottom:10px">
        <div id="reward-selected-nama" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--teal-l);border:0.5px solid #9fe1cb;border-radius:8px;font-size:13px;color:var(--teal)">
          <span id="reward-produk-nama"></span>
          <button onclick="clearRewardProduk()" style="border:none;background:none;font-size:18px;cursor:pointer;color:var(--teal)">×</button>
        </div>
        <!-- Form jumlah & satuan -->
        <div class="form-row" style="margin-top:10px">
          <div class="form-group">
            <label>Satuan</label>
            <select id="reward-satuan" onchange="hitungRewardSubtotal()"></select>
          </div>
          <div class="form-group">
            <label>Jumlah</label>
            <input type="number" id="reward-jumlah" min="0.01" step="0.01"
              placeholder="0" oninput="hitungRewardSubtotal()"/>
          </div>
        </div>
        <div id="reward-stok-hint" class="stok-hint" style="margin-bottom:10px"></div>
        <button class="btn btn-primary btn-block" onclick="tambahRewardItem()">+ Tambah ke Reward</button>
      </div>

      <!-- List item reward (nota) -->
      <div id="reward-nota-wrap" style="display:none;border:1.5px dashed var(--amber-m);background:#fffcf5;border-radius:10px;padding:12px;margin-top:10px">
        <div style="font-size:12px;font-weight:600;margin-bottom:8px;display:flex;justify-content:space-between">
          <span>Item Reward</span>
          <span id="reward-item-count" style="color:var(--text2)"></span>
        </div>
        <div id="reward-nota-items"></div>
      </div>

    </div>
    <div class="modal-footer" style="display:flex;gap:8px">
      <button class="btn" style="flex:1" onclick="tutupModalReward()">Batal</button>
      <button class="btn btn-primary" style="flex:2" id="btn-berikan-reward"
        onclick="simpanReward()" disabled>Berikan Reward</button>
    </div>
  </div>
</div>
</body>
</html>