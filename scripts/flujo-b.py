# Camino "desde cero" completo con foto de frente y foto de espalda: el folio debe guardar las dos, ya subidas.
import json, urllib.parse as up, urllib.request as ur
from playwright.sync_api import sync_playwright
U='/mnt/user-data/uploads/'; BASE='http://localhost:5055'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,locale='es-MX')
    pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE+'/?sinintro'); pg.wait_for_timeout(1300)
    pg.click('[data-camino="libre"]'); pg.wait_for_timeout(700)
    pg.set_input_files('#f-tela', U+'1792450394633_image.png'); pg.wait_for_timeout(1800)
    if pg.query_selector('[data-aviso-ok="frente"]'): pg.click('[data-aviso-ok="frente"]')
    pg.click('#barra-sig'); pg.wait_for_timeout(700)
    pg.set_input_files('#f-tela', U+'Boulder_Corp_Logo_1.jpg'); pg.wait_for_timeout(1800)
    if pg.query_selector('[data-aviso-ok="espalda"]'): pg.click('[data-aviso-ok="espalda"]')
    for i in range(7): pg.click('#barra-sig'); pg.wait_for_timeout(600)
    pg.click('#barra-sig'); pg.wait_for_timeout(5000)
    href=pg.get_attribute('#fiesta-wa','href') or ''
    link=[x for x in up.unquote(href).split() if x.startswith('http://localhost')]
    print('LINK', link)
    q=up.parse_qs(up.urlparse(link[0]).query)
    f=json.load(ur.urlopen(BASE+'/api/folio?id='+q['folio'][0]+'&k='+q['k'][0]))
    d=(f.get('folio') or f).get('diseno') or (f.get('folio') or f)
    txt=json.dumps(f)
    print('trae espalda:', '"rellenoEspalda"' in txt, '| quedan fotos sin subir:', 'data:image' in txt)
    re_=json.loads(txt); 
    import re; print('src espalda:', re.findall(r'"rellenoEspalda": \{[^}]*"src": "([^"]+)"', txt)[:1])
    pg.goto(link[0]); pg.wait_for_timeout(2500); pg.screenshot(path='/tmp/claude-0/fb-folio.png')
    print('ERRS', errs)
    b.close()
