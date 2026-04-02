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
  <title>Login — Mekar Wangi System</title>
  <link rel="stylesheet" href="assets/style.css?v=<?php echo filemtime('assets/style.css'); ?>">
</head>
<body class="page-login">

<div class="login-wrap">
  <div class="login-box">

    <div class="login-logo">
      <img src="assets/mw-removebg-preview.png" alt="Mekar Wangi"
        style="width: 120px;height:auto;object-fit:contain;border-radius:16px;padding:8px;margin-bottom:12px"/>
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
                el.textContent = '';
              } else {
                if (btn) btn.disabled = true;
                function update() {
                  if (sisa <= 0) {
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
        <div style="position:relative">
          <input type="password" id="password" name="password"
                 placeholder="Masukkan password" autocomplete="current-password" required
                 style="padding-right:42px;width:100%;box-sizing:border-box"/>
          <button type="button" onclick="togglePassword()"
                  style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;padding:4px;color:var(--text2);display:flex;align-items:center"
                  title="Tampilkan/sembunyikan password">
            <svg id="eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Masuk</button>
    </form>

  </div>
</div>

<script>
function togglePassword() {
  const input = document.getElementById('password');
  const icon  = document.getElementById('eye-icon');
  const show  = input.type === 'password';
  input.type  = show ? 'text' : 'password';
  // Ganti ikon: mata terbuka / mata tercoret
  icon.innerHTML = show
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
       <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
       <line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
       <circle cx="12" cy="12" r="3"/>`;
}
</script>

</body>
</html>