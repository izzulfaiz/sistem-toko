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
    $aktif  = isset($body['aktif']) ? (int)$body['aktif'] : 1;

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
        $stmt = $db->prepare("UPDATE users SET nama=?,username=?,password=?,role=?,cabang_id=?,aktif=? WHERE id=?");
        $ok   = $stmt->execute([$nama,$uname,$hash,$role,$cab_id?:null,$aktif,$id]);
    } else {
        $stmt = $db->prepare("UPDATE users SET nama=?,username=?,role=?,cabang_id=?,aktif=? WHERE id=?");
        $ok   = $stmt->execute([$nama,$uname,$role,$cab_id?:null,$aktif,$id]);
    }
    jsonResponse(['success'=>$ok,'message'=>$ok?'User diperbarui':'Gagal menyimpan']);
}

// ---- DELETE — hapus user --------------------------------
if ($method === 'DELETE') {
    $body = json_decode(file_get_contents('php://input'), true);
    $id   = (int)($body['id'] ?? 0);

    if ($id === (int)$user['id'])
        jsonResponse(['success'=>false,'message'=>'Tidak bisa menghapus akun sendiri'], 400);

    $stmt = $db->prepare("DELETE FROM users WHERE id = ?");
    $ok   = $stmt->execute([$id]);
    jsonResponse(['success'=>$ok,'message'=>$ok?'User dihapus':'Gagal menghapus']);
}

// ---- PATCH — kelola cabang & bibit ----------------------
if ($method === 'PATCH') {
    $body   = json_decode(file_get_contents('php://input'), true);
    if (!$body)
        jsonResponse(['success'=>false,'message'=>'Request body tidak valid'], 400);

    $action = $body['action'] ?? '';

    // --- TAMBAH CABANG ---
    if ($action === 'tambah_cabang') {
        $nama   = clean($body['nama']   ?? '');
        $alamat = clean($body['alamat'] ?? '');
        if (!$nama) jsonResponse(['success'=>false,'message'=>'Nama cabang wajib diisi'], 400);

        $stmt = $db->prepare("SELECT id FROM cabang WHERE nama = ?");
        $stmt->execute([$nama]);
        if ($stmt->fetch()) jsonResponse(['success'=>false,'message'=>'Nama cabang sudah ada'], 400);

        $stmt = $db->prepare("INSERT INTO cabang (nama, alamat) VALUES (?,?)");
        $stmt->execute([$nama, $alamat]);
        $cab_id = (int)$db->lastInsertId();

        // Buat stok 0 untuk semua bibit yang ada
        $bibits = getAllBibit();
        $ins    = $db->prepare("INSERT INTO stok (cabang_id, bibit_id, jumlah) VALUES (?,?,0)");
        foreach ($bibits as $b) $ins->execute([$cab_id, $b['id']]);

        jsonResponse(['success'=>true,'id'=>$cab_id,'message'=>'Cabang berhasil ditambahkan']);
    }

    // --- EDIT CABANG ---
    if ($action === 'edit_cabang') {
        $id   = (int)($body['id']   ?? 0);
        $nama = clean($body['nama'] ?? '');
        if (!$id || !$nama) jsonResponse(['success'=>false,'message'=>'Data tidak lengkap'], 400);

        $stmt = $db->prepare("SELECT id FROM cabang WHERE nama = ? AND id != ?");
        $stmt->execute([$nama, $id]);
        if ($stmt->fetch()) jsonResponse(['success'=>false,'message'=>'Nama cabang sudah digunakan'], 400);

        $stmt = $db->prepare("UPDATE cabang SET nama = ? WHERE id = ?");
        $ok   = $stmt->execute([$nama, $id]);
        jsonResponse(['success'=>$ok,'message'=>$ok?'Cabang diperbarui':'Gagal menyimpan']);
    }

    // --- HAPUS CABANG ---
    if ($action === 'hapus_cabang') {
        $id = (int)($body['id'] ?? 0);
        if (!$id) jsonResponse(['success'=>false,'message'=>'ID tidak valid'], 400);
        $stmt = $db->prepare("DELETE FROM cabang WHERE id = ?");
        $ok   = $stmt->execute([$id]);
        jsonResponse(['success'=>$ok,'message'=>$ok?'Cabang dihapus':'Gagal menghapus']);
    }

    // --- TAMBAH BIBIT ---
    if ($action === 'tambah_bibit') {
        $nama         = clean($body['nama']         ?? '');
        $stok         = (float)($body['stok_awal']  ?? 0);
        $satuan       = clean($body['satuan']        ?? 'ml');
        $satuan_dasar = clean($body['satuan_dasar']  ?? $satuan);
        $konversi     = (float)($body['konversi']    ?? 1);

        if (!$nama) jsonResponse(['success'=>false,'message'=>'Nama produk wajib diisi'], 400);

        $stmt = $db->prepare("SELECT id FROM bibit WHERE nama = ?");
        $stmt->execute([$nama]);
        if ($stmt->fetch()) jsonResponse(['success'=>false,'message'=>'Produk sudah ada'], 400);

        $stmt = $db->prepare("INSERT INTO bibit (nama, satuan, satuan_dasar, konversi) VALUES (?,?,?,?)");
        $stmt->execute([$nama, $satuan, $satuan_dasar, $konversi]);
        $bibit_id = (int)$db->lastInsertId();

        $cabangs = getAllCabang();
        $ins     = $db->prepare("INSERT INTO stok (cabang_id, bibit_id, jumlah) VALUES (?,?,?)");
        foreach ($cabangs as $c) $ins->execute([$c['id'], $bibit_id, $stok]);

        jsonResponse(['success'=>true,'id'=>$bibit_id,'message'=>'Produk berhasil ditambahkan']);
    }

    // --- EDIT BIBIT ---
    if ($action === 'edit_bibit') {
        $id   = (int)($body['id']   ?? 0);
        $nama = clean($body['nama'] ?? '');
        if (!$id || !$nama) jsonResponse(['success'=>false,'message'=>'Data tidak lengkap'], 400);

        $stmt = $db->prepare("SELECT id FROM bibit WHERE nama = ? AND id != ?");
        $stmt->execute([$nama, $id]);
        if ($stmt->fetch()) jsonResponse(['success'=>false,'message'=>'Nama bibit sudah digunakan'], 400);

        $stmt = $db->prepare("UPDATE bibit SET nama = ? WHERE id = ?");
        $ok   = $stmt->execute([$nama, $id]);
        jsonResponse(['success'=>$ok,'message'=>$ok?'Bibit diperbarui':'Gagal menyimpan']);
    }

    // --- HAPUS BIBIT ---
    if ($action === 'hapus_bibit') {
        $id = (int)($body['id'] ?? 0);
        if (!$id) jsonResponse(['success'=>false,'message'=>'ID tidak valid'], 400);
        $stmt = $db->prepare("DELETE FROM bibit WHERE id = ?");
        $ok   = $stmt->execute([$id]);
        jsonResponse(['success'=>$ok,'message'=>$ok?'Bibit dihapus':'Gagal menghapus']);
    }

    jsonResponse(['success'=>false,'message'=>'Action tidak dikenal'], 400);
}

jsonResponse(['success'=>false,'message'=>'Method tidak diizinkan'], 405);