<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/functions.php';
requireLogin();

$kode = clean($_GET['kode'] ?? '');
if (!$kode) {
    header('Location: karyawan.php');
    exit;
}

$trx = getTransaksiByKode($kode);
if (!$trx) {
    die('Nota tidak ditemukan.');
}

// Ambil data cabang lengkap
$db   = getDB();
$stmt = $db->prepare("SELECT * FROM cabang WHERE id = ?");
$stmt->execute([$trx['cabang_id']]);
$cabang = $stmt->fetch();

$toko       = 'Mekar Wangi Indonesia';
$wa_number  = '6285738894427'; // ganti sesuai nomor WA admin
$wa_fmt     = '0' . substr($wa_number, 2);
$wa_fmt     = substr($wa_fmt, 0, 4) . '-' . substr($wa_fmt, 4, 4) . '-' . substr($wa_fmt, 8);
$total      = number_format($trx['total'], 0, ',', '.');
$tgl        = date('d/m/Y H:i', strtotime($trx['created_at']));
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Nota <?= htmlspecialchars($trx['kode_nota']) ?></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }

    body {
      font-family: 'Inter',sans-serif;
      background: #f8f7f4;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* TOPBAR */
    .topbar {
      background: #fff;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .topbar-title {
      font-size: 15px;
      font-weight: 600;
      color: #1a1a18;
    }
    .topbar-actions {
      display: flex;
      gap: 8px;
    }
    .btn-back {
      padding: 7px 14px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.2);
      background: #c2185b;
      color: #1a1a18;
      font-size: 13px;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .btn-back:hover { background: #e74184; }

    .btn-toggle {
      padding: 7px 10px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.2);
      background: transparent;
      color: #fff;
      font-size: 14px;
      cursor: pointer;
    }

    .btn-print {
      padding: 7px 16px;
      border-radius: 8px;
      border: none;
      background: #3D52A0;
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .btn-print:hover { background: #2d3f80; }

    /* WRAPPER */
    .preview-wrap {
      flex: 1;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 30px 16px;
    }

    /* NOTA CARD */
    .nota-card {
      background: #fff;
      color: #111;
      border-radius: 16px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.4);
      overflow: hidden;
      font-family: 'Inter', sans-serif;
    }

    /* HEADER NOTA */
    .nota-header {
  background: #fff;
  color: #111;
  padding: 24px 20px 20px;
  text-align: center;
  border-bottom: 2px solid #111;
}
    .nota-logo {
  width: 52px;
  height: 52px;
  object-fit: contain;
  border-radius: 12px;
  background: #f5f5f5;
  padding: 6px;
  margin-bottom: 10px;
}
    .nota-toko {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.3px;
      margin-bottom: 3px;
      color: #111;
    }
    .nota-cabang { font-size: 13px; color: #333; margin-bottom: 2px; }
.nota-alamat { font-size: 11px; color: #666; margin-bottom: 2px; }
.nota-wa     { font-size: 12px; color: #333; margin-top: 4px; }

    /* DIVIDER */
    
    .divider-dash {
      border: none;
      border-top: 1px dashed #ddd;
      margin: 0;
    }
    .divider-solid {
      border: none;
      border-top: 1px solid #eee;
      margin: 0;
    }

    /* BODY NOTA */
    .nota-body { padding: 16px 20px; }

    /* INFO */
    .nota-info { margin-bottom: 14px; }
    .nota-info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 0;
      font-size: 13px;
    }
    .nota-info-row .lbl { color: #888; }
    .nota-info-row .val { font-weight: 600; text-align: right; }
    .nota-kode {
  font-size: 11px;
  background: #f0f0f0;
  color: #333;
  padding: 2px 8px;
  border-radius: 99px;
  font-weight: 600;
}

    /* TABEL ITEM */
    .items-header {
      display: grid;
      grid-template-columns: 24px 1fr 60px 70px 70px;
      gap: 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #888;
      padding: 8px 0 6px;
      border-bottom: 1px solid #eee;
    }
    .item-row {
      display: grid;
      grid-template-columns: 24px 1fr 60px 70px 70px;
      gap: 4px;
      padding: 9px 0;
      border-bottom: 1px dashed #f0f0f0;
      font-size: 12px;
      align-items: start;
    }
    .item-row:last-child { border-bottom: none; }
    .item-no { color: #bbb; font-size: 11px; padding-top: 1px; }
    .item-nama { font-weight: 600; line-height: 1.4; }
    .item-satuan { font-size: 10px; color: #999; margin-top: 2px; }
    .item-jml { text-align: center; color: #555; }
    .item-harga { text-align: right; color: #555; }
    .item-total { text-align: right; font-weight: 700; color: #111; }

    /* TOTAL */
    .nota-total {
  margin-top: 14px;
  padding: 12px 14px;
  background: #f5f5f5;
  border-radius: 10px;
  border: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.nota-total-lbl { font-size: 14px; font-weight: 600; color: #333; }
.nota-total-val  { font-size: 22px; font-weight: 800; color: #111; }
    .nota-item-count {
      font-size: 11px;
      color: #999;
      margin-top: 6px;
      text-align: right;
    }

    /* CATATAN */
    .nota-catatan {
      margin-top: 12px;
      padding: 10px 12px;
      background: #fffbf0;
      border: 1px dashed #f0c060;
      border-radius: 8px;
      font-size: 12px;
      color: #666;
    }

    /* FOOTER NOTA */
    .nota-footer {
      padding: 16px 20px;
      text-align: center;
      background: #fafafa;
      border-top: 1px dashed #ddd;
    }
    .nota-footer .thanks {
      font-size: 14px;
      font-weight: 700;
      color: #333;
      margin-bottom: 4px;
    }
    .nota-footer .sub {
      font-size: 11px;
      color: #999;
      line-height: 1.6;
    }
    .nota-footer .bukti {
      margin-top: 8px;
      font-size: 10px;
      color: #bbb;
      font-style: italic;
    }

    /* LIGHT MODE */
    body.light {
      background: #f0f2f5;
    }
    body.light .topbar {
      background: #fff;
      border-bottom: 1px solid #eee;
    }
    body.light .topbar-title { color: #333; }
    body.light .btn-back { color: #333; border-color: #ddd; }
    body.light .btn-back:hover { background: #f5f5f5; }
    body.light .btn-toggle { color: #333; border-color: #ddd; }

    /* PRINT */
    @media print {
  body { background: #fff !important; }
  .topbar { display: none !important; }
  .preview-wrap { padding: 0; }
  .nota-card {
    border-radius: 0;
    box-shadow: none !important; 
    max-width: 100%;
    background: #fff !important;
    color: #111 !important;
  }
  .nota-header {
    background: #fff !important;
    color: #111 !important;
    border-bottom: 2px solid #111 !important;
  }
  .nota-toko,
  .nota-cabang,
  .nota-alamat,
  .nota-wa      { color: #111 !important; }
  .nota-info-row .lbl { color: #888 !important; }
  .nota-info-row .val { color: #111 !important; }
  .nota-kode    { background: #f0f0f0 !important; color: #333 !important; }
  .items-header { color: #888 !important; }
  .item-nama    { color: #111 !important; }
  .item-satuan  { color: #999 !important; }
  .item-jml,
  .item-harga   { color: #555 !important; }
  .item-total   { color: #111 !important; font-weight: 700 !important; }
  .nota-total   { background: #f5f5f5 !important; border: 1px solid #ddd !important; }
  .nota-total-lbl { color: #333 !important; }
  .nota-total-val { color: #111 !important; }
  .nota-item-count { color: #999 !important; }
  .nota-footer  { background: #fafafa !important; border-top: 1px dashed #ddd !important; }
  .nota-footer .thanks { color: #333 !important; }
  .nota-footer .sub    { color: #999 !important; }
  .nota-footer .bukti  { color: #bbb !important; }
  .divider      { border-color: #ddd !important; }
  .divider-solid { border-color: #eee !important; }
}
    [data-theme="dark"] body {
  background: #0f0f13;
}
[data-theme="dark"] .topbar {
  background: #141418;
  border-bottom: 1px solid #2a2b38;
}
[data-theme="dark"] .topbar-title { color: #e8e8f0; }
[data-theme="dark"] .btn-back {
  color: #e8e8f0;
  border-color: #2a2b38;
}
[data-theme="dark"] .btn-back:hover { background: #1c1c22; }
[data-theme="dark"] .btn-toggle {
  color: #e8e8f0;
  border-color: #2a2b38;
}
[data-theme="dark"] .nota-card {
  background: #1c1c22;
  color: #e8e8f0;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6);
}
[data-theme="dark"] .nota-header {
  background: #22222a;
  border-bottom: 2px solid #2a2b38;
  color: #e8e8f0;
}
[data-theme="dark"] .nota-toko  { color: #e8e8f0; }
[data-theme="dark"] .nota-cabang { color: #aaaacc; }
[data-theme="dark"] .nota-alamat { color: #7878a0; }
[data-theme="dark"] .nota-wa     { color: #aaaacc; }
[data-theme="dark"] .nota-logo   { background: #26262e; }
[data-theme="dark"] .divider     { border-color: #2a2b38; }
[data-theme="dark"] .divider-solid { border-color: #2a2b38; }
[data-theme="dark"] .nota-info-row .lbl { color: #8888a8; }
[data-theme="dark"] .nota-info-row .val { color: #e8e8f0; }
[data-theme="dark"] .nota-kode {
  background: #26262e;
  color: #a0aef0;
}
[data-theme="dark"] .items-header { color: #8888a8; border-color: #2a2b38; }
[data-theme="dark"] .item-row     { border-color: #22222a; }
[data-theme="dark"] .item-nama    { color: #e8e8f0; }
[data-theme="dark"] .item-satuan  { color: #5a5a72; }
[data-theme="dark"] .item-jml,
[data-theme="dark"] .item-harga   { color: #8888a8; }
[data-theme="dark"] .item-total   { color: #e8e8f0; }
[data-theme="dark"] .nota-total {
  background: #22222a;
  border-color: #2a2b38;
}
[data-theme="dark"] .nota-total-lbl { color: #8888a8; }
[data-theme="dark"] .nota-total-val { color: #e8e8f0; }
[data-theme="dark"] .nota-item-count { color: #5a5a72; }
[data-theme="dark"] .nota-catatan {
  background: #1e1c14;
  border-color: #3a3820;
  color: #aaaacc;
}
[data-theme="dark"] .nota-footer {
  background: #141418;
  border-color: #2a2b38;
}
[data-theme="dark"] .nota-footer .thanks { color: #e8e8f0; }
[data-theme="dark"] .nota-footer .sub    { color: #8888a8; }
[data-theme="dark"] .nota-footer .bukti  { color: #5a5a72; }

@media (max-width: 480px) {
  .topbar {
    padding: 8px 12px;
  }
  .topbar-title {
    font-size: 13px;
  }
  .btn-back {
    padding: 5px 10px;
    font-size: 12px;
  }
  .btn-toggle {
    padding: 5px 8px;
    font-size: 13px;
  }
  .btn-print {
    padding: 5px 12px;
    font-size: 12px;
  }
  .topbar-actions {
    gap: 5px;
  }
}
  </style>
</head>
<body>

  <div class="topbar">
    <span class="topbar-title">Nota Transaksi</span>
    <div class="topbar-actions">
      <a href="karyawan.php" class="btn-back">← Kembali</a>
      <button class="btn-toggle" onclick="toggleDarkMode()" title="Toggle tema">🌙</button>
      <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
    </div>
  </div>

  <div class="preview-wrap">
    <div class="nota-card">

      <div class="nota-header">
        <img src="assets/mw-removebg-preview.png" alt="Logo" class="nota-logo"/>
        <div class="nota-toko"><?= htmlspecialchars($toko) ?></div>
        <div class="nota-cabang"><?= htmlspecialchars($trx['cabang_nama']) ?></div>
        <?php if (!empty($cabang['alamat'])): ?>
        <div class="nota-alamat"><?= htmlspecialchars($cabang['alamat']) ?></div>
        <?php endif; ?>
      </div>

      <hr class="divider-dash"/>

      <div class="nota-body">

        <div class="nota-info">
          <div class="nota-info-row">
            <span class="lbl">No. Nota</span>
            <span class="nota-kode"><?= htmlspecialchars($trx['kode_nota']) ?></span>
          </div>
          <div class="nota-info-row">
            <span class="lbl">Tanggal</span>
            <span class="val"><?= $tgl ?></span>
          </div>
          <div class="nota-info-row">
            <span class="lbl">Kasir</span>
            <span class="val"><?= htmlspecialchars($trx['user_nama']) ?></span>
          </div>
        </div>

        <hr class="divider-solid"/>

        <div class="items-header">
          <span>#</span>
          <span>Item</span>
          <span style="text-align:center">Jml</span>
          <span style="text-align:right">Harga</span>
          <span style="text-align:right">Total</span>
        </div>

        <?php foreach ($trx['items'] as $i => $item): ?>
        <div class="item-row">
          <span class="item-no"><?= $i + 1 ?></span>
          <div>
            <div class="item-nama"><?= htmlspecialchars($item['bibit_nama']) ?></div>
            <div class="item-satuan"><?= htmlspecialchars($item['satuan_jual']) ?></div>
          </div>
          <span class="item-jml"><?= (float)$item['jumlah_jual'] ?></span>
          <span class="item-harga">Rp <?= number_format($item['harga_satuan'], 0, ',', '.') ?></span>
          <span class="item-total">Rp <?= number_format($item['subtotal'], 0, ',', '.') ?></span>
        </div>
        <?php endforeach; ?>

        <div class="nota-total">
          <span class="nota-total-lbl">TOTAL</span>
          <span class="nota-total-val">Rp <?= $total ?></span>
        </div>
        <div class="nota-item-count"><?= count($trx['items']) ?> item produk</div>

        <?php if (!empty($trx['catatan']) && !str_starts_with($trx['catatan'], 'DIBATALKAN')): ?>
        <div class="nota-catatan">📝 <?= htmlspecialchars($trx['catatan']) ?></div>
        <?php endif; ?>

      </div>

      <div class="nota-footer">
        <div class="thanks">Terima kasih atas pembelian Anda!</div>
        <div class="sub"><?= htmlspecialchars($toko) ?> · WA: <?= htmlspecialchars($wa_fmt) ?></div>
        <div class="bukti">— Simpan nota ini sebagai bukti pembelian —</div>
      </div>

    </div>
  </div>

  <script>
    // Toggle dark/light mode
    // Terapkan tema dari localStorage (sama dengan sistem utama)
(function() {
  const saved = localStorage.getItem('mw-theme') || 'light';
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    const btn = document.querySelector('.btn-toggle');
    if (btn) btn.textContent = '☀️';
  }
})();

function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('mw-theme', newTheme);
  const btn = document.querySelector('.btn-toggle');
  if (btn) btn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
}
  </script>

</body>
</html>