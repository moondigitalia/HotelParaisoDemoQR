# EL PATRÓN DE COSTURA del modelo 3D (como en los juegos de fútbol y las marcas): cada triángulo de la playera y del short
# cae en una pieza plana — FRENTE, ESPALDA, MANGA DERECHA, MANGA IZQUIERDA (del jugador) y SHORT — con costuras donde van
# en una playera real (los costados, debajo de la manga). Todas las piezas a la MISMA escala (pixeles por metro), aplanadas
# a lo largo de la tela (no proyectadas): un círculo pintado en el patrón sale redondo en el 3D.
# Salida: assets/3d/<modelo>-patron.bin (las coordenadas de cada esquina de cada triángulo, en el orden del modelo) y
#         assets/molde/patron-<modelo>.json (dónde quedó cada pieza), que usa scripts/molde.py para dibujar el molde.
# Uso: python3 scripts/patron.py /ruta/puntos.json
import json, sys, numpy as np

S = 2048
RAIZ = '/home/claude/m-sport/'

def perfil_arco(xs, zs, frente, paso=0.004):
    """a lo largo de un corte horizontal: la superficie (lo más al frente o lo más atrás) y su largo acumulado desde x=0"""
    if len(xs) < 3: return None
    x0, x1 = xs.min() - paso, xs.max() + paso
    nb = int(np.ceil((x1 - x0) / paso)) + 1
    b = ((xs - x0) / paso).astype(int)
    z = np.full(nb, np.nan)
    for k in range(nb):
        m = b == k
        if m.any(): z[k] = zs[m].max() if frente else zs[m].min()
    ok = ~np.isnan(z)
    if ok.sum() < 3: return None
    idx = np.arange(nb); z = np.interp(idx, idx[ok], z[ok])
    z = np.convolve(z, np.ones(5) / 5, mode='same')   # sin arrugas
    xc = x0 + idx * paso
    ds = np.sqrt(paso ** 2 + np.diff(z) ** 2)
    s = np.concatenate([[0], np.cumsum(ds)])
    s -= np.interp(0.0, xc, s)   # el centro del pecho es 0
    return xc, s

def tubo(P, tx0, tx1, sb, YH, lado):
    """el eje de la manga (como el motor): del hombro (lo más alto de su mitad de afuera) al puño (lo más bajo)"""
    fuera = 0.07 * (tx1 - tx0); lim = tx0 - fuera if lado < 0 else tx1 + fuera
    A = P[P[:, 1] >= sb + 0.017 * YH]; ext = A[:, 0].min() if lado < 0 else A[:, 0].max(); lim2 = lim + (ext - lim) * 0.45
    M = A[(A[:, 0] < lim2) if lado < 0 else (A[:, 0] > lim2)]
    ys = np.sort(M[:, 1]); lo = ys[int(len(ys) * 0.06)]; hi = ys[int(len(ys) * 0.94)]
    K = M[M[:, 1] <= lo].mean(0); H = M[M[:, 1] >= hi].mean(0)
    return H, K

def hacer(d, manga):
    D = d[manga]; P = np.array(D['p']).reshape(-1, 3); T = np.array(D['i']).reshape(-1, 3)
    sb, Y0, YH, tx0, tx1 = D['shirtBot'], D['Y0'], D['YH'], D['tx0'], D['tx1']
    W = tx1 - tx0
    shortBot = Y0 + (0.398 if manga == 'corta' else 0.388) * YH
    C = P[T].mean(1)                                   # centro de cada triángulo
    nT = len(T)
    pieza = np.full(nT, -1)                            # 0 frente, 1 espalda, 2 manga der. jugador (x<0), 3 manga izq. (x>0), 4 short frente
    # --- mangas: renglón por renglón, lo que queda fuera del cuerpo en un renglón que sí tiene manga (igual que el motor)
    nb = 400; rb = np.clip(((C[:, 1] - Y0) / YH * nb).astype(int), 0, nb - 1)
    pb = np.clip(((P[:, 1] - Y0) / YH * nb).astype(int), 0, nb - 1)
    minx = np.full(nb, 9.0); maxx = np.full(nb, -9.0)
    np.minimum.at(minx, pb, P[:, 0]); np.maximum.at(maxx, pb, P[:, 0])
    tieneI = minx < tx0 - 0.12 * W; tieneD = maxx > tx1 + 0.12 * W
    bajo = C[:, 1] < sb   # abajo del dobladillo solo cuentan los puños de manga larga (el short es más ancho que el cuerpo)
    lejos = np.abs(C[:, 0]) > 0.78 * W
    mI = (C[:, 0] < tx0) & tieneI[rb] & (~bajo | lejos)
    mD = (C[:, 0] > tx1) & tieneD[rb] & (~bajo | lejos)
    for lado, msk in [(-1, mI), (1, mD)]:
        Hh, K = tubo(P, tx0, tx1, sb, YH, lado); ax = K - Hh; L = np.linalg.norm(ax); n = ax / L
        tt = (C - Hh) @ n / L
        msk &= (tt > -0.08) & (tt < 1.08)   # el hombro (arriba del eje) se queda con el cuerpo, como una manga raglán
    pieza[mI] = 2; pieza[mD] = 3
    # --- frente y espalda: cada renglón del cuerpo es un óvalo (ancho y fondo medidos y suavizados de renglón a renglón).
    # El ángulo en el óvalo dice si es frente o espalda (la costura queda en el costado) y el largo a lo largo del óvalo
    # es la coordenada plana: la tela se aplana como se extiende una playera real, sin picos.
    cuerpo = (pieza < 0) & (C[:, 1] >= shortBot)
    vi_c = np.unique(T[cuerpo]); pc = P[vi_c]; bc = np.clip(((pc[:, 1] - Y0) / YH * nb).astype(int), 0, nb - 1)
    A_ = np.full(nb, np.nan); B_ = np.full(nb, np.nan); CX = np.full(nb, np.nan); CZ = np.full(nb, np.nan)
    for r in range(nb):
        m = bc == r
        if m.sum() < 6: continue
        x = pc[m, 0]; z = pc[m, 2]
        x0_, x1_ = np.percentile(x, 2), np.percentile(x, 98); z0_, z1_ = np.percentile(z, 2), np.percentile(z, 98)
        A_[r] = (x1_ - x0_) / 2; CX[r] = (x1_ + x0_) / 2; B_[r] = (z1_ - z0_) / 2; CZ[r] = (z1_ + z0_) / 2
    def suave(a):
        ok = ~np.isnan(a); a = np.interp(np.arange(nb), np.arange(nb)[ok], a[ok])
        from scipy.ndimage import median_filter, uniform_filter1d
        return uniform_filter1d(median_filter(a, 9), 9)
    A_, B_, CX, CZ = suave(A_), suave(B_), suave(CX), suave(CZ)
    th_tab = np.linspace(-np.pi, np.pi, 721)
    def arco(r, th):   # largo sobre el óvalo de este renglón, de 0 (centro de adelante) a th
        a, b = A_[r], B_[r]; ds = np.sqrt((a * np.cos(th_tab)) ** 2 + (b * np.sin(th_tab)) ** 2)
        s_ = np.concatenate([[0], np.cumsum((ds[1:] + ds[:-1]) / 2 * np.diff(th_tab))]); s_ -= np.interp(0, th_tab, s_)
        return np.interp(th, th_tab, s_)
    def angulo(pts, r):
        return np.arctan2((pts[:, 0] - CX[r]) / np.maximum(A_[r], 1e-4), (pts[:, 2] - CZ[r]) / np.maximum(B_[r], 1e-4))
    thC = np.zeros(nT); 
    for r in np.unique(rb[cuerpo]):
        m = cuerpo & (rb == r); thC[m] = angulo(C[m], r)
    adelante = np.abs(thC) <= np.pi / 2
    playera = cuerpo & (C[:, 1] >= sb)
    short = cuerpo & (C[:, 1] < sb)
    pieza[playera & adelante] = 0; pieza[playera & ~adelante] = 1
    pieza[short & adelante] = 4
    # coordenadas planas (metros) de cada esquina: u a lo ancho, v a lo alto
    U = np.full((nT, 3), np.nan); V = np.full((nT, 3), np.nan)
    for pz in (0, 1, 4):
        sel = np.where(pieza == pz)[0]
        if not len(sel): continue
        for c in range(3):
            vtx = T[sel, c]; pts = P[vtx]; rr_ = pb[vtx]; uu = np.zeros(len(sel))
            for r in np.unique(rr_):
                m = rr_ == r; th = angulo(pts[m], r)
                if pz == 1: th = np.where(th > 0, th - np.pi, th + np.pi); uu[m] = -arco(r, th)   # la espalda vista desde atrás
                elif pz == 4: uu[m] = pts[m, 0]   # el short: plano, como su foto de frente (dos piernas no son un óvalo)
                else: uu[m] = arco(r, np.clip(th, -np.pi / 2 - 0.3, np.pi / 2 + 0.3))
            U[sel, c] = uu; V[sel, c] = pts[:, 1]
    # mangas: el tubo desenrollado completo, con la costura debajo (hacia el cuerpo) y la cara de afuera en el centro
    tubos = {}
    for pz, lado in [(2, -1), (3, 1)]:
        sel = np.where(pieza == pz)[0]
        if not len(sel): continue
        # el centro verdadero del brazo: su dirección principal y, tramo por tramo, el centro de su corte
        vi = np.unique(T[sel]); pv = P[vi]; c0 = pv.mean(0)
        Hh, K = tubo(P, tx0, tx1, sb, YH, lado); n = (K - Hh) / np.linalg.norm(K - Hh)   # del hombro al puño (en manga corta lo más largo es la vuelta, no el brazo)
        t = (pv - c0) @ n; t0, t1 = np.percentile(t, 1), np.percentile(t, 99); L = t1 - t0; t = t - t0
        o = np.array([lado, 0.0, 0.0]); o -= n * (o @ n); o /= np.linalg.norm(o)
        f = np.array([0, 0, 1.0]); f -= n * (f @ n) + o * (f @ o); f /= np.linalg.norm(f)
        nbt = 40; tb2 = np.clip((t / L * nbt).astype(int), 0, nbt - 1); cen = np.zeros((nbt, 3))
        for k2 in range(nbt):
            m = tb2 == k2; cen[k2] = pv[m].mean(0) if m.sum() > 5 else np.nan
        okc = ~np.isnan(cen[:, 0])
        for dd in range(3): cen[:, dd] = np.interp(np.arange(nbt), np.arange(nbt)[okc], cen[okc, dd])
        from scipy.ndimage import uniform_filter1d
        cen = uniform_filter1d(cen, 9, axis=0)
        q = pv - cen[tb2]; rr = q - np.outer(q @ n, n)
        # cada corte del brazo es un óvalo (la manga cuelga aplanada): ancho hacia afuera y fondo hacia el frente,
        # medidos tramo por tramo y suavizados; la vuelta se mide sobre el óvalo, así un círculo pintado sale redondo
        ro, rf = rr @ o, rr @ f
        tb = np.clip((t / L * 40).astype(int), 0, 39); ao = np.full(40, np.nan); af = np.full(40, np.nan)
        for k in range(40):
            m = tb == k
            if m.sum() > 8: ao[k] = (np.percentile(ro[m], 97) - np.percentile(ro[m], 3)) / 2; af[k] = (np.percentile(rf[m], 97) - np.percentile(rf[m], 3)) / 2
        def suave40(a):
            ok = ~np.isnan(a); a = np.interp(np.arange(40), np.arange(40)[ok], a[ok]); return np.convolve(np.pad(a, 4, mode='edge'), np.ones(9) / 9, mode='valid')
        ao, af = suave40(ao), suave40(af)
        fi = np.arctan2(rf / af[tb], ro / ao[tb])      # 0 = cara de afuera; + hacia el frente
        th_t = np.linspace(-np.pi, np.pi, 721); arcs = np.zeros((40, 721))
        for k in range(40):
            ds = np.sqrt((ao[k] * np.sin(th_t)) ** 2 + (af[k] * np.cos(th_t)) ** 2)
            a_ = np.concatenate([[0], np.cumsum((ds[1:] + ds[:-1]) / 2 * np.diff(th_t))]); arcs[k] = a_ - np.interp(0, th_t, a_)
        largo = np.array([np.interp(fi[j], th_t, arcs[tb[j]]) for j in range(len(fi))])
        rs = np.array([arcs[k][-1] - arcs[k][0] for k in range(40)])[tb] / (2 * np.pi)   # radio equivalente (para la costura)
        r = np.sqrt(ro ** 2 + rf ** 2)
        # derecha del jugador (x<0): el frente cae a la derecha de la pieza; izquierda: a la izquierda
        uu = largo * (1 if lado < 0 else -1); vv = t   # más abajo en la pieza = más hacia el puño
        mapa_u = dict(zip(vi, uu)); mapa_v = dict(zip(vi, vv)); mapa_f = dict(zip(vi, fi))
        for tt in sel:
            fs = [mapa_f[T[tt, c]] for c in range(3)]
            for c in range(3):
                u_ = mapa_u[T[tt, c]]
                # un triángulo que cruza la costura de abajo (fi = ±180°) no se estira de un lado al otro
                if max(fs) - min(fs) > np.pi:
                    rv = rs[np.searchsorted(vi, T[tt, c])]
                    if fs[c] < 0: u_ += 2 * np.pi * rv * (1 if lado < 0 else -1)
                U[tt, c] = u_; V[tt, c] = mapa_v[T[tt, c]]
        tubos[pz] = [float(L), float(np.median(r))]
    # --- acomodo en la hoja: misma escala para todas las piezas
    cajas = {}
    for pz in range(5):
        m = pieza == pz
        if not m.any(): continue
        uu_, vv_ = U[m].ravel(), V[m].ravel(); cajas[pz] = [np.nanpercentile(uu_, 0.3), np.nanpercentile(uu_, 99.7), np.nanpercentile(vv_, 0.3), np.nanpercentile(vv_, 99.7)]
    ancho = lambda pz: cajas[pz][1] - cajas[pz][0]
    alto = lambda pz: cajas[pz][3] - cajas[pz][2]
    # fila 1: frente y espalda; fila 2: manga der., manga izq., short — todo entre las marcas (160..1888)
    m0, m1, gap = 160, 1888, 60
    fila1 = max(alto(0), alto(1)); fila2 = max(alto(2), alto(3), alto(4))
    w1 = ancho(0) + ancho(1); w2 = ancho(2) + ancho(3) + ancho(4)
    k = min((m1 - m0 - gap) / max(w1, 1e-6), (m1 - m0 - 2 * gap) / max(w2, 1e-6), (m1 - m0 - 3 * 95) / (fila1 + fila2))
    pos = {}
    y1 = m0 + 70; y2 = y1 + fila1 * k + 115
    libre1 = (m1 - m0) - w1 * k; x = m0 + libre1 / 3
    for pz in (0, 1): pos[pz] = (x, y1 + (fila1 - alto(pz)) * k / 2); x += ancho(pz) * k + libre1 / 3
    libre2 = (m1 - m0) - w2 * k; x = m0 + libre2 / 4
    for pz in (2, 3, 4): pos[pz] = (x, y2 + (fila2 - alto(pz)) * k / 2 if pz == 4 else y2); x += ancho(pz) * k + libre2 / 4
    # un triángulo que quedó estirado de un lado a otro de su pieza (ruido del modelo) toma un solo punto: su color, sin raya
    larg = np.nanmax(U, 1) - np.nanmin(U, 1); altg = np.nanmax(V, 1) - np.nanmin(V, 1)
    malo = ((pieza == 2) | (pieza == 3)) & ((larg > 0.12) | (altg > 0.12))   # solo en mangas: los que cruzan la costura de abajo
    for c in range(3): U[malo, c] = np.nanmedian(U[malo], 1); V[malo, c] = np.nanmedian(V[malo], 1)
    for pz in cajas:
        m = pieza == pz; U[m] = np.clip(U[m], cajas[pz][0], cajas[pz][1]); V[m] = np.clip(V[m], cajas[pz][2], cajas[pz][3])
    UV = np.zeros((nT, 3, 2), np.float32); UV[:] = -1
    for pz in pos:
        m = pieza == pz
        px = pos[pz][0] + (U[m] - cajas[pz][0]) * k
        if pz in (2, 3): py = pos[pz][1] + (V[m] - cajas[pz][2]) * k            # mangas: v ya va hacia abajo
        else: py = pos[pz][1] + (cajas[pz][3] - V[m]) * k                        # lo alto arriba
        UV[m, :, 0] = px / S; UV[m, :, 1] = py / S
    # en uint16: 0 = "sin pieza" (calcetas, atrás del short)
    q = np.zeros((nT, 3, 2), np.uint16)
    okm = UV[..., 0] >= 0
    q[okm] = np.clip(np.round(UV[okm] * 65534) + 1, 1, 65535).astype(np.uint16)
    q.tofile(RAIZ + 'assets/3d/%s-patron.bin' % manga)
    # la pieza de cada triángulo (0 frente, 1 espalda, 2 y 3 mangas, 4 short, 255 sin pieza): el 3D la obedece en las
    # costuras (cintura, puño) en vez de decidir por la altura; así no hay "goteo" de una pieza en otra
    pzq = np.where(pieza < 0, 255, pieza).astype(np.uint8); pzq.tofile(RAIZ + 'assets/3d/%s-pieza.bin' % manga)
    info = {'tam': S, 'escala': float(k), 'piezas': {}, 'tubos': tubos}
    nom = {0: 'frente', 1: 'espalda', 2: 'mangaI', 3: 'mangaD', 4: 'short'}
    for pz in pos:
        info['piezas'][nom[pz]] = [int(pos[pz][0]), int(pos[pz][1]), int(pos[pz][0] + ancho(pz) * k), int(pos[pz][1] + alto(pz) * k)]
    json.dump(info, open(RAIZ + 'assets/molde/patron-%s.json' % manga, 'w'))
    np.save('/tmp/claude-0/patron-%s.npy' % manga, UV)
    print(manga, 'escala', round(k), 'px/m', {nom[p]: info['piezas'][nom[p]] for p in pos}, 'triángulos', {nom[p]: int((pieza == p).sum()) for p in pos}, 'sin pieza', int((pieza < 0).sum()))

if __name__ == '__main__':
    d = json.load(open(sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/puntos.json'))
    for m in ['corta', 'larga']: hacer(d, m)
