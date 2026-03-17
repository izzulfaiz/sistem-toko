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
            $error = $result['message'];
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
      <div class="login-icon">
  <img src="pic/mw-removebg-preview.png" alt="Logo MW" class="logo-img" style="width: 40px; height: 40px; object-fit: contain;"/>
</div>

      <h1 class="login-title">Mekar Wangi Stock System</h1>
      <p class="login-sub">Masuk untuk melanjutkan</p>
    </div>

    <?php if ($error): ?>
      <div class="alert alert-danger"><?= htmlspecialchars($error) ?></div>
    <?php endif; ?>

    <form method="POST" action="index.php">
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
  
  </div>
</div>

</body>
</html>