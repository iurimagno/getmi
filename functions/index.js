const { setGlobalOptions } = require('firebase-functions');
const { onRequest } = require('firebase-functions/https');
const https = require('https');
const http  = require('http');

setGlobalOptions({ maxInstances: 10 });

/**
 * resolveLink — segue redirects de links encurtados e retorna a URL final.
 * Exposto em /api/resolve-link via rewrite no firebase.json.
 * Restrito a domínios conhecidos de short links de música.
 */
exports.resolveLink = onRequest({ cors: true }, async (req, res) => {
  const url = (req.query.url || '').trim();

  const ALLOWED = /^https?:\/\/(link\.deezer\.com|music\.apple\.com|bit\.ly|smarturl\.it)\//i;
  if (!url || !ALLOWED.test(url)) {
    res.status(400).json({ error: 'URL não permitida' });
    return;
  }

  try {
    const resolved = await followRedirects(url, 8);
    res.json({ url: resolved });
  } catch (e) {
    res.status(500).json({ error: 'Não foi possível resolver o link' });
  }
});

function followRedirects(url, remaining) {
  return new Promise(function (resolve, reject) {
    if (remaining === 0) { resolve(url); return; }

    var lib = url.startsWith('https') ? https : http;
    var req = lib.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; getmi-bot/1.0)' },
      timeout: 5000
    }, function (res) {
      res.resume(); // descarta o body
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        var next;
        try { next = new URL(res.headers.location, url).href; } catch (e) { resolve(url); return; }
        resolve(followRedirects(next, remaining - 1));
      } else {
        resolve(url);
      }
    });
    req.on('error', reject);
    req.on('timeout', function () { req.destroy(); reject(new Error('timeout')); });
  });
}
