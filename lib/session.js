const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '..', 'data', 'sessions');
const SESSION_COOKIE = 'scst_sid';
const SESSION_MAX_AGE = 8 * 60 * 60 * 1000; // 8 hours

function ensureDir() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
}

function loadSession(sid) {
  ensureDir();
  const filePath = path.join(SESSION_DIR, sid + '.json');
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Date.now() - data._created > SESSION_MAX_AGE) {
      fs.unlinkSync(filePath);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveSession(sid, data) {
  ensureDir();
  const filePath = path.join(SESSION_DIR, sid + '.json');
  fs.writeFileSync(filePath, JSON.stringify(data));
}

function destroySession(sid) {
  const filePath = path.join(SESSION_DIR, sid + '.json');
  try { fs.unlinkSync(filePath); } catch {}
}

function sessionMiddleware(req, res, next) {
  let sid = req.cookies[SESSION_COOKIE];
  let session = null;

  if (sid) {
    session = loadSession(sid);
  }

  if (!session) {
    sid = crypto.randomUUID();
    session = { _created: Date.now() };
  }

  req.session = session;
  req.sessionId = sid;

  // Intercept writeHead to inject session cookie
  const origWriteHead = res.writeHead.bind(res);
  res.writeHead = function(statusCode, ...args) {
    saveSession(sid, req.session);
    // Inject Set-Cookie header
    const cookieVal = `${SESSION_COOKIE}=${sid}; Path=/; HttpOnly; Max-Age=${SESSION_MAX_AGE / 1000}`;
    if (args.length > 0 && typeof args[args.length - 1] === 'object') {
      const headers = args[args.length - 1];
      headers['Set-Cookie'] = cookieVal;
    } else {
      args.push({ 'Set-Cookie': cookieVal });
    }
    origWriteHead(statusCode, ...args);
  };

  req.destroySession = () => {
    destroySession(sid);
    req.session = { _created: Date.now() };
  };

  next();
}

module.exports = { sessionMiddleware };
