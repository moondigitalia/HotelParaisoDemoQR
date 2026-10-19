import sys, asyncio
from playwright.sync_api import sync_playwright
url, out = sys.argv[1], sys.argv[2]
w = int(sys.argv[3]) if len(sys.argv)>3 else 1260
h = int(sys.argv[4]) if len(sys.argv)>4 else 900
with sync_playwright() as p:
    import os
    px=os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
    b=p.chromium.launch(args=['--allow-file-access-from-files','--ignore-certificate-errors'], proxy={'server':px,'bypass':'localhost,127.0.0.1'} if (px and 'localhost' not in url) else None)
    pg=b.new_page(viewport={'width':w,'height':h})
    msgs=[]
    pg.on('console', lambda m: msgs.append(m.type+': '+m.text))
    pg.on('pageerror', lambda e: msgs.append('ERR '+str(e)))
    pg.goto(url); pg.wait_for_timeout(int(sys.argv[5]) if len(sys.argv)>5 else 2500)
    pg.screenshot(path=out, full_page=False)
    print('\n'.join(msgs[:20]))
    b.close()
