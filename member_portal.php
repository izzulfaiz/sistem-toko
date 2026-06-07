<?php
session_start();
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
  <title>Member Portal — Mekar Wangi Indonesia</title>
  <link rel="icon" href="assets/logo.png" type="image/png">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --amber:   #E8A020;
      --amber-m: #fde9ba;
      --teal:    #0F6E56;
      --teal-l:  #e0f5ef;
      --blue:    #3D52A0;
      --blue-l:  #eef0fb;
      --red:     #A32D2D;
      --red-l:   #fff0f0;
      --green:   #1a7a4a;
      --text:    #1a1916;
      --text2:   #888780;
      --border:  #e5e3dc;
      --bg:      #f8f7f4;
      --bg2:     #f0ede6;
      --card:    #ffffff;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding-bottom: 40px;
    }

    /* ---- TOPBAR ---- */
    .topbar {
      background: var(--blue);
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .topbar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #fff;
    }
    .topbar-brand img {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: rgba(255,255,255,0.15);
      padding: 3px;
      object-fit: contain;
    }
    .topbar-brand span {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -.3px;
    }
    .topbar-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .member-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--amber);
      color: #fff;
      font-size: 15px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-logout {
      background: rgba(255,255,255,0.15);
      border: none;
      color: #fff;
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-logout:hover { background: rgba(255,255,255,0.25); }

    /* ---- WRAPPER ---- */
    .page { max-width: 480px; margin: 0 auto; padding: 16px; }

    /* ---- CARD ---- */
    .card {
      background: var(--card);
      border: 0.5px solid var(--border);
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 14px;
    }
    .card-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text2);
      text-transform: uppercase;
      letter-spacing: .5px;
      margin-bottom: 12px;
    }

    /* ---- LOGIN SCREEN ---- */
    .login-wrap {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 20px;
    }
    .login-logo {
      width: 72px;
      height: 72px;
      border-radius: 18px;
      background: var(--blue);
      padding: 8px;
      object-fit: contain;
      margin-bottom: 16px;
    }
    .login-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--blue);
      margin-bottom: 4px;
    }
    .login-sub {
      font-size: 13px;
      color: var(--text2);
      margin-bottom: 32px;
      text-align: center;
    }
    .login-card {
      width: 100%;
      max-width: 380px;
      background: var(--card);
      border: 0.5px solid var(--border);
      border-radius: 16px;
      padding: 24px;
    }
    .login-card label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 6px;
      color: var(--text);
    }
    .login-card input {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 16px;
      font-family: inherit;
      background: var(--bg);
      color: var(--text);
      outline: none;
      transition: border-color .15s;
    }
    .login-card input:focus { border-color: var(--blue); background: #fff; }
    .btn-login {
      width: 100%;
      padding: 13px;
      margin-top: 16px;
      background: var(--blue);
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: opacity .15s;
    }
    .btn-login:hover   { opacity: .9; }
    .btn-login:active  { opacity: .8; }
    .btn-login:disabled { opacity: .5; cursor: not-allowed; }
    .login-err {
      margin-top: 10px;
      padding: 10px 12px;
      background: var(--red-l);
      color: var(--red);
      border-radius: 8px;
      font-size: 13px;
      display: none;
    }
    .login-note {
      font-size: 12px;
      color: var(--text2);
      text-align: center;
      margin-top: 16px;
    }

    /* ---- HERO / HERO STAMP ---- */
    .hero {
      background: linear-gradient(135deg, var(--blue) 0%, #5a6fc0 100%);
      border-radius: 16px;
      padding: 20px;
      color: #fff;
      margin-bottom: 14px;
      position: relative;
      overflow: hidden;
    }
    .hero::after {
      content: '';
      position: absolute;
      right: -20px;
      top: -20px;
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: rgba(255,255,255,0.07);
    }
    .hero-greeting { font-size: 13px; opacity: .8; margin-bottom: 3px; }
    .hero-nama     { font-size: 20px; font-weight: 700; margin-bottom: 14px; }
    .hero-stats    { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .hero-stat     { text-align: center; background: rgba(255,255,255,0.12); border-radius: 10px; padding: 10px 6px; }
    .hero-stat-val { font-size: 22px; font-weight: 700; }
    .hero-stat-lbl { font-size: 10px; opacity: .75; margin-top: 2px; }

    /* ---- STAMP PROGRESS ---- */
    .stamp-section { margin-bottom: 14px; }
    .stamp-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .stamp-title { font-size: 14px; font-weight: 600; }
    .stamp-count { font-size: 13px; color: var(--amber); font-weight: 700; }

    .stamp-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    .stamp-box {
      aspect-ratio: 1;
      border-radius: 10px;
      border: 1.5px solid var(--border);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 600;
      color: var(--text2);
      background: var(--bg);
      position: relative;
      transition: all .2s;
    }
    .stamp-box.filled {
      background: var(--amber-m);
      border-color: var(--amber);
      color: var(--amber);
    }
    .stamp-box.filled .stamp-icon { font-size: 18px; }
    .stamp-box.reward-mark {
      background: var(--blue-l);
      border-color: var(--blue);
      color: var(--blue);
    }
    .stamp-box .stamp-num {
      font-size: 9px;
      opacity: .6;
      margin-top: 1px;
    }
    .stamp-progress-info {
      font-size: 12px;
      color: var(--text2);
      text-align: center;
      padding: 8px;
      background: var(--bg2);
      border-radius: 8px;
    }
    .stamp-progress-info strong { color: var(--amber); }

    /* ---- REWARD LIST ---- */
    .reward-item {
      border: 0.5px solid var(--border);
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 8px;
    }
    .reward-item:last-child { margin-bottom: 0; }
    .reward-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .reward-title { font-size: 13px; font-weight: 600; }
    .reward-date  { font-size: 11px; color: var(--text2); }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-pending  { background: var(--amber-m); color: #7a4f00; }
    .badge-redeemed { background: var(--teal-l); color: var(--teal); }
    .badge-cancelled{ background: var(--bg2); color: var(--text2); }
    .reward-nominal {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .reward-nominal-item {
      text-align: center;
      padding: 8px;
      background: var(--bg2);
      border-radius: 8px;
    }
    .reward-nominal-val { font-size: 14px; font-weight: 700; color: var(--blue); }
    .reward-nominal-lbl { font-size: 10px; color: var(--text2); margin-top: 1px; }

    /* ---- RIWAYAT TRANSAKSI ---- */
    .trx-item {
      border: 0.5px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    .trx-item:last-child { margin-bottom: 0; }
    .trx-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: var(--bg2);
      cursor: pointer;
      gap: 10px;
    }
    .trx-kode { font-size: 12px; font-weight: 600; }
    .trx-meta { font-size: 11px; color: var(--text2); margin-top: 1px; }
    .trx-right { text-align: right; flex-shrink: 0; }
    .trx-total { font-size: 13px; font-weight: 700; color: var(--teal); }
    .trx-stamp { font-size: 11px; color: var(--amber); }
    .trx-body { padding: 10px 12px; display: none; }
    .trx-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      padding: 5px 0;
      border-bottom: 0.5px solid var(--border);
      gap: 8px;
    }
    .trx-row:last-child { border-bottom: none; }
    .trx-row-nama { color: var(--text); }
    .trx-row-nominal { font-weight: 500; color: var(--text2); white-space: nowrap; }
    .trx-stamp-badge {
      font-size: 10px;
      background: var(--amber-m);
      color: #7a4f00;
      padding: 1px 6px;
      border-radius: 99px;
      margin-left: 4px;
    }

    /* ---- QR CODE ---- */
    .qr-section { text-align: center; }
    .qr-wrap {
      display: inline-block;
      background: #fff;
      padding: 14px;
      border-radius: 12px;
      border: 1px solid var(--border);
      margin: 10px auto;
    }
    .qr-code-text {
      font-size: 12px;
      color: var(--text2);
      font-family: monospace;
      letter-spacing: 1px;
      margin-top: 6px;
    }
    .qr-hint { font-size: 12px; color: var(--text2); margin-top: 8px; line-height: 1.5; }

    /* ---- INFO MEMBER ---- */
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 9px 0;
      border-bottom: 0.5px solid var(--border);
      font-size: 13px;
      gap: 10px;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: var(--text2); flex-shrink: 0; }
    .info-value { font-weight: 500; text-align: right; }

    /* ---- LOADING / EMPTY ---- */
    .loading {
      text-align: center;
      padding: 32px;
      color: var(--text2);
      font-size: 13px;
    }
    .loading::before {
      content: '';
      display: block;
      width: 28px;
      height: 28px;
      border: 2.5px solid var(--border);
      border-top-color: var(--blue);
      border-radius: 50%;
      animation: spin .7s linear infinite;
      margin: 0 auto 10px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty {
      text-align: center;
      padding: 24px;
      color: var(--text2);
      font-size: 13px;
    }

    /* ---- SECTION TITLE ---- */
    .section-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text2);
      text-transform: uppercase;
      letter-spacing: .5px;
      margin: 20px 0 10px;
    }

    /* ---- CHEVRON ---- */
    .chevron {
      width: 16px;
      height: 16px;
      transition: transform .2s;
      color: var(--text2);
      flex-shrink: 0;
    }
    .chevron.open { transform: rotate(180deg); }
  </style>
</head>
<body>

<!-- ================================================
     LOGIN SCREEN
     ================================================ -->
<div id="screen-login" class="login-wrap">
  <img src="assets/logo.png" alt="MW" class="login-logo"/>
  <div class="login-title">Member Portal</div>
  <div class="login-sub">Mekar Wangi Indonesia<br/>Lihat poin stamp & reward kamu</div>

  <div class="login-card">
    <label for="input-hp">Nomor HP Terdaftar</label>
    <input type="tel" id="input-hp" placeholder="Contoh: 08123456789"
      inputmode="numeric" autocomplete="tel"
      onkeydown="if(event.key==='Enter') doLogin()"/>
    <button class="btn-login" id="btn-login" onclick="doLogin()">Masuk</button>
    <div class="login-err" id="login-err"></div>
    <div class="login-note">Masukkan no HP yang kamu daftarkan ke kasir</div>
  </div>
</div>

<!-- ================================================
     PORTAL SCREEN
     ================================================ -->
<div id="screen-portal" style="display:none">

  <!-- Topbar -->
  <div class="topbar">
    <div class="topbar-brand">
      <img src="assets/logo.png" alt="MW"/>
      <span>Member Portal</span>
    </div>
    <div class="topbar-right">
      <div class="member-avatar" id="portal-avatar">?</div>
      <button class="btn-logout" onclick="doLogout()">Keluar</button>
    </div>
  </div>

  <!-- Content -->
  <div class="page" id="portal-content">
    <div class="loading">Memuat data...</div>
  </div>

</div>

<script>
// ================================================
// CONFIG
// ================================================
const BASE_URL = (() => {
  const p = window.location.pathname;
  return p.substring(0, p.lastIndexOf('/'));
})();
const API = BASE_URL + '/api/member_portal.php';

// ================================================
// INIT
// ================================================
window.addEventListener('DOMContentLoaded', async () => {
  // Cek session
  try {
    const res = await fetch(`${API}?action=check_session`);
    const data = await res.json();
    if (data.logged_in) {
      showPortal(data.member);
    } else {
      showLogin();
    }
  } catch(e) {
    showLogin();
  }
});

// ================================================
// LOGIN
// ================================================
function showLogin() {
  document.getElementById('screen-login').style.display = 'flex';
  document.getElementById('screen-portal').style.display = 'none';
  setTimeout(() => document.getElementById('input-hp').focus(), 100);
}

async function doLogin() {
  const no_hp  = document.getElementById('input-hp').value.trim();
  const errEl  = document.getElementById('login-err');
  const btnEl  = document.getElementById('btn-login');

  errEl.style.display = 'none';
  if (!no_hp) {
    errEl.textContent = 'Masukkan nomor HP terlebih dahulu';
    errEl.style.display = 'block';
    return;
  }

  btnEl.disabled    = true;
  btnEl.textContent = 'Memuat...';

  try {
    const res  = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', no_hp }),
    });
    const data = await res.json();

    if (data.success) {
      showPortal(data.member);
    } else {
      errEl.textContent    = data.message || 'No HP tidak terdaftar';
      errEl.style.display  = 'block';
    }
  } catch(e) {
    errEl.textContent   = 'Gagal terhubung ke server';
    errEl.style.display = 'block';
  } finally {
    btnEl.disabled    = false;
    btnEl.textContent = 'Masuk';
  }
}

// ================================================
// LOGOUT
// ================================================
async function doLogout() {
  await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'logout' }),
  });
  showLogin();
}

// ================================================
// PORTAL
// ================================================
function showPortal(member) {
  document.getElementById('screen-login').style.display  = 'none';
  document.getElementById('screen-portal').style.display = 'block';

  // Avatar inisial
  const av = document.getElementById('portal-avatar');
  if (av) av.textContent = member.nama.charAt(0).toUpperCase();

  loadPortalData();
}

async function loadPortalData() {
  const content = document.getElementById('portal-content');
  content.innerHTML = '<div class="loading">Memuat data...</div>';

  try {
    const res  = await fetch(`${API}?action=my_data`);
    const data = await res.json();

    if (!data.success) {
      if (res.status === 401) { showLogin(); return; }
      content.innerHTML = '<div class="empty">Gagal memuat data</div>';
      return;
    }

    renderPortal(data);
  } catch(e) {
    content.innerHTML = '<div class="empty">Gagal terhubung ke server</div>';
  }
}

// ================================================
// RENDER
// ================================================
function renderPortal(data) {
  const { member, rewards, riwayat, stats } = data;
  const content = document.getElementById('portal-content');

  content.innerHTML = `
    ${renderHero(member, stats, rewards.filter(r => r.status === 'redeemed').length)}
    ${renderRewards(rewards)}
    ${renderQR(member)}
    ${renderRiwayat(riwayat, rewards)}  
    ${renderInfoMember(member)}
  `;

  generateQR('portal-qr-wrap', member.qr_code);


}

// ---- Hero ----
function renderHero(member, stats, rewardPending) {
  const stampMod = member.stamp_available % 10;
  const pct      = (stampMod / 10) * 100;
  return `
    <div class="hero">
      <div class="hero-greeting">Selamat datang 👋</div>
      <div class="hero-nama">${esc(member.nama)}</div>

      <!-- Progress utama -->
      <div style="background:rgba(255,255,255,0.12);border-radius:10px;padding:12px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:12px;opacity:.85">Menuju reward berikutnya</span>
          <span style="font-size:20px;font-weight:700;color:#fde9ba">${stampMod}/10</span>
        </div>
        <div style="height:8px;background:rgba(255,255,255,0.2);border-radius:99px;overflow:hidden;margin-bottom:6px">
          <div style="height:100%;background:#fde9ba;border-radius:99px;width:${pct}%"></div>
        </div>
        <div style="font-size:11px;opacity:.7">${10 - stampMod} stamp lagi untuk dapat reward</div>
      </div>

      <!-- Info sekunder -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="text-align:center;background:rgba(255,255,255,0.12);border-radius:8px;padding:8px 4px">
          <div style="font-size:16px;font-weight:700">${member.total_stamp}</div>
          <div style="font-size:10px;opacity:.75">Total sejak daftar</div>
        </div>
        <div style="text-align:center;background:rgba(255,255,255,0.12);border-radius:8px;padding:8px 4px">
          <div style="font-size:16px;font-weight:700;color:${rewardPending > 0 ? '#fde9ba' : '#fff'}">${rewardPending}</div>
          <div style="font-size:10px;opacity:.75">Reward tersedia 🎁</div>
        </div>
      </div>
    </div>`;
}

// ---- Stamp Progress ----
function renderStampProgress(member) {
  const stampMod   = member.stamp_available % 10;
  const sisaStamp  = 10 - stampMod;

  // Render 10 kotak stamp
  let boxes = '';
  for (let i = 1; i <= 10; i++) {
    const filled = i <= stampMod;
    boxes += `
      <div class="stamp-box ${filled ? 'filled' : ''}">
        ${filled
          ? `<span class="stamp-icon">🎫</span>`
          : `<span style="font-size:16px;opacity:.2">○</span>`}
        <span class="stamp-num">${i}</span>
      </div>`;
  }

  const msg = stampMod === 0
    ? 'Kumpulkan 10 stamp untuk dapat reward!'
    : sisaStamp === 1
    ? '<strong>1 stamp lagi</strong> untuk dapat reward! 🎉'
    : `<strong>${sisaStamp} stamp lagi</strong> menuju reward berikutnya`;

  return `
    <div class="card">
      <div class="stamp-header">
        <div class="stamp-title">Progress Stamp</div>
        <div class="stamp-count">${stampMod}/10</div>
      </div>
      <div class="stamp-grid">${boxes}</div>
      <div class="stamp-progress-info">${msg}</div>
    </div>`;
}

// ---- Rewards ----
function renderRewards(rewards) {
  if (!rewards.length) {
    return `
      <div class="section-title">Reward</div>
      <div class="card">
        <div class="empty" style="padding:16px">Belum ada reward. Kumpulkan 10 stamp untuk mendapatkan reward!</div>
      </div>`;
  }

  const items = rewards.map((r, idx) => {
    const nomorReward = Math.floor(parseInt(r.stamp_snapshot) / 10);
    const statusBadge =
      r.status === 'pending'
        ? `<span class="badge badge-pending">🎁 Bisa Ditukar</span>`
        : r.status === 'redeemed'
        ? `<span class="badge badge-redeemed">✓ Sudah Ditukar</span>`
        : `<span class="badge badge-cancelled">Dibatalkan</span>`;

    const tgl = new Date(r.created_at).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric'
    });

    const redeemInfo = r.status === 'redeemed' && r.bibit_nama
      ? `<div style="margin-top:8px;padding:8px 10px;background:var(--teal-l);border-radius:8px;font-size:12px;color:var(--teal)">
           Ditukar dengan: <strong>${esc(r.bibit_nama)}</strong>
           ${r.redeemed_by_nama ? ' · oleh ' + esc(r.redeemed_by_nama) : ''}
         </div>`
      : '';

    const pendingInfo = r.status === 'pending'
      ? `<div style="margin-top:8px;padding:8px 10px;background:var(--amber-m);border-radius:8px;font-size:12px;color:#7a4f00">
           Tunjukkan halaman ini ke kasir untuk menukar reward kamu! 😊
         </div>`
      : '';

    return `
      <div class="reward-item">
        <div class="reward-head">
          <div>
            <div class="reward-title">Reward ke-${nomorReward}</div>
            <div class="reward-date">${tgl}</div>
          </div>
          ${statusBadge}
        </div>
        <div class="reward-nominal">
          <div class="reward-nominal-item">
            <div class="reward-nominal-val">Rp ${parseFloat(r.rata_nominal || 0).toLocaleString('id-ID')}</div>
            <div class="reward-nominal-lbl">Rata-rata / stamp</div>
          </div>
          <div class="reward-nominal-item">
            <div class="reward-nominal-val">Rp ${parseFloat(r.total_nominal || 0).toLocaleString('id-ID')}</div>
            <div class="reward-nominal-lbl">Total 10 stamp</div>
          </div>
        </div>
        ${pendingInfo}
        ${redeemInfo}
      </div>`;
  }).join('');

  return `
    <div class="section-title">Reward Kamu</div>
    <div class="card">${items}</div>`;
}

// ---- QR Code ----
function renderQR(member) {
  return `
    <div class="section-title">QR Code Member</div>
    <div class="card">
      <div class="qr-section">
        <div class="qr-wrap" id="portal-qr-wrap"></div>
        <div class="qr-code-text">${esc(member.qr_code)}</div>
        <div class="qr-hint">
          Tunjukkan QR ini ke kasir saat belanja<br/>agar stamp kamu tercatat otomatis
        </div>
      </div>
    </div>`;
}

// ---- Riwayat Transaksi ----
function renderRiwayat(riwayat, rewards) {
  if (!riwayat.length) {
    return `
      <div class="section-title">Riwayat Transaksi</div>
      <div class="card"><div class="empty" style="padding:16px">Belum ada transaksi</div></div>`;
  }

  // Kelompokkan per siklus — transaksi lintas siklus masuk ke SEMUA siklus yang dilintasi
  const siklus = {};
  riwayat.forEach(t => {
    const stampMin = parseInt(t.stamp_ke_min || 0);
    const stampMax = parseInt(t.stamp_ke_max || 0);

    if (stampMin === 0 && stampMax === 0) {
      if (!siklus['0']) siklus['0'] = { trxs: [] };
      siklus['0'].trxs.push(t);
      return;
    }

    const siklusMin = Math.ceil(stampMin / 10);
    const siklusMax = Math.ceil(stampMax / 10);

    for (let n = siklusMin; n <= siklusMax; n++) {
      if (!siklus[n]) {
        siklus[n] = {
          nomor:      n,
          stamp_dari: (n - 1) * 10 + 1,
          stamp_ke:   n * 10,
          trxs:       [],
        };
      }
      if (!siklus[n].trxs.find(x => x.id === t.id)) {
        siklus[n].trxs.push(t);
      }
    }
  });

  const sortedSiklus = Object.values(siklus)
    .filter(s => s.nomor)
    .sort((a, b) => b.nomor - a.nomor);

  const rewardTrxs = siklus['0']?.trxs.filter(t => t.kode_nota.startsWith('REWARD-')) || [];

  const cards = sortedSiklus.map(s => {
    const reward = rewards.find(r => parseInt(r.stamp_snapshot) === s.stamp_ke);

    const allStampKe = [];
    s.trxs.forEach(t => {
      const min = parseInt(t.stamp_ke_min || 0);
      const max = parseInt(t.stamp_ke_max || 0);
      for (let i = min; i <= max; i++) allStampKe.push(i);
    });
    const stampDiSiklus = [...new Set(allStampKe)].filter(
      k => k >= s.stamp_dari && k <= s.stamp_ke
    ).length;
    const isComplete = stampDiSiklus >= 10;

    let headerBg, headerColor, statusLabel;
    if (reward?.status === 'redeemed') {
      headerBg    = 'var(--teal-l)';
      headerColor = 'var(--teal)';
      statusLabel = `<span style="font-size:11px;background:var(--teal-l);color:var(--teal);padding:2px 8px;border-radius:99px;font-weight:600;border:0.5px solid #9fe1cb">✓ Reward Ditukar</span>`;
    } else if (reward?.status === 'pending') {
      headerBg    = '#fffbe6';
      headerColor = '#7a4f00';
      statusLabel = `<span style="font-size:11px;background:var(--amber-m);color:#7a4f00;padding:2px 8px;border-radius:99px;font-weight:600">🎁 Reward Tersedia!</span>`;
    } else if (isComplete) {
      headerBg    = 'var(--blue-l)';
      headerColor = 'var(--blue)';
      statusLabel = `<span style="font-size:11px;background:var(--blue-l);color:var(--blue);padding:2px 8px;border-radius:99px;font-weight:600">✓ Lengkap</span>`;
    } else {
      headerBg    = 'var(--bg2)';
      headerColor = 'var(--text)';
      statusLabel = `<span style="font-size:11px;background:var(--bg2);color:var(--text2);padding:2px 8px;border-radius:99px;font-weight:600;border:0.5px solid var(--border)">${stampDiSiklus}/10 stamp</span>`;
    }

    let miniGrid = '';
    for (let i = 1; i <= 10; i++) {
      const globalKe = s.stamp_dari + i - 1;
      const filled   = allStampKe.includes(globalKe);
      miniGrid += `<div style="width:100%;aspect-ratio:1;border-radius:6px;
        background:${filled ? 'var(--amber)' : 'var(--bg)'};
        border:1px solid ${filled ? 'var(--amber)' : 'var(--border)'};
        display:flex;align-items:center;justify-content:center;font-size:10px">
        ${filled ? '🎫' : ''}
      </div>`;
    }

    const rewardInfo = reward
      ? reward.status === 'pending'
        ? `<div style="margin-top:10px;padding:10px 12px;background:var(--amber-m);
            border-radius:8px;font-size:12px;color:#7a4f00;text-align:center">
            🎁 Kamu punya reward! Tunjukkan halaman ini ke kasir untuk menukarnya.
          </div>`
        : reward.status === 'redeemed'
        ? `<div style="margin-top:10px;padding:10px 12px;background:var(--teal-l);
            border-radius:8px;font-size:12px;color:var(--teal)">
            ✓ Reward sudah ditukar dengan <strong>${esc(reward.bibit_nama || '-')}</strong>
          </div>`
        : ''
      : '';

    const trxRows = s.trxs.map(t => {
      const tgl        = new Date(t.created_at).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
      const jam        = t.created_at.split(' ')[1]?.substring(0, 5) || '';
      const isReward   = t.kode_nota.startsWith('REWARD-');
      const stampCount = parseInt(t.stamp_didapat || 0);
      const itemsPerReward = t.items_per_reward || {};

      // Hitung nominal hanya untuk stamp yang masuk siklus ini
      const nominalSiklus = (() => {
        let total = 0;
        Object.values(itemsPerReward).forEach(groupItems => {
          groupItems.forEach(item => {
            const stampKe = parseInt(item.stamp_ke || 0);
            if (stampKe >= s.stamp_dari && stampKe <= s.stamp_ke) {
              total += parseFloat(item.subtotal || 0);
            }
          });
        });
        return total;
      })();

      const rewardGroups = Object.keys(itemsPerReward);

      const groupedHTML = rewardGroups.map(groupKey => {
        const groupItems    = itemsPerReward[groupKey];
        const isProgress    = groupKey === 'progress';

        const filteredItems = groupItems.filter(item => {
          const stampKe = parseInt(item.stamp_ke || 0);
          return stampKe >= s.stamp_dari && stampKe <= s.stamp_ke;
        });
        if (!filteredItems.length) return '';

        const groupLabel = isProgress
          ? `<span style="font-size:10px;color:var(--text2);font-style:italic">Progress reward berikutnya</span>`
          : '';

        const itemRows = filteredItems.map(item => {
          if (item.is_mix) {
            return `
              <div style="padding:5px 0 5px 10px;border-left:2px solid var(--amber-m);margin:3px 0">
                <div style="font-size:11px;font-weight:600;color:var(--amber)">🎫 Mix (stamp ke-${item.stamp_ke})</div>
                <div style="display:flex;justify-content:space-between">
                  <div style="font-size:11px;color:var(--text2)">${item.items ? item.items.join(' + ') : ''}</div>
                  <div style="font-size:11px;font-weight:600;white-space:nowrap;margin-left:8px">Rp ${parseFloat(item.subtotal).toLocaleString('id-ID')}</div>
                </div>
              </div>`;
          } else {
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;
                padding:5px 0 5px 10px;border-left:2px solid ${isProgress ? 'var(--blue)' : 'var(--teal)'};
                margin:3px 0;gap:8px">
                <div>
                  <div style="font-size:11px;font-weight:500">${esc(item.bibit_nama)}
                    <span style="font-size:9px;color:var(--text2)">#${item.stamp_ke}</span>
                  </div>
                  <div style="font-size:10px;color:var(--text2)">${item.jumlah} ${esc(item.satuan)}</div>
                </div>
                <div style="font-size:11px;font-weight:600;white-space:nowrap">
                  Rp ${parseFloat(item.subtotal).toLocaleString('id-ID')}
                </div>
              </div>`;
          }
        }).join('');

        return `
          <div style="margin-bottom:6px">
            ${groupLabel}
            ${itemRows}
          </div>`;
      }).filter(Boolean).join('<hr style="border:none;border-top:0.5px dashed var(--border);margin:6px 0"/>');

      return `
        <div style="border:0.5px solid var(--border);border-radius:8px;margin-bottom:6px;overflow:hidden">
          <div style="display:flex;justify-content:space-between;align-items:center;
            padding:8px 10px;background:var(--bg2);gap:8px;cursor:pointer"
            onclick="toggleTrxDetail('ptd-${s.nomor}-${t.id}', this)">
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600">${esc(t.kode_nota)}</div>
              <div style="font-size:10px;color:var(--text2)">${tgl} · ${jam} · ${esc(t.cabang_nama)}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:12px;font-weight:700;color:${isReward ? 'var(--amber)' : 'var(--teal)'}">
                ${isReward ? '🎁 Reward' : 'Rp ' + nominalSiklus.toLocaleString('id-ID')}
              </div>
              ${stampCount > 0 ? `<div style="font-size:10px;color:var(--amber)">+${stampCount} 🎫</div>` : ''}
            </div>
            <svg id="pchv-${s.nomor}-${t.id}"
              style="width:14px;height:14px;flex-shrink:0;transition:transform .2s;color:var(--text2)"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </div>
          <div id="ptd-${s.nomor}-${t.id}" style="display:none;padding:8px 10px">
            ${groupedHTML || '<div style="font-size:11px;color:var(--text2)">-</div>'}
          </div>
        </div>`;
    }).join('');

    return `
      <div style="background:var(--card);border:0.5px solid var(--border);
        border-radius:14px;margin-bottom:14px;overflow:hidden">
        <div style="padding:12px 14px;background:${headerBg};border-bottom:0.5px solid var(--border)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px">
            <div style="font-size:14px;font-weight:700;color:${headerColor}">
              Siklus ${s.nomor}
              <span style="font-size:11px;font-weight:400;color:var(--text2);margin-left:4px">
                (stamp ${s.stamp_dari}–${s.stamp_ke})
              </span>
            </div>
            ${statusLabel}
          </div>
          <div style="display:grid;grid-template-columns:repeat(10,1fr);gap:4px">${miniGrid}</div>
          ${rewardInfo}
        </div>
        <div style="padding:10px 12px">
          <div style="font-size:11px;font-weight:600;color:var(--text2);
            text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">
            ${s.trxs.length} Transaksi
          </div>
          ${trxRows}
        </div>
      </div>`;
  }).join('');

  const rewardTrxCard = rewardTrxs.length
    ? `<div style="background:var(--card);border:0.5px solid var(--border);
        border-radius:14px;margin-bottom:14px;overflow:hidden">
        <div style="padding:10px 14px;background:var(--teal-l);border-bottom:0.5px solid var(--border);
          display:flex;align-items:center;gap:8px">
          <span style="font-size:16px">🎁</span>
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--teal)">Riwayat Penukaran Reward</div>
            <div style="font-size:11px;color:var(--teal);opacity:.7;margin-top:1px">${rewardTrxs.length} penukaran</div>
          </div>
        </div>
        <div style="padding:10px 12px">
          ${rewardTrxs.map(t => {
            const tgl = new Date(t.created_at).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
            const jam = t.created_at.split(' ')[1]?.substring(0, 5) || '';
const detailRows = (t.items || []).map(item => `
  <div style="display:flex;justify-content:space-between;align-items:center;
    font-size:11px;padding:6px 0;border-bottom:0.5px solid var(--border);gap:8px">
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:500">${esc(item.bibit_nama)}</div>
      <div style="font-size:10px;color:var(--text2);margin-top:1px">
        ${parseFloat(item.jumlah_jual)} ${esc(item.satuan_jual)} · Gratis 🎁
      </div>
    </div>
    <span style="font-size:12px;font-weight:700;color:var(--teal);white-space:nowrap">Gratis</span>
  </div>`).join('');
            return `
              <div style="border:0.5px solid var(--border);border-radius:8px;margin-bottom:6px;overflow:hidden">
                <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:8px 10px;background:var(--bg2);cursor:pointer;gap:8px"
                  onclick="toggleTrxDetail('ptd-reward-${t.id}', this)">
                  <div style="flex:1;min-width:0">
                    <div style="font-size:12px;font-weight:600">${esc(t.kode_nota)}</div>
                    <div style="font-size:10px;color:var(--text2)">${tgl} · ${jam} · ${esc(t.cabang_nama)}</div>
                  </div>
                  <div style="font-size:12px;font-weight:700;color:var(--amber)">🎁 Reward Ditukar</div>
                  <svg id="pchv-reward-${t.id}"
                    style="width:14px;height:14px;flex-shrink:0;transition:transform .2s;color:var(--text2)"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </div>
                <div id="ptd-reward-${t.id}" style="display:none;padding:8px 10px">
                  ${detailRows || '<div style="font-size:11px;color:var(--text2)">-</div>'}
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`
    : '';

  return `
    <div class="section-title">Riwayat Transaksi</div>
    ${cards}
    ${rewardTrxCard}`;
}

function toggleTrxDetail(id, headerEl) {
  const body = document.getElementById(id);
  if (!body) return;
  const isOpen = body.style.display === 'block';
  body.style.display = isOpen ? 'none' : 'block';
  const chvId = id.replace(/^ptd-/, 'pchv-');
  const chv   = document.getElementById(chvId);
  if (chv) chv.style.transform = isOpen ? '' : 'rotate(180deg)';
}
// ---- Info Member ----
function renderInfoMember(member) {
  const tglDaftar = new Date(member.created_at).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  return `
    <div class="section-title">Info Akun</div>
    <div class="card">
      <div class="info-row">
        <span class="info-label">Nama</span>
        <span class="info-value">${esc(member.nama)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">No HP</span>
        <span class="info-value">${esc(member.no_hp)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Cabang Asal</span>
        <span class="info-value">${esc(member.cabang_asal_nama || '-')}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Terdaftar Sejak</span>
        <span class="info-value">${tglDaftar}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Total Belanja</span>
        <span class="info-value" style="color:var(--teal)">Rp ${parseFloat(member.total_belanja || 0).toLocaleString('id-ID')}</span>
      </div>
    </div>
    <div style="height:20px"></div>`;
}

// ================================================
// QR CODE GENERATOR
// ================================================
async function generateQR(elementId, text) {
  if (!window.QRCode) {
    await new Promise((resolve, reject) => {
      const s  = document.createElement('script');
      s.src    = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      s.onload = resolve;
      s.onerror= reject;
      document.head.appendChild(s);
    });
  }
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = '';
  new QRCode(el, {
    text,
    width: 160,
    height: 160,
    correctLevel: QRCode.CorrectLevel.M,
  });
}

// ================================================
// HELPER
// ================================================
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
</script>

</body>
</html>