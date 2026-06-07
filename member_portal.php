<?php
session_start();
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <title>Member — Mekar Wangi</title>
  <link rel="icon" href="assets/logo.png" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --blue:      #3D52A0;
      --blue-mid:  #5468B8;
      --blue-l:    #EEF1FA;
      --blue-ll:   #F5F7FD;
      --pink:      #C2185B;
      --pink-mid:  #D63A75;
      --pink-l:    #FCE4EC;
      --pink-ll:   #FEF0F5;
      --amber:     #E8A020;
      --amber-l:   #FEF3DC;
      --teal:      #0F6E56;
      --teal-l:    #E0F5EF;
      --text:      #1C1C2E;
      --text2:     #6B6B80;
      --text3:     #A0A0B0;
      --border:    #E8E8F0;
      --bg:        #F7F8FC;
      --card:      #FFFFFF;
      --nav-h:     64px;
      --top-h:     56px;
    }

    html, body {
      height: 100%;
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg);
      color: var(--text);
      -webkit-font-smoothing: antialiased;
    }

    /* ── TOPBAR ── */
    .topbar {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: var(--top-h);
      background: var(--blue);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      z-index: 100;
      box-shadow: 0 2px 12px rgba(61,82,160,0.18);
    }
    .topbar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #fff;
    }
    .topbar-brand img {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      object-fit: contain;
      background: rgba(255,255,255,0.15);
      padding: 3px;
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
    .member-chip {
      display: flex;
      align-items: center;
      gap: 7px;
      background: rgba(255,255,255,0.15);
      border-radius: 99px;
      padding: 5px 12px 5px 6px;
    }
    .member-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--pink-mid);
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .member-chip-name {
      font-size: 13px;
      font-weight: 600;
      color: #fff;
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .btn-logout {
      background: rgba(255,255,255,0.15);
      border: none;
      color: rgba(255,255,255,0.85);
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 8px;
      cursor: pointer;
      font-family: inherit;
      font-weight: 500;
      transition: background .15s;
    }
    .btn-logout:hover { background: rgba(255,255,255,0.25); }

    /* ── SCROLL AREA ── */
    .page-wrap {
      position: fixed;
      top: var(--top-h);
      bottom: var(--nav-h);
      left: 0; right: 0;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    .page {
      max-width: 480px;
      margin: 0 auto;
      padding: 16px 14px 8px;
    }

    /* ── BOTTOM NAV ── */
    .bottom-nav {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      height: var(--nav-h);
      background: var(--card);
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      z-index: 100;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.06);
    }
    .nav-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 8px 0;
      border: none;
      background: none;
      cursor: pointer;
      color: var(--text3);
      font-family: inherit;
      transition: color .15s;
      position: relative;
    }
    .nav-btn svg {
      width: 22px;
      height: 22px;
      transition: transform .2s;
    }
    .nav-btn span {
      font-size: 11px;
      font-weight: 500;
    }
    .nav-btn.active {
      color: var(--blue);
    }
    .nav-btn.active svg {
      transform: translateY(-1px);
    }
    .nav-btn.active::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 24px;
      height: 3px;
      background: var(--blue);
      border-radius: 99px 99px 0 0;
    }

    /* ── LOGIN ── */
    .login-wrap {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 20px;
      background: linear-gradient(160deg, var(--blue-ll) 0%, var(--pink-ll) 100%);
    }
    .login-card {
      width: 100%;
      max-width: 360px;
      background: var(--card);
      border-radius: 20px;
      padding: 28px 24px;
      box-shadow: 0 8px 40px rgba(61,82,160,0.12);
    }
    .login-logo-wrap {
      text-align: center;
      margin-bottom: 24px;
    }
    .login-logo-wrap img {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      object-fit: contain;
      background: var(--blue);
      padding: 8px;
      margin-bottom: 12px;
    }
    .login-title {
      font-size: 20px;
      font-weight: 700;
      color: var(--blue);
      margin-bottom: 3px;
    }
    .login-sub {
      font-size: 13px;
      color: var(--text2);
    }
    .login-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 8px;
    }
    .login-input {
      width: 100%;
      padding: 13px 14px;
      border: 1.5px solid var(--border);
      border-radius: 12px;
      font-size: 16px;
      font-family: inherit;
      background: var(--bg);
      color: var(--text);
      outline: none;
      transition: border-color .15s, box-shadow .15s;
      margin-bottom: 14px;
    }
    .login-input:focus {
      border-color: var(--blue);
      background: #fff;
      box-shadow: 0 0 0 3px rgba(61,82,160,0.1);
    }
    .btn-login {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, var(--blue) 0%, var(--blue-mid) 100%);
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      transition: opacity .15s, transform .1s;
      letter-spacing: .2px;
    }
    .btn-login:hover   { opacity: .93; }
    .btn-login:active  { transform: scale(.98); }
    .btn-login:disabled { opacity: .5; cursor: not-allowed; }
    .login-err {
      margin-top: 12px;
      padding: 10px 12px;
      background: #FFF0F0;
      color: #A32D2D;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 500;
      display: none;
    }
    .login-note {
      font-size: 12px;
      color: var(--text3);
      text-align: center;
      margin-top: 14px;
    }

    /* ── CARDS ── */
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .card-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--text3);
      text-transform: uppercase;
      letter-spacing: .7px;
      margin-bottom: 12px;
    }

    /* ── QR HERO ── */
    .qr-hero {
      background: linear-gradient(145deg, var(--blue) 0%, #4a5faf 50%, var(--pink) 100%);
      border-radius: 20px;
      padding: 20px;
      margin-bottom: 12px;
      position: relative;
      overflow: hidden;
      color: #fff;
    }
    .qr-hero::before {
      content: '';
      position: absolute;
      top: -30px; right: -30px;
      width: 120px; height: 120px;
      border-radius: 50%;
      background: rgba(255,255,255,0.07);
    }
    .qr-hero::after {
      content: '';
      position: absolute;
      bottom: -20px; left: -20px;
      width: 80px; height: 80px;
      border-radius: 50%;
      background: rgba(255,255,255,0.05);
    }
    .qr-hero-label {
      font-size: 11px;
      font-weight: 600;
      opacity: .75;
      letter-spacing: .5px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .qr-hero-name {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 16px;
      letter-spacing: -.3px;
    }
    .qr-box-wrap {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .qr-box {
      background: #fff;
      border-radius: 14px;
      padding: 10px;
      flex-shrink: 0;
    }
    .qr-box img, .qr-box canvas {
      display: block;
      border-radius: 4px;
    }
    .qr-info {
      flex: 1;
    }
    .qr-info-hint {
      font-size: 12px;
      opacity: .85;
      line-height: 1.5;
      margin-bottom: 8px;
    }
    .qr-code-text {
      font-size: 10px;
      opacity: .6;
      font-family: monospace;
      letter-spacing: .5px;
      word-break: break-all;
    }

    /* ── STAMP PROGRESS ── */
    .stamp-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .stamp-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .stamp-header-left {
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
    }
    .stamp-count-badge {
      font-size: 22px;
      font-weight: 700;
      color: var(--blue);
      line-height: 1;
    }
    .stamp-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
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
      background: var(--bg);
      transition: all .2s;
      position: relative;
    }
    .stamp-box.filled {
      background: var(--blue-l);
      border-color: var(--blue-mid);
    }
    .stamp-box.filled .stamp-emoji { font-size: 18px; }
    .stamp-num {
      font-size: 9px;
      color: var(--text3);
      font-weight: 500;
      margin-top: 1px;
    }
    .stamp-box.filled .stamp-num { color: var(--blue-mid); }
    .stamp-bar-wrap {
      height: 8px;
      background: var(--bg);
      border-radius: 99px;
      overflow: hidden;
      margin-bottom: 8px;
      border: 1px solid var(--border);
    }
    .stamp-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--blue) 0%, var(--blue-mid) 100%);
      border-radius: 99px;
      transition: width .5s cubic-bezier(.4,0,.2,1);
    }
    .stamp-bar-info {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text2);
    }
    .stamp-total-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--text2);
    }
    .stamp-total-val {
      font-size: 14px;
      font-weight: 700;
      color: var(--text);
    }

    /* ── REWARD CARD ── */
    .reward-item {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .reward-item:last-child { margin-bottom: 0; }
    .reward-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: var(--pink-l);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }
    .reward-info { flex: 1; min-width: 0; }
    .reward-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 2px;
    }
    .reward-date {
      font-size: 11px;
      color: var(--text2);
    }
    .reward-nominal {
      text-align: right;
      flex-shrink: 0;
    }
    .reward-nominal-val {
      font-size: 13px;
      font-weight: 700;
      color: var(--pink);
    }
    .reward-nominal-lbl {
      font-size: 10px;
      color: var(--text3);
    }

    /* ── RIWAYAT ── */
    .siklus-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      margin-bottom: 12px;
      overflow: hidden;
    }
    .siklus-header {
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
    }
    .siklus-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      gap: 8px;
    }
    .siklus-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--blue);
    }
    .siklus-mini-grid {
      display: grid;
      grid-template-columns: repeat(10, 1fr);
      gap: 3px;
    }
    .siklus-dot {
      aspect-ratio: 1;
      border-radius: 4px;
      background: var(--bg);
      border: 1px solid var(--border);
    }
    .siklus-dot.filled {
      background: var(--blue-mid);
      border-color: var(--blue-mid);
    }
    .siklus-body { padding: 10px 14px; }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 9px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-redeemed { background: var(--teal-l); color: var(--teal); }
    .badge-progress { background: var(--blue-l); color: var(--blue); }

    /* ── TRX ITEM ── */
    .trx-item {
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 6px;
    }
    .trx-item:last-child { margin-bottom: 0; }
    .trx-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 9px 12px;
      background: var(--bg);
      cursor: pointer;
      gap: 8px;
      transition: background .1s;
    }
    .trx-head:active { background: var(--blue-ll); }
    .trx-kode { font-size: 12px; font-weight: 600; color: var(--text); }
    .trx-meta { font-size: 10px; color: var(--text2); margin-top: 1px; }
    .trx-right { text-align: right; flex-shrink: 0; }
    .trx-total { font-size: 13px; font-weight: 700; color: var(--teal); }
    .trx-stamp-lbl { font-size: 10px; color: var(--amber); font-weight: 600; }
    .trx-body { padding: 10px 12px; display: none; }
    .trx-detail-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      padding: 5px 0;
      border-bottom: 1px solid var(--border);
      gap: 8px;
      color: var(--text2);
    }
    .trx-detail-row:last-child { border-bottom: none; }
    .trx-detail-nama { color: var(--text); font-weight: 500; }

    /* ── PROFIL ── */
    .profil-avatar-wrap {
      text-align: center;
      padding: 20px 0 14px;
    }
    .profil-avatar {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--blue) 0%, var(--pink) 100%);
      color: #fff;
      font-size: 28px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 10px;
    }
    .profil-nama {
      font-size: 18px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 3px;
    }
    .profil-cabang {
      font-size: 12px;
      color: var(--text2);
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 11px 0;
      border-bottom: 1px solid var(--border);
      font-size: 13px;
      gap: 10px;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: var(--text2); font-size: 12px; flex-shrink: 0; }
    .info-value { font-weight: 600; text-align: right; color: var(--text); }

    /* ── STAT ROW ── */
    .stat-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .stat-box {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 14px;
      text-align: center;
    }
    .stat-val {
      font-size: 22px;
      font-weight: 700;
      color: var(--blue);
      margin-bottom: 3px;
    }
    .stat-lbl {
      font-size: 11px;
      color: var(--text2);
    }

    /* ── LOADING / EMPTY ── */
    .loading {
      text-align: center;
      padding: 40px 20px;
      color: var(--text2);
      font-size: 13px;
    }
    .loading-spinner {
      width: 28px;
      height: 28px;
      border: 2.5px solid var(--border);
      border-top-color: var(--blue);
      border-radius: 50%;
      animation: spin .7s linear infinite;
      margin: 0 auto 12px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty {
      text-align: center;
      padding: 32px 20px;
      color: var(--text2);
      font-size: 13px;
    }
    .empty-icon { font-size: 32px; margin-bottom: 8px; }

    /* ── SECTION TITLE ── */
    .section-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--text3);
      text-transform: uppercase;
      letter-spacing: .7px;
      margin: 4px 0 10px;
    }

    /* ── CHEVRON ── */
    .chevron {
      width: 15px;
      height: 15px;
      color: var(--text3);
      flex-shrink: 0;
      transition: transform .2s;
    }
    .chevron.open { transform: rotate(180deg); }

    /* ── TAB CONTENT ── */
    .tab-content { display: none; }
    .tab-content.active { display: block; }

    /* ── ANIMATIONS ── */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fade-up { animation: fadeUp .3s ease both; }
    .fade-up-1 { animation-delay: .05s; }
    .fade-up-2 { animation-delay: .10s; }
    .fade-up-3 { animation-delay: .15s; }
  </style>
</head>
<body>

<!-- ══════════════════════════════
     LOGIN SCREEN
     ══════════════════════════════ -->
<div id="screen-login" class="login-wrap">
  <div class="login-card">
    <div class="login-logo-wrap">
      <img src="assets/logo.png" alt="MW"/>
      <div class="login-title">Mekar Wangi</div>
      <div class="login-sub">Masuk ke portal member kamu</div>
    </div>
    <label class="login-label" for="input-hp">Nomor HP Terdaftar</label>
    <input type="tel" id="input-hp" class="login-input"
      placeholder="Contoh: 08123456789"
      inputmode="numeric" autocomplete="tel"
      onkeydown="if(event.key==='Enter') doLogin()"/>
    <button class="btn-login" id="btn-login" onclick="doLogin()">Masuk</button>
    <div class="login-err" id="login-err"></div>
    <div class="login-note">Masukkan no HP yang kamu daftarkan ke kasir</div>
  </div>
</div>

<!-- ══════════════════════════════
     PORTAL SCREEN
     ══════════════════════════════ -->
<div id="screen-portal" style="display:none">

  <!-- Topbar -->
  <div class="topbar">
    <div class="topbar-brand">
      <img src="assets/logo.png" alt="MW"/>
      <span>Mekar Wangi</span>
    </div>
    <div class="topbar-right">
      <div class="member-chip">
        <div class="member-avatar" id="portal-avatar">?</div>
        <span class="member-chip-name" id="portal-nama-chip">-</span>
      </div>
      <button class="btn-logout" onclick="doLogout()">Keluar</button>
    </div>
  </div>

  <!-- Scroll area -->
  <div class="page-wrap">
    <div class="page">

      <!-- TAB: BERANDA -->
      <div id="tab-beranda" class="tab-content active">
        <div id="beranda-content">
          <div class="loading">
            <div class="loading-spinner"></div>
            Memuat data...
          </div>
        </div>
      </div>

      <!-- TAB: RIWAYAT -->
      <div id="tab-riwayat" class="tab-content">
        <div id="riwayat-content">
          <div class="loading">
            <div class="loading-spinner"></div>
            Memuat riwayat...
          </div>
        </div>
      </div>

      <!-- TAB: PROFIL -->
      <div id="tab-profil" class="tab-content">
        <div id="profil-content">
          <div class="loading">
            <div class="loading-spinner"></div>
            Memuat profil...
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- Bottom Nav -->
  <nav class="bottom-nav">
    <button class="nav-btn active" id="nav-beranda" onclick="switchTab('beranda')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
      <span>Beranda</span>
    </button>
    <button class="nav-btn" id="nav-riwayat" onclick="switchTab('riwayat')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <span>Riwayat</span>
    </button>
    <button class="nav-btn" id="nav-profil" onclick="switchTab('profil')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
      <span>Profil</span>
    </button>
  </nav>

</div>

<script>
const BASE_URL = (() => {
  const p = window.location.pathname;
  return p.substring(0, p.lastIndexOf('/'));
})();
const API = BASE_URL + '/api/member_portal.php';

let portalData = null;
let activeTab  = 'beranda';
let qrGenerated = false;

// ══════════════════════════════
// INIT
// ══════════════════════════════
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res  = await fetch(`${API}?action=check_session`);
    const data = await res.json();
    if (data.logged_in) showPortal(data.member);
    else showLogin();
  } catch(e) { showLogin(); }
});

// ══════════════════════════════
// LOGIN / LOGOUT
// ══════════════════════════════
function showLogin() {
  document.getElementById('screen-login').style.display = 'flex';
  document.getElementById('screen-portal').style.display = 'none';
  setTimeout(() => document.getElementById('input-hp').focus(), 100);
}

async function doLogin() {
  const no_hp = document.getElementById('input-hp').value.trim();
  const errEl = document.getElementById('login-err');
  const btnEl = document.getElementById('btn-login');
  errEl.style.display = 'none';
  if (!no_hp) {
    errEl.textContent = 'Masukkan nomor HP terlebih dahulu';
    errEl.style.display = 'block';
    return;
  }
  btnEl.disabled = true;
  btnEl.textContent = 'Memuat...';
  try {
    const res  = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', no_hp }),
    });
    const data = await res.json();
    if (data.success) showPortal(data.member);
    else {
      errEl.textContent   = data.message || 'No HP tidak terdaftar';
      errEl.style.display = 'block';
    }
  } catch(e) {
    errEl.textContent   = 'Gagal terhubung ke server';
    errEl.style.display = 'block';
  } finally {
    btnEl.disabled    = false;
    btnEl.textContent = 'Masuk';
  }
}

async function doLogout() {
  await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'logout' }),
  });
  portalData  = null;
  qrGenerated = false;
  showLogin();
}

// ══════════════════════════════
// PORTAL
// ══════════════════════════════
function showPortal(member) {
  document.getElementById('screen-login').style.display  = 'none';
  document.getElementById('screen-portal').style.display = 'block';
  document.getElementById('portal-avatar').textContent    = member.nama.charAt(0).toUpperCase();
  document.getElementById('portal-nama-chip').textContent = member.nama.split(' ')[0];
  loadPortalData();
}

async function loadPortalData() {
  try {
    const res  = await fetch(`${API}?action=my_data`);
    const data = await res.json();
    if (!data.success) {
      if (res.status === 401) { showLogin(); return; }
      return;
    }
    portalData = data;
    renderBeranda();
    // Pre-render tab lain di background
    renderRiwayat();
    renderProfil();
  } catch(e) {
    document.getElementById('beranda-content').innerHTML =
      '<div class="empty"><div class="empty-icon">⚠️</div>Gagal memuat data</div>';
  }
}

// ══════════════════════════════
// TAB SWITCH
// ══════════════════════════════
function switchTab(name) {
  activeTab = name;
  ['beranda','riwayat','profil'].forEach(t => {
    document.getElementById('tab-' + t).classList.toggle('active', t === name);
    document.getElementById('nav-' + t).classList.toggle('active', t === name);
  });
  // Scroll ke atas saat ganti tab
  document.querySelector('.page-wrap').scrollTop = 0;
}

// ══════════════════════════════
// RENDER — BERANDA
// ══════════════════════════════
function renderBeranda() {
  if (!portalData) return;
  const { member, rewards } = portalData;
  const stampMod   = member.stamp_available % 10;
  const pct        = (stampMod / 10) * 100;
  const sisaStamp  = 10 - stampMod;
  const rewardList = rewards.filter(r => r.status === 'redeemed').slice(0, 3);

  // Stamp grid 10 kotak
  let stampsHTML = '';
  for (let i = 1; i <= 10; i++) {
    const filled = i <= stampMod;
    stampsHTML += `
      <div class="stamp-box ${filled ? 'filled' : ''}">
        ${filled ? '<span class="stamp-emoji">🎫</span>' : '<span style="font-size:14px;color:var(--border)">○</span>'}
        <span class="stamp-num">${i}</span>
      </div>`;
  }

  // Progress pesan
  const progressMsg = stampMod === 0
    ? 'Kumpulkan 10 stamp untuk dapat reward!'
    : sisaStamp === 1
    ? '<strong style="color:var(--blue)">1 stamp lagi</strong> untuk dapat reward! 🎉'
    : `<strong style="color:var(--blue)">${sisaStamp} stamp lagi</strong> menuju reward`;

  // Reward terakhir
  const rewardHTML = rewardList.length
    ? rewardList.map((r, idx) => {
        const nomorReward = Math.floor(parseInt(r.stamp_snapshot) / 10);
        const tgl = new Date(r.created_at).toLocaleDateString('id-ID', {
          day: 'numeric', month: 'short', year: 'numeric'
        });
        return `
          <div class="reward-item">
            <div class="reward-icon">🎁</div>
            <div class="reward-info">
              <div class="reward-name">${esc(r.keterangan_redeem || r.bibit_nama || '-')}</div>
              <div class="reward-date">Reward ke-${nomorReward} · ${tgl}</div>
            </div>
            <div class="reward-nominal">
              <div class="reward-nominal-val">Rp ${parseFloat(r.rata_nominal||0).toLocaleString('id-ID')}</div>
              <div class="reward-nominal-lbl">rata-rata/stamp</div>
            </div>
          </div>`;
      }).join('')
    : '<div class="empty" style="padding:16px 0"><div class="empty-icon">🎫</div>Belum ada reward. Kumpulkan 10 stamp!</div>';

  document.getElementById('beranda-content').innerHTML = `
    <!-- QR Hero -->
    <div class="qr-hero fade-up">
      <div class="qr-hero-label">Member Card</div>
      <div class="qr-hero-name">${esc(member.nama)}</div>
      <div class="qr-box-wrap">
        <div class="qr-box" id="portal-qr-wrap"></div>
        <div class="qr-info">
          <div class="qr-info-hint">Tunjukkan QR ini ke kasir saat belanja agar stamp kamu tercatat</div>
          <div class="qr-code-text">${esc(member.qr_code)}</div>
        </div>
      </div>
    </div>

    <!-- Stamp Progress -->
    <div class="stamp-card fade-up fade-up-1">
      <div class="stamp-header">
        <div class="stamp-header-left">Progress Reward</div>
        <div class="stamp-count-badge">${stampMod}/10</div>
      </div>
      <div class="stamp-grid">${stampsHTML}</div>
      <div class="stamp-bar-wrap">
        <div class="stamp-bar-fill" style="width:${pct}%"></div>
      </div>
      <div class="stamp-bar-info">
        <span>${progressMsg}</span>
      </div>
      <div class="stamp-total-row">
        <span>Total stamp sejak daftar:</span>
        <span class="stamp-total-val">${member.total_stamp}</span>
      </div>
    </div>

    <!-- Reward Terakhir -->
    <div class="section-title fade-up fade-up-2">Reward Terakhir</div>
    <div class="card fade-up fade-up-3" style="padding:12px">
      ${rewardHTML}
      ${rewardList.length && rewards.filter(r=>r.status==='redeemed').length > 3
        ? `<button onclick="switchTab('riwayat')"
            style="width:100%;margin-top:10px;padding:9px;border:1.5px solid var(--border);
            border-radius:10px;background:none;font-size:13px;color:var(--blue);
            font-weight:600;cursor:pointer;font-family:inherit">
            Lihat semua riwayat →
          </button>`
        : ''}
    </div>`;

  generateQR('portal-qr-wrap', member.qr_code);
}

// ══════════════════════════════
// RENDER — RIWAYAT
// ══════════════════════════════
function renderRiwayat() {
  if (!portalData) return;
  const { riwayat, rewards } = portalData;

  if (!riwayat.length) {
    document.getElementById('riwayat-content').innerHTML =
      '<div class="empty"><div class="empty-icon">📋</div>Belum ada transaksi</div>';
    return;
  }

  // Kelompokkan per siklus
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
      if (!siklus[n]) siklus[n] = { nomor: n, stamp_dari: (n-1)*10+1, stamp_ke: n*10, trxs: [] };
      if (!siklus[n].trxs.find(x => x.id === t.id)) siklus[n].trxs.push(t);
    }
  });

  const sortedSiklus = Object.values(siklus).filter(s => s.nomor).sort((a,b) => b.nomor - a.nomor);
  const rewardTrxs  = siklus['0']?.trxs.filter(t => t.kode_nota.startsWith('REWARD-')) || [];

  const cards = sortedSiklus.map(s => {
    const reward = rewards.find(r => parseInt(r.stamp_snapshot) === s.stamp_ke);
    const allStampKe = [];
    s.trxs.forEach(t => {
      const min = parseInt(t.stamp_ke_min || 0);
      const max = parseInt(t.stamp_ke_max || 0);
      for (let i = min; i <= max; i++) allStampKe.push(i);
    });
    const stampDiSiklus = [...new Set(allStampKe)].filter(k => k >= s.stamp_dari && k <= s.stamp_ke).length;
    const isComplete    = stampDiSiklus >= 10;
    const isRedeemed    = reward?.status === 'redeemed';

    // Mini grid
    let miniGrid = '';
    for (let i = 1; i <= 10; i++) {
      const filled = allStampKe.includes(s.stamp_dari + i - 1);
      miniGrid += `<div class="siklus-dot ${filled ? 'filled' : ''}"></div>`;
    }

    // Badge
    const badge = isRedeemed
      ? `<span class="badge badge-redeemed">✓ Reward ditukar</span>`
      : isComplete
      ? `<span class="badge badge-progress">✓ Lengkap</span>`
      : `<span class="badge badge-progress">${stampDiSiklus}/10</span>`;

    // Header bg
    const headerBg = isRedeemed ? 'var(--teal-l)' : isComplete ? 'var(--blue-l)' : 'var(--bg)';

    // Reward info
    const rewardInfo = isRedeemed
      ? `<div style="margin-top:8px;padding:8px 10px;background:var(--teal-l);border-radius:8px;
          font-size:12px;color:var(--teal);font-weight:500">
          ✓ Ditukar: <strong>${esc(reward.keterangan_redeem || reward.bibit_nama || '-')}</strong>
        </div>`
      : '';

    // Transaksi rows
    const trxRows = s.trxs.map(t => {
      const tgl      = new Date(t.created_at).toLocaleDateString('id-ID', { day:'numeric', month:'short' });
      const jam      = t.created_at.split(' ')[1]?.substring(0,5) || '';
      const isReward = t.kode_nota.startsWith('REWARD-');
      const stampCount = parseInt(t.stamp_didapat || 0);

      // Hitung nominal siklus ini
      const nominalSiklus = (() => {
        let total = 0;
        Object.values(t.items_per_reward || {}).forEach(groupItems => {
          groupItems.forEach(item => {
            const stampKe = parseInt(item.stamp_ke || 0);
            if (stampKe >= s.stamp_dari && stampKe <= s.stamp_ke) total += parseFloat(item.subtotal || 0);
          });
        });
        return total;
      })();

      return `
        <div class="trx-item">
          <div class="trx-head" onclick="toggleTrxDetail('ptd-${s.nomor}-${t.id}','pchv-${s.nomor}-${t.id}')">
            <div style="flex:1;min-width:0">
              <div class="trx-kode">${esc(t.kode_nota)}</div>
              <div class="trx-meta">${tgl} · ${jam} · ${esc(t.cabang_nama)}</div>
            </div>
            <div class="trx-right">
              <div class="trx-total" style="color:${isReward ? 'var(--pink)' : 'var(--teal)'}">
                ${isReward ? '🎁 Reward' : 'Rp ' + nominalSiklus.toLocaleString('id-ID')}
              </div>
              ${stampCount > 0 ? `<div class="trx-stamp-lbl">+${stampCount} 🎫</div>` : ''}
            </div>
            <svg id="pchv-${s.nomor}-${t.id}" class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </div>
          <div id="ptd-${s.nomor}-${t.id}" class="trx-body">
            ${renderTrxDetail(t, s)}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="siklus-card">
        <div class="siklus-header" style="background:${headerBg}">
          <div class="siklus-header-row">
            <div class="siklus-title">Siklus ${s.nomor}
              <span style="font-size:11px;font-weight:400;color:var(--text2);margin-left:4px">
                (stamp ${s.stamp_dari}–${s.stamp_ke})
              </span>
            </div>
            ${badge}
          </div>
          <div class="siklus-mini-grid">${miniGrid}</div>
          ${rewardInfo}
        </div>
        <div class="siklus-body">
          <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;
            letter-spacing:.5px;margin-bottom:8px">${s.trxs.length} Transaksi</div>
          ${trxRows}
        </div>
      </div>`;
  }).join('');

  // Reward trx card
  const rewardTrxCard = rewardTrxs.length ? `
    <div class="siklus-card">
      <div class="siklus-header" style="background:var(--pink-l)">
        <div class="siklus-title" style="color:var(--pink)">🎁 Riwayat Penukaran Reward</div>
      </div>
      <div class="siklus-body">
        ${rewardTrxs.map(t => {
          const tgl = new Date(t.created_at).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
          return `
            <div class="trx-item">
              <div class="trx-head" onclick="toggleTrxDetail('ptd-r-${t.id}','pchv-r-${t.id}')">
                <div style="flex:1;min-width:0">
                  <div class="trx-kode">${esc(t.kode_nota)}</div>
                  <div class="trx-meta">${tgl} · ${esc(t.cabang_nama)}</div>
                </div>
                <div class="trx-right">
                  <div class="trx-total" style="color:var(--pink)">🎁 Reward</div>
                </div>
                <svg id="pchv-r-${t.id}" class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </div>
              <div id="ptd-r-${t.id}" class="trx-body">
                ${(t.items||[]).map(item => `
                  <div class="trx-detail-row">
                    <span class="trx-detail-nama">${esc(item.bibit_nama)}</span>
                    <span>${parseFloat(item.jumlah_jual)} ${esc(item.satuan_jual)} · <strong style="color:var(--pink)">Gratis</strong></span>
                  </div>`).join('')}
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>` : '';

  document.getElementById('riwayat-content').innerHTML = cards + rewardTrxCard;
}

function renderTrxDetail(t, s) {
  const itemsPerReward = t.items_per_reward || {};
  const rewardGroups   = Object.keys(itemsPerReward);
  if (!rewardGroups.length) return '<div style="font-size:12px;color:var(--text2);padding:4px 0">Tidak ada detail</div>';

  return rewardGroups.map(groupKey => {
    const groupItems    = itemsPerReward[groupKey];
    const isProgress    = groupKey === 'progress';
    const filteredItems = groupItems.filter(item => {
      const stampKe = parseInt(item.stamp_ke || 0);
      return stampKe >= s.stamp_dari && stampKe <= s.stamp_ke;
    });
    if (!filteredItems.length) return '';

    const groupLabel = isProgress
      ? `<div style="font-size:10px;color:var(--text2);font-style:italic;margin-bottom:4px">Progress reward berikutnya</div>`
      : '';

    const rows = filteredItems.map(item => {
      if (item.is_mix) return `
        <div class="trx-detail-row">
          <span class="trx-detail-nama">Mix · ${item.items ? item.items.join(' + ') : ''}</span>
          <span>Rp ${parseFloat(item.subtotal).toLocaleString('id-ID')}</span>
        </div>`;
      return `
        <div class="trx-detail-row">
          <span class="trx-detail-nama">${esc(item.bibit_nama)} <span style="color:var(--text3);font-size:10px">#${item.stamp_ke}</span></span>
          <span>${item.jumlah} ${esc(item.satuan)} · Rp ${parseFloat(item.subtotal).toLocaleString('id-ID')}</span>
        </div>`;
    }).join('');

    return groupLabel + rows;
  }).filter(Boolean).join('<div style="height:1px;background:var(--border);margin:6px 0"></div>');
}

// ══════════════════════════════
// RENDER — PROFIL
// ══════════════════════════════
function renderProfil() {
  if (!portalData) return;
  const { member, rewards } = portalData;
  const tglDaftar = new Date(member.created_at).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  const totalReward = rewards.filter(r => r.status === 'redeemed').length;

  document.getElementById('profil-content').innerHTML = `
    <!-- Avatar -->
    <div class="profil-avatar-wrap">
      <div class="profil-avatar">${esc(member.nama.charAt(0).toUpperCase())}</div>
      <div class="profil-nama">${esc(member.nama)}</div>
      <div class="profil-cabang">Cabang ${esc(member.cabang_asal_nama || '-')}</div>
    </div>

    <!-- Stat boxes -->
    <div class="stat-row">
      <div class="stat-box">
        <div class="stat-val">${member.total_stamp}</div>
        <div class="stat-lbl">Total Stamp</div>
      </div>
      <div class="stat-box">
        <div class="stat-val" style="color:var(--pink)">${totalReward}</div>
        <div class="stat-lbl">Reward Ditukar</div>
      </div>
    </div>

    <!-- Info detail -->
    <div class="card">
      <div class="card-title">Info Akun</div>
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
        <span class="info-label">Total Belanja Ber-stamp</span>
        <span class="info-value" style="color:var(--blue)">Rp ${parseFloat(member.total_belanja||0).toLocaleString('id-ID')}</span>
      </div>
    </div>

    <!-- Tombol logout -->
    <button onclick="doLogout()"
      style="width:100%;padding:13px;border:1.5px solid var(--border);border-radius:12px;
      background:none;font-size:14px;color:var(--text2);font-weight:600;cursor:pointer;
      font-family:inherit;margin-top:4px;transition:background .15s"
      onmouseover="this.style.background='var(--bg)'"
      onmouseout="this.style.background='none'">
      Keluar dari Akun
    </button>
    <div style="height:8px"></div>`;
}

// ══════════════════════════════
// TOGGLE TRX DETAIL
// ══════════════════════════════
function toggleTrxDetail(bodyId, chevronId) {
  const body = document.getElementById(bodyId);
  const chv  = document.getElementById(chevronId);
  if (!body) return;
  const isOpen = body.style.display === 'block';
  body.style.display = isOpen ? 'none' : 'block';
  if (chv) chv.classList.toggle('open', !isOpen);
}

// ══════════════════════════════
// QR CODE
// ══════════════════════════════
async function generateQR(elementId, text) {
  if (!window.QRCode) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src   = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      s.onload  = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = '';
  new QRCode(el, {
    text,
    width:  130,
    height: 130,
    correctLevel: QRCode.CorrectLevel.M,
  });
}

// ══════════════════════════════
// HELPER
// ══════════════════════════════
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