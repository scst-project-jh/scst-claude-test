const url = require('url');
const querystring = require('querystring');
const crypto = require('crypto');

class Router {
  constructor() {
    this.routes = [];
    this.middleware = [];
  }

  use(fn) {
    this.middleware.push(fn);
  }

  get(path, ...handlers) {
    this.routes.push({ method: 'GET', path, handlers });
  }

  post(path, ...handlers) {
    this.routes.push({ method: 'POST', path, handlers });
  }

  async handle(req, res) {
    const parsed = url.parse(req.url, true);
    req.path = parsed.pathname;
    req.query = parsed.query || {};

    // Parse body for POST
    if (req.method === 'POST') {
      req.body = await parseBody(req);
    }

    // Parse cookies for session
    req.cookies = parseCookies(req);

    // Match route
    for (const route of this.routes) {
      if (route.method !== req.method) continue;
      const params = matchRoute(route.path, req.path);
      if (params !== null) {
        req.params = params;

        // Run middleware then handlers
        const allHandlers = [...this.middleware, ...route.handlers];
        let idx = 0;
        const next = async () => {
          if (idx < allHandlers.length) {
            const handler = allHandlers[idx++];
            await handler(req, res, next);
          }
        };
        await next();
        return true;
      }
    }
    return false;
  }
}

function matchRoute(pattern, pathname) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie || '';
  header.split(';').forEach(c => {
    const [key, val] = c.trim().split('=');
    if (key) cookies[key] = decodeURIComponent(val || '');
  });
  return cookies;
}

async function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const ct = req.headers['content-type'] || '';
      if (ct.includes('application/json')) {
        try { resolve(JSON.parse(body)); } catch { resolve({}); }
      } else {
        resolve(parseFormData(body));
      }
    });
  });
}

function parseFormData(body) {
  const result = {};
  const pairs = body.split('&');
  for (const pair of pairs) {
    const [key, val] = pair.split('=').map(s => decodeURIComponent(s.replace(/\+/g, ' ')));
    if (!key) continue;
    if (result[key] !== undefined) {
      if (!Array.isArray(result[key])) result[key] = [result[key]];
      result[key].push(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

module.exports = { Router };
