# El dueño sube fotos tal cual (playera y short juntos, fondo gris, cuello blanco): la IA de su celular las separa,
# saca la versión de otro color y publica las dos.
from playwright.sync_api import sync_playwright
R='/home/claude/m-sport/scripts/.fuentes/raw/'; O='/tmp/claude-0/pia'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    c=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,locale='es-MX'); pg=c.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type=='error' and errs.append(m.text))
    pg.goto('http://localhost:5055/?sinintro#panel'); pg.wait_for_timeout(1500)
    pg.fill('#pn-codigo','0'); pg.tap('#pn-pin button'); pg.wait_for_timeout(1500)
    pg.tap('[data-tab="uniformes"]'); pg.wait_for_timeout(800)
    pg.tap('[data-nuevo]'); pg.wait_for_timeout(800)
    pg.set_input_files('[data-foto="frente"]', R+'Cruz_azul_completa._Omitir_etiqueta.webp'); pg.wait_for_timeout(15000)
    pg.set_input_files('[data-foto="espalda"]', R+'Cruz_azul_completa_reversa.webp'); pg.wait_for_timeout(15000)
    print('avisos:', pg.evaluate("document.querySelector('#ed-aviso').innerText"))
    pg.fill('#ed-nombre','Cruz Azul local (dueño)'); pg.select_option('#ed-cat','Liga MX'); pg.fill('#ed-equipo','Cruz Azul')
    pg.tap('[data-fr="#f3f3f5"]'); pg.wait_for_timeout(3000)
    pg.evaluate("document.querySelector('.pn').scrollTo(0,99999)"); pg.wait_for_timeout(800); pg.screenshot(path=O+'-1.png')
    pg.tap('[data-publicar]'); pg.wait_for_timeout(12000)
    # abrir el que se publicó y sacar la versión blanca
    pg.screenshot(path=O+'-lista.png'); pg.tap('[data-edit]')
    pg.wait_for_timeout(2500)
    if pg.query_selector('[data-oc="#f3f3f5"]'):
        pg.tap('[data-oc="#f3f3f5"]'); pg.wait_for_timeout(20000)
        pg.fill('#ed-nombre','Cruz Azul visita (dueño)'); pg.wait_for_timeout(3000)
        pg.evaluate("document.querySelector('.pn').scrollTo(0,99999)"); pg.wait_for_timeout(800); pg.screenshot(path=O+'-2.png')
        pg.tap('[data-publicar]'); pg.wait_for_timeout(12000)
    else: print('no apareció el botón de otro color')
    pg.screenshot(path=O+'-3.png')
    print('ERRS', errs[:6]); b.close()
