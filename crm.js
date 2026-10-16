// Envía un prospecto a Escala a través del puente seguro (la clave nunca está en la página).
(function () {
  // Solo la versión oficial (Vercel / dominio de U3M) guarda en Escala.
  // La copia interna de pruebas (Cloudflare) NO escribe en el Escala del cliente, para no llenarlo de pruebas.
  var h = location.hostname;
  var OFICIAL = /^u3m-demo(-[a-z0-9-]+)?\.vercel\.app$/.test(h) || /(^|\.)u3m\.edu\.mx$/.test(h);
  var URL = /\.vercel\.app$/.test(h) ? '/api/escala' : 'https://u3m-demo.vercel.app/api/escala';
  window.u3mEscala = function (datos) {
    if (!OFICIAL) { try { console.info('[U3M] Copia de pruebas: este registro no se envía a Escala.', datos); } catch (e) {} return Promise.resolve({ ok: true, prueba: true }); }
    try {
      return fetch(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(datos), keepalive: true })
        .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
        .catch(function () { return { ok: false }; });
    } catch (e) { return Promise.resolve({ ok: false }); }
  };
})();
