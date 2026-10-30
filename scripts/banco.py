# Banco de pruebas del panel del dueño: TODAS las fotos crudas de Kid, equipo por equipo, pasan por el panel como lo
# haría el dueño (sin ayuda). Sale una sola hoja con el frente y la espalda de cada uno y los avisos que le dio el panel.
# Se corre después de cada cambio al panel o a la IA de fotos, antes de decir que algo quedó.
import json, sys, textwrap
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright
R='/home/claude/m-sport/scripts/.fuentes/raw/'
CASOS=[
 {'id':'america','cat':'Liga MX','frente':['am_rica.webp','America_completo.jpg','Am_rica_frente_a_Playa.webp'],'espalda':['Am_rica_reverso_playera.webp'],'equipo':'América'},
 {'id':'cruzazul','cat':'Liga MX','frente':['Cruzazul_frente.webp','Cruz_azul__completo_azul.webp'],'espalda':['Cruz_azul_reversa.webp','Cruz_azul_completa_reversa.webp'],'equipo':'Cruz Azul'},
 {'id':'chivas','cat':'Liga MX','frente':['Uniforme_chivas_rojo_frente.webp'],'espalda':['Uniforme_chivas_rojo_atr_s.webp','chivas_espalda2.webp'],'short':['Short_Chivas_frente_.png'],'equipo':'Chivas'},
 {'id':'barca','cat':'Europa','frente':['barca_frente.jpg','barca_completo.jpg','barca_camisa2.jpg'],'espalda':['barca_atras.jpg'],'equipo':'Barcelona'},
 {'id':'barcam','cat':'Europa','frente':['barca_morado_completo.jpg','barca_morado_camisa.jpg','barca_morado_frente.webp'],'equipo':'Barcelona morado'},
 {'id':'rm','cat':'Europa','frente':['rm_completo.jpg','rm_camisa.jpg'],'espalda':['rm_reverso.webp','rm_nino_espalda.png'],'equipo':'Real Madrid'},
 {'id':'mx','cat':'Países','frente':['mx_frente.jpeg','mx_frente_short.jpg','mx_corta_larga.jpeg'],'espalda':['mx_espalda.jpg'],'equipo':'México'},
 {'id':'es','cat':'Países','frente':['es_completo.webp','es_frente_espalda.avif'],'espalda':['es_espalda.jpg'],'equipo':'España'},
 {'id':'fr','cat':'Países','frente':['fr_frente4.webp','fr_frente3.webp','fr_frente_dos.jpeg','fr_frente2.webp','fr_frente.avif'],'espalda':['fr_espalda.webp','fr_espalda_short.jpeg'],'short':['fr_espalda.webp'],'equipo':'Francia'},
]
import os
solo=sys.argv[1].split(',') if len(sys.argv)>1 else None
O='/tmp/claude-0/banco/'; os.makedirs(O,exist_ok=True)
res=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    for caso in CASOS:
        if solo and caso['id'] not in solo: continue
        fs={k:[f for f in caso.get(k,[]) if os.path.exists(R+f)] for k in ('frente','espalda','short')}
        c=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,locale='es-MX'); pg=c.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('http://localhost:5055/?sinintro#panel'); pg.wait_for_timeout(1200)
        pg.fill('#pn-codigo','0'); pg.tap('#pn-pin button'); pg.wait_for_timeout(1200)
        pg.tap('[data-tab="uniformes"]'); pg.wait_for_timeout(600); pg.tap('[data-nuevo-eq]'); pg.wait_for_timeout(600)
        avisos=[]
        for lado in ('frente','espalda','short'):
            if fs[lado]:
                pg.set_input_files('[data-foto="%s"]'%lado,[R+f for f in fs[lado]]); pg.wait_for_function("document.querySelector('#ed-aviso') && !document.querySelector('.toast.fijo')",timeout=10000) if False else None
                pg.wait_for_timeout(7000*len(fs[lado])+4000)
                avisos.append(lado+': '+pg.evaluate("document.querySelector('#ed-aviso').innerText").replace('\n\n',' | '))
        pg.evaluate("document.querySelector('.pn').scrollTo(0,99999)"); pg.wait_for_timeout(1800)
        pg.screenshot(path=O+caso['id']+'-f.png'); pg.tap('[data-pv="espalda"]'); pg.wait_for_timeout(2200); pg.screenshot(path=O+caso['id']+'-e.png')
        res.append((caso, avisos, errs)); c.close()
# hoja
W=330; H=440; n=len(res); hoja=Image.new('RGB',(n*W,2*H+150),(14,20,60)); d=ImageDraw.Draw(hoja)
try: f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
except: f=ImageFont.load_default()
for i,(caso,av,errs) in enumerate(res):
    for j,l in enumerate('fe'):
        im=Image.open(O+caso['id']+'-'+l+'.png').crop((60,520,720,1400)).resize((W,H)); hoja.paste(im,(i*W,j*H))
    txt=caso['equipo']+'\n'+'\n'.join(textwrap.wrap(' / '.join(av),48))[:600]+('\nERRORES: '+str(errs) if errs else '')
    d.multiline_text((i*W+6,2*H+4),txt,fill=(240,240,255),font=f)
hoja.save('/tmp/claude-0/-home-claude/968c9ed2-d953-59c7-b80e-40add6d1b54f/scratchpad/banco.jpg',quality=85)
print(json.dumps([(c['id'],a,e) for c,a,e in res],ensure_ascii=False))
