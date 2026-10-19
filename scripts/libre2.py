from playwright.sync_api import sync_playwright
U='/mnt/user-data/uploads/'
out='/tmp/claude-0/m'
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_context(viewport={'width':1280,'height':1000}, locale='es-MX').new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:5055/?sinintro'); pg.wait_for_timeout(1000)
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(1200)
    pg.click('[data-camino="libre"]'); pg.wait_for_timeout(500)
    pg.set_input_files('#f-relleno', U+'1792450394633_image.png'); pg.wait_for_timeout(2500)
    pg.click('[data-nav="siguiente"]'); pg.wait_for_timeout(400)
    pg.set_input_files('#f-logo', U+'WhatsApp_Image_2026-10-18_at_2_01_41p_m_.jpeg'); pg.wait_for_timeout(1800)
    pg.locator('#estudio').screenshot(path=out+'-2.png')
    pg.click('[data-nav="siguiente"]'); pg.wait_for_timeout(400)
    for f in ['Boulder_Corp_Logo_1.jpg','WhatsApp_Image_2026-10-19_at_3_54_56p_m_.jpeg','MOON-Digital-logo-horizontal-negro.png']:
        pg.set_input_files('#f-patro', U+f); pg.wait_for_timeout(1400)
    pg.wait_for_timeout(800)
    pg.locator('#estudio').screenshot(path=out+'-3.png')
    pg.click('[data-nav="siguiente"]'); pg.wait_for_timeout(300); pg.click('[data-nav="siguiente"]'); pg.wait_for_timeout(500)
    pg.fill('#f-nombre','Kidviniflo'); pg.fill('#f-numero','619'); pg.wait_for_timeout(700)
    pg.locator('#estudio').screenshot(path=out+'-4.png')
    print('ERRS', errs); b.close()
