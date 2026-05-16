<?php
// =====================================================
// api/users.php — API endpoint untuk manajemen user
// Hanya bisa diakses admin
// =====================================================

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/functions.php';

requireAdmin();

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$user   = currentUser();
$db     = getDB();

// ---- GET -----------------------------------------------
if ($method === 'GET') {
    jsonResponse([
        'success' => true,
        'users'   => getAllUsers(),
        'cabang'  => getAllCabang(),
        'bibit'   => getAllBibit(),
    ]);
}

// ---- POST — FormData action (edit_bibit dengan foto) ----
if ($method === 'POST' && !empty($_POST['action'])) {
    $action = $_POST['action'];

    if ($action === 'edit_bibit') {
        $id             = (int)($_POST['id']             ?? 0);
        $nama           = clean($_POST['nama']           ?? '');
        $deskripsi      = clean($_POST['deskripsi']      ?? '');
        $tampil_landing = (int)($_POST['tampil_landing'] ?? 0);

        if (!$id || !$nama) jsonResponse(['success'=>false,'message'=>'Data tidak lengkap'], 400);

        $stmt = $db->prepare("SELECT id FROM bibit WHERE nama = ? AND id != ?");
        $stmt->execute([$nama, $id]);
        if ($stmt->fetch()) jsonResponse(['success'=>false,'message'=>'Nama produk sudah digunakan'], 400);

        $set_kategori = '';
        $params_extra = [];
        if (!empty($_POST['kategori'])) {
            $kategori       = clean($_POST['kategori']);
            $valid_kategori = ['parfum_baju','parfum_religi','parfum_spiritual','parfum_laundry','aksesoris'];
            if (!in_array($kategori, $valid_kategori)) $kategori = 'parfum_baju';
            $set_kategori   = ', kategori = ?';
            $params_extra[] = $kategori;
        }
        // Update satuan kalau dikirim
$set_satuan = '';
if (!empty($_POST['satuan'])) {
    $satuan       = clean($_POST['satuan']);
    $satuan_dasar = clean($_POST['satuan_dasar'] ?? $satuan);
    $konversi     = (float)($_POST['konversi'] ?? 1);
    $set_satuan   = ', satuan = ?, satuan_dasar = ?, konversi = ?';
    array_push($params_extra, $satuan, $satuan_dasar, $konversi);
}

        $set_foto = '';
        if (!empty($_FILES['foto']['name'])) {
            $upload_dir = __DIR__ . '/../images/produk/';
            if (!is_dir($upload_dir)) mkdir($upload_dir, 0755, true);

            $ext     = strtolower(pathinfo($_FILES['foto']['name'], PATHINFO_EXTENSION));
            $allowed = ['jpg','jpeg','png','webp'];
            if (!in_array($ext, $allowed))
                jsonResponse(['success'=>false,'message'=>'Format foto tidak didukung'], 400);
            if ($_FILES['foto']['size'] > 5 * 1024 * 1024)
                jsonResponse(['success'=>false,'message'=>'Ukuran foto maksimal 5MB'], 400);

            $filename = 'produk_' . time() . '_' . uniqid() . '.' . $ext;
            if (!move_uploaded_file($_FILES['foto']['tmp_name'], $upload_dir . $filename))
                jsonResponse(['success'=>false,'message'=>'Gagal upload foto'], 500);

            // Hapus foto lama
            $old = $db->prepare("SELECT foto FROM bibit WHERE id = ?");
            $old->execute([$id]);
            $old_foto = $old->fetchColumn();
            if ($old_foto && file_exists($upload_dir . $old_foto)) unlink($upload_dir . $old_foto);

            $set_foto       = ', foto = ?';
            $params_extra[] = $filename;
        }

        $params = [$nama, $deskripsi, $tampil_landing];
        array_push($params, ...$params_extra);
        $params[] = $id;

        $stmt = $db->prepare("UPDATE bibit SET nama=?, deskripsi=?, tampil_landing=? $set_kategori $set_satuan $set_foto WHERE id=?");
        $ok   = $stmt->execute($params);

        jsonResponse(['success'=>$ok,'message'=>$ok?'Produk diperbarui':'Gagal menyimpan']);
    }
}
// ---- POST — tambah user --------------------------------
if ($method === 'POST') {
    $body   = json_decode(file_get_contents('php://input'), true);
    $nama   = clean($body['nama']     ?? '');
    $uname  = clean($body['username'] ?? '');
    $pass   = $body['password']       ?? '';
    $role   = in_array($body['role'] ?? '', ['admin','karyawan']) ? $body['role'] : 'karyawan';
    $cab_id = $role === 'admin' ? null : (int)($body['cabang_id'] ?? 0);

    if (!$nama || !$uname || !$pass)
        jsonResponse(['success'=>false,'message'=>'Nama, username, dan password wajib diisi'], 400);
    if (strlen($pass) < 6)
        jsonResponse(['success'=>false,'message'=>'Password minimal 6 karakter'], 400);

    $stmt = $db->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->execute([$uname]);
    if ($stmt->fetch())
        jsonResponse(['success'=>false,'message'=>'Username sudah digunakan'], 400);

    $hash = password_hash($pass, PASSWORD_BCRYPT);
    $stmt = $db->prepare("INSERT INTO users (nama, username, password, role, cabang_id) VALUES (?,?,?,?,?)");
    $ok   = $stmt->execute([$nama, $uname, $hash, $role, $cab_id ?: null]);
    jsonResponse(['success'=>$ok, 'message'=>$ok?'User berhasil ditambahkan':'Gagal menyimpan', 'id'=>$ok?(int)$db->lastInsertId():null]);
}

// ---- PUT — edit user -----------------------------------
if ($method === 'PUT') {
    $body   = json_decode(file_get_contents('php://input'), true);
    $id     = (int)($body['id']       ?? 0);
    $nama   = clean($body['nama']     ?? '');
    $uname  = clean($body['username'] ?? '');
    $pass   = $body['password']       ?? '';
    $role   = in_array($body['role'] ?? '', ['admin','karyawan']) ? $body['role'] : 'karyawan';
    $cab_id = $role === 'admin' ? null : (int)($body['cabang_id'] ?? 0);

    if (!$id || !$nama || !$uname)
        jsonResponse(['success'=>false,'message'=>'Data tidak lengkap'], 400);

    $stmt = $db->prepare("SELECT id FROM users WHERE username = ? AND id != ?");
    $stmt->execute([$uname, $id]);
    if ($stmt->fetch())
        jsonResponse(['success'=>false,'message'=>'Username sudah digunakan'], 400);

    if ($pass) {
        if (strlen($pass) < 6)
            jsonResponse(['success'=>false,'message'=>'Password minimal 6 karakter'], 400);
        $hash = password_hash($pass, PASSWORD_BCRYPT);
        $stmt = $db->prepare("UPDATE users SET nama=?, username=?, password=?, role=?, cabang_id=? WHERE id=?");
        $ok   = $stmt->execute([$nama, $uname, $hash, $role, $cab_id ?: null, $id]);
    } else {
        $stmt = $db->prepare("UPDATE users SET nama=?, username=?, role=?, cabang_id=? WHERE id=?");
        $ok   = $stmt->execute([$nama, $uname, $role, $cab_id ?: null, $id]);
    }

    jsonResponse(['success'=>$ok,'message'=>$ok?'User diperbarui':'Gagal menyimpan']);
}

// ---- DELETE — hapus user -------------------------------
if ($method === 'DELETE') {
    $body = json_decode(file_get_contents('php://input'), true);
    $id   = (int)($body['id'] ?? 0);
    if (!$id) jsonResponse(['success'=>false,'message'=>'ID tidak valid'], 400);

    $stmt = $db->prepare("DELETE FROM users WHERE id = ?");
    $ok   = $stmt->execute([$id]);
    jsonResponse(['success'=>$ok,'message'=>$ok?'User dihapus':'Gagal menghapus']);
}

// ---- PATCH — aksi khusus (tambah/edit/hapus bibit & cabang) ---
if ($method === 'PATCH') {
    // Cek apakah FormData (ada $_POST) atau JSON biasa
    if (!empty($_POST)) {
        $body   = $_POST;
    } else {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
    }
    $action = $body['action'] ?? '';

    // =====================================================
    // TAMBAH PRODUK BARU
    // =====================================================
    if ($action === 'tambah_bibit') {
        $nama           = clean($body['nama']           ?? '');
        $stok           = (float)($body['stok_awal']    ?? 0);
        $satuan         = clean($body['satuan']          ?? 'ml');
        $satuan_dasar   = clean($body['satuan_dasar']    ?? $satuan);
        $konversi       = (float)($body['konversi']      ?? 1);
        $deskripsi      = clean($body['deskripsi']       ?? '');
        $tampil_landing = (int)($body['tampil_landing']  ?? 0);

        // Validasi & sanitasi kategori
        $kategori       = clean($body['kategori'] ?? 'parfum_baju');
        $valid_kategori = ['parfum_baju','parfum_religi','parfum_spiritual','parfum_laundry','aksesoris'];
        if (!in_array($kategori, $valid_kategori)) $kategori = 'parfum_baju';

        if (!$nama) jsonResponse(['success'=>false,'message'=>'Nama produk wajib diisi'], 400);

        $stmt = $db->prepare("SELECT id FROM bibit WHERE nama = ?");
        $stmt->execute([$nama]);
        if ($stmt->fetch()) jsonResponse(['success'=>false,'message'=>'Produk sudah ada'], 400);

        $stmt = $db->prepare("
            INSERT INTO bibit (nama, kategori, deskripsi, tampil_landing, satuan, satuan_dasar, konversi)
            VALUES (?,?,?,?,?,?,?)
        ");
        $stmt->execute([$nama, $kategori, $deskripsi, $tampil_landing, $satuan, $satuan_dasar, $konversi]);
        $bibit_id = (int)$db->lastInsertId();

        $cabangs = getAllCabang();
        $ins     = $db->prepare("INSERT INTO stok (cabang_id, bibit_id, jumlah) VALUES (?,?,?)");
        foreach ($cabangs as $c) $ins->execute([$c['id'], $bibit_id, $stok]);

        jsonResponse(['success'=>true,'id'=>$bibit_id,'message'=>'Produk berhasil ditambahkan']);
    }

    // =====================================================
    // EDIT PRODUK (nama, kategori, deskripsi, tampil_landing)
    // =====================================================
    if ($action === 'edit_bibit') {
    // Pakai $_POST karena FormData (ada file upload)
    $id             = (int)($_POST['id']             ?? 0);
    $nama           = clean($_POST['nama']           ?? '');
    $deskripsi      = clean($_POST['deskripsi']      ?? '');
    $tampil_landing = (int)($_POST['tampil_landing'] ?? 0);

    if (!$id || !$nama) jsonResponse(['success'=>false,'message'=>'Data tidak lengkap'], 400);

    $stmt = $db->prepare("SELECT id FROM bibit WHERE nama = ? AND id != ?");
    $stmt->execute([$nama, $id]);
    if ($stmt->fetch()) jsonResponse(['success'=>false,'message'=>'Nama produk sudah digunakan'], 400);

    // Validasi kategori
    $set_kategori = '';
    $params_extra = [];
    if (!empty($_POST['kategori'])) {
        $kategori       = clean($_POST['kategori']);
        $valid_kategori = ['parfum_baju','parfum_religi','parfum_spiritual','parfum_laundry','aksesoris'];
        if (!in_array($kategori, $valid_kategori)) $kategori = 'parfum_baju';
        $set_kategori   = ', kategori = ?';
        $params_extra[] = $kategori;
    }

    // Handle upload foto
    $set_foto = '';
    if (!empty($_FILES['foto']['name'])) {
        $upload_dir = __DIR__ . '/../images/produk/';
        if (!is_dir($upload_dir)) mkdir($upload_dir, 0755, true);

        $ext     = strtolower(pathinfo($_FILES['foto']['name'], PATHINFO_EXTENSION));
        $allowed = ['jpg','jpeg','png','webp'];
        if (!in_array($ext, $allowed))
            jsonResponse(['success'=>false,'message'=>'Format foto tidak didukung. Gunakan JPG, PNG, atau WebP'], 400);
        if ($_FILES['foto']['size'] > 5 * 1024 * 1024)
            jsonResponse(['success'=>false,'message'=>'Ukuran foto maksimal 5MB'], 400);

        $filename = 'produk_' . time() . '_' . uniqid() . '.' . $ext;
        if (!move_uploaded_file($_FILES['foto']['tmp_name'], $upload_dir . $filename))
            jsonResponse(['success'=>false,'message'=>'Gagal upload foto'], 500);

        // Hapus foto lama
        $old = $db->prepare("SELECT foto FROM bibit WHERE id = ?");
        $old->execute([$id]);
        $old_foto = $old->fetchColumn();
        if ($old_foto && file_exists($upload_dir . $old_foto)) {
            unlink($upload_dir . $old_foto);
        }

        $set_foto       = ', foto = ?';
        $params_extra[] = $filename;
    }

    $params = [$nama, $deskripsi, $tampil_landing];
    array_push($params, ...$params_extra);
    $params[] = $id;

    $stmt = $db->prepare("UPDATE bibit SET nama=?, deskripsi=?, tampil_landing=? $set_kategori $set_foto WHERE id=?");
    $ok   = $stmt->execute($params);

    jsonResponse(['success'=>$ok,'message'=>$ok?'Produk diperbarui':'Gagal menyimpan']);
}

    // =====================================================
    // HAPUS PRODUK
    // =====================================================
    if ($action === 'hapus_bibit') {
        $id = (int)($body['id'] ?? 0);
        if (!$id) jsonResponse(['success'=>false,'message'=>'ID tidak valid'], 400);
        $stmt = $db->prepare("DELETE FROM bibit WHERE id = ?");
        $ok   = $stmt->execute([$id]);
        jsonResponse(['success'=>$ok,'message'=>$ok?'Produk dihapus':'Gagal menghapus']);
    }

    // =====================================================
    // TAMBAH CABANG
    // =====================================================
    if ($action === 'tambah_cabang') {
        $nama   = clean($body['nama']   ?? '');
        $alamat = clean($body['alamat'] ?? '');
        if (!$nama) jsonResponse(['success'=>false,'message'=>'Nama cabang wajib diisi'], 400);

        $stmt = $db->prepare("INSERT INTO cabang (nama, alamat) VALUES (?,?)");
        $ok   = $stmt->execute([$nama, $alamat]);
        $cab_id = (int)$db->lastInsertId();

        if ($ok) {
            $bibits = $db->query("SELECT id FROM bibit")->fetchAll();
            $ins    = $db->prepare("INSERT INTO stok (cabang_id, bibit_id, jumlah) VALUES (?,?,0)");
            foreach ($bibits as $b) $ins->execute([$cab_id, $b['id']]);
        }

        jsonResponse(['success'=>$ok,'id'=>$cab_id,'message'=>$ok?'Cabang berhasil ditambahkan':'Gagal menyimpan']);
    }

    // =====================================================
    // EDIT CABANG
    // =====================================================
    if ($action === 'edit_cabang') {
        $id     = (int)($body['id']     ?? 0);
        $nama   = clean($body['nama']   ?? '');
        $alamat = clean($body['alamat'] ?? '');
        if (!$id || !$nama) jsonResponse(['success'=>false,'message'=>'Data tidak lengkap'], 400);

        $stmt = $db->prepare("UPDATE cabang SET nama=?, alamat=? WHERE id=?");
        $ok   = $stmt->execute([$nama, $alamat, $id]);
        jsonResponse(['success'=>$ok,'message'=>$ok?'Cabang diperbarui':'Gagal menyimpan']);
    }

    jsonResponse(['success'=>false,'message'=>'Aksi tidak dikenal'], 400);
}