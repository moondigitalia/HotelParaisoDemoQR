# Genera el MOLDE de M Sport (una imagen cuadrada para darle a cualquier generador de imágenes) con las siluetas EXACTAS
# del modelo 3D, sacadas de sus triángulos: frente, espalda, manga izquierda, manga derecha (como su tubo extendido: del
# hombro al puño, la mitad de afuera) y el short. Además: la máscara (qué pieza es cada pixel) y las medidas en JSON.
# La página usa las marcas de las esquinas para enderezar el molde lleno y la máscara para cortar cada pieza.
# Uso: python3 scripts/molde.py /ruta/puntos.json   (puntos.json = vértices y triángulos del 3D, de la versión de prueba)
import json, sys, numpy as np
from scipy import ndimage as ndi
from PIL import Image, ImageDraw, ImageFont

S = 2048
FUENTE = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
F = lambda n: ImageFont.truetype(FUENTE, n)
MARCAS = [(40, 40), (S - 130, 40), (40, S - 130), (S - 130, S - 130)]   # esquina sup-izq de cada marca (90 px)

def raster(P, T, sel_tri, box, mirror=False):
    """dibuja los triángulos (vista de frente: x, y) dentro de la caja, misma escala en x y y; regresa máscara y caja real"""
    tri = T[sel_tri]
    xs = P[:, 0] * (-1 if mirror else 1); ys = P[:, 1]
    usados = np.unique(tri)
    x0m, x1m, y0m, y1m = xs[usados].min(), xs[usados].max(), ys[usados].min(), ys[usados].max()
    bx0, by0, bx1, by1 = box
    s = min((bx1 - bx0) / (x1m - x0m), (by1 - by0) / (y1m - y0m))
    W, H = (x1m - x0m) * s, (y1m - y0m) * s
    ox, oy = bx0 + ((bx1 - bx0) - W) / 2, by0 + ((by1 - by0) - H) / 2
    im = Image.new('L', (S, S), 0); dr = ImageDraw.Draw(im)
    px = ox + (xs - x0m) * s; py = oy + (y1m - ys) * s
    for a, b, c in tri:
        dr.polygon([(px[a], py[a]), (px[b], py[b]), (px[c], py[c])], fill=255)
    m = np.array(im) > 0
    m = ndi.binary_closing(m, iterations=2); m = ndi.binary_fill_holes(m)
    return m, (int(round(ox)), int(round(oy)), int(round(ox + W)), int(round(oy + H)))

def tubo(P, tx0, tx1, sb, YH, lado):
    """igual que el motor: la mitad de afuera de la manga; puño = lo más bajo, hombro = lo más alto"""
    fuera = 0.07 * (tx1 - tx0); lim = tx0 - fuera if lado < 0 else tx1 + fuera
    A = P[P[:, 1] >= sb + 0.017 * YH]; ext = A[:, 0].min() if lado < 0 else A[:, 0].max(); lim2 = lim + (ext - lim) * 0.45
    M = A[(A[:, 0] < lim2) if lado < 0 else (A[:, 0] > lim2)]
    ys = np.sort(M[:, 1]); lo = ys[int(len(ys) * 0.06)]; hi = ys[int(len(ys) * 0.94)]
    K = M[M[:, 1] <= lo].mean(0); H = M[M[:, 1] >= hi].mean(0); ax = K - H; L = np.linalg.norm(ax); n = ax / L
    q = M - H; r = np.linalg.norm(q - np.outer(q @ n, n), axis=1).mean()
    return L, r

def rect(box, asp):
    x0, y0, x1, y1 = box; W = x1 - x0; H = y1 - y0
    if H / W > asp: w, h = W, int(W * asp)
    else: w, h = int(H / asp), H
    ox, oy = x0 + (W - w) // 2, y0 + (H - h) // 2
    m = np.zeros((S, S), bool); m[oy:oy + h, ox:ox + w] = True
    return m, (ox, oy, ox + w, oy + h)

def hacer(d, manga, salida):
    D = d[manga]; P = np.array(D['p']).reshape(-1, 3); T = np.array(D['i']).reshape(-1, 3)
    sb, Y0, YH, tx0, tx1 = D['shirtBot'], D['Y0'], D['YH'], D['tx0'], D['tx1']
    shortBot = Y0 + (0.398 if manga == 'corta' else 0.388) * YH
    ty = P[T][:, :, 1]   # alto de los 3 vértices de cada triángulo
    playera = (ty >= sb).all(1)
    short = (ty <= sb + 0.002).all(1) & (ty >= shortBot - 0.002).all(1) & (np.abs(P[T][:, :, 0]).max(1) < 0.78 * (tx1 - tx0))   # sin los puños de la manga larga
    mF, bF = raster(P, T, playera, (150, 190, 990, 1010))
    mE, bE = raster(P, T, playera, (1058, 190, 1898, 1010), mirror=True)
    mS, bS = raster(P, T, short, (1420, 1240, 1900, 1860))
    LI, rI = tubo(P, tx0, tx1, sb, YH, -1); LD, rD = tubo(P, tx0, tx1, sb, YH, 1)
    mI, bI = rect((210, 1250, 610, 1880), LI / (np.pi * rI)); mD, bD = rect((820, 1250, 1220, 1880), LD / (np.pi * rD))
    # la máscara recorta un poco hacia adentro de cada contorno (la línea del dibujo no se cuela a la pieza)
    mascara = np.zeros((S, S), np.uint8)
    for v, m in [(1, mF), (2, mE), (5, mS), (3, mI), (4, mD)]: mascara[ndi.binary_erosion(m, iterations=7)] = v
    arr = np.full((S, S, 3), (236, 238, 243), np.uint8)
    for m in [mF, mE, mS, mI, mD]:
        arr[m] = (255, 255, 255); borde = m & ~ndi.binary_erosion(m, iterations=3); arr[borde] = (40, 44, 60)
    img = Image.fromarray(arr); dr = ImageDraw.Draw(img)
    def t(x, y, s, txt, fill=(20, 24, 50), anchor='mm'): dr.text((x, y), txt, font=F(s), fill=fill, anchor=anchor)
    t(S // 2, 75, 46, 'MOLDE M SPORT · MANGA ' + manga.upper())
    t((bF[0] + bF[2]) // 2, bF[1] - 30, 34, 'FRENTE'); t((bE[0] + bE[2]) // 2, bE[1] - 30, 34, 'ESPALDA')
    t((bS[0] + bS[2]) // 2, bS[1] - 30, 30, 'SHORT (FRENTE)')
    gris = (95, 100, 125)
    for b, nom, frente_izq in [(bI, 'MANGA DERECHA DEL JUGADOR', False), (bD, 'MANGA IZQUIERDA DEL JUGADOR', True)]:   # mangaI del 3D = la derecha de quien la viste (a tu izquierda viéndolo de frente)
        cx = (b[0] + b[2]) // 2; cy = (b[1] + b[3]) // 2
        t(cx, b[1] - 58, 23, nom); t(cx, b[1] - 24, 22, '▲ HOMBRO', gris); t(cx, b[3] + 26, 22, '▼ PUÑO', gris)
        dr.text((b[0] - 12, cy), 'FRENTE' if frente_izq else 'ATRÁS', font=F(20), fill=gris, anchor='rm')
        dr.text((b[2] + 12, cy), 'ATRÁS' if frente_izq else 'FRENTE', font=F(20), fill=gris, anchor='lm')
    for (x, y) in MARCAS:
        dr.rectangle([x, y, x + 90, y + 90], fill=(0, 0, 0)); dr.rectangle([x + 25, y + 25, x + 65, y + 65], fill=(255, 255, 255)); dr.rectangle([x + 38, y + 38, x + 52, y + 52], fill=(0, 0, 0))
    img.save(salida + '.png')
    Image.fromarray(mascara * 40).save(salida + '-mascara.png')
    json.dump({'tam': S, 'manga': manga, 'marcas': [[x + 45, y + 45] for x, y in MARCAS],
               'piezas': {'frente': bF, 'espalda': bE, 'mangaI': bI, 'mangaD': bD, 'short': bS},
               'mascara': {'frente': 40, 'espalda': 80, 'mangaI': 120, 'mangaD': 160, 'short': 200},
               'tubo': {'mangaI': [LI, rI], 'mangaD': [LD, rD]}}, open(salida + '.json', 'w'))
    print(manga, 'frente', bF, 'mangas', bI, bD, 'short', bS, 'tubo', round(LI, 3), round(rI, 3))

if __name__ == '__main__':
    d = json.load(open(sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/puntos.json'))
    for m in ['corta', 'larga']: hacer(d, m, '/home/claude/m-sport/assets/molde/molde-' + m)
