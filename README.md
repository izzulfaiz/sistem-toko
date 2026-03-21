# 🌸 Mekar Wangi System
### Sistem Manajemen Stok Parfum Multi-Cabang

![PHP](https://img.shields.io/badge/PHP-8.0+-777BB4?style=flat&logo=php&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-5.7+-4479A1?style=flat&logo=mysql&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat&logo=javascript&logoColor=black)
![jsPDF](https://img.shields.io/badge/jsPDF-2.5+-red?style=flat)
![Chart.js](https://img.shields.io/badge/Chart.js-4.4.1-FF6384?style=flat&logo=chart.js&logoColor=white)

> Aplikasi web full-stack untuk mengelola stok, transaksi penjualan, pengeluaran operasional, dan laporan keuangan harian di beberapa cabang toko parfum secara real-time.

---

## 🎯 Latar Belakang

Sistem ini dibangun untuk menjawab kebutuhan nyata bisnis parfum dan laundry yang memiliki beberapa cabang — di mana pemilik perlu memantau stok, penjualan, dan pengeluaran di setiap cabang tanpa harus datang langsung. Sistem memisahkan akses **Admin** (pemilik/pusat) dan **Karyawan** (per cabang) agar data tetap terkontrol dan tidak bisa dimanipulasi.

---

## ✨ Fitur

### 👨‍💼 Admin
| Fitur | Deskripsi |
|---|---|
| 📦 Monitor Stok | Pantau stok semua cabang secara real-time dengan filter, search, dan pagination |
| 🔔 Notifikasi Kritis | Alert otomatis saat stok mendekati batas minimum dengan badge lonceng |
| 📋 Log Aktivitas | Riwayat lengkap semua perubahan stok dengan search keyword dan pagination |
| 📄 Laporan PDF Harian | Export laporan stok + aktivitas per tanggal per cabang |
| 📊 Rekap Bulanan | Grafik omzet harian, laba bersih, omzet per cabang, produk terlaris |
| 👥 Kelola User | CRUD akun karyawan dengan role dan assignment cabang |
| 🏪 Produk & Distribusi | Kelola produk dengan satuan fleksibel, distribusi stok antar cabang |

### 👷 Karyawan
| Fitur | Deskripsi |
|---|---|
| 🛒 Transaksi Masuk | Kasir penjualan dengan nota multi-item, searchable dropdown, konversi satuan otomatis |
| 💸 Transaksi Keluar | Catat pengeluaran operasional harian (tidak mempengaruhi stok) |
| 📜 Riwayat Gabungan | Transaksi masuk + keluar dalam satu tampilan dengan ringkasan laba bersih harian |
| ↩️ Batalkan Nota | Pembatalan transaksi hari yang sama — stok otomatis dikembalikan |
| 🔍 Cek Stok | Lihat stok cabang sendiri dengan search dan pagination |
| 📊 Rekap Bulanan | Ringkasan omzet, pengeluaran, dan laba bersih cabang sendiri + export PDF |
| 🖨️ Export PDF Harian | Laporan harian gabungan masuk + keluar + ringkasan laba bersih |

### 🔐 Keamanan
| Fitur | Deskripsi |
|---|---|
| 🔒 Limit Login | Akun dikunci 15 menit setelah 5x salah password + countdown timer |
| ⏱️ Session Timeout | Auto logout setelah 1 jam tidak aktif |
| 🛡️ Role-based Access | Admin dan karyawan punya akses berbeda dan terisolasi per cabang |
| 💉 Anti SQL Injection | Semua query menggunakan PDO prepared statements |

---

## 🛠️ Tech Stack

```
Backend   : PHP 8.0+ (Native, tanpa framework) + PDO MySQL
Database  : MySQL dengan indexing untuk performa
Frontend  : Vanilla JavaScript ES6+ (tanpa framework)
PDF       : jsPDF + jsPDF-AutoTable
Chart     : Chart.js 4.4.1
Styling   : CSS3 Custom Properties (tanpa framework CSS)
Auth      : PHP Session-based + login attempt limiting
```

> **Kenapa tanpa framework?**
> Proyek ini sengaja dibangun tanpa framework (tidak pakai Laravel, React, dll) untuk menunjukkan pemahaman fundamental web development — mulai dari routing manual, query PDO, DOM manipulation, hingga session management.

---

## 📁 Struktur Proyek

```
parfum-stock/
├── api/                      # REST API endpoints
│   ├── log.php               # Log aktivitas stok
│   ├── notifikasi.php        # Notifikasi stok kritis
│   ├── pengeluaran.php       # Transaksi keluar
│   ├── rekap.php             # Rekap bulanan + grafik laba
│   ├── stok.php              # CRUD stok + pagination
│   ├── transaksi.php         # Transaksi penjualan
│   └── users.php             # Manajemen user & produk
├── assets/
│   ├── app.js                # ~3000+ baris JS (semua logic frontend)
│   ├── logo.png              # Logo Mekar Wangi
│   └── style.css             # ~1000+ baris CSS custom
├── config/
│   ├── app.php               # Konfigurasi terpusat (threshold stok, nama toko)
│   └── database.php          # Koneksi DB (tidak di-repo)
├── includes/
│   ├── auth.php              # Session, role check, login limit, timeout
│   └── functions.php         # Query functions + pagination helpers
├── admin.php                 # Dashboard admin (SPA-like)
├── index.php                 # Halaman login + countdown timer
├── karyawan.php              # Dashboard karyawan (SPA-like)
├── logout.php
├── database_full.sql         # Schema + semua migration (1 file)
└── reset_transaksi.sql       # Reset data transaksi saja (untuk deploy)
```

---

## ⚙️ Instalasi

### Prasyarat
- XAMPP (PHP 8.0+, MySQL 5.7+)
- Browser modern

### Langkah

**1. Clone repository**
```bash
git clone https://github.com/izzulfaiz/parfum-stock.git
cd parfum-stock
```

**2. Setup database**

Buka phpMyAdmin → buat database `parfum_stock` → import:
```
database_full.sql  (1 file sudah berisi semua)
```

**3. Buat file konfigurasi database**

Buat file `config/database.php`:
```php
<?php
date_default_timezone_set('Asia/Jakarta');

function getDB(): PDO {
    $pdo = new PDO(
        "mysql:host=localhost;dbname=parfum_stock;charset=utf8mb4",
        "root", ""
    );
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    return $pdo;
}
```

**4. Jalankan**
```
http://localhost/parfum-stock/
```

---

## 🔧 Konfigurasi

Semua konfigurasi utama ada di **`config/app.php`** — cukup edit 1 file:

```php
return [
    'toko_nama'          => 'Mekar Wangi System',
    'stok_warning'       => 70,   // batas kuning (ml/gram/liter)
    'stok_critical'      => 40,   // batas merah (ml/gram/liter)
    'stok_warning_pcs'   => 5,    // batas kuning (pcs/botol)
    'stok_critical_pcs'  => 2,    // batas merah (pcs/botol)
];
```

Untuk durasi session dan limit login, edit di **`includes/auth.php`**:
```php
define('SESSION_TIMEOUT',   3600); // timeout dalam detik (1 jam)
define('LOGIN_MAX_ATTEMPT', 5);    // maks percobaan login
define('LOGIN_LOCKOUT_MIN', 15);   // lama kunci dalam menit
```

---

## 🗃️ Database Schema

| Tabel | Fungsi |
|---|---|
| `cabang` | Data cabang toko |
| `bibit` | Data produk (parfum, laundry, aksesoris) |
| `stok` | Jumlah stok per produk per cabang |
| `users` | Akun admin & karyawan |
| `transaksi` | Header nota penjualan |
| `transaksi_detail` | Detail item per nota |
| `pengeluaran` | Pengeluaran operasional per cabang |
| `log_aktivitas` | Riwayat semua perubahan stok |
| `notifikasi` | Notifikasi stok kritis in-app |
| `login_attempts` | Riwayat percobaan login (untuk limit) |

---

## 📈 Pengembangan Selanjutnya

- [ ] Deploy ke hosting + HTTPS
- [ ] Notifikasi WhatsApp via API
- [ ] Admin bisa batalkan transaksi lama
- [ ] Sorting produk terlaris (by frekuensi vs omzet)

---

## 👨‍💻 Developer

**Izzul Faiz**
GitHub: [@izzulfaiz](https://github.com/izzulfaiz)

---

*Dibangun dari nol sebagai solusi nyata untuk bisnis Mekar Wangi* 🌸
