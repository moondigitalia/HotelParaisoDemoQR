(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var WA = '522299096832';
  var money = function (n) { return '$' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var CARRERAS = window.U3M_CARRERAS || [];
  var AREAS = { neg: 'NEGOCIOS', ing: 'INGENIERÍA Y CONSTRUCCIÓN', crea: 'CREATIVIDAD Y COMUNICACIÓN', soc: 'SOCIALES Y HUMANIDADES' };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ---------- Intro: la ola ---------- */
  (function intro() {
    var ola = $('#ola');
    if (!ola) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var params = new URLSearchParams(location.search);
    if (reduce || params.has('sinola')) { ola.remove(); return; }
    var fx = $('#ola-fx');
    var W = window.innerWidth, H = window.innerHeight, k = Math.max(W / 1440, H / 900);
    var rnd = function (a, b) { return a + Math.random() * (b - a); };
    var html = '';
    for (var i = 0; i < 30; i++) {
      var r = rnd(320, 620) * k;
      html += '<div class="ola-espuma" style="left:' + rnd(-0.14, 0.97) * W + 'px;top:' + rnd(-0.28, 0.78) * H + 'px;width:' + r + 'px;height:' + r + 'px;animation-delay:' + rnd(-0.12, 0.1).toFixed(2) + 's"></div>';
    }
    for (var j = 0; j < 46; j++) {
      var s = rnd(8, 26);
      html += '<div class="ola-spray" style="left:' + (W / 2 + rnd(-0.35, 0.35) * W) + 'px;top:' + rnd(0.42, 0.67) * H + 'px;width:' + s + 'px;height:' + s + 'px;--dx:' + rnd(-0.62, 0.62) * W + 'px;--dy:' + rnd(-0.78, -0.11) * H + 'px;--s:' + rnd(2.5, 7).toFixed(1) + ';animation-delay:' + rnd(-0.1, 0.12).toFixed(2) + 's"></div>';
    }
    fx.innerHTML = html;
    var drops = document.createElement('div');
    drops.style.cssText = 'position:fixed;inset:0;z-index:210;pointer-events:none;overflow:hidden';
    var dh = '', sizes = [10, 12, 14, 16, 18, 22, 26, 30, 36, 44];
    for (var d = 0; d < 34; d++) {
      var z = sizes[Math.floor(Math.random() * sizes.length)];
      dh += '<div class="ola-gota" style="left:' + rnd(0.01, 0.97) * W + 'px;top:' + rnd(0.02, 0.95) * H + 'px;width:' + z + 'px;height:' + Math.round(z * rnd(1, 1.25)) + 'px;animation-delay:' + rnd(0, 0.35).toFixed(2) + 's"></div>';
    }
    drops.innerHTML = dh;
    document.body.appendChild(drops);
    document.body.classList.add('shake');
    document.documentElement.style.overflow = 'hidden';
    var done = false;
    var end = function () {
      if (done) return; done = true;
      document.documentElement.style.overflow = '';
      ola.remove();
      setTimeout(function () { drops.remove(); document.body.classList.remove('shake'); }, 2200);
    };
    setTimeout(end, 3500);
  })();

  /* ---------- Menú móvil ---------- */
  var burger = $('#burger'), mm = $('#mmenu');
  burger.addEventListener('click', function () {
    var open = mm.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  $$('#mmenu a').forEach(function (a) { a.addEventListener('click', function () { mm.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }); });

  /* ---------- Formulario (demo) ---------- */
  var sel = $('#f-carrera');
  CARRERAS.forEach(function (c) { var o = document.createElement('option'); o.textContent = c.name; sel.appendChild(o); });
  var o2 = document.createElement('option'); o2.textContent = 'Aún no lo decido'; sel.appendChild(o2);
  $('#lead-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var nombre = $('#f-nombre').value.trim(), tel = $('#f-wa').value.replace(/\D/g, ''), err = $('#f-err');
    var msg = !nombre ? 'Escribe tu nombre.' : tel.length !== 10 ? 'Tu WhatsApp debe tener 10 dígitos.' : !$('#f-ok').checked ? 'Acepta el aviso de privacidad para continuar.' : '';
    if (msg) { err.textContent = msg; err.style.display = 'block'; return; }
    err.style.display = 'none';
    var carrera = sel.value || 'por definir', modalidad = ($('input[name=modalidad]:checked') || {}).value || '';
    // DEMO: aquí se enviará el registro al CRM Escala (webhook). Por ahora solo se confirma en pantalla.
    var first = nombre.split(' ')[0];
    $('#ok-title').textContent = '¡Listo, ' + first + '!';
    $('#ok-text').textContent = 'Un asesor de admisiones te escribirá al ' + tel.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3') + ' con información de ' + carrera + '.';
    $('#ok-wa').href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent('Hola, soy ' + nombre + '. Me interesa ' + carrera + ' (modalidad ' + modalidad.toLowerCase() + ') en U3M.');
    $('#informes').classList.add('sent');
  });

  /* ---------- Carreras ---------- */
  var state = { area: 'todas', dur: 'all' };
  var chipDefs = [['todas', 'Todas'], ['neg', 'Negocios'], ['ing', 'Ingeniería y construcción'], ['crea', 'Creatividad y comunicación'], ['soc', 'Sociales y humanidades']];
  var durDefs = [['all', 'Todas'], ['3', '3 años'], ['4', '4 años']];
  var chips = $('#chips'), durs = $('#durs'), cards = $('#cards');
  chips.innerHTML = chipDefs.map(function (c) { return '<button type="button" class="chip" data-area="' + c[0] + '" aria-pressed="' + (c[0] === 'todas') + '">' + c[1] + '</button>'; }).join('');
  durs.innerHTML = durDefs.map(function (d) { return '<button type="button" data-dur="' + d[0] + '" aria-pressed="' + (d[0] === 'all') + '">' + d[1] + '</button>'; }).join('');
  function renderCards() {
    $$('.chip', chips).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.area === state.area); });
    $$('button', durs).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.dur === state.dur); });
    var list = CARRERAS.filter(function (c) { return (state.area === 'todas' || c.area === state.area) && (state.dur === 'all' || c.d === state.dur); });
    var h = list.map(function (c) {
      return '<button type="button" class="card" data-code="' + c.code + '"><span class="top"><span class="area">' + AREAS[c.area] + '</span><span class="tag t' + c.d + '">' + c.d + ' AÑOS</span></span>' +
        '<span class="name">' + esc(c.name) + '</span><span class="meta">' + c.periods + ' · ' + c.modal + '</span>' +
        '<span class="bot"><span>RVOE ' + c.rvoe + '</span><span>Plan de estudios →</span></span></button>';
    }).join('');
    if (state.area === 'todas' && state.dur === 'all') {
      h += '<a class="card cta" href="radar" style="text-decoration:none"><span class="area">¿AÚN NO DECIDES?</span><span class="name">Haz el Radar de Carrera: 7 preguntas, menos de 3 minutos</span><span class="go">Descubrir mis rutas →</span></a>';
    }
    cards.innerHTML = h;
  }
  chips.addEventListener('click', function (e) { var b = e.target.closest('[data-area]'); if (b) { state.area = b.dataset.area; renderCards(); } });
  durs.addEventListener('click', function (e) { var b = e.target.closest('[data-dur]'); if (b) { state.dur = b.dataset.dur; renderCards(); } });
  renderCards();

  /* modal */
  var modal = $('#modal'), current = null, lastFocus = null;
  function openModal(code) {
    var c = CARRERAS.filter(function (x) { return x.code === code; })[0]; if (!c) return;
    current = c; lastFocus = document.activeElement;
    $('#m-area').textContent = AREAS[c.area];
    $('#m-title').textContent = c.name;
    $('#m-info').innerHTML = '<span>' + (c.d === '3' ? '3 años · 9 cuatrimestres' : '4 años · 8 semestres') + '</span><span>Modalidad: ' + c.modal + '</span><span>RVOE ' + c.rvoe + '</span>';
    var b = '';
    if (c.perfil) b += '<div class="two"><div><h4>PERFIL DEL EGRESADO</h4><p>' + esc(c.perfil) + '</p></div><div><h4>CAMPO LABORAL</h4><p>' + esc(c.campo) + '</p></div></div>';
    if (c.plan.length) {
      b += '<div><h4>PLAN DE ESTUDIOS</h4><div class="plan">' + c.plan.map(function (p) { return '<div class="p"><b>' + p[0] + '</b><ul>' + p[1].map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul></div>'; }).join('') + '</div></div>';
    } else {
      b += '<p class="lead">El plan de estudios detallado de esta licenciatura te lo comparte un asesor de admisiones por WhatsApp.</p>';
    }
    $('#m-body').innerHTML = b;
    modal.classList.add('open'); document.documentElement.style.overflow = 'hidden';
    $('#m-close').focus();
  }
  function closeModal() { modal.classList.remove('open'); document.documentElement.style.overflow = ''; if (lastFocus) lastFocus.focus(); }
  cards.addEventListener('click', function (e) { var b = e.target.closest('[data-code]'); if (b) openModal(b.dataset.code); });
  $('#m-close').addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });
  $('#m-cta').addEventListener('click', function () { if (current) sel.value = current.name; closeModal(); });
  $('#m-ask').addEventListener('click', function () { var n = current && current.name; closeModal(); ask('Cuéntame de la carrera de ' + n + ': ¿de qué trata y dónde puedo trabajar?'); });

  /* ---------- Becas ---------- */
  var P1 = [2668, 2478, 2287, 2097, 1906], P2 = [2839, 2636, 2433, 2230, 2028], P3 = [3101, 2880, 2658, 2437, 2215];
  var PLANS = [
    { id: 'base', label: 'Licenciaturas cuatrimestrales', sys: 'Cuatrimestral · 3 años', sub: 'Administración, Turísticas, Negocios Internacionales, Mercadotecnia, Comunicación, Derecho y Educación.', p: P1, n: 3812 },
    { id: 'dg', label: 'Diseño Gráfico', sys: 'Cuatrimestral · 3 años', sub: 'Licenciatura en Diseño Gráfico, 9 cuatrimestres.', p: P2, n: 4055 },
    { id: 'ing', label: 'Ingenierías', sys: 'Cuatrimestral · 3 años', sub: 'Industrial y de Sistemas · Gestión Empresarial.', p: P3, n: 4430 },
    { id: 'psi', label: 'Psicología / Contaduría', sys: 'Semestral · 4 años', sub: 'Psicología · Contaduría y Auditoría, 8 semestres.', p: P1, n: 3812 },
    { id: 'arq', label: 'Arquitectura', sys: 'Semestral · 4 años', sub: 'Arquitectura y Administración de la Empresa Constructora.', p: P3, n: 4430 }
  ];
  var PROMS = [['8.0–8.4', 30], ['8.5–8.9', 35], ['9.0–9.4', 40], ['9.5–9.9', 45], ['10', 50]];
  var bs = { plan: 'dg', prom: 2 };
  $('#plans').innerHTML = PLANS.map(function (p) { return '<button type="button" class="opt" data-plan="' + p.id + '">' + p.label + '</button>'; }).join('');
  $('#proms').innerHTML = PROMS.map(function (r, i) { return '<button type="button" class="prom" data-prom="' + i + '"><b>' + r[0] + '</b><span>' + r[1] + '% beca</span></button>'; }).join('');
  function renderBeca() {
    var p = PLANS.filter(function (x) { return x.id === bs.plan; })[0], price = p.p[bs.prom], pct = PROMS[bs.prom][1];
    $$('#plans .opt').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.plan === bs.plan); });
    $$('#proms .prom').forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.prom === bs.prom); });
    $('#plan-sub').textContent = p.sub;
    $('#r-plan').textContent = p.label + ' · ' + p.sys;
    $('#r-pct').textContent = pct + '% DE BECA';
    $('#r-price').textContent = money(price);
    $('#r-normal').textContent = money(p.n);
    $('#r-save').textContent = 'Ahorras ' + money(p.n - price) + ' en cada colegiatura';
    $('#r-wa').href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent('Hola, calculé una beca de referencia del ' + pct + '% para ' + p.label + ' en U3M. ¿Me ayudan a validarla?');
  }
  $('#plans').addEventListener('click', function (e) { var b = e.target.closest('[data-plan]'); if (b) { bs.plan = b.dataset.plan; renderBeca(); } });
  $('#proms').addEventListener('click', function (e) { var b = e.target.closest('[data-prom]'); if (b) { bs.prom = +b.dataset.prom; renderBeca(); } });
  renderBeca();

  /* ---------- Puente con el chat de Mileni ---------- */
  window.__mileniQueue = window.__mileniQueue || [];
  function ask(q) { if (window.Mileni) window.Mileni.open(q); else window.__mileniQueue.push(q || ''); }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-ask]'); if (a) { e.preventDefault(); ask(a.dataset.ask); return; }
    var o = e.target.closest('[data-open-chat]'); if (o) { e.preventDefault(); ask(''); }
  });
  $('#bubble-x').addEventListener('click', function (e) { e.stopPropagation(); $('#bubble').remove(); });
  var launcher = $('#launcher'), heroEnd = function () { var h = $('.stats'); return h ? h.getBoundingClientRect().top + window.scrollY : 800; };
  window.addEventListener('scroll', function () { if (window.scrollY > heroEnd() - 200) launcher.classList.add('show-bubble'); }, { passive: true });
})();

/* ---------- Video de portada: versión según pantalla, siempre en silencio y en loop ---------- */
(function () {
  var v = document.getElementById('hero-video'); if (!v) return;
  var mq = window.matchMedia('(max-width: 980px)');
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  function pick() {
    var mobile = mq.matches;
    var src = mobile ? v.dataset.mobile : v.dataset.desktop;
    v.poster = mobile ? v.dataset.posterMobile : v.dataset.posterDesktop;
    if (calm || saveData) return; // solo la imagen de portada
    if (v.getAttribute('src') !== src) { v.setAttribute('src', src); v.load(); }
    v.muted = true;
    var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
  }
  pick();
  if (mq.addEventListener) mq.addEventListener('change', pick); else mq.addListener(pick);
  // si la pestaña vuelve a estar visible, que siga corriendo
  document.addEventListener('visibilitychange', function () { if (!document.hidden && v.src) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); } });
})();

