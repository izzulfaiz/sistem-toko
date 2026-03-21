<?php
// =====================================================
// index.php — Halaman Login
// =====================================================

require_once __DIR__ . '/includes/auth.php';

// Jika sudah login, redirect sesuai role
if (isLoggedIn()) {
    header('Location: ' . (isAdmin() ? 'admin.php' : 'karyawan.php'));
    exit;
}

// Saat halaman dimuat (GET), bersihkan attempts yang sudah expired
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $username_get = $_GET['u'] ?? '';
    if ($username_get) {
        $sisa = getRemainingLockSeconds($username_get, $ip);
        if ($sisa <= 0) clearLoginAttempts($username_get, $ip);
    }
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    if (!$username || !$password) {
        $error = 'Username dan password wajib diisi';
    } else {
        $result = doLogin($username, $password);
        if ($result['success']) {
            header('Location: ' . ($result['role'] === 'admin' ? 'admin.php' : 'karyawan.php'));
            exit;
        } else {
            $error             = $result['message'];
            $locked            = $result['locked']            ?? false;
            $remaining_seconds = $result['remaining_seconds'] ?? 0;
        }
    }
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Login — Parfum Stock System</title>
  <link rel="stylesheet" href="assets/style.css"/>
</head>
<body class="page-login">

<div class="login-wrap">
  <div class="login-box">

    <div class="login-logo">
      <img src="assets/logo.png" alt="Mekar Wangi"
        style="width:90px;height:90px;object-fit:contain;border-radius:16px;background:#3D52A0;padding:8px;margin-bottom:12px"/>
      <h1 class="login-title">Mekar Wangi System</h1>
      <p class="login-sub">Masuk untuk melanjutkan</p>
    </div>

    <?php if ($error): ?>
      <div class="<?= isset($locked) && $locked ? 'alert alert-danger' : 'alert alert-warn' ?>"
        style="font-size:12px;text-align:center">
        <?= isset($locked) && $locked ? '🔒 ' : '⚠️ ' ?><?= htmlspecialchars($error) ?>
        <?php if (isset($locked) && $locked): ?>
          <div id="countdown" style="margin-top:6px;font-weight:600;font-size:13px"></div>
          <script>
            (function() {
              var sisa = <?= max(0, (int)($remaining_seconds ?? 0)) ?>;
              var el   = document.getElementById('countdown');
              var btn = document.querySelector('button[type=submit]') ||
                        document.querySelector('.btn-primary');

              if (sisa <= 0) {
                // Sudah tidak terkunci — jangan tampilkan apa-apa, biarkan form normal
                el.textContent = '';
              } else {
                // Masih terkunci — disable tombol dan jalankan countdown
                if (btn) btn.disabled = true;
                function update() {
                  if (sisa <= 0) {
                    // Sembunyikan pesan merah, tampilkan pesan hijau
                    var alertBox = el.closest('.alert-danger');
                    if (!alertBox) alertBox = document.querySelector('.alert-danger');
                    if (alertBox) alertBox.style.display = 'none';
                    el.innerHTML = '<div style="background:#E8F5E9;border:1px solid #81C784;border-radius:8px;padding:10px;color:#2E7D32;font-weight:600;margin-top:4px">✅ Waktu habis, silakan coba login kembali.</div>';
                    if (btn) btn.disabled = false;
                    return;
                  }
                  var m = Math.floor(sisa / 60);
                  var s = sisa % 60;
                  var pad = s < 10 ? '0' + s : '' + s;
                  el.textContent = 'Coba lagi dalam ' + (m > 0 ? m + ':' + pad + ' menit' : s + ' detik');
                  sisa--;
                  setTimeout(update, 1000);
                }
                update();
              }
            })();
          </script>
        <?php endif; ?>
      </div>
    <?php endif; ?>

    <form method="POST" action="index.php">
      <?php if (isset($_GET['timeout'])): ?>
      <div style="background:#FFF8E1;border:0.5px solid #F59E0B;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:#92400E;text-align:center">
        ⏱️ Sesi berakhir karena tidak aktif. Silakan login kembali.
      </div>
      <?php endif; ?>
      <div class="form-group">
        <label for="username">Username</label>
        <input type="text" id="username" name="username"
               value="<?= htmlspecialchars($_POST['username'] ?? '') ?>"
               placeholder="Masukkan username" autocomplete="username" required/>
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password"
               placeholder="Masukkan password" autocomplete="current-password" required/>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Masuk</button>
    </form>

    <!-- HAPUS BAGIAN INI sebelum digunakan sungguhan -->
    

  </div>
</div>

</body>
</html>