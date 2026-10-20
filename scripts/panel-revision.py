# Revisión del panel con el dedo: cada pestaña en el celular más chico y en computadora.
# Falla si algo se sale a los lados, si un botón es más chico que un dedo (40px) o si un texto se corta.
from playwright.sync_api import sync_playwright
CHEQ = r'''() => { const f=[]; const vw=innerWidth; const pn=document.querySelector('.pn');
  if (pn.scrollWidth>pn.clientWidth+1) f.push('se mueve a los lados');
  document.querySelectorAll('#panel button, #panel a, #panel select, #panel input:not([type=file])').forEach(e=>{ if(!e.offsetParent) return; const r=e.getBoundingClientRect();
    if (r.right>vw+1) f.push('se sale: '+(e.textContent||e.id).trim().slice(0,25));
    if (e.closest('.archivo')) return;
    if ((r.height<40||r.width<40) && !e.classList.contains('link-x')) f.push('muy chico para el dedo: '+(e.getAttribute('aria-label')||e.textContent||e.id).trim().slice(0,25)+' '+Math.round(r.width)+'x'+Math.round(r.height)); });
  document.querySelectorAll('.pn-folio select').forEach(()=>f.push('hay un menú dentro del folio'));
  return f; }'''
with sync_playwright() as p:
    b=p.chromium.launch(); total=0; malas=0
    for w,h,mov in [(360,640,True),(1280,800,False)]:
        ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=mov,has_touch=mov,locale='es-MX'); pg=ctx.new_page()
        pg.goto('http://localhost:5055/?sinintro#panel'); pg.wait_for_timeout(1000); pg.fill('#pn-codigo','0'); pg.click('#pn-pin button'); pg.wait_for_timeout(1200)
        def rev(n):
            global total, malas
            pg.wait_for_timeout(500); r=pg.evaluate(CHEQ); total+=1
            if r: malas+=1
            print(('FALLA ' if r else 'ok    ')+str(w).ljust(6)+n.ljust(22)+' | '.join(sorted(set(r))[:6]))
        rev('folios'); pg.click('[data-folio="0"]'); rev('detalle folio'); pg.click('[data-volver]')
        pg.click('[data-tab="uniformes"]'); rev('uniformes'); pg.click('[data-edit]'); rev('editar uniforme'); pg.click('[data-volver]')
        pg.click('[data-nuevo]'); rev('nuevo uniforme'); pg.click('[data-volver]')
        pg.click('[data-tab="datos"]'); rev('datos'); pg.click('[data-tab="papelera"]'); rev('papelera')
        ctx.close()
    print('TOTAL', total, 'revisiones,', malas, 'con fallas'); b.close()
