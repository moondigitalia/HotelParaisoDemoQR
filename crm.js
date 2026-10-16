// Envía un prospecto a Escala a través del puente seguro (la clave nunca está en la página).
(function () {
  var URL = /\.vercel\.app$/.test(location.hostname) ? '/api/escala' : 'https://u3m-demo.vercel.app/api/escala';
  window.u3mEscala = function (datos) {
    try {
      return fetch(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(datos), keepalive: true })
        .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
        .catch(function () { return { ok: false }; });
    } catch (e) { return Promise.resolve({ ok: false }); }
  };
})();
