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
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
       navigateTo('stok');
    }
  } else {
    // Jika session habis / tidak ada (JWT expired / logout)
    currentUser = null;
    appScreen.classList.remove('show'); loginScreen.style.display = 'flex';
    loginBtn.disabled = false; loginBtn.textContent = 'Masuk'; loginForm.reset();
    if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
      // Opsional: Tampilkan pesan di halaman login
      loginError.textContent = 'Sesi Anda telah berakhir. Silakan login kembali.';
      loginError.style.display = 'block';
    }
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
// 4. PANEL MASTER BARANG (REVISI: Edit Lengkap & Soft Delete)
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
        <div class="sub">Format: <strong>Kategori (PL/SC/XX), Nama Barang, Satuan, Harga, Status (milik_rs/konsinyasi)</strong></div>
        <textarea id="excel-paste" rows="4" style="width:100%; padding:10px; font-family:monospace; border:1px solid var(--border); border-radius:6px; margin-bottom:12px;" placeholder="PL&#9;Plate Mini 2.0mm&#9;pcs&#9;250000&#9;milik_rs"></textarea>
        <button class="btn" id="btn-import-excel">Proses Import</button>
        <div class="msg" id="msg-excel"></div>
      </div>

      <div class="card">
        <h3>Daftar Barang</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Kode</th><th>Nama Barang</th><th>Kategori</th><th>Status</th><th>Vendor</th><th class="num">Harga</th><th>Aksi</th></tr></thead><tbody>
          ${master.length === 0 ? '<tr><td colspan="7" class="empty">Belum ada data.</td></tr>' : ''}
          ${master.map(b => {
            const vnd = vendor.find(v => v.id === b.vendor_id);
            const isAktif = b.aktif !== false;
            return `<tr style="${!isAktif ? 'opacity:0.5; background:#f9f9f9;' : ''}">
              <td><strong>${escapeHtml(b.kode_barang)}</strong></td>
              <td>${escapeHtml(b.nama_barang)}</td>
              <td>${escapeHtml(b.prefix)}</td>
              <td>${b.status_kepemilikan === 'konsinyasi' ? '<span class="badge warn">Konsinyasi</span>' : 'Milik RS'}</td>
              <td>${vnd ? escapeHtml(vnd.nama) : '-'}</td>
              <td class="num">${rupiah(b.harga_terakhir)}</td>
              <td style="white-space:nowrap;">
                ${isAktif ? `
                  <button class="btn secondary btn-edit-master" 
                    data-id="${b.id}" 
                    data-kode="${b.kode_barang}" 
                    data-nama="${b.nama_barang}" 
                    data-satuan="${b.satuan}" 
                    data-harga="${b.harga_terakhir}" 
                    data-status="${b.status_kepemilikan || 'milik_rs'}" 
                    data-vendor="${b.vendor_id || ''}"
                    style="padding:4px 10px;font-size:11px;margin-right:4px;">Edit</button>
                  <button class="btn secondary btn-hapus-master" data-id="${b.id}" data-kode="${b.kode_barang}" style="padding:4px 10px;font-size:11px;background:#fbeae8;color:var(--danger);">Hapus</button>
                ` : '<span style="font-size:11px;color:var(--text-muted);">Diarsipkan</span>'}
              </td>
            </tr>`;
          }).join('')}
        </tbody></table></div>
      </div>

      <!-- MODAL EDIT MASTER BARANG -->
      <div id="modal-edit-master" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;">
        <div style="background:#fff; padding:24px; border-radius:12px; width:100%; max-width:500px;">
          <h3 style="margin-bottom:16px;">Edit Master Barang</h3>
          <form id="form-edit-master">
            <input type="hidden" name="id">
            <div class="field-grid" style="grid-template-columns: 1fr 1fr;">
              <div class="field full"><label>Kode Barang (Tidak dapat diubah)</label><input type="text" name="kode_barang" readonly style="background:#eee;"></div>
              <div class="field full"><label>Nama Barang *</label><input type="text" name="nama_barang" required></div>
              <div class="field"><label>Satuan *</label><input type="text" name="satuan" required></div>
              <div class="field"><label>Harga Terakhir (Rp) *</label><input type="number" name="harga_terakhir" min="0" required></div>
              <div class="field">
                <label>Status Kepemilikan *</label>
                <select name="status_kepemilikan" id="edit-status" required>
                  <option value="milik_rs">Milik RS</option>
                  <option value="konsinyasi">Konsinyasi</option>
                </select>
              </div>
              <div class="field">
                <label>Vendor</label>
                <select name="vendor_id" id="edit-vendor">
                  <option value="">- Tanpa Vendor -</option>${optVendor}
                </select>
              </div>
            </div>
            <div style="margin-top:20px; display:flex; gap:10px; justify-content:flex-end;">
              <button type="button" class="btn secondary" id="btn-batal-edit-master">Batal</button>
              <button type="submit" class="btn" id="btn-submit-edit-master">Simpan Perubahan</button>
            </div>
            <div class="msg" id="msg-edit-master" style="margin-top:10px;"></div>
          </form>
        </div>
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

    // Fitur Import Excel
    document.getElementById('btn-import-excel').addEventListener('click', async () => {
      const raw = document.getElementById('excel-paste').value.trim();
      if (!raw) return alert('Tempelkan data Excel terlebih dahulu.');
      const btn = document.getElementById('btn-import-excel'); btn.disabled = true; btn.textContent = 'Memproses...';
      const msg = document.getElementById('msg-excel'); msg.className = 'msg';
      const rows = raw.split('\n'); let success = 0; let failed = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i].trim(); if (!row) continue;
        const cols = row.split('\t');
        if (cols.length < 4) { failed++; continue; }
        try {
          const kodeBaru = await callRpc('rpc_generate_kode', { p_prefix: cols[0].trim().toUpperCase() });
          const { error } = await sb.from('master_barang').insert({
            kode_barang: kodeBaru, prefix: cols[0].trim().toUpperCase(), 
            nama_barang: cols[1].trim(), satuan: cols[2].trim() || 'pcs',
            harga_terakhir: Number(cols[3].trim()) || 0, 
            status_kepemilikan: (cols[4] ? cols[4].trim().toLowerCase() : 'milik_rs') === 'konsinyasi' ? 'konsinyasi' : 'milik_rs', 
            vendor_id: null
          });
          if (error) throw new Error(); success++;
        } catch (err) { failed++; }
      }
      msg.textContent = `✅ ${success} berhasil. ❌ ${failed} gagal.`;
      msg.className = `msg show ${failed === 0 ? 'ok' : 'warn'}`;
      if (success > 0) { document.getElementById('excel-paste').value = ''; setTimeout(() => renderMasterPanel(), 1500); }
      btn.disabled = false; btn.textContent = 'Proses Import';
    });

    // Fitur Hapus (Soft Delete)
    document.querySelectorAll('.btn-hapus-master').forEach(btn => {
      btn.addEventListener('click', async function() {
        if (!confirm(`Arsipkan barang ${this.dataset.kode}? Barang tidak akan muncul di form transaksi, tapi riwayatnya tetap aman.`)) return;
        this.disabled = true; this.textContent = '...';
        try {
          const { error } = await sb.from('master_barang').update({ aktif: false }).eq('id', this.dataset.id);
          if (error) throw new Error(error.message);
          renderMasterPanel();
        } catch (err) { alert(err.message); this.disabled = false; this.textContent = 'Hapus'; }
      });
    });

    // Fitur Buka Modal Edit
    const modal = document.getElementById('modal-edit-master');
    document.querySelectorAll('.btn-edit-master').forEach(btn => {
      btn.addEventListener('click', function() {
        const f = document.getElementById('form-edit-master');
        f.id.value = this.dataset.id;
        f.kode_barang.value = this.dataset.kode;
        f.nama_barang.value = this.dataset.nama;
        f.satuan.value = this.dataset.satuan;
        f.harga_terakhir.value = this.dataset.harga;
        
        f.status_kepemilikan.value = this.dataset.status;
        f.vendor_id.value = this.dataset.vendor;

        // Trigger logika dropdown vendor
        if (f.status_kepemilikan.value === 'milik_rs') f.vendor_id.disabled = true;
        else f.vendor_id.disabled = false;

        modal.style.display = 'flex';
      });
    });

    document.getElementById('edit-status').addEventListener('change', (e) => {
      const v = document.getElementById('edit-vendor');
      if (e.target.value === 'milik_rs') { v.value = ''; v.disabled = true; } 
      else { v.disabled = false; }
    });

    document.getElementById('btn-batal-edit-master').addEventListener('click', () => modal.style.display = 'none');

    // Fitur Submit Edit
    document.getElementById('form-edit-master').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-submit-edit-master'); btn.disabled = true; btn.textContent = 'Menyimpan...';
      const msg = document.getElementById('msg-edit-master'); msg.className = 'msg';
      const form = e.target;

      try {
        const { error } = await sb.from('master_barang').update({
          nama_barang: form.nama_barang.value.trim(),
          satuan: form.satuan.value.trim(),
          harga_terakhir: Number(form.harga_terakhir.value),
          status_kepemilikan: form.status_kepemilikan.value,
          vendor_id: form.vendor_id.value || null
        }).eq('id', form.id.value);

        if (error) throw new Error(error.message);
        msg.textContent = '✅ Berhasil diupdate.'; msg.className = 'msg show ok';
        setTimeout(() => { modal.style.display = 'none'; renderMasterPanel(); }, 1000);
      } catch (err) {
        msg.textContent = '❌ ' + err.message; msg.className = 'msg show err';
        btn.disabled = false; btn.textContent = 'Simpan Perubahan';
      }
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
// 6. PANEL BARANG MASUK (REVISI: +Status Kepemilikan & Vendor)
// ============================================================
async function renderMasukPanel() {
  try {
    const master = await selectView('master_barang', { eq: { aktif: true }, order: { column: 'nama_barang' } });
    const vendor = await selectView('vendor', { order: { column: 'nama' } });
    const riwayat = await selectView('v_kartu_stok', { eq: { jenis: 'masuk' }, order: { column: 'created_at', ascending: false }, limit: 50 });
    
    let optBarang = master.map(m => `<option value="${m.kode_barang}">${m.kode_barang} - ${m.nama_barang}</option>`).join('');
    let optVendor = vendor.map(v => `<option value="${v.id}">${v.nama}</option>`).join('');

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
            
            <div class="field">
              <label>Status Kepemilikan *</label>
              <select name="status" id="masuk-status" required>
                <option value="milik_rs">Milik RS</option>
                <option value="konsinyasi">Konsinyasi</option>
              </select>
            </div>
            <div class="field">
              <label>Pilih Vendor *</label>
              <select name="vendor_id" id="masuk-vendor" required>
                <option value="">- Pilih Vendor -</option>
                ${optVendor}
              </select>
            </div>
            <div class="field"><label>No. Batch</label><input type="text" name="no_batch" placeholder="-"></div>
          </div>
          <button class="btn" type="submit" style="margin-top:16px;" id="btn-masuk">Simpan Penerimaan</button>
          <div class="msg" id="msg-masuk"></div>
        </form>
      </div>

      <div class="card">
        <h3>Riwayat Barang Masuk (50 Terakhir)</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Tanggal</th><th>Nama Barang</th><th>Status</th><th class="num">Jumlah</th><th class="num">Harga</th><th>Vendor</th><th>Aksi</th></tr></thead><tbody>
          ${riwayat.length === 0 ? '<tr><td colspan="7" class="empty">Belum ada riwayat barang masuk.</td></tr>' : ''}
          ${riwayat.map(r => `<tr>
            <td>${new Date(r.tanggal).toLocaleDateString('id-ID')}</td>
            <td>${escapeHtml(r.nama_barang)}</td>
            <td>${r.status_kepemilikan === 'konsinyasi' ? '<span class="badge warn">Konsinyasi</span>' : 'Milik RS'}</td>
            <td class="num">${angka(r.qty)}</td>
            <td class="num">${rupiah(r.harga_satuan || 0)}</td>
            <td>${escapeHtml(r.vendor || '-')}</td>
            <td>
              <button class="btn secondary btn-edit-masuk" 
                data-id="${r.id}" 
                data-kode="${r.kode_barang}" 
                data-tgl="${r.tanggal}" 
                data-jml="${r.qty}" 
                data-hrg="${r.harga_satuan}" 
                data-vendor="${r.vendor || ''}" 
                data-batch="${r.no_batch || '-'}"
                style="padding:4px 10px;font-size:11px;margin-right:4px;">Edit</button>
              <button class="btn secondary btn-hapus-masuk" data-id="${r.id}" style="padding:4px 10px;font-size:11px;background:#fbeae8;color:var(--danger);">Hapus</button>
            </td>
          </tr>`).join('')}
        </tbody></table></div>
      </div>

      <!-- MODAL EDIT (Tetap menggunakan RPC edit yang lama) -->
      <div id="modal-edit-masuk" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;">
        <div style="background:#fff; padding:24px; border-radius:12px; width:100%; max-width:500px;">
          <h3 style="margin-bottom:16px;">Edit Transaksi Masuk</h3>
          <form id="form-edit-masuk">
            <input type="hidden" name="id">
            <div class="field-grid" style="grid-template-columns: 1fr 1fr;">
              <div class="field full"><label>Tanggal *</label><input type="date" name="tanggal" required></div>
              <div class="field full"><label>Barang *</label><select name="kode_barang" required><option value="">- Pilih -</option>${optBarang}</select></div>
              <div class="field"><label>Jumlah *</label><input type="number" name="jumlah" min="1" required></div>
              <div class="field"><label>Harga *</label><input type="number" name="harga" min="0" required></div>
              <div class="field full"><label>Vendor *</label><input type="text" name="vendor" list="list-vendor"><datalist id="list-vendor">${optVendor}</datalist></div>
              <div class="field full"><label>No. Batch</label><input type="text" name="no_batch"></div>
            </div>
            <div style="margin-top:20px; display:flex; gap:10px; justify-content:flex-end;">
              <button type="button" class="btn secondary" id="btn-batal-edit">Batal</button>
              <button type="submit" class="btn" id="btn-submit-edit">Simpan Perubahan</button>
            </div>
            <div class="msg" id="msg-edit-masuk" style="margin-top:10px;"></div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('masuk-tgl').value = todayISO();

    // 1. Submit Form Baru
    document.getElementById('form-masuk').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-masuk'); btn.disabled = true; btn.textContent = 'Menyimpan...';
      const msg = document.getElementById('msg-masuk'); msg.className = 'msg';
      const form = e.target;

      if (!form.vendor_id.value) {
         msg.textContent = '❌ Harap pilih vendor.'; msg.className = 'msg show err';
         btn.disabled = false; btn.textContent = 'Simpan Penerimaan'; return;
      }

      try {
        await callRpc('rpc_barang_masuk', {
          p_tanggal: form.tanggal.value, 
          p_kode_barang: form.kode_barang.value,
          p_jumlah: Number(form.jumlah.value), 
          p_harga: Number(form.harga.value),
          p_status_kepemilikan: form.status.value, // Tambahan
          p_vendor_id: form.vendor_id.value,       // Tambahan
          p_no_batch: form.no_batch.value.trim() || '-',
          p_keterangan: null
        });
        msg.textContent = '✅ Barang masuk berhasil dicatat.'; msg.className = 'msg show ok';
        setTimeout(() => renderMasukPanel(), 1000);
      } catch (err) {
        msg.textContent = '❌ ' + err.message; msg.className = 'msg show err';
        btn.disabled = false; btn.textContent = 'Simpan Penerimaan';
      }
    });

    // 2. Hapus
    document.querySelectorAll('.btn-hapus-masuk').forEach(btn => {
      btn.addEventListener('click', async function() {
        if (!confirm('Yakin ingin menghapus transaksi ini? Stok akan dikurangi otomatis.')) return;
        this.disabled = true; this.textContent = '...';
        try {
          await callRpc('rpc_hapus_transaksi', { p_transaksi_id: this.dataset.id });
          renderMasukPanel();
        } catch (err) { alert(err.message); this.disabled = false; this.textContent = 'Hapus'; }
      });
    });

    // 3. Buka Modal Edit
    const modal = document.getElementById('modal-edit-masuk');
    document.querySelectorAll('.btn-edit-masuk').forEach(btn => {
      btn.addEventListener('click', function() {
        const f = document.getElementById('form-edit-masuk');
        f.id.value = this.dataset.id;
        f.tanggal.value = this.dataset.tgl;
        f.kode_barang.value = this.dataset.kode;
        f.jumlah.value = this.dataset.jml;
        f.harga.value = this.dataset.hrg;
        f.vendor.value = this.dataset.vendor;
        f.no_batch.value = this.dataset.batch;
        modal.style.display = 'flex';
      });
    });

    document.getElementById('btn-batal-edit').addEventListener('click', () => modal.style.display = 'none');

    // 4. Submit Edit
    document.getElementById('form-edit-masuk').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-submit-edit'); btn.disabled = true; btn.textContent = 'Menyimpan...';
      const msg = document.getElementById('msg-edit-masuk'); msg.className = 'msg';
      const form = e.target;

      try {
        await callRpc('rpc_edit_barang_masuk', {
          p_transaksi_id: form.id.value,
          p_kode_barang: form.kode_barang.value,
          p_tanggal: form.tanggal.value,
          p_jumlah: Number(form.jumlah.value),
          p_harga: Number(form.harga.value),
          p_vendor: form.vendor.value.trim() || null,
          p_no_batch: form.no_batch.value.trim() || '-'
        });
        msg.textContent = '✅ Berhasil diupdate.'; msg.className = 'msg show ok';
        setTimeout(() => { modal.style.display = 'none'; renderMasukPanel(); }, 1000);
      } catch (err) {
        msg.textContent = '❌ ' + err.message; msg.className = 'msg show err';
        btn.disabled = false; btn.textContent = 'Simpan Perubahan';
      }
    });

  } catch (err) {
    pageContent.innerHTML = `<div class="card"><div class="msg show err">Gagal: ${err.message}</div></div>`;
  }
}

// ============================================================
// 7. PANEL MUTASI (REVISI: Riwayat, Edit, Hapus)
// ============================================================
async function renderMutasiPanel() {
  try {
    const master = await selectView('master_barang', { eq: { aktif: true }, order: { column: 'nama_barang' } });
    const gudang = await selectView('gudang');
    const vendor = await selectView('vendor');
    
    // Ambil riwayat mutasi
    const riwayat = await selectView('v_kartu_stok', { eq: { jenis: 'mutasi' }, order: { column: 'created_at', ascending: false }, limit: 50 });

    let optBarang = master.map(m => `<option value="${m.kode_barang}">${m.kode_barang} - ${m.nama_barang}</option>`).join('');
    let optGudang = gudang.map(g => `<option value="${g.id}">${g.nama} (${g.tipe})</option>`).join('');
    let optVendor = vendor.map(v => `<option value="${v.id}">${v.nama}</option>`).join('');
    
    let gPusat = gudang.find(g => g.tipe === 'pusat')?.id || '';
    let gUnit = gudang.find(g => g.tipe === 'unit')?.id || '';

    pageContent.innerHTML = `
      <div class="card">
        <h3>Mutasi Barang (Farmasi ke IBS)</h3>
        <form id="form-mutasi">
          <div class="field-grid">
            <div class="field"><label>Tanggal *</label><input type="date" name="tanggal" id="mutasi-tgl" required></div>
            <div class="field"><label>Pilih Barang *</label><select name="kode_barang" required><option value="">- Pilih -</option>${optBarang}</select></div>
            <div class="field"><label>Jumlah *</label><input type="number" name="jumlah" min="1" required></div>
            <div class="field"><label>Dari Gudang *</label><select name="dari_gudang" required>${optGudang}</select></div>
            <div class="field"><label>Ke Gudang *</label><select name="ke_gudang" required>${optGudang}</select></div>
            <div class="field">
              <label>Status *</label>
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

      <div class="card">
        <h3>Riwayat Mutasi (50 Terakhir)</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Tanggal</th><th>Barang</th><th class="num">Jumlah</th><th>Dari</th><th>Ke</th><th>Aksi</th></tr></thead><tbody>
          ${riwayat.length === 0 ? '<tr><td colspan="6" class="empty">Belum ada riwayat mutasi.</td></tr>' : ''}
          ${riwayat.map(r => `<tr>
            <td>${new Date(r.tanggal).toLocaleDateString('id-ID')}</td>
            <td>${escapeHtml(r.nama_barang)}</td>
            <td class="num">${angka(r.qty)}</td>
            <td>${escapeHtml(r.dari_gudang)}</td>
            <td>${escapeHtml(r.ke_gudang)}</td>
            <td>
              <button class="btn secondary btn-edit-mutasi" 
                data-id="${r.id}" 
                data-kode="${r.kode_barang}" 
                data-tgl="${r.tanggal}" 
                data-jml="${r.qty}" 
                data-dari="${r.dari_gudang_id || ''}" 
                data-ke="${r.ke_gudang_id || ''}" 
                data-status="${r.status_kepemilikan}" 
                data-vendor="${r.vendor_id || ''}"
                style="padding:4px 10px;font-size:11px;margin-right:4px;">Edit</button>
              <button class="btn secondary btn-hapus-mutasi" data-id="${r.id}" style="padding:4px 10px;font-size:11px;background:#fbeae8;color:var(--danger);">Hapus</button>
            </td>
          </tr>`).join('')}
        </tbody></table></div>
      </div>

      <!-- MODAL EDIT MUTASI -->
      <div id="modal-edit-mutasi" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;">
        <div style="background:#fff; padding:24px; border-radius:12px; width:100%; max-width:500px;">
          <h3 style="margin-bottom:16px;">Edit Transaksi Mutasi</h3>
          <form id="form-edit-mutasi">
            <input type="hidden" name="id">
            <div class="field-grid" style="grid-template-columns: 1fr 1fr;">
              <div class="field full"><label>Tanggal *</label><input type="date" name="tanggal" required></div>
              <div class="field full"><label>Barang *</label><select name="kode_barang" required><option value="">- Pilih -</option>${optBarang}</select></div>
              <div class="field full"><label>Jumlah *</label><input type="number" name="jumlah" min="1" required></div>
              <div class="field"><label>Dari Gudang *</label><select name="dari_gudang" required>${optGudang}</select></div>
              <div class="field"><label>Ke Gudang *</label><select name="ke_gudang" required>${optGudang}</select></div>
              <div class="field"><label>Status *</label><select name="status" required><option value="milik_rs">Milik RS</option><option value="konsinyasi">Konsinyasi</option></select></div>
              <div class="field"><label>Vendor</label><select name="vendor_id"><option value="">- Tanpa Vendor -</option>${optVendor}</select></div>
            </div>
            <div style="margin-top:20px; display:flex; gap:10px; justify-content:flex-end;">
              <button type="button" class="btn secondary" id="btn-batal-edit-mutasi">Batal</button>
              <button type="submit" class="btn" id="btn-submit-edit-mutasi">Simpan Perubahan</button>
            </div>
            <div class="msg" id="msg-edit-mutasi" style="margin-top:10px;"></div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('mutasi-tgl').value = todayISO();
    const f = document.getElementById('form-mutasi');
    if (gPusat) f.dari_gudang.value = gPusat;
    if (gUnit) f.ke_gudang.value = gUnit;

    // 1. Submit Baru
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
        msg.textContent = '✅ Mutasi berhasil.'; msg.className = 'msg show ok';
        setTimeout(() => renderMutasiPanel(), 1000);
      } catch (err) {
        msg.textContent = '❌ ' + err.message; msg.className = 'msg show err';
        btn.disabled = false; btn.textContent = 'Proses Mutasi';
      }
    });

    // 2. Hapus
    document.querySelectorAll('.btn-hapus-mutasi').forEach(btn => {
      btn.addEventListener('click', async function() {
        if (!confirm('Yakin hapus mutasi ini? Stok akan dikembalikan ke gudang asal.')) return;
        this.disabled = true; this.textContent = '...';
        try {
          await callRpc('rpc_hapus_mutasi', { p_transaksi_id: this.dataset.id });
          renderMutasiPanel();
        } catch (err) { alert(err.message); this.disabled = false; this.textContent = 'Hapus'; }
      });
    });

    // 3. Buka Modal Edit
    const modal = document.getElementById('modal-edit-mutasi');
    document.querySelectorAll('.btn-edit-mutasi').forEach(btn => {
      btn.addEventListener('click', function() {
        const form = document.getElementById('form-edit-mutasi');
        form.id.value = this.dataset.id;
        form.tanggal.value = this.dataset.tgl;
        form.kode_barang.value = this.dataset.kode;
        form.jumlah.value = this.dataset.jml;
        form.dari_gudang.value = this.dataset.dari;
        form.ke_gudang.value = this.dataset.ke;
        form.status.value = this.dataset.status;
        form.vendor_id.value = this.dataset.vendor;
        modal.style.display = 'flex';
      });
    });

    document.getElementById('btn-batal-edit-mutasi').addEventListener('click', () => modal.style.display = 'none');

    // 4. Submit Edit
    document.getElementById('form-edit-mutasi').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-submit-edit-mutasi'); btn.disabled = true; btn.textContent = 'Menyimpan...';
      const msg = document.getElementById('msg-edit-mutasi'); msg.className = 'msg';
      const form = e.target;

      try {
        await callRpc('rpc_edit_mutasi', {
          p_transaksi_id: form.id.value,
          p_tanggal: form.tanggal.value,
          p_kode_barang: form.kode_barang.value,
          p_jumlah: Number(form.jumlah.value),
          p_dari_gudang: form.dari_gudang.value,
          p_ke_gudang: form.ke_gudang.value,
          p_status: form.status.value,
          p_vendor_id: form.vendor_id.value || null
        });
        msg.textContent = '✅ Berhasil diupdate.'; msg.className = 'msg show ok';
        setTimeout(() => { modal.style.display = 'none'; renderMutasiPanel(); }, 1000);
      } catch (err) {
        msg.textContent = '❌ ' + err.message; msg.className = 'msg show err';
        btn.disabled = false; btn.textContent = 'Simpan Perubahan';
      }
    });

  } catch (err) {
    pageContent.innerHTML = `<div class="card"><div class="msg show err">Gagal: ${err.message}</div></div>`;
  }
}

// ============================================================
// 8. PANEL PENGELUARAN (Disederhanakan: Pilih Barang & Status)
// ============================================================
async function renderKeluarPanel() {
  try {
    const stokIBS = await selectView('v_stok_saat_ini', { order: { column: 'nama_barang' } });
    const gudangUnit = await selectView('gudang', { eq: { tipe: 'unit' } });
    const gudangIBS = gudangUnit.length > 0 ? gudangUnit[0].id : null;
    const stokTersedia = stokIBS.filter(s => s.gudang_id === gudangIBS);

    // Dropdown disederhanakan, value berisi: id_batch | kode_barang
    let optStok = stokTersedia.map(s => `
      <option value="${s.batch_id}|${s.kode_barang}">
        ${s.nama_barang} - ${s.status_kepemilikan === 'konsinyasi' ? 'Konsinyasi' : 'Milik RS'} (Tersedia: ${s.jumlah})
      </option>
    `).join('');

    const riwayat = await selectView('v_laporan_pemakaian_sp', { order: { column: 'created_at', ascending: false }, limit: 50 });

    pageContent.innerHTML = `
      <div class="card">
        <h3>Pengeluaran Barang (Pasien)</h3>
        <form id="form-keluar">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 24px;">
            <div>
              <h4 style="font-size:14px; color:var(--primary); margin-bottom:12px;">Data Barang</h4>
              <div class="field" style="margin-bottom:12px;"><label>Tanggal Pakai *</label><input type="date" name="tanggal" id="keluar-tgl" required></div>
              <div class="field" style="margin-bottom:12px;">
                <label>Pilih Barang (IBS) *</label>
                <select name="batch_info" required>
                  <option value="">- Pilih Barang -</option>${optStok}
                </select>
              </div>
              <div class="field" style="margin-bottom:12px;"><label>Jumlah Dipakai *</label><input type="number" name="jumlah" min="1" required></div>
            </div>
            <div>
              <h4 style="font-size:14px; color:var(--primary); margin-bottom:12px;">Data Pasien</h4>
              <div class="field" style="margin-bottom:12px;"><label>Nama Pasien *</label><input type="text" name="nama_pasien" required placeholder="Budi Santoso"></div>
              <div class="field" style="margin-bottom:12px;"><label>No. Rekam Medik *</label><input type="text" name="no_rm" required placeholder="123456"></div>
              <div class="field" style="margin-bottom:12px;"><label>Tujuan / Prosedur *</label><input type="text" name="tujuan" required placeholder="ORIF Femur, dll."></div>
            </div>
          </div>
          <div style="margin-top:16px; border-top:1px dashed var(--border); padding-top:16px;">
            <button class="btn" type="submit" id="btn-keluar">Simpan Pengeluaran</button>
          </div>
          <div class="msg" id="msg-keluar"></div>
        </form>
      </div>

      <div class="card">
        <h3>Riwayat Pengeluaran (50 Terakhir)</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Tanggal</th><th>Pasien (RM)</th><th>Barang</th><th>Status</th><th class="num">Jumlah</th><th>Aksi</th></tr></thead><tbody>
          ${riwayat.length === 0 ? '<tr><td colspan="6" class="empty">Belum ada riwayat.</td></tr>' : ''}
          ${riwayat.map(r => `<tr>
            <td>${new Date(r.tanggal).toLocaleDateString('id-ID')}</td>
            <td>${escapeHtml(r.nama_pasien)} <br><small>${escapeHtml(r.no_rekam_medik)}</small></td>
            <td>${escapeHtml(r.nama_barang)}</td>
            <td>${r.status_kepemilikan === 'konsinyasi' ? '<span class="badge warn">Konsinyasi</span>' : 'Milik RS'}</td>
            <td class="num">${angka(r.jumlah)}</td>
            <td>
              <button class="btn secondary btn-edit-keluar" data-id="${r.id}" data-tgl="${r.tanggal}" data-jml="${r.jumlah}" data-pasien="${r.nama_pasien}" data-rm="${r.no_rekam_medik}" data-tujuan="${r.tujuan}" style="padding:4px 10px;font-size:11px;margin-right:4px;">Edit</button>
              <button class="btn secondary btn-hapus-keluar" data-id="${r.id}" style="padding:4px 10px;font-size:11px;background:#fbeae8;color:var(--danger);">Hapus</button>
            </td>
          </tr>`).join('')}
        </tbody></table></div>
      </div>

      <!-- MODAL EDIT -->
      <div id="modal-edit-keluar" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;">
        <div style="background:#fff; padding:24px; border-radius:12px; width:100%; max-width:500px;">
          <h3 style="margin-bottom:16px;">Edit Pengeluaran</h3>
          <form id="form-edit-keluar">
            <input type="hidden" name="id">
            <div class="field-grid" style="grid-template-columns: 1fr 1fr;">
              <div class="field full"><label>Tanggal *</label><input type="date" name="tanggal" required></div>
              <div class="field full"><label>Jumlah Dipakai *</label><input type="number" name="jumlah" min="1" required></div>
              <div class="field full"><label>Nama Pasien *</label><input type="text" name="nama_pasien" required></div>
              <div class="field full"><label>No. RM *</label><input type="text" name="no_rm" required></div>
              <div class="field full"><label>Tujuan *</label><input type="text" name="tujuan" required></div>
            </div>
            <div style="margin-top:20px; display:flex; gap:10px; justify-content:flex-end;">
              <button type="button" class="btn secondary" id="btn-batal-edit-keluar">Batal</button>
              <button type="submit" class="btn" id="btn-submit-edit-keluar">Simpan Perubahan</button>
            </div>
            <div class="msg" id="msg-edit-keluar" style="margin-top:10px;"></div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('keluar-tgl').value = todayISO();

    document.getElementById('form-keluar').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-keluar'); btn.disabled = true; btn.textContent = 'Memproses...';
      const msg = document.getElementById('msg-keluar'); msg.className = 'msg';
      const form = e.target;
      const info = form.batch_info.value.split('|'); // [batch_id, kode_barang]

      if (info.length < 2) return alert('Pilih barang.');

      try {
        await callRpc('rpc_pengeluaran', {
          p_tanggal: form.tanggal.value, p_kode_barang: info[1], p_batch_id: info[0], 
          p_jumlah: Number(form.jumlah.value), p_nama_pasien: form.nama_pasien.value.trim(), 
          p_no_rm: form.no_rm.value.trim(), p_tujuan: form.tujuan.value.trim()
        });
        msg.textContent = '✅ Pengeluaran dicatat.'; msg.className = 'msg show ok';
        setTimeout(() => renderKeluarPanel(), 1000);
      } catch (err) {
        msg.textContent = '❌ ' + err.message; msg.className = 'msg show err';
        btn.disabled = false; btn.textContent = 'Simpan Pengeluaran';
      }
    });

    // Logika Edit dan Hapus (tetap sama)
    document.querySelectorAll('.btn-hapus-keluar').forEach(btn => {
      btn.addEventListener('click', async function() {
        if (!confirm('Batalkan pengeluaran ini? Stok akan kembali ke IBS.')) return;
        this.disabled = true; this.textContent = '...';
        try {
          await callRpc('rpc_hapus_pengeluaran', { p_transaksi_id: this.dataset.id });
          renderKeluarPanel();
        } catch (err) { alert(err.message); this.disabled = false; this.textContent = 'Hapus'; }
      });
    });

    const modal = document.getElementById('modal-edit-keluar');
    document.querySelectorAll('.btn-edit-keluar').forEach(btn => {
      btn.addEventListener('click', function() {
        const form = document.getElementById('form-edit-keluar');
        form.id.value = this.dataset.id; form.tanggal.value = this.dataset.tgl; form.jumlah.value = this.dataset.jml;
        form.nama_pasien.value = this.dataset.pasien; form.no_rm.value = this.dataset.rm; form.tujuan.value = this.dataset.tujuan;
        modal.style.display = 'flex';
      });
    });

    document.getElementById('btn-batal-edit-keluar').addEventListener('click', () => modal.style.display = 'none');

    document.getElementById('form-edit-keluar').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-submit-edit-keluar'); btn.disabled = true; btn.textContent = 'Menyimpan...';
      const msg = document.getElementById('msg-edit-keluar'); msg.className = 'msg';
      const form = e.target;
      try {
        await callRpc('rpc_edit_pengeluaran', {
          p_transaksi_id: form.id.value, p_tanggal: form.tanggal.value, p_jumlah: Number(form.jumlah.value),
          p_nama_pasien: form.nama_pasien.value.trim(), p_no_rm: form.no_rm.value.trim(), p_tujuan: form.tujuan.value.trim()
        });
        msg.textContent = '✅ Berhasil diupdate.'; msg.className = 'msg show ok';
        setTimeout(() => { modal.style.display = 'none'; renderKeluarPanel(); }, 1000);
      } catch (err) {
        msg.textContent = '❌ ' + err.message; msg.className = 'msg show err';
        btn.disabled = false; btn.textContent = 'Simpan Perubahan';
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
// 11. PANEL LAPORAN PEMAKAIAN (REVISI: Fix Tanggal & Pencarian)
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
          <div class="field">
            <label>Dari Tanggal</label>
            <input type="date" id="lap-mulai">
          </div>
          <div class="field">
            <label>Sampai Tanggal</label>
            <input type="date" id="lap-akhir">
          </div>
          <div class="field">
            <label>Vendor (Konsinyasi)</label>
            <select id="lap-vendor"><option value="">Semua Vendor</option>${optVendor}</select>
          </div>
          <button class="btn" id="btn-lap-tampil" style="margin-top:20px;">Tampilkan</button>
        </div>
      </div>
      <div id="lap-hasil"></div>
    `;

    // Set default ke tanggal 1 bulan ini s/d hari ini
    document.getElementById('lap-mulai').value = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
    document.getElementById('lap-akhir').value = todayISO();

    document.getElementById('btn-lap-tampil').addEventListener('click', async () => {
      const btn = document.getElementById('btn-lap-tampil');
      const mulai = document.getElementById('lap-mulai').value;
      const akhir = document.getElementById('lap-akhir').value;
      const vnd = document.getElementById('lap-vendor').value;

      btn.disabled = true; btn.textContent = 'Memuat...';

      try {
        // 1. Ambil data dasar
        let q = sb.from('v_laporan_pemakaian_sp').select('*').eq('status_kepemilikan', 'konsinyasi');
        
        // 2. Terapkan filter hanya jika tanggal diisi
        if (mulai) q = q.gte('tanggal', mulai);
        if (akhir) q = q.lte('tanggal', akhir);
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
            <h3 style="margin:0;">Data Pemakaian Periode ${mulai || 'Awal'} s/d ${akhir || 'Akhir'}</h3>
            <button class="btn secondary" id="btn-export-csv">⬇ Export CSV</button>
          </div>
          <div class="table-wrap"><table>
            <thead><tr><th>No</th><th>Tanggal</th><th>Nama Pasien</th><th>No. RM</th><th>Nama Barang</th><th class="num">Jumlah</th><th>Tujuan</th></tr></thead><tbody>`;
        
        let totalQty = 0;
        data.forEach((r, i) => {
          totalQty += r.jumlah;
          // Format tanggal dari database (YYYY-MM-DD) ke format Indonesia (DD/MM/YYYY)
          const tglIndo = new Date(r.tanggal).toLocaleDateString('id-ID');
          html += `<tr>
            <td>${i + 1}</td>
            <td>${tglIndo}</td>
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

        // Fitur Export CSV
        document.getElementById('btn-export-csv').addEventListener('click', () => {
          let csvContent = "data:text/csv;charset=utf-8,";
          csvContent += "Tanggal,Nama Pasien,No Rekam Medik,Nama Barang,Jumlah,Tujuan\n";
          data.forEach(r => {
            const tglIndo = new Date(r.tanggal).toLocaleDateString('id-ID');
            csvContent += `"${tglIndo}","${r.nama_pasien}","${r.no_rekam_medik}","${r.nama_barang}",${r.jumlah},"${r.tujuan}"\n`;
          });
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement("a");
          link.setAttribute("href", encodedUri);
          link.setAttribute("download", `Lampiran_SP_${mulai || 'All'}_sd_${akhir || 'All'}.csv`);
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
// 13. PANEL PENYESUAIAN STOK (REVISI: +Status, +Vendor, +Batch)
// ============================================================
async function renderPenyesuaianPanel() {
  try {
    const gudang = await selectView('gudang');
    const master = await selectView('master_barang', { eq: { aktif: true }, order: { column: 'nama_barang' } });
    const vendor = await selectView('vendor', { order: { column: 'nama' } });
    
    let optGudang = gudang.map(g => `<option value="${g.id}">${g.nama}</option>`).join('');
    let optBarang = master.map(m => `<option value="${m.kode_barang}">${m.kode_barang} - ${m.nama_barang}</option>`).join('');
    let optVendor = vendor.map(v => `<option value="${v.id}">${v.nama}</option>`).join('');

    const riwayat = await selectView('v_kartu_stok', { eq: { jenis: 'penyesuaian' }, order: { column: 'created_at', ascending: false }, limit: 50 });

    pageContent.innerHTML = `
      <div class="card">
        <h3>Catat Penyesuaian Stok</h3>
        <form id="form-penyesuaian">
          <div class="field-grid">
            <div class="field"><label>Tanggal *</label><input type="date" name="tanggal" id="pny-tgl" required></div>
            <div class="field"><label>Pilih Barang *</label><select name="kode_barang" required><option value="">- Pilih -</option>${optBarang}</select></div>
            <div class="field"><label>Gudang *</label><select name="gudang_id" required>${optGudang}</select></div>
            <div class="field">
              <label>Jenis *</label>
              <select name="jenis" required>
                <option value="tambah">Tambah (Fisik > Sistem)</option>
                <option value="kurang">Kurang (Fisik < Sistem / Rusak)</option>
              </select>
            </div>
            <div class="field"><label>Jumlah *</label><input type="number" name="jumlah" min="1" required></div>
            
            <div class="field">
              <label>Status Kepemilikan *</label>
              <select name="status" id="pny-status" required>
                <option value="milik_rs">Milik RS</option>
                <option value="konsinyasi">Konsinyasi</option>
              </select>
            </div>
            <div class="field">
              <label>Vendor *</label>
              <select name="vendor_id" id="pny-vendor" required>
                <option value="">- Pilih Vendor -</option>
                ${optVendor}
              </select>
            </div>
            <div class="field"><label>No. Batch *</label><input type="text" name="no_batch" placeholder="-" required></div>
            
            <div class="field full"><label>Alasan *</label><input type="text" name="alasan" required placeholder="Contoh: Barang rusak / Selisih opname"></div>
          </div>
          <button class="btn" type="submit" style="margin-top:16px;" id="btn-pny">Simpan Penyesuaian</button>
          <div class="msg" id="msg-pny"></div>
        </form>
      </div>

      <div class="card">
        <h3>Riwayat Penyesuaian (50 Terakhir)</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Tanggal</th><th>Barang</th><th>Gudang</th><th>Status/Vendor</th><th>Jenis</th><th class="num">Jumlah</th><th>Aksi</th></tr></thead><tbody>
          ${riwayat.length === 0 ? '<tr><td colspan="7" class="empty">Belum ada riwayat penyesuaian.</td></tr>' : ''}
          ${riwayat.map(r => {
            const isTambah = r.qty > 0;
            return `<tr>
              <td>${new Date(r.tanggal).toLocaleDateString('id-ID')}</td>
              <td>${escapeHtml(r.nama_barang)}</td>
              <td>${r.dari_gudang || r.ke_gudang || '-'}</td>
              <td>
                ${r.status_kepemilikan === 'konsinyasi' ? '<span class="badge warn">Konsinyasi</span>' : 'Milik RS'}<br>
                <small>${escapeHtml(r.vendor || '-')}</small>
              </td>
              <td style="color:${isTambah ? 'var(--success)' : 'var(--danger)'}; font-weight:600;">${isTambah ? 'Tambah' : 'Kurang'}</td>
              <td class="num">${angka(Math.abs(r.qty))}</td>
              <td>
                <button class="btn secondary btn-edit-pny" 
                  data-id="${r.id}" 
                  data-tgl="${r.tanggal}" 
                  data-jenis="${isTambah ? 'tambah' : 'kurang'}" 
                  data-jml="${Math.abs(r.qty)}" 
                  data-alasan="${r.alasan || ''}"
                  data-status="${r.status_kepemilikan}"
                  data-vendor="${r.vendor_id || ''}"
                  data-batch="${r.no_batch || '-'}"
                  style="padding:4px 10px;font-size:11px;margin-right:4px;">Edit</button>
                <button class="btn secondary btn-hapus-pny" data-id="${r.id}" style="padding:4px 10px;font-size:11px;background:#fbeae8;color:var(--danger);">Hapus</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody></table></div>
      </div>

      <!-- MODAL EDIT PENYESUAIAN -->
      <div id="modal-edit-pny" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;">
        <div style="background:#fff; padding:24px; border-radius:12px; width:100%; max-width:500px;">
          <h3 style="margin-bottom:16px;">Edit Penyesuaian</h3>
          <form id="form-edit-pny">
            <input type="hidden" name="id">
            <div class="field-grid" style="grid-template-columns: 1fr 1fr;">
              <div class="field full"><label>Tanggal *</label><input type="date" name="tanggal" required></div>
              <div class="field"><label>Jenis *</label><select name="jenis" required><option value="tambah">Tambah</option><option value="kurang">Kurang</option></select></div>
              <div class="field"><label>Jumlah *</label><input type="number" name="jumlah" min="1" required></div>
              
              <div class="field">
                <label>Status *</label>
                <select name="status" required>
                  <option value="milik_rs">Milik RS</option>
                  <option value="konsinyasi">Konsinyasi</option>
                </select>
              </div>
              <div class="field">
                <label>Vendor *</label>
                <select name="vendor_id" required>
                  <option value="">- Pilih Vendor -</option>
                  ${optVendor}
                </select>
              </div>
              <div class="field full"><label>No. Batch *</label><input type="text" name="no_batch" required></div>
              <div class="field full"><label>Alasan *</label><input type="text" name="alasan" required></div>
            </div>
            <div style="margin-top:20px; display:flex; gap:10px; justify-content:flex-end;">
              <button type="button" class="btn secondary" id="btn-batal-edit-pny">Batal</button>
              <button type="submit" class="btn" id="btn-submit-edit-pny">Simpan Perubahan</button>
            </div>
            <div class="msg" id="msg-edit-pny" style="margin-top:10px;"></div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('pny-tgl').value = todayISO();

    // 1. Submit Baru
    document.getElementById('form-penyesuaian').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-pny'); btn.disabled = true; btn.textContent = 'Menyimpan...';
      const msg = document.getElementById('msg-pny'); msg.className = 'msg';
      const form = e.target;

      try {
        await callRpc('rpc_penyesuaian_langsung', {
          p_tanggal: form.tanggal.value, p_kode_barang: form.kode_barang.value,
          p_gudang_id: form.gudang_id.value, p_jenis: form.jenis.value,
          p_jumlah: Number(form.jumlah.value), p_alasan: form.alasan.value.trim(),
          p_status: form.status.value, p_vendor_id: form.vendor_id.value || null, p_no_batch: form.no_batch.value
        });
        msg.textContent = '✅ Penyesuaian berhasil disimpan.'; msg.className = 'msg show ok';
        setTimeout(() => renderPenyesuaianPanel(), 1000);
      } catch (err) {
        msg.textContent = '❌ ' + err.message; msg.className = 'msg show err';
        btn.disabled = false; btn.textContent = 'Simpan Penyesuaian';
      }
    });

    // 2. Hapus
    document.querySelectorAll('.btn-hapus-pny').forEach(btn => {
      btn.addEventListener('click', async function() {
        if (!confirm('Yakin hapus penyesuaian ini? Stok akan dikembalikan ke posisi semula.')) return;
        this.disabled = true; this.textContent = '...';
        try {
          await callRpc('rpc_hapus_penyesuaian', { p_transaksi_id: this.dataset.id });
          renderPenyesuaianPanel();
        } catch (err) { alert(err.message); this.disabled = false; this.textContent = 'Hapus'; }
      });
    });

    // 3. Buka Modal Edit
    const modal = document.getElementById('modal-edit-pny');
    document.querySelectorAll('.btn-edit-pny').forEach(btn => {
      btn.addEventListener('click', function() {
        const form = document.getElementById('form-edit-pny');
        form.id.value = this.dataset.id;
        form.tanggal.value = this.dataset.tgl;
        form.jenis.value = this.dataset.jenis;
        form.jumlah.value = this.dataset.jml;
        form.alasan.value = this.dataset.alasan;
        form.status.value = this.dataset.status;
        form.vendor_id.value = this.dataset.vendor;
        form.no_batch.value = this.dataset.batch;
        modal.style.display = 'flex';
      });
    });

    document.getElementById('btn-batal-edit-pny').addEventListener('click', () => modal.style.display = 'none');

    // 4. Submit Edit
    document.getElementById('form-edit-pny').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-submit-edit-pny'); btn.disabled = true; btn.textContent = 'Menyimpan...';
      const msg = document.getElementById('msg-edit-pny'); msg.className = 'msg';
      const form = e.target;

      try {
        await callRpc('rpc_edit_penyesuaian', {
          p_transaksi_id: form.id.value,
          p_tanggal: form.tanggal.value,
          p_jenis: form.jenis.value,
          p_jumlah: Number(form.jumlah.value),
          p_alasan: form.alasan.value.trim(),
          p_status: form.status.value,
          p_vendor_id: form.vendor_id.value || null,
          p_no_batch: form.no_batch.value
        });
        msg.textContent = '✅ Berhasil diupdate.'; msg.className = 'msg show ok';
        setTimeout(() => { modal.style.display = 'none'; renderPenyesuaianPanel(); }, 1000);
      } catch (err) {
        msg.textContent = '❌ ' + err.message; msg.className = 'msg show err';
        btn.disabled = false; btn.textContent = 'Simpan Perubahan';
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
