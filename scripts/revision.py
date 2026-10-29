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
  if (innerWidth<=980){const bw=document.querySelector('#paso-barra').getBoundingClientRect(); if (bw.left>0.5||bw.right<innerWidth-0.5) fallas.push('la barra/paso no ocupa todo el ancho ('+Math.round(bw.width)+' de '+innerWidth+')');}
  const c=document.querySelector('#paso-cuerpo'); const paso=c.dataset.paso;
  const desborda=c.scrollHeight>c.clientHeight+2;
  if (desborda && paso!=='equipo' && paso!=='diseno') fallas.push('el paso no cabe ('+c.scrollHeight+' > '+c.clientHeight+')');
  if (desborda && (paso==='equipo'||paso==='diseno') && !c.parentNode.classList.contains('hay-mas') && c.scrollTop===0) fallas.push('hay más abajo y no se avisa');
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
  if (document.querySelector('#tablero input[type=range]')) fallas.push('hay una barra para arrastrar');
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
                # esperar a que termine la animación de entrada del paso (si no, se mide a medio camino)
                pg.wait_for_function("() => !document.getAnimations().some(a => a.playState==='running' && a.effect && a.effect.target && document.querySelector('#tablero').contains(a.effect.target) && !(a.effect.getComputedTiming().iterations===Infinity))", timeout=4000)
                res=pg.evaluate(CHEQUEO); f='/tmp/claude-0/rv-%s-%02d.png'%(nom,len([s for s in shots if s[0]==nom]))
                pg.screenshot(path=f); shots.append((nom,f,etq))
                todo.append((nom,etq,res['paso'],res['fallas']))
            def sig(): pg.click('#barra-sig')
            # el único camino: el catálogo en 3D
            if pg.evaluate("document.body.innerText.toLowerCase().includes('desde cero')"): todo.append((nom,'todavía aparece crear desde cero','',['texto "desde cero" en la página']))
            pg.click('[data-camino="catalogo"]'); pg.wait_for_timeout(4500); revisa('diseño (catálogo)')
            g=pg.evaluate("""() => { const c=document.querySelector('#lienzo3d'); const f=[];
              if (!c.classList.contains('listo')) f.push('el 3D no se dibujó');
              const m=window.APP.motor; if (!m) { f.push('sin motor 3D'); return f; }
              m.revisar().forEach(t => { if (t.puntaZ < 0.9) f.push('taco '+t.lado+' no apunta al frente'); if (Math.sign(t.puntaX)!==t.lado) f.push('taco '+t.lado+' no abre hacia afuera');
                if (t.separacion > 0.01) f.push('la calceta no entra al taco '+t.lado+' ('+t.separacion+')'); if (t.corte >= t.bocaY) f.push('la calceta se ve por fuera del taco'); });
              return f; }""")
            todo.append((nom,'3D: tacos en los pies y calcetas dentro','diseno',g))
            pg.fill('#p-buscar','rojo'); pg.wait_for_timeout(500); revisa('diseño (buscar sin resultados)')
            if not pg.query_selector('#p-resultados .vacio'): todo.append((nom,'buscar sin resultados no avisa','diseno',['falta el aviso']))
            pg.fill('#p-buscar','morado'); pg.wait_for_timeout(500)
            if not pg.query_selector('#p-resultados [data-base]'): todo.append((nom,'buscar "morado" no encontró el lila','diseno',['0 resultados']))
            pg.fill('#p-buscar',''); pg.wait_for_timeout(400)
            sig(); revisa('manga y tacos')
            pg.click('[data-taco="rosa"]'); pg.wait_for_timeout(1500); pg.click('[data-manga="larga"]'); pg.wait_for_timeout(3000); revisa('manga larga, tacos rosas')
            sig(); pg.fill('#f-nombre','Kidviniflo'); pg.fill('#f-numero','619'); pg.wait_for_timeout(1500); revisa('nombre y número')
            sig(); revisa('equipo (no)')
            pg.click('[data-eq="si"]'); pg.fill('#f-equipo','Aluxes Capital')
            for i in range(5): pg.click('[data-mas-j]'); pg.wait_for_timeout(120)
            revisa('equipo (sí, 7 jugadores)')
            sig(); revisa('listo')
            if movil:
                pg.click('#lupa'); pg.wait_for_timeout(900)
                gg=pg.evaluate("""() => { const e=document.querySelector('#escenario').getBoundingClientRect(), b=document.querySelector('#paso-barra').getBoundingClientRect(), s=document.querySelector('#barra-sig').getBoundingClientRect();
                  const f=[]; if (Math.abs(e.bottom-b.top)>2) f.push('el uniforme grande no llega a la barra'); if (e.height < innerHeight*0.7) f.push('no se agrandó'); if (s.bottom>innerHeight+0.5) f.push('Siguiente fuera'); return f; }""")
                ESTIRA = """() => { const c=document.querySelector('#lienzo3d'), m=window.APP.motor, pr=c.width/c.clientWidth;
                  return Math.abs(c.height/pr - c.clientHeight) > 2 ? ['el uniforme se ve estirado ('+c.width+'x'+c.height+' en '+c.clientWidth+'x'+c.clientHeight+')'] : []; }"""
                gg += pg.evaluate(ESTIRA)
                todo.append((nom,'ver en grande','listo',gg)); pg.click('#lupa'); pg.wait_for_timeout(1200)
                todo.append((nom,'regresar de grande sin estirar','listo',pg.evaluate(ESTIRA)))
            pg.click('#probador-x'); pg.wait_for_timeout(500)
            if errs: todo.append((nom,'errores de página','',errs))
            ctx.close()
        b.close()
    return todo, shots
todo, shots = correr()
mal=[t for t in todo if t[3]]
for t in todo: print(('FALLA ' if t[3] else 'ok    ')+t[0].ljust(7)+t[1].ljust(32)+(' | '.join(t[3]) if t[3] else ''))
print('\nTOTAL', len(todo), 'revisiones,', len(mal), 'con fallas')
json.dump(shots, open('/tmp/claude-0/rv-shots.json','w'))
