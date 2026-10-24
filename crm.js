// Envía un prospecto a Escala a través del puente seguro (la clave nunca está en la página).
(function () {
  // Solo la versión oficial (Vercel / dominio de U3M) guarda en Escala.
  // La copia interna de pruebas (Cloudflare) NO escribe en el Escala del cliente, para no llenarlo de pruebas.
  var h = location.hostname;
  var OFICIAL = /^u3m-demo(-[a-z0-9-]+)?\.vercel\.app$/.test(h) || /(^|\.)u3m\.edu\.mx$/.test(h);
  var URL = /\.vercel\.app$/.test(h) ? '/api/escala' : 'https://u3m-demo.vercel.app/api/escala';
  // Convierte el nombre de una carrera (como lo escriba la persona) a la clave que usa Escala (PSI, ARQ, DG…)
  var quita = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); };
  window.u3mCodigos = function (texto) {
    var L = window.U3M_CARRERAS || [], t = quita(texto), out = [];
    if (!t) return out;
    var exacta = L.filter(function (c) { return quita(c.name) === t || c.code.toLowerCase() === t; })[0];
    if (exacta) return [exacta.code];
    var ALIAS = { marketing: 'MKT', mercadotecnia: 'MKT', turismo: 'LAET', turistic: 'LAET', contabilidad: 'CAP', contador: 'CAP', 'negocios internacionales': 'CNI', comercio: 'CNI', 'gestion empresarial': 'IGE', industrial: 'IIS', sistemas: 'IIS', diseno: 'DG', derecho: 'DAJ', leyes: 'DAJ', abogad: 'DAJ', psicolog: 'PSI', educacion: 'EDU', pedagog: 'EDU', arquitect: 'ARQ', comunicacion: 'COM', periodismo: 'COM' };
    Object.keys(ALIAS).forEach(function (k) { if (t.indexOf(k) > -1 && out.indexOf(ALIAS[k]) < 0) out.push(ALIAS[k]); });
    L.forEach(function (c) {
      var n = quita(c.name), code = c.code.toLowerCase();
      var hit = t === n || t === code || t.indexOf(n) > -1 || (n.length > 6 && n.indexOf(t) > -1 && t.length > 4);
      if (hit && out.indexOf(c.code) < 0) out.push(c.code);
    });
    // "Administración de Empresas Turísticas" también contiene "Administración de Empresas"
    if (out.indexOf('LAET') > -1 && out.indexOf('LAE') > -1 && t.indexOf('turistic') > -1 && t.split(/,| y /).length < 2) out.splice(out.indexOf('LAE'), 1);
    return out;
  };
  window.u3mModalidad = function (texto) { var t = quita(texto); return /sabat/.test(t) ? 'EJE' : /escolar/.test(t) ? 'ESC' : ''; };
  window.u3mEscala = function (datos) {
    if (!OFICIAL) { try { console.info('[U3M] Copia de pruebas: este registro no se envía a Escala.', datos); } catch (e) {} return Promise.resolve({ ok: true, prueba: true }); }
    try {
      return fetch(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(datos), keepalive: true })
        .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
        .catch(function () { return { ok: false }; });
    } catch (e) { return Promise.resolve({ ok: false }); }
  };
})();

// Teléfonos: el +52 ya viene puesto (fijo, a la izquierda) y la persona solo escribe sus 10 dígitos.
// Si pega un número con +52, 52 o 521 al inicio, se quita solo. Aplica a todos los campos de teléfono, también a los que se agregan después.
(function () {
  var st = document.createElement('style');
  st.textContent = '.tel52{position:relative;display:block;width:100%}' +
    '.tel52>.pre{position:absolute;left:14px;top:50%;transform:translateY(-50%);font:700 16px var(--body,system-ui);color:var(--navy,#12233B);pointer-events:none;padding-right:10px;border-right:1.5px solid #D5DEE6;line-height:1.2}' +
    '.tel52>input{padding-left:70px!important}';
  document.head.appendChild(st);
  var limpia = function (v) {
    var d = String(v || '').replace(/\D/g, '');
    if (d.length > 10 && d.indexOf('521') === 0) d = d.slice(3);
    else if (d.length > 10 && d.indexOf('52') === 0) d = d.slice(2);
    d = d.slice(0, 10);
    return d.length > 6 ? d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6) : d.length > 3 ? d.slice(0, 3) + ' ' + d.slice(3) : d;
  };
  var arma = function (inp) {
    if (inp.getAttribute('data-tel52')) return;
    inp.setAttribute('data-tel52', '1');
    var w = document.createElement('span'); w.className = 'tel52';
    inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
    var pre = document.createElement('span'); pre.className = 'pre'; pre.textContent = '+52'; pre.setAttribute('aria-hidden', 'true');
    w.insertBefore(pre, inp);
    inp.setAttribute('inputmode', 'numeric');
    // si el campo no tiene etiqueta visible (su texto guía dice qué es), se conserva; si no, se muestra un ejemplo de 10 dígitos
    if (!/[a-z]/i.test(inp.getAttribute('placeholder') || '')) inp.setAttribute('placeholder', '229 000 0000');
    inp.addEventListener('input', function () { var n = limpia(inp.value); if (n !== inp.value) inp.value = n; });
    if (inp.value) inp.value = limpia(inp.value);
  };
  var todo = function (raiz) { [].forEach.call((raiz || document).querySelectorAll('input[type=tel]'), arma); };
  var go = function () {
    todo();
    new MutationObserver(function (m) { m.forEach(function (r) { [].forEach.call(r.addedNodes, function (n) { if (n.nodeType === 1) { if (n.matches && n.matches('input[type=tel]')) arma(n); else todo(n); } }); }); })
      .observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
