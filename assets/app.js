const STOK_WARNING = 50;
const STOK_CRITICAL = 10;
const STOK_MAX = 500;
const TOKO_NAMA = "Mekar Wangi Indonesia";

// ---- Pagination per halaman
// const PER_PAGE         = 25;  // sudah di bawah (log & stok admin)
const RIWAYAT_PER_PAGE = 10; // riwayat transaksi karyawan

const BASE_URL = (() => {
  const p = window.location.pathname;
  return p.substring(0, p.lastIndexOf("/"));
})();

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
/* ================================================
   TOAST NOTIFICATION
   ================================================ */
function toast(msg, type = "ok", title = "", duration = 3500) {
  const icons = { ok: "✅", danger: "❌", warn: "⚠️", info: "ℹ️" };
  const container = document.getElementById("toast-container");
  if (!container) {
    alert(msg);
    return;
  }

  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <span class="toast-icon">${icons[type] || "ℹ️"}</span>
    <div class="toast-body">
      ${title ? `<div class="toast-title">${title}</div>` : ""}
      <div class="toast-msg">${msg}</div>
    </div>
    <button class="toast-close" onclick="this.closest('.toast').remove()">×</button>`;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add("hiding");
    setTimeout(() => el.remove(), 250);
  }, duration);
}

function toastOk(msg, title = "Berhasil") {
  toast(msg, "ok", title);
}
function toastErr(msg, title = "Gagal") {
  toast(msg, "danger", title);
}
function toastWarn(msg, title = "Perhatian") {
  toast(msg, "warn", title);
}
function toastInfo(msg, title = "Info") {
  toast(msg, "info", title);
}

let stokData = [];
let cabangData = [];
let bibitData = [];
let activeFilter = "all";
let editUserId = null;

/* ================================================
   FETCH HELPER
   ================================================ */
async function api(url, method = "GET", body = null) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json();

  // Handle session timeout — redirect ke login
  if (res.status === 401 && data.timeout) {
    window.location.href = BASE_URL + "/index.php?timeout=1";
    return;
  }

  if (!res.ok) throw new Error(data.message || "Server error");
  return data;
}

/* ================================================
   INIT — detect page
   ================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if ($("tab-stok")) initAdmin();
  else if ($("ktab-transaksi")) initKaryawan();
});

/* ================================================
   ADMIN INIT
   ================================================ */
async function initAdmin() {
  await loadStokData();
  renderAdminContent();

  // Load notifikasi pertama kali
  await loadNotifikasi();

  // Auto refresh stok setiap 30 detik
  setInterval(async () => {
    await loadStokData();
    if (adminActiveTab === "stok") renderAdminContent();
  }, 30000);

  // Auto refresh notifikasi setiap 5 menit
  setInterval(loadNotifikasi, 5 * 60 * 1000);
}

let adminActiveTab = "stok";

async function loadStokData() {
  try {
    const data = await api(BASE_URL + "/api/stok.php");
    stokData = data.stok || [];
    cabangData = data.cabang || [];
    bibitData = data.bibit || [];

    // Sync threshold dari server config (agar sinkron dengan PHP)
    if (data.config) {
      window.STOK_WARNING = data.config.stok_warning || STOK_WARNING;
      window.STOK_CRITICAL = data.config.stok_critical || STOK_CRITICAL;
    }
    return data;
  } catch (e) {
    console.error("loadStokData:", e);
  }
}

function switchTab(name) {
  adminActiveTab = name;
  document.querySelectorAll(".tab-btn").forEach((el) => {
    const map = {
      stok: "Stok Cabang",
      log: "Log Aktivitas",
      laporan: "Laporan PDF",
      rekap: "Rekap Bulanan",
      users: "Kelola User",
      produk: "Produk & Distribusi",
    };
    el.classList.toggle("active", el.textContent.trim() === map[name]);
  });
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.remove("active"));
  const el = $("tab-" + name);
  if (el) el.classList.add("active");
  renderAdminContent();
}

function renderAdminContent() {
  const el = $("admin-body") || $("tab-" + adminActiveTab);
  if (!el) return;
  const target = $("admin-body") ? $("tab-" + adminActiveTab) : el;
  if (!target) return;

  if (adminActiveTab === "stok") {
    target.innerHTML = buildStokTab();
    setTimeout(() => loadStokPage(stokPage), 50);
  }
  if (adminActiveTab === "log") buildLogTab(target);
  if (adminActiveTab === "laporan") {
    target.innerHTML = buildLaporanTab();
  }
  if (adminActiveTab === "rekap") buildRekapTab(target);
  if (adminActiveTab === "users") buildUsersTab(target);
  if (adminActiveTab === "produk") {
    target.innerHTML = buildProdukTab();
    setTimeout(renderProdukList, 50);
  }
}

/* ================================================
   TAB STOK
   ================================================ */
function buildStokTab() {
  const totalMl = stokData.reduce((s, r) => s + parseFloat(r.jumlah), 0);
  const lowCount = stokData.filter((r) => {
    const sat = r.satuan_dasar || r.satuan || "ml";
    const isMl = ["ml", "liter", "gram", "kg"].includes(sat);
    return parseFloat(r.jumlah) < (isMl ? STOK_WARNING : 5);
  }).length;

  const pills =
    `<button class="pill ${activeFilter === "all" ? "active" : ""}" onclick="setFilter('all')">Semua</button>` +
    cabangData
      .map(
        (c) =>
          `<button class="pill ${activeFilter == c.id ? "active" : ""}" onclick="setFilter(${c.id})">${esc(c.nama)}</button>`,
      )
      .join("");

  const cabangs =
    activeFilter === "all"
      ? cabangData
      : cabangData.filter((c) => c.id == activeFilter);

  let alerts = "";
  stokData.forEach((r) => {
    if (activeFilter !== "all" && r.cabang_id != activeFilter) return;
    const v = parseFloat(r.jumlah);
    const sat = r.satuan_dasar || r.satuan || "ml";
    const isMl = ["ml", "liter", "gram", "kg"].includes(sat);
    const warn = isMl ? STOK_WARNING : 5;
    const crit = isMl ? STOK_CRITICAL : 2;
    if (v <= crit)
      alerts += `<div class="alert alert-danger">Menipis: <strong>${esc(r.bibit_nama)}</strong> di ${esc(r.cabang_nama)} — sisa <strong>${parseFloat(v)} ${esc(sat)}</strong></div>`;
    else if (v <= warn)
      alerts += `<div class="alert alert-warn">Peringatan: <strong>${esc(r.bibit_nama)}</strong> di ${esc(r.cabang_nama)} — sisa <strong>${parseFloat(v)} ${esc(sat)}</strong></div>`;
  });

  const cards = cabangs
    .map((c) => {
      const rows = stokData
        .filter((r) => r.cabang_id == c.id)
        .map((r) => {
          const v = parseFloat(r.jumlah);
          const sat = r.satuan_dasar || r.satuan || "ml";
          const isMl = ["ml", "liter", "gram", "kg"].includes(sat);
          const warn = isMl ? STOK_WARNING : 5;
          const crit = isMl ? STOK_CRITICAL : 2;
          const maxD = isMl ? STOK_MAX : 50;
          const pct = Math.min(100, Math.round((v / maxD) * 100));
          const cls = v <= crit ? "crit" : v <= warn ? "low" : "ok";
          return `<div class="stock-row">
        <div>
          <div class="stock-name">${esc(r.bibit_nama)}</div>
          <div class="prog"><div class="prog-fill prog-${cls}" style="width:${pct}%"></div></div>
        </div>
        <span class="badge badge-${cls}">${cls === "ok" ? "OK" : cls === "low" ? "Rendah" : "Menipis"}</span>
        <span style="font-size:13px;font-weight:600;color:${v <= warn ? "var(--red)" : "var(--teal)"}">${parseFloat(v)} ${esc(sat)}</span>
        <button class="btn btn-sm" onclick="openEditStok(${c.id},${r.bibit_id})">Edit</button>
      </div>`;
        })
        .join("");
      return `<div class="card">
      <div class="card-header"><span class="card-title">${esc(c.nama)}</span><span class="live-badge"><span class="pulse"></span>Live</span></div>
      ${rows}
    </div>`;
    })
    .join("");

  return `<div class="metrics-grid">
    <div class="metric-card"><div class="metric-label">Total Stok</div><div class="metric-val">${(totalMl / 1000).toFixed(1)}L</div></div>
    <div class="metric-card"><div class="metric-label">Jumlah Cabang</div><div class="metric-val">${cabangData.length}</div></div>
    <div class="metric-card"><div class="metric-label">Jenis Produk</div><div class="metric-val">${bibitData.length}</div></div>
    <div class="metric-card"><div class="metric-label">Perlu Restock</div><div class="metric-val" style="color:${lowCount > 0 ? "var(--red)" : "var(--teal)"}">${lowCount}</div></div>
  </div>${alerts}<div class="pills">${pills}</div>${cards}`;
}

function setFilter(f) {
  activeFilter = f;
  renderAdminContent();
}

/* ================================================
   TAB LOG
   ================================================ */
async function buildLogTab(target) {
  target.innerHTML = '<div class="loading">Memuat log...</div>';
  try {
    const data = await api(BASE_URL + "/api/log.php");
    const logs = data.logs || [];
    if (!logs.length) {
      target.innerHTML = '<div class="empty">Belum ada aktivitas</div>';
      return;
    }
    const rows = logs
      .map(
        (l) => `
      <div class="log-row">
        <div class="log-dot dot-${l.tipe}"></div>
        <div>
          <div class="log-info"><strong>${esc(l.user_nama)}</strong> — ${esc(l.bibit_nama)} di ${esc(l.cabang_nama)} ${l.tipe === "kurang" ? "berkurang" : "bertambah"} <strong>${l.jumlah} ${esc(l.satuan || "")}</strong>${l.keterangan ? " (" + esc(l.keterangan) + ")" : ""}</div>
          <div class="log-meta">Sisa: ${l.sisa} ${esc(l.satuan || "")}</div>
        </div>
        <div class="log-time">${l.created_at}</div>
      </div>`,
      )
      .join("");
    target.innerHTML = `<div class="card">
      <div class="card-header"><span class="card-title">Riwayat Aktivitas</span>
        <button class="btn btn-sm btn-danger" onclick="hapusLog()">Hapus Log</button>
      </div>${rows}</div>`;
  } catch (e) {
    target.innerHTML = '<div class="alert alert-danger">Gagal memuat log</div>';
  }
}

async function hapusLog() {
  if (!confirm("Hapus semua log?")) return;
  await api(BASE_URL + "/api/log.php", "DELETE");
  renderAdminContent();
}

/* ================================================
   TAB LAPORAN
   ================================================ */
function buildLaporanTab() {
  const today = (() => {
    const d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  })();
  const cabOpts =
    `<option value="all">Semua Cabang</option>` +
    cabangData
      .map((c) => `<option value="${c.id}">${esc(c.nama)}</option>`)
      .join("");
  return `<div class="report-toolbar">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:1">
      <label>Tanggal:</label>
      <input type="date" id="rp-tgl" value="${today}" onchange="renderPreview()"/>
      <label style="margin-left:8px">Cabang:</label>
      <select id="rp-cabang" onchange="renderPreview()" style="min-width:160px">${cabOpts}</select>
    </div>
    <button class="btn btn-green" onclick="exportPDF()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:5px"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
      Download PDF
    </button>
  </div><div id="report-preview"></div>`;
}

let rpStokPage = 1;
const RP_STOK_PER_PAGE = 20;
let rpFilteredStokCache = [];

async function renderPreview() {
  const tgl = $("rp-tgl")?.value;
  const cab_id = $("rp-cabang")?.value;
  const preview = $("report-preview");
  if (!tgl || !preview) return;
  try {
    const url = `${BASE_URL}/api/log.php?tanggal=${tgl}${cab_id !== "all" ? "&cabang_id=" + cab_id : ""}`;
    const data = await api(url);
    preview.innerHTML = buildReportHTML(tgl, cab_id, data);
    setTimeout(() => renderRpStokPage(1), 30);
  } catch (e) {
    preview.innerHTML =
      '<div class="alert alert-danger">Gagal memuat laporan</div>';
  }
}

function renderRpStokPage(page) {
  rpStokPage = page;
  const tableEl = $("rp-stok-table");
  const pagEl = $("rp-stok-pagination");
  if (!tableEl || !pagEl) return;

  const total = rpFilteredStokCache.length;
  const totalPages = Math.ceil(total / RP_STOK_PER_PAGE);
  const from = (page - 1) * RP_STOK_PER_PAGE;
  const slice = rpFilteredStokCache.slice(from, from + RP_STOK_PER_PAGE);

  const rows = slice
    .map((r) => {
      const v = parseFloat(r.jumlah);
      const sat = r.satuan_dasar || r.satuan || "ml";
      const isMl = ["ml", "liter", "gram", "kg"].includes(sat);
      const crit = isMl ? STOK_CRITICAL : 2;
      const warn = isMl ? STOK_WARNING : 5;
      const cls =
        v < crit ? "status-crit" : v < warn ? "status-low" : "status-ok";
      const lbl = v < crit ? "Menipis" : v < warn ? "Rendah" : "OK";
      return `<tr>
      <td>${esc(r.cabang_nama)}</td>
      <td>${esc(r.bibit_nama)}</td>
      <td style="text-align:right"><strong>${v} ${esc(sat)}</strong></td>
      <td style="text-align:center"><span class="${cls}">${lbl}</span></td>
    </tr>`;
    })
    .join("");

  tableEl.innerHTML = `<div style="overflow-x:auto"><table class="rp-table">
    <thead><tr><th>Cabang</th><th>Produk</th><th style="text-align:right">Stok</th><th style="text-align:center">Status</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:#888;padding:16px">Tidak ada data</td></tr>'}</tbody>
  </table></div>`;

  if (totalPages <= 1) {
    pagEl.innerHTML = "";
    return;
  }

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  let btnPages = "";
  for (let i = start; i <= end; i++) {
    btnPages += `<button class="page-btn ${i === page ? "active" : ""}"
      onclick="renderRpStokPage(${i})" ${i === page ? "disabled" : ""}>${i}</button>`;
  }

  pagEl.innerHTML = `<div class="pagination" style="margin-top:10px">
    <div class="pagination-info">Menampilkan ${from + 1}–${Math.min(from + RP_STOK_PER_PAGE, total)} dari ${total} produk</div>
    <div class="pagination-btns">
      <button class="page-btn" onclick="renderRpStokPage(${page - 1})" ${page <= 1 ? "disabled" : ""}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      ${btnPages}
      <button class="page-btn" onclick="renderRpStokPage(${page + 1})" ${page >= totalPages ? "disabled" : ""}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>
  </div>`;
}

function buildReportHTML(tgl, cab_id, data) {
  const tglObj = new Date(tgl);
  const tglStr = tglObj.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const logs = data.logs || [];
  const cabNama =
    cab_id === "all"
      ? "Semua Cabang"
      : cabangData.find((c) => c.id == cab_id)?.nama || "";
  const filteredStok =
    cab_id === "all" ? stokData : stokData.filter((r) => r.cabang_id == cab_id);
  rpFilteredStokCache = filteredStok;
  rpStokPage = 1;
  const totalStok = filteredStok.reduce((s, r) => s + parseFloat(r.jumlah), 0);
  const stokKritis = filteredStok.filter((r) => {
    const sat = r.satuan_dasar || r.satuan || "ml";
    const isMl = ["ml", "liter", "gram", "kg"].includes(sat);
    return parseFloat(r.jumlah) < (isMl ? STOK_CRITICAL : 2);
  }).length;
  const stokRendah = filteredStok.filter((r) => {
    const sat = r.satuan_dasar || r.satuan || "ml";
    const isMl = ["ml", "liter", "gram", "kg"].includes(sat);
    const crit = isMl ? STOK_CRITICAL : 2;
    const warn = isMl ? STOK_WARNING : 5;
    return parseFloat(r.jumlah) >= crit && parseFloat(r.jumlah) < warn;
  }).length;

  const actRows = logs.length
    ? logs
        .map((l) => {
          const w = l.tipe === "kurang" ? "color:#A32D2D" : "color:#0F6E56";
          return `<tr><td>${l.created_at}</td><td>${esc(l.user_nama)}</td><td>${esc(l.cabang_nama)}</td><td>${esc(l.bibit_nama)}</td>
          <td style="text-align:right;${w}"><strong>${l.tipe === "kurang" ? "-" : "+"} ${l.jumlah}${esc(l.satuan || "")}</strong></td>
          <td style="text-align:right">${l.sisa}${esc(l.satuan || "")}</td><td>${esc(l.keterangan || "—")}</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="7" style="text-align:center;color:#888;padding:16px">Tidak ada aktivitas</td></tr>`;

  return `<div class="report-preview">
    <div class="rp-header"><h1>${esc(TOKO_NAMA)}</h1><p>Laporan Stok Harian — ${esc(tglStr)}</p>
      <p style="margin-top:4px;font-size:12px;opacity:.75">Cabang: ${esc(cabNama)} | Dicetak: ${new Date().toLocaleString("id-ID")}</p></div>
    <div class="rp-section">
      <div class="rp-section-title">Ringkasan</div>
      <div class="rp-summary-grid">
        <div class="rp-summary-item"><div class="rp-summary-val">${(totalStok / 1000).toFixed(1)}L</div><div class="rp-summary-lbl">Total Stok</div></div>
        <div class="rp-summary-item"><div class="rp-summary-val" style="color:var(--red)">${data.total_kurang || 0}</div><div class="rp-summary-lbl">Berkurang</div></div>
        <div class="rp-summary-item"><div class="rp-summary-val" style="color:var(--teal)">${data.total_tambah || 0}</div><div class="rp-summary-lbl">Ditambah</div></div>
        <div class="rp-summary-item"><div class="rp-summary-val">${logs.length}</div><div class="rp-summary-lbl">Transaksi</div></div>
        <div class="rp-summary-item"><div class="rp-summary-val" style="color:var(--red)">${stokKritis}</div><div class="rp-summary-lbl">Menipis</div></div>
        <div class="rp-summary-item"><div class="rp-summary-val" style="color:var(--amber)">${stokRendah}</div><div class="rp-summary-lbl">Rendah</div></div>
      </div>
    </div>
    <div class="rp-section">
      <div class="rp-section-title">Aktivitas Karyawan</div>
      <div style="overflow-x:auto"><table class="rp-table">
        <thead><tr><th>Waktu</th><th>Karyawan</th><th>Cabang</th><th>Produk</th><th style="text-align:right">Jumlah</th><th style="text-align:right">Sisa</th><th>Keterangan</th></tr></thead>
        <tbody>${actRows}</tbody>
      </table></div>
    </div>
    <div class="rp-section">
      <div class="rp-section-title" style="display:flex;align-items:center;justify-content:space-between">
        <span>Kondisi Stok</span>
        <span style="font-size:12px;font-weight:400;color:var(--text2)">${filteredStok.length} produk</span>
      </div>
      <div id="rp-stok-table"></div>
      <div id="rp-stok-pagination"></div>
    </div>
  </div>`;
}

async function exportPDF() {
  const tgl = $("rp-tgl")?.value;
  const cab_id = $("rp-cabang")?.value;
  if (!tgl) {
    toastWarn("Pilih tanggal dulu");
    return;
  }
  const url = `${BASE_URL}/api/log.php?tanggal=${tgl}${cab_id !== "all" ? "&cabang_id=" + cab_id : ""}`;
  const data = await api(url);
  const logs = data.logs || [];
  const cabNama =
    cab_id === "all"
      ? "Semua Cabang"
      : cabangData.find((c) => c.id == cab_id)?.nama || "";
  const tglStr = new Date(tgl).toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const filteredStok =
    cab_id === "all" ? stokData : stokData.filter((r) => r.cabang_id == cab_id);
  const totalStok = filteredStok.reduce((s, r) => s + parseFloat(r.jumlah), 0);
  const stokKritis = filteredStok.filter((r) => {
    const sat = r.satuan_dasar || r.satuan || "ml";
    const isMl = ["ml", "liter", "gram", "kg"].includes(sat);
    return parseFloat(r.jumlah) < (isMl ? STOK_CRITICAL : 2);
  }).length;
  const stokRendah = filteredStok.filter((r) => {
    const sat = r.satuan_dasar || r.satuan || "ml";
    const isMl = ["ml", "liter", "gram", "kg"].includes(sat);
    const crit = isMl ? STOK_CRITICAL : 2;
    const warn = isMl ? STOK_WARNING : 5;
    return parseFloat(r.jumlah) >= crit && parseFloat(r.jumlah) < warn;
  }).length;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210,
    M = 14;
  let y = 0;

  doc.setFillColor(61, 82, 160);
  doc.rect(0, 0, W, 38, "F");
  doc.setFillColor(100, 120, 192);
  doc.rect(0, 32, W, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(TOKO_NAMA, M, 14);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Laporan Stok Harian — " + tglStr, M, 22);
  doc.setFontSize(9);
  doc.text(
    "Cabang: " +
      cabNama +
      "   |   Dicetak: " +
      new Date().toLocaleString("id-ID"),
    M,
    30,
  );
  y = 48;

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("RINGKASAN", M, y);
  y += 5;
  const boxes = [
    {
      label: "Total Stok",
      val: (totalStok / 1000).toFixed(1) + "L",
      color: [61, 82, 160],
    },
    {
      label: "Berkurang",
      val: (data.total_kurang || 0) + "",
      color: [163, 45, 45],
    },
    {
      label: "Ditambah",
      val: (data.total_tambah || 0) + "",
      color: [61, 82, 160],
    },
    { label: "Transaksi", val: logs.length + "", color: [194, 24, 91] },
    { label: "Menipis", val: stokKritis + "", color: [163, 45, 45] },
    { label: "Rendah", val: stokRendah + "", color: [61, 82, 160] },
  ];
  const bw = (W - M * 2 - 10) / 6;
  boxes.forEach((b, i) => {
    const bx = M + i * (bw + 2);
    doc.setFillColor(248, 247, 244);
    doc.roundedRect(bx, y, bw, 16, 2, 2, "F");
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...b.color);
    doc.text(b.val, bx + bw / 2, y + 9, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(136, 135, 128);
    doc.text(b.label, bx + bw / 2, y + 14, { align: "center" });
  });
  y += 24;

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("AKTIVITAS", M, y);
  y += 3;
  const actBody = logs.length
    ? logs.map((l) => [
        l.created_at,
        l.user_nama,
        l.cabang_nama,
        l.bibit_nama,
        (l.tipe === "kurang" ? "- " : "") +
          parseFloat(l.jumlah) +
          (l.satuan || ""),
        l.sisa + (l.satuan || ""),
        l.keterangan || "—",
      ])
    : [["—", "—", "—", "Tidak ada aktivitas", "—", "—", "—"]];
  doc.autoTable({
    startY: y,
    margin: { left: M, right: M },
    head: [
      ["Waktu", "Karyawan", "Cabang", "Produk", "Jumlah", "Sisa", "Keterangan"],
    ],
    body: actBody,
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [229, 227, 220],
      lineWidth: 0.2,
    },
    headStyles: { fillColor: [61, 82, 160], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 249, 255] },
    columnStyles: { 4: { halign: "right" }, 5: { halign: "right" } },
    didParseCell(d) {
      if (d.section === "body" && d.column.index === 4)
        d.cell.styles.textColor = String(d.cell.raw).startsWith("-")
          ? [163, 45, 45]
          : [15, 110, 86];
    },
  });
  y = doc.lastAutoTable.finalY + 8;
  if (y > 240) {
    doc.addPage();
    y = 14;
  }

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("KONDISI STOK", M, y);
  y += 3;
  doc.autoTable({
    startY: y,
    margin: { left: M, right: M },
    head: [["Cabang", "Produk", "Stok", "Status"]],
    body: filteredStok.map((r) => [
      r.cabang_nama,
      r.bibit_nama,
      parseFloat(r.jumlah) + (r.satuan_dasar || r.satuan || ""),
      r.jumlah < STOK_CRITICAL
        ? "Menipis"
        : r.jumlah < STOK_WARNING
          ? "Rendah"
          : "OK",
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [229, 227, 220],
      lineWidth: 0.2,
    },
    headStyles: { fillColor: [194, 24, 91], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [255, 248, 252] },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "center" } },
    didParseCell(d) {
      if (d.section === "body" && d.column.index === 3) {
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.textColor =
          d.cell.raw === "Menipis"
            ? [163, 45, 45]
            : d.cell.raw === "Rendah"
              ? [46, 125, 50]
              : [15, 110, 86];
      }
    },
  });
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFillColor(248, 247, 244);
    doc.rect(0, 287, W, 10, "F");
    doc.setTextColor(136, 135, 128);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(TOKO_NAMA, M, 293);
    doc.text("Hal " + i + "/" + total, W - M, 293, { align: "right" });
  }
  doc.save(
    `laporan-stok-${tgl}-${cabNama.toLowerCase().replace(/\s+/g, "-")}.pdf`,
  );
}

/* ================================================
   TAB USERS
   ================================================ */
async function buildUsersTab(target) {
  target.innerHTML = '<div class="loading">Memuat...</div>';
  try {
    const data = await api(BASE_URL + "/api/users.php");
    const users = data.users || [];
    const sess = window.CURRENT_USER;

    const rows = users
      .map(
        (u) => `<tr>
      <td><div style="display:flex;align-items:center;gap:8px">
        <div class="avatar av-${u.role}">${esc(u.nama.charAt(0))}</div><span>${esc(u.nama)}</span>
      </div></td>
      <td><code>${esc(u.username)}</code></td>
      <td><span class="badge badge-${u.role}">${u.role === "admin" ? "Admin" : "Karyawan"}</span></td>
      <td style="color:var(--text2)">${u.cabang_nama ? esc(u.cabang_nama) : "—"}</td>
      <td><span class="badge" style="background:${u.aktif ? "var(--teal-l)" : "var(--red-l)"};color:${u.aktif ? "var(--teal)" : "var(--red)"}">${u.aktif ? "Aktif" : "Nonaktif"}</span></td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-sm btn-teal" onclick="openEditUser(${u.id})">Edit</button>
        ${u.id !== sess?.id ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">Hapus</button>` : '<span style="font-size:11px;color:var(--text2)">Anda</span>'}
      </div></td>
    </tr>`,
      )
      .join("");

    target.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
        <button class="btn btn-primary" onclick="openAddUser()">+ Tambah User</button>
      </div>
      <div class="card"><div class="tbl-wrap"><table>
        <thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Cabang</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div></div>`;

    $("mu-cabang").innerHTML = (data.cabang || [])
      .map((c) => `<option value="${c.id}">${esc(c.nama)}</option>`)
      .join("");
  } catch (e) {
    target.innerHTML =
      '<div class="alert alert-danger">Gagal memuat user</div>';
  }
}

function openAddUser() {
  editUserId = null;
  $("mu-title").textContent = "Tambah User Baru";
  $("mu-nama").value = $("mu-user").value = $("mu-pass").value = "";
  $("mu-role").value = "karyawan";
  $("mu-err").textContent = "";
  $("mu-pass-hint").textContent = "";
  $("mu-cabang-wrap").style.display = "block";
  openModal("modal-user");
}

async function openEditUser(id) {
  editUserId = id;
  const data = await api(BASE_URL + "/api/users.php");
  const u = data.users.find((x) => x.id === id);
  if (!u) return;
  $("mu-title").textContent = "Edit User";
  $("mu-nama").value = u.nama;
  $("mu-user").value = u.username;
  $("mu-pass").value = "";
  $("mu-err").textContent = "";
  $("mu-role").value = u.role;
  $("mu-pass-hint").textContent = "(kosongkan jika tidak diubah)";
  $("mu-cabang").value = u.cabang_id || "";
  $("mu-cabang-wrap").style.display = u.role === "admin" ? "none" : "block";
  openModal("modal-user");
}

function toggleCabangField() {
  $("mu-cabang-wrap").style.display =
    $("mu-role").value === "admin" ? "none" : "block";
}

async function saveUser() {
  const body = {
    nama: $("mu-nama").value.trim(),
    username: $("mu-user").value.trim(),
    password: $("mu-pass").value,
    role: $("mu-role").value,
    cabang_id: parseInt($("mu-cabang").value) || null,
  };
  if (editUserId) body.id = editUserId;
  try {
    await api(BASE_URL + "/api/users.php", editUserId ? "PUT" : "POST", body);
    closeModal("modal-user");
    renderAdminContent();
  } catch (e) {
    $("mu-err").textContent = e.message;
  }
}

async function deleteUser(id) {
  if (!confirm("Hapus user ini?")) return;
  await api(BASE_URL + "/api/users.php", "DELETE", { id });
  renderAdminContent();
}

/* ================================================
   TAB PRODUK
   ================================================ */
let produkKeyword = "";
let produkPage = 1;
const PRODUK_PER_PAGE = 25;

function buildProdukTab() {
  // Render struktur utama — list produk diisi terpisah via renderProdukList()
  // 111111
  const cabList = cabangData
    .map(
      (c) => `
    <div id="cabang-row-${c.id}" style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:0.5px solid var(--border);gap:8px">
      <span id="cabang-label-${c.id}" style="font-size:13px;flex:1">${esc(c.nama)}</span>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-sm btn-teal" onclick="editInlineCabang(${c.id},'${esc(c.nama)}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProduk('cabang',${c.id})">Hapus</button>
      </div>
    </div>`,
    )
    .join("");

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <button class="btn btn-primary" onclick="openModal('modal-stok');populateStokModal()">+ Distribusi / Edit Stok</button>
      <button class="btn btn-primary" onclick="openBibitModal()">+ Produk Baru</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div class="card">
        <div class="card-header">
          <span class="card-title" id="produk-card-title">Daftar Produk (${bibitData.length})</span>
        </div>
        <div class="produk-search-bar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" id="produk-search"
            placeholder="Cari nama produk..."
            value="${esc(produkKeyword)}"
            oninput="filterDaftarProduk(this.value)"/>
        </div>
        <div id="produk-list-wrap"></div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Daftar Cabang (${cabangData.length})</span>
          <button class="btn btn-sm" onclick="openModal('modal-cabang')">+ Cabang</button>
        </div>
        ${cabList}
      </div>
    </div>`;
}

// Render HANYA bagian list — tidak menyentuh input search
function renderProdukList() {
  const listWrap = $("produk-list-wrap");
  if (!listWrap) return;

  const filtered = bibitData.filter(
    (b) =>
      !produkKeyword ||
      b.nama.toLowerCase().includes(produkKeyword.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUK_PER_PAGE));
  if (produkPage > totalPages) produkPage = 1;
  const start = (produkPage - 1) * PRODUK_PER_PAGE;
  const paged = filtered.slice(start, start + PRODUK_PER_PAGE);

  // Update judul
  const titleEl = $("produk-card-title");
  if (titleEl)
    titleEl.textContent = produkKeyword
      ? `Daftar Produk (${filtered.length} hasil)`
      : `Daftar Produk (${bibitData.length})`;

  const bibList = paged.length
    ? paged
        .map(
          (b) => `
      <div id="bibit-row-${b.id}" style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:0.5px solid var(--border);gap:8px">
        <div style="flex:1">
          <span style="font-size:13px;font-weight:500">${esc(b.nama)}</span>
          <span style="font-size:11px;color:var(--text2);margin-left:5px">[${esc(b.satuan_dasar || b.satuan || "ml")}]</span>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-sm btn-teal" onclick="editInlineBibit(${b.id},'${esc(b.nama)}')">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteProduk('bibit',${b.id})">Hapus</button>
        </div>
      </div>`,
        )
        .join("")
    : '<div class="empty" style="padding:1.5rem">Produk tidak ditemukan</div>';

  const pagHTML =
    filtered.length > PRODUK_PER_PAGE
      ? `
    <div class="pagination" style="padding-top:10px">
      <div class="pagination-info">${start + 1}–${Math.min(start + PRODUK_PER_PAGE, filtered.length)} dari ${filtered.length}</div>
      <div class="pagination-btns">
        <button class="page-btn" onclick="goProdukPage(${produkPage - 1})" ${produkPage <= 1 ? "disabled" : ""}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <span style="font-size:13px;padding:0 8px;color:var(--text2)">${produkPage}/${totalPages}</span>
        <button class="page-btn" onclick="goProdukPage(${produkPage + 1})" ${produkPage >= totalPages ? "disabled" : ""}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
    </div>`
      : "";

  listWrap.innerHTML = bibList + pagHTML;
}

function filterDaftarProduk(val) {
  produkKeyword = val || "";
  produkPage = 1;
  renderProdukList(); // hanya update list, TIDAK re-render input
}

function goProdukPage(page) {
  produkPage = page;
  renderProdukList();
}

// ---- Searchable Select untuk Bibit di Modal Stok ----
function populateStokModal() {
  // Render checkbox list untuk multi-select cabang
  const listEl = $("ms-cabang-list");
  if (listEl) {
    listEl.innerHTML = cabangData
      .map(
        (c) => `
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;padding:3px 0">
        <input type="checkbox" class="ms-cabang-cb" value="${c.id}"
          style="width:15px;height:15px;accent-color:var(--amber);cursor:pointer"/>
        ${esc(c.nama)}
      </label>`,
      )
      .join("");
  }
  clearSSBibit();
}

function pilihSemuaCabang() {
  document
    .querySelectorAll(".ms-cabang-cb")
    .forEach((cb) => (cb.checked = true));
}

function hapusSemuaCabang() {
  document
    .querySelectorAll(".ms-cabang-cb")
    .forEach((cb) => (cb.checked = false));
}

function getSelectedCabangs() {
  return [...document.querySelectorAll(".ms-cabang-cb:checked")].map((cb) =>
    parseInt(cb.value),
  );
}

function filterSSBibit() {
  const q = $("ss-bibit-input")?.value.toLowerCase().trim() || "";
  const drop = $("ss-bibit-drop");
  if (!drop) return;

  if (!q) {
    drop.classList.add("ss-hide");
    return;
  }

  const filtered = bibitData.filter((b) => b.nama.toLowerCase().includes(q));

  if (!filtered.length) {
    drop.innerHTML = '<div class="ss-empty">Produk tidak ditemukan</div>';
    drop.classList.remove("ss-hide");
    return;
  }

  drop.innerHTML = filtered
    .map((b) => {
      const sat = b.satuan_dasar || b.satuan || "ml";
      return `<div class="ss-item" onclick="pilihSSBibit(${b.id})">
      <span class="ss-item-nama">${esc(b.nama)}</span>
      <span class="ss-item-badge">${esc(sat)}</span>
    </div>`;
    })
    .join("");
  drop.classList.remove("ss-hide");
}

function pilihSSBibit(id) {
  const bibit = bibitData.find((b) => b.id == id);
  if (!bibit) return;

  // Set hidden input
  if ($("ms-bibit")) $("ms-bibit").value = id;

  // Tampilkan selected dengan info lengkap
  const selEl = $("ss-bibit-selected");
  const selNama = $("ss-bibit-nama");
  const selMeta = $("ss-bibit-meta");
  const inputWrap = $("ss-bibit-input")?.closest(".ss-input-wrap");

  if (selEl) selEl.style.display = "flex";
  if (selNama) selNama.textContent = bibit.nama;
  if (selMeta)
    selMeta.textContent =
      "Satuan: " +
      (bibit.satuan_dasar || bibit.satuan || "ml") +
      (bibit.konversi > 1
        ? "  ·  1 " +
          bibit.satuan +
          " = " +
          bibit.konversi +
          " " +
          bibit.satuan_dasar
        : "");
  if (inputWrap) inputWrap.style.display = "none";

  // Tutup dropdown & reset input
  $("ss-bibit-drop")?.classList.add("ss-hide");
  if ($("ss-bibit-input")) $("ss-bibit-input").value = "";

  // Update satuan info di bawah jumlah
  updateModalSatuan();
}

function clearSSBibit() {
  if ($("ms-bibit")) $("ms-bibit").value = "";
  if ($("ss-bibit-input")) $("ss-bibit-input").value = "";
  if ($("ss-bibit-selected")) $("ss-bibit-selected").style.display = "none";
  if ($("ss-bibit-drop")) $("ss-bibit-drop").classList.add("ss-hide");
  if ($("ms-satuan-label")) $("ms-satuan-label").textContent = "";
  if ($("ms-satuan-info")) $("ms-satuan-info").textContent = "";
  // Tampilkan kembali input wrap
  const inputWrap = $("ss-bibit-input")?.closest(".ss-input-wrap");
  if (inputWrap) inputWrap.style.display = "flex";
  $("ss-bibit-input")?.focus();
}

function updateModalSatuan() {
  const bibitId = $("ms-bibit")?.value;
  const bibit = bibitData.find((b) => b.id == bibitId);
  if (!bibit) return;
  const sat = bibit.satuan_dasar || bibit.satuan || "ml";
  const lbl = $("ms-satuan-label");
  const inf = $("ms-satuan-info");
  if (lbl) lbl.textContent = `(${sat})`;
  if (inf)
    inf.textContent =
      bibit.konversi > 1
        ? `Satuan stok: ${sat}. 1 ${bibit.satuan} = ${bibit.konversi} ${sat}`
        : "";
}

function openEditStok(cabang_id, bibit_id) {
  populateStokModal();

  // Pre-select cabang tertentu
  setTimeout(() => {
    document.querySelectorAll(".ms-cabang-cb").forEach((cb) => {
      cb.checked = parseInt(cb.value) === cabang_id;
    });
  }, 50);

  $("ms-tipe").value = "tambah";
  $("ms-jumlah").value = "";
  if ($("ms-ket")) $("ms-ket").value = "";

  if (bibit_id) pilihSSBibit(bibit_id);
  openModal("modal-stok");

  setTimeout(() => {
    document.addEventListener("click", function handler(e) {
      if (!e.target.closest("#ss-bibit-wrap")) {
        $("ss-bibit-drop")?.classList.add("ss-hide");
        document.removeEventListener("click", handler);
      }
    });
  }, 100);
}

async function saveStokModal() {
  const bibit_id = parseInt($("ms-bibit")?.value);
  const cabangs = getSelectedCabangs();
  const jumlah = parseFloat($("ms-jumlah").value);
  const tipe = $("ms-tipe").value;
  const keterangan = $("ms-ket")?.value || "";

  if (!bibit_id) {
    toastWarn("Pilih produk terlebih dahulu");
    return;
  }
  if (!cabangs.length) {
    toastWarn("Pilih minimal 1 cabang");
    return;
  }
  if (isNaN(jumlah) || jumlah < 0 || (tipe === "tambah" && jumlah <= 0)) {
    toastWarn("Isi jumlah yang valid");
    return;
  }

  try {
    await api(BASE_URL + "/api/stok.php", "PUT", {
      cabang_ids: cabangs,
      bibit_id,
      jumlah,
      tipe,
      keterangan,
    });
    closeModal("modal-stok");
    await loadStokData();
    renderAdminContent();
    toastOk(
      `Stok berhasil diupdate ke ${cabangs.length} cabang`,
      "Distribusi Berhasil",
    );
  } catch (e) {
    alert(e.message);
  }
}

function openBibitModal() {
  $("mb-nama").value = $("mb-stok").value = "";
  if ($("mb-err")) $("mb-err").textContent = "";
  if ($("mb-kategori")) {
    $("mb-kategori").value = "parfum";
    updateSatuanOptions();
  }
  openModal("modal-bibit");
}

function updateSatuanOptions() {
  const kat = $("mb-kategori")?.value || "lainnya";
  const all = [
    { v: "ml", d: "ml", k: 1, l: "ml" },
    { v: "liter", d: "ml", k: 1000, l: "liter (1000ml)" },
    { v: "gram", d: "gram", k: 1, l: "gram" },
    { v: "kg", d: "gram", k: 1000, l: "kg (1000gram)" },
    { v: "pcs", d: "pcs", k: 1, l: "pcs" },
    { v: "botol", d: "botol", k: 1, l: "botol" },
    { v: "lusin", d: "pcs", k: 12, l: "lusin (12pcs)" },
    { v: "kodi", d: "pcs", k: 20, l: "kodi (20pcs)" },
    { v: "pack", d: "pack", k: 1, l: "pack" },
    { v: "box", d: "box", k: 1, l: "box" },
  ];
  const map = {
    parfum: ["ml", "liter", "gram"],
    laundry: ["botol", "pcs", "liter", "ml"],
    aksesoris: ["pcs", "lusin", "kodi", "box", "pack"],
    lainnya: all.map((o) => o.v),
  };
  const allowed = map[kat] || all.map((o) => o.v);
  const sel = $("mb-satuan");
  if (sel) {
    sel.innerHTML = all
      .filter((o) => allowed.includes(o.v))
      .map(
        (o) =>
          `<option value="${o.v}" data-dasar="${o.d}" data-konversi="${o.k}">${o.l}</option>`,
      )
      .join("");
    updateSatuanDasar();
  }
}

function updateSatuanDasar() {
  const sel = $("mb-satuan");
  if (!sel) return;
  const opt = sel.selectedOptions[0];
  const dasar = opt?.dataset.dasar || sel.value;
  const k = parseFloat(opt?.dataset.konversi || 1);
  if ($("mb-satuan-dasar")) $("mb-satuan-dasar").value = dasar;
  if ($("mb-satuan-label")) $("mb-satuan-label").textContent = sel.value;
  const info = $("mb-konversi-info");
  if (info) {
    info.style.display = k > 1 ? "block" : "none";
    info.textContent = k > 1 ? `1 ${sel.value} = ${k} ${dasar}` : "";
  }
}

async function saveBibit() {
  const sel = $("mb-satuan");
  const opt = sel?.selectedOptions[0];
  const body = {
    action: "tambah_bibit",
    nama: $("mb-nama").value.trim(),
    stok_awal: parseFloat($("mb-stok").value) || 0,
    satuan: sel?.value || "ml",
    satuan_dasar: opt?.dataset.dasar || "ml",
    konversi: parseFloat(opt?.dataset.konversi || 1),
  };
  if (!body.nama) {
    if ($("mb-err")) $("mb-err").textContent = "Nama wajib diisi";
    return;
  }
  try {
    await api(BASE_URL + "/api/users.php", "PATCH", body);
    closeModal("modal-bibit");
    await loadStokData();
    renderAdminContent();
  } catch (e) {
    if ($("mb-err")) $("mb-err").textContent = e.message;
    else toastErr(e.message);
  }
}

async function saveCabang() {
  const body = {
    action: "tambah_cabang",
    nama: $("mc-nama").value.trim(),
    alamat: $("mc-alamat").value.trim(),
  };
  if (!body.nama) {
    toastWarn("Masukkan nama cabang");
    return;
  }
  try {
    await api(BASE_URL + "/api/users.php", "PATCH", body);
    closeModal("modal-cabang");
    await loadStokData();
    renderAdminContent();
  } catch (e) {
    alert(e.message);
  }
}

function editInlineCabang(id, namaLama) {
  const row = document.getElementById("cabang-row-" + id);
  if (!row) return;
  row.innerHTML = `
    <input type="text" id="edit-cabang-input-${id}" value="${esc(namaLama)}"
      style="flex:1;font-size:13px;padding:5px 8px;border:1px solid var(--amber);border-radius:6px;outline:none"
      onkeydown="if(event.key==='Enter') simpanEditCabang(${id}); if(event.key==='Escape') renderAdminContent();"/>
    <div style="display:flex;gap:6px;flex-shrink:0">
      <button class="btn btn-sm btn-primary" onclick="simpanEditCabang(${id})">Simpan</button>
      <button class="btn btn-sm" onclick="renderAdminContent()">Batal</button>
    </div>`;
  document.getElementById("edit-cabang-input-" + id)?.focus();
}

async function simpanEditCabang(id) {
  const input = document.getElementById("edit-cabang-input-" + id);
  const nama = input?.value.trim();
  if (!nama) {
    toastWarn("Nama cabang tidak boleh kosong");
    return;
  }
  try {
    const res = await api(BASE_URL + "/api/users.php", "PATCH", {
      action: "edit_cabang",
      id,
      nama,
    });
    if (res.success) {
      toastOk("Nama cabang diperbarui");
      await loadStokData();
      renderAdminContent();
    } else {
      toastErr(res.message || "Gagal menyimpan");
    }
  } catch (e) {
    toastErr(e.message);
  }
}

function editInlineBibit(id, namaLama) {
  const wrap = document.getElementById("produk-list-wrap");
  if (!wrap) return;
  // Cari row berdasarkan id bibit
  const rows = wrap.querySelectorAll("[id^='bibit-row-']");
  const row = document.getElementById("bibit-row-" + id);
  if (!row) return;
  row.innerHTML = `
    <input type="text" id="edit-bibit-input-${id}" value="${esc(namaLama)}"
      style="flex:1;font-size:13px;padding:5px 8px;border:1px solid var(--amber);border-radius:6px;outline:none"
      onkeydown="if(event.key==='Enter') simpanEditBibit(${id}); if(event.key==='Escape') renderProdukList();"/>
    <div style="display:flex;gap:6px;flex-shrink:0">
      <button class="btn btn-sm btn-primary" onclick="simpanEditBibit(${id})">Simpan</button>
      <button class="btn btn-sm" onclick="renderProdukList()">Batal</button>
    </div>`;
  document.getElementById("edit-bibit-input-" + id)?.focus();
}

async function simpanEditBibit(id) {
  const input = document.getElementById("edit-bibit-input-" + id);
  const nama = input?.value.trim();
  if (!nama) {
    toastWarn("Nama produk tidak boleh kosong");
    return;
  }
  try {
    const res = await api(BASE_URL + "/api/users.php", "PATCH", {
      action: "edit_bibit",
      id,
      nama,
    });
    if (res.success) {
      toastOk("Nama produk diperbarui");
      await loadStokData();
      renderProdukList();
    } else {
      toastErr(res.message || "Gagal menyimpan");
    }
  } catch (e) {
    toastErr(e.message);
  }
}

async function deleteProduk(target, id) {
  if (!confirm(`Hapus ${target} ini?`)) return;
  await api(BASE_URL + "/api/stok.php", "DELETE", { target, id });
  await loadStokData();
  renderAdminContent();
}

/* ================================================
   MODAL HELPERS
   ================================================ */
function openModal(id) {
  $(id)?.classList.add("open");
}
function closeModal(id) {
  $(id)?.classList.remove("open");
}

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-bg"))
    e.target.classList.remove("open");
});

/* ================================================
   KARYAWAN INIT
   ================================================ */
let allProduk = [];
let selectedProduk = null;
let notaItems = [];

async function initKaryawan() {
  const tglEl = $("riwayat-tgl");
  if (tglEl)
    tglEl.value = (() => {
      const d = new Date();
      return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
      );
    })();

  await loadKaryawanData();

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#search-wrap"))
      $("k-dropdown")?.classList.add("hide");
  });
}

async function loadKaryawanData() {
  try {
    const data = await api(BASE_URL + "/api/stok.php");
    stokData = data.stok || [];
    bibitData = data.bibit || [];
    allProduk = bibitData;
  } catch (e) {
    console.error(e);
  }
}

/* ================================================
   KARYAWAN — TAB SWITCH
   ================================================ */
function kTab(name) {
  ["transaksi", "keluar", "riwayat", "stok", "rekap"].forEach((n) => {
    const el = $("ktab-" + n);
    const btn = $("ktab-btn-" + n);
    if (el) el.style.display = n === name ? "block" : "none";
    if (btn) btn.classList.toggle("active", n === name);
  });
  if (name === "riwayat") loadRiwayat();
  if (name === "keluar") loadKeluarHariIni();
  if (name === "stok") loadKaryawanStok();
  if (name === "rekap") {
    isiSelectBulanTahun("k-rekap-bulan", "k-rekap-tahun");
    loadRekapKaryawan();
  }
}

/* ================================================
   KARYAWAN — SEARCHABLE DROPDOWN
   ================================================ */
function filterProduk() {
  const q = $("k-search")?.value.toLowerCase().trim() || "";
  const drop = $("k-dropdown");
  if (!drop) return;

  if (!q) {
    drop.classList.add("hide");
    return;
  }

  const filtered = allProduk.filter((p) => p.nama.toLowerCase().includes(q));
  if (!filtered.length) {
    drop.innerHTML = '<div class="sdrop-empty">Produk tidak ditemukan</div>';
    drop.classList.remove("hide");
    return;
  }

  drop.innerHTML = filtered
    .map((p) => {
      const myStok = stokData.find(
        (s) => s.bibit_id == p.id && s.cabang_id == CURRENT_USER.cabang_id,
      );
      const sisa = myStok ? parseFloat(myStok.jumlah) : 0;
      const sat = p.satuan_dasar || p.satuan || "ml";
      return `<div class="sdrop-item" onclick="pilihProduk(${p.id})">
      ${esc(p.nama)}
      <div class="sdrop-sub">Stok: ${sisa} ${esc(sat)}</div>
    </div>`;
    })
    .join("");
  drop.classList.remove("hide");
}

function pilihProduk(id) {
  selectedProduk = allProduk.find((p) => p.id == id);
  if (!selectedProduk) return;

  $("k-dropdown")?.classList.add("hide");
  $("k-search").value = "";

  const sel = $("k-selected");
  const selNama = $("k-selected-nama");
  if (sel) sel.style.display = "flex";
  if (selNama) selNama.textContent = selectedProduk.nama;

  const form = $("k-detail-form");
  if (form) form.style.display = "block";

  // Isi satuan
  const satuanSel = $("k-satuan");
  if (satuanSel) {
    const opts = [];
    // Satuan dasar
    opts.push({
      v: selectedProduk.satuan_dasar || selectedProduk.satuan || "ml",
      l: selectedProduk.satuan_dasar || selectedProduk.satuan || "ml",
      k: 1,
    });
    // Satuan jual kalau beda
    if (
      selectedProduk.satuan !== selectedProduk.satuan_dasar &&
      selectedProduk.konversi > 1
    ) {
      opts.unshift({
        v: selectedProduk.satuan,
        l: `${selectedProduk.satuan} (=${selectedProduk.konversi} ${selectedProduk.satuan_dasar})`,
        k: selectedProduk.konversi,
      });
    }
    // Tambah satuan populer
    [
      { v: "pcs", l: "pcs", k: 1 },
      { v: "lusin", l: "lusin (12pcs)", k: 12 },
      { v: "botol", l: "botol", k: 1 },
      { v: "ml", l: "ml", k: 1 },
    ].forEach((o) => {
      if (!opts.find((x) => x.v === o.v)) opts.push(o);
    });
    satuanSel.innerHTML = opts
      .map(
        (o) => `<option value="${o.v}" data-konversi="${o.k}">${o.l}</option>`,
      )
      .join("");
  }

  // Stok hint
  const myStok = stokData.find(
    (s) => s.bibit_id == id && s.cabang_id == CURRENT_USER.cabang_id,
  );
  const sisa = myStok ? parseFloat(myStok.jumlah) : 0;
  const hint = $("k-stok-hint");
  if (hint) {
    hint.textContent = `Stok tersedia: ${sisa} ${selectedProduk.satuan_dasar || selectedProduk.satuan || "ml"}`;
    hint.className = "stok-hint" + (sisa <= 5 ? " warn" : "");
  }

  $("k-jumlah").focus();
}

function clearProduk() {
  selectedProduk = null;
  const sel = $("k-selected");
  if (sel) sel.style.display = "none";
  const form = $("k-detail-form");
  if (form) form.style.display = "none";
  if ($("k-search")) $("k-search").value = "";
  if ($("k-jumlah")) $("k-jumlah").value = "";
  if ($("k-harga")) $("k-harga").value = "";
  if ($("k-subtotal")) $("k-subtotal").textContent = "Rp 0";
}

function hitungSubtotal() {
  const jml = parseFloat($("k-jumlah")?.value) || 0;
  const harga = parseFloat($("k-harga")?.value) || 0;
  const el = $("k-subtotal");
  if (el) el.textContent = "Rp " + (jml * harga).toLocaleString("id-ID");
}

/* ================================================
   KARYAWAN — NOTA
   ================================================ */
function tambahItem() {
  if (!selectedProduk) return;
  const jumlah = parseFloat($("k-jumlah").value) || 0;
  const harga = parseFloat($("k-harga").value) || 0;
  const satuanEl = $("k-satuan");
  const satuan = satuanEl?.value || selectedProduk.satuan_dasar || "ml";
  const konversi = parseFloat(
    satuanEl?.selectedOptions[0]?.dataset.konversi || 1,
  );

  if (jumlah <= 0) {
    toastWarn("Jumlah harus lebih dari 0");
    return;
  }
  if (harga < 0) {
    toastWarn("Harga tidak boleh negatif");
    return;
  }

  const jumlah_stok = jumlah * konversi;
  const myStok = stokData.find(
    (s) =>
      s.bibit_id == selectedProduk.id && s.cabang_id == CURRENT_USER.cabang_id,
  );
  const sisa = myStok ? parseFloat(myStok.jumlah) : 0;
  const sudahDiNota = notaItems
    .filter((i) => i.bibit_id == selectedProduk.id)
    .reduce((s, i) => s + i.jumlah_stok, 0);

  if (jumlah_stok + sudahDiNota > sisa) {
    toastErr(
      `Dibutuhkan: ${jumlah_stok + sudahDiNota} ${selectedProduk.satuan_dasar || ""}, tersedia: ${sisa}`,
      "Stok Tidak Cukup",
    );
    return;
  }

  notaItems.push({
    bibit_id: selectedProduk.id,
    bibit_nama: selectedProduk.nama,
    satuan_jual: satuan,
    jumlah_jual: jumlah,
    jumlah_stok,
    harga_satuan: harga,
    subtotal: jumlah * harga,
    satuan_dasar: selectedProduk.satuan_dasar || selectedProduk.satuan || "ml",
  });

  renderNota();
  clearProduk();
}

function hapusItem(idx) {
  notaItems.splice(idx, 1);
  renderNota();
}

function renderNota() {
  const wrap = $("k-nota-wrap");
  if (!wrap) return;
  if (!notaItems.length) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "block";

  const items = notaItems
    .map(
      (item, i) => `
    <div class="nota-item">
      <div class="nota-item-info">
        <div class="nota-item-nama">${esc(item.bibit_nama)}</div>
        <div class="nota-item-sub">${item.jumlah_jual} ${esc(item.satuan_jual)}${item.satuan_jual !== item.satuan_dasar ? " → " + item.jumlah_stok + " " + esc(item.satuan_dasar) : ""}</div>
      </div>
      <div class="nota-item-price">
        <div class="nota-item-total">Rp ${item.subtotal.toLocaleString("id-ID")}</div>
        <div class="nota-item-unit">@ Rp ${item.harga_satuan.toLocaleString("id-ID")}</div>
      </div>
      <button class="nota-del" onclick="hapusItem(${i})">×</button>
    </div>`,
    )
    .join("");

  $("k-nota-items").innerHTML = items;
  const total = notaItems.reduce((s, i) => s + i.subtotal, 0);
  $("k-total").textContent = "Rp " + total.toLocaleString("id-ID");
  const cnt = $("k-nota-count");
  if (cnt) cnt.textContent = notaItems.length + " item";
}

function batalNota() {
  if (!notaItems.length || confirm("Batalkan nota ini?")) {
    notaItems = [];
    renderNota();
    clearProduk();
  }
}

async function simpanTransaksi() {
  if (!notaItems.length) {
    toastWarn("Tambahkan produk ke nota terlebih dahulu");
    return;
  }
  const catatan = $("k-catatan")?.value || "";
  try {
    const res = await api(BASE_URL + "/api/transaksi.php", "POST", {
      items: notaItems,
      catatan,
    });
    if (res.success) {
      await loadKaryawanData();
      notaItems = [];
      renderNota();
      clearProduk();
      if ($("k-catatan")) $("k-catatan").value = "";
      toastOk(
        `Nota: ${res.kode_nota} — Total: Rp ${parseFloat(res.total).toLocaleString("id-ID")}`,
        "Transaksi Berhasil!",
      );
    } else {
      toastErr(res.message);
    }
  } catch (e) {
    toastErr(e.message);
  }
}

/* ================================================
   KARYAWAN — RIWAYAT
   ================================================ */

async function konfirmasiBatal(id, kodeNota) {
  if (
    !confirm(`Batalkan nota ${kodeNota}?

Stok akan dikembalikan secara otomatis.
Aksi ini tidak bisa diurungkan.`)
  )
    return;
  try {
    const res = await api(BASE_URL + "/api/transaksi.php", "DELETE", { id });
    if (res.success) {
      // Refresh stok lokal
      await loadKaryawanData();
      // Reload riwayat
      await loadRiwayat();
      toastOk("Stok sudah dikembalikan.", "Nota Dibatalkan");
    } else {
      toastErr(res.message);
    }
  } catch (e) {
    toastErr(e.message);
  }
}

function printNota(t) {
  const toko =
    typeof TOKO_NAMA !== "undefined" ? TOKO_NAMA : "Mekar Wangi Indonesia";
  const cabang =
    typeof CURRENT_USER !== "undefined" ? CURRENT_USER.cabang_nama || "" : "";
  const items = (t.items || [])
    .map(
      (item) =>
        `<tr>
      <td>${esc(item.bibit_nama)}</td>
      <td style="text-align:center">${parseFloat(item.jumlah_jual)} ${esc(item.satuan_jual)}</td>
      <td style="text-align:right">Rp ${parseFloat(item.harga_satuan).toLocaleString("id-ID")}</td>
      <td style="text-align:right">Rp ${parseFloat(item.subtotal).toLocaleString("id-ID")}</td>
    </tr>`,
    )
    .join("");

  const total = parseFloat(t.total).toLocaleString("id-ID");
  const waktu = t.created_at || "";
  const catatan = t.catatan
    ? `<div class="catatan">📝 ${esc(t.catatan)}</div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>Nota ${esc(t.kode_nota)}</title>
  <style>
    /* =============================================
       PENGATURAN UKURAN KERTAS THERMAL
       Ganti nilai di bawah sesuai printer kamu:
       - Kertas 58mm  → width: 58mm
       - Kertas 80mm  → width: 80mm
       ============================================= */
    :root {
      --paper-width: 58mm;   /* ← UBAH DI SINI sesuai lebar kertas */
      --font-size: 15px;     /* ← UBAH jika teks terlalu kecil/besar */
    }
    @page {
      size: var(--paper-width) auto;
      margin: 0;
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Montserrat', sans-serif; font-size: var(--font-size); width: var(--paper-width); margin: 0 auto; padding: 8px; }
    .header { text-align:center; border-bottom: 1px dashed #000; padding-bottom:8px; margin-bottom:8px; }
    .header h2 { font-size:14px; font-weight:700; }
    .header p { font-size:11px; color:#555; margin-top:2px; }
    .nota-info { margin-bottom:8px; font-size:11px; }
    .nota-info div { display:flex; justify-content:space-between; margin-bottom:2px; }
    table { width:100%; border-collapse:collapse; margin-bottom:8px; }
    th { font-size:10px; border-bottom:1px solid #000; padding:3px 2px; text-align:left; }
    td { font-size:11px; padding:3px 2px; vertical-align:top; }
    .total-row { border-top:1px dashed #000; padding-top:6px; display:flex; justify-content:space-between; font-weight:700; font-size:13px; margin-bottom:8px; }
    .catatan { font-size:11px; color:#555; margin-bottom:8px; }
    .footer { text-align:center; border-top:1px dashed #000; padding-top:8px; font-size:10px; color:#777; }
    @media print {
      body { width:100%; }
      button { display:none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>${esc(toko)}</h2>
    <p>${esc(cabang)}</p>
    <p style="margin-top:4px;font-size:10px">================================</p>
  </div>
  <div class="nota-info">
    <div><span>No. Nota</span><span><b>${esc(t.kode_nota)}</b></span></div>
    <div><span>Waktu</span><span>${esc(waktu)}</span></div>
    <div><span>Kasir</span><span>${esc(t.user_nama || "")}</span></div>
  </div>
  <table>
    <thead><tr><th>Produk</th><th style="text-align:center">Jml</th><th style="text-align:right">Harga</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${items}</tbody>
  </table>
  <div class="total-row">
    <span>TOTAL</span>
    <span>Rp ${total}</span>
  </div>
  ${catatan}
  <div class="footer">
    <p>Terima kasih atas pembelian Anda!</p>
    <p style="margin-top:4px">${esc(toko)}</p>
  </div>
  <div style="text-align:center;margin-top:12px">
    <button onclick="window.print()" style="padding:6px 20px;font-size:12px;cursor:pointer;border:1px solid #333;border-radius:4px;background:#fff">🖨️ Print</button>
  </div>
</body>
</html>`;

  // Gunakan iframe tersembunyi agar tidak diblokir browser mobile (HP)
  let iframe = document.getElementById("print-nota-frame");
  if (iframe) iframe.remove();

  iframe = document.createElement("iframe");
  iframe.id = "print-nota-frame";
  iframe.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;";
  document.body.appendChild(iframe);

  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      // Fallback jika iframe gagal — buka tab baru
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(() => win.print(), 400);
      } else toastWarn("Tidak bisa mencetak. Coba izinkan popup di browser.");
    }
  }, 600);
}

async function exportPDFKaryawan() {
  const tgl =
    $("riwayat-tgl")?.value ||
    (() => {
      const d = new Date();
      return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
      );
    })();
  const tglStr = new Date(tgl).toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Ambil transaksi masuk & pengeluaran sekaligus
  const [resTrx, resKel] = await Promise.all([
    api(`${BASE_URL}/api/transaksi.php?tanggal=${tgl}&per_page=200`),
    api(`${BASE_URL}/api/pengeluaran.php?tanggal=${tgl}&per_page=200`),
  ]);

  const trxs = resTrx.transaksis || [];
  const kels = resKel.pengeluaran || [];
  const totalMasuk = parseFloat(resTrx.total_omzet || 0);
  const totalKeluar = parseFloat(resKel.total_nominal || 0);
  const labaBersih = totalMasuk - totalKeluar;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210,
    M = 14;
  let y = 0;

  // Header
  doc.setFillColor(61, 82, 160);
  doc.rect(0, 0, W, 34, "F");
  doc.setFillColor(100, 120, 192);
  doc.rect(0, 28, W, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Laporan Harian — " + (CURRENT_USER.cabang_nama || ""), M, 13);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(tglStr, M, 21);
  doc.text(
    "Karyawan: " +
      CURRENT_USER.nama +
      "   |   Dicetak: " +
      new Date().toLocaleString("id-ID"),
    M,
    29,
  );
  y = 44;

  // Ringkasan 3 kotak
  const bw = (W - M * 2 - 8) / 3;
  const boxes = [
    {
      label: "Total Masuk",
      val: "Rp " + totalMasuk.toLocaleString("id-ID"),
      color: [61, 82, 160],
    },
    {
      label: "Total Keluar",
      val: "Rp " + totalKeluar.toLocaleString("id-ID"),
      color: [163, 45, 45],
    },
    {
      label: labaBersih >= 0 ? "Laba Bersih" : "Rugi Bersih",
      val: "Rp " + Math.abs(labaBersih).toLocaleString("id-ID"),
      color: labaBersih >= 0 ? [15, 110, 86] : [163, 45, 45],
    },
  ];
  boxes.forEach((b, i) => {
    const bx = M + i * (bw + 4);
    doc.setFillColor(248, 247, 244);
    doc.roundedRect(bx, y, bw, 18, 2, 2, "F");
    if (i === 2) {
      doc.setFillColor(
        labaBersih >= 0 ? 225 : 255,
        labaBersih >= 0 ? 245 : 235,
        labaBersih >= 0 ? 238 : 235,
      );
      doc.roundedRect(bx, y, bw, 18, 2, 2, "F");
    }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...b.color);
    doc.text(b.val, bx + bw / 2, y + 9, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(136, 135, 128);
    doc.text(b.label, bx + bw / 2, y + 15, { align: "center" });
  });
  y += 26;

  // Tabel transaksi masuk
  doc.setTextColor(61, 82, 160);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("TRANSAKSI MASUK", M, y);
  y += 3;

  const allRows = [];
  trxs
    .filter((t) => !t.kode_nota.startsWith("BATAL-"))
    .forEach((t) => {
      (t.items || []).forEach((item, i) => {
        allRows.push([
          i === 0 ? t.kode_nota : "",
          i === 0 ? (t.created_at.split(" ")[1] || "").substring(0, 5) : "",
          item.bibit_nama,
          `${parseFloat(item.jumlah_jual)} ${item.satuan_jual}`,
          "Rp " + parseFloat(item.harga_satuan).toLocaleString("id-ID"),
          "Rp " + parseFloat(item.subtotal).toLocaleString("id-ID"),
        ]);
      });
      if (t.catatan) {
        allRows.push(["", "", "Catatan: " + t.catatan, "", "", ""]);
      }
      allRows.push([
        "",
        "",
        "",
        "",
        "TOTAL NOTA",
        "Rp " + parseFloat(t.total).toLocaleString("id-ID"),
      ]);
    });

  doc.autoTable({
    startY: y,
    margin: { left: M, right: M },
    head: [["No. Nota", "Jam", "Produk", "Jumlah", "Harga", "Subtotal"]],
    body: allRows.length
      ? allRows
      : [["—", "—", "Tidak ada transaksi masuk", "—", "—", "—"]],
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [229, 227, 220],
      lineWidth: 0.2,
    },
    headStyles: { fillColor: [61, 82, 160], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 249, 255] },
    columnStyles: {
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
    },
    didParseCell(d) {
      if (d.section === "body" && d.row.raw[4] === "TOTAL NOTA") {
        d.cell.styles.fillColor = [235, 238, 255];
        d.cell.styles.textColor = [61, 82, 160];
        d.cell.styles.fontStyle = "bold";
      }
      if (
        d.section === "body" &&
        d.column.index === 2 &&
        String(d.cell.raw).startsWith("📝")
      ) {
        d.cell.styles.textColor = [100, 100, 100];
        d.cell.styles.fontStyle = "italic";
        d.cell.styles.fontSize = 7;
      }
    },
  });

  y = doc.lastAutoTable.finalY + 8;
  if (y > 240) {
    doc.addPage();
    y = 14;
  }

  // Tabel pengeluaran
  doc.setTextColor(163, 45, 45);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("TRANSAKSI KELUAR (PENGELUARAN)", M, y);
  y += 3;

  const kelRows = kels.length
    ? kels.map((p) => [
        (p.created_at.split(" ")[1] || "").substring(0, 5),
        p.nama_item,
        p.keterangan || "—",
        "Rp " + parseFloat(p.nominal).toLocaleString("id-ID"),
      ])
    : [["—", "Tidak ada pengeluaran", "—", "—"]];

  doc.autoTable({
    startY: y,
    margin: { left: M, right: M },
    head: [["Jam", "Nama Item", "Keterangan", "Nominal"]],
    body: kelRows,
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [229, 227, 220],
      lineWidth: 0.2,
    },
    headStyles: { fillColor: [163, 45, 45], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [255, 249, 249] },
    columnStyles: {
      3: { halign: "right", fontStyle: "bold", textColor: [163, 45, 45] },
    },
  });

  y = doc.lastAutoTable.finalY + 8;
  if (y > 260) {
    doc.addPage();
    y = 14;
  }

  // Ringkasan akhir
  doc.setFillColor(248, 247, 244);
  doc.roundedRect(M, y, W - M * 2, 22, 3, 3, "F");
  const labColor = labaBersih >= 0 ? [15, 110, 86] : [163, 45, 45];
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(136, 135, 128);
  doc.text(
    "Total Masuk: Rp " + totalMasuk.toLocaleString("id-ID"),
    M + 4,
    y + 8,
  );
  doc.text(
    "Total Keluar: Rp " + totalKeluar.toLocaleString("id-ID"),
    M + 4,
    y + 15,
  );
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...labColor);
  doc.text(
    (labaBersih >= 0 ? "Laba" : "Rugi") +
      " Bersih: Rp " +
      Math.abs(labaBersih).toLocaleString("id-ID"),
    W - M,
    y + 12,
    { align: "right" },
  );

  // Footer
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFillColor(248, 247, 244);
    doc.rect(0, 287, W, 10, "F");
    doc.setTextColor(136, 135, 128);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(TOKO_NAMA + "— Laporan Harian", M, 293);
    doc.text("Hal " + i + "/" + total, W - M, 293, { align: "right" });
  }

  doc.save(`Laporan-Harian-${CURRENT_USER.cabang_nama || "cabang"}-${tgl}.pdf`);
}

let kStokPage = 1;
let kStokKeyword = "";
const K_STOK_PER_PAGE = 25;

async function loadKaryawanStok() {
  kStokPage = 1;
  kStokKeyword = $("stok-search")?.value || "";
  await loadKaryawanData();
  renderKaryawanStokPage();
}

function filterKaryawanStok(val) {
  kStokKeyword = val || "";
  kStokPage = 1;
  renderKaryawanStokPage(); // hanya update list, tidak re-render input
}

function goKStokPage(page) {
  kStokPage = page;
  renderKaryawanStokPage();
}

function renderKaryawanStokPage() {
  const tbody = $("k-stok-tbody");
  const pagEl = $("k-stok-pagination");
  const titleEl = $("k-stok-title");
  if (!tbody) return;

  // Filter data
  const myStok = stokData.filter((r) => r.cabang_id == CURRENT_USER.cabang_id);
  const filtered = kStokKeyword
    ? myStok.filter((r) =>
        r.bibit_nama.toLowerCase().includes(kStokKeyword.toLowerCase()),
      )
    : myStok;

  // Update judul
  if (titleEl)
    titleEl.textContent = kStokKeyword
      ? `Stok ${CURRENT_USER.cabang_nama || ""} (${filtered.length} hasil)`
      : `Stok ${CURRENT_USER.cabang_nama || ""} (${myStok.length} produk)`;

  // Pagination
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / K_STOK_PER_PAGE));
  if (kStokPage > totalPages) kStokPage = 1;
  const start = (kStokPage - 1) * K_STOK_PER_PAGE;
  const paged = filtered.slice(start, start + K_STOK_PER_PAGE);

  if (!paged.length) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="empty">Tidak ada produk ditemukan</td></tr>';
    if (pagEl) pagEl.innerHTML = "";
    return;
  }

  const rows = paged
    .map((r) => {
      const v = parseFloat(r.jumlah);
      const sat = r.satuan_dasar || r.satuan || "ml";
      const isMl = ["ml", "liter", "gram", "kg"].includes(sat);
      const warn = isMl ? STOK_WARNING : 5;
      const crit = isMl ? STOK_CRITICAL : 2;
      const cls = v <= crit ? "crit" : v <= warn ? "low" : "ok";
      return `<tr>
      <td>${esc(r.bibit_nama)}</td>
      <td><strong style="color:${v <= warn ? "var(--red)" : "var(--teal)"}">${v}</strong></td>
      <td>${esc(sat)}</td>
      <td><span class="badge badge-${cls}">${cls === "ok" ? "OK" : cls === "low" ? "Rendah" : "Menipis"}</span></td>
    </tr>`;
    })
    .join("");
  tbody.innerHTML = rows;

  // Render pagination
  if (pagEl) {
    pagEl.innerHTML =
      total > K_STOK_PER_PAGE
        ? buildPaginationHTML(
            {
              total,
              per_page: K_STOK_PER_PAGE,
              current: kStokPage,
              total_pages: totalPages,
              has_prev: kStokPage > 1,
              has_next: kStokPage < totalPages,
              from: start + 1,
              to: Math.min(start + K_STOK_PER_PAGE, total),
            },
            "goKStokPage",
          )
        : "";
  }
}

/* ================================================
   NOTIFIKASI IN-APP
   ================================================ */
let notifInterval = null;
let notifOpen = false;

async function loadNotifikasi() {
  try {
    const data = await api(BASE_URL + "/api/notifikasi.php");
    const total = data.total_unread || 0;
    const notifs = data.notifikasi || [];

    // Update badge
    const badge = $("notif-badge");
    const bell = $("notif-bell");
    if (badge) {
      if (total > 0) {
        badge.style.display = "flex";
        badge.textContent = total > 99 ? "99+" : total;
        bell?.classList.add("has-notif");
        // Animasi lonceng jika ada notif baru kritis
        if (data.total_kritis > 0) {
          bell?.classList.add("bell-shake");
          setTimeout(() => bell?.classList.remove("bell-shake"), 600);
        }
      } else {
        badge.style.display = "none";
        bell?.classList.remove("has-notif");
      }
    }

    // Update list jika dropdown terbuka
    if (notifOpen) renderNotifList(notifs);
  } catch (e) {
    console.error("loadNotifikasi:", e);
  }
}

function renderNotifList(notifs) {
  const list = $("notif-list");
  if (!list) return;

  if (!notifs.length) {
    list.innerHTML = `<div class="notif-empty">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      Semua stok dalam kondisi baik
    </div>`;
    return;
  }

  const items = notifs
    .map((n) => {
      const waktu = new Date(n.created_at).toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      const pesanTipe =
        n.tipe === "menipis"
          ? `Stok menipis! Hanya tersisa ${parseFloat(n.jumlah)} ${n.satuan}`
          : `Stok rendah, tersisa ${parseFloat(n.jumlah)} ${n.satuan}`;

      return `<div class="notif-item unread" onclick="bacaNotif(${n.id})">
      <div class="notif-dot ${n.tipe}"></div>
      <div class="notif-item-body">
        <div class="notif-item-title">${esc(n.bibit_nama)} — ${esc(n.cabang_nama)}</div>
        <div class="notif-item-meta">${pesanTipe} · ${waktu}</div>
      </div>
      <span class="notif-item-badge notif-badge-${n.tipe}">${n.tipe === "menipis" ? "Menipis" : "Rendah"}</span>
    </div>`;
    })
    .join("");

  list.innerHTML = `<div class="notif-list-wrap">${items}</div>
    <div class="notif-footer">
      <a onclick="bacaSemua()">Tandai semua sudah dibaca</a>
    </div>`;
}

function toggleNotifDropdown() {
  const dropdown = $("notif-dropdown");
  if (!dropdown) return;

  notifOpen = !notifOpen;
  dropdown.style.display = notifOpen ? "block" : "none";

  if (notifOpen) {
    // Load dan tampilkan notifikasi
    loadNotifikasi().then(() => {
      api(BASE_URL + "/api/notifikasi.php").then((data) => {
        renderNotifList(data.notifikasi || []);
      });
    });
  }
}

async function bacaNotif(id) {
  await api(BASE_URL + "/api/notifikasi.php", "POST", { id });
  await loadNotifikasi();
  // Langsung ke tab stok untuk lihat detail
  switchTab("stok");
  $("notif-dropdown").style.display = "none";
  notifOpen = false;
}

async function bacaSemua() {
  await api(BASE_URL + "/api/notifikasi.php", "POST", { id: "all" });
  await loadNotifikasi();
  renderNotifList([]);
  $("notif-dropdown").style.display = "none";
  notifOpen = false;
}

// Tutup dropdown jika klik di luar
document.addEventListener("click", (e) => {
  if (!e.target.closest("#notif-wrap") && notifOpen) {
    $("notif-dropdown").style.display = "none";
    notifOpen = false;
  }
});

function toggleAlertDetail(detailId, headerEl) {
  const detail = $(detailId);
  if (!detail) return;
  const isOpen = detail.style.display !== "none";
  detail.style.display = isOpen ? "none" : "block";
  const chevronId =
    detailId === "detail-kritis" ? "chevron-kritis" : "chevron-rendah";
  const chevron = $(chevronId);
  if (chevron) chevron.style.transform = isOpen ? "" : "rotate(180deg)";
}

/* ================================================
   REKAP BULANAN — SHARED HELPERS
   ================================================ */
let rekapChart = null; // simpan instance chart agar bisa destroy sebelum redraw

function getBulanTahun(idBulan, idTahun) {
  const bulan = parseInt(
    document.getElementById(idBulan)?.value || new Date().getMonth() + 1,
  );
  const tahun = parseInt(
    document.getElementById(idTahun)?.value || new Date().getFullYear(),
  );
  return { bulan, tahun };
}

function isiSelectBulanTahun(idBulan, idTahun) {
  const namaBulan = [
    "",
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const now = new Date();

  const selBulan = document.getElementById(idBulan);
  const selTahun = document.getElementById(idTahun);
  if (!selBulan || !selTahun) return;

  // Isi bulan
  if (!selBulan.innerHTML) {
    selBulan.innerHTML = namaBulan
      .slice(1)
      .map(
        (b, i) =>
          `<option value="${i + 1}" ${i + 1 === now.getMonth() + 1 ? "selected" : ""}>${b}</option>`,
      )
      .join("");
  }

  // Isi tahun (3 tahun ke belakang)
  if (!selTahun.innerHTML) {
    const tahunIni = now.getFullYear();
    selTahun.innerHTML = [tahunIni, tahunIni - 1, tahunIni - 2]
      .map(
        (y) =>
          `<option value="${y}" ${y === tahunIni ? "selected" : ""}>${y}</option>`,
      )
      .join("");
  }
}

function buildGrafik(canvasId, labels, omzetData, trxData, labaData) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Destroy chart lama jika ada
  if (rekapChart) {
    rekapChart.destroy();
    rekapChart = null;
  }

  // Filter hanya hari yang ada aktivitas
  const activeIdx = labels.reduce((acc, _, i) => {
    if ((trxData[i] || 0) > 0 || (omzetData[i] || 0) > 0) acc.push(i);
    return acc;
  }, []);
  const fl =
    activeIdx.length > 0
      ? activeIdx.map((i) => labels[i] + "")
      : labels.map((d) => d + "");
  const fo =
    activeIdx.length > 0 ? activeIdx.map((i) => omzetData[i] || 0) : omzetData;
  const fla =
    activeIdx.length > 0
      ? activeIdx.map((i) => (labaData || omzetData)[i] || 0)
      : labaData || omzetData;
  const ft =
    activeIdx.length > 0 ? activeIdx.map((i) => trxData[i] || 0) : trxData;

  const ctx = canvas.getContext("2d");
  rekapChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: fl,
      datasets: [
        {
          label: "Omzet (Rp)",
          data: fo,
          backgroundColor: "rgba(61,82,160,0.15)",
          borderColor: "#3D52A0",
          borderWidth: 2,
          borderRadius: 4,
          yAxisID: "y",
          order: 3,
        },
        {
          label: "Laba Bersih (Rp)",
          data: fla,
          type: "line",
          borderColor: "#C2185B",
          backgroundColor: "rgba(194,24,91,0.07)",
          pointBackgroundColor: "#C2185B",
          pointBorderColor: "#fff",
          pointBorderWidth: 1.5,
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          fill: false,
          yAxisID: "y",
          order: 2,
        },
        {
          label: "Transaksi",
          data: ft,
          type: "line",
          borderColor: "#7986CB",
          backgroundColor: "rgba(121,134,203,0.08)",
          borderWidth: 1.5,
          pointBackgroundColor: "#7986CB",
          borderDash: [4, 3],
          pointRadius: 3,
          tension: 0.3,
          yAxisID: "y1",
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          labels: { font: { size: 11 }, boxWidth: 12 },
        },
        tooltip: {
          backgroundColor: "rgba(30,30,50,0.88)",
          padding: 10,
          callbacks: {
            title: (items) => "Tgl " + items[0].label,
            label: (ctx) => {
              if (ctx.datasetIndex === 2)
                return "  Transaksi: " + ctx.raw + "x";
              const label = ctx.dataset.label.replace(" (Rp)", "");
              return "  " + label + ": Rp " + ctx.raw.toLocaleString("id-ID");
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: {
          position: "left",
          ticks: {
            font: { size: 10 },
            callback: (v) =>
              "Rp " +
              (v >= 1000000
                ? (v / 1000000).toFixed(1) + "jt"
                : v >= 1000
                  ? (v / 1000).toFixed(0) + "rb"
                  : v),
          },
          grid: { color: "rgba(0,0,0,0.05)" },
        },
        y1: {
          position: "right",
          ticks: {
            font: { size: 10 },
            stepSize: 1,
            callback: (v) => (Number.isInteger(v) ? v + "x" : ""),
          },
          grid: { display: false },
        },
      },
    },
  });
}

function buildRekapHTML(data, showCabangBreakdown) {
  const namaBulan = [
    "",
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  // Summary cards
  const laba = parseFloat(data.laba_bersih || data.total_omzet || 0);
  const totalKeluar = parseFloat(data.total_keluar || 0);
  const labaColor = laba >= 0 ? "var(--green)" : "var(--red)";

  const summaryHTML = `
    <div class="rekap-summary">
      <div class="rekap-sum-card">
        <div class="rekap-sum-val" style="color:var(--blue)">Rp ${parseFloat(data.total_omzet || 0).toLocaleString("id-ID")}</div>
        <div class="rekap-sum-lbl">Total Pemasukan</div>
      </div>
      <div class="rekap-sum-card">
        <div class="rekap-sum-val" style="color:var(--red)">Rp ${totalKeluar.toLocaleString("id-ID")}</div>
        <div class="rekap-sum-lbl">Total Pengeluaran</div>
      </div>
      <div class="rekap-sum-card" style="border:1.5px solid ${laba >= 0 ? "#9fe1cb" : "#f7c1c1"}">
        <div class="rekap-sum-val" style="color:${labaColor}">Rp ${laba.toLocaleString("id-ID")}</div>
        <div class="rekap-sum-lbl">${laba >= 0 ? "Laba Bersih" : "Rugi Bersih"}</div>
      </div>
      <div class="rekap-sum-card">
        <div class="rekap-sum-val">${data.total_transaksi || 0}</div>
        <div class="rekap-sum-lbl">Total Transaksi Masuk</div>
      </div>
      <div class="rekap-sum-card">
        <div class="rekap-sum-val">${data.hari_aktif || 0} hari</div>
        <div class="rekap-sum-lbl">Hari Aktif Jualan</div>
      </div>
      <div class="rekap-sum-card">
        <div class="rekap-sum-val" style="font-size:15px">Rp ${parseFloat(data.rata_omzet_per_hari || 0).toLocaleString("id-ID")}</div>
        <div class="rekap-sum-lbl">Rata-rata / Hari Aktif</div>
      </div>
    </div>`;

  // Grafik
  const grafikHTML = `
    <div class="rekap-card">
      <div class="rekap-card-title">Grafik Omzet Harian — ${esc(data.periode)}</div>
      <div style="height:240px;position:relative">
        <canvas id="rekap-chart"></canvas>
      </div>
    </div>`;

  // Tabel per cabang (hanya admin / kalau ada lebih dari 1)
  let cabangHTML = "";
  if (showCabangBreakdown && data.per_cabang?.length > 1) {
    const rows = data.per_cabang
      .map((c, i) => {
        const kel = (data.keluar_per_cabang || []).find(
          (k) => k.cabang_id == c.cabang_id,
        );
        const keluar = parseFloat(kel?.total_keluar || 0);
        const laba = parseFloat(c.total_omzet || 0) - keluar;
        const labaColor = laba >= 0 ? "var(--green)" : "var(--red)";
        return `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${esc(c.cabang_nama)}</strong></td>
        <td style="text-align:right">${c.jumlah_transaksi || 0}</td>
        <td style="text-align:right"><strong>Rp ${parseFloat(c.total_omzet || 0).toLocaleString("id-ID")}</strong></td>
        <td style="text-align:right;color:var(--red)">Rp ${keluar.toLocaleString("id-ID")}</td>
        <td style="text-align:right;color:${labaColor};"><strong>Rp ${laba.toLocaleString("id-ID")}</strong></td>
        <td style="text-align:right">Rp ${parseFloat(c.rata_transaksi || 0).toLocaleString("id-ID")}</td>
      </tr>`;
      })
      .join("");

    cabangHTML = `
      <div class="rekap-card">
        <div class="rekap-card-title">Omzet per Cabang</div>
        <div class="tbl-wrap"><table>
          <thead><tr>
            <th>#</th>
            <th>Cabang</th>
            <th style="text-align:right">Transaksi</th>
            <th style="text-align:right">Total Omzet</th>
            <th style="text-align:right">Pengeluaran</th>
            <th style="text-align:right">Laba Bersih</th>
            <th style="text-align:right">Rata-rata/Nota</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`;
  }

  // Tabel produk terlaris
  let terlaris = data.produk_terlaris || [];
  // Gabungkan per produk (bisa ada duplikat beda satuan)
  const terlarisMap = {};
  terlaris.forEach((p) => {
    const key = p.bibit_id + (showCabangBreakdown ? "" : "");
    if (!terlarisMap[key]) {
      terlarisMap[key] = {
        ...p,
        total_omzet: parseFloat(p.total_omzet || 0),
        total_terjual: parseFloat(p.total_terjual || 0),
        frekuensi: parseInt(p.frekuensi || 0),
      };
    } else {
      terlarisMap[key].total_omzet += parseFloat(p.total_omzet || 0);
      terlarisMap[key].total_terjual += parseFloat(p.total_terjual || 0);
      terlarisMap[key].frekuensi += parseInt(p.frekuensi || 0);
    }
  });
  const terlarisArr = Object.values(terlarisMap)
    .sort((a, b) => b.total_omzet - a.total_omzet)
    .slice(0, 10);

  const terlarisRows = terlarisArr.length
    ? terlarisArr
        .map(
          (p, i) => `
      <tr>
        <td><span style="font-size:13px;font-weight:700;color:${i < 3 ? "var(--amber)" : "var(--text2)"}">${i + 1}</span></td>
        <td><strong>${esc(p.bibit_nama)}</strong></td>
        ${showCabangBreakdown ? `<td>${esc(p.cabang_nama)}</td>` : ""}
        <td style="text-align:right">${p.total_terjual} ${esc(p.satuan_jual || p.satuan || "")}</td>
        <td style="text-align:right">${p.frekuensi}x</td>
        <td style="text-align:right"><strong>Rp ${p.total_omzet.toLocaleString("id-ID")}</strong></td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="${showCabangBreakdown ? 6 : 5}" class="empty">Belum ada data penjualan</td></tr>`;

  const terlarisHTML = `
    <div class="rekap-card">
      <div class="rekap-card-title">Produk Terlaris</div>
      <div class="tbl-wrap"><table>
        <thead><tr>
          <th>#</th><th>Produk</th>
          ${showCabangBreakdown ? "<th>Cabang</th>" : ""}
          <th style="text-align:right">Terjual</th>
          <th style="text-align:right">Frekuensi</th>
          <th style="text-align:right">Omzet</th>
        </tr></thead>
        <tbody>${terlarisRows}</tbody>
      </table></div>
    </div>`;

  return summaryHTML + grafikHTML + cabangHTML + terlarisHTML;
}

/* ================================================
   REKAP BULANAN — ADMIN
   ================================================ */
let rekapTglDari = "";
let rekapTglSampai = "";
async function buildRekapTab(target) {
  target.innerHTML = '<div class="loading">Memuat rekap...</div>';

  // Isi select bulan tahun
  target.innerHTML = `
    <div class="rekap-toolbar">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:1">
        <label style="font-size:12px;color:var(--text2);font-weight:500">Cabang:</label>
        <div id="rekap-cabang-wrap" style="position:relative">
  <button type="button" id="rekap-cabang-btn"
    onclick="toggleRekapCabangDrop()"
    style="min-width:180px;text-align:left;padding:7px 10px;border:0.5px solid var(--border);border-radius:8px;background:#fff;cursor:pointer;font-size:13px;display:flex;justify-content:space-between;align-items:center">
    <span id="rekap-cabang-label">Semua Cabang</span>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
  </button>
  <div id="rekap-cabang-drop" style="display:none;position:absolute;top:calc(100% + 4px);left:0;z-index:99;background:#fff;border:0.5px solid var(--border);border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.1);padding:8px;min-width:200px">
    <label style="display:flex;align-items:center;gap:8px;padding:5px 6px;font-size:13px;cursor:pointer;border-bottom:0.5px solid var(--border);margin-bottom:4px">
      <input type="checkbox" id="rekap-cab-all" checked onchange="toggleSemuaRekapCabang(this)"
        style="width:15px;height:15px;accent-color:var(--amber)"/>
      <strong>Semua Cabang</strong>
    </label>
    ${cabangData
      .map(
        (c) => `
    <label style="display:flex;align-items:center;gap:8px;padding:5px 6px;font-size:13px;cursor:pointer">
      <input type="checkbox" class="rekap-cab-cb" value="${c.id}" checked
        onchange="updateRekapCabangLabel()"
        style="width:15px;height:15px;accent-color:var(--amber)"/>
      ${esc(c.nama)}
    </label>`,
      )
      .join("")}
    <div style="margin-top:8px;padding-top:8px;border-top:0.5px solid var(--border)">
      <button class="btn btn-sm btn-primary" style="width:100%" onclick="loadRekapAdmin();toggleRekapCabangDrop()">Terapkan</button>
    </div>
  </div>
</div>
        <label style="font-size:12px;color:var(--text2);font-weight:500">Bulan:</label>
<select id="rekap-bulan" onchange="loadRekapAdmin()"></select>
<select id="rekap-tahun" onchange="loadRekapAdmin()" style="width:90px"></select>
<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-left:8px;padding-left:8px;border-left:1px solid var(--border)">
  <label style="font-size:12px;color:var(--text2);font-weight:500">Dari:</label>
  <input type="date" id="rekap-tgl-dari" style="width:130px"
    onchange="rekapTglDari=this.value;loadRekapAdmin()"/>
  <label style="font-size:12px;color:var(--text2);font-weight:500">Sampai:</label>
  <input type="date" id="rekap-tgl-sampai" style="width:130px"
    onchange="rekapTglSampai=this.value;loadRekapAdmin()"/>
  <button class="btn btn-sm" onclick="resetRentangRekap()" title="Reset filter tanggal">✕</button>
</div>
      </div>
      <button class="btn btn-green" onclick="exportPDFRekap(true)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:5px"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
        Export PDF
      </button>
      <button class="btn" style="background:#1D6F42;color:#fff" onclick="exportExcelRekap(true)">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:5px"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
  Export Excel
</button>
    </div>
    <div id="rekap-content" style="margin-top:14px"><div class="empty">Pilih bulan untuk melihat rekap</div></div>`;

  isiSelectBulanTahun("rekap-bulan", "rekap-tahun");
  await loadRekapAdmin();
}

async function loadRekapAdmin() {
  const checked = [...document.querySelectorAll(".rekap-cab-cb:checked")];
  const allCab = document.querySelectorAll(".rekap-cab-cb").length;
  const cab_id =
    checked.length === allCab || checked.length === 0
      ? "all"
      : checked.map((cb) => cb.value).join(",");
  const { bulan, tahun } = getBulanTahun("rekap-bulan", "rekap-tahun");
  const content = document.getElementById("rekap-content");
  if (!content) return;

  content.innerHTML = '<div class="loading">Memuat data rekap...</div>';
  try {
    const tglDari = $("rekap-tgl-dari")?.value || "";
    const tglSampai = $("rekap-tgl-sampai")?.value || "";
    const rentang =
      tglDari && tglSampai
        ? `&tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`
        : "";
    const url = `${BASE_URL}/api/rekap.php?bulan=${bulan}&tahun=${tahun}${cab_id !== "all" ? "&cabang_ids=" + cab_id : ""}${rentang}`;
    const data = await api(url);

    content.innerHTML = buildRekapHTML(data, true);

    // Render grafik setelah DOM ready
    setTimeout(
      () =>
        buildGrafik(
          "rekap-chart",
          data.grafik_labels,
          data.grafik_omzet,
          data.grafik_trx,
          data.grafik_laba,
        ),
      100,
    );
  } catch (e) {
    content.innerHTML =
      '<div class="alert alert-danger">Gagal memuat rekap: ' +
      e.message +
      "</div>";
  }
}

function resetRentangRekap() {
  const dari = $("rekap-tgl-dari");
  const sampai = $("rekap-tgl-sampai");
  if (dari) {
    dari.value = "";
    rekapTglDari = "";
  }
  if (sampai) {
    sampai.value = "";
    rekapTglSampai = "";
  }
  loadRekapAdmin();
}

function toggleRekapCabangDrop() {
  const drop = document.getElementById("rekap-cabang-drop");
  if (!drop) return;
  drop.style.display = drop.style.display === "none" ? "block" : "none";
}

function toggleSemuaRekapCabang(el) {
  document
    .querySelectorAll(".rekap-cab-cb")
    .forEach((cb) => (cb.checked = el.checked));
  updateRekapCabangLabel();
}

function updateRekapCabangLabel() {
  const all = document.querySelectorAll(".rekap-cab-cb");
  const checked = document.querySelectorAll(".rekap-cab-cb:checked");
  const allCb = document.getElementById("rekap-cab-all");
  const label = document.getElementById("rekap-cabang-label");
  if (!label) return;
  if (checked.length === 0) {
    if (allCb) allCb.checked = false;
    label.textContent = "Pilih cabang...";
  } else if (checked.length === all.length) {
    if (allCb) allCb.checked = true;
    label.textContent = "Semua Cabang";
  } else {
    if (allCb) allCb.checked = false;
    label.textContent = checked.length + " cabang dipilih";
  }
}

// Tutup dropdown jika klik di luar
document.addEventListener("click", (e) => {
  if (!e.target.closest("#rekap-cabang-wrap")) {
    const drop = document.getElementById("rekap-cabang-drop");
    if (drop) drop.style.display = "none";
  }
});

/* ================================================
   REKAP BULANAN — KARYAWAN
   ================================================ */
async function loadRekapKaryawan() {
  const { bulan, tahun } = getBulanTahun("k-rekap-bulan", "k-rekap-tahun");
  const content = document.getElementById("k-rekap-content");
  if (!content) return;

  content.innerHTML = '<div class="loading">Memuat data rekap...</div>';
  try {
    const url = `${BASE_URL}/api/rekap.php?bulan=${bulan}&tahun=${tahun}`;
    const data = await api(url);

    content.innerHTML = buildRekapHTML(data, false);
    setTimeout(
      () =>
        buildGrafik(
          "rekap-chart",
          data.grafik_labels,
          data.grafik_omzet,
          data.grafik_trx,
          data.grafik_laba,
        ),
      100,
    );
  } catch (e) {
    content.innerHTML =
      '<div class="alert alert-danger">Gagal memuat rekap</div>';
  }
}

/* ================================================
   EXPORT PDF REKAP BULANAN
   ================================================ */
async function exportExcelRekap(isAdmin) {
  const cab_id = (() => {
    if (!isAdmin) return null;
    const checked = [...document.querySelectorAll(".rekap-cab-cb:checked")];
    const allCab = document.querySelectorAll(".rekap-cab-cb").length;
    return checked.length === allCab || checked.length === 0
      ? "all"
      : checked.map((cb) => cb.value).join(",");
  })();
  const bulanId = isAdmin ? "rekap-bulan" : "k-rekap-bulan";
  const tahunId = isAdmin ? "rekap-tahun" : "k-rekap-tahun";
  const { bulan, tahun } = getBulanTahun(bulanId, tahunId);

  const namaBulan = [
    "",
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  try {
    toastInfo("Menyiapkan file Excel...", "Mohon tunggu");
    const tglDari = $("rekap-tgl-dari")?.value || "";
    const tglSampai = $("rekap-tgl-sampai")?.value || "";
    const rentang =
      tglDari && tglSampai
        ? `&tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`
        : "";
    const url = `${BASE_URL}/api/rekap.php?bulan=${bulan}&tahun=${tahun}${cab_id && cab_id !== "all" ? "&cabang_ids=" + cab_id : ""}${rentang}`;
    const data = await api(url);
    const cabNama = !isAdmin
      ? CURRENT_USER.cabang_nama || ""
      : cab_id === "all"
        ? "Semua Cabang"
        : cabangData?.find((c) => c.id == cab_id)?.nama || "";

    // Ambil data stok saat ini
    const stokSaatIni = stokData;

    // ================================================================
    // BUILD EXCEL MANUAL (format CSV multi-sheet via HTML table trick)
    // Menggunakan SheetJS via CDN
    // ================================================================

    // Load SheetJS jika belum ada
    if (!window.XLSX) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src =
          "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    const wb = window.XLSX.utils.book_new();

    // ── SHEET 1: RINGKASAN ──────────────────────────────────────────
    const s1 = [
      [`REKAP BULANAN — ${namaBulan[bulan]} ${tahun}`],
      [`Cabang: ${cabNama}`],
      [`Dicetak: ${new Date().toLocaleString("id-ID")}`],
      [],
      ["RINGKASAN UMUM"],
      ["Keterangan", "Nilai"],
      ["Total Pemasukan", parseFloat(data.total_omzet || 0)],
      ["Total Pengeluaran", parseFloat(data.total_keluar || 0)],
      ["Laba Bersih", parseFloat(data.laba_bersih || 0)],
      ["Total Transaksi", parseInt(data.total_transaksi || 0)],
      ["Hari Aktif Jualan", parseInt(data.hari_aktif || 0)],
      ["Rata-rata Omzet/Hari Aktif", parseFloat(data.rata_omzet_per_hari || 0)],
      [],
      ["RINGKASAN PER CABANG"],
      [
        "Cabang",
        "Transaksi",
        "Total Omzet",
        "Total Pengeluaran",
        "Laba Bersih",
        "Rata-rata/Nota",
      ],
    ];
    (data.per_cabang || []).forEach((c) => {
      const kel = (data.keluar_per_cabang || []).find(
        (k) => k.cabang_id == c.cabang_id,
      );
      const keluar = parseFloat(kel?.total_keluar || 0);
      const laba = parseFloat(c.total_omzet || 0) - keluar;
      s1.push([
        c.cabang_nama,
        parseInt(c.jumlah_transaksi || 0),
        parseFloat(c.total_omzet || 0),
        keluar,
        laba,
        parseFloat(c.rata_transaksi || 0),
      ]);
    });
    const ws1 = window.XLSX.utils.aoa_to_sheet(s1);
    // Set lebar kolom
    ws1["!cols"] = [
      { wch: 28 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
    ];
    window.XLSX.utils.book_append_sheet(wb, ws1, "Ringkasan");

    // ── SHEET 2: OMZET HARIAN ───────────────────────────────────────
    const s2 = [
      [`OMZET HARIAN — ${namaBulan[bulan]} ${tahun}`],
      [],
      ["Tanggal", "Hari", "Transaksi", "Omzet", "Pengeluaran", "Laba Bersih"],
    ];
    const hariNama = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    (data.grafik_labels || []).forEach((tgl, i) => {
      const omzet = parseFloat(data.grafik_omzet[i] || 0);
      const laba = parseFloat(data.grafik_laba[i] || 0);
      const trx = parseInt(data.grafik_trx[i] || 0);
      const keluar = omzet - laba;
      const tglFull = new Date(
        data.tahun || tahun,
        (data.bulan || bulan) - 1,
        tgl,
      );
      s2.push([
        `${tgl} ${namaBulan[bulan]} ${tahun}`,
        hariNama[tglFull.getDay()],
        trx,
        omzet,
        keluar,
        laba,
      ]);
    });
    // Baris total
    s2.push([]);
    s2.push([
      "TOTAL",
      "",
      parseInt(data.total_transaksi || 0),
      parseFloat(data.total_omzet || 0),
      parseFloat(data.total_keluar || 0),
      parseFloat(data.laba_bersih || 0),
    ]);
    const ws2 = window.XLSX.utils.aoa_to_sheet(s2);
    ws2["!cols"] = [
      { wch: 22 },
      { wch: 6 },
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
    ];
    window.XLSX.utils.book_append_sheet(wb, ws2, "Omzet Harian");

    // ── SHEET 3: PRODUK TERLARIS ────────────────────────────────────
    const s3 = [
      [`PRODUK TERLARIS — ${namaBulan[bulan]} ${tahun}`],
      [],
      [
        "#",
        "Produk",
        "Cabang",
        "Total Terjual",
        "Satuan",
        "Frekuensi",
        "Total Omzet",
      ],
    ];
    // Gabungkan per produk
    const terlarisMap = {};
    (data.produk_terlaris || []).forEach((p) => {
      const key = p.bibit_id;
      if (!terlarisMap[key]) {
        terlarisMap[key] = {
          ...p,
          total_omzet: parseFloat(p.total_omzet || 0),
          total_terjual: parseFloat(p.total_terjual || 0),
          frekuensi: parseInt(p.frekuensi || 0),
        };
      } else {
        terlarisMap[key].total_omzet += parseFloat(p.total_omzet || 0);
        terlarisMap[key].total_terjual += parseFloat(p.total_terjual || 0);
        terlarisMap[key].frekuensi += parseInt(p.frekuensi || 0);
      }
    });
    Object.values(terlarisMap)
      .sort((a, b) => b.total_omzet - a.total_omzet)
      .forEach((p, i) => {
        s3.push([
          i + 1,
          p.bibit_nama,
          p.cabang_nama || "Semua",
          parseFloat(p.total_terjual),
          p.satuan_jual || p.satuan || "",
          parseInt(p.frekuensi),
          parseFloat(p.total_omzet),
        ]);
      });
    const ws3 = window.XLSX.utils.aoa_to_sheet(s3);
    ws3["!cols"] = [
      { wch: 4 },
      { wch: 28 },
      { wch: 18 },
      { wch: 14 },
      { wch: 10 },
      { wch: 12 },
      { wch: 16 },
    ];
    window.XLSX.utils.book_append_sheet(wb, ws3, "Produk Terlaris");

    // ── SHEET 4: KONDISI STOK ───────────────────────────────────────
    const s4 = [
      [`KONDISI STOK — Per ${new Date().toLocaleDateString("id-ID")}`],
      [],
      ["Cabang", "Produk", "Stok", "Satuan", "Status"],
    ];
    stokSaatIni.forEach((r) => {
      const v = parseFloat(r.jumlah);
      const sat = r.satuan_dasar || r.satuan || "ml";
      const isMl = ["ml", "liter", "gram", "kg"].includes(sat);
      const crit = isMl ? STOK_CRITICAL : 2;
      const warn = isMl ? STOK_WARNING : 5;
      const status = v < crit ? "Kritis" : v < warn ? "Rendah" : "OK";
      s4.push([r.cabang_nama, r.bibit_nama, v, sat, status]);
    });
    const ws4 = window.XLSX.utils.aoa_to_sheet(s4);
    ws4["!cols"] = [
      { wch: 18 },
      { wch: 28 },
      { wch: 10 },
      { wch: 8 },
      { wch: 10 },
    ];

    // Warnai baris Kritis (merah) dan Rendah (kuning)
    const range = window.XLSX.utils.decode_range(ws4["!ref"]);
    for (let R = 3; R <= range.e.r; R++) {
      const statusCell = ws4[window.XLSX.utils.encode_cell({ r: R, c: 4 })];
      if (!statusCell) continue;
      const fill =
        statusCell.v === "Kritis"
          ? { fgColor: { rgb: "FFCCCC" } }
          : statusCell.v === "Rendah"
            ? { fgColor: { rgb: "FFF3CC" } }
            : null;
      if (fill) {
        for (let C = 0; C <= 4; C++) {
          const cell = ws4[window.XLSX.utils.encode_cell({ r: R, c: C })];
          if (cell) cell.s = { fill };
        }
      }
    }
    window.XLSX.utils.book_append_sheet(wb, ws4, "Kondisi Stok");

    // ── DOWNLOAD ────────────────────────────────────────────────────
    const fileName = `rekap-${namaBulan[bulan]}-${tahun}-${cabNama.toLowerCase().replace(/\s+/g, "-")}.xlsx`;
    window.XLSX.writeFile(wb, fileName);
    toastOk(`File ${fileName} berhasil didownload`, "Export Excel");
  } catch (e) {
    toastErr("Gagal export Excel: " + e.message);
  }
}

async function exportPDFRekap(isAdmin) {
  const cab_id = (() => {
    if (!isAdmin) return null;
    const checked = [...document.querySelectorAll(".rekap-cab-cb:checked")];
    const allCab = document.querySelectorAll(".rekap-cab-cb").length;
    return checked.length === allCab || checked.length === 0
      ? "all"
      : checked.map((cb) => cb.value).join(",");
  })();
  const bulanId = isAdmin ? "rekap-bulan" : "k-rekap-bulan";
  const tahunId = isAdmin ? "rekap-tahun" : "k-rekap-tahun";
  const { bulan, tahun } = getBulanTahun(bulanId, tahunId);

  const namaBulan = [
    "",
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  try {
    const tglDari = $("rekap-tgl-dari")?.value || "";
    const tglSampai = $("rekap-tgl-sampai")?.value || "";
    const rentang =
      tglDari && tglSampai
        ? `&tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`
        : "";
    const url = `${BASE_URL}/api/rekap.php?bulan=${bulan}&tahun=${tahun}${cab_id && cab_id !== "all" ? "&cabang_ids=" + cab_id : ""}${rentang}`;
    const data = await api(url);
    const cabNama = !isAdmin
      ? CURRENT_USER.cabang_nama || ""
      : cab_id === "all"
        ? "Semua Cabang"
        : cabangData?.find((c) => c.id == cab_id)?.nama || "";

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });
    const W = 210,
      M = 14;
    let y = 0;

    // Header
    doc.setFillColor(61, 82, 160);
    doc.rect(0, 0, W, 38, "F");
    doc.setFillColor(100, 120, 192);
    doc.rect(0, 32, W, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(TOKO_NAMA, M, 14);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Rekap Bulanan — " + namaBulan[bulan] + " " + tahun, M, 23);
    doc.setFontSize(9);
    doc.text(
      "Cabang: " +
        cabNama +
        "   |   Dicetak: " +
        new Date().toLocaleString("id-ID"),
      M,
      31,
    );
    y = 46;

    // Summary boxes
    const boxes = [
      {
        label: "Total Omzet",
        val: "Rp " + parseFloat(data.total_omzet || 0).toLocaleString("id-ID"),
        color: [61, 82, 160],
      },
      {
        label: "Total Transaksi",
        val: (data.total_transaksi || 0) + "",
        color: [24, 95, 165],
      },
      {
        label: "Hari Aktif",
        val: (data.hari_aktif || 0) + " hari",
        color: [194, 24, 91],
      },
      {
        label: "Rata-rata/Hari",
        val:
          "Rp " +
          parseFloat(data.rata_omzet_per_hari || 0).toLocaleString("id-ID"),
        color: [61, 82, 160],
      },
    ];
    const bw = (W - M * 2 - 6) / 4;
    boxes.forEach((b, i) => {
      const bx = M + i * (bw + 2);
      doc.setFillColor(248, 247, 244);
      doc.roundedRect(bx, y, bw, 18, 2, 2, "F");
      doc.setFontSize(i < 2 ? 9 : 8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...b.color);
      doc.text(b.val, bx + bw / 2, y + 9, { align: "center" });
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(136, 135, 128);
      doc.text(b.label, bx + bw / 2, y + 15, { align: "center" });
    });
    y += 26;

    // Tabel per cabang (admin semua cabang)
    if (isAdmin && data.per_cabang?.length > 1) {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("OMZET PER CABANG", M, y);
      y += 3;
      doc.autoTable({
        startY: y,
        margin: { left: M, right: M },
        head: [["#", "Cabang", "Transaksi", "Total Omzet", "Rata-rata/Nota"]],
        body: data.per_cabang.map((c, i) => [
          i + 1,
          c.cabang_nama,
          c.jumlah_transaksi || 0,
          "Rp " + parseFloat(c.total_omzet || 0).toLocaleString("id-ID"),
          "Rp " + parseFloat(c.rata_transaksi || 0).toLocaleString("id-ID"),
        ]),
        styles: {
          fontSize: 8,
          cellPadding: 3,
          lineColor: [229, 227, 220],
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: [61, 82, 160],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [248, 249, 255] },
        columnStyles: {
          2: { halign: "center" },
          3: { halign: "right" },
          4: { halign: "right" },
        },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // Tabel produk terlaris
    if (y > 240) {
      doc.addPage();
      y = 14;
    }
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("PRODUK TERLARIS", M, y);
    y += 3;

    const terlarisMap = {};
    (data.produk_terlaris || []).forEach((p) => {
      const key = p.bibit_id;
      if (!terlarisMap[key]) {
        terlarisMap[key] = {
          ...p,
          total_omzet: parseFloat(p.total_omzet || 0),
          total_terjual: parseFloat(p.total_terjual || 0),
          frekuensi: parseInt(p.frekuensi || 0),
        };
      } else {
        terlarisMap[key].total_omzet += parseFloat(p.total_omzet || 0);
        terlarisMap[key].total_terjual += parseFloat(p.total_terjual || 0);
        terlarisMap[key].frekuensi += parseInt(p.frekuensi || 0);
      }
    });
    const terlarisArr = Object.values(terlarisMap)
      .sort((a, b) => b.total_omzet - a.total_omzet)
      .slice(0, 10);

    doc.autoTable({
      startY: y,
      margin: { left: M, right: M },
      head: [["#", "Produk", "Terjual", "Frekuensi", "Total Omzet"]],
      body: terlarisArr.length
        ? terlarisArr.map((p, i) => [
            i + 1,
            p.bibit_nama,
            parseFloat(p.total_terjual) +
              " " +
              (p.satuan_jual || p.satuan || ""),
            p.frekuensi + "x",
            "Rp " + p.total_omzet.toLocaleString("id-ID"),
          ])
        : [["—", "Belum ada data penjualan", "—", "—", "—"]],
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: [229, 227, 220],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [194, 24, 91],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [255, 248, 252] },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "center" },
        4: { halign: "right", fontStyle: "bold" },
      },
    });

    // Grafik omzet harian (text based karena Chart.js tidak bisa di-render ke PDF langsung)
    y = doc.lastAutoTable.finalY + 8;
    if (y > 240) {
      doc.addPage();
      y = 14;
    }
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("OMZET HARIAN", M, y);
    y += 3;
    const hariRows = data.grafik_labels
      .map((d, i) => [
        d + "",
        namaBulan[bulan].substring(0, 3),
        data.grafik_trx[i] > 0 ? data.grafik_trx[i] + " transaksi" : "-",
        data.grafik_omzet[i] > 0
          ? "Rp " + data.grafik_omzet[i].toLocaleString("id-ID")
          : "-",
      ])
      .filter((_, i) => data.grafik_trx[i] > 0); // hanya tampilkan hari yang ada transaksi

    doc.autoTable({
      startY: y,
      margin: { left: M, right: M },
      head: [["Tgl", "Bln", "Transaksi", "Omzet"]],
      body: hariRows.length
        ? hariRows
        : [["—", "—", "Tidak ada transaksi bulan ini", "—"]],
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: [229, 227, 220],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [61, 82, 160],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [248, 249, 255] },
      columnStyles: {
        2: { halign: "center" },
        3: { halign: "right", fontStyle: "bold" },
      },
    });

    // Footer
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFillColor(248, 247, 244);
      doc.rect(0, 287, W, 10, "F");
      doc.setTextColor(136, 135, 128);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(TOKO_NAMA + " — Rekap Bulanan", M, 293);
      doc.text("Hal " + i + "/" + totalPages, W - M, 293, { align: "right" });
    }

    doc.save(
      `rekap-${namaBulan[bulan]}-${tahun}-${cabNama.toLowerCase().replace(/\s+/g, "-")}.pdf`,
    );
  } catch (e) {
    toastErr("Gagal export PDF: " + e.message);
  }
}

/* ================================================
   PAGINATION — SHARED HELPER
   ================================================ */
const PER_PAGE = 25;

function buildPaginationHTML(pag, onPageFn) {
  if (!pag || pag.total_pages <= 1) return "";

  const { current, total_pages, from, to, total, has_prev, has_next } = pag;

  // Tombol halaman — tampilkan max 5 halaman
  let pages = [];
  const start = Math.max(1, current - 2);
  const end = Math.min(total_pages, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);

  const btnPages = pages
    .map(
      (p) =>
        `<button class="page-btn ${p === current ? "active" : ""}"
      onclick="${onPageFn}(${p})" ${p === current ? "disabled" : ""}>${p}</button>`,
    )
    .join("");

  return `<div class="pagination">
    <div class="pagination-info">
      Menampilkan ${from}–${to} dari ${total} data
    </div>
    <div class="pagination-btns">
      <button class="page-btn" onclick="${onPageFn}(${current - 1})" ${!has_prev ? "disabled" : ""}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      ${btnPages}
      <button class="page-btn" onclick="${onPageFn}(${current + 1})" ${!has_next ? "disabled" : ""}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>
  </div>`;
}

/* ================================================
   LOG ADMIN — dengan pagination & search
   ================================================ */
let logPage = 1;
let logKeyword = "";

async function buildLogTab(target) {
  target.innerHTML = `
    <div class="card" style="padding:12px;margin-bottom:12px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input type="text" id="log-search" placeholder="Cari karyawan, produk, cabang..."
          style="flex:1;min-width:200px" oninput="debounceLogSearch()"
          value="${esc(logKeyword)}"/>
        <button class="btn btn-sm btn-danger" onclick="hapusLog()">Hapus Semua Log</button>
      </div>
    </div>
    <div id="log-content"><div class="loading">Memuat log...</div></div>`;

  await loadLogPage(logPage);
}

let logSearchTimer = null;
function debounceLogSearch() {
  clearTimeout(logSearchTimer);
  logSearchTimer = setTimeout(() => {
    logKeyword = $("log-search")?.value || "";
    logPage = 1;
    loadLogPage(1);
  }, 400);
}

async function loadLogPage(page) {
  logPage = page;
  const content = $("log-content");
  if (!content) return;
  content.innerHTML = '<div class="loading">Memuat...</div>';

  try {
    const url = `${BASE_URL}/api/log.php?page=${page}&per_page=${PER_PAGE}&keyword=${encodeURIComponent(logKeyword)}`;
    const data = await api(url);
    const logs = data.logs || [];
    const pag = data.pagination;

    if (!logs.length) {
      content.innerHTML = '<div class="empty">Tidak ada data log</div>';
      return;
    }

    const rows = logs
      .map(
        (l) => `
      <div class="log-row">
        <div class="log-dot dot-${l.tipe}"></div>
        <div>
          <div class="log-info">
            <strong>${esc(l.user_nama)}</strong> — ${esc(l.bibit_nama)} di ${esc(l.cabang_nama)}
            ${l.tipe === "kurang" ? "berkurang" : "bertambah"}
            <strong>${parseFloat(l.jumlah)} ${esc(l.satuan || "")}</strong>
            ${l.keterangan ? " (" + esc(l.keterangan) + ")" : ""}
          </div>
          <div class="log-meta">Sisa: ${l.sisa} ${esc(l.satuan || "")}</div>
        </div>
        <div class="log-time">${l.created_at}</div>
      </div>`,
      )
      .join("");

    content.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Riwayat Aktivitas</span>
          <span style="font-size:12px;color:var(--text2)">${pag?.total || 0} total log</span>
        </div>
        ${rows}
        ${buildPaginationHTML(pag, "loadLogPage")}
      </div>`;
  } catch (e) {
    content.innerHTML =
      '<div class="alert alert-danger">Gagal memuat log</div>';
  }
}

async function hapusLog() {
  if (!confirm("Hapus semua log aktivitas?")) return;
  await api(BASE_URL + "/api/log.php", "DELETE");
  logPage = 1;
  logKeyword = "";
  loadLogPage(1);
}

/* ================================================
   RIWAYAT TRANSAKSI KARYAWAN — dengan pagination
   ================================================ */
let riwayatPage = 1;

function goRiwayatPage(page) {
  const tgl =
    $("riwayat-tgl")?.value ||
    (() => {
      const d = new Date();
      return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
      );
    })();
  loadRiwayatPage(page, tgl);
}

async function loadRiwayat() {
  const tgl =
    $("riwayat-tgl")?.value ||
    (() => {
      const d = new Date();
      return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
      );
    })();
  riwayatPage = 1;
  await loadRiwayatPage(riwayatPage, tgl);
}

async function loadRiwayatPage(page, tgl) {
  riwayatPage = page;
  const tanggal =
    tgl ||
    $("riwayat-tgl")?.value ||
    (() => {
      const d = new Date();
      return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
      );
    })();
  const contentEl = $("riwayat-content");
  if (!contentEl) return;
  contentEl.innerHTML = '<div class="loading">Memuat...</div>';

  try {
    // Ambil transaksi masuk & pengeluaran sekaligus
    const [resTrx, resKel] = await Promise.all([
      api(
        `${BASE_URL}/api/transaksi.php?tanggal=${tanggal}&page=${page}&per_page=${RIWAYAT_PER_PAGE}`,
      ),
      api(`${BASE_URL}/api/pengeluaran.php?tanggal=${tanggal}`),
    ]);

    const trxs = resTrx.transaksis || [];
    const kels = resKel.pengeluaran || [];
    const pag = resTrx.pagination;
    // Gunakan local date (bukan UTC) agar tidak beda hari di timezone WIB
    const nowLocal = new Date();
    const today =
      nowLocal.getFullYear() +
      "-" +
      String(nowLocal.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(nowLocal.getDate()).padStart(2, "0");
    const isToday = tanggal === today;

    // Hitung ringkasan
    const totalMasuk = parseFloat(resTrx.total_omzet || 0);
    const totalKeluar = parseFloat(resKel.total_nominal || 0);
    const labaBersih = totalMasuk - totalKeluar;
    const jmlBatal = trxs.filter((t) =>
      t.kode_nota.startsWith("BATAL-"),
    ).length;

    // Ringkasan cards (hanya halaman 1)
    const summaryHTML =
      page === 1
        ? `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
        <div class="sum-card">
          <div class="sum-val" style="color:var(--teal);font-size:15px">Rp ${totalMasuk.toLocaleString("id-ID")}</div>
          <div class="sum-lbl">Total Masuk</div>
        </div>
        <div class="sum-card">
          <div class="sum-val" style="color:var(--red);font-size:15px">Rp ${totalKeluar.toLocaleString("id-ID")}</div>
          <div class="sum-lbl">Total Keluar</div>
        </div>
        <div class="sum-card" style="border:1.5px solid ${labaBersih >= 0 ? "#9fe1cb" : "#f7c1c1"}">
          <div class="sum-val" style="color:${labaBersih >= 0 ? "var(--teal)" : "var(--red)"};font-size:15px">
            Rp ${labaBersih.toLocaleString("id-ID")}
          </div>
          <div class="sum-lbl">${labaBersih >= 0 ? "Laba Bersih" : "Rugi"}</div>
        </div>
      </div>
      ${jmlBatal > 0 ? `<div class="alert alert-warn" style="margin-bottom:10px">${jmlBatal} transaksi dibatalkan</div>` : ""}`
        : "";

    // Cards transaksi masuk
    const trxCards = trxs
      .map((t) => {
        const isBatal = t.kode_nota.startsWith("BATAL-");
        const items = (t.items || [])
          .map(
            (item) =>
              `<div class="trx-row">
          <span>${esc(item.bibit_nama)} × ${item.jumlah_jual} ${esc(item.satuan_jual)}</span>
          <span>Rp ${parseFloat(item.subtotal).toLocaleString("id-ID")}</span>
        </div>`,
          )
          .join("");
        const batalBtn =
          !isBatal && isToday
            ? `<button class="btn btn-sm btn-danger" onclick="konfirmasiBatal(${t.id},'${esc(t.kode_nota)}')" style="margin-top:8px">Batalkan Nota</button>`
            : "";
        const statusBadge = isBatal
          ? `<span class="badge" style="background:var(--red-l);color:var(--red)">Dibatalkan</span>`
          : "";

        return `<div class="trx-card" style="${isBatal ? "opacity:0.6;" : ""}">
        <div class="trx-head">
          <div>
            <div class="trx-kode">${esc(t.kode_nota)} ${statusBadge}
              <span class="badge" style="background:var(--teal-l);color:var(--teal);margin-left:4px">Masuk</span>
            </div>
            <div class="trx-meta">${t.created_at} · ${esc(t.user_nama)}</div>
          </div>
          <div class="trx-jumlah" style="${isBatal ? "text-decoration:line-through;color:var(--text2)" : "color:var(--teal)"}">
            + Rp ${parseFloat(t.total).toLocaleString("id-ID")}
          </div>
        </div>
        <div class="trx-items">${items}</div>
        ${t.catatan ? `<div style="font-size:11px;color:var(--text2);margin-top:6px">📝 ${esc(t.catatan)}</div>` : ""}
        <div style="display:flex;gap:8px;margin-top:8px">
          ${batalBtn}
          ${
            !isBatal
              ? `<button class="btn btn-sm" onclick='printNota(${JSON.stringify(t)})' style="margin-left:auto">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:4px"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
            Print Nota
          </button>`
              : ""
          }
        </div>
      </div>`;
      })
      .join("");

    // Cards pengeluaran — hanya tampil di halaman 1
    const kelCards =
      page === 1 && kels.length
        ? `
      <div style="margin-top:4px;margin-bottom:4px">
        <div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;padding:8px 0 6px">
          Pengeluaran
        </div>
        ${kels
          .map((p) => {
            const jamKel = p.created_at.split(" ")[1]?.substring(0, 5) || "";
            const hapusBtn = isToday
              ? `<button class="btn btn-sm btn-danger" style="margin-top:4px;font-size:11px"
                onclick="hapusKeluar(${p.id},'${esc(p.nama_item)}')">Hapus</button>`
              : "";
            return `<div class="trx-card" style="border-left:3px solid var(--red)">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap">
              <div style="flex:1;min-width:0">
                <div class="trx-kode" style="word-break:break-word">${esc(p.nama_item)}
                  <span class="badge" style="background:var(--red-l);color:var(--red);margin-left:4px">Keluar</span>
                </div>
                <div class="trx-meta">${jamKel} · ${esc(p.user_nama)}${p.keterangan ? " · " + esc(p.keterangan) : ""}</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
                <div style="font-size:14px;font-weight:700;color:var(--red);white-space:nowrap">- Rp ${parseFloat(p.nominal).toLocaleString("id-ID")}</div>
                ${hapusBtn}
              </div>
            </div>
          </div>`;
          })
          .join("")}
      </div>`
        : "";

    const emptyMsg =
      !trxs.length && !kels.length
        ? '<div class="empty">Belum ada aktivitas pada tanggal ini</div>'
        : "";

    contentEl.innerHTML =
      summaryHTML +
      (trxs.length
        ? `<div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;padding:4px 0 8px">Transaksi Masuk</div>`
        : "") +
      trxCards +
      buildPaginationHTML(pag, "goRiwayatPage") +
      kelCards +
      emptyMsg;
  } catch (e) {
    contentEl.innerHTML =
      '<div class="alert alert-danger">Gagal memuat riwayat</div>';
  }
}

/* ================================================
   STOK CABANG ADMIN — dengan pagination & search
   ================================================ */
let stokPage = 1;
let stokKeyword = "";
let stokSearchTimer = null;

// Override buildStokTab untuk versi paginasi
function buildStokTab() {
  const totalMl = stokData.reduce((s, r) => s + parseFloat(r.jumlah), 0);
  const lowCount = stokData.filter((r) => {
    const sat = r.satuan_dasar || r.satuan || "ml";
    const isMl = ["ml", "liter", "gram", "kg"].includes(sat);
    return parseFloat(r.jumlah) < (isMl ? STOK_WARNING : 5);
  }).length;

  const pills =
    `<button class="pill ${activeFilter === "all" ? "active" : ""}" onclick="setFilter('all')">Semua</button>` +
    cabangData
      .map(
        (c) =>
          `<button class="pill ${activeFilter == c.id ? "active" : ""}" onclick="setFilter(${c.id})">${esc(c.nama)}</button>`,
      )
      .join("");

  let kritisCount = 0,
    rendahCount = 0;
  let kritisItems = [],
    rendahItems = [];
  stokData.forEach((r) => {
    if (activeFilter !== "all" && r.cabang_id != activeFilter) return;
    const v = parseFloat(r.jumlah);
    const sat = r.satuan_dasar || r.satuan || "ml";
    const isMl = ["ml", "liter", "gram", "kg"].includes(sat);
    const warn = isMl ? STOK_WARNING : 5;
    const crit = isMl ? STOK_CRITICAL : 2;
    if (v < crit) {
      kritisCount++;
      kritisItems.push(
        `<li><strong>${esc(r.bibit_nama)}</strong> di ${esc(r.cabang_nama)} — sisa ${parseFloat(v)} ${esc(sat)}</li>`,
      );
    } else if (v < warn) {
      rendahCount++;
      rendahItems.push(
        `<li>${esc(r.bibit_nama)} di ${esc(r.cabang_nama)} — sisa ${parseFloat(v)} ${esc(sat)}</li>`,
      );
    }
  });

  let alertBanner = "";
  if (kritisCount > 0 || rendahCount > 0) {
    const kritisDetail = kritisItems.length
      ? `<ul style="margin:6px 0 0 16px;padding:0;font-size:12px;line-height:1.7">${kritisItems.join("")}</ul>`
      : "";
    const rendahDetail = rendahItems.length
      ? `<ul style="margin:6px 0 0 16px;padding:0;font-size:12px;line-height:1.7;color:var(--text)">${rendahItems.join("")}</ul>`
      : "";
    alertBanner = `
    <div id="alert-banner" style="border-radius:10px;overflow:hidden;margin-bottom:12px">
      ${
        kritisCount > 0
          ? `
      <div class="alert alert-danger" style="margin:0 0 4px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px"
           onclick="toggleAlertDetail('detail-kritis',this)">
        <span>🔴 <strong>${kritisCount} produk stok menipis</strong> — klik lonceng 🔔 untuk detail, atau lihat di sini</span>
        <svg id="chevron-kritis" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;transition:transform .2s"><path d="m6 9 6 6 6-6"/></svg>
      </div>
      <div id="detail-kritis" style="display:none;background:var(--red-l,#fff0f0);border-radius:0 0 8px 8px;padding:10px 14px;border:1px solid var(--red,#e57373);border-top:none;margin-bottom:4px">
        ${kritisDetail}
      </div>`
          : ""
      }
      ${
        rendahCount > 0
          ? `
      <div class="alert alert-warn" style="margin:0;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px"
           onclick="toggleAlertDetail('detail-rendah',this)">
        <span>🟡 <strong>${rendahCount} produk stok rendah</strong></span>
        <svg id="chevron-rendah" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;transition:transform .2s"><path d="m6 9 6 6 6-6"/></svg>
      </div>
      <div id="detail-rendah" style="display:none;background:var(--warn-l,#fffbe6);border-radius:0 0 8px 8px;padding:10px 14px;border:1px solid var(--warn,#f5c518);border-top:none">
        ${rendahDetail}
      </div>`
          : ""
      }
    </div>`;
  }

  return `
    <div class="metrics-grid">
      <div class="metric-card"><div class="metric-label">Total Stok</div><div class="metric-val">${(totalMl / 1000).toFixed(1)}L</div></div>
      <div class="metric-card"><div class="metric-label">Jumlah Cabang</div><div class="metric-val">${cabangData.length}</div></div>
      <div class="metric-card"><div class="metric-label">Jenis Produk</div><div class="metric-val">${bibitData.length}</div></div>
      <div class="metric-card"><div class="metric-label">Perlu Restock</div><div class="metric-val" style="color:${lowCount > 0 ? "var(--red)" : "var(--teal)"}">${lowCount}</div></div>
    </div>
    ${alertBanner}
    <div class="pills">${pills}</div>
    <div class="stok-search-bar">
      <input type="text" id="stok-keyword" placeholder="Cari nama produk..."
        value="${esc(stokKeyword)}" oninput="debounceStokSearch()"/>
    </div>
    <div id="stok-paginated-content"><div class="loading">Memuat stok...</div></div>`;
}

function debounceStokSearch() {
  clearTimeout(stokSearchTimer);
  stokSearchTimer = setTimeout(() => {
    stokKeyword = $("stok-keyword")?.value || "";
    stokPage = 1;
    loadStokPage(1);
  }, 400);
}

function setFilter(f) {
  activeFilter = f;
  stokPage = 1;
  stokKeyword = "";
  // Re-render stokTab HTML dulu
  const target = $("tab-stok");
  if (target) target.innerHTML = buildStokTab();
  loadStokPage(1);
}

async function loadStokPage(page) {
  stokPage = page;
  const content = $("stok-paginated-content");
  if (!content) return;
  content.innerHTML = '<div class="loading">Memuat...</div>';

  try {
    const cabId = activeFilter === "all" ? "" : "&cabang_id=" + activeFilter;
    const url = `${BASE_URL}/api/stok.php?paginate=1&page=${page}&per_page=${PER_PAGE}&keyword=${encodeURIComponent(stokKeyword)}${cabId}`;
    const data = await api(url);
    const stoks = data.stok || [];
    const pag = data.pagination;

    // Group by cabang
    const byCabang = {};
    stoks.forEach((r) => {
      if (!byCabang[r.cabang_id])
        byCabang[r.cabang_id] = { nama: r.cabang_nama, items: [] };
      byCabang[r.cabang_id].items.push(r);
    });

    const cards = Object.values(byCabang)
      .map((cab) => {
        const rows = cab.items
          .map((r) => {
            const v = parseFloat(r.jumlah);
            const sat = r.satuan_dasar || r.satuan || "ml";
            const isMl = ["ml", "liter", "gram", "kg"].includes(sat);
            const warn = isMl ? STOK_WARNING : 5;
            const crit = isMl ? STOK_CRITICAL : 2;
            const maxD = isMl ? STOK_MAX : 50;
            const pct = Math.min(100, Math.round((v / maxD) * 100));
            const cls = v <= crit ? "crit" : v <= warn ? "low" : "ok";
            return `<div class="stock-row">
          <div>
            <div class="stock-name">${esc(r.bibit_nama)}</div>
            <div class="prog"><div class="prog-fill prog-${cls}" style="width:${pct}%"></div></div>
          </div>
          <span class="badge badge-${cls}">${cls === "ok" ? "OK" : cls === "low" ? "Rendah" : "Menipis"}</span>
          <span style="font-size:13px;font-weight:600;color:${v <= warn ? "var(--red)" : "var(--teal)"}">${parseFloat(v)} ${esc(sat)}</span>
          <button class="btn btn-sm" onclick="openEditStok(${r.cabang_id},${r.bibit_id})">Edit</button>
        </div>`;
          })
          .join("");

        return `<div class="card">
        <div class="card-header">
          <span class="card-title">${esc(cab.nama)}</span>
          <span class="live-badge"><span class="pulse"></span>Live</span>
        </div>${rows}
      </div>`;
      })
      .join("");

    content.innerHTML =
      (cards || '<div class="empty">Tidak ada produk ditemukan</div>') +
      buildPaginationHTML(pag, "loadStokPage");
  } catch (e) {
    content.innerHTML =
      '<div class="alert alert-danger">Gagal memuat stok</div>';
  }
}

/* ================================================
   TRANSAKSI KELUAR (PENGELUARAN)
   ================================================ */

function previewKeluar() {
  const nominal = parseFloat($("kel-nominal")?.value) || 0;
  const preview = $("kel-preview");
  if (preview) preview.textContent = "Rp " + nominal.toLocaleString("id-ID");
}

async function simpanKeluar() {
  const nama_item = $("kel-nama")?.value.trim();
  const nominal = parseFloat($("kel-nominal")?.value) || 0;
  const keterangan = $("kel-ket")?.value.trim() || "";
  const msgEl = $("kel-msg");

  if (!nama_item) {
    showKMsg("Nama item wajib diisi", "danger");
    return;
  }
  if (nominal <= 0) {
    showKMsg("Nominal harus lebih dari 0", "danger");
    return;
  }

  try {
    const res = await api(BASE_URL + "/api/pengeluaran.php", "POST", {
      nama_item,
      nominal,
      keterangan,
    });
    if (res.success) {
      // Reset form
      if ($("kel-nama")) $("kel-nama").value = "";
      if ($("kel-nominal")) $("kel-nominal").value = "";
      if ($("kel-ket")) $("kel-ket").value = "";
      if ($("kel-preview")) $("kel-preview").textContent = "Rp 0";

      toastOk(
        "Rp " + nominal.toLocaleString("id-ID") + " — " + nama_item,
        "Pengeluaran Dicatat",
      );
      await loadKeluarHariIni();
    } else {
      showKMsg(res.message || "Gagal menyimpan", "danger");
    }
  } catch (e) {
    showKMsg("Error: " + e.message, "danger");
  }
}

function showKMsg(msg, type) {
  const el = $("kel-msg");
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${type}" style="margin-bottom:10px">${msg}</div>`;
  setTimeout(() => {
    if (el) el.innerHTML = "";
  }, 4000);
}

async function loadKeluarHariIni() {
  const listEl = $("kel-list");
  if (!listEl) return;

  const today = (() => {
    const d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  })();
  try {
    const res = await api(`${BASE_URL}/api/pengeluaran.php?tanggal=${today}`);
    const data = res.pengeluaran || [];
    const total = res.total_nominal || 0;

    if (!data.length) {
      listEl.innerHTML =
        '<div class="empty" style="padding:1.5rem">Belum ada pengeluaran hari ini</div>';
      return;
    }

    const rows = data
      .map(
        (p) => `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;padding:10px 0;border-bottom:0.5px solid var(--border);gap:10px">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500;color:var(--text)">${esc(p.nama_item)}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px">
            ${p.created_at.split(" ")[1]?.substring(0, 5) || ""} · ${esc(p.user_nama)}
            ${p.keterangan ? " · " + esc(p.keterangan) : ""}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:14px;font-weight:700;color:var(--red)">- Rp ${parseFloat(p.nominal).toLocaleString("id-ID")}</div>
          <button class="btn btn-sm btn-danger" style="margin-top:4px;font-size:11px"
            onclick="hapusKeluar(${p.id})">Hapus</button>
        </div>
      </div>`,
      )
      .join("");

    listEl.innerHTML = `
      ${rows}
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;margin-top:4px;border-top:1px solid var(--border)">
        <span style="font-size:13px;font-weight:600;color:var(--text)">Total Pengeluaran</span>
        <span style="font-size:16px;font-weight:700;color:var(--red)">Rp ${total.toLocaleString("id-ID")}</span>
      </div>`;
  } catch (e) {
    listEl.innerHTML =
      '<div class="alert alert-danger">Gagal memuat data</div>';
  }
}

async function hapusKeluar(id, namaItem) {
  const konfirm = namaItem
    ? `Hapus pengeluaran "${namaItem}"?`
    : "Hapus catatan pengeluaran ini?";
  if (!confirm(konfirm)) return;
  try {
    const res = await api(BASE_URL + "/api/pengeluaran.php", "DELETE", { id });
    if (res.success) {
      // Refresh kedua tampilan — tab keluar & tab riwayat
      await loadKeluarHariIni();
      const _now = new Date();
      const _today =
        _now.getFullYear() +
        "-" +
        String(_now.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(_now.getDate()).padStart(2, "0");
      const tgl = $("riwayat-tgl")?.value || _today;
      await loadRiwayatPage(riwayatPage, tgl);
    } else {
      toastErr("Gagal menghapus pengeluaran");
    }
  } catch (e) {
    toastErr(e.message);
  }
}
