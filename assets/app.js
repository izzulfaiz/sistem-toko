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

  await loadNotifikasi();

  // Auto refresh notifikasi setiap 5 menit
  setInterval(loadNotifikasi, 5 * 60 * 1000);

  // Auto switch orientasi grafik saat resize / putar layar
  window.addEventListener("resize", () => {
    if (adminActiveTab === "stok" && dashboardChart) {
      dashboardChart.destroy();
      dashboardChart = null;
      renderDashboardGrafik();
    }
  });
}

let adminActiveTab = "stok";

async function loadOmzetHariIni() {
  try {
    const today = new Date();
    const tgl =
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0");

    const data = await api(`${BASE_URL}/api/omzet_hari_ini.php?tanggal=${tgl}`);
    return data.omzet_per_cabang || {};
  } catch (e) {
    console.error("loadOmzetHariIni:", e);
    return {};
  }
}

let dashboardChart = null;

async function renderDashboardGrafik() {
  const canvas = document.getElementById("dashboard-chart");
  if (!canvas) return {};

  const omzetPerCabang = await loadOmzetHariIni();
  const labels = Object.keys(omzetPerCabang);
  const values = Object.values(omzetPerCabang);
  const maxVal = Math.max(...values);
  const isMobile = window.innerWidth < 640;

  const bgColors = values.map((v) =>
    v === maxVal && maxVal > 0
      ? "rgba(61,82,160,0.9)"
      : v > 0
        ? "rgba(61,82,160,0.45)"
        : "rgba(128,128,128,0.15)",
  );
  const borderColors = values.map((v) =>
    v === maxVal && maxVal > 0
      ? "rgba(61,82,160,1)"
      : v > 0
        ? "rgba(61,82,160,0.6)"
        : "rgba(128,128,128,0.2)",
  );

  const shortLabels = labels.map((l) => l.replace(/^Cabang\s+/i, ""));

  // Sesuaikan tinggi canvas
  const chartWrap = canvas.parentElement;
  if (chartWrap) {
    chartWrap.style.height = isMobile ? "240px" : "200px";
  }

  // Jika chart sudah ada, UPDATE data saja tanpa destroy
  if (dashboardChart) {
    dashboardChart.data.labels = shortLabels;
    dashboardChart.data.datasets[0].data = values;
    dashboardChart.data.datasets[0].backgroundColor = bgColors;
    dashboardChart.data.datasets[0].borderColor = borderColors;
    dashboardChart.update("none");

    const totalHari = values.reduce((s, v) => s + v, 0);
    const el = document.getElementById("dashboard-total-hari");
    if (el) el.textContent = "Total: Rp " + totalHari.toLocaleString("id-ID");
    return omzetPerCabang;
  }

  // Pertama kali: buat chart baru
  dashboardChart = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: shortLabels,
      datasets: [
        {
          label: "Omzet Hari Ini (Rp)",
          data: values,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(20,20,40,0.88)",
          padding: 12,
          cornerRadius: 8,
          titleFont: { size: 12, weight: "bold" },
          bodyFont: { size: 12 },
          callbacks: {
            label: (ctx) =>
              ctx.raw > 0
                ? "  Rp " + ctx.raw.toLocaleString("id-ID")
                : "  Belum ada omzet",
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: isMobile ? 9 : 11 },
            maxRotation: isMobile ? 45 : 0,
            minRotation: isMobile ? 45 : 0,
            callback: function (val) {
              const label = this.getLabelForValue(val);
              const short = label.replace(/^Cabang\s+/i, "");
              return isMobile && short.length > 8
                ? short.substring(0, 7) + "…"
                : short;
            },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(128,128,128,0.08)" },
          border: { display: false },
          ticks: {
            font: { size: 10 },
            callback: (v) =>
              v >= 1000000
                ? "Rp " + (v / 1000000).toFixed(1) + "jt"
                : v >= 1000
                  ? "Rp " + (v / 1000).toFixed(0) + "rb"
                  : v === 0
                    ? ""
                    : "Rp " + v,
          },
        },
      },
      animation: {
        duration: 500,
        easing: "easeOutQuart",
      },
    },
  });

  const totalHari = values.reduce((s, v) => s + v, 0);
  const el = document.getElementById("dashboard-total-hari");
  if (el) el.textContent = "Total: Rp " + totalHari.toLocaleString("id-ID");

  return omzetPerCabang;
}

async function refreshStokManual() {
  const btn = document.getElementById("btn-refresh-stok");
  const icon = document.getElementById("icon-refresh-stok");

  // Animasi loading
  if (icon) icon.style.animation = "spin 0.8s linear infinite";
  if (btn) btn.disabled = true;

  try {
    await loadStokData();
    // Update stok content tanpa rebuild grafik
    await loadStokPage(stokPage);
    // Update grafik juga
    await renderDashboardGrafik();
    updateAlertBanner();
    updateMetricCards();
  } finally {
    if (icon) icon.style.animation = "";
    if (btn) btn.disabled = false;
  }
}

async function loadStokData() {
  try {
    const data = await api(BASE_URL + "/api/stok.php");
    stokData = data.stok || [];
    cabangData = data.cabang || [];
    bibitData = data.bibit || [];
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
      member: "Member",
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
    if (dashboardChart) {
      dashboardChart.destroy();
      dashboardChart = null;
    }
    target.innerHTML = buildStokTab();
    setTimeout(() => {
      loadStokPage(stokPage);
      renderDashboardGrafik();
    }, 50);
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
  if (adminActiveTab === "member") buildMemberAdminTab(target);
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

    <div class="card" style="margin-bottom:14px;padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="card-title" style="margin:0">📊 Omzet Hari Ini per Cabang</div>
        <div style="display:flex;align-items:center;gap:10px">
          <div id="dashboard-total-hari" style="font-size:13px;color:var(--text2)">Memuat...</div>
          <button onclick="refreshStokManual()" id="btn-refresh-stok"
            style="background:none;border:0.5px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:12px;color:var(--text2);display:flex;align-items:center;gap:4px"
            title="Refresh data stok">
            <svg id="icon-refresh-stok" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M8 16H3v5"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>
      <div style="height:200px;position:relative">
        <canvas id="dashboard-chart"></canvas>
      </div>
    </div>
    ${alertBanner}
    <div class="pills">${pills}</div>
    <div class="stok-search-bar">
      <input type="text" id="stok-keyword" placeholder="Cari nama produk..."
        value="${esc(stokKeyword)}" oninput="debounceStokSearch()"/>
    </div>
    <div id="stok-paginated-content"><div class="loading">Memuat stok...</div></div>`;
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
      <div class="log-row" style="flex-wrap:wrap;gap:6px">
        <div class="log-dot dot-${l.tipe}" style="flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div class="log-info" style="word-break:break-word"><strong>${esc(l.user_nama)}</strong> — ${esc(l.bibit_nama)} di ${esc(l.cabang_nama)} ${l.tipe === "kurang" ? "berkurang" : "bertambah"} <strong>${l.jumlah} ${esc(l.satuan || "")}</strong>${l.keterangan ? " (" + esc(l.keterangan) + ")" : ""}</div>
          <div class="log-meta">Sisa: ${parseFloat(l.sisa)} ${esc(l.satuan || "")}</div>
        </div>
        <div class="log-time" style="font-size:10px;white-space:nowrap;flex-shrink:0">${l.created_at.replace(" ", "<br/>")}</div>
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
          <button class="btn btn-sm btn-teal" data-id="${b.id}" onclick="editInlineBibit(this.dataset.id)">Edit</button>
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

function updateMetricCards() {
  const totalMl = stokData.reduce((s, r) => s + parseFloat(r.jumlah), 0);
  const lowCount = stokData.filter((r) => {
    const sat = r.satuan_dasar || r.satuan || "ml";
    const isMl = ["ml", "liter", "gram", "kg"].includes(sat);
    return parseFloat(r.jumlah) < (isMl ? STOK_WARNING : 5);
  }).length;

  // Update nilai metric cards langsung tanpa rebuild HTML
  const cards = document.querySelectorAll(".metric-card .metric-val");
  if (cards.length >= 4) {
    cards[0].textContent = (totalMl / 1000).toFixed(1) + "L"; // Total Stok
    cards[1].textContent = cabangData.length; // Jumlah Cabang
    cards[2].textContent = bibitData.length; // Jenis Produk
    cards[3].textContent = lowCount; // Perlu Restock
    cards[3].style.color = lowCount > 0 ? "var(--red)" : "var(--teal)";
  }
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

function updateAlertBanner() {
  const bannerEl = document.getElementById("alert-banner");
  if (!bannerEl) return;

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
        `<li><strong>${esc(r.bibit_nama)}</strong> di ${esc(r.cabang_nama)} — sisa ${v} ${esc(sat)}</li>`,
      );
    } else if (v < warn) {
      rendahCount++;
      rendahItems.push(
        `<li>${esc(r.bibit_nama)} di ${esc(r.cabang_nama)} — sisa ${v} ${esc(sat)}</li>`,
      );
    }
  });

  // Kalau tidak ada alert sama sekali, sembunyikan banner
  if (kritisCount === 0 && rendahCount === 0) {
    bannerEl.innerHTML = "";
    return;
  }

  const kritisDetail = kritisItems.length
    ? `<ul style="margin:6px 0 0 16px;padding:0;font-size:12px;line-height:1.7">${kritisItems.join("")}</ul>`
    : "";
  const rendahDetail = rendahItems.length
    ? `<ul style="margin:6px 0 0 16px;padding:0;font-size:12px;line-height:1.7;color:var(--text)">${rendahItems.join("")}</ul>`
    : "";

  bannerEl.innerHTML = `
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
    }`;
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

    loadStokPage(stokPage);
    updateAlertBanner();
    updateMetricCards();

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
    $("mb-kategori").value = "parfum_baju";
    updateSatuanOptions();
  }
  openModal("modal-bibit");
}

function updateSatuanOptions() {
  const kat = $("mb-kategori")?.value || "parfum_baju";
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
    parfum_baju: ["ml", "liter", "gram"],
    parfum_religi: ["ml", "liter", "gram"],
    parfum_spiritual: ["ml", "liter", "gram"],
    parfum_laundry: ["botol", "pcs", "liter", "ml"],
    aksesoris: ["pcs", "lusin", "kodi", "box", "pack"],
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

function updateEbSatuanDasar() {
  const sel = document.getElementById("eb-satuan");
  const opt = sel?.selectedOptions[0];
  const dasar = document.getElementById("eb-satuan-dasar");
  if (dasar && opt) dasar.value = opt.dataset.dasar || sel.value;
}

async function saveBibit() {
  const sel = $("mb-satuan");
  const opt = sel?.selectedOptions[0];
  const body = {
    action: "tambah_bibit",
    nama: $("mb-nama").value.trim(),
    kategori: $("mb-kategori")?.value || "parfum_baju",
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

// Buka modal edit produk
function editInlineBibit(id, namaLama) {
  const produk = bibitData.find((b) => b.id == id);
  if (!produk) return;

  document.getElementById("eb-id").value = id;
  document.getElementById("eb-nama").value = produk.nama || namaLama;
  document.getElementById("eb-deskripsi").value = produk.deskripsi || "";
  document.getElementById("eb-tampil-landing").checked = !!parseInt(
    produk.tampil_landing,
  );

  const selKat = document.getElementById("eb-kategori");
  if (selKat && produk.kategori) selKat.value = produk.kategori;
  // Set satuan
  const selSatuan = document.getElementById("eb-satuan");
  if (selSatuan && produk.satuan) {
    selSatuan.value = produk.satuan;
    updateEbSatuanDasar();
  }
  const satuanDasar = document.getElementById("eb-satuan-dasar");
  if (satuanDasar && produk.satuan_dasar)
    satuanDasar.value = produk.satuan_dasar;
  // Foto existing
  const fotoExisting = document.getElementById("eb-foto-existing");
  const fotoExistingImg = document.getElementById("eb-foto-existing-img");
  if (produk.foto) {
    fotoExistingImg.src = `${BASE_URL}/images/produk/${produk.foto}`;
    fotoExisting.style.display = "block";
  } else {
    fotoExisting.style.display = "none";
    fotoExistingImg.src = "";
  }

  clearFotoEditBibit();
  const err = document.getElementById("eb-err");
  if (err) err.textContent = "";

  openModal("modal-edit-bibit");
}

function previewFotoEditBibit(input) {
  const preview = document.getElementById("eb-foto-preview");
  const img = document.getElementById("eb-foto-preview-img");
  if (!preview || !img) return;
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
      preview.style.display = "block";
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function clearFotoEditBibit() {
  const input = document.getElementById("eb-foto");
  const preview = document.getElementById("eb-foto-preview");
  const img = document.getElementById("eb-foto-preview-img");
  if (input) input.value = "";
  if (img) img.src = "";
  if (preview) preview.style.display = "none";
}

async function simpanEditBibit() {
  const id = document.getElementById("eb-id")?.value;
  const nama = document.getElementById("eb-nama")?.value.trim();
  const err = document.getElementById("eb-err");

  if (!nama) {
    if (err) err.textContent = "Nama produk tidak boleh kosong";
    return;
  }

  const form = new FormData();
  form.append("action", "edit_bibit");
  form.append("id", id);
  form.append("nama", nama);
  form.append(
    "kategori",
    document.getElementById("eb-kategori")?.value || "parfum_baju",
  );
  const ebSatuan = document.getElementById("eb-satuan");
  const ebOpt = ebSatuan?.selectedOptions[0];
  form.append("satuan", ebSatuan?.value || "ml");
  form.append("satuan_dasar", ebOpt?.dataset.dasar || ebSatuan?.value || "ml");
  form.append("konversi", parseFloat(ebOpt?.dataset.konversi || 1));
  form.append(
    "deskripsi",
    document.getElementById("eb-deskripsi")?.value?.trim() || "",
  );
  form.append(
    "tampil_landing",
    document.getElementById("eb-tampil-landing")?.checked ? 1 : 0,
  );

  const fotoFile = document.getElementById("eb-foto")?.files?.[0];
  if (fotoFile) form.append("foto", fotoFile);

  try {
    const res = await fetch(BASE_URL + "/api/users.php", {
      method: "POST",
      body: form,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || "Gagal menyimpan");

    closeModal("modal-edit-bibit");
    clearFotoEditBibit();
    await loadStokData();
    renderProdukList();
    toastOk("Produk berhasil diperbarui");
  } catch (e) {
    if (err) err.textContent = e.message;
    else toastErr(e.message);
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
    mix_group: null,
    stamp_counted: false,
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
    .map((item, i) => {
      const mixLabel = item.mix_group
        ? `<span style="font-size:10px;background:var(--amber-m);color:#7a4f00;padding:2px 7px;border-radius:99px;font-weight:600">Mix ${item.mix_group}</span>`
        : "";

      const existing = [
        ...new Set(
          notaItems.filter((x) => x.mix_group).map((x) => x.mix_group),
        ),
      ].sort((a, b) => a - b);
      const nextNum = existing.length ? Math.max(...existing) + 1 : 1;
      let mixOpts = existing
        .map(
          (n) =>
            `<option value="${n}" ${item.mix_group === n ? "selected" : ""}>Mix ${n}</option>`,
        )
        .join("");
      mixOpts += `<option value="${nextNum}">+ Mix Baru (Mix ${nextNum})</option>`;
      if (item.mix_group)
        mixOpts += `<option value="0">✕ Lepas dari Mix</option>`;

      // Tentukan apakah stamp_counted bisa dicentang
      // Jika item ini mix, semua bibit dalam mix yang sama harus ikut atau tidak
      // Cek apakah item ini aksesoris (tidak boleh single stamp)
      const produkData = allProduk.find((p) => p.id == item.bibit_id);
      const isAksesoris = produkData?.kategori === "aksesoris";
      const isInMix = !!item.mix_group;

      // Cek apakah mix group ini sudah ada yang dicentang
      const mixGroupChecked = isInMix
        ? notaItems.some(
            (x, xi) =>
              xi !== i && x.mix_group === item.mix_group && x.stamp_counted,
          )
        : false;

      // Jika item mix: stamp_counted dikontrol dari checkbox pertama di grup
      // Kita tampilkan checkbox hanya di item pertama tiap mix group
      const isFirstInMixGroup = isInMix
        ? notaItems.findIndex((x) => x.mix_group === item.mix_group) === i
        : true;

      let stampControl = "";
      if (!isInMix) {
        if (isAksesoris) {
          // Aksesoris tidak boleh single stamp
          stampControl = `
      <span style="font-size:10px;color:var(--text2);flex-shrink:0;padding:2px 6px;
        background:var(--bg2);border-radius:6px" title="Aksesoris tidak bisa di-stamp sendiri">
        —
      </span>`;
          // Pastikan stamp_counted false
          if (item.stamp_counted) {
            notaItems[i].stamp_counted = false;
          }
        } else {
          // Single item non-aksesoris: checkbox individual
          stampControl = `
      <label style="display:flex;align-items:center;gap:4px;cursor:pointer;flex-shrink:0" title="Masukkan ke stamp">
        <input type="checkbox" ${item.stamp_counted ? "checked" : ""}
          onchange="toggleStamp(${i}, this.checked)"
          style="width:15px;height:15px;accent-color:var(--teal);cursor:pointer"/>
        <span style="font-size:10px;color:var(--text2)">Stamp</span>
      </label>`;
        }
      } else if (isFirstInMixGroup) {
        // Mix: hanya tampilkan 1 checkbox di item pertama grup, kontrol seluruh grup
        stampControl = `
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;flex-shrink:0" title="Stamp untuk seluruh Mix ${item.mix_group}">
            <input type="checkbox" ${item.stamp_counted ? "checked" : ""}
              onchange="toggleMixStamp(${item.mix_group}, this.checked)"
              style="width:15px;height:15px;accent-color:var(--amber);cursor:pointer"/>
            <span style="font-size:10px;color:var(--text2)">Stamp</span>
          </label>`;
      } else {
        // Mix non-pertama: tampilkan indikator saja (ikut grup)
        stampControl = `
          <span style="font-size:10px;color:var(--text2);flex-shrink:0;padding:2px 6px;background:var(--bg2);border-radius:6px">
            ${item.stamp_counted ? "✓ Stamp" : "—"}
          </span>`;
      }

      const stampBadge = item.stamp_counted
        ? `<span style="font-size:9px;background:var(--teal-l);color:var(--teal);padding:1px 5px;border-radius:99px;font-weight:600;flex-shrink:0">+1 🎫</span>`
        : "";

      return `
        <div class="nota-item" id="nota-item-${i}">
          <div class="nota-item-info">
            <div class="nota-item-nama" style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
              ${esc(item.bibit_nama)}
              ${mixLabel}
              ${stampBadge}
            </div>
            <div class="nota-item-sub">${item.jumlah_jual} ${esc(item.satuan_jual)}${item.satuan_jual !== item.satuan_dasar ? " → " + item.jumlah_stok + " " + esc(item.satuan_dasar) : ""}</div>
          </div>
          <div class="nota-item-price">
            <div class="nota-item-total">Rp ${item.subtotal.toLocaleString("id-ID")}</div>
            <div class="nota-item-unit">@ Rp ${item.harga_satuan.toLocaleString("id-ID")}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;margin:0 4px">
            ${stampControl}
            <select onchange="setMixGroup(${i}, this.value)"
              style="font-size:10px;padding:2px 4px;border:0.5px solid var(--border);border-radius:6px;background:var(--bg2);cursor:pointer;max-width:70px"
              title="Tandai sebagai mix">
              <option value="">Mix...</option>
              ${mixOpts}
            </select>
          </div>
          <button class="nota-del" onclick="hapusItem(${i})">×</button>
        </div>`;
    })
    .join("");

  // Hitung stamp preview
  const stampCount = hitungStampPreview();

  $("k-nota-items").innerHTML = items;
  const total = notaItems.reduce((s, i) => s + i.subtotal, 0);
  $("k-total").textContent = "Rp " + total.toLocaleString("id-ID");
  const cnt = $("k-nota-count");
  if (cnt) cnt.textContent = notaItems.length + " item";

  // Update stamp preview badge
  renderStampPreview(stampCount);
}

// Toggle stamp untuk item single
function toggleStamp(idx, checked) {
  notaItems[idx].stamp_counted = checked;
  renderNota();
}

// Toggle stamp untuk seluruh mix group sekaligus
function toggleMixStamp(mixGroup, checked) {
  notaItems.forEach((item) => {
    if (item.mix_group === mixGroup) {
      item.stamp_counted = checked;
    }
  });
  renderNota();
}

// Hitung berapa stamp yang akan didapat dari nota ini
function hitungStampPreview() {
  let count = 0;
  const mixGroupsSudahDihitung = new Set();

  notaItems.forEach((item) => {
    if (!item.stamp_counted) return;
    if (item.mix_group) {
      if (!mixGroupsSudahDihitung.has(item.mix_group)) {
        mixGroupsSudahDihitung.add(item.mix_group);
        count++;
      }
    } else {
      count++;
    }
  });
  return count;
}

// Render info stamp di bawah nota

function setMixGroup(idx, val) {
  const num = parseInt(val);
  if (isNaN(num) || num === 0) {
    // Lepas dari mix — reset stamp_counted ke false
    notaItems[idx].mix_group = null;
    notaItems[idx].stamp_counted = false;
  } else {
    notaItems[idx].mix_group = num;
    // Sync stamp_counted ke semua item dalam mix group yang sama
    // Ambil status stamp dari item pertama di mix group ini
    const firstInGroup = notaItems.find(
      (x, xi) => xi !== idx && x.mix_group === num,
    );
    if (firstInGroup) {
      // Ikut status stamp group yang sudah ada
      notaItems[idx].stamp_counted = firstInGroup.stamp_counted;
    }
    // Pastikan semua item di group ini stamp_counted-nya sama
    notaItems.forEach((item) => {
      if (item.mix_group === num) {
        item.stamp_counted = notaItems[idx].stamp_counted;
      }
    });
  }
  renderNota();
}

function batalNota() {
  if (!notaItems.length || confirm("Batalkan nota ini?")) {
    notaItems = [];
    renderNota();
    clearProduk();
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
  const kode = t.kode_nota;
  if (!kode) {
    toastErr("Kode nota tidak ditemukan");
    return;
  }
  window.location.href =
    BASE_URL + "/nota.php?kode=" + encodeURIComponent(kode);
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
  const laba = parseFloat(data.laba_bersih || data.total_omzet || 0);
  const totalKeluar = parseFloat(data.total_keluar || 0);
  const labaColor = laba >= 0 ? "var(--green)" : "var(--red)";

  const summaryHTML = `
    <div class="rekap-summary">
      <div class="rekap-sum-card" style="border:1.5px solid var(--amber-m)">
        <div class="rekap-sum-val" style="color:var(--blue)">Rp ${parseFloat(data.total_omzet || 0).toLocaleString("id-ID")}</div>
        <div class="rekap-sum-lbl">Total Pemasukan</div>
      </div>
      <div class="rekap-sum-card" style="border:1.5px solid #FF85BB">
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
        <div class="rekap-sum-val" style="font-size:15px">Rp ${Math.round(parseFloat(data.rata_omzet_per_hari || 0)).toLocaleString("id-ID")}</div>
        <div class="rekap-sum-lbl">Rata-rata / Hari Aktif</div>
      </div>
    </div>`;

  const grafikHTML = `
    <div class="rekap-card">
      <div class="rekap-card-title">Grafik Omzet Harian — ${esc(data.periode)}</div>
      <div style="height:240px;position:relative">
        <canvas id="rekap-chart"></canvas>
      </div>
    </div>`;

  // ---- TABEL CABANG ----
  let cabangHTML = "";
  if (showCabangBreakdown && data.per_cabang?.length > 1) {
    const cabangRows = data.per_cabang.map((c) => {
      const kel = (data.keluar_per_cabang || []).find(
        (k) => k.cabang_id == c.cabang_id,
      );
      const keluar = parseFloat(kel?.total_keluar || 0);
      const lbCabang = parseFloat(c.total_omzet || 0) - keluar;
      return {
        nama: c.cabang_nama,
        trx: parseInt(c.jumlah_transaksi || 0),
        omzet: parseFloat(c.total_omzet || 0),
        keluar: keluar,
        laba: lbCabang,
        rata: Math.round(parseFloat(c.rata_transaksi || 0)),
      };
    });

    window._cabangData = cabangRows;
    window._cabangSort = { key: null, asc: true };

    cabangHTML = `
      <div class="rekap-card">
        <div class="rekap-card-title">Omzet per Cabang</div>
        <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th>#</th>
            <th onclick="sortRekap('cabang','nama')" style="cursor:pointer">Cabang <span id="si-cab-nama">↕</span></th>
            <th onclick="sortRekap('cabang','trx')" style="cursor:pointer;text-align:right">Transaksi <span id="si-cab-trx">↕</span></th>
            <th onclick="sortRekap('cabang','omzet')" style="cursor:pointer;text-align:right">Total Omzet <span id="si-cab-omzet">↕</span></th>
            <th onclick="sortRekap('cabang','keluar')" style="cursor:pointer;text-align:right">Pengeluaran <span id="si-cab-keluar">↕</span></th>
            <th onclick="sortRekap('cabang','laba')" style="cursor:pointer;text-align:right">Laba Bersih <span id="si-cab-laba">↕</span></th>
            <th onclick="sortRekap('cabang','rata')" style="cursor:pointer;text-align:right">Rata-rata/Nota <span id="si-cab-rata">↕</span></th>
          </tr></thead>
          <tbody id="tbody-cabang"></tbody>
        </table></div>
      </div>`;

    setTimeout(() => renderCabangRows(), 0);
  }

  // ---- TABEL PRODUK TERLARIS ----
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

  window._produkData = terlarisArr;
  window._produkSort = { key: null, asc: true };

  const terlarisHTML = `
    <div class="rekap-card">
      <div class="rekap-card-title">Produk Terlaris</div>
      <div class="tbl-wrap">
      <table>
        <thead><tr>
          <th>#</th>
          <th onclick="sortRekap('produk','bibit_nama')" style="cursor:pointer">Produk <span id="si-prod-nama">↕</span></th>
          <th onclick="sortRekap('produk','total_terjual')" style="cursor:pointer;text-align:right">Terjual <span id="si-prod-terjual">↕</span></th>
          <th onclick="sortRekap('produk','frekuensi')" style="cursor:pointer;text-align:right">Frekuensi <span id="si-prod-frek">↕</span></th>
          <th onclick="sortRekap('produk','total_omzet')" style="cursor:pointer;text-align:right">Omzet <span id="si-prod-omzet">↕</span></th>
        </tr></thead>
        <tbody id="tbody-produk"></tbody>
      </table></div>
    </div>`;

  setTimeout(() => renderProdukRows(), 0);

  return summaryHTML + grafikHTML + cabangHTML + terlarisHTML;
}

// ---- RENDER ROWS ----
function renderCabangRows() {
  const tbody = document.getElementById("tbody-cabang");
  if (!tbody) return;
  const rows = window._cabangData || [];
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Belum ada data</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map((c, i) => {
      const labaColor = c.laba >= 0 ? "var(--green)" : "var(--red)";
      return `<tr>
      <td>${i + 1}</td>
      <td><strong>${esc(c.nama)}</strong></td>
      <td style="text-align:right">${c.trx}</td>
      <td style="text-align:right"><strong>Rp ${c.omzet.toLocaleString("id-ID")}</strong></td>
      <td style="text-align:right;color:var(--red)">Rp ${c.keluar.toLocaleString("id-ID")}</td>
      <td style="text-align:right;color:${labaColor}"><strong>Rp ${c.laba.toLocaleString("id-ID")}</strong></td>
      <td style="text-align:right">Rp ${c.rata.toLocaleString("id-ID")}</td>
    </tr>`;
    })
    .join("");
}

function renderProdukRows() {
  const tbody = document.getElementById("tbody-produk");
  if (!tbody) return;
  const rows = window._produkData || [];
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Belum ada data penjualan</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map(
      (p, i) => `
    <tr>
      <td><span style="font-size:13px;font-weight:700;color:${i < 3 ? "var(--amber)" : "var(--text2)"}">${i + 1}</span></td>
      <td><strong>${esc(p.bibit_nama)}</strong></td>
      <td style="text-align:right">${p.total_terjual} ${esc(p.satuan_jual || p.satuan || "")}</td>
      <td style="text-align:right">${p.frekuensi}x</td>
      <td style="text-align:right"><strong>Rp ${p.total_omzet.toLocaleString("id-ID")}</strong></td>
    </tr>`,
    )
    .join("");
}

// ---- SORT ----
function sortRekap(tbl, key) {
  const isCabang = tbl === "cabang";
  const sortState = isCabang ? window._cabangSort : window._produkSort;
  const data = isCabang ? window._cabangData : window._produkData;

  // Toggle asc/desc jika key sama, reset jika key beda
  if (sortState.key === key) {
    sortState.asc = !sortState.asc;
  } else {
    sortState.key = key;
    sortState.asc = true;
  }

  // Reset semua ikon sort
  document
    .querySelectorAll('[id^="si-cab-"], [id^="si-prod-"]')
    .forEach((el) => {
      el.textContent = "↕";
      el.style.opacity = "0.4";
    });

  // Set ikon aktif
  const iconId = isCabang
    ? `si-cab-${key}`
    : `si-prod-${key === "bibit_nama" ? "nama" : key === "total_terjual" ? "terjual" : key === "frekuensi" ? "frek" : "omzet"}`;
  const icon = document.getElementById(iconId);
  if (icon) {
    icon.textContent = sortState.asc ? "↑" : "↓";
    icon.style.opacity = "1";
  }

  // Sort data
  data.sort((a, b) => {
    const av = a[key],
      bv = b[key];
    if (typeof av === "string")
      return sortState.asc ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortState.asc ? av - bv : bv - av;
  });

  // Re-render
  isCabang ? renderCabangRows() : renderProdukRows();
}

/* ================================================
   REKAP BULANAN — ADMIN
   ================================================ */
let rekapTglDari = "";
let rekapTglSampai = "";
async function buildRekapTab(target) {
  target.innerHTML = '<div class="loading">Memuat rekap...</div>';
  // 111
  // Isi select bulan tahun
  target.innerHTML = `
    <div class="rekap-toolbar" style="display:flex;flex-direction:column;gap:12px;align-items:stretch">

      <div style="display:flex;align-items:center;gap:8px">
        <label style="font-size:12px;color:var(--text2);font-weight:500;white-space:nowrap;width:55px">Cabang:</label>
        <div id="rekap-cabang-wrap" style="position:relative;flex:1;min-width:0">
          <button type="button" id="rekap-cabang-btn"
            onclick="toggleRekapCabangDrop()"
            style="width:100%;text-align:left;padding:7px 10px;border:0.5px solid var(--border);border-radius:8px;background:var(--bg);cursor:pointer;font-size:13px;display:flex;justify-content:space-between;align-items:center">
            <span id="rekap-cabang-label">Semua Cabang</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <div id="rekap-cabang-drop" style="display:none;position:absolute;top:calc(100% + 4px);left:0;z-index:99;border:0.5px solid var(--border);background:var(--bg);border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.1);padding:8px;min-width:200px">
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
      </div>

      <div style="display:flex;align-items:center;gap:8px">
        <label style="font-size:12px;color:var(--text2);font-weight:500;white-space:nowrap;width:55px">Bulan:</label>
        <div style="display:flex;align-items:center;gap:8px;flex:1">
          <select id="rekap-bulan" onchange="loadRekapAdmin()" style="flex:1;min-width:0;padding:7px 10px;border:0.5px solid var(--border);border-radius:8px;font-size:13px"></select>
          <select id="rekap-tahun" onchange="loadRekapAdmin()" style="width:85px;padding:7px 10px;border:0.5px solid var(--border);border-radius:8px;font-size:13px"></select>
        </div>
      </div>

      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <label style="font-size:12px;color:var(--text2);font-weight:500;white-space:nowrap;width:55px">Dari:</label>
        <input type="date" id="rekap-tgl-dari" style="flex:1;min-width:115px;padding:6px 10px;border:0.5px solid var(--border);border-radius:8px;font-size:13px"
          onchange="rekapTglDari=this.value;loadRekapAdmin()"/>
        <label style="font-size:12px;color:var(--text2);font-weight:500;white-space:nowrap;margin-left:4px">Sampai:</label>
        <input type="date" id="rekap-tgl-sampai" style="flex:1;min-width:115px;padding:6px 10px;border:0.5px solid var(--border);border-radius:8px;font-size:13px"
          onchange="rekapTglSampai=this.value;loadRekapAdmin()"/>
        <button class="btn btn-sm" onclick="resetRentangRekap()" title="Reset filter tanggal"
          style="white-space:nowrap;padding:7px 10px">✕ Reset</button>
      </div>

      <div style="display:flex;gap:8px">
        <button class="btn btn-green" style="flex:1" onclick="exportPDFRekap(true)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:5px"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          Export PDF
        </button>
        <button class="btn" style="flex:1;background:#1D6F42;color:#fff" onclick="exportExcelRekap(true)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:5px"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          Export Excel
        </button>
      </div>

    </div>
    <div id="rekap-content" style="margin-top:14px"><div class="empty">Pilih bulan untuk melihat rekap</div></div>
`;

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
      [
        "Rata-rata Omzet/Hari Aktif",
        Math.round(parseFloat(data.rata_omzet_per_hari || 0)),
      ],
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
        Math.round(parseFloat(c.rata_transaksi || 0)),
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
          Math.round(parseFloat(data.rata_omzet_per_hari || 0)).toLocaleString(
            "id-ID",
          ),
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
          "Rp " +
            Math.round(parseFloat(c.rata_transaksi || 0)).toLocaleString(
              "id-ID",
            ),
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
let logTanggal = "";

async function buildLogTab(target) {
  target.innerHTML = `
    <div class="card" style="padding:12px;margin-bottom:12px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input type="text" id="log-search" placeholder="Cari karyawan, produk, cabang..."
          style="flex:1;min-width:160px" oninput="debounceLogSearch()"
          value="${esc(logKeyword)}"/>
        <input type="date" id="log-tgl" value="${esc(logTanggal)}"
          onchange="logTanggal=this.value;logPage=1;loadLogPage(1)"
          style="width:140px"/>
        <button class="btn btn-sm" onclick="logTanggal='';$('log-tgl').value='';logPage=1;loadLogPage(1)"
          title="Reset filter tanggal">✕ Tanggal</button>
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
    const url = `${BASE_URL}/api/log.php?page=${page}&per_page=${PER_PAGE}&keyword=${encodeURIComponent(logKeyword)}${logTanggal ? "&tanggal=" + logTanggal : ""}`;
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
      <div class="log-row" style="flex-wrap:wrap;gap:6px">
        <div class="log-dot dot-${l.tipe}" style="flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div class="log-info" style="word-break:break-word">
            <strong>${esc(l.user_nama)}</strong> — ${esc(l.bibit_nama)} di ${esc(l.cabang_nama)}
            ${l.tipe === "kurang" ? "berkurang" : "bertambah"}
            <strong>${parseFloat(l.jumlah)} ${esc(l.satuan || "")}</strong>
            ${l.keterangan ? " (" + esc(l.keterangan) + ")" : ""}
          </div>
          <div class="log-meta">Sisa: ${parseFloat(l.sisa)} ${esc(l.satuan || "")}</div>
        </div>
        <div class="log-time" style="font-size:10px;white-space:nowrap;flex-shrink:0">${l.created_at.replace(" ", "<br/>")}</div>
      </div>`,
      )
      .join("");

    // Render pengeluaran jika ada filter tanggal
    const pengeluaran = data.pengeluaran || [];
    const kelHTML =
      pengeluaran.length && logTanggal
        ? `
      <div class="card" style="margin-top:12px">
        <div class="card-header">
          <span class="card-title">Pengeluaran</span>
          <span style="font-size:12px;color:var(--text2)">${pengeluaran.length} item</span>
        </div>
        ${pengeluaran
          .map(
            (p) => `
        <div class="log-row" style="flex-wrap:wrap;gap:6px">
          <div class="log-dot" style="background:var(--red);flex-shrink:0"></div>
          <div style="flex:1;min-width:0">
            <div class="log-info" style="word-break:break-word">
              <strong>${esc(p.user_nama)}</strong> — 
              <strong>${esc(p.nama_item)}</strong> di ${esc(p.cabang_nama)}
              senilai <strong style="color:var(--red)">Rp ${parseFloat(p.nominal).toLocaleString("id-ID")}</strong>
              ${p.keterangan ? " (" + esc(p.keterangan) + ")" : ""}
            </div>
            <div class="log-meta">Pengeluaran</div>
          </div>
          <div class="log-time" style="font-size:10px;white-space:nowrap;flex-shrink:0">
            ${p.created_at.replace(" ", "<br/>")}
          </div>
        </div>`,
          )
          .join("")}
      </div>`
        : "";

    content.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Riwayat Aktivitas</span>
          <span style="font-size:12px;color:var(--text2)">${pag?.total || 0} total log</span>
        </div>
        ${rows}
        ${buildPaginationHTML(pag, "loadLogPage")}
      </div>
      ${kelHTML}`;
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
        <div class="sum-card" style="border:1.5px solid var(--amber-m)">
          <div class="sum-val" style="color:var(--blue);font-size:15px">Rp ${totalMasuk.toLocaleString("id-ID")}</div>
          <div class="sum-lbl">Total Masuk</div>
        </div>
        <div class="sum-card" style="border:1.5px solid #FF85BB">
          <div class="sum-val" style="color:var(--red);font-size:15px">Rp ${totalKeluar.toLocaleString("id-ID")}</div>
          <div class="sum-lbl">Total Keluar</div>
        </div>
        <div class="sum-card" style="border:1.5px solid ${labaBersih >= 0 ? "#9fe1cb" : "#f7c1c1"}">
          <div class="sum-val" style="color:${labaBersih >= 0 ? "var(--green)" : "var(--red)"};font-size:15px">
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
        const isReward = t.kode_nota.startsWith("REWARD-");
        const items = (t.items || [])
          .map(
            (item) =>
              `<div class="trx-row">
          <span>
  ${esc(item.bibit_nama)} × ${parseFloat(item.jumlah_jual)} ${esc(item.satuan_jual)}
  ${item.mix_group ? `<span style="font-size:10px;background:var(--amber-m);color:#7a4f00;padding:1px 6px;border-radius:99px;margin-left:4px">Mix ${item.mix_group}</span>` : ""}
</span>
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
          : isReward
            ? `<span class="badge" style="background:var(--amber-m);color:#7a4f00">🎁 Reward</span>`
            : "";

        return `<div class="trx-card" style="${isBatal ? "opacity:0.6;" : ""}">
        <div class="trx-head">
          <div>
            <div class="trx-kode">${esc(t.kode_nota)} ${statusBadge}
              <span class="badge" style="background:var(--teal-l);color:var(--teal);margin-left:4px">Masuk</span>
            </div>
            <div class="trx-meta">${t.created_at} · ${esc(t.user_nama)}</div>
          </div>
          <div class="trx-jumlah" style="${isBatal ? "text-decoration:line-through;color:var(--text2)" : isReward ? "color:var(--amber)" : "color:var(--teal)"}">
  ${isReward ? "🎁 Reward" : "+ Rp " + parseFloat(t.total).toLocaleString("id-ID")}
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

function debounceStokSearch() {
  clearTimeout(stokSearchTimer);
  stokSearchTimer = setTimeout(() => {
    stokKeyword = $("stok-keyword")?.value || "";
    stokPage = 1;
    loadStokPage(1);
  }, 400);
}

// GANTI fungsi setFilter yang lama:
function setFilter(f) {
  activeFilter = f;
  stokPage = 1;
  stokKeyword = "";

  // Update pill aktif tanpa rebuild seluruh HTML
  document.querySelectorAll(".pill").forEach((btn) => {
    const btnFilter = btn
      .getAttribute("onclick")
      .match(/setFilter\((.+?)\)/)?.[1];
    const btnVal =
      btnFilter === "'all'" || btnFilter === '"all"'
        ? "all"
        : parseInt(btnFilter);
    btn.classList.toggle("active", String(btnVal) === String(f));
  });

  // Hanya reload stok content (tanpa rebuild grafik)
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
/* ================================================
   DARK MODE TOGGLE
   ================================================ */
function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const newTheme = isDark ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("mw-theme", newTheme);
  const btn = document.getElementById("btn-theme");
  if (btn) btn.textContent = newTheme === "dark" ? "☀️" : "🌙";
}

// Terapkan tema saat halaman dimuat
(function () {
  const saved = localStorage.getItem("mw-theme") || "light";
  if (saved === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    // Set ikon setelah DOM siap
    document.addEventListener("DOMContentLoaded", () => {
      const btn = document.getElementById("btn-theme");
      if (btn) btn.textContent = "☀️";
    });
  }
})();

/* ================================================
   SISTEM MEMBER
   ================================================ */

let selectedMember = null;
let memberSearchTimer = null;

// ---- Tab switch handler (tambah case 'member') ----
// Cari fungsi kTab() yang sudah ada, tambahkan:
// if (name === "member") loadTabMember();
// Atau ganti seluruh kTab() dengan versi baru:

function kTab(name) {
  ["transaksi", "keluar", "riwayat", "stok", "rekap", "member"].forEach((n) => {
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
  if (name === "member") loadTabMember();
}

// ---- Load tab member ----
async function loadTabMember() {
  try {
    const data = await api(
      `${BASE_URL}/api/member.php?action=summary&cabang_id=${CURRENT_USER.cabang_id}`,
    );
    if ($("m-total-member"))
      $("m-total-member").textContent = data.total_member ?? "-";
    if ($("m-total-aktif"))
      $("m-total-aktif").textContent = data.total_aktif ?? "-";
    if ($("m-total-reward"))
      $("m-total-reward").textContent = data.total_reward_pending ?? "-";
    await loadDaftarMember();
  } catch (e) {
    console.error("loadTabMember:", e);
  }
}

let memberFilter = "semua"; // 'semua' atau 'cabang'

function setMemberFilter(filter) {
  memberFilter = filter;

  // Update tampilan tombol
  const btnSemua = $("m-filter-semua");
  const btnCabang = $("m-filter-cabang");
  if (btnSemua && btnCabang) {
    if (filter === "semua") {
      btnSemua.className = "btn btn-sm btn-primary";
      btnCabang.className = "btn btn-sm";
      btnCabang.style.cssText =
        "flex:1;font-size:12px;background:var(--bg2);border:0.5px solid var(--border)";
      btnSemua.style.cssText = "flex:1;font-size:12px";
    } else {
      btnCabang.className = "btn btn-sm btn-primary";
      btnSemua.className = "btn btn-sm";
      btnSemua.style.cssText =
        "flex:1;font-size:12px;background:var(--bg2);border:0.5px solid var(--border)";
      btnCabang.style.cssText = "flex:1;font-size:12px";
    }
  }

  memberPage = 1;
  memberKeyword = "";
  if ($("m-search")) $("m-search").value = "";
  loadDaftarMember(1);
}

// ---- Load daftar member cabang ----
let memberPage = 1;
let memberKeyword = "";

async function loadDaftarMember(page = 1) {
  memberPage = page;
  const wrap = $("m-list-wrap");
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading">Memuat...</div>';
  try {
    const url = `${BASE_URL}/api/member.php?action=list&cabang_id=${CURRENT_USER.cabang_id}&filter=${memberFilter}&page=${page}&keyword=${encodeURIComponent(memberKeyword)}`;
    const data = await api(url);
    const members = data.members || [];

    if (!members.length) {
      wrap.innerHTML =
        '<div class="empty" style="padding:2rem">Belum ada member ditemukan</div>';
      return;
    }

    const cards = members
      .map((m) => {
        const stampMod = m.stamp_available % 10;
        const pct = (stampMod / 10) * 100;
        const rewardPending = parseInt(m.reward_pending || 0);
        const isLuarCabang = m.cabang_asal_id != CURRENT_USER.cabang_id;

        return `
        <div class="trx-card" style="cursor:pointer" onclick="openDetailMember(${m.id})">
          <div style="display:flex;align-items:flex-start;gap:10px">
            <div style="width:40px;height:40px;border-radius:50%;background:${isLuarCabang ? "var(--bg2)" : "var(--teal-l)"};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:${isLuarCabang ? "var(--text2)" : "var(--teal)"};flex-shrink:0">
              ${esc(m.nama.charAt(0).toUpperCase())}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                ${esc(m.nama)}
                ${
                  rewardPending > 0
                    ? `<span style="font-size:10px;background:var(--amber-m);color:#7a4f00;padding:1px 6px;border-radius:99px;font-weight:700">🎁 ${rewardPending} reward</span>`
                    : ""
                }
                ${
                  isLuarCabang
                    ? `<span style="font-size:10px;background:var(--bg2);color:var(--text2);padding:1px 6px;border-radius:99px;border:0.5px solid var(--border)">📍 ${esc(m.cabang_asal_nama)}</span>`
                    : ""
                }
              </div>
              <div style="font-size:11px;color:var(--text2);margin-top:1px">${esc(m.no_hp)}</div>
              <div style="margin-top:6px">
                <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text2);margin-bottom:2px">
                  <span>${stampMod}/10 stamp</span>
                  <span style="color:var(--amber);font-weight:600">${m.total_stamp} total</span>
                </div>
                <div style="height:5px;background:var(--bg2);border-radius:99px;overflow:hidden">
                  <div style="height:100%;background:${rewardPending > 0 ? "var(--amber)" : "var(--teal)"};border-radius:99px;width:${rewardPending > 0 ? 100 : pct}%;transition:width .3s"></div>
                </div>
              </div>
            </div>
          </div>
        </div>`;
      })
      .join("");

    wrap.innerHTML =
      cards + buildPaginationHTML(data.pagination, "loadDaftarMember");
  } catch (e) {
    wrap.innerHTML =
      '<div class="alert alert-danger">Gagal memuat daftar member</div>';
  }
}

function debounceMemberSearch(val) {
  clearTimeout(memberSearchTimer);
  memberSearchTimer = setTimeout(() => {
    memberKeyword = val || "";
    loadDaftarMember(1);
  }, 400);
}

// ---- Open detail member ----
async function openDetailMember(id) {
  try {
    const data = await api(`${BASE_URL}/api/member.php?action=detail&id=${id}`);
    const m = data.member;
    if (!m) return;

    $("mdm-nama-title").textContent = m.nama;

    const stampMod = m.stamp_available % 10;
    const pct = (stampMod / 10) * 100;
    const rewards = data.rewards || [];
    const riwayat = data.riwayat || [];

    // ---- REWARD ROWS (urutan terbaru ke terlama) ----
    const rewardRows = rewards.length
      ? rewards
          .map((r, idx) => {
            const nomorReward = rewards.length - idx;
            const rataFormatted = parseFloat(
              r.rata_nominal || 0,
            ).toLocaleString("id-ID");
            const totalFormatted = parseFloat(
              r.total_nominal || 0,
            ).toLocaleString("id-ID");

            return `
            <div style="border:0.5px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                <div>
                  <div style="font-size:12px;font-weight:600">🎁 Reward ke-${nomorReward}</div>
                  <div style="font-size:11px;color:var(--text2)">${r.created_at.substring(0, 10)}</div>
                </div>
                ${
                  r.status === "pending"
                    ? `<button class="btn btn-sm btn-primary"
                      onclick="bukaModalReward(${r.id}, ${m.id}, '${parseFloat(r.rata_nominal || 0).toLocaleString("id-ID")}', '${parseFloat(r.total_nominal || 0).toLocaleString("id-ID")}')">
                      Tukar
                    </button>`
                    : `<span class="badge" style="background:var(--teal-l);color:var(--teal)">Ditukar · ${esc(r.bibit_nama || "-")}</span>`
                }
              </div>
              <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
                <div style="flex:1;padding:6px 10px;background:var(--bg2);border-radius:6px;text-align:center">
                  <div style="font-size:13px;font-weight:700;color:var(--amber)">Rp ${rataFormatted}</div>
                  <div style="font-size:10px;color:var(--text2)">Rata-rata/stamp</div>
                </div>
                <div style="flex:1;padding:6px 10px;background:var(--bg2);border-radius:6px;text-align:center">
                  <div style="font-size:13px;font-weight:700;color:var(--blue)">Rp ${totalFormatted}</div>
                  <div style="font-size:10px;color:var(--text2)">Total 10 stamp</div>
                </div>
              </div>
            </div>`;
          })
          .join("")
      : '<div style="font-size:12px;color:var(--text2);padding:8px 0">Belum ada reward</div>';

    // ---- RIWAYAT — kelompokkan per siklus ----
    const siklus = {};
    riwayat.forEach((t) => {
      const stampMin = parseInt(t.stamp_ke_min || 0);
      const stampMax = parseInt(t.stamp_ke_max || 0);

      if (stampMin === 0 && stampMax === 0) {
        if (!siklus["0"]) siklus["0"] = { trxs: [] };
        siklus["0"].trxs.push(t);
        return;
      }
      const siklusMin = Math.ceil(stampMin / 10);
      const siklusMax = Math.ceil(stampMax / 10);

      for (let n = siklusMin; n <= siklusMax; n++) {
        if (!siklus[n]) {
          siklus[n] = {
            nomor: n,
            stamp_dari: (n - 1) * 10 + 1,
            stamp_ke: n * 10,
            trxs: [],
          };
        }
        if (!siklus[n].trxs.find((x) => x.id === t.id)) {
          siklus[n].trxs.push(t);
        }
      }
    });

    const sortedSiklus = Object.values(siklus)
      .filter((s) => s.nomor)
      .sort((a, b) => b.nomor - a.nomor);

    const rewardTrxs =
      siklus["0"]?.trxs.filter((t) => t.kode_nota.startsWith("REWARD-")) || [];

    const siklusCards = sortedSiklus
      .map((s) => {
        const reward = rewards.find(
          (r) => parseInt(r.stamp_snapshot) === s.stamp_ke,
        );

        const allStampKe = [];
        s.trxs.forEach((t) => {
          const min = parseInt(t.stamp_ke_min || 0);
          const max = parseInt(t.stamp_ke_max || 0);
          for (let i = min; i <= max; i++) allStampKe.push(i);
        });
        const stampDiSiklus = [...new Set(allStampKe)].filter(
          (k) => k >= s.stamp_dari && k <= s.stamp_ke,
        ).length;
        const isComplete = stampDiSiklus >= 10;

        let headerBg, headerColor, statusLabel;
        if (reward?.status === "redeemed") {
          headerBg = "var(--teal-l)";
          headerColor = "var(--teal)";
          statusLabel = `<span style="font-size:10px;background:var(--teal-l);color:var(--teal);padding:2px 7px;border-radius:99px;font-weight:600;border:0.5px solid #9fe1cb">✓ Ditukar</span>`;
        } else if (reward?.status === "pending") {
          headerBg = "#fffbe6";
          headerColor = "#7a4f00";
          statusLabel = `<span style="font-size:10px;background:var(--amber-m);color:#7a4f00;padding:2px 7px;border-radius:99px;font-weight:600">🎁 Reward!</span>`;
        } else if (isComplete) {
          headerBg = "var(--blue-l)";
          headerColor = "var(--blue)";
          statusLabel = `<span style="font-size:10px;background:var(--blue-l);color:var(--blue);padding:2px 7px;border-radius:99px;font-weight:600">✓ Lengkap</span>`;
        } else {
          headerBg = "var(--bg2)";
          headerColor = "var(--text)";
          statusLabel = `<span style="font-size:10px;background:var(--bg2);color:var(--text2);padding:2px 7px;border-radius:99px;font-weight:600;border:0.5px solid var(--border)">${stampDiSiklus}/10</span>`;
        }

        // Mini grid 10 kotak
        let miniGrid = "";
        for (let i = 1; i <= 10; i++) {
          const globalKe = s.stamp_dari + i - 1;
          const filled = allStampKe.includes(globalKe);
          miniGrid += `<div style="width:100%;aspect-ratio:1;border-radius:4px;
          background:${filled ? "var(--amber)" : "var(--bg)"};
          border:1px solid ${filled ? "var(--amber)" : "var(--border)"};
          display:flex;align-items:center;justify-content:center;font-size:8px">
          ${filled ? "🎫" : ""}
        </div>`;
        }

        const rewardInfo = reward
          ? reward.status === "pending"
            ? `<div style="margin-top:6px;padding:6px 10px;background:var(--amber-m);
              border-radius:6px;font-size:11px;color:#7a4f00;text-align:center">
              🎁 Reward menunggu penukaran
            </div>`
            : reward.status === "redeemed"
              ? `<div style="margin-top:6px;padding:6px 10px;background:var(--teal-l);
              border-radius:6px;font-size:11px;color:var(--teal)">
              ✓ Ditukar: <strong>${esc(reward.bibit_nama || "-")}</strong>
            </div>`
              : ""
          : "";

        // Transaksi dalam siklus ini
        const trxRows = s.trxs
          .map((t) => {
            const itemsPerReward = t.items_per_reward || {};
            const tglStr = t.created_at.substring(0, 10);
            const isReward = t.kode_nota.startsWith("REWARD-");
            const nominalSiklus = (() => {
              let total = 0;
              Object.values(itemsPerReward).forEach((groupItems) => {
                groupItems.forEach((item) => {
                  const stampKe = parseInt(item.stamp_ke || 0);
                  if (stampKe >= s.stamp_dari && stampKe <= s.stamp_ke) {
                    total += parseFloat(item.subtotal || 0);
                  }
                });
              });
              return total;
            })();

            const rewardGroups = Object.keys(itemsPerReward);

            const groupedHTML = rewardGroups
              .map((groupKey) => {
                const groupItems = itemsPerReward[groupKey];
                const isProgress = groupKey === "progress";

                // Filter hanya item yang stamp_ke-nya masuk ke siklus ini
                const filteredItems = groupItems.filter((item) => {
                  const stampKe = parseInt(item.stamp_ke || 0);
                  return stampKe >= s.stamp_dari && stampKe <= s.stamp_ke;
                });

                // Skip group ini kalau tidak ada item yang masuk siklus
                if (!filteredItems.length) return "";

                const groupLabel = isProgress
                  ? '<span style="font-size:10px;color:var(--text2);font-style:italic">Progress reward berikutnya</span>'
                  : "";

                const itemRows = filteredItems
                  .map((item) => {
                    if (item.is_mix) {
                      return `
                <div style="padding:5px 0 5px 10px;border-left:2px solid var(--amber-m);margin:3px 0">
                  <div style="font-size:11px;font-weight:600;color:var(--amber)">🎫 Mix (stamp ke-${item.stamp_ke})</div>
                  <div style="display:flex;justify-content:space-between">
                    <div style="font-size:11px;color:var(--text2)">${item.items ? item.items.join(" + ") : ""}</div>
                    <div style="font-size:11px;font-weight:600;white-space:nowrap;margin-left:8px">Rp ${parseFloat(item.subtotal).toLocaleString("id-ID")}</div>
                  </div>
                </div>`;
                    } else {
                      return `
                <div style="display:flex;justify-content:space-between;align-items:center;
                  padding:5px 0 5px 10px;border-left:2px solid ${isProgress ? "var(--blue)" : "var(--teal)"};
                  margin:3px 0;gap:8px">
                  <div>
                    <div style="font-size:11px;font-weight:500">${esc(item.bibit_nama)}
                      <span style="font-size:9px;color:var(--text2)">#${item.stamp_ke}</span>
                    </div>
                    <div style="font-size:10px;color:var(--text2)">${item.jumlah} ${esc(item.satuan)}</div>
                  </div>
                  <div style="font-size:11px;font-weight:600;white-space:nowrap">
                    Rp ${parseFloat(item.subtotal).toLocaleString("id-ID")}
                  </div>
                </div>`;
                    }
                  })
                  .join("");

                return `
            <div style="margin-bottom:6px">
      ${groupLabel}
      ${itemRows}
    </div>`;
              })
              .filter(Boolean)
              .join(
                '<hr style="border:none;border-top:0.5px dashed var(--border);margin:6px 0"/>',
              );

            return `
          <div style="border:0.5px solid var(--border);border-radius:8px;margin-bottom:6px;overflow:hidden">
            <div style="display:flex;justify-content:space-between;align-items:center;
              padding:8px 10px;background:var(--bg2);gap:8px;cursor:pointer"
              onclick="toggleRiwayatDetail('rwd-${s.nomor}-${t.id}', this)">
              <div style="flex:1;min-width:0">
                <div style="font-size:12px;font-weight:600">${esc(t.kode_nota)}</div>
                <div style="font-size:10px;color:var(--text2)">${tglStr} · ${esc(t.cabang_nama)}</div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-size:13px;font-weight:700;color:${isReward ? "var(--amber)" : "var(--teal)"}">
                  ${isReward ? "🎁 Reward" : "Rp " + nominalSiklus.toLocaleString("id-ID")}
                </div>
                <div style="font-size:10px;color:var(--amber)">+${t.stamp_didapat} 🎫</div>
              </div>
              <svg id="chv-${s.nomor}-${t.id}" width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.5"
                style="flex-shrink:0;transition:transform .2s;color:var(--text2)">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </div>
            <div id="rwd-${s.nomor}-${t.id}" style="display:none;padding:8px 10px">
              ${groupedHTML || '<div style="font-size:11px;color:var(--text2)">-</div>'}
            </div>
          </div>`;
          })
          .join("");

        return `
        <div style="background:var(--card);border:0.5px solid var(--border);
          border-radius:12px;margin-bottom:10px;overflow:hidden">
          <div style="padding:10px 12px;background:${headerBg};
            border-bottom:0.5px solid var(--border)">
            <div style="display:flex;align-items:center;justify-content:space-between;
              margin-bottom:8px;gap:8px">
              <div style="font-size:13px;font-weight:700;color:${headerColor}">
                Siklus ${s.nomor}
                <span style="font-size:10px;font-weight:400;color:var(--text2);margin-left:3px">
                  (stamp ${s.stamp_dari}–${s.stamp_ke})
                </span>
              </div>
              ${statusLabel}
            </div>
            <div style="display:grid;grid-template-columns:repeat(10,1fr);gap:3px">
              ${miniGrid}
            </div>
            ${rewardInfo}
          </div>
          <div style="padding:10px 12px">
            <div style="font-size:10px;font-weight:600;color:var(--text2);
              text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">
              ${s.trxs.length} Transaksi
            </div>
            ${trxRows}
          </div>
        </div>`;
      })
      .join("");

    const rewardTrxCard = rewardTrxs.length
      ? `<div style="background:var(--card);border:0.5px solid var(--border);
          border-radius:12px;margin-bottom:10px;overflow:hidden">
          <div style="padding:10px 12px;background:var(--teal-l);
            border-bottom:0.5px solid var(--border);display:flex;align-items:center;gap:8px">
            <span style="font-size:14px">🎁</span>
            <span style="font-size:12px;font-weight:600;color:var(--teal)">Riwayat Penukaran Reward</span>
          </div>
          <div style="padding:10px 12px">
            ${rewardTrxs
              .map((t) => {
                const tgl = new Date(t.created_at).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
                return `
                <div style="display:flex;justify-content:space-between;align-items:center;
                  padding:7px 0;border-bottom:0.5px solid var(--border);font-size:12px;gap:8px">
                  <div>
                    <div style="font-weight:600">${esc(t.kode_nota)}</div>
                    <div style="font-size:11px;color:var(--text2)">${tgl} · ${esc(t.cabang_nama)}</div>
                  </div>
                  <div style="font-weight:700;color:var(--amber)">🎁 Reward</div>
                </div>`;
              })
              .join("")}
          </div>
        </div>`
      : "";

    const riwayatHTML = `${siklusCards}${rewardTrxCard}`;

    // ---- Render ----
    $("mdm-body").innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div style="text-align:center;padding:10px;background:var(--bg2);border-radius:8px">
          <div style="font-size:24px;font-weight:700;color:var(--amber)">${m.total_stamp}</div>
          <div style="font-size:11px;color:var(--text2)">Total Stamp</div>
        </div>
        <div style="text-align:center;padding:10px;background:var(--bg2);border-radius:8px">
          <div style="font-size:24px;font-weight:700;color:var(--teal)">${m.stamp_available}</div>
          <div style="font-size:11px;color:var(--text2)">Stamp Tersedia</div>
        </div>
      </div>

      <!-- Progress stamp -->
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:4px">
          <span>${stampMod}/10 menuju reward berikutnya</span>
          <span>${10 - stampMod} lagi</span>
        </div>
        <div style="height:8px;background:var(--bg2);border-radius:99px;overflow:hidden">
          <div style="height:100%;background:var(--amber);border-radius:99px;width:${pct}%"></div>
        </div>
      </div>

      <!-- Info member -->
      <div style="font-size:12px;color:var(--text2);margin-bottom:14px">
        📱 ${esc(m.no_hp)} &nbsp;·&nbsp; Cabang asal: ${esc(m.cabang_asal_nama || "-")} &nbsp;·&nbsp; Daftar: ${m.created_at.substring(0, 10)}
      </div>

<!-- Reward -->
${
  rewards.some((r) => r.status === "pending")
    ? `<div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Reward Tersedia</div>
      ${rewardRows}
    </div>`
    : ""
}
      <!-- Riwayat transaksi per siklus -->
      <div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">
        Riwayat Transaksi
      </div>
      ${riwayatHTML || '<div style="font-size:12px;color:var(--text2)">Belum ada transaksi</div>'}

      <!-- QR Code member -->
      <div style="text-align:center;margin-top:14px;padding-top:14px;border-top:0.5px solid var(--border)">
        <div style="font-size:11px;color:var(--text2);margin-bottom:6px">QR Code Member</div>
        <div id="mdm-qr-wrap" style="display:inline-block;padding:10px;background:#fff;border-radius:8px;border:0.5px solid var(--border)"></div>
        <div style="font-size:10px;color:var(--text2);margin-top:4px">${esc(m.qr_code)}</div>
      </div>`;

    generateQRCode("mdm-qr-wrap", m.qr_code);
    openModal("modal-detail-member");
  } catch (e) {
    toastErr("Gagal memuat detail member");
  }
}
// ---- Daftar member baru ----
function openModalDaftarMember() {
  $("dm-nama").value = "";
  $("dm-hp").value = "";
  $("dm-catatan").value = "";
  $("dm-err").textContent = "";
  openModal("modal-daftar-member");
}

async function simpanDaftarMember() {
  const nama = $("dm-nama").value.trim();
  const no_hp = $("dm-hp").value.trim();
  const catatan = $("dm-catatan").value.trim();
  const errEl = $("dm-err");

  if (!nama) {
    errEl.textContent = "Nama wajib diisi";
    return;
  }
  if (!no_hp) {
    errEl.textContent = "No HP wajib diisi";
    return;
  }

  try {
    const res = await api(`${BASE_URL}/api/member.php`, "POST", {
      action: "daftar",
      nama,
      no_hp,
      catatan,
      cabang_id: CURRENT_USER.cabang_id,
    });
    if (res.success) {
      closeModal("modal-daftar-member");
      toastOk(`Member ${nama} berhasil didaftarkan`, "Member Baru");
      loadTabMember();
    } else {
      errEl.textContent = res.message || "Gagal mendaftarkan member";
    }
  } catch (e) {
    errEl.textContent = e.message;
  }
}

// ---- Cari member untuk nota transaksi ----
let memberSearchDebounce = null;

async function cariMember(val) {
  clearTimeout(memberSearchDebounce);
  const drop = $("k-member-dropdown");
  if (!drop) return;
  if (!val || val.length < 2) {
    drop.style.display = "none";
    return;
  }
  memberSearchDebounce = setTimeout(async () => {
    try {
      const data = await api(
        `${BASE_URL}/api/member.php?action=search&q=${encodeURIComponent(val)}`,
      );
      const members = data.members || [];
      if (!members.length) {
        drop.innerHTML =
          '<div style="padding:10px 14px;font-size:13px;color:var(--text2)">Member tidak ditemukan</div>';
      } else {
        drop.innerHTML = members
          .map(
            (m) => `
          <div onclick="pilihMemberNota(${m.id})"
            style="padding:10px 14px;font-size:13px;cursor:pointer;border-bottom:0.5px solid var(--border);transition:background .1s"
            onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''">
            <div style="font-weight:500">${esc(m.nama)}</div>
            <div style="font-size:11px;color:var(--text2)">${esc(m.no_hp)} · ${m.total_stamp} stamp · ${m.stamp_available % 10}/10</div>
          </div>`,
          )
          .join("");
      }
      drop.style.display = "block";
    } catch (e) {
      console.error(e);
    }
  }, 350);
}

async function pilihMemberNota(id) {
  try {
    const data = await api(`${BASE_URL}/api/member.php?action=detail&id=${id}`);
    const m = data.member;
    if (!m) return;

    selectedMember = m;
    $("k-member-dropdown").style.display = "none";
    $("k-member-search-wrap").style.display = "none";

    // Tampilkan info member terpilih
    $("k-member-terpilih").style.display = "block";
    $("k-member-nama-display").textContent = m.nama;
    $("k-member-info-display").textContent =
      `${m.no_hp} · Cabang asal: ${m.cabang_asal_nama || "-"}`;
    $("k-member-stamp-display").textContent = m.stamp_available;

    // Progress bar
    const stampMod = m.stamp_available % 10;
    const pct = (stampMod / 10) * 100;
    if ($("k-stamp-progressbar"))
      $("k-stamp-progressbar").style.width = pct + "%";
    if ($("k-stamp-progress-label"))
      $("k-stamp-progress-label").textContent = `${stampMod}/10 menuju reward`;
    if ($("k-stamp-next-label"))
      $("k-stamp-next-label").textContent = `${10 - stampMod} lagi`;

    // Update stamp preview
    const stampCount = hitungStampPreview();
    renderStampPreview(stampCount);
  } catch (e) {
    toastErr("Gagal memuat data member");
  }
}

function clearMemberPilih() {
  selectedMember = null;
  if ($("k-member-search")) $("k-member-search").value = "";
  if ($("k-member-dropdown")) $("k-member-dropdown").style.display = "none";
  if ($("k-member-search-wrap"))
    $("k-member-search-wrap").style.display = "block";
  if ($("k-member-terpilih")) $("k-member-terpilih").style.display = "none";
  renderStampPreview(0);
}

function renderStampPreview(count) {
  const el = $("k-stamp-preview");
  if (!el) return;
  if (count === 0 || !selectedMember) {
    el.style.display = "none";
    return;
  }
  el.style.display = "flex";
  const stampSekarang = selectedMember.stamp_available % 10;
  const stampBaru = stampSekarang + count;
  const akanDapatReward = stampBaru >= 10;
  el.innerHTML = `
    <span style="font-size:13px">🎫</span>
    <span style="font-size:12px;color:var(--teal);font-weight:600">+${count} stamp</span>
    <span style="font-size:11px;color:var(--text2)">akan ditambahkan</span>
    ${
      akanDapatReward
        ? `<span style="font-size:11px;background:var(--amber-m);color:#7a4f00;padding:1px 7px;border-radius:99px;font-weight:600;margin-left:auto">🎁 dapat reward!</span>`
        : ""
    }`;
}

// ---- Override simpanTransaksi untuk kirim member_id & stamp_data ----
// Ganti fungsi simpanTransaksi() yang lama:
async function simpanTransaksi() {
  if (!notaItems.length) {
    toastWarn("Tambahkan produk ke nota terlebih dahulu");
    return;
  }
  const catatan = $("k-catatan")?.value || "";

  // Hitung stamp_data untuk backend
  // Hitung stamp_data SESUAI URUTAN item di nota
  const mixGroupsSudahDihitung = new Set();
  const stampData = [];

  notaItems.forEach((item) => {
    if (!item.stamp_counted) return;

    if (item.mix_group) {
      if (!mixGroupsSudahDihitung.has(item.mix_group)) {
        mixGroupsSudahDihitung.add(item.mix_group);
        stampData.push({
          type: "mix",
          mix_group: item.mix_group,
          // Kumpulkan semua bibit dalam mix ini untuk nominal
          mix_items: notaItems
            .filter((x) => x.mix_group === item.mix_group)
            .map((x) => ({ bibit_id: x.bibit_id, subtotal: x.subtotal })),
        });
      }
    } else {
      stampData.push({
        type: "single",
        bibit_id: item.bibit_id,
        subtotal: item.subtotal,
      });
    }
  });

  try {
    const res = await api(`${BASE_URL}/api/transaksi.php`, "POST", {
      items: notaItems,
      catatan,
      member_id: selectedMember ? selectedMember.id : null,
      stamp_data: stampData,
    });
    if (res.success) {
      await loadKaryawanData();
      notaItems = [];
      renderNota();
      clearProduk();
      clearMemberPilih();
      if ($("k-catatan")) $("k-catatan").value = "";

      let msg = `Nota: ${res.kode_nota} — Total: Rp ${parseFloat(res.total).toLocaleString("id-ID")}`;
      if (res.stamp_ditambahkan > 0)
        msg += ` · +${res.stamp_ditambahkan} stamp`;
      if (res.reward_baru > 0) msg += ` · 🎁 ${res.reward_baru} reward baru!`;
      toastOk(msg, "Transaksi Berhasil!");
    } else {
      toastErr(res.message);
    }
  } catch (e) {
    toastErr(e.message);
  }
}

// ---- Redeem reward ----
async function openRedeemReward(rewardId, memberId) {
  // Load daftar bibit untuk dipilih
  const bibitOpts = bibitData
    .map(
      (b) =>
        `<option value="${b.id}">${esc(b.nama)} [${esc(b.satuan_dasar || b.satuan || "")}]</option>`,
    )
    .join("");

  const confirmed = await showRedeemDialog((rewardOpts) => bibitOpts);
  // Implementasi dialog sederhana pakai prompt dulu, bisa diganti modal later
  const bibitId = await pilihBibitReward();
  if (!bibitId) return;

  try {
    const res = await api(`${BASE_URL}/api/member.php`, "POST", {
      action: "redeem",
      reward_id: rewardId,
      bibit_id: bibitId,
      cabang_id: CURRENT_USER.cabang_id,
    });
    if (res.success) {
      toastOk("Reward berhasil ditukar!", "Redeem Berhasil");
      closeModal("modal-detail-member");
      loadTabMember();
    } else {
      toastErr(res.message || "Gagal menukar reward");
    }
  } catch (e) {
    toastErr(e.message);
  }
}

async function pilihBibitReward() {
  return new Promise((resolve) => {
    // Buat modal redeem inline
    const existing = document.getElementById("modal-redeem-reward");
    if (existing) existing.remove();

    const bibitOpts = bibitData
      .map((b) => `<option value="${b.id}">${esc(b.nama)}</option>`)
      .join("");

    const modal = document.createElement("div");
    modal.id = "modal-redeem-reward";
    modal.className = "modal-bg open";
    modal.innerHTML = `
      <div class="modal" style="max-width:380px;width:90%">
        <div class="modal-header">
          <span class="modal-title">Pilih Bibit Reward</span>
          <button class="modal-close" onclick="document.getElementById('modal-redeem-reward').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Pilih bibit yang diinginkan member</label>
            <select id="redeem-bibit-sel" style="width:100%">${bibitOpts}</select>
          </div>
        </div>
        <div class="modal-footer" style="display:flex;gap:8px">
          <button class="btn" style="flex:1" onclick="document.getElementById('modal-redeem-reward').remove();__redeemResolve(null)">Batal</button>
          <button class="btn btn-primary" style="flex:2" onclick="__redeemResolve(parseInt(document.getElementById('redeem-bibit-sel').value))">Konfirmasi Tukar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    window.__redeemResolve = (val) => {
      modal.remove();
      resolve(val);
    };
  });
}

// ---- QR Scanner (pakai html5-qrcode) ----
let qrScanner = null;

async function startQRScan() {
  openModal("modal-qr-scanner");
  // Load library kalau belum ada
  if (!window.Html5Qrcode) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src =
        "https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  try {
    qrScanner = new Html5Qrcode("qr-reader");
    await qrScanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      async (qrCode) => {
        await stopQRScan();
        // Cari member by QR code
        try {
          const data = await api(
            `${BASE_URL}/api/member.php?action=search_qr&qr=${encodeURIComponent(qrCode)}`,
          );
          if (data.member) {
            pilihMemberNota(data.member.id);
            kTab("transaksi");
            toastOk(`Member ${data.member.nama} ditemukan`, "QR Scan");
          } else {
            toastWarn("QR Code tidak dikenali");
          }
        } catch (e) {
          toastErr("Gagal membaca QR Code");
        }
      },
      () => {},
    );
  } catch (e) {
    $("qr-result").textContent =
      "Kamera tidak tersedia. Pastikan izin kamera sudah diberikan.";
  }
}

async function stopQRScan() {
  if (qrScanner) {
    try {
      await qrScanner.stop();
    } catch (_) {}
    qrScanner = null;
  }
  closeModal("modal-qr-scanner");
}

// ---- Generate QR Code (pakai qrcode.js) ----
async function generateQRCode(elementId, text) {
  if (!window.QRCode) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src =
        "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = "";
  new QRCode(el, {
    text,
    width: 140,
    height: 140,
    correctLevel: QRCode.CorrectLevel.M,
  });
}

function toggleRiwayatDetail(detailId, headerEl) {
  const detail = $(detailId);
  if (!detail) return;
  const isOpen = detail.style.display !== "none";
  detail.style.display = isOpen ? "none" : "block";

  // Cari chevron dari suffix yang sama: rwd-{siklus}-{id} → chv-{siklus}-{id}
  const chvId = detailId.replace(/^rwd-/, "chv-");
  const chv = $(chvId);
  if (chv) chv.style.transform = isOpen ? "" : "rotate(180deg)";
}

/* ================================================
   REWARD TRANSAKSI
   ================================================ */
let rewardItems = [];
let rewardMemberId = null;
let rewardId = null;
let rewardProdukSelected = null;

function bukaModalReward(
  rewardIdParam,
  memberIdParam,
  rataFormatted,
  totalFormatted,
) {
  rewardItems = [];
  rewardId = rewardIdParam;
  rewardMemberId = memberIdParam;
  rewardProdukSelected = null;

  // Isi info reward
  const infoEl = $("reward-modal-info");
  if (infoEl) {
    infoEl.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div style="flex:1;text-align:center">
          <div style="font-size:15px;font-weight:700;color:var(--amber)">Rp ${rataFormatted}</div>
          <div style="font-size:10px">Rata-rata/stamp</div>
        </div>
        <div style="flex:1;text-align:center">
          <div style="font-size:15px;font-weight:700;color:var(--blue)">Rp ${totalFormatted}</div>
          <div style="font-size:10px">Total 10 stamp</div>
        </div>
      </div>`;
  }

  // Reset form
  clearRewardProduk();
  renderRewardNota();

  // Tutup modal detail member dulu, buka modal reward
  closeModal("modal-detail-member");
  openModal("modal-tukar-reward");
}

function tutupModalReward() {
  closeModal("modal-tukar-reward");
  rewardItems = [];
  rewardId = null;
  rewardMemberId = null;
  clearRewardProduk();
}

// ---- Search bibit untuk reward ----
function filterRewardBibit(val) {
  const drop = $("reward-bibit-dropdown");
  if (!drop) return;
  if (!val || val.length < 1) {
    drop.classList.add("hide");
    return;
  }

  const filtered = allProduk.filter((p) =>
    p.nama.toLowerCase().includes(val.toLowerCase()),
  );
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
      return `<div class="sdrop-item" onclick="pilihRewardProduk(${p.id})">
      ${esc(p.nama)}
      <div class="sdrop-sub">Stok: ${sisa} ${esc(sat)}</div>
    </div>`;
    })
    .join("");
  drop.classList.remove("hide");
}

function pilihRewardProduk(id) {
  rewardProdukSelected = allProduk.find((p) => p.id == id);
  if (!rewardProdukSelected) return;

  $("reward-bibit-dropdown")?.classList.add("hide");
  $("reward-search").value = "";
  $("reward-selected-wrap").style.display = "block";
  $("reward-produk-nama").textContent = rewardProdukSelected.nama;

  // Isi satuan
  const satuanSel = $("reward-satuan");
  if (satuanSel) {
    const opts = [];
    opts.push({
      v:
        rewardProdukSelected.satuan_dasar ||
        rewardProdukSelected.satuan ||
        "ml",
      l:
        rewardProdukSelected.satuan_dasar ||
        rewardProdukSelected.satuan ||
        "ml",
      k: 1,
    });
    if (
      rewardProdukSelected.satuan !== rewardProdukSelected.satuan_dasar &&
      rewardProdukSelected.konversi > 1
    ) {
      opts.unshift({
        v: rewardProdukSelected.satuan,
        l: `${rewardProdukSelected.satuan} (=${rewardProdukSelected.konversi} ${rewardProdukSelected.satuan_dasar})`,
        k: rewardProdukSelected.konversi,
      });
    }
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
  const hint = $("reward-stok-hint");
  if (hint) {
    hint.textContent = `Stok tersedia: ${sisa} ${rewardProdukSelected.satuan_dasar || rewardProdukSelected.satuan || "ml"}`;
    hint.className = "stok-hint" + (sisa <= 5 ? " warn" : "");
  }

  $("reward-jumlah")?.focus();
}

function clearRewardProduk() {
  rewardProdukSelected = null;
  if ($("reward-search")) $("reward-search").value = "";
  if ($("reward-selected-wrap"))
    $("reward-selected-wrap").style.display = "none";
  if ($("reward-jumlah")) $("reward-jumlah").value = "";
  if ($("reward-bibit-dropdown"))
    $("reward-bibit-dropdown").classList.add("hide");
}

function hitungRewardSubtotal() {
  // Tidak ada harga, tapi bisa dipakai untuk validasi jumlah
}

function tambahRewardItem() {
  if (!rewardProdukSelected) return;
  const jumlah = parseFloat($("reward-jumlah").value) || 0;
  const satuanEl = $("reward-satuan");
  const satuan = satuanEl?.value || rewardProdukSelected.satuan_dasar || "ml";
  const konversi = parseFloat(
    satuanEl?.selectedOptions[0]?.dataset.konversi || 1,
  );

  if (jumlah <= 0) {
    toastWarn("Jumlah harus lebih dari 0");
    return;
  }

  const jumlah_stok = jumlah * konversi;
  const myStok = stokData.find(
    (s) =>
      s.bibit_id == rewardProdukSelected.id &&
      s.cabang_id == CURRENT_USER.cabang_id,
  );
  const sisa = myStok ? parseFloat(myStok.jumlah) : 0;

  const sudahDiReward = rewardItems
    .filter((i) => i.bibit_id == rewardProdukSelected.id)
    .reduce((s, i) => s + i.jumlah_stok, 0);

  if (jumlah_stok + sudahDiReward > sisa) {
    toastErr(
      `Stok tidak cukup. Tersedia: ${sisa} ${rewardProdukSelected.satuan_dasar || ""}`,
      "Stok Kurang",
    );
    return;
  }

  rewardItems.push({
    bibit_id: rewardProdukSelected.id,
    bibit_nama: rewardProdukSelected.nama,
    satuan_jual: satuan,
    jumlah_jual: jumlah,
    jumlah_stok,
    satuan_dasar:
      rewardProdukSelected.satuan_dasar || rewardProdukSelected.satuan || "ml",
  });

  renderRewardNota();
  clearRewardProduk();
}

function hapusRewardItem(idx) {
  rewardItems.splice(idx, 1);
  renderRewardNota();
}

function renderRewardNota() {
  const wrap = $("reward-nota-wrap");
  const btnSave = $("btn-berikan-reward");
  if (!wrap) return;

  if (!rewardItems.length) {
    wrap.style.display = "none";
    if (btnSave) btnSave.disabled = true;
    return;
  }

  wrap.style.display = "block";
  if (btnSave) btnSave.disabled = false;

  const cnt = $("reward-item-count");
  if (cnt) cnt.textContent = rewardItems.length + " item";

  $("reward-nota-items").innerHTML = rewardItems
    .map(
      (item, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:0.5px solid var(--border)">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:500">${esc(item.bibit_nama)}</div>
        <div style="font-size:11px;color:var(--text2)">
          ${item.jumlah_jual} ${esc(item.satuan_jual)}
          ${item.satuan_jual !== item.satuan_dasar ? " → " + item.jumlah_stok + " " + esc(item.satuan_dasar) : ""}
        </div>
      </div>
      <span style="font-size:12px;font-weight:600;color:var(--teal)">Gratis</span>
      <button onclick="hapusRewardItem(${i})"
        style="width:26px;height:26px;border-radius:50%;border:none;background:var(--red-l);color:var(--red);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center">×</button>
    </div>`,
    )
    .join("");
}

async function simpanReward() {
  if (!rewardItems.length) {
    toastWarn("Tambahkan item reward dulu");
    return;
  }
  if (!rewardId || !rewardMemberId) {
    toastErr("Data reward tidak valid");
    return;
  }

  try {
    const res = await api(`${BASE_URL}/api/transaksi.php`, "POST", {
      action: "reward",
      items: rewardItems,
      member_id: rewardMemberId,
      reward_id: rewardId,
    });

    if (res.success) {
      tutupModalReward();
      await loadKaryawanData();
      toastOk(
        `Reward berhasil diberikan — ${res.kode_nota}`,
        "Reward Diberikan!",
      );
      // Refresh tab member
      loadTabMember();
    } else {
      toastErr(res.message);
    }
  } catch (e) {
    toastErr(e.message);
  }
}

// Tutup dropdown reward jika klik di luar
document.addEventListener("click", (e) => {
  if (!e.target.closest("#reward-search-wrap")) {
    $("reward-bibit-dropdown")?.classList.add("hide");
  }
});

/* ================================================
   TAB MEMBER — ADMIN
   ================================================ */
let memberAdminPage = 1;
let memberAdminKeyword = "";
let memberAdminCabang = "all";
const MEMBER_ADMIN_PER_PAGE = 25;

async function buildMemberAdminTab(target) {
  const cabOpts =
    `<option value="all">Semua Cabang</option>` +
    cabangData
      .map((c) => `<option value="${c.id}">${esc(c.nama)}</option>`)
      .join("");

  target.innerHTML = `
    <!-- Statistik -->
    <div id="member-admin-stats" class="metrics-grid" style="margin-bottom:14px">
      <div class="loading">Memuat statistik...</div>
    </div>

    <!-- Toolbar -->
    <div class="card" style="padding:12px;margin-bottom:12px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select id="ma-filter-cabang" onchange="memberAdminCabang=this.value;memberAdminPage=1;loadMemberAdminPage(1)"
          style="min-width:160px">
          ${cabOpts}
        </select>
        <input type="text" id="ma-search"
          placeholder="Cari nama atau no HP..."
          style="flex:1;min-width:160px"
          oninput="debounceMemberAdminSearch()"/>
        <button class="btn btn-primary btn-sm" onclick="openTambahMemberAdmin()">
          + Tambah Member
        </button>
      </div>
    </div>

    <!-- Tabel -->
    <div class="card" style="padding:0;overflow:hidden">
      <div id="member-admin-table-wrap">
        <div class="loading">Memuat data member...</div>
      </div>
    </div>`;

  await loadMemberAdminStats();
  await loadMemberAdminPage(1);
}

async function loadMemberAdminStats() {
  const el = document.getElementById("member-admin-stats");
  if (!el) return;
  try {
    const data = await api(`${BASE_URL}/api/member_admin.php?action=stats`);
    el.innerHTML = `
      <div class="metric-card">
        <div class="metric-label">Total Member</div>
        <div class="metric-val">${data.total_member || 0}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Member Aktif</div>
        <div class="metric-val" style="color:var(--teal)">${data.total_aktif || 0}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Reward Pending</div>
        <div class="metric-val" style="color:${(data.total_reward_pending || 0) > 0 ? "var(--amber)" : "var(--teal)"}">
          ${data.total_reward_pending || 0}
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total Stamp Terkumpul</div>
        <div class="metric-val">${(data.total_stamp_all || 0).toLocaleString("id-ID")}</div>
      </div>`;
  } catch (e) {
    el.innerHTML = "";
  }
}

let memberAdminSearchTimer = null;
function debounceMemberAdminSearch() {
  clearTimeout(memberAdminSearchTimer);
  memberAdminSearchTimer = setTimeout(() => {
    memberAdminKeyword = document.getElementById("ma-search")?.value || "";
    memberAdminPage = 1;
    loadMemberAdminPage(1);
  }, 400);
}

async function loadMemberAdminPage(page) {
  memberAdminPage = page;
  const wrap = document.getElementById("member-admin-table-wrap");
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading">Memuat...</div>';

  try {
    const url =
      `${BASE_URL}/api/member_admin.php?action=list` +
      `&page=${page}&per_page=${MEMBER_ADMIN_PER_PAGE}` +
      `&cabang_id=${memberAdminCabang}` +
      `&keyword=${encodeURIComponent(memberAdminKeyword)}`;
    const data = await api(url);
    const members = data.members || [];

    if (!members.length) {
      wrap.innerHTML = '<div class="empty">Tidak ada member ditemukan</div>';
      return;
    }

    const rows = members
      .map((m) => {
        const stampMod = parseInt(m.stamp_available || 0) % 10;
        const pct = (stampMod / 10) * 100;
        const rewardPending = parseInt(m.reward_pending || 0);

        return `<tr>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:34px;height:34px;border-radius:50%;background:var(--teal-l);
              display:flex;align-items:center;justify-content:center;
              font-size:14px;font-weight:700;color:var(--teal);flex-shrink:0">
              ${esc(m.nama.charAt(0).toUpperCase())}
            </div>
            <div>
              <div style="font-size:13px;font-weight:500">${esc(m.nama)}</div>
              <div style="font-size:11px;color:var(--text2)">${esc(m.no_hp)}</div>
            </div>
          </div>
        </td>
        <td style="color:var(--text2)">${esc(m.cabang_asal_nama || "-")}</td>
        <td style="text-align:center">
          <div style="font-size:14px;font-weight:700;color:var(--amber)">${m.total_stamp}</div>
          <div style="height:4px;background:var(--bg2);border-radius:99px;width:60px;margin:4px auto 0">
            <div style="height:100%;background:var(--amber);border-radius:99px;width:${pct}%"></div>
          </div>
          <div style="font-size:10px;color:var(--text2);margin-top:2px">${stampMod}/10</div>
        </td>
        <td style="text-align:center">
          ${
            rewardPending > 0
              ? `<span class="badge" style="background:var(--amber-m);color:#7a4f00">
                🎁 ${rewardPending} pending
               </span>`
              : `<span style="font-size:12px;color:var(--text2)">—</span>`
          }
        </td>
        <td style="color:var(--text2);font-size:12px">
          ${new Date(m.created_at).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-teal"
              onclick="openDetailMemberAdmin(${m.id})">Detail</button>
            <button class="btn btn-sm"
              onclick="openEditMemberAdmin(${m.id},'${esc(m.nama)}','${esc(m.no_hp)}')">Edit</button>
            <button class="btn btn-sm btn-danger"
              onclick="hapusMemberAdmin(${m.id},'${esc(m.nama)}')">Hapus</button>
          </div>
        </td>
      </tr>`;
      })
      .join("");

    wrap.innerHTML = `
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Cabang Asal</th>
              <th style="text-align:center">Stamp</th>
              <th style="text-align:center">Reward</th>
              <th>Terdaftar</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${buildPaginationHTML(data.pagination, "loadMemberAdminPage")}`;
  } catch (e) {
    wrap.innerHTML =
      '<div class="alert alert-danger">Gagal memuat data member</div>';
  }
}

// ---- Detail Member ----
async function openDetailMemberAdmin(id) {
  openModal("modal-admin-member-detail");
  const body = document.getElementById("amd-body");
  body.innerHTML = '<div class="loading">Memuat...</div>';

  try {
    const data = await api(
      `${BASE_URL}/api/member_admin.php?action=detail&id=${id}`,
    );
    const m = data.member;
    const rewards = data.rewards || [];
    const riwayat = data.riwayat || [];

    document.getElementById("amd-title").textContent = `Detail — ${m.nama}`;

    const stampMod = parseInt(m.stamp_available || 0) % 10;
    const pct = (stampMod / 10) * 100;
    const sisaStamp = 10 - stampMod;
    const rewardPending = rewards.filter((r) => r.status === "pending").length;

    // ---- HERO ----
    const heroHTML = `
      <div style="background:linear-gradient(135deg,#3D52A0 0%,#5a6fc0 100%);
        border-radius:12px;padding:16px;color:#fff;margin-bottom:12px;position:relative;overflow:hidden">
        <div style="position:absolute;right:-15px;top:-15px;width:80px;height:80px;
          border-radius:50%;background:rgba(255,255,255,0.07)"></div>
        <div style="font-size:12px;opacity:.8;margin-bottom:2px">Member</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:12px">${esc(m.nama)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <div style="text-align:center;background:rgba(255,255,255,0.12);border-radius:8px;padding:8px 4px">
            <div style="font-size:20px;font-weight:700">${m.total_stamp}</div>
            <div style="font-size:10px;opacity:.75">Total Stamp</div>
          </div>
          <div style="text-align:center;background:rgba(255,255,255,0.12);border-radius:8px;padding:8px 4px">
            <div style="font-size:20px;font-weight:700">${stampMod}/10</div>
            <div style="font-size:10px;opacity:.75">Progress</div>
          </div>
          <div style="text-align:center;background:rgba(255,255,255,0.12);border-radius:8px;padding:8px 4px">
            <div style="font-size:20px;font-weight:700;color:${rewardPending > 0 ? "#fde9ba" : "#fff"}">${rewardPending}</div>
            <div style="font-size:10px;opacity:.75">Reward 🎁</div>
          </div>
        </div>
      </div>`;

    // ---- STAMP PROGRESS ----
    let stampBoxes = "";
    for (let i = 1; i <= 10; i++) {
      const filled = i <= stampMod;
      stampBoxes += `
        <div style="aspect-ratio:1;border-radius:8px;
          border:1.5px solid ${filled ? "var(--amber)" : "var(--border)"};
          background:${filled ? "var(--amber-m)" : "var(--bg)"};
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px">
          ${
            filled
              ? `<span style="font-size:16px">🎫</span>`
              : `<span style="font-size:14px;opacity:.2">○</span>`
          }
          <span style="font-size:9px;opacity:.5">${i}</span>
        </div>`;
    }

    const msg =
      stampMod === 0
        ? "Kumpulkan 10 stamp untuk dapat reward!"
        : sisaStamp === 1
          ? "<strong>1 stamp lagi</strong> untuk dapat reward! 🎉"
          : `<strong>${sisaStamp} stamp lagi</strong> menuju reward berikutnya`;

    const stampHTML = `
      <div style="background:var(--card);border:0.5px solid var(--border);
        border-radius:12px;padding:14px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span style="font-size:13px;font-weight:600">Progress Stamp</span>
          <span style="font-size:13px;font-weight:700;color:var(--amber)">${stampMod}/10</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin-bottom:10px">
          ${stampBoxes}
        </div>
        <div style="font-size:12px;color:var(--text2);text-align:center;
          padding:7px;background:var(--bg2);border-radius:7px">${msg}</div>
      </div>`;

    // ---- INFO MEMBER ----
    const infoHTML = `
      <div style="background:var(--card);border:0.5px solid var(--border);
        border-radius:12px;overflow:hidden;margin-bottom:12px">
        <div style="padding:10px 14px;background:var(--bg2);border-bottom:0.5px solid var(--border)">
          <span style="font-size:11px;font-weight:600;color:var(--text2);
            text-transform:uppercase;letter-spacing:.4px">Info Akun</span>
        </div>
        ${[
          ["Nama", m.nama],
          ["No HP", m.no_hp],
          ["Cabang Asal", m.cabang_asal_nama || "-"],
          [
            "Terdaftar",
            new Date(m.created_at).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
          ],
          ["Status", m.aktif ? "✅ Aktif" : "❌ Nonaktif"],
        ]
          .map(
            ([label, val], i) => `
          <div style="display:flex;justify-content:space-between;align-items:center;
            padding:9px 14px;${i > 0 ? "border-top:0.5px solid var(--border)" : ""};
            font-size:13px;gap:10px">
            <span style="color:var(--text2);flex-shrink:0">${label}</span>
            <span style="font-weight:500;text-align:right">${esc(String(val))}</span>
          </div>`,
          )
          .join("")}
      </div>`;

    // ---- REWARD ----
    const rewardHTML = (() => {
      if (!rewards.length)
        return `
        <div style="background:var(--card);border:0.5px solid var(--border);
          border-radius:12px;padding:14px;margin-bottom:12px">
          <div style="font-size:11px;font-weight:600;color:var(--text2);
            text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">Reward</div>
          <div style="font-size:12px;color:var(--text2);text-align:center;padding:12px 0">
            Belum ada reward
          </div>
        </div>`;

      const items = rewards
        .map((r, idx) => {
          const nomorReward = rewards.length - idx;
          const statusBadge =
            r.status === "pending"
              ? `<span style="font-size:11px;background:var(--amber-m);color:#7a4f00;
              padding:2px 8px;border-radius:99px;font-weight:600">🎁 Pending</span>`
              : r.status === "redeemed"
                ? `<span style="font-size:11px;background:var(--teal-l);color:var(--teal);
              padding:2px 8px;border-radius:99px;font-weight:600">✓ Ditukar</span>`
                : `<span style="font-size:11px;background:var(--bg2);color:var(--text2);
              padding:2px 8px;border-radius:99px;font-weight:600">Dibatalkan</span>`;

          const tgl = new Date(r.created_at).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });

          return `
          <div style="border:0.5px solid var(--border);border-radius:10px;
            padding:12px;margin-bottom:8px">
            <div style="display:flex;align-items:center;justify-content:space-between;
              margin-bottom:8px;gap:8px">
              <div>
                <div style="font-size:13px;font-weight:600">Reward ke-${nomorReward}</div>
                <div style="font-size:11px;color:var(--text2)">${tgl}</div>
              </div>
              ${statusBadge}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div style="text-align:center;padding:8px;background:var(--bg2);border-radius:8px">
                <div style="font-size:13px;font-weight:700;color:var(--blue)">
                  Rp ${parseFloat(r.rata_nominal || 0).toLocaleString("id-ID")}
                </div>
                <div style="font-size:10px;color:var(--text2);margin-top:1px">Rata-rata/stamp</div>
              </div>
              <div style="text-align:center;padding:8px;background:var(--bg2);border-radius:8px">
                <div style="font-size:13px;font-weight:700;color:var(--blue)">
                  Rp ${parseFloat(r.total_nominal || 0).toLocaleString("id-ID")}
                </div>
                <div style="font-size:10px;color:var(--text2);margin-top:1px">Total 10 stamp</div>
              </div>
            </div>
            ${
              r.status === "redeemed" && r.bibit_nama
                ? `<div style="margin-top:8px;padding:7px 10px;background:var(--teal-l);
                  border-radius:7px;font-size:12px;color:var(--teal)">
                  ✓ Ditukar: <strong>${esc(r.bibit_nama)}</strong>
                  ${r.redeemed_by_nama ? " · " + esc(r.redeemed_by_nama) : ""}
                </div>`
                : ""
            }
            ${
              r.status === "pending"
                ? `<div style="margin-top:8px;padding:7px 10px;background:var(--amber-m);
                  border-radius:7px;font-size:12px;color:#7a4f00;text-align:center">
                  🎁 Menunggu penukaran oleh member
                </div>`
                : ""
            }
          </div>`;
        })
        .join("");

      return `
        <div style="background:var(--card);border:0.5px solid var(--border);
          border-radius:12px;padding:14px;margin-bottom:12px">
          <div style="font-size:11px;font-weight:600;color:var(--text2);
            text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">
            Reward (${rewards.length})
          </div>
          ${items}
        </div>`;
    })();

    // ---- RIWAYAT TRANSAKSI — per siklus card ----
    const riwayatHTML = (() => {
      if (!riwayat.length)
        return `
        <div style="background:var(--card);border:0.5px solid var(--border);
          border-radius:12px;padding:14px;margin-bottom:12px">
          <div style="font-size:11px;font-weight:600;color:var(--text2);
            text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">
            Riwayat Transaksi
          </div>
          <div style="font-size:12px;color:var(--text2);text-align:center;padding:12px 0">
            Belum ada transaksi
          </div>
        </div>`;

      // Kelompokkan per siklus (sama persis dengan portal customer)
      const siklus = {};
      riwayat.forEach((t) => {
        const stampMin = parseInt(t.stamp_ke_min || 0);
        const stampMax = parseInt(t.stamp_ke_max || 0);

        if (stampMin === 0 && stampMax === 0) {
          if (!siklus["0"]) siklus["0"] = { trxs: [] };
          siklus["0"].trxs.push(t);
          return;
        }

        // Transaksi bisa melintasi 2 siklus, masukkan ke semua siklus yang dilintasi
        const siklusMin = Math.ceil(stampMin / 10);
        const siklusMax = Math.ceil(stampMax / 10);

        for (let n = siklusMin; n <= siklusMax; n++) {
          if (!siklus[n]) {
            siklus[n] = {
              nomor: n,
              stamp_dari: (n - 1) * 10 + 1,
              stamp_ke: n * 10,
              trxs: [],
            };
          }
          // Hindari duplikat transaksi yang sama
          if (!siklus[n].trxs.find((x) => x.id === t.id)) {
            siklus[n].trxs.push(t);
          }
        }
      });

      const sortedSiklus = Object.values(siklus)
        .filter((s) => s.nomor)
        .sort((a, b) => b.nomor - a.nomor);

      const rewardTrxs =
        siklus["0"]?.trxs.filter((t) => t.kode_nota.startsWith("REWARD-")) ||
        [];

      const cards = sortedSiklus
        .map((s) => {
          const reward = rewards.find(
            (r) => parseInt(r.stamp_snapshot) === s.stamp_ke,
          );

          const allStampKe = [];
          s.trxs.forEach((t) => {
            const min = parseInt(t.stamp_ke_min || 0);
            const max = parseInt(t.stamp_ke_max || 0);
            for (let i = min; i <= max; i++) allStampKe.push(i);
          });
          const stampDiSiklus = [...new Set(allStampKe)].filter(
            (k) => k >= s.stamp_dari && k <= s.stamp_ke,
          ).length;
          const isComplete = stampDiSiklus >= 10;

          // Header style
          let headerBg, headerColor, statusLabel;
          if (reward?.status === "redeemed") {
            headerBg = "var(--teal-l)";
            headerColor = "var(--teal)";
            statusLabel = `<span style="font-size:11px;background:var(--teal-l);color:var(--teal);
            padding:2px 8px;border-radius:99px;font-weight:600;border:0.5px solid #9fe1cb">✓ Reward Ditukar</span>`;
          } else if (reward?.status === "pending") {
            headerBg = "#fffbe6";
            headerColor = "#7a4f00";
            statusLabel = `<span style="font-size:11px;background:var(--amber-m);color:#7a4f00;
            padding:2px 8px;border-radius:99px;font-weight:600">🎁 Reward Tersedia</span>`;
          } else if (isComplete) {
            headerBg = "var(--blue-l)";
            headerColor = "var(--blue)";
            statusLabel = `<span style="font-size:11px;background:var(--blue-l);color:var(--blue);
            padding:2px 8px;border-radius:99px;font-weight:600">✓ Lengkap</span>`;
          } else {
            headerBg = "var(--bg2)";
            headerColor = "var(--text)";
            statusLabel = `<span style="font-size:11px;background:var(--bg2);color:var(--text2);
            padding:2px 8px;border-radius:99px;font-weight:600;
            border:0.5px solid var(--border)">${stampDiSiklus}/10 stamp</span>`;
          }

          // Mini grid
          let miniGrid = "";
          for (let i = 1; i <= 10; i++) {
            const globalKe = s.stamp_dari + i - 1;
            const filled = allStampKe.includes(globalKe);
            miniGrid += `<div style="width:100%;aspect-ratio:1;border-radius:5px;
            background:${filled ? "var(--amber)" : "var(--bg)"};
            border:1px solid ${filled ? "var(--amber)" : "var(--border)"};
            display:flex;align-items:center;justify-content:center;font-size:9px">
            ${filled ? "🎫" : ""}
          </div>`;
          }

          // Reward info di dalam card
          const rewardInfo = reward
            ? reward.status === "pending"
              ? `<div style="margin-top:8px;padding:8px 10px;background:var(--amber-m);
                border-radius:7px;font-size:12px;color:#7a4f00;text-align:center">
                🎁 Reward menunggu penukaran oleh member
              </div>`
              : reward.status === "redeemed"
                ? `<div style="margin-top:8px;padding:8px 10px;background:var(--teal-l);
                border-radius:7px;font-size:12px;color:var(--teal)">
                ✓ Ditukar: <strong>${esc(reward.bibit_nama || "-")}</strong>
                ${reward.redeemed_by_nama ? " · " + esc(reward.redeemed_by_nama) : ""}
              </div>`
                : ""
            : "";

          // List transaksi
          const trxRows = s.trxs
            .map((t) => {
              const tgl = new Date(t.created_at).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const jam = t.created_at.split(" ")[1]?.substring(0, 5) || "";
              const isReward = t.kode_nota.startsWith("REWARD-");
              const stampCount = parseInt(t.stamp_didapat || 0);

              // Hitung nominal hanya untuk stamp yang masuk ke siklus ini
              const nominalSiklus = (() => {
                let total = 0;
                const itemsPerReward = t.items_per_reward || {};
                Object.values(itemsPerReward).forEach((groupItems) => {
                  groupItems.forEach((item) => {
                    const stampKe = parseInt(item.stamp_ke || 0);
                    if (stampKe >= s.stamp_dari && stampKe <= s.stamp_ke) {
                      total += parseFloat(item.subtotal || 0);
                    }
                  });
                });
                return total;
              })();

              const detailRows = (t.items || [])
                .map(
                  (item) => `
    <div style="display:flex;justify-content:space-between;align-items:center;
      font-size:11px;padding:5px 0;border-bottom:0.5px solid var(--border);gap:8px">
      <div style="flex:1;min-width:0">
        <span>${esc(item.bibit_nama)}</span>
        ${
          item.stamp_counted
            ? `<span style="font-size:9px;background:var(--amber-m);color:#7a4f00;
              padding:1px 5px;border-radius:99px;margin-left:3px">🎫</span>`
            : ""
        }
        <div style="font-size:10px;color:var(--text2);margin-top:1px">
          ${parseFloat(item.jumlah_jual)} ${esc(item.satuan_jual)}
          ${!isReward ? "× Rp " + parseFloat(item.harga_satuan).toLocaleString("id-ID") : "· Gratis"}
        </div>
      </div>
      <div style="font-weight:600;white-space:nowrap;
        color:${isReward ? "var(--teal)" : "var(--text2)"}">
        ${isReward ? "🎁 Gratis" : "Rp " + parseFloat(item.subtotal).toLocaleString("id-ID")}
      </div>
    </div>`,
                )
                .join("");

              return `
    <div style="border:0.5px solid var(--border);border-radius:7px;
      margin-bottom:5px;overflow:hidden">
      <!-- Header transaksi (bisa diklik) -->
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:7px 10px;background:var(--bg2);cursor:pointer;gap:8px"
        onclick="toggleTrxDetailAdmin('amd-td-${s.nomor}-${t.id}', this)">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600">${esc(t.kode_nota)}</div>
          <div style="font-size:10px;color:var(--text2)">${tgl} · ${jam} · ${esc(t.cabang_nama)}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:12px;font-weight:700;
            color:${isReward ? "var(--amber)" : "var(--teal)"}">
            ${isReward ? "🎁 Reward" : "Rp " + nominalSiklus.toLocaleString("id-ID")}
          </div>
          ${
            stampCount > 0
              ? `<div style="font-size:10px;color:var(--amber)">+${stampCount} 🎫</div>`
              : ""
          }
        </div>
        <svg id="amd-chv-${s.nomor}-${t.id}"
          style="width:13px;height:13px;flex-shrink:0;transition:transform .2s;color:var(--text2)"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </div>
      <!-- Detail item (collapsible) -->
      <div id="amd-td-${s.nomor}-${t.id}" style="display:none;padding:8px 10px">
        ${detailRows || '<div style="font-size:11px;color:var(--text2)">Tidak ada detail</div>'}
      </div>
    </div>`;
            })
            .join("");

          return `
          <div style="background:var(--card);border:0.5px solid var(--border);
            border-radius:12px;margin-bottom:10px;overflow:hidden">
            <div style="padding:10px 12px;background:${headerBg};
              border-bottom:0.5px solid var(--border)">
              <div style="display:flex;align-items:center;justify-content:space-between;
                margin-bottom:8px;gap:8px">
                <div style="font-size:13px;font-weight:700;color:${headerColor}">
                  Siklus ${s.nomor}
                  <span style="font-size:11px;font-weight:400;color:var(--text2);margin-left:3px">
                    (stamp ${s.stamp_dari}–${s.stamp_ke})
                  </span>
                </div>
                ${statusLabel}
              </div>
              <div style="display:grid;grid-template-columns:repeat(10,1fr);gap:3px">
                ${miniGrid}
              </div>
              ${rewardInfo}
            </div>
            <div style="padding:10px 12px">
              <div style="font-size:11px;font-weight:600;color:var(--text2);
                text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">
                ${s.trxs.length} Transaksi
              </div>
              ${trxRows}
            </div>
          </div>`;
        })
        .join("");

      // Card reward transaksi
      const rewardTrxCard = rewardTrxs.length
        ? `<div style="background:var(--card);border:0.5px solid var(--border);
            border-radius:12px;margin-bottom:10px;overflow:hidden">
            <div style="padding:10px 12px;background:var(--teal-l);
              border-bottom:0.5px solid var(--border);display:flex;align-items:center;gap:8px">
              <span style="font-size:14px">🎁</span>
              <span style="font-size:13px;font-weight:600;color:var(--teal)">
                Riwayat Penukaran Reward
              </span>
            </div>
            <div style="padding:10px 12px">
              ${rewardTrxs
                .map((t) => {
                  const tgl = new Date(t.created_at).toLocaleDateString(
                    "id-ID",
                    { day: "numeric", month: "short", year: "numeric" },
                  );
                  return `
                  <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:7px 0;border-bottom:0.5px solid var(--border);
                    font-size:12px;gap:8px">
                    <div>
                      <div style="font-weight:600">${esc(t.kode_nota)}</div>
                      <div style="font-size:11px;color:var(--text2)">${tgl} · ${esc(t.cabang_nama)}</div>
                    </div>
                    <div style="font-weight:700;color:var(--amber)">🎁 Reward</div>
                  </div>`;
                })
                .join("")}
            </div>
          </div>`
        : "";

      return `
        <div style="font-size:11px;font-weight:600;color:var(--text2);
          text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">
          Riwayat Transaksi
        </div>
        ${cards}
        ${rewardTrxCard}`;
    })();

    body.innerHTML = heroHTML + stampHTML + infoHTML + rewardHTML + riwayatHTML;
  } catch (e) {
    document.getElementById("amd-body").innerHTML =
      '<div class="alert alert-danger">Gagal memuat detail member</div>';
  }
}

function toggleTrxDetailAdmin(id, headerEl) {
  const body = document.getElementById(id);
  if (!body) return;
  const isOpen = body.style.display === "block";
  body.style.display = isOpen ? "none" : "block";

  const chvId = id.replace(/^amd-td-/, "amd-chv-");
  const chv = document.getElementById(chvId);
  if (chv) chv.style.transform = isOpen ? "" : "rotate(180deg)";
}

// ---- Edit Member ----
function openEditMemberAdmin(id, nama, noHp) {
  document.getElementById("ame-id").value = id;
  document.getElementById("ame-nama").value = nama;
  document.getElementById("ame-hp").value = noHp;
  document.getElementById("ame-err").textContent = "";
  openModal("modal-admin-member-edit");
}

async function simpanEditMemberAdmin() {
  const id = document.getElementById("ame-id").value;
  const nama = document.getElementById("ame-nama").value.trim();
  const hp = document.getElementById("ame-hp").value.trim();
  const err = document.getElementById("ame-err");

  if (!nama) {
    err.textContent = "Nama wajib diisi";
    return;
  }
  if (!hp) {
    err.textContent = "No HP wajib diisi";
    return;
  }

  try {
    const res = await api(`${BASE_URL}/api/member_admin.php`, "PUT", {
      id,
      nama,
      no_hp: hp,
    });
    if (res.success) {
      closeModal("modal-admin-member-edit");
      toastOk("Data member berhasil diperbarui");
      loadMemberAdminPage(memberAdminPage);
      loadMemberAdminStats();
    } else {
      err.textContent = res.message || "Gagal menyimpan";
    }
  } catch (e) {
    err.textContent = e.message;
  }
}

// ---- Hapus Member ----
async function hapusMemberAdmin(id, nama) {
  if (
    !confirm(
      `Hapus member "${nama}"?\n\nSeluruh data stamp dan reward member ini akan ikut terhapus.`,
    )
  )
    return;
  try {
    const res = await api(`${BASE_URL}/api/member_admin.php`, "DELETE", { id });
    if (res.success) {
      toastOk(`Member ${nama} berhasil dihapus`);
      loadMemberAdminPage(memberAdminPage);
      loadMemberAdminStats();
    } else {
      toastErr(res.message || "Gagal menghapus");
    }
  } catch (e) {
    toastErr(e.message);
  }
}

// ---- Tambah Member (dari admin) ----
function openTambahMemberAdmin() {
  // Reuse modal daftar member yang sudah ada di karyawan,
  // tapi isi cabang_id dari pilihan filter aktif
  document.getElementById("dm-admin-cabang").innerHTML = cabangData
    .map((c) => `<option value="${c.id}">${esc(c.nama)}</option>`)
    .join("");
  document.getElementById("dm-admin-nama").value = "";
  document.getElementById("dm-admin-hp").value = "";
  document.getElementById("dm-admin-catatan").value = "";
  document.getElementById("dm-admin-err").textContent = "";

  // Kalau ada pilihan cabang aktif, simpan untuk dikirim
  window._adminTambahMemberCabangId =
    memberAdminCabang !== "all" ? memberAdminCabang : cabangData[0]?.id || null;

  openModal("modal-admin-daftar-member");
}

async function simpanTambahMemberAdmin() {
  const nama = document.getElementById("dm-admin-nama").value.trim();
  const no_hp = document.getElementById("dm-admin-hp").value.trim();
  const catatan = document.getElementById("dm-admin-catatan").value.trim();
  const cabang_id = document.getElementById("dm-admin-cabang").value;
  const errEl = document.getElementById("dm-admin-err");

  if (!nama) {
    errEl.textContent = "Nama wajib diisi";
    return;
  }
  if (!no_hp) {
    errEl.textContent = "No HP wajib diisi";
    return;
  }
  if (!cabang_id) {
    errEl.textContent = "Pilih cabang asal";
    return;
  }

  try {
    const res = await api(`${BASE_URL}/api/member_admin.php`, "POST", {
      action: "tambah",
      nama,
      no_hp,
      catatan,
      cabang_id: parseInt(cabang_id),
    });
    if (res.success) {
      closeModal("modal-admin-daftar-member");
      toastOk(`Member ${nama} berhasil didaftarkan`);
      loadMemberAdminPage(1);
      loadMemberAdminStats();
    } else {
      errEl.textContent = res.message || "Gagal mendaftarkan";
    }
  } catch (e) {
    errEl.textContent = e.message;
  }
}
//thank you//
