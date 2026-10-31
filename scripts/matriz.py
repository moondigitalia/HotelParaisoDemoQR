# Prueba de todo el ecosistema en muchos tamaños a la vez (celular chico, iPhone 7, iPhone nuevo con Firefox,
# Android, tableta, computadora). Revisa cada pantalla del panel y la página del cliente con las mismas reglas:
#   1. nada de "scroll chiquito" (sobra entre 1 y 16 px)
#   2. todo lo que se corta (se desliza) se desvanece: tiene data-vig (panel)
#   3. nada se sale de la pantalla por los lados
#   4. ningún botón con el texto cortado
#   5. títulos de arriba completos
# Uso: python3 scripts/matriz.py [rapido]   (rapido = sin el estudio 3D)
# Si algo falla en cualquier tamaño, no se publica.
import sys, json
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5055'
TAMANOS = [(320, 480), (360, 640), (360, 690), (375, 548), (390, 664), (393, 660), (412, 780), (768, 1024), (1280, 800)]
SALIDA = '/tmp/claude-0/-home-claude/968c9ed2-d953-59c7-b80e-40add6d1b54f/scratchpad/m_'

REVISAR = r"""(panel) => {
  const fallas = [], W = innerWidth, H = innerHeight;
  const raiz = panel ? document.querySelector('#panel') : document.body;
  // lo escondido a propósito (cajas de 1px para subir archivos) no cuenta
  const vis = e => { const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden')) return false; for (let p = e; p && p !== document.body; p = p.parentElement) { const c = getComputedStyle(p); if (c.clipPath !== 'none' || (p.getBoundingClientRect().width <= 1)) return false; } return true; };
  const nombre = e => (e.id ? '#' + e.id : '') + '.' + String(e.className || e.tagName).split(' ')[0];
  const dentroDeLado = e => { for (let p = e.parentElement; p && p !== raiz; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; };
  raiz.querySelectorAll('*').forEach(e => {
    if (!vis(e) || e.closest('iframe') ) return;
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    const sy = /(auto|scroll)/.test(cs.overflowY) ? e.scrollHeight - e.clientHeight : 0;
    const sx = /(auto|scroll)/.test(cs.overflowX) ? e.scrollWidth - e.clientWidth : 0;
    if ((sy > 1 && sy <= 16) || (sx > 1 && sx <= 16)) fallas.push('scroll chiquito ' + nombre(e) + ' (' + Math.max(sy, sx) + 'px)');
    if (panel && (sy > 16 || sx > 16) && !e.hasAttribute('data-vig')) fallas.push('se corta sin desvanecer ' + nombre(e));
    if ((r.right > W + 1 || r.left < -1) && !dentroDeLado(e) && e.tagName !== 'HTML' && e.tagName !== 'BODY') fallas.push('se sale de la pantalla ' + nombre(e));
    if ((e.tagName === 'BUTTON' || e.tagName === 'A') && e.scrollWidth > e.clientWidth + 2 && !/(auto|scroll)/.test(cs.overflowX) && cs.textOverflow !== 'ellipsis') fallas.push('texto cortado en botón ' + nombre(e) + ' "' + e.textContent.trim().slice(0, 20) + '"');
  });
  // cualquier texto cortado (que no termine en "…" a propósito)
  raiz.querySelectorAll('*').forEach(e => {
    if (!vis(e) || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
    const cs = getComputedStyle(e);
    if (cs.textOverflow === 'ellipsis' || /(auto|scroll)/.test(cs.overflowX)) return;
    if (e.scrollWidth > e.clientWidth + 2 && cs.overflowX !== 'visible') fallas.push('texto cortado ' + nombre(e) + ' "' + e.textContent.trim().slice(0, 20) + '"');
    const r = e.getBoundingClientRect();
    for (let p = e.parentElement; p && p !== raiz; p = p.parentElement) { const pc = getComputedStyle(p); if (pc.overflowX !== 'visible' || pc.overflowY !== 'visible') { const q = p.getBoundingClientRect(); if (r.right > q.right + 2 && !/(auto|scroll)/.test(pc.overflowX)) fallas.push('texto tapado ' + nombre(e) + ' "' + e.textContent.trim().slice(0, 20) + '"'); break; } }
  });
  const t = document.querySelector('.pn-top > b'); if (panel && t && vis(t) && t.scrollWidth > t.clientWidth + 1) fallas.push('título cortado "' + t.textContent + '"');
  return [...new Set(fallas)];
}"""

def correr(rapido):
    total = {}
    with sync_playwright() as p:
        b = p.chromium.launch(args=[] if rapido else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        for (w, h) in TAMANOS:
            pg = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=w < 700, has_touch=w < 700, locale='es-MX')
            errores = []; pg.on('pageerror', lambda e: errores.append(str(e)[:120]))
            res = {}
            def ver(n, panel=True):
                pg.wait_for_timeout(350)
                res[n] = pg.evaluate(REVISAR, panel)
                pg.screenshot(path=SALIDA + '%dx%d_%s.png' % (w, h, n))
            # página del cliente: arriba y abajo
            pg.goto(BASE + '/?sinintro'); pg.wait_for_timeout(2500)
            ver('cliente', False)
            # el armador del cliente: cada paso, y "Ver todos"
            pg.locator('#cat-zona .cat-esc').first.click(); pg.wait_for_timeout(1500); ver('armador-1', False)
            # ver en grande y regresar: los pasos de abajo no se mueven ni un pixel
            if pg.locator('#lupa').is_visible():
                POS = "JSON.stringify([...document.querySelectorAll('#paso-vista *')].slice(0,30).map(e=>{const r=e.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]}))"
                a = pg.evaluate(POS); pg.click('#lupa'); pg.wait_for_timeout(250); m1 = pg.evaluate(POS); pg.wait_for_timeout(500)
                pg.click('#lupa'); pg.wait_for_timeout(200); m2 = pg.evaluate(POS); pg.wait_for_timeout(600); d = pg.evaluate(POS)
                if len({a, m1, m2, d}) > 1: res['armador-grande'] = ['los pasos se movieron al ver en grande y regresar']
            for k in range(2, 6):
                sig = pg.locator('#barra-sig')
                if not sig.is_visible(): break
                txt = sig.inner_text()
                if 'WhatsApp' in txt or 'Cotiza' in txt: break
                sig.click(); pg.wait_for_timeout(1300); ver('armador-%d' % k, False)
            pg.click('#probador-x'); pg.wait_for_timeout(500)
            for _ in range(6):
                if pg.locator('#probador').is_hidden(): break
                pg.click('#probador-x'); pg.wait_for_timeout(400)
            ver('cliente-regreso', False)
            # panel
            pg.goto(BASE + '/?sinintro#panel'); pg.wait_for_timeout(1200)
            pg.fill('#pn-codigo', '0'); pg.click('#pn-pin button'); pg.wait_for_timeout(1500)
            ver('pedidos')
            pg.click('[data-tab="uniformes"]'); ver('uniformes')
            pg.locator('[data-eq]').nth(2).click(); ver('equipo')
            if not rapido:
                pg.locator('[data-edit]').first.click(); pg.wait_for_timeout(5000); ver('estudio')
                pg.click('[data-hoja-ir="datos"]'); ver('estudio-hoja')
                pg.evaluate("document.querySelector('[data-hoja=datos] .pn-hoja-cuerpo').scrollTop=1e5"); ver('estudio-hoja-abajo')
                pg.click('[data-hoja-cerrar]')
                bb = pg.locator('#ed-3d').bounding_box(); pg.mouse.click(bb['x'] + bb['width'] * .5, bb['y'] + bb['height'] * .35); pg.wait_for_timeout(900); ver('estudio-pieza')
                pg.click('[data-ctl="listo"]'); pg.wait_for_timeout(300)
                pg.mouse.click(bb['x'] + bb['width'] * .45, bb['y'] + bb['height'] * .78); pg.wait_for_timeout(900); ver('estudio-calcetas')
                if pg.locator('[data-ctl="listo"]').count(): pg.click('[data-ctl="listo"]'); pg.wait_for_timeout(300)
                pg.click('[data-atras]'); pg.wait_for_timeout(500)
            pg.click('[data-atras]'); pg.wait_for_timeout(500)
            pg.click('[data-tab="pagina"]'); pg.wait_for_timeout(3500); ver('pagina')
            fr = pg.frame_locator('.pn-pag-capa iframe')
            fr.locator('[data-t="hero_t"]').click(force=True); ver('pagina-texto')
            pg.click('[data-pg-listo]')
            fr.locator('#lienzo-wrap').click(position={'x': 10, 'y': 40}, force=True); ver('pagina-fondo')
            pg.click('[data-pg-listo]')
            pg.click('[data-tab="datos"]'); ver('tienda')
            pg.click('[data-tsel-ir="hor"]'); ver('tienda-horario')
            pg.click('[data-tsel-listo]'); pg.click('[data-tsel-ir="redes"]'); ver('tienda-redes')
            pg.click('[data-tsel-listo]'); pg.click('[data-ir="ajustes"]'); ver('ajustes')
            res['errores js'] = errores
            total['%dx%d' % (w, h)] = res
            pg.close()
    return total

if __name__ == '__main__':
    t = correr('rapido' in sys.argv)
    malas = 0
    for tam, res in t.items():
        n = sum(len(v) for v in res.values())
        malas += n
        print(('OK   ' if not n else 'FALLA') + ' ' + tam + ('' if not n else ':'))
        for pant, f in res.items():
            for x in f: print('      ' + pant + ' → ' + x)
    print('\nTOTAL', malas, 'fallas en', len(t), 'tamaños')
    sys.exit(1 if malas else 0)
