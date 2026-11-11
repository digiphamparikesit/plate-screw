// ============================================================
// APP.JS — Bagian 1: Auth & Navigasi Dasar
// ============================================================
import { sb, signIn, signOut, getSession, onAuthChange, selectView, escapeHtml, angka, rupiah, todayISO } from './supabase-client.js';

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

// State
let currentUser = null;

// ============================================================
// 1. LOGIKA AUTENTIKASI (LOGIN & LOGOUT)
// ============================================================
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  loginBtn.disabled = true;
  loginBtn.textContent = 'Memproses...';
  loginError.style.display = 'none';

  try {
    await signIn(email, password);
    // onAuthChange akan menangani perpindahan layar
  } catch (err) {
    loginError.textContent = err.message;
    loginError.style.display = 'block';
    loginBtn.disabled = false;
    loginBtn.textContent = 'Masuk';
  }
});

btnLogout.addEventListener('click', async () => {
  if (confirm('Yakin ingin keluar?')) {
    await signOut();
  }
});

// Pantau perubahan status login
onAuthChange(async (event, session) => {
  if (session) {
    currentUser = session.user;
    loginScreen.style.display = 'none';
    appScreen.classList.add('show');
    userDisplay.textContent = `👤 ${currentUser.email}`;
    
    // Muat halaman default
    navigateTo('stok');
  } else {
    currentUser = null;
    appScreen.classList.remove('show');
    loginScreen.style.display = 'flex';
    loginBtn.disabled = false;
    loginBtn.textContent = 'Masuk';
    loginForm.reset();
  }
});

// ============================================================
// 2. NAVIGASI SIDEBAR
// ============================================================
const tabMap = {
  stok: { title: 'Stok Saat Ini', render: renderStokPanel },
  // Tab lain akan ditambahkan nanti
  masterbarang: { title: 'Master Barang', render: () => pageContent.innerHTML = '<div class="card">Fitur Master Barang segera hadir.</div>' },
  parlevel: { title: 'Par Level', render: () => pageContent.innerHTML = '<div class="card">Fitur Par Level segera hadir.</div>' },
  masuk: { title: 'Barang Masuk', render: () => pageContent.innerHTML = '<div class="card">Fitur Barang Masuk segera hadir.</div>' },
  mutasi: { title: 'Mutasi', render: () => pageContent.innerHTML = '<div class="card">Fitur Mutasi segera hadir.</div>' },
  keluar: { title: 'Pengeluaran', render: () => pageContent.innerHTML = '<div class="card">Fitur Pengeluaran segera hadir.</div>' },
  penyesuaian: { title: 'Penyesuaian', render: () => pageContent.innerHTML = '<div class="card">Fitur Penyesuaian segera hadir.</div>' },
  approval: { title: 'Approval', render: () => pageContent.innerHTML = '<div class="card">Fitur Approval segera hadir.</div>' },
  notifikasi: { title: 'Konsinyasi', render: () => pageContent.innerHTML = '<div class="card">Fitur Notifikasi segera hadir.</div>' },
  opname: { title: 'Laporan Opname', render: () => pageContent.innerHTML = '<div class="card">Fitur Laporan Opname segera hadir.</div>' },
  pemakaian: { title: 'Lap. Pemakaian', render: () => pageContent.innerHTML = '<div class="card">Fitur Laporan Pemakaian segera hadir.</div>' },
  kartustok: { title: 'Kartu Stok', render: () => pageContent.innerHTML = '<div class="card">Fitur Kartu Stok segera hadir.</div>' }
};

menuItems.forEach(item => {
  item.addEventListener('click', () => navigateTo(item.dataset.tab));
});

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
// 3. PANEL STOK SAAT INI (Tabel Sederhana)
// ============================================================
async function renderStokPanel() {
  try {
    const stok = await selectView('v_stok_saat_ini', { order: { column: 'nama_barang', ascending: true } });
    
    if (stok.length === 0) {
      pageContent.innerHTML = '<div class="card"><div class="empty">Belum ada stok di gudang.</div></div>';
      return;
    }

    let html = `<div class="card">
      <h3>Stok Plate & Screw Saat Ini</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama Barang</th>
              <th>Gudang</th>
              <th>Status</th>
              <th class="num">Jumlah</th>
            </tr>
          </thead>
          <tbody>`;

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
    pageContent.innerHTML = `<div class="card"><div class="msg show err">Gagal memuat stok: ${err.message}</div></div>`;
  }
}
