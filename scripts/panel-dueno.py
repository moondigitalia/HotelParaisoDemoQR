# El dueño sube un uniforme con SUS fotos tal cual, desde su celular, sin ayuda: lo que le sale es lo que ve el cliente.
import sys, json
from playwright.sync_api import sync_playwright
R='/home/claude/m-sport/scripts/.fuentes/raw/'
caso=json.loads(sys.argv[1]); O='/tmp/claude-0/dueno-'+caso['id']
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    c=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,locale='es-MX'); pg=c.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type=='error' and errs.append(m.text))
    pg.goto('http://localhost:5055/?sinintro#panel'); pg.wait_for_timeout(1500)
    pg.fill('#pn-codigo','0'); pg.tap('#pn-pin button'); pg.wait_for_timeout(1500)
    pg.tap('[data-tab="uniformes"]'); pg.wait_for_timeout(800); pg.tap('[data-nuevo]'); pg.wait_for_timeout(800)
    avisos=[]
    for lado in ('frente','espalda','short'):
        if caso.get(lado):
            fs=caso[lado] if isinstance(caso[lado],list) else [caso[lado]]
            pg.set_input_files('[data-foto="%s"]'%lado, [R+f for f in fs]); pg.wait_for_timeout(9000*len(fs)+5000)
            avisos.append((lado, pg.evaluate("document.querySelector('#ed-aviso').innerText")))
    if caso.get('escudo'):
        pg.set_input_files('[data-escudo]', R+caso['escudo']); pg.wait_for_timeout(6000)
    pg.fill('#ed-nombre',caso['nombre']); pg.select_option('#ed-cat',caso.get('cat','Liga europea')); pg.fill('#ed-equipo',caso['equipo']); pg.fill('#ed-version',caso['version'])
    pg.wait_for_timeout(3000)
    pg.evaluate("document.querySelector('.pn').scrollTo(0,99999)"); pg.wait_for_timeout(1500); pg.screenshot(path=O+'-editor.png')
    pg.tap('[data-pv="espalda"]'); pg.wait_for_timeout(2500); pg.screenshot(path=O+'-editor-esp.png')
    pg.tap('[data-publicar]'); pg.wait_for_timeout(12000)
    print(json.dumps({'avisos':avisos,'errs':errs[:5]},ensure_ascii=False)); b.close()
