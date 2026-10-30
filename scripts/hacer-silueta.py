# La silueta de cada uniforme del catálogo base (sin estadio, con transparencia): la página la pone encima del estadio
# mientras carga el 3D, en el mismo lugar y tamaño, así la pantalla inicial se ve bien desde el primer momento.
import sys, base64, io
from PIL import Image
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    for uid in sys.argv[1:]:
        pg=b.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('http://localhost:5055/scripts/hacer-mini.html?silueta&id='+uid); pg.wait_for_function("document.title=='listo'", timeout=180000)
        d=pg.evaluate('window.R'); im=Image.open(io.BytesIO(base64.b64decode(d.split(',')[1]))).convert('RGBA')
        im.save('/home/claude/m-sport/assets/catalogo/%s-silueta.webp'%uid, quality=86, method=6); print(uid, im.size, errs); pg.close()
    b.close()
