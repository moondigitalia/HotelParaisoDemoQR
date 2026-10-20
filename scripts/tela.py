from playwright.sync_api import sync_playwright
U='/mnt/user-data/uploads/'
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_context(viewport={'width':1280,'height':1100}, locale='es-MX').new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:5055/?sinintro'); pg.wait_for_timeout(800); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(1000)
    pg.click('[data-camino="libre"]'); pg.wait_for_timeout(400)
    for i,f in enumerate(['1792450394633_image.png','1792450375543_image.png','IMG_4308.JPG']):
        pg.set_input_files('#f-tela', U+f); pg.wait_for_timeout(2600)
        pg.locator('#estudio').screenshot(path=f'/tmp/claude-0/t-{i}.png')
    # mover el recuadro
    m=pg.locator('#marco').bounding_box()
    pg.mouse.move(m['x']+m['width']/2, m['y']+m['height']/2); pg.mouse.down(); pg.mouse.move(m['x']+m['width']/2+60, m['y']+m['height']/2-80, steps=6); pg.mouse.up(); pg.wait_for_timeout(1200)
    pg.locator('#estudio').screenshot(path='/tmp/claude-0/t-3.png')
    print('ERRS', errs); b.close()
