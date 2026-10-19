from playwright.sync_api import sync_playwright
U='/mnt/user-data/uploads/'
out='/tmp/claude-0/l'
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_context(viewport={'width':1280,'height':860}, locale='es-MX').new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:5055/?sinintro'); pg.wait_for_timeout(1200)
    pg.evaluate("localStorage.clear()")
    pg.click('[data-camino="libre"]'); pg.wait_for_timeout(600)
    pg.set_input_files('#f-relleno', U+'IMG_4311.JPG'); pg.wait_for_timeout(2500)
    pg.screenshot(path=out+'-1.png')
    pg.click('[data-nav="siguiente"]'); pg.wait_for_timeout(500)
    pg.set_input_files('#f-logo', U+'WhatsApp_Image_2026-10-18_at_2_01_41p_m_.jpeg'); pg.wait_for_timeout(2000)
    pg.screenshot(path=out+'-2.png')
    pg.click('[data-nav="siguiente"]'); pg.wait_for_timeout(500)
    for f in ['Boulder_Corp_Logo_1.jpg','WhatsApp_Image_2026-10-19_at_3_54_56p_m_.jpeg','MOON-Digital-logo-horizontal-negro.png']:
        pg.set_input_files('#f-patro', U+f); pg.wait_for_timeout(1500)
    pg.screenshot(path=out+'-3.png')
    print('ERRS', errs)
    b.close()
