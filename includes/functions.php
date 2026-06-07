<?php
// =====================================================
// includes/functions.php
// =====================================================

date_default_timezone_set('Asia/Jakarta'); // ✅ Fix timezone WIB

require_once __DIR__ . '/../config/database.php';

function jsonResponse(array $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function clean(string $input): string {
    return strip_tags(trim($input));
}

// ---- STOK ------------------------------------------------

function getAllStok(?int $cabang_id = null): array {
    $db = getDB();
    $sql = "
        SELECT s.id, s.jumlah, s.updated_at,
               c.id AS cabang_id, c.nama AS cabang_nama,
               b.id AS bibit_id, b.nama AS bibit_nama,
               b.satuan, b.satuan_dasar, b.konversi
        FROM stok s
        JOIN cabang c ON s.cabang_id = c.id
        JOIN bibit  b ON s.bibit_id  = b.id
    ";
    if ($cabang_id) {
        $stmt = $db->prepare($sql . " WHERE s.cabang_id = ? ORDER BY c.nama, b.nama");
        $stmt->execute([$cabang_id]);
    } else {
        $stmt = $db->prepare($sql . " ORDER BY c.nama, b.nama");
        $stmt->execute();
    }
    return $stmt->fetchAll();
}

function updateStok(int $cabang_id, int $bibit_id, float $jumlah_baru, int $user_id, string $tipe, float $jumlah_delta, string $ket = '', ?int $transaksi_id = null): bool {
    $db = getDB();
    try {
        $db->beginTransaction();
        $stmt = $db->prepare("INSERT INTO stok (cabang_id, bibit_id, jumlah) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE jumlah = ?");
        $stmt->execute([$cabang_id, $bibit_id, $jumlah_baru, $jumlah_baru]);
        $stmt = $db->prepare("INSERT INTO log_aktivitas (user_id, cabang_id, bibit_id, tipe, jumlah, sisa, keterangan, transaksi_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$user_id, $cabang_id, $bibit_id, $tipe, $jumlah_delta, $jumlah_baru, $ket, $transaksi_id]);
        $db->commit();
        return true;
    } catch (PDOException $e) {
        $db->rollBack();
        return false;
    }
}

function getStokSaatIni(int $cabang_id, int $bibit_id): float {
    $db   = getDB();
    $stmt = $db->prepare("SELECT jumlah FROM stok WHERE cabang_id = ? AND bibit_id = ?");
    $stmt->execute([$cabang_id, $bibit_id]);
    $row  = $stmt->fetch();
    return $row ? (float)$row['jumlah'] : 0;
}

// ---- TRANSAKSI -------------------------------------------

function generateKodeNota(int $cabang_id): string {
    $db    = getDB();
    $stmt  = $db->prepare("SELECT COUNT(*) FROM transaksi WHERE cabang_id = ? AND DATE(created_at) = CURDATE()");
    $stmt->execute([$cabang_id]);
    $count = (int)$stmt->fetchColumn() + 1;
    return 'TRX-' . date('Ymd') . '-' . $cabang_id . '-' . str_pad($count, 3, '0', STR_PAD_LEFT);
}

function simpanTransaksi(int $user_id, int $cabang_id, array $items, string $catatan = ''): array {
    $db = getDB();
    try {
        $db->beginTransaction();

        foreach ($items as $item) {
            $bibit_id    = (int)$item['bibit_id'];
            $jumlah_stok = (float)$item['jumlah_stok'];
            $saat_ini    = getStokSaatIni($cabang_id, $bibit_id);
            if ($jumlah_stok > $saat_ini) {
                $bibit = getBibitById($bibit_id);
                throw new Exception("Stok {$bibit['nama']} tidak cukup. Sisa: {$saat_ini} {$bibit['satuan_dasar']}");
            }
        }

        $total     = array_sum(array_column($items, 'subtotal'));
        $kode_nota = generateKodeNota($cabang_id);

        $stmt = $db->prepare("INSERT INTO transaksi (kode_nota, user_id, cabang_id, total, catatan) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$kode_nota, $user_id, $cabang_id, $total, $catatan]);
        $transaksi_id = (int)$db->lastInsertId();

        foreach ($items as $item) {
            $bibit_id    = (int)$item['bibit_id'];
            $satuan_jual = clean($item['satuan_jual']);
            $jumlah_jual = (float)$item['jumlah_jual'];
            $jumlah_stok = (float)$item['jumlah_stok'];
            $harga       = (float)$item['harga_satuan'];
            $subtotal    = (float)$item['subtotal'];

            // Ganti baris INSERT transaksi_detail yang lama dengan ini:
$stmt = $db->prepare("INSERT INTO transaksi_detail 
    (transaksi_id, bibit_id, satuan_jual, jumlah_jual, jumlah_stok, harga_satuan, subtotal, mix_group) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
$stmt->execute([
    $transaksi_id, $bibit_id, $satuan_jual, 
    $jumlah_jual, $jumlah_stok, $harga, $subtotal,
    isset($item['mix_group']) ? (int)$item['mix_group'] : null
]);

            $saat_ini    = getStokSaatIni($cabang_id, $bibit_id);
            $jumlah_baru = $saat_ini - $jumlah_stok;

            $stmt2 = $db->prepare("INSERT INTO stok (cabang_id, bibit_id, jumlah) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE jumlah = ?");
            $stmt2->execute([$cabang_id, $bibit_id, $jumlah_baru, $jumlah_baru]);

            $ket_log = "Penjualan #{$kode_nota}" . ($catatan ? " — {$catatan}" : "");
            $stmt3 = $db->prepare("INSERT INTO log_aktivitas (user_id, cabang_id, bibit_id, tipe, jumlah, sisa, keterangan, transaksi_id) VALUES (?, ?, ?, 'kurang', ?, ?, ?, ?)");
            $stmt3->execute([$user_id, $cabang_id, $bibit_id, $jumlah_stok, $jumlah_baru, $ket_log, $transaksi_id]);
        }

        $db->commit();
        return ['success' => true, 'transaksi_id' => $transaksi_id, 'kode_nota' => $kode_nota, 'total' => $total];
    } catch (Exception $e) {
        $db->rollBack();
        return ['success' => false, 'message' => $e->getMessage()];
    }
}

function getTransaksiHarian(?int $cabang_id = null, ?string $tanggal = null): array {
    $db     = getDB();
    $where  = [];
    $params = [];

    if ($cabang_id) { $where[] = "t.cabang_id = ?"; $params[] = $cabang_id; }
    $tgl = $tanggal ?: date('Y-m-d');
    $where[] = "DATE(t.created_at) = ?";
    $params[] = $tgl;

    $sql = "SELECT t.*, u.nama AS user_nama, c.nama AS cabang_nama
            FROM transaksi t
            JOIN users  u ON t.user_id   = u.id
            JOIN cabang c ON t.cabang_id = c.id";
    if ($where) $sql .= " WHERE " . implode(" AND ", $where);
    $sql .= " ORDER BY t.created_at DESC";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $transaksis = $stmt->fetchAll();

    foreach ($transaksis as &$trx) {
        $stmt2 = $db->prepare("SELECT td.*, b.nama AS bibit_nama, b.satuan, b.satuan_dasar FROM transaksi_detail td JOIN bibit b ON td.bibit_id = b.id WHERE td.transaksi_id = ?");
        $stmt2->execute([$trx['id']]);
        $trx['items'] = $stmt2->fetchAll();
    }
    return $transaksis;
}

function getTransaksiById(int $id): ?array {
    $db   = getDB();
    $stmt = $db->prepare("SELECT t.*, u.nama AS user_nama, c.nama AS cabang_nama FROM transaksi t JOIN users u ON t.user_id = u.id JOIN cabang c ON t.cabang_id = c.id WHERE t.id = ?");
    $stmt->execute([$id]);
    $trx = $stmt->fetch();
    if (!$trx) return null;
    $stmt2 = $db->prepare("
        SELECT td.*, b.nama AS bibit_nama, b.satuan, b.satuan_dasar, b.kategori
        FROM transaksi_detail td
        JOIN bibit b ON td.bibit_id = b.id
        WHERE td.transaksi_id = ?
    ");
    $stmt2->execute([$id]);
    $trx['items'] = $stmt2->fetchAll();
    return $trx;
}

// ---- LOG --------------------------------------------------

function getLogs(?int $cabang_id = null, ?string $tanggal = null, int $limit = 200): array {
    $db     = getDB();
    $where  = [];
    $params = [];

    if ($cabang_id) { $where[] = "l.cabang_id = ?"; $params[] = $cabang_id; }
    if ($tanggal)   { $where[] = "DATE(l.created_at) = ?"; $params[] = $tanggal; }

    $sql = "SELECT l.*, u.nama AS user_nama, c.nama AS cabang_nama, b.nama AS bibit_nama, b.satuan_dasar AS satuan
            FROM log_aktivitas l
            JOIN users  u ON l.user_id   = u.id
            JOIN cabang c ON l.cabang_id = c.id
            JOIN bibit  b ON l.bibit_id  = b.id";
    if ($where) $sql .= " WHERE " . implode(" AND ", $where);
    $sql .= " ORDER BY l.created_at DESC LIMIT ?";
    $params[] = $limit;

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

// ---- CABANG / BIBIT / USERS -------------------------------

function getAllCabang(): array { return getDB()->query("SELECT * FROM cabang ORDER BY nama")->fetchAll(); }

function getAllBibit(): array { return getDB()->query("SELECT * FROM bibit ORDER BY nama")->fetchAll(); }

function getBibitById(int $id): ?array {
    $stmt = getDB()->prepare("SELECT * FROM bibit WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
}

function getSatuanList(): array {
    return [
        ['satuan' => 'ml',    'satuan_dasar' => 'ml',    'konversi' => 1,    'label' => 'ml'],
        ['satuan' => 'liter', 'satuan_dasar' => 'ml',    'konversi' => 1000, 'label' => 'liter (1000ml)'],
        ['satuan' => 'gram',  'satuan_dasar' => 'gram',  'konversi' => 1,    'label' => 'gram'],
        ['satuan' => 'kg',    'satuan_dasar' => 'gram',  'konversi' => 1000, 'label' => 'kg (1000gram)'],
        ['satuan' => 'pcs',   'satuan_dasar' => 'pcs',   'konversi' => 1,    'label' => 'pcs'],
        ['satuan' => 'lusin', 'satuan_dasar' => 'pcs',   'konversi' => 12,   'label' => 'lusin (12pcs)'],
        ['satuan' => 'kodi',  'satuan_dasar' => 'pcs',   'konversi' => 20,   'label' => 'kodi (20pcs)'],
        ['satuan' => 'pack',  'satuan_dasar' => 'pack',  'konversi' => 1,    'label' => 'pack'],
        ['satuan' => 'box',   'satuan_dasar' => 'box',   'konversi' => 1,    'label' => 'box'],
        ['satuan' => 'botol', 'satuan_dasar' => 'botol', 'konversi' => 1,    'label' => 'botol'],
    ];
}

function getAllUsers(): array {
    $stmt = getDB()->query("SELECT u.id, u.nama, u.username, u.role, u.aktif, u.created_at, c.id AS cabang_id, c.nama AS cabang_nama FROM users u LEFT JOIN cabang c ON u.cabang_id = c.id ORDER BY u.role DESC, u.nama");
    return $stmt->fetchAll();
}

function getRingkasan(?int $cabang_id = null): array {
    $db    = getDB();
    $where = $cabang_id ? "WHERE cabang_id = $cabang_id" : "";
    $total = (float)($db->query("SELECT SUM(jumlah) FROM stok $where")->fetchColumn() ?? 0);
    $jml_cabang = (int)$db->query("SELECT COUNT(*) FROM cabang")->fetchColumn();
    $jml_bibit  = (int)$db->query("SELECT COUNT(*) FROM bibit")->fetchColumn();
    $stoks  = $db->query("SELECT jumlah FROM stok $where")->fetchAll(PDO::FETCH_COLUMN);
    $kritis = count(array_filter($stoks, fn($v) => $v < 100));
    $rendah = count(array_filter($stoks, fn($v) => $v >= 100 && $v < 200));
    return compact('total', 'jml_cabang', 'jml_bibit', 'kritis', 'rendah');
}

// ---- BATALKAN TRANSAKSI ----------------------------------

function batalTransaksi(int $transaksi_id, int $user_id): array {
    $db = getDB();
    try {
        $db->beginTransaction();

        $stmt = $db->prepare("SELECT * FROM transaksi WHERE id = ?");
        $stmt->execute([$transaksi_id]);
        $trx = $stmt->fetch();

        if (!$trx) throw new Exception('Transaksi tidak ditemukan');

        $tglTrx  = date('Y-m-d', strtotime($trx['created_at']));
        $tglHari = date('Y-m-d');
        if ($tglTrx !== $tglHari) throw new Exception('Transaksi hanya bisa dibatalkan di hari yang sama');

        if (str_starts_with($trx['kode_nota'], 'BATAL-')) throw new Exception('Transaksi ini sudah dibatalkan');

        // ---- Cek reward sebelum apapun ----
        if (str_starts_with($trx['kode_nota'], 'REWARD-')) {
            throw new Exception(
                'Transaksi reward tidak dapat dibatalkan. ' .
                'Hubungi admin jika ada kesalahan.'
            );
        }

        // ---- Cek reward jika transaksi punya member ----
        if ($trx['member_id']) {
            $member_id = (int)$trx['member_id'];

            // Ambil stamp yang terkait transaksi ini
            $stmtStamp = $db->prepare("
                SELECT stamp_ke FROM member_stamps
                WHERE transaksi_id = ? AND member_id = ?
            ");
            $stmtStamp->execute([$transaksi_id, $member_id]);
            $stamps = $stmtStamp->fetchAll();

            if (!empty($stamps)) {
                $stamp_ke_list = array_column($stamps, 'stamp_ke');
                $stamp_ke_min  = min($stamp_ke_list);
                $stamp_ke_max  = max($stamp_ke_list);

                // Cek apakah ada reward yang sudah REDEEMED dari stamp ini
                $stmtCekRedeemed = $db->prepare("
                    SELECT COUNT(*) FROM member_rewards
                    WHERE member_id = ?
                    AND status = 'redeemed'
                    AND stamp_snapshot >= ?
                    AND stamp_snapshot <= (
                        SELECT COALESCE(MAX(stamp_ke), 0) FROM member_stamps WHERE member_id = ?
                    )
                    AND (stamp_snapshot - 10) < ?
                ");
                $stmtCekRedeemed->execute([
                    $member_id,
                    $stamp_ke_min,
                    $member_id,
                    $stamp_ke_max
                ]);

                if ((int)$stmtCekRedeemed->fetchColumn() > 0) {
                    throw new Exception(
                        'Transaksi tidak dapat dibatalkan karena reward dari transaksi ini sudah ditukar. ' .
                        'Hubungi admin jika ada kesalahan.'
                    );
                }

                // Cek & batalkan reward yang masih PENDING dari stamp ini
                $stmtPending = $db->prepare("
                    SELECT id FROM member_rewards
                    WHERE member_id = ?
                    AND status = 'pending'
                    AND stamp_snapshot >= ? AND stamp_snapshot <= ?
                ");
                $stmtPending->execute([$member_id, $stamp_ke_min, $stamp_ke_max]);
                $pendingRewards = $stmtPending->fetchAll();

                foreach ($pendingRewards as $reward) {
                    $db->prepare("
                        UPDATE member_rewards
                        SET status  = 'cancelled',
                            catatan = ?
                        WHERE id = ?
                    ")->execute([
                        'Dibatalkan otomatis karena nota #' . $trx['kode_nota'] . ' dibatalkan',
                        $reward['id']
                    ]);
                }

                // Hapus stamp tanpa reorder — cukup delete, tidak geser stamp_ke lain
                $db->prepare("
                    DELETE FROM member_stamps
                    WHERE transaksi_id = ? AND member_id = ?
                ")->execute([$transaksi_id, $member_id]);

                $jumlah_stamp_dibatalkan = count($stamps);

                // Update total_stamp & stamp_available — tanpa reorder
                $db->prepare("
                    UPDATE members
                    SET total_stamp     = GREATEST(total_stamp - ?, 0),
                        stamp_available = GREATEST(stamp_available - ?, 0)
                    WHERE id = ?
                ")->execute([
                    $jumlah_stamp_dibatalkan,
                    $jumlah_stamp_dibatalkan,
                    $member_id
                ]);
            }
        }


        // ---- Kembalikan stok ----
        $stmt2 = $db->prepare("SELECT * FROM transaksi_detail WHERE transaksi_id = ?");
        $stmt2->execute([$transaksi_id]);
        $items = $stmt2->fetchAll();

        foreach ($items as $item) {
            $saat_ini    = getStokSaatIni($trx['cabang_id'], $item['bibit_id']);
            $jumlah_baru = $saat_ini + $item['jumlah_stok'];

            $db->prepare("
                INSERT INTO stok (cabang_id, bibit_id, jumlah) VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE jumlah = ?
            ")->execute([$trx['cabang_id'], $item['bibit_id'], $jumlah_baru, $jumlah_baru]);

            $db->prepare("
                INSERT INTO log_aktivitas
                    (user_id, cabang_id, bibit_id, tipe, jumlah, sisa, keterangan, transaksi_id)
                VALUES (?, ?, ?, 'tambah', ?, ?, ?, ?)
            ")->execute([
                $user_id, $trx['cabang_id'], $item['bibit_id'],
                $item['jumlah_stok'], $jumlah_baru,
                'Pembatalan nota #' . $trx['kode_nota'],
                $transaksi_id
            ]);
        }

        // ---- Update kode nota jadi BATAL- ----
        $db->prepare("
            UPDATE transaksi SET kode_nota = ?, catatan = ? WHERE id = ?
        ")->execute([
            'BATAL-' . $trx['kode_nota'],
            'DIBATALKAN oleh user #' . $user_id . ' pada ' . date('Y-m-d H:i:s'),
            $transaksi_id
        ]);

        $db->commit();
        return [
            'success' => true,
            'message' => 'Transaksi berhasil dibatalkan, stok telah dikembalikan' .
                ($trx['member_id'] ? ', stamp member telah disesuaikan' : '')
        ];

    } catch (Exception $e) {
        $db->rollBack();
        return ['success' => false, 'message' => $e->getMessage()];
    }
}
function getTransaksiByKode(string $kode): ?array {
    $db   = getDB();
    $stmt = $db->prepare("
        SELECT t.*, u.nama AS user_nama,
               c.nama AS cabang_nama, c.alamat AS cabang_alamat
        FROM transaksi t
        JOIN users  u ON t.user_id   = u.id
        JOIN cabang c ON t.cabang_id = c.id
        WHERE t.kode_nota = ?
    ");
    $stmt->execute([$kode]);
    $trx = $stmt->fetch();
    if (!$trx) return null;
    $stmt2 = $db->prepare("
        SELECT td.*, b.nama AS bibit_nama, b.satuan, b.satuan_dasar
        FROM transaksi_detail td
        JOIN bibit b ON td.bibit_id = b.id
        WHERE td.transaksi_id = ?
    ");
    $stmt2->execute([$trx['id']]);
    $trx['items'] = $stmt2->fetchAll();
    return $trx;
}

// ---- PAGINATION HELPER -----------------------------------

function buildPagination(int $total, int $page, int $per_page): array {
    $total_pages = max(1, (int)ceil($total / $per_page));
    return [
        'total'       => $total,
        'per_page'    => $per_page,
        'current'     => $page,
        'total_pages' => $total_pages,
        'has_prev'    => $page > 1,
        'has_next'    => $page < $total_pages,
        'from'        => $total > 0 ? ($page - 1) * $per_page + 1 : 0,
        'to'          => min($page * $per_page, $total),
    ];
}

// ---- LOG DENGAN PAGINATION --------------------------------

function getLogsPaginated(?int $cabang_id = null, ?string $tanggal = null, int $page = 1, int $per_page = 25, string $keyword = ''): array {
    $db     = getDB();
    $where  = [];
    $params = [];

    if ($cabang_id) { $where[] = "l.cabang_id = ?"; $params[] = $cabang_id; }
    if ($tanggal)   { $where[] = "DATE(l.created_at) = ?"; $params[] = $tanggal; }
    if ($keyword)   { $where[] = "(b.nama LIKE ? OR u.nama LIKE ? OR c.nama LIKE ?)"; $k = "%$keyword%"; $params[] = $k; $params[] = $k; $params[] = $k; }

    $whereSQL = $where ? "WHERE " . implode(" AND ", $where) : "";
    $baseSQL  = "FROM log_aktivitas l
        JOIN users  u ON l.user_id   = u.id
        JOIN cabang c ON l.cabang_id = c.id
        JOIN bibit  b ON l.bibit_id  = b.id
        $whereSQL";

    $stmtCount = $db->prepare("SELECT COUNT(*) $baseSQL");
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetchColumn();

    $stmtSum = $db->prepare("SELECT tipe, SUM(l.jumlah) AS jml $baseSQL GROUP BY tipe");
    $stmtSum->execute($params);
    $sums = $stmtSum->fetchAll();
    $total_kurang = 0; $total_tambah = 0;
    foreach ($sums as $s) {
        if ($s['tipe'] === 'kurang') $total_kurang = (float)$s['jml'];
        else                         $total_tambah = (float)$s['jml'];
    }

    $offset = ($page - 1) * $per_page;
    $sql = "SELECT l.*, u.nama AS user_nama, c.nama AS cabang_nama,
                   b.nama AS bibit_nama, b.satuan_dasar AS satuan
            $baseSQL
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?";
    $stmt = $db->prepare($sql);
    $stmt->execute(array_merge($params, [$per_page, $offset]));

    return [
        'logs'         => $stmt->fetchAll(),
        'total_kurang' => $total_kurang,
        'total_tambah' => $total_tambah,
        'pagination'   => buildPagination($total, $page, $per_page),
    ];
}

// ---- TRANSAKSI DENGAN PAGINATION -------------------------

function getTransaksiHarianPaginated(?int $cabang_id = null, ?string $tanggal = null, int $page = 1, int $per_page = 25): array {
    $db     = getDB();
    $where  = [];
    $params = [];

    if ($cabang_id) { $where[] = "t.cabang_id = ?"; $params[] = $cabang_id; }
    $tgl = $tanggal ?: date('Y-m-d');
    $where[] = "DATE(t.created_at) = ?"; $params[] = $tgl;

    $whereSQL = "WHERE " . implode(" AND ", $where);
    $baseSQL  = "FROM transaksi t
        JOIN users  u ON t.user_id   = u.id
        JOIN cabang c ON t.cabang_id = c.id
        $whereSQL";

    $stmtCount = $db->prepare("SELECT COUNT(*) $baseSQL");
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetchColumn();

    $stmtOmzet = $db->prepare("SELECT SUM(t.total) $baseSQL AND t.kode_nota NOT LIKE 'BATAL-%'");
    $stmtOmzet->execute($params);
    $total_omzet = (float)($stmtOmzet->fetchColumn() ?? 0);

    $offset = ($page - 1) * $per_page;
    $sql    = "SELECT t.*, u.nama AS user_nama, c.nama AS cabang_nama
               $baseSQL
               ORDER BY t.created_at DESC
               LIMIT ? OFFSET ?";
    $stmt = $db->prepare($sql);
    $stmt->execute(array_merge($params, [$per_page, $offset]));
    $transaksis = $stmt->fetchAll();

    foreach ($transaksis as &$trx) {
        $stmt2 = $db->prepare("SELECT td.*, b.nama AS bibit_nama, b.satuan, b.satuan_dasar
                                FROM transaksi_detail td
                                JOIN bibit b ON td.bibit_id = b.id
                                WHERE td.transaksi_id = ?");
        $stmt2->execute([$trx['id']]);
        $trx['items'] = $stmt2->fetchAll();
    }

    return [
        'transaksis'      => $transaksis,
        'total_omzet'     => $total_omzet,
        'total_transaksi' => $total,
        'pagination'      => buildPagination($total, $page, $per_page),
    ];
}

// ---- STOK DENGAN PAGINATION ------------------------------

function getAllStokPaginated(?int $cabang_id = null, int $page = 1, int $per_page = 25, string $keyword = ''): array {
    $db     = getDB();
    $where  = [];
    $params = [];

    if ($cabang_id) { $where[] = "s.cabang_id = ?"; $params[] = $cabang_id; }
    if ($keyword)   { $where[] = "b.nama LIKE ?"; $params[] = "%$keyword%"; }

    $whereSQL = $where ? "WHERE " . implode(" AND ", $where) : "";
    $baseSQL  = "FROM stok s
        JOIN cabang c ON s.cabang_id = c.id
        JOIN bibit  b ON s.bibit_id  = b.id
        $whereSQL";

    $stmtCount = $db->prepare("SELECT COUNT(*) $baseSQL");
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetchColumn();

    $offset = ($page - 1) * $per_page;
    $sql = "SELECT s.id, s.jumlah, s.updated_at,
                   c.id AS cabang_id, c.nama AS cabang_nama,
                   b.id AS bibit_id, b.nama AS bibit_nama,
                   b.satuan, b.satuan_dasar, b.konversi
            $baseSQL
            ORDER BY c.nama, b.nama
            LIMIT ? OFFSET ?";
    $stmt = $db->prepare($sql);
    $stmt->execute(array_merge($params, [$per_page, $offset]));

    return [
        'stok'       => $stmt->fetchAll(),
        'pagination' => buildPagination($total, $page, $per_page),
    ];
}
function simpanTransaksiDenganStamp(
    int $user_id,
    int $cabang_id,
    array $items,
    string $catatan = '',
    ?int $member_id = null,
    array $stamp_data = []
): array {
    $db = getDB();
    try {
        $db->beginTransaction();

        // --- Validasi stok ---
        foreach ($items as $item) {
            $bibit_id    = (int)$item['bibit_id'];
            $jumlah_stok = (float)$item['jumlah_stok'];
            $saat_ini    = getStokSaatIni($cabang_id, $bibit_id);
            if ($jumlah_stok > $saat_ini) {
                $bibit = getBibitById($bibit_id);
                throw new Exception("Stok {$bibit['nama']} tidak cukup. Sisa: {$saat_ini} {$bibit['satuan_dasar']}");
            }
        }

        // --- Simpan transaksi header ---
        $total     = array_sum(array_column($items, 'subtotal'));
        $kode_nota = generateKodeNota($cabang_id);

        $stmt = $db->prepare("
            INSERT INTO transaksi (kode_nota, user_id, cabang_id, total, catatan, member_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$kode_nota, $user_id, $cabang_id, $total, $catatan, $member_id]);
        $transaksi_id = (int)$db->lastInsertId();

        // --- Simpan detail item ---
        foreach ($items as $item) {
            $bibit_id    = (int)$item['bibit_id'];
            $satuan_jual = clean($item['satuan_jual']);
            $jumlah_jual = (float)$item['jumlah_jual'];
            $jumlah_stok = (float)$item['jumlah_stok'];
            $harga       = (float)$item['harga_satuan'];
            $subtotal    = (float)$item['subtotal'];
            $mix_group   = isset($item['mix_group']) ? (int)$item['mix_group'] : null;
            $stamp_counted = isset($item['stamp_counted']) && $item['stamp_counted'] ? 1 : 0;

// Ambil kategori bibit ini
$bibitInfo  = getBibitById($bibit_id);
$isAksesoris = ($bibitInfo['kategori'] ?? '') === 'aksesoris';

// Aksesoris tidak boleh single stamp
// Tapi kalau dalam mix group dengan bibit lain, ikut mix (stamp_group diset)
// tanpa menjadi stamp sendiri
if ($isAksesoris && !$mix_group) {
    // Aksesoris tanpa mix → paksa stamp_counted = 0
    $stamp_counted = 0;
}

// Safety net: kalau item punya mix_group dan mix_group itu
// ada item lain (non-aksesoris) yang stamp_counted = 1, ikut mix
if (!$stamp_counted && $mix_group) {
    foreach ($items as $otherItem) {
        $otherMix      = isset($otherItem['mix_group']) ? (int)$otherItem['mix_group'] : null;
        $otherStamped  = isset($otherItem['stamp_counted']) && $otherItem['stamp_counted'];
        $otherBibit    = getBibitById((int)$otherItem['bibit_id']);
        $otherAksesoris = ($otherBibit['kategori'] ?? '') === 'aksesoris';
        if ($otherMix === $mix_group && $otherStamped && !$otherAksesoris) {
            $stamp_counted = 1;
            break;
        }
    }
}

$stamp_group = ($stamp_counted && $mix_group) ? $mix_group : null;
            $stmt2 = $db->prepare("
                INSERT INTO transaksi_detail
                    (transaksi_id, bibit_id, satuan_jual, jumlah_jual, jumlah_stok,
                     harga_satuan, subtotal, mix_group, stamp_counted, stamp_group)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt2->execute([
                $transaksi_id, $bibit_id, $satuan_jual,
                $jumlah_jual, $jumlah_stok, $harga, $subtotal,
                $mix_group, $stamp_counted, $stamp_group,
            ]);

            // Kurangi stok
            $saat_ini    = getStokSaatIni($cabang_id, $bibit_id);
            $jumlah_baru = $saat_ini - $jumlah_stok;

            $stmt3 = $db->prepare("
                INSERT INTO stok (cabang_id, bibit_id, jumlah) VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE jumlah = ?
            ");
            $stmt3->execute([$cabang_id, $bibit_id, $jumlah_baru, $jumlah_baru]);

            $ket_log = "Penjualan #{$kode_nota}" . ($catatan ? " — {$catatan}" : "");
            $stmt4   = $db->prepare("
                INSERT INTO log_aktivitas
                    (user_id, cabang_id, bibit_id, tipe, jumlah, sisa, keterangan, transaksi_id)
                VALUES (?, ?, ?, 'kurang', ?, ?, ?, ?)
            ");
            $stmt4->execute([$user_id, $cabang_id, $bibit_id, $jumlah_stok, $jumlah_baru, $ket_log, $transaksi_id]);
        }

// --- Proses stamp (hanya kalau ada member & ada stamp_data) ---
$stamp_ditambahkan = 0;
$reward_baru       = 0;

if ($member_id && !empty($stamp_data)) {
    // Hitung nominal per stamp dari items
    // Buat map: bibit_id => subtotal, mix_group => total subtotal
    $singleNominalMap = [];
    $mixNominalMap    = [];

    foreach ($items as $item) {
        if (!isset($item['stamp_counted']) || !$item['stamp_counted']) continue;

        $bibit_id  = (int)$item['bibit_id'];
        $mix_group = isset($item['mix_group']) ? (int)$item['mix_group'] : null;
        $subtotal  = (float)$item['subtotal'];

        if ($mix_group) {
            if (!isset($mixNominalMap[$mix_group])) $mixNominalMap[$mix_group] = 0;
            $mixNominalMap[$mix_group] += $subtotal;
        } else {
            $singleNominalMap[$bibit_id] = $subtotal;
        }
    }

    // Ambil stamp_available sebelum update
    // Ambil total_stamp dan stamp_available sebelum update
$stmtBefore = $db->prepare("SELECT stamp_available, total_stamp FROM members WHERE id = ?");
$stmtBefore->execute([$member_id]);
$memberRow         = $stmtBefore->fetch();
$stamp_available_before = (int)$memberRow['stamp_available'];
$total_stamp_before     = (int)$memberRow['total_stamp'];

// Insert stamp satu per satu dengan nominalnya
$mixGroupSudahInsert = [];
$stmtLastKe = $db->prepare("
    SELECT COALESCE(MAX(stamp_ke), 0) FROM member_stamps WHERE member_id = ?
");
$stmtLastKe->execute([$member_id]);
$last_stamp_ke    = (int)$stmtLastKe->fetchColumn();
$current_stamp_ke = $last_stamp_ke;

foreach ($stamp_data as $sd) {
    $type      = $sd['type']      ?? 'single';
    $mix_group = isset($sd['mix_group']) ? (int)$sd['mix_group'] : null;
    $bibit_id  = isset($sd['bibit_id'])  ? (int)$sd['bibit_id']  : null;

    $current_stamp_ke++;

    if ($type === 'mix') {
        if (in_array($mix_group, $mixGroupSudahInsert)) {
            $current_stamp_ke--;
            continue;
        }
        $mixGroupSudahInsert[] = $mix_group;
        $nominal = (float)($mixNominalMap[$mix_group] ?? 0);

        $stmtS = $db->prepare("
            INSERT INTO member_stamps
                (member_id, stamp_ke, transaksi_id, cabang_id, jumlah_stamp, stamp_type, mix_group, nominal)
            VALUES (?, ?, ?, ?, 1, 'mix', ?, ?)
        ");
        $stmtS->execute([$member_id, $current_stamp_ke, $transaksi_id, $cabang_id, $mix_group, $nominal]);
    } else {
        $nominal = (float)($singleNominalMap[$bibit_id] ?? 0);

        $stmtS = $db->prepare("
            INSERT INTO member_stamps
                (member_id, stamp_ke, transaksi_id, cabang_id, jumlah_stamp, stamp_type, bibit_id, nominal)
            VALUES (?, ?, ?, ?, 1, 'single', ?, ?)
        ");
        $stmtS->execute([$member_id, $current_stamp_ke, $transaksi_id, $cabang_id, $bibit_id, $nominal]);
    }
    $stamp_ditambahkan++;
}

if ($stamp_ditambahkan > 0) {
    // Update total_stamp & stamp_available
    $stmtU = $db->prepare("
        UPDATE members
        SET total_stamp     = total_stamp + ?,
            stamp_available = stamp_available + ?
        WHERE id = ?
    ");
    $stmtU->execute([$stamp_ditambahkan, $stamp_ditambahkan, $member_id]);

    // Gunakan total_stamp sebagai basis (tidak pernah berkurang)
    $total_stamp_after = $total_stamp_before + $stamp_ditambahkan;

    // Hitung reward baru berdasarkan total_stamp (bukan stamp_available)
    $reward_baru = (int)floor($total_stamp_after / 10) - (int)floor($total_stamp_before / 10);

    for ($r = 0; $r < $reward_baru; $r++) {
        // Reward ke berapa secara global
        $reward_ke    = (int)floor($total_stamp_before / 10) + $r + 1;
        $offset_stamp = ($reward_ke - 1) * 10;

        // Cek apakah reward ke ini sudah pernah dibuat
        $stmtCekReward = $db->prepare("
            SELECT COUNT(*) FROM member_rewards
            WHERE member_id = ? AND stamp_snapshot = ?
        ");
        $stmtCekReward->execute([$member_id, $reward_ke * 10]);
        if ((int)$stmtCekReward->fetchColumn() > 0) continue; // skip kalau sudah ada

        $stmtNominal = $db->prepare("
            SELECT SUM(nominal) AS total_nominal
            FROM (
                SELECT nominal
                FROM member_stamps
                WHERE member_id = ?
                ORDER BY stamp_ke ASC
                LIMIT 10 OFFSET ?
            ) AS stamp_batch
        ");
        $stmtNominal->execute([$member_id, $offset_stamp]);
        $nominalData   = $stmtNominal->fetch();
        $total_nominal = (float)($nominalData['total_nominal'] ?? 0);
        $rata_nominal  = $total_nominal > 0 ? round($total_nominal / 10) : 0;

        $stmtR = $db->prepare("
            INSERT INTO member_rewards
                (member_id, stamp_snapshot, total_nominal, rata_nominal,
                 reward_type, status, issued_by, cabang_issued)
            VALUES (?, ?, ?, ?, 'bibit_bebas', 'pending', ?, ?)
        ");
        $stmtR->execute([
            $member_id,
            $reward_ke * 10,
            $total_nominal,
            $rata_nominal,
            $user_id,
            $cabang_id,
        ]);
    }
}
}

$db->commit();
return [
    'success'           => true,
    'transaksi_id'      => $transaksi_id,
    'kode_nota'         => $kode_nota,
    'total'             => $total,
    'stamp_ditambahkan' => $stamp_ditambahkan,
    'reward_baru'       => $reward_baru,
];
} catch (Exception $e) {
        $db->rollBack();
        return ['success' => false, 'message' => $e->getMessage()];
    }
}

function simpanRewardTransaksi(
    int $user_id,
    int $cabang_id,
    int $member_id,
    int $reward_id,
    array $items
): array {
    $db = getDB();
    try {
        $db->beginTransaction();

        // Validasi reward
        $stmtR = $db->prepare("SELECT * FROM member_rewards WHERE id = ? AND status = 'pending'");
        $stmtR->execute([$reward_id]);
        $reward = $stmtR->fetch();
        if (!$reward) throw new Exception('Reward tidak ditemukan atau sudah ditukar');
        if ($reward['member_id'] !== $member_id) throw new Exception('Reward tidak sesuai member');

        // Validasi & cek stok tiap item
        foreach ($items as $item) {
            $bibit_id    = (int)$item['bibit_id'];
            $jumlah_stok = (float)$item['jumlah_stok'];
            $saat_ini    = getStokSaatIni($cabang_id, $bibit_id);
            if ($jumlah_stok > $saat_ini) {
                $bibit = getBibitById($bibit_id);
                throw new Exception("Stok {$bibit['nama']} tidak cukup. Sisa: {$saat_ini} {$bibit['satuan_dasar']}");
            }
        }

        // Generate kode nota reward
        $kode_nota = 'REWARD-' . date('Ymd') . '-' . $member_id . '-' . $reward_id;

        // Simpan transaksi dengan total 0
        $stmt = $db->prepare("
            INSERT INTO transaksi (kode_nota, user_id, cabang_id, total, catatan, member_id)
            VALUES (?, ?, ?, 0, ?, ?)
        ");
        $stmt->execute([
            $kode_nota,
            $user_id,
            $cabang_id,
            'Reward member — reward_id #' . $reward_id,
            $member_id
        ]);
        $transaksi_id = (int)$db->lastInsertId();

        // Simpan detail item & kurangi stok
        foreach ($items as $item) {
            $bibit_id    = (int)$item['bibit_id'];
            $satuan_jual = clean($item['satuan_jual']);
            $jumlah_jual = (float)$item['jumlah_jual'];
            $jumlah_stok = (float)$item['jumlah_stok'];
            $harga       = 0; // reward = gratis
            $subtotal    = 0;
            $mix_group   = null;

            $stmt2 = $db->prepare("
                INSERT INTO transaksi_detail
                    (transaksi_id, bibit_id, satuan_jual, jumlah_jual, jumlah_stok,
                     harga_satuan, subtotal, mix_group, stamp_counted, stamp_group)
                VALUES (?, ?, ?, ?, ?, 0, 0, NULL, 0, NULL)
            ");
            $stmt2->execute([
                $transaksi_id, $bibit_id, $satuan_jual,
                $jumlah_jual, $jumlah_stok
            ]);

            // Kurangi stok
            $saat_ini    = getStokSaatIni($cabang_id, $bibit_id);
            $jumlah_baru = $saat_ini - $jumlah_stok;

            $stmt3 = $db->prepare("
                INSERT INTO stok (cabang_id, bibit_id, jumlah) VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE jumlah = ?
            ");
            $stmt3->execute([$cabang_id, $bibit_id, $jumlah_baru, $jumlah_baru]);

            $stmt4 = $db->prepare("
                INSERT INTO log_aktivitas
                    (user_id, cabang_id, bibit_id, tipe, jumlah, sisa, keterangan, transaksi_id)
                VALUES (?, ?, ?, 'kurang', ?, ?, ?, ?)
            ");
            $stmt4->execute([
                $user_id, $cabang_id, $bibit_id,
                $jumlah_stok, $jumlah_baru,
                'Reward member #' . $member_id . ' — ' . $kode_nota,
                $transaksi_id
            ]);
        }

    
// Update reward jadi redeemed
        $bibit_id_reward = (int)($items[0]['bibit_id'] ?? 0);
        $stmtU = $db->prepare("
            UPDATE member_rewards
            SET status          = 'redeemed',
                bibit_id        = ?,
                redeemed_by     = ?,
                cabang_redeemed = ?,
                redeemed_at     = NOW(),
                catatan         = ?
            WHERE id = ?
        ");
        $stmtU->execute([
            $bibit_id_reward,
            $user_id,
            $cabang_id,
            'Transaksi: ' . $kode_nota,
            $reward_id
        ]);

        // Kurangi stamp_available member sebesar 10
        $stmtM = $db->prepare("
            UPDATE members
            SET stamp_available = GREATEST(stamp_available - 10, 0)
            WHERE id = ?
        ");
        $stmtM->execute([$member_id]);

        $db->commit();
        return [
            'success'      => true,
            'transaksi_id' => $transaksi_id,
            'kode_nota'    => $kode_nota,
            'message'      => 'Reward berhasil diberikan',
        ];
    } catch (Exception $e) {
        $db->rollBack();
        return ['success' => false, 'message' => $e->getMessage()];
    }
}

