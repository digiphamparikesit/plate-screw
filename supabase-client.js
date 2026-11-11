// ============================================================
// SUPABASE CLIENT — Init + Auth + RPC + Query Helpers
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// ============================================================
// INIT CLIENT
// ============================================================
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// ============================================================
// AUTH
// ============================================================
export async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function signOut() {
  const { error } = await sb.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getSession() {
  const { data, error } = await sb.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session;
}

export async function getUser() {
  const { data, error } = await sb.auth.getUser();
  if (error) return null;
  return data.user;
}

export function onAuthChange(callback) {
  return sb.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

// ============================================================
// RPC WRAPPER — error handling terpusat
// ============================================================
export async function callRpc(fnName, params = {}) {
  const { data, error } = await sb.rpc(fnName, params);
  if (error) {
    // Terjemahkan error Postgres umum ke pesan manusiawi
    throw new Error(translateError(error.message));
  }
  if (data && typeof data === 'object' && data.sukses === false) {
    throw new Error(data.pesan || 'Operasi gagal');
  }
  return data;
}

// ============================================================
// QUERY HELPERS
// ============================================================
export async function selectView(viewName, { select = '*', eq = {}, gte = {}, lte = {}, order = null, limit = null, ilike = {} } = {}) {
  let q = sb.from(viewName).select(select);
  for (const [k, v] of Object.entries(eq)) {
    if (v !== undefined && v !== null && v !== '') q = q.eq(k, v);
  }
  for (const [k, v] of Object.entries(gte)) {
    if (v) q = q.gte(k, v);
  }
  for (const [k, v] of Object.entries(lte)) {
    if (v) q = q.lte(k, v);
  }
  for (const [k, v] of Object.entries(ilike)) {
    if (v) q = q.ilike(k, `%${v}%`);
  }
  if (order) q = q.order(order.column, { ascending: order.ascending ?? true });
  if (limit) q = q.limit(limit);

  const { data, error } = await q;
  if (error) throw new Error(translateError(error.message));
  return data || [];
}

export async function selectTable(tableName, opts = {}) {
  return selectView(tableName, opts);
}

export async function insertRow(tableName, row) {
  const { data, error } = await sb.from(tableName).insert(row).select().single();
  if (error) throw new Error(translateError(error.message));
  return data;
}

export async function updateRow(tableName, id, patch) {
  const { data, error } = await sb.from(tableName).update(patch).eq('id', id).select().single();
  if (error) throw new Error(translateError(error.message));
  return data;
}

export async function deleteRow(tableName, id) {
  const { error } = await sb.from(tableName).delete().eq('id', id);
  if (error) throw new Error(translateError(error.message));
}

// ============================================================
// UTILITY — Rupiah, Tanggal, Escape
// ============================================================
export function rupiah(n) {
  const num = Number(n) || 0;
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

export function angka(n) {
  return (Number(n) || 0).toLocaleString('id-ID');
}

export function tanggalIndo(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function awalBulanISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================
// TRANSLATE ERROR POSTGRES → PESAN MANUSIAWI
// ============================================================
function translateError(msg) {
  if (!msg) return 'Terjadi kesalahan tidak diketahui';
  const m = msg.toLowerCase();

  if (m.includes('duplicate key') && m.includes('kode_barang'))
    return 'Kode barang sudah dipakai. Gunakan kode lain.';
  if (m.includes('duplicate key') && m.includes('vendor'))
    return 'Vendor dengan nama itu sudah ada.';
  if (m.includes('duplicate key') && m.includes('stok_batch'))
    return 'Batch dengan kombinasi ini sudah ada.';
  if (m.includes('violates check constraint') && m.includes('qty_on_hand'))
    return 'Stok tidak boleh negatif. Periksa jumlah transaksi.';
  if (m.includes('violates foreign key'))
    return 'Data terkait tidak ditemukan atau masih dipakai.';
  if (m.includes('invalid login credentials'))
    return 'Email atau password salah.';
  if (m.includes('email not confirmed'))
    return 'Email belum dikonfirmasi. Hubungi admin.';
  if (m.includes('jwt expired'))
    return 'Sesi habis. Silakan login ulang.';

  return msg;
}

// ============================================================
// EXPOSE UNTUK DEBUG DI CONSOLE (opsional)
// ============================================================
if (typeof window !== 'undefined') {
  window.__sb = { sb, callRpc, selectView };
}
