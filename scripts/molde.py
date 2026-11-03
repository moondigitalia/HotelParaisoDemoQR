# EL MOLDE de M Sport = el patrón de costura del modelo 3D (scripts/patron.py), dibujado tal cual, a la misma escala.
# Lo que el generador de imágenes pinte en cada pieza cae exactamente ahí en el 3D: no hay proyección ni estiramiento.
# Además: la máscara (qué pieza es cada pixel) y el JSON con marcas y cajas. La página usa las marcas de las esquinas
# para enderezar el molde lleno.
# Uso: python3 scripts/molde.py   (después de scripts/patron.py)
import json, numpy as np
from scipy import ndimage as ndi
from PIL import Image, ImageDraw, ImageFont

S = 2048
RAIZ = '/home/claude/m-sport/'
FUENTE = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
F = lambda n: ImageFont.truetype(FUENTE, n)
MARCAS = [(40, 40), (S - 130, 40), (40, S - 130), (S - 130, S - 130)]   # esquina sup-izq de cada marca (90 px)
VAL = {'frente': 1, 'espalda': 2, 'mangaI': 3, 'mangaD': 4, 'short': 5}

def silueta(UV, J, k):
    b = J['piezas'][k]; x0, y0, x1, y1 = b
    im = Image.new('L', (S, S), 0); dr = ImageDraw.Draw(im)
    px = UV[..., 0] * S; py = UV[..., 1] * S
    dentro = (UV[..., 0] >= 0).all(1) & (px >= x0 - 2).all(1) & (px <= x1 + 2).all(1) & (py >= y0 - 2).all(1) & (py <= y1 + 2).all(1)
    for t in np.where(dentro)[0]:
        dr.polygon([(px[t, c], py[t, c]) for c in range(3)], fill=255)
    m = np.array(im) > 0
    m = ndi.binary_closing(m, iterations=4); m = ndi.binary_fill_holes(m)
    m = ndi.gaussian_filter(m.astype(float), 7) > 0.5   # contorno suave (el modelo tiene orillas con ruido); la tela en el 3D llega más allá
    lab, n = ndi.label(m)
    if n > 1:   # solo la pieza (sin pedacitos sueltos)
        tam = ndi.sum(m, lab, range(1, n + 1)); m = lab == (np.argmax(tam) + 1)
    return m

def hacer(manga):
    UV = np.load('/tmp/claude-0/patron-%s.npy' % manga)
    J = json.load(open(RAIZ + 'assets/molde/patron-%s.json' % manga))
    sil = {k: silueta(UV, J, k) for k in J['piezas']}
    mascara = np.zeros((S, S), np.uint8)
    for k, m in sil.items(): mascara[m] = VAL[k] * 40
    arr = np.full((S, S, 3), (236, 238, 243), np.uint8)
    for m in sil.values():
        arr[m] = (255, 255, 255); borde = m & ~ndi.binary_erosion(m, iterations=3); arr[borde] = (40, 44, 60)
    img = Image.fromarray(arr); dr = ImageDraw.Draw(img)
    def t(x, y, s, txt, fill=(20, 24, 50), anchor='mm'): dr.text((x, y), txt, font=F(s), fill=fill, anchor=anchor)
    t(S // 2, 85, 44, 'MOLDE M SPORT · MANGA ' + manga.upper())
    gris = (95, 100, 125)
    P = J['piezas']
    for k, nom in [('frente', 'FRENTE'), ('espalda', 'ESPALDA (VISTA DE ATRÁS)'), ('short', 'SHORT (FRENTE)')]:
        b = P[k]; t((b[0] + b[2]) // 2, b[1] - 32, 30 if k != 'espalda' else 26, nom)
    for k, nom, izq in [('mangaI', 'LA MANGA QUE EN LA FOTO DEL FRENTE VES A TU IZQUIERDA', 'ATRÁS'), ('mangaD', 'LA MANGA QUE EN LA FOTO DEL FRENTE VES A TU DERECHA', 'FRENTE')]:
        b = P[k]; cx = (b[0] + b[2]) // 2
        p1, p2 = nom.split(' EN LA FOTO'); t(cx, b[1] - 80, 19, p1); t(cx, b[1] - 58, 17, 'EN LA FOTO' + p2); t(cx, b[1] - 32, 20, '▲ HOMBRO   ·   AFUERA EN EL CENTRO', gris); t(cx, b[3] + 26, 20, '▼ PUÑO', gris)
        der = 'FRENTE' if izq == 'ATRÁS' else 'ATRÁS'
        t(b[0] + 70, b[3] + 26, 18, '◄ ' + izq, gris); t(b[2] - 70, b[3] + 26, 18, der + ' ►', gris)
    for (x, y) in MARCAS:
        dr.rectangle([x, y, x + 90, y + 90], fill=(0, 0, 0)); dr.rectangle([x + 25, y + 25, x + 65, y + 65], fill=(255, 255, 255)); dr.rectangle([x + 38, y + 38, x + 52, y + 52], fill=(0, 0, 0))
    salida = RAIZ + 'assets/molde/molde-' + manga
    img.save(salida + '.png')
    Image.fromarray(mascara).save(salida + '-mascara.png')
    cajas = {}
    for k, m in sil.items():
        ys, xs = np.where(m); cajas[k] = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
    json.dump({'tam': S, 'manga': manga, 'marcas': [[x + 45, y + 45] for x, y in MARCAS], 'piezas': cajas,
               'mascara': {k: VAL[k] * 40 for k in VAL}, 'patron': True}, open(salida + '.json', 'w'))
    print(manga, cajas)

if __name__ == '__main__':
    for m in ['corta', 'larga']: hacer(m)
