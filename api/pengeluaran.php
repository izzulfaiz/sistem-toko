<?php
// =====================================================
// api/pengeluaran.php — API transaksi keluar
// =====================================================

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/functions.php';

requireLogin();

$method = $_SERVER['REQUEST_METHOD'];
$user   = currentUser();
$db     = getDB();

// ---- GET ------------------------------------------------
if ($method === 'GET') {
    $cabang_id = isAdmin()
        ? ($_GET['cabang_id'] ?? null)
        : (int)$user['cabang_id'];
    $tanggal  = $_GET['tanggal'] ?? null;
    $page     = max(1, (int)($_GET['page']     ?? 1));
    $per_page = min(100, (int)($_GET['per_page'] ?? 25));

    $where = []; $params = [];
    if ($cabang_id) { $where[] = "p.cabang_id = ?"; $params[] = $cabang_id; }
    if ($tanggal)   { $where[] = "DATE(p.created_at) = ?"; $params[] = $tanggal; }
    $whereSQL = $where ? "WHERE ".implode(" AND ",$where) : "";

    $baseSQL = "FROM pengeluaran p
        JOIN users  u ON p.user_id   = u.id
        JOIN cabang c ON p.cabang_id = c.id
        $whereSQL";

    $stmtCount = $db->prepare("SELECT COUNT(*) $baseSQL");
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetchColumn();

    $stmtSum = $db->prepare("SELECT SUM(p.nominal) $baseSQL");
    $stmtSum->execute($params);
    $total_nominal = (float)($stmtSum->fetchColumn() ?? 0);

    $offset = ($page-1)*$per_page;
    $stmt   = $db->prepare("SELECT p.*, u.nama AS user_nama, c.nama AS cabang_nama $baseSQL ORDER BY p.created_at DESC LIMIT ? OFFSET ?");
    $stmt->execute(array_merge($params, [$per_page, $offset]));
    $total_pages = max(1,(int)ceil($total/$per_page));

    jsonResponse([
        'success'       => true,
        'pengeluaran'   => $stmt->fetchAll(),
        'total_nominal' => $total_nominal,
        'pagination'    => [
            'total'=>$total,'per_page'=>$per_page,'current'=>$page,
            'total_pages'=>$total_pages,'has_prev'=>$page>1,'has_next'=>$page<$total_pages,
            'from'=>$total>0?($page-1)*$per_page+1:0,'to'=>min($page*$per_page,$total),
        ],
    ]);
}

// ---- POST -----------------------------------------------
if ($method === 'POST') {
    $body      = json_decode(file_get_contents('php://input'), true);
    $nama_item = clean($body['nama_item']  ?? '');
    $nominal   = (float)($body['nominal']  ?? 0);
    $ket       = clean($body['keterangan'] ?? '');
    $cabang_id = (int)$user['cabang_id'];

    if (!$nama_item) jsonResponse(['success'=>false,'message'=>'Nama item wajib diisi'],400);
    if ($nominal<=0) jsonResponse(['success'=>false,'message'=>'Nominal harus lebih dari 0'],400);
    if (!$cabang_id) jsonResponse(['success'=>false,'message'=>'Akun tidak terhubung ke cabang'],400);

    $stmt = $db->prepare("INSERT INTO pengeluaran (user_id,cabang_id,nama_item,nominal,keterangan) VALUES (?,?,?,?,?)");
    $ok   = $stmt->execute([$user['id'],$cabang_id,$nama_item,$nominal,$ket]);
    jsonResponse(['success'=>$ok,'message'=>$ok?'Pengeluaran berhasil dicatat':'Gagal','id'=>$ok?$db->lastInsertId():null]);
}

// ---- DELETE ---------------------------------------------
if ($method === 'DELETE') {
    $body = json_decode(file_get_contents('php://input'), true);
    $id   = (int)($body['id'] ?? 0);
    if (!$id) jsonResponse(['success'=>false,'message'=>'ID tidak valid'],400);

    if (isAdmin()) {
        $stmt = $db->prepare("DELETE FROM pengeluaran WHERE id = ?");
        $ok   = $stmt->execute([$id]);
    } else {
        $stmt = $db->prepare("DELETE FROM pengeluaran WHERE id = ? AND cabang_id = ?");
        $ok   = $stmt->execute([$id, $user['cabang_id']]);
    }
    jsonResponse(['success'=>$ok]);
}