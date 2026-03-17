<?php
// =====================================================
// admin.php — Dashboard Admin
// =====================================================

require_once __DIR__ . '/includes/auth.php';
requireAdmin();

$user = currentUser();
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Admin — Parfum Stock System</title>
  <link rel="stylesheet" href="assets/style.css"/>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
</head>
<body>

<!-- ===== TOPBAR ===== -->
<div class="topbar">
  <div class="topbar-left">
    <span class="brand">Parfum Stock System</span>
    <span class="role-badge role-admin">Admin</span>
  </div>
  <div class="topbar-right">
    <span class="user-name"><?= htmlspecialchars($user['nama']) ?></span>

    <!-- LONCENG NOTIFIKASI -->
    <div class="notif-wrap" id="notif-wrap">
      <button class="notif-bell" id="notif-bell" onclick="toggleNotifDropdown()" title="Notifikasi stok">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span class="notif-badge" id="notif-badge" style="display:none">0</span>
      </button>

      <!-- Dropdown notifikasi -->
      <div class="notif-dropdown" id="notif-dropdown" style="display:none">
        <div class="notif-header">
          <span class="notif-title">Notifikasi Stok</span>
          <button class="notif-readall" onclick="bacaSemua()">Tandai semua dibaca</button>
        </div>
        <div id="notif-list">
          <div class="notif-empty">Memuat...</div>
        </div>
      </div>
    </div>

    <a href="logout.php" class="btn btn-sm">Keluar</a>
  </div>
</div>

<!-- ===== TABS ===== -->
<div class="tabs-bar">
  <button class="tab-btn active" onclick="switchTab('stok')">Stok Cabang</button>
  <button class="tab-btn" onclick="switchTab('log')">Log Aktivitas</button>
  <button class="tab-btn" onclick="switchTab('laporan')">Laporan PDF</button>
  <button class="tab-btn" onclick="switchTab('rekap')">Rekap Bulanan</button>
  <button class="tab-btn" onclick="switchTab('users')">Kelola User</button>
  <button class="tab-btn" onclick="switchTab('produk')">Produk & Distribusi</button>
</div>

<!-- ===== KONTEN TAB ===== -->
<div class="page-body">
  <div id="tab-stok"    class="tab-content active"></div>
  <div id="tab-log"     class="tab-content"></div>
  <div id="tab-laporan" class="tab-content"></div>
  <div id="tab-rekap"   class="tab-content"></div>
  <div id="tab-users"   class="tab-content"></div>
  <div id="tab-produk"  class="tab-content"></div>
</div>

<!-- ===== MODAL — EDIT STOK ===== -->
<div class="modal-bg" id="modal-stok">
  <div class="modal">
    <div class="modal-title">Edit / Distribusi Stok</div>
    <div class="form-group">
      <label>Cabang</label>
      <select id="ms-cabang" onchange="updateModalSatuan()"></select>
    </div>
    <div class="form-group">
      <label>Produk</label>
      <div class="ss-wrap" id="ss-bibit-wrap">
        <!-- Input pencarian dengan ikon -->
        <div class="ss-input-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" id="ss-bibit-input"
            placeholder="Ketik nama produk..."
            oninput="filterSSBibit()"
            autocomplete="off"/>
        </div>
        <!-- Dropdown hasil pencarian -->
        <div id="ss-bibit-drop" class="ss-drop ss-hide"></div>
        <!-- Hidden value -->
        <input type="hidden" id="ms-bibit"/>
        <!-- Produk terpilih -->
        <div id="ss-bibit-selected" class="ss-selected" style="display:none">
          <div class="ss-selected-info">
            <div class="ss-selected-nama" id="ss-bibit-nama"></div>
            <div class="ss-selected-meta" id="ss-bibit-meta"></div>
          </div>
          <button type="button" class="ss-selected-del" onclick="clearSSBibit()" title="Ganti produk">×</button>
        </div>
      </div>
    </div>
    <div class="form-group">
      <label>Tipe</label>
      <select id="ms-tipe">
        <option value="tambah">Tambah stok</option>
        <option value="set">Set stok (ganti angka langsung)</option>
      </select>
    </div>
    <div class="form-group">
      <label>Jumlah <span id="ms-satuan-label" style="font-weight:400;color:var(--teal)">(ml)</span></label>
      <input type="number" id="ms-jumlah" min="0" placeholder="Jumlah"/>
      <div id="ms-satuan-info" style="font-size:12px;color:var(--text2);margin-top:4px"></div>
    </div>
    <div class="form-group"><label>Keterangan</label><input type="text" id="ms-ket" placeholder="e.g. distribusi batch 1"/></div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal('modal-stok')">Batal</button>
      <button class="btn btn-primary" onclick="saveStokModal()">Simpan</button>
    </div>
  </div>
</div>

<!-- ===== MODAL — TAMBAH USER ===== -->
<div class="modal-bg" id="modal-user">
  <div class="modal">
    <div class="modal-title" id="mu-title">Tambah User</div>
    <div class="form-group"><label>Nama Lengkap</label><input type="text" id="mu-nama" placeholder="Nama lengkap"/></div>
    <div class="form-group"><label>Username</label><input type="text" id="mu-user" placeholder="username"/></div>
    <div class="form-group">
      <label>Password <span id="mu-hint" style="font-weight:400;color:var(--text2)"></span></label>
      <input type="password" id="mu-pass" placeholder="Password (min. 6 karakter)"/>
    </div>
    <div class="form-group">
      <label>Role</label>
      <select id="mu-role" onchange="toggleCabangField()">
        <option value="karyawan">Karyawan</option>
        <option value="admin">Admin</option>
      </select>
    </div>
    <div class="form-group" id="mu-cabang-wrap">
      <label>Cabang</label><select id="mu-cabang"></select>
    </div>
    <div id="mu-err" class="err-msg"></div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal('modal-user')">Batal</button>
      <button class="btn btn-primary" onclick="saveUser()">Simpan</button>
    </div>
  </div>
</div>

<!-- ===== MODAL — TAMBAH PRODUK ===== -->
<div class="modal-bg" id="modal-bibit">
  <div class="modal">
    <div class="modal-title">Tambah Produk Baru</div>

    <div class="form-group">
      <label>Nama Produk</label>
      <input type="text" id="mb-nama" placeholder="e.g. L. Sakura Besar, Botol 30ml, Oud Arabia"/>
    </div>

    <div class="form-group">
      <label>Kategori / Jenis</label>
      <select id="mb-kategori" onchange="updateSatuanOptions()">
        <option value="parfum">Parfum / Bibit (satuan: ml)</option>
        <option value="laundry">Laundry (satuan: botol / pcs)</option>
        <option value="aksesoris">Aksesoris / Botol / Dupa (satuan: pcs / lusin)</option>
        <option value="lainnya">Lainnya (pilih satuan manual)</option>
      </select>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Satuan Jual</label>
        <select id="mb-satuan" onchange="updateSatuanDasar()">
          <option value="ml"    data-dasar="ml"    data-konversi="1">ml</option>
          <option value="liter" data-dasar="ml"    data-konversi="1000">liter (1000ml)</option>
          <option value="gram"  data-dasar="gram"  data-konversi="1">gram</option>
          <option value="pcs"   data-dasar="pcs"   data-konversi="1">pcs</option>
          <option value="botol" data-dasar="botol" data-konversi="1">botol</option>
          <option value="lusin" data-dasar="pcs"   data-konversi="12">lusin (12 pcs)</option>
          <option value="kodi"  data-dasar="pcs"   data-konversi="20">kodi (20 pcs)</option>
          <option value="pack"  data-dasar="pack"  data-konversi="1">pack</option>
          <option value="box"   data-dasar="box"   data-konversi="1">box</option>
          <option value="kg"    data-dasar="gram"  data-konversi="1000">kg (1000 gram)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Satuan Dasar (stok)</label>
        <input type="text" id="mb-satuan-dasar" placeholder="ml / pcs / botol" readonly
               style="background:var(--bg2);color:var(--text2)"/>
      </div>
    </div>

    <div id="mb-konversi-info" style="font-size:12px;color:var(--teal);margin-bottom:10px;padding:8px 10px;background:var(--teal-l);border-radius:6px;display:none"></div>

    <div class="form-group">
      <label>Stok Awal per Cabang</label>
      <div style="display:flex;align-items:center;gap:8px">
        <input type="number" id="mb-stok" min="0" placeholder="0" style="flex:1"/>
        <span id="mb-satuan-label" style="font-size:13px;color:var(--text2);white-space:nowrap">ml</span>
      </div>
    </div>

    <div id="mb-err" class="err-msg"></div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal('modal-bibit')">Batal</button>
      <button class="btn btn-primary" onclick="saveBibit()">Tambah Produk</button>
    </div>
  </div>
</div>

<!-- ===== MODAL — TAMBAH CABANG ===== -->
<div class="modal-bg" id="modal-cabang">
  <div class="modal">
    <div class="modal-title">Tambah Cabang Baru</div>
    <div class="form-group"><label>Nama Cabang</label><input type="text" id="mc-nama" placeholder="e.g. Cabang Bekasi"/></div>
    <div class="form-group"><label>Alamat (opsional)</label><input type="text" id="mc-alamat" placeholder="Alamat cabang"/></div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal('modal-cabang')">Batal</button>
      <button class="btn btn-primary" onclick="saveCabang()">Tambah</button>
    </div>
  </div>
</div>

<!-- Data user dari PHP untuk JavaScript -->
<script>
  const CURRENT_USER = {
    id:   <?= (int)$user['id'] ?>,
    nama: <?= json_encode($user['nama']) ?>,
    role: 'admin'
  };
</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script src="assets/app.js"></script>

</body>
</html>