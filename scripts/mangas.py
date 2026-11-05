# LAS MANGAS DE LOS DOS MOLDES, para sacar un largo del otro (manga larga desde la corta y al revés).
# Por cada manga del molde: su caja, cuántos pixeles mide un metro y, renglón por renglón (64), hasta dónde llega la tela a
# la izquierda y a la derecha. El centro de la caja es la cara de afuera del brazo (así lo marca el molde); las orillas son
# la costura de abajo del brazo. Salida: assets/molde/mangas.json (lo usa src/otro-largo.js).
import json, numpy as np
from PIL import Image
RAIZ = __file__.rsplit('/scripts/', 1)[0] + '/'
out = {}
for m in ['corta', 'larga']:
    J = json.load(open(RAIZ + 'assets/molde/molde-%s.json' % m)); P = json.load(open(RAIZ + 'assets/molde/patron-%s.json' % m))
    M = np.array(Image.open(RAIZ + 'assets/molde/molde-%s-mascara.png' % m).convert('L'))
    d = {'tam': J['tam'], 'escala': P['escala'], 'piezas': J['piezas'], 'filas': {}}
    for k in ['mangaI', 'mangaD']:
        b = J['piezas'][k]; v = J['mascara'][k]; H = b[3] - b[1]; W = b[2] - b[0]; fil = []
        for r in range(64):
            y0 = b[1] + int(r * H / 64); y1 = b[1] + max(int((r + 1) * H / 64), int(r * H / 64) + 1)
            xs = np.where((M[y0:y1, b[0]:b[2]] == v).any(0))[0]
            fil.append([int(np.percentile(xs, 1)), int(np.percentile(xs, 99))] if len(xs) > W * 0.3 else None)
        # un renglón con poca tela (la punta de una orilla) toma el de al lado
        for r in range(64):
            if fil[r] is None:
                j = min((abs(j - r), j) for j in range(64) if fil[j] is not None)[1]; fil[r] = fil[j]
        d['filas'][k] = fil
    out[m] = d
json.dump(out, open(RAIZ + 'assets/molde/mangas.json', 'w'))
print('listo')
