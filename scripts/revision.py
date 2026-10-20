# Revisión como persona: cada paso, en 3 celulares y computadora. Falla si:
#  - el botón Siguiente no se ve completo, o el contenido del paso no cabe (salvo la lista de jugadores, que debe avisar "hay más")
#  - un renglón de colores/opciones queda con un solo elemento, o los renglones no son parejos
#  - un texto se corta, o la página se mueve hacia los lados, o el fondo no está congelado
import json, sys, os
from playwright.sync_api import sync_playwright
U='/mnt/user-data/uploads/'
TAM=[(360,640,'chico'),(390,844,'medio'),(430,932,'grande'),(1280,800,'compu')]
CHEQUEO = r'''() => {
  const fallas=[]; const vh=innerHeight, vw=innerWidth;
  const sig=document.querySelector('#barra-sig'); const r=sig.getBoundingClientRect();
  if (r.bottom>vh+0.5||r.top<0) fallas.push('Siguiente fuera de la pantalla');
  const c=document.querySelector('#paso-cuerpo'); const paso=c.dataset.paso;
  const desborda=c.scrollHeight>c.clientHeight+2;
  if (desborda && paso!=='equipo') fallas.push('el paso no cabe ('+c.scrollHeight+' > '+c.clientHeight+')');
  if (desborda && paso==='equipo' && !c.parentNode.classList.contains('hay-mas') && c.scrollTop===0) fallas.push('hay más abajo y no se avisa');
  document.querySelectorAll('#paso-cuerpo .rejilla, #paso-cuerpo .chips.llenar, #mini-grid').forEach(g=>{
    const ks=[...g.children]; if(ks.length<2) return; const filas={};
    ks.forEach(k=>{const t=Math.round(k.offsetTop); filas[t]=(filas[t]||0)+1;});
    const cuentas=Object.values(filas);
    if (Math.max(...cuentas)-Math.min(...cuentas)>1) fallas.push('renglones disparejos '+cuentas.join('/'));
    if (cuentas.length>1 && Math.min(...cuentas)===1) fallas.push('un elemento solo en un renglón');
    if (g.getBoundingClientRect().right>c.getBoundingClientRect().right+1) fallas.push('rejilla se sale a la derecha');
  });
  document.querySelectorAll('#tablero button, #tablero .chip, #tablero label, #tablero .etq, #tablero h3, #tablero span, #tablero p').forEach(e=>{
    if (!e.offsetParent) return;
    const cs=getComputedStyle(e);
    if ((cs.overflow==='hidden'||cs.textOverflow==='ellipsis'||cs.whiteSpace==='nowrap') && e.scrollWidth>e.clientWidth+1 && e.clientWidth>0) fallas.push('texto cortado: '+(e.textContent||'').trim().slice(0,30));
    const b=e.getBoundingClientRect(); if (b.width && b.right>vw+1) fallas.push('se sale de la pantalla: '+(e.textContent||'').trim().slice(0,30));
  });
  document.querySelectorAll('#paso-cuerpo img').forEach(im=>{
    if (!im.offsetParent || getComputedStyle(im.parentNode).overflow==='hidden') return; const a=im.getBoundingClientRect(), b=im.parentNode.getBoundingClientRect();
    if (a.left<b.left-1||a.right>b.right+1||a.top<b.top-1||a.bottom>b.bottom+1) fallas.push('imagen se sale de su cuadro');
  });
  const t=document.querySelector('.toast.ver'); if (t && /Cargando|Loading/.test(t.textContent)) fallas.push('aviso Cargando se quedó en pantalla');
  const sg=document.querySelector('#barra-sig'); if (sg.scrollHeight>sg.clientHeight+2 || sg.getBoundingClientRect().height>60) fallas.push('el botón de la barra se parte en renglones');
  document.querySelectorAll('#paso-cuerpo .btn').forEach(bt=>{ if(bt.offsetParent && bt.getBoundingClientRect().height>60) fallas.push('botón partido: '+bt.textContent.trim().slice(0,20)); });
  if (document.documentElement.scrollWidth>vw) fallas.push('la página se mueve a los lados');
  if (getComputedStyle(document.body).position!=='fixed') fallas.push('el fondo no está congelado');
  return {paso, fallas};
}'''
def correr():
    todo=[]; shots=[]
    with sync_playwright() as p:
        b=p.chromium.launch()
        for w,h,nom in TAM:
            movil = w<900
            ctx=b.new_context(viewport={'width':w,'height':h},device_scale_factor=2 if movil else 1,is_mobile=movil,has_touch=movil,locale='es-MX')
            pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto('http://localhost:5055/?sinintro'); pg.wait_for_timeout(1200)
            pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(1300)
            def revisa(etq):
                pg.wait_for_timeout(650)
                res=pg.evaluate(CHEQUEO); f='/tmp/claude-0/rv-%s-%02d.png'%(nom,len([s for s in shots if s[0]==nom]))
                pg.screenshot(path=f); shots.append((nom,f,etq))
                todo.append((nom,etq,res['paso'],res['fallas']))
            def sig(): pg.click('#barra-sig')
            # camino A: elegir diseño
            pg.click('[data-camino="catalogo"]'); revisa('A diseño')
            pg.click('[data-base="aluxes-secundario"]'); pg.wait_for_timeout(500)
            sig(); revisa('A manga y short')
            sig(); pg.fill('#f-nombre','Kidviniflo'); pg.fill('#f-numero','619'); revisa('A nombre y número')
            sig(); revisa('A equipo (no)')
            pg.click('[data-eq="si"]'); pg.fill('#f-equipo','Aluxes Capital')
            for i in range(5): pg.click('[data-mas-j]'); pg.wait_for_timeout(120)
            revisa('A equipo (sí, 7 jugadores)')
            sig(); revisa('A listo')
            pg.click('#probador-x'); pg.wait_for_timeout(500)
            # camino B: desde cero
            pg.evaluate("document.querySelector('#crear').scrollIntoView()"); pg.wait_for_timeout(300)
            pg.click('[data-camino="libre"]'); revisa('B tela (sin foto)')
            pg.set_input_files('#f-relleno', U+'WhatsApp_Image_2026-10-19_at_3_54_56p_m_.jpeg'); revisa('B tela (aviso foto chica)')
            pg.click('[data-aviso-ok="relleno"]'); revisa('B tela (ajustar)')
            pg.set_input_files('#f-relleno', U+'1792450394633_image.png'); pg.wait_for_timeout(1500); revisa('B tela (prenda completa)')
            sig(); revisa('B cuello y costados')
            sig(); revisa('B logo (vacío)')
            pg.set_input_files('#f-logo', U+'WhatsApp_Image_2026-10-18_at_2_01_41p_m_.jpeg'); pg.wait_for_timeout(1200)
            if pg.query_selector('[data-aviso-ok="logo"]'): pg.click('[data-aviso-ok="logo"]')
            revisa('B logo (puesto)')
            sig(); revisa('B patrocinadores (vacío)')
            for f in ['Boulder_Corp_Logo_1.jpg','WhatsApp_Image_2026-10-19_at_3_54_56p_m_.jpeg','MOON-Digital-logo-horizontal-negro.png']:
                pg.set_input_files('#f-patro', U+f); pg.wait_for_timeout(1100)
            revisa('B patrocinadores (3)')
            sig(); revisa('B manga y short')
            sig(); revisa('B nombre y número')
            sig(); revisa('B equipo')
            sig(); revisa('B listo')
            if errs: todo.append((nom,'errores de página','',errs))
            ctx.close()
        b.close()
    return todo, shots
todo, shots = correr()
mal=[t for t in todo if t[3]]
for t in todo: print(('FALLA ' if t[3] else 'ok    ')+t[0].ljust(7)+t[1].ljust(32)+(' | '.join(t[3]) if t[3] else ''))
print('\nTOTAL', len(todo), 'revisiones,', len(mal), 'con fallas')
json.dump(shots, open('/tmp/claude-0/rv-shots.json','w'))
