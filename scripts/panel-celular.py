# Panel del dueño en celular, tocando con el dedo: lista de folios, detalle con cantidades y tallas, uniformes y editor.
from playwright.sync_api import sync_playwright
BASE='http://localhost:5055'; O='/tmp/claude-0/pc'
def pedido_equipo(b):
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,locale='es-MX'); pg=ctx.new_page()
    pg.goto(BASE+'/?sinintro'); pg.wait_for_timeout(1200)
    pg.tap('[data-camino="catalogo"]'); pg.wait_for_timeout(700)
    pg.tap('[data-base="aluxes-principal"]'); pg.wait_for_timeout(500)
    while pg.evaluate("document.querySelector('#paso-cuerpo').dataset.paso")!='equipo':
        pg.tap('#barra-sig'); pg.wait_for_timeout(500)
    pg.tap('[data-eq="si"]'); pg.wait_for_timeout(400); pg.fill('#f-equipo','Aluxes Capital')
    for i in range(3): pg.tap('[data-mas-j]'); pg.wait_for_timeout(150)
    datos=[('KIDVINIFLO','619','M'),('JUANPY','69','G'),('LALO','7','M'),('BETO','10',''),('PACO','','Ch')]
    for i,(n,num,t) in enumerate(datos):
        pg.locator('[data-k="nombre"]').nth(i).fill(n); pg.locator('[data-k="numero"]').nth(i).fill(num)
        if t: pg.locator('select[data-k="talla"]').nth(i).select_option(t)
    pg.tap('#barra-sig'); pg.wait_for_timeout(600); pg.tap('#barra-sig'); pg.wait_for_timeout(5000)
    print('folio equipo:', pg.inner_text('#fiesta-folio')); ctx.close()
with sync_playwright() as p:
    b=p.chromium.launch(); pedido_equipo(b)
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,locale='es-MX'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE+'/?sinintro#panel'); pg.wait_for_timeout(1200)
    pg.fill('#pn-codigo','0'); pg.tap('#pn-pin button'); pg.wait_for_timeout(1200)
    pg.screenshot(path=O+'-1.png')
    pg.tap('[data-folio="0"]'); pg.wait_for_timeout(1200); pg.screenshot(path=O+'-2.png')
    pg.evaluate("document.querySelector('.pn').scrollTo(0,640)"); pg.wait_for_timeout(300); pg.screenshot(path=O+'-3.png')
    pg.evaluate("document.querySelector('.pn').scrollTo(0,1300)"); pg.wait_for_timeout(300); pg.screenshot(path=O+'-4.png')
    pg.tap('[data-est="cotizado"]'); pg.wait_for_timeout(700)
    pg.evaluate("document.querySelector('.pn').scrollTo(0,0)"); pg.tap('[data-volver]'); pg.wait_for_timeout(800)
    print('estado en lista:', pg.inner_text('[data-folio="0"] .estado'))
    pg.tap('[data-folio="1"]'); pg.wait_for_timeout(1200)
    pg.evaluate("document.querySelector('.pn').scrollTo(0,560)"); pg.wait_for_timeout(300); pg.screenshot(path=O+'-7.png')
    pg.evaluate("document.querySelector('.pn').scrollTo(0,99999)"); pg.wait_for_timeout(300); pg.screenshot(path=O+'-8.png')
    pg.tap('[data-volver]'); pg.wait_for_timeout(600)
    pg.tap('[data-tab="uniformes"]'); pg.wait_for_timeout(1000); pg.screenshot(path=O+'-5.png')
    pg.tap('[data-edit]'); pg.wait_for_timeout(1000)
    pg.evaluate("document.querySelector('.pn').scrollTo(0,99999)"); pg.wait_for_timeout(300); pg.screenshot(path=O+'-6.png')
    print('ERRS', errs); b.close()
