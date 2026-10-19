import sys
from playwright.sync_api import sync_playwright
BASE='http://localhost:5055'
W,H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv)>2 else (390,844)
out='/tmp/claude-0/f'
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':W,'height':H}, device_scale_factor=2 if W<500 else 1, locale='es-MX')
    pg=ctx.new_page()
    errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: m.type=='error' and errs.append(m.text))
    pg.goto(BASE+'/?sinintro'); pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{out}-0.png')
    pg.click('[data-camino="catalogo"]'); pg.wait_for_timeout(900)
    pg.screenshot(path=f'{out}-1.png')
    pg.click('[data-nav="siguiente"]'); pg.wait_for_timeout(600)
    pg.click('[data-manga="larga"]'); pg.wait_for_timeout(500)
    pg.screenshot(path=f'{out}-2.png')
    pg.click('[data-nav="siguiente"]'); pg.wait_for_timeout(700)
    pg.fill('#f-nombre','Juanpy'); pg.fill('#f-numero','69'); pg.wait_for_timeout(600)
    pg.screenshot(path=f'{out}-3.png')
    pg.click('[data-nav="siguiente"]'); pg.wait_for_timeout(500)
    pg.click('[data-eq="si"]'); pg.wait_for_timeout(400)
    pg.fill('#f-equipo','Aluxes Capital')
    pg.locator('[data-k="nombre"]').nth(1).fill('Kidviniflo'); pg.locator('[data-k="numero"]').nth(1).fill('619')
    pg.locator('select[data-k="talla"]').nth(0).select_option('M'); pg.locator('select[data-k="talla"]').nth(1).select_option('G')
    pg.screenshot(path=f'{out}-4.png', full_page=False)
    pg.click('[data-nav="siguiente"]'); pg.wait_for_timeout(900)
    pg.screenshot(path=f'{out}-5.png')
    pg.click('#cotizar'); pg.wait_for_timeout(4500)
    pg.screenshot(path=f'{out}-6.png')
    href=pg.get_attribute('#fiesta-wa','href'); print('WA', href)
    import urllib.parse as up
    link=[x for x in up.unquote(href).split() if x.startswith('http://localhost')]
    print('LINK', link)
    if link:
        pg.goto(link[0]); pg.wait_for_timeout(2000); pg.screenshot(path=f'{out}-7.png')
    print('ERRS', errs[:10])
    b.close()
