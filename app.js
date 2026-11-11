// ============================================================
// APP.JS — Logika Utama Aplikasi
// ============================================================
import { sb, signIn, signOut, onAuthChange, selectView, callRpc, escapeHtml, angka, rupiah, todayISO } from './supabase-client.js';

// Elemen DOM
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const btnLogout = document.getElementById('btn-logout');
const userDisplay = document.getElementById('user-display');
const pageTitle = document.getElementById('page-title');
const pageContent = document.getElementById('page-content');
const menuItems = document.querySelectorAll('.menu-item');

let currentUser = null;
let masterBarangCache = [];

// ============================================================
// 1. AUTENTIKASI
// ============================================================
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginBtn.disabled = true; loginBtn.textContent = 'Memproses...';
  loginError.style.display = 'none';
  try {
    await signIn(document.getElementById('login-email').value, document.getElementById('login-password').value);
  } catch (err) {
    loginError.textContent = err.message; loginError.style.display = 'block';
    loginBtn.disabled = false; loginBtn.textContent = 'Masuk';
  }
});

btnLogout.addEventListener('click', async () => {
  if (confirm('Yakin ingin keluar?')) await signOut();
});

onAuthChange((event, session) => {
  if (session) {
    currentUser = session.user;
    loginScreen.style.display = 'none'; appScreen.classList.add('show');
    userDisplay.textContent = `👤 ${currentUser.email}`;
    navigateTo('stok');
  } else {
    currentUser = null;
    appScreen.classList.remove('show'); loginScreen.style.display = 'flex';
    loginBtn.disabled = false; loginBtn.textContent = 'Masuk'; loginForm.reset();
  }
});

// ============================================================
// 2. NAVIGASI
// ============================================================
const tabMap = {
  stok: { title: 'Stok Saat Ini', render: renderStokPanel },
  masterbarang: { title: 'Master Barang', render: renderMasterPanel },
  parlevel: { title: 'Par Level', render: renderParLevelPanel },
  masuk: { title: 'Barang Masuk', render: renderMasukPanel },
  mutasi: { title: 'Mutasi', render: renderMutasiPanel },
  keluar: { title: 'Pengeluaran', render: renderKeluarPanel },
  penyesuaian: { title: 'Penyesuaian', render: renderPenyesuaianPanel },
  approval: { title: 'Approval', render: renderApprovalPanel },
  notifikasi: { title: 'Konsinyasi', render: renderNotifikasiPanel },
  opname: { title: 'Laporan Opname', render: renderOpnamePanel },
  pemakaian: { title: 'Lap. Pemakaian', render: renderPemakaianPanel },
  kartustok: { title: 'Kartu Stok', render: renderKartuStokPanel },
};

menuItems.forEach(item => item.addEventListener('click', () => navigateTo(item.dataset.tab)));

function navigateTo(tab) {
  menuItems.forEach(m => m.classList.toggle('active', m.dataset.tab === tab));
  const config = tabMap[tab];
  if (config) {
    pageTitle.textContent = config.title;
    pageContent.innerHTML = '<div class="empty">Memuat data...</div>';
    config.render();
  }
}

// ============================================================
// 3. PANEL STOK SAAT INI
// ============================================================
async function renderStokPanel() {
  try {
    const stok = await selectView('v_stok_saat_ini', { order: { column: 'nama_barang' } });
    if (stok.length === 0) {
      pageContent.innerHTML = '<div class="card"><div class="empty">Belum ada stok di gudang.</div></div>';
      return;
    }
    let html = `<div class="card"><h3>Stok Plate & Screw</h3><div class="table-wrap"><table>
      <thead><tr><th>Kode</th><th>Nama Barang</th><th>Gudang</th><th>Status</th><th class="num">Jumlah</th></tr></thead><tbody>`;
    stok.forEach(r => {
      html += `<tr>
        <td><strong>${escapeHtml(r.kode_barang)}</strong></td>
        <td>${escapeHtml(r.nama_barang)}</td>
        <td>${escapeHtml(r.gudang)}</td>
        <td>${r.status_kepemilikan === 'konsinyasi' ? '<span class="badge warn">Konsinyasi</span>' : 'Milik RS'}</td>
        <td class="num">${angka(r.jumlah)}</td>
      </tr>`;
    });
    html += `</tbody></table></div></div>`;
    pageContent.innerHTML = html;
  } catch (err) {
    pageContent.innerHTML = `<div class="card"><div class="msg show err">Gagal: ${err.message}</div></div>`;
  }
}

// ============================================================
// 4. PANEL MASTER BARANG (REVISI: +Status, +Import CSV)
// ============================================================
async function renderMasterPanel() {
  try {
    const kategori = await selectView('kategori_barang');
    const master = await selectView('master_barang', { order: { column: 'kode_barang' } });
    const vendor = await selectView('vendor');
    masterBarangCache = master;

    let optKategori = kategori.map(k => `<option value="${k.prefix}">${k.nama} (${k.prefix})</option>`).join('');
    let optVendor = vendor.map(v => `<option value="${v.id}">${v.nama}</option>`).join('');

    pageContent.innerHTML = `
      <div class="card">
        <h3>Tambah Barang Baru</h3>
        <form id="form-master">
          <div class="field-grid">
            <div class="field"><label>Kategori *</label><select name="prefix" required><option value="">- Pilih -</option>${optKategori}</select></div>
            <div class="field"><label>Nama Barang *</label><input type="text" name="nama_barang" required placeholder="Plate Reconstruction 4.5mm"></div>
            <div class="field"><label>Satuan *</label><input type="text" name="satuan" value="pcs" required></div>
            <div class="field"><label>Harga Terakhir (Rp) *</label><input type="number" name="harga_terakhir" min="0" required value="0"></div>
            <div class="field">
              <label>Status Kepemilikan *</label>
              <select name="status_kepemilikan" id="master-status" required>
                <option value="milik_rs">Milik RS</option>
                <option value="konsinyasi">Konsinyasi</option>
              </select>
            </div>
            <div class="field">
              <label>Vendor (Khusus Konsinyasi)</label>
              <select name="vendor_id" id="master-vendor" disabled>
                <option value="">- Tanpa Vendor -</option>${optVendor}
              </select>
            </div>
          </div>
          <button class="btn" type="submit" style="margin-top:16px;" id="btn-simpan-master">Simpan Barang</button>
          <div class="msg" id="msg-master"></div>
        </form>
      </div>

      <div class="card" style="border: 2px dashed var(--primary-light); background: #f8fbfa;">
        <h3>📤 Import Barang (Copy-Paste dari Excel)</h3>
        <div class="sub">Format kolom: <strong>Kategori (PL/SC/XX), Nama Barang, Satuan, Harga, Status (milik_rs/konsinyasi)</strong></div>
        <textarea id="excel-paste" rows="5" style="width:100%; padding:10px; font-family:monospace; border:1px solid var(--border); border-radius:6px; margin-bottom:12px;" placeholder="PL&#9;Plate Mini 2.0mm&#9;pcs&#9;250000&#9;milik_rs&#10;SC&#9;Screw 2.0mm&#9;pcs&#9;45000&#9;konsinyasi"></textarea>
        <button class="btn" id="btn-import-excel">Proses Import</button>
        <div class="msg" id="msg-excel"></div>
      </div>

      <div class="card">
        <h3>Daftar Barang</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Kode</th><th>Nama Barang</th><th>Kategori</th><th>Status</th><th>Vendor</th><th class="num">Harga</th></tr></thead><tbody>
          ${master.length === 0 ? '<tr><td colspan="6" class="empty">Belum ada data.</td></tr>' : ''}
          ${master.map(b => {
            const vnd = vendor.find(v => v.id === b.vendor_id);
            return `<tr>
              <td><strong>${escapeHtml(b.kode_barang)}</strong></td>
              <td>${escapeHtml(b.nama_barang)}</td>
              <td>${escapeHtml(b.prefix)}</td>
              <td>${b.status_kepemilikan === 'konsinyasi' ? '<span class="badge warn">Konsinyasi</span>' : 'Milik RS'}</td>
              <td>${vnd ? escapeHtml(vnd.nama) : '-'}</td>
              <td class="num">${rupiah(b.harga_terakhir)}</td>
            </tr>`;
          }).join('')}
        </tbody></table></div>
      </div>
    `;

    // Logika Dropdown Vendor di Form Manual
    const selStatus = document.getElementById('master-status');
    const selVendor = document.getElementById('master-vendor');
    selStatus.addEventListener('change', (e) => {
      if (e.target.value === 'milik_rs') { selVendor.value = ''; selVendor.disabled = true; } 
      else { selVendor.disabled = false; }
    });

    // Submit Form Manual
    document.getElementById('form-master').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-simpan-master'); btn.disabled = true; btn.textContent = 'Menyimpan...';
      const msg = document.getElementById('msg-master'); msg.className = 'msg';
      const form = e.target;
      try {
        const kodeBaru = await callRpc('rpc_generate_kode', { p_prefix: form.prefix.value });
        const { error } = await sb.from('master_barang').insert({
          kode_barang: kodeBaru, prefix: form.prefix.value,
          nama_barang: form.nama_barang.value.trim(), satuan: form.satuan.value.trim(),
          harga_terakhir: Number(form.harga_terakhir.value),
          status_kepemilikan: form.status_kepemilikan.value,
          vendor_id: form.vendor_id.value || null
        });
        if (error) throw new Error(error.message);
        msg.textContent = `✅ Berhasil! Kode: ${kodeBaru}`; msg.className = 'msg show ok';
        setTimeout(() => renderMasterPanel(), 1000);
      } catch (err) {
        msg.textContent = '❌ ' + err.message; msg.className = 'msg show err';
        btn.disabled = false; btn.textContent = 'Simpan Barang';
      }
    });

    // Submit Fitur Import Excel
    document.getElementById('btn-import-excel').addEventListener('click', async () => {
      const raw = document.getElementById('excel-paste').value.trim();
      if (!raw) return alert('Tempelkan data Excel terlebih dahulu.');
      
      const btn = document.getElementById('btn-import-excel'); btn.disabled = true; btn.textContent = 'Memproses...';
      const msg = document.getElementById('msg-excel'); msg.className = 'msg';
      
      // Pisahkan berdasarkan baris baru
      const rows = raw.split('\n');
      let success = 0; let failed = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i].trim();
        if (!row) continue;

        // Excel memisahkan kolom dengan Tab (\t)
        const cols = row.split('\t');
        if (cols.length < 4) { failed++; continue; }

        const prefix = cols[0].trim().toUpperCase();
        const nama = cols[1].trim();
        const satuan = cols[2].trim() || 'pcs';
        const harga = Number(cols[3].trim()) || 0;
        const status = (cols[4] ? cols[4].trim().toLowerCase() : 'milik_rs') === 'konsinyasi' ? 'konsinyasi' : 'milik_rs';

        try {
          // Generate Kode otomatis
          const kodeBaru = await callRpc('rpc_generate_kode', { p_prefix: prefix });
          
          // Insert ke database
          const { error } = await sb.from('master_barang').insert({
            kode_barang: kodeBaru, prefix: prefix, nama_barang: nama, satuan: satuan,
            harga_terakhir: harga, status_kepemilikan: status, vendor_id: null
          });
          
          if (error) throw new Error();
          success++;
        } catch (err) {
          failed++;
        }
      }

      msg.textContent = `✅ ${success} berhasil di-import. ❌ ${failed} gagal.`;
      msg.className = `msg show ${failed === 0 ? 'ok' : 'warn'}`;
      
      if (success > 0) {
        document.getElementById('excel-paste').value = '';
        setTimeout(() => renderMasterPanel(), 2000);
      }
      
      btn.disabled = false; btn.textContent = 'Proses Import';
    });

  } catch (err) {
    pageContent.innerHTML = `<div class="card"><div class="msg show err">Gagal: ${err.message}</div></div>`;
  }
}

// ============================================================
// 5. PANEL PAR LEVEL
// ============================================================
async function renderParLevelPanel() {
  try {
    const gudang = await selectView('gudang');
    const vendor = await selectView('vendor');
    const master = await selectView('master_barang', { eq: { aktif: true }, order: { column: 'nama_barang' } });
    const parLevel = await selectView('par_level');

    let optGudang = gudang.map(g => `<option value="${g.id}">${g.nama}</option>`).join('');
    let optVendor = vendor.map(v => `<option value="${v.id}">${v.nama}</option>`).join('');
    let optBarang = master.map(m => `<option value="${m.kode_barang}">${m.kode_barang} - ${m.nama_barang}</option>`).join('');

    pageContent.innerHTML = `
      <div class="card">
        <h3>Setel Par Level</h3>
        <form id="form-par">
          <div class="field-grid">
            <div class="field"><label>Barang *</label><select name="barang_id" required><option value="">- Pilih -</option>${optBarang}</select></div>
            <div class="field"><label>Gudang *</label><select name="gudang_id" required>${optGudang}</select></div>
            <div class="field"><label>Status *</label><select name="status" required><option value="milik_rs">Milik RS</option><option value="konsinyasi">Konsinyasi</option></select></div>
            <div class="field"><label>Vendor (Konsinyasi)</label><select name="vendor_id"><option value="">- Tanpa Vendor -</option>${optVendor}</select></div>
            <div class="field"><label>Jumlah Standar *</label><input type="number" name="jumlah_standar" min="0" required value="1"></div>
          </div>
          <button class="btn" type="submit" style="margin-top:16px;" id="btn-simpan-par">Simpan</button>
          <div class="msg" id="msg-par"></div>
        </form>
      </div>
      <div class="card">
        <h3>Daftar Par Level</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Barang</th><th>Gudang</th><th>Status</th><th>Vendor</th><th class="num">Standar</th></tr></thead><tbody>
          ${parLevel.length === 0 ? '<tr><td colspan="5" class="empty">Belum ada data.</td></tr>' : ''}
          ${parLevel.map(p => {
            const brg = master.find(m => m.id === p.barang_id);
            const gdg = gudang.find(g => g.id === p.gudang_id);
            const vnd = vendor.find(v => v.id === p.vendor_id);
            return `<tr>
              <td>${brg ? escapeHtml(brg.nama_barang) : '-'}</td>
              <td>${gdg ? escapeHtml(gdg.nama) : '-'}</td>
              <td>${p.status_kepemilikan === 'konsinyasi' ? '<span class="badge warn">Konsinyasi</span>' : 'Milik RS'}</td>
              <td>${vnd ? escapeHtml(vnd.nama) : '-'}</td>
              <td class="num">${angka(p.jumlah_standar)}</td>
            </tr>`;
          }).join('')}
        </tbody></table></div>
      </div>
    `;

    const selStatus = document.querySelector('#form-par [name="status"]');
    const selVendor = document.querySelector('#form-par [name="vendor_id"]');
    selStatus.addEventListener('change', (e) => {
      if (e.target.value === 'milik_rs') { selVendor.value = ''; selVendor.disabled = true; } 
      else { selVendor.disabled = false; }
    });

    document.getElementById('form-par').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-simpan-par'); btn.disabled = true; btn.textContent = 'Menyimpan...';
      const msg = document.getElementById('msg-par'); msg.className = 'msg';
      const form = e.target;
      const brg = master.find(m => m.kode_barang === form.barang_id.value);
      if(!brg) return;

      try {
        const { error } = await sb.from('par_level').insert({
          barang_id: brg.id, gudang_id: form.gudang_id.value,
          status_kepemilikan: form.status.value, vendor_id: form.vendor_id.value || null,
          jumlah_standar: Number(form.jumlah_standar.value)
        });
        if (error) throw new Error(error.message);
        msg.textContent = '✅ Par level disimpan.'; msg.className = 'msg show ok';
        setTimeout(() => renderParLevelPanel(), 1500);
      } catch (err) {
        msg.textContent = '❌ ' + err.message; msg.className = 'msg show err';
        btn.disabled = false; btn.textContent = 'Simpan';
      }
    });
  } catch (err) {
    pageContent.innerHTML = `<div class="card"><div class="msg show err">Gagal: ${err.message}</div></div>`;
  }
}

// ============================================================
// 6. PANEL BARANG MASUK (REVISI: +Riwayat, Edit, Hapus)
// ============================================================
async function renderMasukPanel() {
  try {
    const master = await selectView('master_barang', { eq: { aktif: true }, order: { column: 'nama_barang' } });
    const vendor = await selectView('vendor', { order: { column: 'nama' } });
    
    let optBarang = master.map(m => `<option value="${m.kode_barang}">${m.kode_barang} - ${m.nama_barang}</option>`).join('');
    let optVendor = vendor.map(v => `<option value="${v.nama}">${v.nama}</option>`).join('');

    // Ambil riwayat barang masuk (jenis='masuk')
    const riwayat = await selectView('v_kartu_stok', { eq: { jenis: 'masuk' }, order: { column: 'created_at', ascending: false }, limit: 50 });

    pageContent.innerHTML = `
      <div class="card">
        <h3>Penerimaan Barang Masuk</h3>
        <div class="sub">Catat barang yang datang dari distributor ke Gudang Farmasi.</div>
        <form id="form-masuk">
          <div class="field-grid">
            <div class="field"><label>Tanggal *</label><input type="date" name="tanggal" id="masuk-tgl" required></div>
            <div class="field"><label>Pilih Barang *</label><select name="kode_barang" required><option value="">- Pilih -</option>${optBarang}</select></div>
            <div class="field"><label>Jumlah *</label><input type="number" name="jumlah" min="1" required></div>
            <div class="field"><label>Harga Satuan (Rp) *</label><input type="number" name="harga" min="0" required></div>
            <div class="field"><label>Vendor (Ketik/Pilih)</label><input type="text" name="vendor" list="list-vendor" placeholder="Nama PT..."><datalist id="list-vendor">${optVendor}</datalist></div>
            <div class="field"><label>No. Batch (Opsional)</label><input type="text" name="no_batch" placeholder="-"></div>
          </div>
          <button class="btn" type="submit" style="margin-top:16px;" id="btn-masuk">Simpan Penerimaan</button>
          <div class="msg" id="msg-masuk"></div>
        </form>
      </div>

      <div class="card">
        <h3>Riwayat Barang Masuk (50 Transaksi Terakhir)</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Tanggal</th><th>Nama Barang</th><th class="num">Jumlah</th><th class="num">Harga</th><th>Vendor</th><th>Aksi</th></tr></thead><tbody>
          ${riwayat.length === 0 ? '<tr><td colspan="6" class="empty">Belum ada riwayat barang masuk.</td></tr>' : ''}
          ${riwayat.map(r => `<tr>
            <td>${new Date(r.tanggal).toLocaleDateString('id-ID')}</td>
            <td>${escapeHtml(r.nama_barang)}</td>
            <td class="num">${angka(r.qty)}</td>
            <td class="num">${rupiah(r.harga_satuan || 0)}</td>
            <td>${escapeHtml(r.vendor || '-')}</td>
            <td>
              <button class="btn secondary btn-edit-masuk" data-id="${r.id}" data-jml="${r.qty}" data-hrg="${r.harga_satuan}" data-tgl="${r.tanggal}" style="padding:4px 10px;font-size:11px;margin-right:4px;">Edit</button>
              <button class="btn secondary btn-hapus-masuk" data-id="${r.id}" style="padding:4px 10px;font-size:11px;background:#fbeae8;color:var(--danger);">Hapus</button>
            </td>
          </tr>`).join('')}
        </tbody></table></div>
      </div>
    `;

    document.getElementById('masuk-tgl').value = todayISO();

    // 1. Submit Form
    document.getElementById('form-masuk').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-masuk'); btn.disabled = true; btn.textContent = 'Menyimpan...';
      const msg = document.getElementById('msg-masuk'); msg.className = 'msg';
      const form = e.target;

      try {
        await callRpc('rpc_barang_masuk', {
          p_tanggal: form.tanggal.value, p_kode_barang: form.kode_barang.value,
          p_jumlah: Number(form.jumlah.value), p_harga: Number(form.harga.value),
          p_vendor: form.vendor.value.trim() || null, p_no_batch: form.no_batch.value.trim() || '-',
          p_keterangan: null
        });
        msg.textContent = '✅ Barang masuk berhasil dicatat.'; msg.className = 'msg show ok';
        setTimeout(() => renderMasukPanel(), 1000); // Refresh tabel
      } catch (err) {
        msg.textContent = '❌ ' + err.message; msg.className = 'msg show err';
        btn.disabled = false; btn.textContent = 'Simpan Penerimaan';
      }
    });

    // 2. Fitur Hapus
    document.querySelectorAll('.btn-hapus-masuk').forEach(btn => {
      btn.addEventListener('click', async function() {
        if (!confirm('Yakin ingin menghapus transaksi ini? Stok akan dikembalikan (dikurangi).')) return;
        this.disabled = true; this.textContent = '...';
        try {
          await callRpc('rpc_hapus_transaksi', { p_transaksi_id: this.dataset.id });
          renderMasukPanel();
        } catch (err) { alert(err.message); this.disabled = false; this.textContent = 'Hapus'; }
      });
    });

    // 3. Fitur Edit
    document.querySelectorAll('.btn-edit-masuk').forEach(btn => {
      btn.addEventListener('click', async function() {
        const tgl = prompt("Edit Tanggal (YYYY-MM-DD):", this.dataset.tgl);
        if (!tgl) return;
        const jml = prompt("Edit Jumlah:", this.dataset.jml);
        if (!jml || isNaN(jml)) return;
        const hrg = prompt("Edit Harga Satuan:", this.dataset.hrg);
        if (!hrg || isNaN(hrg)) return;

        this.disabled = true; this.textContent = '...';
        try {
          await callRpc('rpc_edit_barang_masuk', { 
            p_transaksi_id: this.dataset.id, 
            p_tanggal: tgl, 
            p_jumlah: Number(jml), 
            p_harga: Number(hrg) 
          });
          renderMasukPanel();
        } catch (err) { alert(err.message); this.disabled = false; this.textContent = 'Edit'; }
      });
    });

  } catch (err) {
    pageContent.innerHTML = `<div class="card"><div class="msg show err">Gagal: ${err.message}</div></div>`;
  }
}

// ============================================================
// 7. PANEL MUTASI (Dari Farmasi ke IBS)
// ============================================================
async function renderMutasiPanel() {
  try {
    const master = await selectView('master_barang', { eq: { aktif: true }, order: { column: 'nama_barang' } });
    const gudang = await selectView('gudang');
    const vendor = await selectView('vendor');
    
    let optBarang = master.map(m => `<option value="${m.kode_barang}">${m.kode_barang} - ${m.nama_barang}</option>`).join('');
    let optGudang = gudang.map(g => `<option value="${g.id}">${g.nama} (${g.tipe})</option>`).join('');
    let optVendor = vendor.map(v => `<option value="${v.id}">${v.nama}</option>`).join('');
    
    let gPusat = gudang.find(g => g.tipe === 'pusat')?.id || '';
    let gUnit = gudang.find(g => g.tipe === 'unit')?.id || '';

    pageContent.innerHTML = `
      <div class="card">
        <h3>Mutasi Barang</h3>
        <div class="sub">Pindahkan stok dari Gudang Farmasi ke Ruang Farmasi IBS.</div>
        <form id="form-mutasi">
          <div class="field-grid">
            <div class="field"><label>Tanggal *</label><input type="date" name="tanggal" id="mutasi-tgl" required></div>
            <div class="field"><label>Pilih Barang *</label><select name="kode_barang" required><option value="">- Pilih -</option>${optBarang}</select></div>
            <div class="field"><label>Jumlah *</label><input type="number" name="jumlah" min="1" required></div>
            <div class="field"><label>Dari Gudang *</label><select name="dari_gudang" required>${optGudang}</select></div>
            <div class="field"><label>Ke Gudang *</label><select name="ke_gudang" required>${optGudang}</select></div>
            <div class="field">
              <label>Status Kepemilikan *</label>
              <select name="status" required>
                <option value="milik_rs">Milik RS</option>
                <option value="konsinyasi">Konsinyasi</option>
              </select>
            </div>
            <div class="field"><label>Vendor (Konsinyasi)</label><select name="vendor_id"><option value="">- Tanpa Vendor -</option>${optVendor}</select></div>
          </div>
          <button class="btn" type="submit" style="margin-top:16px;" id="btn-mutasi">Proses Mutasi</button>
          <div class="msg" id="msg-mutasi"></div>
        </form>
      </div>
    `;

    document.getElementById('mutasi-tgl').value = todayISO();
    const f = document.getElementById('form-mutasi');
    if (gPusat) f.dari_gudang.value = gPusat;
    if (gUnit) f.ke_gudang.value = gUnit;

    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-mutasi'); btn.disabled = true; btn.textContent = 'Memproses...';
      const msg = document.getElementById('msg-mutasi'); msg.className = 'msg';

      try {
        await callRpc('rpc_mutasi', {
          p_tanggal: f.tanggal.value, p_kode_barang: f.kode_barang.value,
          p_jumlah: Number(f.jumlah.value), p_dari_gudang: f.dari_gudang.value,
          p_ke_gudang: f.ke_gudang.value, p_status: f.status.value,
          p_vendor_id: f.vendor_id.value || null, p_no_batch: '-', p_keterangan: null
        });
        msg.textContent = '✅ Mutasi berhasil diproses. Stok di IBS bertambah.'; msg.className = 'msg show ok';
        f.reset(); document.getElementById('mutasi-tgl').value = todayISO();
        if (gPusat) f.dari_gudang.value = gPusat; if (gUnit) f.ke_gudang.value = gUnit;
      } catch (err) {
        msg.textContent = '❌ ' + err.message; msg.className = 'msg show err';
      } finally {
        btn.disabled = false; btn.textContent = 'Proses Mutasi';
      }
    });
  } catch (err) {
    pageContent.innerHTML = `<div class="card"><div class="msg show err">Gagal: ${err.message}</div></div>`;
  }
}

// ============================================================
// 8. PANEL PENGELUARAN (Untuk Pasien)
// ============================================================
async function renderKeluarPanel() {
  try {
    const stokIBS = await selectView('v_stok_saat_ini', { order: { column: 'nama_barang' } });
    const gudangUnit = await selectView('gudang', { eq: { tipe: 'unit' } });
    const gudangIBS = gudangUnit.length > 0 ? gudangUnit[0].id : null;
    
    // Filter hanya stok yang ada di gudang IBS
    const stokTersedia = stokIBS.filter(s => s.gudang_id === gudangIBS);

    let optStok = stokTersedia.map(s => `
      <option value="${s.barang_id}|${s.batch_id}|${s.kode_barang}">
        ${s.nama_barang} (Tersedia: ${s.jumlah} - Batch: ${s.no_batch})
      </option>
    `).join('');

    pageContent.innerHTML = `
      <div class="card">
        <h3>Pengeluaran Barang (Pasien)</h3>
        <div class="sub">Catat pemakaian Plate/Screw untuk tindakan operasi.</div>
        <form id="form-keluar">
          <div class="field-grid">
            <div class="field"><label>Tanggal Pakai *</label><input type="date" name="tanggal" id="keluar-tgl" required></div>
            <div class="field full">
              <label>Pilih Batch Barang (IBS) *</label>
              <select name="batch_info" required>
                <option value="">- Pilih Barang & Batch -</option>
                ${optStok}
              </select>
            </div>
            <div class="field"><label>Jumlah Dipakai *</label><input type="number" name="jumlah" min="1" required></div>
            
            <div class="field full" style="border-top:1px dashed var(--border); padding-top:14px; margin-top:8px;">
              <label style="font-weight:700;color:var(--primary);">Data Pasien</label>
            </div>
            <div class="field"><label>Nama Pasien *</label><input type="text" name="nama_pasien" required placeholder="Budi Santoso"></div>
            <div class="field"><label>No. Rekam Medik *</label><input type="text" name="no_rm" required placeholder="123456"></div>
            <div class="field full"><label>Tujuan / Prosedur *</label><input type="text" name="tujuan" required placeholder="ORIF Femur, dll."></div>
          </div>
          <button class="btn" type="submit" style="margin-top:16px;" id="btn-keluar">Simpan Pengeluaran</button>
          <div class="msg" id="msg-keluar"></div>
        </form>
      </div>
    `;

    document.getElementById('keluar-tgl').value = todayISO();

    document.getElementById('form-keluar').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-keluar'); btn.disabled = true; btn.textContent = 'Memproses...';
      const msg = document.getElementById('msg-keluar'); msg.className = 'msg';
      const form = e.target;
      const batchInfo = form.batch_info.value.split('|'); // [barang_id, batch_id, kode_barang]

      if (batchInfo.length < 3) {
        msg.textContent = '❌ Pilih barang yang valid.'; msg.className = 'msg show err';
        btn.disabled = false; btn.textContent = 'Simpan Pengeluaran';
        return;
      }

      try {
        await callRpc('rpc_pengeluaran', {
          p_tanggal: form.tanggal.value, p_kode_barang: batchInfo[2],
          p_batch_id: batchInfo[1], p_jumlah: Number(form.jumlah.value),
          p_nama_pasien: form.nama_pasien.value.trim(), p_no_rm: form.no_rm.value.trim(),
          p_tujuan: form.tujuan.value.trim()
        });
        msg.textContent = '✅ Pengeluaran berhasil dicatat.'; msg.className = 'msg show ok';
        form.reset(); document.getElementById('keluar-tgl').value = todayISO();
        setTimeout(() => renderKeluarPanel(), 1500);
      } catch (err) {
        msg.textContent = '❌ ' + err.message; msg.className = 'msg show err';
        btn.disabled = false; btn.textContent = 'Simpan Pengeluaran';
      }
    });
  } catch (err) {
    pageContent.innerHTML = `<div class="card"><div class="msg show err">Gagal: ${err.message}</div></div>`;
  }
}

// ============================================================
// 9. FITUR BADGE MERAH (NOTIFIKASI KONSINYASI)
// ============================================================
// Fungsi untuk mengecek notifikasi secara otomatis di latar belakang
async function cekBadgeNotifikasi() {
  try {
    const notif = await selectView('v_notifikasi_konsinyasi_open');
    const badge = document.getElementById('badge-notif');
    if (notif.length > 0) {
      badge.textContent = notif.length;
      badge.classList.add('show');
    } else {
      badge.classList.remove('show');
    }
  } catch (err) {
    console.error('Gagal cek notif:', err);
  }
}

// Panggil pengecekan setiap 30 detik setelah login
setInterval(() => {
  if (currentUser) cekBadgeNotifikasi();
}, 30000);

// ============================================================
// 10. PANEL NOTIFIKASI KONSINYASI
// ============================================================
async function renderNotifikasiPanel() {
  try {
    const notif = await selectView('v_notifikasi_konsinyasi_open');
    
    let html = `<div class="card">
      <h3>🔔 Notifikasi Re-order Konsinyasi</h3>
      <div class="sub">Daftar barang titipan (konsinyasi) yang stoknya menipis dan perlu di-reorder ke distributor.</div>`;

    if (notif.length === 0) {
      html += `<div class="empty">Tidak ada notifikasi. Semua stok konsinyasi aman.</div>`;
    } else {
      html += `<div class="table-wrap"><table>
        <thead><tr><th>Tanggal</th><th>Barang</th><th>Vendor</th><th>Gudang</th><th class="num">Par Level</th><th class="num">Sisa Stok</th><th class="num">Perlu Re-order</th><th>Aksi</th></tr></thead><tbody>`;
      
      notif.forEach(n => {
        html += `<tr>
          <td>${new Date(n.created_at).toLocaleDateString('id-ID')}</td>
          <td><strong>${escapeHtml(n.nama_barang)}</strong></td>
          <td>${escapeHtml(n.vendor)}</td>
          <td>${escapeHtml(n.gudang_stok)}</td>
          <td class="num">${angka(n.par_level)}</td>
          <td class="num">${angka(n.stok_saat_trigger)}</td>
          <td class="num" style="color:var(--danger);font-weight:bold;">+${angka(n.perlu_reorder)}</td>
          <td><button class="btn secondary btn-selesai" data-id="${n.id}">Tandai Selesai</button></td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    }
    html += `</div>`;
    pageContent.innerHTML = html;

    // Event listener untuk tombol "Tandai Selesai"
    document.querySelectorAll('.btn-selesai').forEach(btn => {
      btn.addEventListener('click', async function() {
        if(!confirm('Yakin barang sudah di-reorder / notifikasi selesai?')) return;
        this.disabled = true; this.textContent = 'Memproses...';
        try {
          await callRpc('rpc_resolve_notifikasi', { p_id: this.dataset.id, p_status: 'selesai' });
          renderNotifikasiPanel(); // refresh tabel
          cekBadgeNotifikasi();    // refresh badge merah
        } catch (err) {
          alert(err.message);
          this.disabled = false; this.textContent = 'Tandai Selesai';
        }
      });
    });

  } catch (err) {
    pageContent.innerHTML = `<div class="card"><div class="msg show err">Gagal: ${err.message}</div></div>`;
  }
}

// ============================================================
// 11. PANEL LAPORAN PEMAKAIAN (Untuk SP Distributor)
// ============================================================
async function renderPemakaianPanel() {
  try {
    const vendor = await selectView('vendor');
    let optVendor = vendor.map(v => `<option value="${v.nama}">${v.nama}</option>`).join('');

    pageContent.innerHTML = `
      <div class="card">
        <h3>Laporan Pemakaian (Lampiran SP)</h3>
        <div class="sub">Rekap pemakaian pasien untuk diserahkan ke distributor sebagai lampiran SP.</div>
        <div class="field-grid" style="grid-template-columns: 1fr 1fr 1fr auto;">
          <div class="field"><label>Dari Tanggal</label><input type="date" id="lap-mulai" required></div>
          <div class="field"><label>Sampai Tanggal</label><input type="date" id="lap-akhir" required></div>
          <div class="field">
            <label>Vendor (Konsinyasi)</label>
            <select id="lap-vendor"><option value="">Semua Vendor</option>${optVendor}</select>
          </div>
          <button class="btn" id="btn-lap-tampil" style="margin-top:20px;">Tampilkan</button>
        </div>
      </div>
      <div id="lap-hasil"></div>
    `;

    document.getElementById('lap-mulai').value = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
    document.getElementById('lap-akhir').value = todayISO();

    document.getElementById('btn-lap-tampil').addEventListener('click', async () => {
      const btn = document.getElementById('btn-lap-tampil');
      const mulai = document.getElementById('lap-mulai').value;
      const akhir = document.getElementById('lap-akhir').value;
      const vnd = document.getElementById('lap-vendor').value;

      if(!mulai || !akhir) return alert('Pilih tanggal mulai dan akhir.');
      btn.disabled = true; btn.textContent = 'Memuat...';

      try {
        // Panggil VIEW v_laporan_pemakaian_sp (hanya nama barang, tanpa kode)
        let q = sb.from('v_laporan_pemakaian_sp').select('*').gte('tanggal', mulai).lte('tanggal', akhir).eq('status_kepemilikan', 'konsinyasi');
        if (vnd) q = q.eq('vendor', vnd);
        
        const { data, error } = await q.order('tanggal', { ascending: true });
        if (error) throw new Error(error.message);

        const container = document.getElementById('lap-hasil');
        if (data.length === 0) {
          container.innerHTML = '<div class="card"><div class="empty">Tidak ada pemakaian konsinyasi pada periode ini.</div></div>';
          return;
        }

        let html = `<div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="margin:0;">Data Pemakaian Periode ${mulai} s/d ${akhir}</h3>
            <button class="btn secondary" id="btn-export-csv">⬇ Export CSV</button>
          </div>
          <div class="table-wrap"><table>
            <thead><tr><th>No</th><th>Tanggal</th><th>Nama Pasien</th><th>No. RM</th><th>Nama Barang</th><th class="num">Jumlah</th><th>Tujuan</th></tr></thead><tbody>`;
        
        let totalQty = 0;
        data.forEach((r, i) => {
          totalQty += r.jumlah;
          html += `<tr>
            <td>${i + 1}</td>
            <td>${new Date(r.tanggal).toLocaleDateString('id-ID')}</td>
            <td>${escapeHtml(r.nama_pasien)}</td>
            <td>${escapeHtml(r.no_rekam_medik)}</td>
            <td>${escapeHtml(r.nama_barang)}</td>
            <td class="num">${angka(r.jumlah)}</td>
            <td>${escapeHtml(r.tujuan)}</td>
          </tr>`;
        });
        html += `</tbody></table></div>
          <div class="totals"><div><span class="l">Total Terpakai</span><span class="n">${angka(totalQty)}</span></div></div>
        </div>`;
        
        container.innerHTML = html;

        // Fitur Export CSV (Siap di-print sebagai Lampiran SP)
        document.getElementById('btn-export-csv').addEventListener('click', () => {
          let csvContent = "data:text/csv;charset=utf-8,";
          csvContent += "Tanggal,Nama Pasien,No Rekam Medik,Nama Barang,Jumlah,Tujuan\n";
          data.forEach(r => {
            csvContent += `"${r.tanggal}","${r.nama_pasien}","${r.no_rekam_medik}","${r.nama_barang}",${r.jumlah},"${r.tujuan}"\n`;
          });
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement("a");
          link.setAttribute("href", encodedUri);
          link.setAttribute("download", `Lampiran_SP_${mulai}_sd_${akhir}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });

      } catch (err) {
        document.getElementById('lap-hasil').innerHTML = `<div class="card"><div class="msg show err">Gagal: ${err.message}</div></div>`;
      } finally {
        btn.disabled = false; btn.textContent = 'Tampilkan';
      }
    });
  } catch (err) {
    pageContent.innerHTML = `<div class="card"><div class="msg show err">Gagal: ${err.message}</div></div>`;
  }
}

// ============================================================
// 12. PANEL KARTU STOK (Riwayat Barang)
// ============================================================
async function renderKartuStokPanel() {
  try {
    const master = await selectView('master_barang', { eq: { aktif: true }, order: { column: 'nama_barang' } });
    let optBarang = master.map(m => `<option value="${m.kode_barang}">${m.kode_barang} - ${m.nama_barang}</option>`).join('');

    pageContent.innerHTML = `
      <div class="card">
        <h3>Kartu Stok Barang</h3>
        <div class="sub">Lacak riwayat keluar-masuk barang secara detail (Buku Besar).</div>
        <div class="field-grid" style="grid-template-columns: 1fr auto;">
          <div class="field">
            <label>Pilih Barang *</label>
            <select id="kartu-barang" required><option value="">- Pilih Barang -</option>${optBarang}</select>
          </div>
          <button class="btn" id="btn-kartu-tampil" style="margin-top:20px;">Tampilkan Riwayat</button>
        </div>
      </div>
      <div id="kartu-hasil"></div>
    `;

    document.getElementById('btn-kartu-tampil').addEventListener('click', async () => {
      const kode = document.getElementById('kartu-barang').value;
      if(!kode) return alert('Pilih barang terlebih dahulu.');
      
      const btn = document.getElementById('btn-kartu-tampil'); btn.disabled = true; btn.textContent = 'Memuat...';
      const container = document.getElementById('kartu-hasil');
      container.innerHTML = '<div class="card"><div class="empty">Mengambil data...</div></div>';

      try {
        const data = await selectView('v_kartu_stok', { eq: { kode_barang: kode }, order: { column: 'created_at', ascending: true } });

        if (data.length === 0) {
          container.innerHTML = '<div class="card"><div class="empty">Belum ada transaksi untuk barang ini.</div></div>';
          return;
        }

        let html = `<div class="card"><h3>Riwayat: ${escapeHtml(data[0].nama_barang)}</h3>
          <div class="table-wrap"><table>
            <thead><tr><th>Tanggal</th><th>Jenis</th><th>Gudang (Dari/Ke)</th><th class="num">Masuk</th><th class="num">Keluar</th><th>Keterangan</th></tr></thead><tbody>`;
        
        data.forEach(r => {
          const isMasuk = r.qty > 0;
          html += `<tr>
            <td>${new Date(r.tanggal).toLocaleDateString('id-ID')}</td>
            <td><strong>${r.jenis.toUpperCase()}</strong></td>
            <td>${r.dari_gudang ? 'Dari: ' + r.dari_gudang : ''} ${r.ke_gudang ? 'Ke: ' + r.ke_gudang : ''}</td>
            <td class="num" style="color:var(--success);">${isMasuk ? '+' + angka(r.qty) : ''}</td>
            <td class="num" style="color:var(--danger);">${!isMasuk ? angka(Math.abs(r.qty)) : ''}</td>
            <td>${escapeHtml(r.nama_pasien || r.alasan || r.vendor || '-')}</td>
          </tr>`;
        });
        html += `</tbody></table></div></div>`;
        container.innerHTML = html;

      } catch (err) {
        container.innerHTML = `<div class="card"><div class="msg show err">Gagal: ${err.message}</div></div>`;
      } finally {
        btn.disabled = false; btn.textContent = 'Tampilkan Riwayat';
      }
    });
  } catch (err) {
    pageContent.innerHTML = `<div class="card"><div class="msg show err">Gagal: ${err.message}</div></div>`;
  }
}

// ============================================================
// 13. PANEL PENYESUAIAN STOK
// ============================================================
async function renderPenyesuaianPanel() {
  try {
    const gudang = await selectView('gudang');
    const master = await selectView('master_barang', { eq: { aktif: true }, order: { column: 'nama_barang' } });
    
    let optGudang = gudang.map(g => `<option value="${g.id}">${g.nama}</option>`).join('');
    let optBarang = master.map(m => `<option value="${m.kode_barang}">${m.kode_barang} - ${m.nama_barang}</option>`).join('');

    pageContent.innerHTML = `
      <div class="card">
        <h3>Catat Penyesuaian Stok (Koreksi)</h3>
        <div class="sub">Gunakan form ini jika ada barang rusak, hilang, atau selisih saat opname.</div>
        <form id="form-penyesuaian">
          <div class="field-grid">
            <div class="field"><label>Tanggal *</label><input type="date" name="tanggal" id="pny-tgl" required></div>
            <div class="field"><label>Pilih Barang *</label><select name="kode_barang" required><option value="">- Pilih -</option>${optBarang}</select></div>
            <div class="field"><label>Gudang *</label><select name="gudang_id" required>${optGudang}</select></div>
            <div class="field">
              <label>Jenis Penyesuaian *</label>
              <select name="jenis" required>
                <option value="tambah">Tambah (Fisik > Sistem)</option>
                <option value="kurang">Kurang (Fisik < Sistem / Rusak)</option>
              </select>
            </div>
            <div class="field"><label>Jumlah *</label><input type="number" name="jumlah" min="1" required></div>
            <div class="field full"><label>Alasan *</label><input type="text" name="alasan" required placeholder="Contoh: Barang rusak / Hasil opname bulan ini"></div>
          </div>
          <button class="btn" type="submit" style="margin-top:16px;" id="btn-pny">Simpan Penyesuaian</button>
          <div class="msg" id="msg-pny"></div>
        </form>
      </div>
    `;

    document.getElementById('pny-tgl').value = todayISO();

    document.getElementById('form-penyesuaian').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-pny'); btn.disabled = true; btn.textContent = 'Menyimpan...';
      const msg = document.getElementById('msg-pny'); msg.className = 'msg';
      const form = e.target;

      try {
        // Karena Anda admin, kita gunakan RPC langsung (self-approve)
        await callRpc('rpc_penyesuaian_langsung', {
          p_tanggal: form.tanggal.value, p_kode_barang: form.kode_barang.value,
          p_gudang_id: form.gudang_id.value, p_jenis: form.jenis.value,
          p_jumlah: Number(form.jumlah.value), p_alasan: form.alasan.value.trim(),
          p_status: 'milik_rs', p_vendor_id: null, p_no_batch: '-'
        });
        msg.textContent = '✅ Penyesuaian berhasil disimpan.'; msg.className = 'msg show ok';
        form.reset(); document.getElementById('pny-tgl').value = todayISO();
      } catch (err) {
        msg.textContent = '❌ ' + err.message; msg.className = 'msg show err';
      } finally {
        btn.disabled = false; btn.textContent = 'Simpan Penyesuaian';
      }
    });
  } catch (err) {
    pageContent.innerHTML = `<div class="card"><div class="msg show err">Gagal: ${err.message}</div></div>`;
  }
}

// ============================================================
// 14. PANEL APPROVAL (Persetujuan Penyesuaian)
// ============================================================
async function renderApprovalPanel() {
  try {
    const pending = await selectView('penyesuaian_request', { eq: { status: 'pending' }, order: { column: 'requested_at', ascending: false } });

    let html = `<div class="card">
      <h3>Daftar Persetujuan (Approval)</h3>
      <div class="sub">Permintaan penyesuaian stok dari petugas yang menunggu persetujuan Admin.</div>`;

    if (pending.length === 0) {
      html += `<div class="empty">Tidak ada permintaan penyesuaian yang menunggu.</div>`;
    } else {
      html += `<div class="table-wrap"><table>
        <thead><tr><th>Tanggal</th><th>Barang</th><th>Jenis</th><th class="num">Jumlah</th><th>Alasan</th><th>Aksi</th></tr></thead><tbody>`;
      
      pending.forEach(p => {
        // Kita perlu mencari nama barang berdasarkan barang_id
        // (Karena view belum menyertakan nama barang, kita gunakan cache jika ada, atau panggil db)
        html += `<tr id="row-${p.id}">
          <td>${new Date(p.tanggal).toLocaleDateString('id-ID')}</td>
          <td>${p.barang_id}</td>
          <td>${p.jenis.toUpperCase()}</td>
          <td class="num">${angka(p.jumlah)}</td>
          <td>${escapeHtml(p.alasan)}</td>
          <td>
            <button class="btn btn-approve" data-id="${p.id}" style="padding:4px 10px;font-size:11px;margin-right:4px;">Setujui</button>
            <button class="btn secondary btn-reject" data-id="${p.id}" style="padding:4px 10px;font-size:11px;background:#fbeae8;color:var(--danger);">Tolak</button>
          </td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    }
    html += `</div>`;
    pageContent.innerHTML = html;

    // Event tombol Setujui
    document.querySelectorAll('.btn-approve').forEach(btn => {
      btn.addEventListener('click', async function() {
        this.disabled = true; this.textContent = '...';
        try {
          await callRpc('rpc_penyesuaian_approve', { p_request_id: this.dataset.id });
          renderApprovalPanel();
        } catch (err) { alert(err.message); this.disabled = false; this.textContent = 'Setujui'; }
      });
    });

    // Event tombol Tolak
    document.querySelectorAll('.btn-reject').forEach(btn => {
      btn.addEventListener('click', async function() {
        this.disabled = true; this.textContent = '...';
        try {
          await callRpc('rpc_penyesuaian_reject', { p_request_id: this.dataset.id, p_catatan: 'Ditolak Admin' });
          renderApprovalPanel();
        } catch (err) { alert(err.message); this.disabled = false; this.textContent = 'Tolak'; }
      });
    });

  } catch (err) {
    pageContent.innerHTML = `<div class="card"><div class="msg show err">Gagal: ${err.message}</div></div>`;
  }
}

// ============================================================
// 15. PANEL LAPORAN OPNAME (Posisi Stok Akhir)
// ============================================================
async function renderOpnamePanel() {
  try {
    // Ambil data view stok saat ini
    const stok = await selectView('v_stok_saat_ini', { order: { column: 'nama_barang', ascending: true } });
    const gudang = await selectView('gudang');

    // Hitung ringkasan per gudang
    let ringkasan = {};
    gudang.forEach(g => { ringkasan[g.id] = { nama: g.nama, item: 0, nilai: 0 }; });
    
    let grandTotalItem = 0;
    let grandTotalNilai = 0;

    stok.forEach(r => {
      if (ringkasan[r.gudang_id]) {
        ringkasan[r.gudang_id].item += 1;
        ringkasan[r.gudang_id].nilai += Number(r.jumlah_harga);
      }
      grandTotalItem += 1;
      grandTotalNilai += Number(r.jumlah_harga);
    });

    let html = `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h3>Laporan Stok Opname</h3>
          <div class="sub">Rekapitulasi posisi stok akhir per tanggal hari ini (${new Date().toLocaleDateString('id-ID')}).</div>
        </div>
        <button class="btn secondary" id="btn-export-opname">⬇ Export CSV</button>
      </div>
      
      <!-- Kartu Ringkasan -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:16px;margin-bottom:24px;">
        ${Object.values(ringkasan).map(r => `
          <div style="background:#e4f0ee;padding:12px 20px;border-radius:8px;flex:1;min-width:200px;">
            <strong style="color:var(--primary);font-size:14px;">${escapeHtml(r.nama)}</strong><br>
            <span style="font-size:12px;color:var(--text-muted);">${r.item} jenis barang</span><br>
            <span style="font-size:18px;font-weight:600;color:var(--primary);">${rupiah(r.nilai)}</span>
          </div>
        `).join('')}
      </div>

      <!-- Tabel Detail -->
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama Barang</th>
              <th>Gudang</th>
              <th>Status</th>
              <th class="num">Sisa Stok</th>
              <th class="num">Harga Satuan</th>
              <th class="num">Total Nilai</th>
            </tr>
          </thead>
          <tbody>
            ${stok.length === 0 ? '<tr><td colspan="7" class="empty">Belum ada stok.</td></tr>' : ''}
            ${stok.map(r => `
              <tr>
                <td><strong>${escapeHtml(r.kode_barang)}</strong></td>
                <td>${escapeHtml(r.nama_barang)}</td>
                <td>${escapeHtml(r.gudang)}</td>
                <td>${r.status_kepemilikan === 'konsinyasi' ? '<span class="badge warn">Konsinyasi</span>' : 'Milik RS'}</td>
                <td class="num">${angka(r.jumlah)}</td>
                <td class="num">${rupiah(r.harga)}</td>
                <td class="num">${rupiah(r.jumlah_harga)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="totals" style="border-top:2px solid var(--primary);padding-top:16px;margin-top:16px;">
        <div><span class="l">Total Item</span><span class="n">${angka(grandTotalItem)}</span></div>
        <div><span class="l">Total Nilai Aset</span><span class="n">${rupiah(grandTotalNilai)}</span></div>
      </div>
    </div>`;

    pageContent.innerHTML = html;

    // Fitur Export CSV Opname
    document.getElementById('btn-export-opname').addEventListener('click', () => {
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Kode Barang,Nama Barang,Gudang,Status,Sisa Stok,Harga Satuan,Total Nilai\n";
      stok.forEach(r => {
        csvContent += `"${r.kode_barang}","${r.nama_barang}","${r.gudang}","${r.status_kepemilikan}",${r.jumlah},${r.harga},${r.jumlah_harga}\n`;
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Laporan_Opname_${todayISO()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

  } catch (err) {
    pageContent.innerHTML = `<div class="card"><div class="msg show err">Gagal memuat opname: ${err.message}</div></div>`;
  }
}
