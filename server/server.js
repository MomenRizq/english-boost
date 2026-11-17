// English Boost API — zero-dependency Node.js server (Node 18+)
// Stores users + progress in a JSON file. Run behind nginx: location /english/api/ -> http://127.0.0.1:PORT/api/
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = +process.env.PORT || 3311;
const HOST = process.env.HOST || '127.0.0.1';
// Keep data OUTSIDE the web root so db.json can never be downloaded.
const DATA_DIR = process.env.DATA_DIR || path.join(os.homedir(), '.english-boost-data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_DAYS = 60;
const MAX_BODY = 2 * 1024 * 1024;

if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
  console.error('ERROR: set ADMIN_PASSWORD env var (min 8 chars).');
  process.exit(1);
}

// ---------- storage ----------
fs.mkdirSync(DATA_DIR, { recursive: true });
let db = { users: [], sessions: {}, progress: {} };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); } catch (e) { /* new db */ }
let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
  }, 200);
}
function flushSync() { clearTimeout(saveTimer); const tmp = DB_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DB_FILE); }
process.on('SIGINT', () => { flushSync(); process.exit(0); });
process.on('SIGTERM', () => { flushSync(); process.exit(0); });

// ---------- crypto helpers ----------
function hashPw(pw, salt = crypto.randomBytes(16).toString('hex')) {
  const h = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return `${salt}:${h}`;
}
function checkPw(pw, stored) {
  const [salt, h] = String(stored).split(':');
  if (!salt || !h) return false;
  const a = Buffer.from(crypto.scryptSync(String(pw), salt, 64).toString('hex'));
  const b = Buffer.from(h);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function safeEq(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
const newToken = () => crypto.randomBytes(32).toString('hex');
const newId = () => crypto.randomBytes(6).toString('hex');

// ---------- rate limit (login) ----------
const attempts = new Map();
function limited(key) {
  const now = Date.now(), win = 15 * 60 * 1000;
  const a = (attempts.get(key) || []).filter(t => now - t < win);
  attempts.set(key, a);
  return a.length >= 10;
}
function failed(key) { (attempts.get(key) || attempts.set(key, []).get(key)).push(Date.now()); }

// ---------- sessions ----------
function createSession(kind, userId) {
  const t = newToken();
  db.sessions[t] = { kind, userId, exp: Date.now() + SESSION_DAYS * 864e5 };
  persist();
  return t;
}
function getSession(req) {
  const m = /^Bearer\s+([a-f0-9]{64})$/i.exec(req.headers.authorization || '');
  if (!m) return null;
  const s = db.sessions[m[1]];
  if (!s) return null;
  if (s.exp < Date.now()) { delete db.sessions[m[1]]; persist(); return null; }
  return Object.assign({ token: m[1] }, s);
}
function purgeSessions(userId) {
  for (const [t, s] of Object.entries(db.sessions)) if (s.userId === userId) delete db.sessions[t];
}

// ---------- http helpers ----------
function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new Error('too_large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(new Error('bad_json')); } });
    req.on('error', reject);
  });
}
const clientIp = req => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
const publicUser = u => ({ id: u.id, username: u.username, name: u.name, createdAt: u.createdAt, lastSeen: u.lastSeen || null });
const cleanUsername = s => String(s || '').trim().toLowerCase();

function summary(p) {
  p = p || {};
  const known = Object.keys(p.known || {}).length;
  const plan = Object.keys(p.plan || {}).length;
  const exams = Array.isArray(p.exams) ? p.exams : [];
  const best = exams.length ? Math.max(...exams.map(e => Math.round(e.s / e.n * 100))) : null;
  const last = exams.length ? Math.round(exams[exams.length - 1].s / exams[exams.length - 1].n * 100) : null;
  return { known, plan, exams: exams.length, best, last, mistakes: Array.isArray(p.mist) ? p.mist.length : 0 };
}

// ---------- routes ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  let p = url.pathname.replace(/\/+$/, '');
  if (p.startsWith('/english')) p = p.slice(8); // tolerate nginx passing the full path
  const M = req.method;

  if (p === '/api/health') return send(res, 200, { ok: true });

  // --- user auth
  if (p === '/api/login' && M === 'POST') {
    const ip = clientIp(req);
    if (limited('u:' + ip)) return send(res, 429, { error: 'محاولات كثيرة، حاول بعد 15 دقيقة' });
    const b = await readBody(req);
    const u = db.users.find(x => x.username === cleanUsername(b.username));
    if (!u || !checkPw(b.password, u.pw)) { failed('u:' + ip); return send(res, 401, { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }); }
    u.lastSeen = Date.now(); persist();
    return send(res, 200, { token: createSession('user', u.id), user: publicUser(u) });
  }
  if (p === '/api/logout' && M === 'POST') {
    const s = getSession(req); if (s) { delete db.sessions[s.token]; persist(); }
    return send(res, 200, { ok: true });
  }

  // --- user data
  if (p === '/api/me' || p === '/api/progress') {
    const s = getSession(req);
    if (!s || s.kind !== 'user') return send(res, 401, { error: 'unauthorized' });
    const u = db.users.find(x => x.id === s.userId);
    if (!u) return send(res, 401, { error: 'unauthorized' });
    if (p === '/api/me') return send(res, 200, { user: publicUser(u) });
    if (M === 'GET') return send(res, 200, { progress: db.progress[u.id] || {} });
    if (M === 'PUT') {
      const b = await readBody(req);
      const pr = b.progress;
      if (!pr || typeof pr !== 'object' || Array.isArray(pr)) return send(res, 400, { error: 'bad progress' });
      db.progress[u.id] = { known: pr.known || {}, plan: pr.plan || {}, mist: pr.mist || [], exams: pr.exams || [], drafts: pr.drafts || {}, spoken: pr.spoken || {}, built: +pr.built || 0, last: pr.last || null, updatedAt: Date.now() };
      u.lastSeen = Date.now(); persist();
      return send(res, 200, { ok: true });
    }
  }

  // --- admin
  if (p === '/api/admin/login' && M === 'POST') {
    const ip = clientIp(req);
    if (limited('a:' + ip)) return send(res, 429, { error: 'محاولات كثيرة، حاول بعد 15 دقيقة' });
    const b = await readBody(req);
    if (!safeEq(b.password || '', ADMIN_PASSWORD)) { failed('a:' + ip); return send(res, 401, { error: 'كلمة مرور الأدمن غير صحيحة' }); }
    return send(res, 200, { token: createSession('admin', 'admin') });
  }
  if (p.startsWith('/api/admin/')) {
    const s = getSession(req);
    if (!s || s.kind !== 'admin') return send(res, 401, { error: 'unauthorized' });
    if (p === '/api/admin/users' && M === 'GET') {
      return send(res, 200, { users: db.users.map(u => Object.assign(publicUser(u), { stats: summary(db.progress[u.id]) })) });
    }
    if (p === '/api/admin/users' && M === 'POST') {
      const b = await readBody(req);
      const username = cleanUsername(b.username);
      if (!/^[a-z0-9_.-]{3,30}$/.test(username)) return send(res, 400, { error: 'اسم المستخدم: 3-30 حرف إنجليزي/أرقام بدون مسافات' });
      if (!b.password || String(b.password).length < 4) return send(res, 400, { error: 'كلمة المرور 4 حروف على الأقل' });
      if (db.users.some(u => u.username === username)) return send(res, 409, { error: 'اسم المستخدم موجود بالفعل' });
      const u = { id: newId(), username, name: String(b.name || username).slice(0, 60), pw: hashPw(b.password), createdAt: Date.now() };
      db.users.push(u); persist();
      return send(res, 201, { user: publicUser(u) });
    }
    const m = /^\/api\/admin\/users\/([a-f0-9]+)(?:\/(password|reset-progress|progress))?$/.exec(p);
    if (m) {
      const u = db.users.find(x => x.id === m[1]);
      if (!u) return send(res, 404, { error: 'not found' });
      if (!m[2] && M === 'DELETE') {
        db.users = db.users.filter(x => x.id !== u.id); delete db.progress[u.id]; purgeSessions(u.id); persist();
        return send(res, 200, { ok: true });
      }
      if (m[2] === 'progress' && M === 'GET') return send(res, 200, { user: publicUser(u), progress: db.progress[u.id] || {} });
      if (m[2] === 'password' && M === 'POST') {
        const b = await readBody(req);
        if (!b.password || String(b.password).length < 4) return send(res, 400, { error: 'كلمة المرور 4 حروف على الأقل' });
        u.pw = hashPw(b.password); purgeSessions(u.id); persist();
        return send(res, 200, { ok: true });
      }
      if (m[2] === 'reset-progress' && M === 'POST') {
        delete db.progress[u.id]; persist();
        return send(res, 200, { ok: true });
      }
    }
  }
  return send(res, 404, { error: 'not found' });
}

http.createServer((req, res) => {
  handle(req, res).catch(e => send(res, e.message === 'too_large' ? 413 : e.message === 'bad_json' ? 400 : 500, { error: e.message === 'too_large' || e.message === 'bad_json' ? e.message : 'server error' }));
}).listen(PORT, HOST, () => console.log(`English Boost API on http://${HOST}:${PORT}`));
