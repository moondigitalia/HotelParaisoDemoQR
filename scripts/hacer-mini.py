import sys, base64, io
from PIL import Image
from playwright.sync_api import sync_playwright
uid=sys.argv[1]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:5055/scripts/hacer-mini.html?id='+uid); pg.wait_for_function("document.title=='listo'", timeout=180000)
    d=pg.evaluate('window.R'); im=Image.open(io.BytesIO(base64.b64decode(d.split(',')[1]))).convert('RGB')
    im.save('/home/claude/m-sport/assets/catalogo/%s-mini.jpg'%uid, quality=84, optimize=True, progressive=True); print(im.size, errs); b.close()
