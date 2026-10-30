// La foto que sale cuando alguien comparte el link de la página (WhatsApp, Facebook…).
// Si el dueño puso la suya en su panel, sale esa; si no, la de siempre.
const { leerConfig } = require('./_lib');

module.exports = async (req, res) => {
  let url = '';
  try { url = (await leerConfig()).compartir || ''; } catch (e) { url = ''; }
  if (url) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        res.statusCode = 200;
        res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.end(buf);
      }
    } catch (e) { /* si falla, la de siempre */ }
  }
  res.statusCode = 302;
  res.setHeader('Location', '/assets/og.jpg');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.end();
};
