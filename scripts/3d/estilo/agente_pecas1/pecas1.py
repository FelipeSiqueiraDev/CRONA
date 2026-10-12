# ---------- peças detalhadas (sofá, relógio, escrivaninha com teclado, quadro, porta) ----------
# Usa da cena: c, M, pegadas, hx, emissivo, tela, ruido, np, math. Cole no lugar das 5 defs antigas (os ajudantes _p1_ vão junto).
import motor as _mt

_KX, _KY, _KZ = _mt.KX, _mt.KY, _mt.KZ
_QUENTE = np.array([16.0, 4.0, -10.0])
_LUZ = np.array([-0.3, 0.5, 1.0]) / np.linalg.norm([-0.3, 0.5, 1.0])


def _p1_fator(n, tipo):
    """A luz que o acabamento da cena vai pôr nesta face (para o material já sair na cor final)."""
    n = np.asarray(n, float) / np.linalg.norm(n)
    if n[2] > 0.6:
        return 1.04 if tipo == 2 else 1.0
    if n[1] >= n[0]:
        return 0.97 if tipo == 2 else 0.84
    return 0.9 if tipo == 2 else 0.66


def _p1_final(T, n, tipo):
    """A cor que, depois da luz da face e do tom quente do acabamento, vira exatamente T."""
    f = _p1_fator(n, tipo)
    return (T - (1 - f) * _QUENTE) / f


def _p1_sol(n):
    """Quanto a face recebe de luz (0 a 1): o topo 1, o lado +y 0,5, o lado +x 0."""
    n = np.asarray(n, float) / np.linalg.norm(n)
    return float(np.clip((n @ _LUZ) / _LUZ[2], 0, 1))


def _p1_rampa(cores):
    return np.stack([hx(x) for x in cores])


def _p1_malha(b, r, mat, tipo=3, seg=3, inclina=0.0, contorno=True):
    """
    Bloco de quinas arredondadas (estofado, almofada), feito de faces planas: as oito quinas são pedaços de
    elipsoide (raios rx, ry, rz embaixo e rz em cima) ligados por faixas retas. inclina: x anda isso por metro de z
    (o encosto deitado para trás). Devolve o objeto.
    """
    x0, x1, y0, y1, z0, z1 = b
    if np.isscalar(r):
        r = (r, r, r, r)
    rx, ry, rzb, rzt = r
    rx = min(rx, (x1 - x0) / 2 * 0.999)
    ry = min(ry, (y1 - y0) / 2 * 0.999)
    k = min(1.0, (z1 - z0) * 0.999 / max(1e-9, rzb + rzt))
    rzb, rzt = rzb * k, rzt * k
    o = c.novo_obj(tipo, contorno=contorno)

    def vert(ph, th, sx, sy, sz):
        cp = math.cos(ph)
        x = (x1 - rx if sx > 0 else x0 + rx) + rx * cp * math.cos(th)
        y = (y1 - ry if sy > 0 else y0 + ry) + ry * cp * math.sin(th)
        z = (z1 - rzt + rzt * math.sin(ph)) if sz > 0 else (z0 + rzb + rzb * math.sin(ph))
        return np.array([x + inclina * (z - z0), y, z])
    linhas = [(-math.pi / 2 + math.pi / 2 * k / seg, -1) for k in range(seg + 1)] + [(math.pi / 2 * k / seg, 1) for k in range(seg + 1)]
    colunas = []
    for q in range(4):
        sx = 1 if q in (0, 3) else -1
        sy = 1 if q in (0, 1) else -1
        for k in range(seg + 1):
            colunas.append((math.pi / 2 * (q + k / seg), sx, sy))
    V = [[vert(ph, th, sx, sy, sz) for (th, sx, sy) in colunas] for (ph, sz) in linhas]
    zm = (z0 + z1) / 2
    C = np.array([(x0 + x1) / 2 + inclina * (zm - z0), (y0 + y1) / 2, zm])

    def face(pts):
        q = []
        for p in pts:
            if not q or np.linalg.norm(p - q[-1]) > 1e-7:
                q.append(p)
        if len(q) > 2 and np.linalg.norm(q[0] - q[-1]) < 1e-7:
            q.pop()
        if len(q) < 3:
            return
        Q = np.array(q)
        n = np.zeros(3)
        for i in range(len(Q)):
            a, bb = Q[i], Q[(i + 1) % len(Q)]
            n += np.array([(a[1] - bb[1]) * (a[2] + bb[2]), (a[2] - bb[2]) * (a[0] + bb[0]), (a[0] - bb[0]) * (a[1] + bb[1])])
        if np.linalg.norm(n) < 1e-10:
            return
        n /= np.linalg.norm(n)
        if (Q.mean(0) - C) @ n < 0:
            n = -n
        c.face_plana([tuple(p) for p in Q], tuple(n), mat, M, o)
    nc = len(colunas)
    for i in range(len(linhas) - 1):
        for j in range(nc):
            j2 = (j + 1) % nc
            face([V[i][j], V[i][j2], V[i + 1][j2], V[i + 1][j]])
    tampa = [V[-1][q * (seg + 1)] for q in range(4)]
    face(tampa)
    face([V[0][q * (seg + 1)] for q in range(4)][::-1])
    return o


def _p1_mat_rampa(R, lo, hi, tipo=3, extra=None):
    """
    Material de rampa: o tom sai da luz da face (lo no escuro, hi no topo), mais o que `extra(L, n, P)` somar
    (em degraus inteiros da rampa), e já compensado da luz do acabamento.
    """
    def f(L, n, P):
        s = _p1_sol(n)
        idx = np.full(len(L), lo + s * (hi - lo))
        if extra is not None:
            idx = idx + extra(L, np.asarray(n, float) / np.linalg.norm(n), P)
        idx = np.clip(np.round(idx), 0, len(R) - 1).astype(int)
        return _p1_final(R[idx], n, tipo)
    return emissivo(f)


# ----- o couro -----
_COURO = _p1_rampa(['#4a2416', '#5e2e1a', '#743a20', '#8a4826', '#a0572e', '#b46836', '#c67a40', '#d68c4c', '#e4a05c', '#eeb672'])


def _p1_couro(b, lo=2.4, hi=6.6, cupula=1.0, costura=None, brilho=True, grad=1.0, inclina=0.0):
    """
    O couro do estofado: a luz da face, a cúpula clara no meio do topo (fofo, em degraus de quina redonda), o
    reflexo do couro puxado para a luz, os lados que escurecem para baixo (grad) e a costura (uma linha em z).
    """
    x0, x1, y0, y1, z0, z1 = b

    def extra(L, n, P):
        e = np.zeros(len(L))
        X = P[:, 0] - inclina * (P[:, 2] - z0)
        if n[2] > 0.8:
            u = (X - (x0 + x1) / 2) / ((x1 - x0) / 2)
            v = (P[:, 1] - (y0 + y1) / 2) / ((y1 - y0) / 2)
            d = (np.abs(u) ** 3 + np.abs(v) ** 3) ** (1 / 3)
            e += np.where(d < 0.42, cupula, np.where(d < 0.72, cupula * 0.55, 0))
            if brilho:
                bu, bv = (u + 0.3) * 1.3, v - 0.3
                e += np.where((np.abs(bu) ** 3 + np.abs(bv) ** 3) < 0.03, 1.0, 0)
        elif n[2] < 0.6:
            t = np.clip((P[:, 2] - z0) / max(1e-6, z1 - z0), 0, 1)
            e += np.where(t < 0.4, -grad, 0)
        if costura is not None and abs(n[2]) < 0.75:
            e += np.where(np.abs(P[:, 2] - costura) < 0.5 / _KZ, -2.0, 0)
            e += np.where(np.abs(P[:, 2] - costura - 1 / _KZ) < 0.5 / _KZ, 0.8, 0)
        return e
    return _p1_mat_rampa(_COURO, lo, hi, extra=extra)


# ----- a madeira -----
_MAD = _p1_rampa(['#3a1e10', '#4a2716', '#5c321b', '#6e3e22', '#80492a', '#925531', '#a46239', '#b47040', '#c4824c', '#d29658'])


def _p1_madeira(lo=3.0, hi=7.0, tipo=3, tabua=None, eixo=0, veio=True, seed=0, x_ref=0.0):
    """A madeira em rampa: as tábuas no topo (a junta escura, 1 px claro depois dela) e o veio em riscas compridas."""
    def extra(L, n, P):
        e = np.zeros(len(L))
        if n[2] > 0.8 and tabua:
            s = P[:, 1] if eixo == 0 else P[:, 0]
            t = P[:, 0] if eixo == 0 else P[:, 1]
            g = (s - x_ref) / tabua
            fila = np.floor(g)
            fr = (g - fila) * tabua
            e += np.where(fr < 1 / 32, -3.5, np.where(fr < 2 / 32, 0.8, 0))
            if veio:
                pos = 0.35 + 0.35 * ruido(fila, seed)
                risca = (np.abs(fr - pos * tabua) < 1 / 64) & (np.sin(t * 2.2 + fila * 1.9 + seed) > -0.35)
                e += np.where(risca, -1.0, 0)
        return e
    return _p1_mat_rampa(_MAD, lo, hi, tipo=tipo, extra=extra)


def sofa(x, y0, y1):
    """
    O sofá de couro de dois lugares encostado na parede da esquerda (x = 0), virado para +x: os braços com o rolo
    em cima (mais largo que o painel, a sombra embaixo dele), as duas almofadas de encosto fofas e deitadas para trás,
    as duas de assento com a costura, o corpo escuro embaixo e os pés de madeira.
    """
    prof = 0.82
    xf = x + prof
    mm = (y0 + y1) / 2
    br = 0.22                          # a largura do braço
    # os pés de madeira
    for b in (y0 + 0.04, y1 - 0.1):
        for a in (x + 0.05, xf - 0.1):
            _p1_malha((a, a + 0.06, b, b + 0.06, 0.0, 0.1), (0.012, 0.012, 0.0, 0.0), _p1_madeira(2.0, 6.0, veio=False), seg=1)
    # o corpo (a caixa do assento, entre os braços), mais escuro
    b = (x + 0.04, xf - 0.035, y0 + 0.1, y1 - 0.1, 0.08, 0.34)
    _p1_malha(b, (0.03, 0.03, 0.02, 0.03), _p1_couro(b, lo=1.2, hi=4.6, cupula=0, brilho=False, grad=0.8), seg=2)
    # o encosto (a estrutura de trás, com o rolo em cima)
    b = (x, x + 0.24, y0 + 0.1, y1 - 0.1, 0.3, 0.86)
    _p1_malha(b, (0.08, 0.06, 0.02, 0.11), _p1_couro(b, lo=2.0, hi=6.0, cupula=0.4, brilho=False, grad=0.6), seg=2)
    # as almofadas de encosto (fofas, deitadas para trás)
    inc = -0.3
    for (a0, a1) in ((y0 + br - 0.01, mm - 0.004), (mm + 0.004, y1 - br + 0.01)):
        b = (x + 0.16, x + 0.4, a0, a1, 0.4, 0.9)
        _p1_malha(b, (0.11, 0.11, 0.07, 0.17), _p1_couro(b, lo=2.2, hi=7.4, cupula=0.8, grad=1.6, inclina=inc), seg=2, inclina=inc)
    # as almofadas de assento (a frente passa um pouco do corpo)
    for (a0, a1) in ((y0 + br - 0.005, mm - 0.004), (mm + 0.004, y1 - br + 0.005)):
        b = (x + 0.27, xf - 0.0, a0, a1, 0.32, 0.5)
        _p1_malha(b, (0.06, 0.08, 0.035, 0.075), _p1_couro(b, lo=2.0, hi=7.2, cupula=1.2, grad=1.0), seg=2)
    # os braços: o painel e o rolo em cima, que sai para os lados
    for (a0, a1) in ((y0, y0 + br), (y1 - br, y1)):
        b = (x + 0.03, xf - 0.02, a0 + 0.025, a1 - 0.025, 0.08, 0.5)
        _p1_malha(b, (0.05, 0.04, 0.02, 0.03), _p1_couro(b, lo=1.8, hi=5.6, cupula=0, brilho=False, grad=1.0), seg=2)
        b = (x + 0.01, xf, a0, a1, 0.42, 0.68)
        _p1_malha(b, (0.08, 0.11, 0.1, 0.12), _p1_couro(b, lo=2.2, hi=7.6, cupula=0.8, grad=1.0), seg=2)
    pegadas.append((x, xf, y0, y1))


def relogio_parede(xc, z, r=0.2, apoio=0.8):
    """
    O relógio redondo encostado na parede de trás (y = 0): o aro grosso de madeira (com a borda que pega luz e a
    quina de dentro em sombra), o mostrador creme com as marcas das horas e os ponteiros (10 h 10), desenhados no
    pixel. apoio: a altura onde ele fica em pé (o tampo da escrivaninha), com a base e o pescoço; None = pendurado.
    """
    y0, y1 = 0.02, 0.1                 # a caixa sai da parede
    lados = 32
    R = _MAD
    if apoio is not None and apoio < z - r:
        _p1_malha((xc - 0.17, xc + 0.17, 0.0, 0.13, apoio, apoio + 0.05), (0.02, 0.02, 0.0, 0.02), _p1_madeira(2.4, 6.6, veio=False), seg=1)
        _p1_malha((xc - 0.075, xc + 0.075, 0.03, 0.1, apoio + 0.05, z - r + 0.06), (0.015, 0.015, 0.0, 0.0), _p1_madeira(1.8, 5.4, veio=False), seg=1)
    o = c.novo_obj(3)
    rm = r - 0.065                     # o raio do mostrador
    # a lateral do aro (o cilindro deitado, eixo em y)
    for i in range(lados):
        a0, a1 = 2 * math.pi * i / lados, 2 * math.pi * (i + 1) / lados
        am = (a0 + a1) / 2
        n = (math.cos(am), 0.0, math.sin(am))
        pts = [(xc + r * math.cos(a0), y0, z + r * math.sin(a0)), (xc + r * math.cos(a1), y0, z + r * math.sin(a1)),
               (xc + r * math.cos(a1), y1, z + r * math.sin(a1)), (xc + r * math.cos(a0), y1, z + r * math.sin(a0))]
        c.face_plana(pts, n, _p1_mat_rampa(R, 1.0, 5.6), M, o)

    # a frente do aro: em três faixas (a de fora clareia em cima à esquerda, a de dentro ao contrário)
    def aro(L, n, P):
        dx, dz = P[:, 0] - xc, P[:, 2] - z
        rr = np.hypot(dx, dz)
        lado = (-dx * 0.6 + dz * 0.8) / np.maximum(rr, 1e-6)       # 1 em cima à esquerda, -1 embaixo à direita
        idx = np.full(len(L), 4.0)
        fora = rr > r - 0.025
        dentro = rr < rm + 0.022
        idx = np.where(fora, 3.8 + 1.8 * lado, idx)
        idx = np.where(dentro, 3.0 - 1.6 * lado, idx)
        idx = np.where(~fora & ~dentro, 4.4, idx)
        idx = np.clip(np.round(idx), 0, len(R) - 1).astype(int)
        return _p1_final(R[idx], n, 3)
    c.face_plana([(xc + r * math.cos(2 * math.pi * i / lados), y1, z + r * math.sin(2 * math.pi * i / lados)) for i in range(lados)],
                 (0, 1, 0), emissivo(aro), M, o)

    # o mostrador, desenhado no pixel da tela
    yd = y1 + 0.004
    centro = np.floor(tela(np.array([xc, yd, z]))).astype(int)
    ponto = lambda a, d: np.floor(tela(np.array([xc + d * math.sin(a), yd, z + d * math.cos(a)]))).astype(int)
    marcas, grandes = set(), set()
    for h in range(12):
        a = 2 * math.pi * h / 12
        p = ponto(a, rm - 0.03)
        (grandes if h % 3 == 0 else marcas).add((int(p[0]), int(p[1])))
    for (px, py) in list(grandes):
        if px == centro[0] or abs(px - centro[0]) < 2:
            grandes.add((px, py + (1 if py < centro[1] else -1)))
        else:
            grandes.add((px + (1 if px < centro[0] else -1), py))

    def linha(p0, p1):
        (xa, ya), (xb, yb) = p0, p1
        n = max(abs(xb - xa), abs(yb - ya), 1)
        return {(int(round(xa + (xb - xa) * t / n)), int(round(ya + (yb - ya) * t / n))) for t in range(n + 1)}
    cx, cy = int(centro[0]), int(centro[1])
    hora = linha((cx, cy), tuple(ponto(2 * math.pi * 3 / 12, rm * 0.55)))
    minuto = linha((cx, cy), tuple(ponto(0.0, rm * 0.8)))
    ponteiros = hora | minuto
    CR = _p1_rampa(['#8a7a62', '#b8a888', '#d8ccb0', '#ece4cc', '#f6f0de'])

    def mostrador(L, n, P):
        S = np.floor(tela(P)).astype(int)
        dx, dz = P[:, 0] - xc, P[:, 2] - z
        rr = np.hypot(dx, dz)
        lado = (-dx * 0.6 + dz * 0.8) / np.maximum(rr, 1e-6)
        idx = np.full(len(L), 3)
        # a sombra que o aro faz em cima à esquerda, e o vidro claro embaixo à direita
        idx = np.where((rr > rm - 0.03) & (lado > 0.35), 2, idx)
        idx = np.where((rr > rm - 0.03) & (lado < -0.5), 4, idx)
        out = CR[idx]
        chave = S[:, 0] * 100000 + S[:, 1]
        km = np.array([a * 100000 + b for (a, b) in marcas])
        kg = np.array([a * 100000 + b for (a, b) in grandes])
        kp = np.array([a * 100000 + b for (a, b) in ponteiros])
        out = np.where(np.isin(chave, km)[:, None], hx('#7a6a58'), out)
        out = np.where(np.isin(chave, kg)[:, None], hx('#3a2a22'), out)
        out = np.where(np.isin(chave, kp)[:, None], hx('#2a1e1a'), out)
        out = np.where((chave == cx * 100000 + cy)[:, None], hx('#a8402c'), out)
        return _p1_final(out, n, 3)
    o2 = c.novo_obj(3, contorno=False)
    c.face_plana([(xc + rm * math.cos(2 * math.pi * i / lados), yd, z + rm * math.sin(2 * math.pi * i / lados)) for i in range(lados)],
                 (0, 1, 0), emissivo(mostrador), M, o2)


def piano(x0, x1, fundo=0.62):
    """
    A escrivaninha com o teclado eletrônico, encostada na parede de trás (y = 0): o tampo de tábuas, a gaveta, as
    pernas, a prateleira de baixo com o caixote e os livros; o teclado com as teclas brancas e pretas, os botões, o
    visor e as caixinhas de som.
    """
    h = 0.8
    # o tampo (tábuas ao longo de x) e o avental com a gaveta
    _p1_malha((x0, x1, 0, fundo, h - 0.06, h), (0.02, 0.02, 0.0, 0.02), _p1_madeira(3.0, 7.4, tabua=fundo / 3, eixo=0, seed=3), seg=1)
    av = (x0 + 0.04, x1 - 0.04, 0.02, fundo - 0.03, h - 0.19, h - 0.06)

    def gaveta(L, n, P):
        e = np.zeros(len(L))
        if n[1] > 0.9:
            gx0, gx1 = (x0 + x1) / 2 - 0.22, (x0 + x1) / 2 + 0.22
            fu = np.floor((P[:, 0] - gx0) * 32 + 1e-6)
            fz = np.floor((h - 0.06 - P[:, 2]) * _KZ + 1e-6)
            larg = int((gx1 - gx0) * 32)
            dentro = (fu >= 0) & (fu < larg) & (fz >= 1) & (fz <= 4)
            e += np.where(dentro & (fz == 1), 2.6, np.where(dentro, 1.2, 0))
            e += np.where(dentro & ((fz == 4) | (fu == 0) | (fu == larg - 1)), -3.4, 0)
            meio = (fu >= larg // 2 - 1) & (fu <= larg // 2)
            e += np.where(meio & (fz == 2), 4.4, 0)
            e += np.where(meio & (fz == 3), -1.6, 0)
        return e
    _p1_malha(av, (0.0, 0.0, 0.0, 0.0), _p1_mat_rampa(_MAD, 2.6, 6.0, extra=gaveta), seg=1)
    # as pernas
    for (a, b) in ((x0 + 0.03, 0.03), (x1 - 0.09, 0.03), (x0 + 0.03, fundo - 0.09), (x1 - 0.09, fundo - 0.09)):
        _p1_malha((a, a + 0.06, b, b + 0.06, 0, h - 0.06), (0.012, 0.012, 0.0, 0.0), _p1_madeira(2.4, 6.4, veio=False), seg=1)
    # a prateleira de baixo
    _p1_malha((x0 + 0.04, x1 - 0.04, 0.04, fundo - 0.04, 0.12, 0.16), (0.012, 0.012, 0.0, 0.012), _p1_madeira(2.8, 6.8, tabua=0.18, eixo=0, seed=5), seg=1)
    # o caixote de ripas na prateleira (aberto: as quatro paredes de ripas, o fundo escuro e as quinas mais escuras)
    cx0, cx1, cy0, cy1, cz0, cz1 = x0 + 0.1, x0 + 0.44, 0.14, 0.52, 0.16, 0.36
    CX = _p1_rampa(['#4a2c16', '#5e381c', '#744624', '#8c582e', '#a46a38', '#ba7e44', '#cc9252', '#dca662'])

    def ripas(L, n, P):
        e = np.zeros(len(L))
        if abs(n[2]) < 0.5:
            fr = np.floor((P[:, 2] - cz0) * _KZ + 1e-6) % 3
            e += np.where(fr == 2, -2.4, 0)
            al = P[:, 0] if abs(n[1]) > 0.5 else P[:, 1]
            q0, q1 = (cx0, cx1) if abs(n[1]) > 0.5 else (cy0, cy1)
            e += np.where((al - q0 < 0.035) | (q1 - al < 0.035), -1.0, 0)
        return e
    esp = 0.025
    m = _p1_mat_rampa(CX, 2.6, 7.0, extra=ripas)
    _p1_malha((cx0, cx1, cy0, cy1, cz0, cz0 + 0.02), 0.0, _p1_mat_rampa(CX, 0.0, 0.6), seg=1)
    for bb in ((cx0, cx1, cy0, cy0 + esp, cz0, cz1), (cx0, cx0 + esp, cy0, cy1, cz0, cz1),
               (cx1 - esp, cx1, cy0, cy1, cz0, cz1), (cx0, cx1, cy1 - esp, cy1, cz0, cz1)):
        _p1_malha(bb, 0.0, m, seg=1)
    # dois livros deitados ao lado do caixote
    for k, cor in enumerate((['#3a2a2a', '#4e3232', '#6a4038', '#8a5446', '#a86a58'], ['#26343a', '#30444c', '#3e5862', '#506e78', '#6a8a92'])):
        zb = 0.16 + k * 0.05
        _p1_malha((x1 - 0.42 + k * 0.03, x1 - 0.14 + k * 0.01, 0.12 + k * 0.02, 0.4 - k * 0.02, zb, zb + 0.05), (0.008, 0.008, 0.0, 0.008),
                  _p1_mat_rampa(_p1_rampa(cor), 0.6, 4.0), seg=1)

    # ----- o teclado (para a frente do tampo: o relógio fica em pé atrás dele) -----
    PRETO = _p1_rampa(['#141216', '#1c1a1f', '#25222a', '#2f2b34', '#3a3540', '#48424e', '#5a5462', '#6e6876'])
    kx0, kx1 = x0 + 0.06, x1 - 0.06
    ky0, ky1 = 0.14, fundo - 0.02
    # o corpo
    _p1_malha((kx0, kx1, ky0, ky1, h, h + 0.06), (0.02, 0.02, 0.0, 0.015), _p1_mat_rampa(PRETO, 1.0, 4.0), seg=1)
    # as pontas (as bochechas dos lados das teclas)
    bw = 0.055
    for (a0, a1) in ((kx0, kx0 + bw), (kx1 - bw, kx1)):
        _p1_malha((a0, a1, ky0 + 0.01, ky1, h + 0.04, h + 0.09), (0.015, 0.015, 0.0, 0.015), _p1_mat_rampa(PRETO, 1.5, 5.4), seg=1)
    # o painel de trás com os botões, o visor e as caixinhas de som
    px0, px1, py0, py1 = kx0 + bw, kx1 - bw, ky0 + 0.01, ky0 + 0.125
    zp = h + 0.11

    def painel(L, n, P):
        out = np.zeros((len(L), 3))
        s = _p1_sol(n)
        out[:] = PRETO[int(round(1.5 + 3 * s))]
        if n[2] > 0.8:
            u = (P[:, 0] - px0) * 64          # colunas da tela (1 px = 1/64 m em x numa linha)
            v = (P[:, 1] - py0) * 32          # linhas (1/32 m em y numa coluna)
            larg = (px1 - px0) * 64
            fu, fv = np.floor(u), np.floor(v)
            # as caixinhas de som (a grade de furinhos) nas duas pontas
            for (a0, a1) in ((2, 10), (larg - 10, larg - 2)):
                grade = (fu >= a0) & (fu < a1) & (fv >= 1) & (fv <= 2) & ((fu + fv) % 2 == 0)
                out[grade] = PRETO[0]
            # o visor (verde azulado, com a letrinha clara)
            vis = (fu >= 13) & (fu < 25) & (fv >= 1) & (fv <= 2)
            out[vis] = hx('#2e6e62')
            out[vis & (fv == 1) & (fu >= 14) & (fu < 24) & (fu % 3 != 1)] = hx('#8ee0c4')
            # a fileira de botões (claro, e dois laranja)
            for k in range(6):
                bu = 28 + k * 3
                out[(fu >= bu) & (fu < bu + 2) & (fv == 1)] = hx('#d0cad0') if k not in (1, 4) else hx('#e0703c')
                out[(fu >= bu) & (fu < bu + 2) & (fv == 2)] = PRETO[0]
            # os dois botões redondos (o volume), com o brilho
            for bu in (larg - 19, larg - 14):
                out[(fu >= bu) & (fu < bu + 3) & (fv >= 1) & (fv <= 2)] = hx('#77717a')
                out[(fu == bu) & (fv == 1)] = hx('#e4e0e6')
                out[(fu >= bu) & (fu < bu + 3) & (fv == 3)] = PRETO[0]
        return _p1_final(out, n, 3)
    _p1_malha((px0, px1, py0, py1, h + 0.04, zp), (0.0, 0.015, 0.0, 0.015), emissivo(painel), seg=1)
    # as teclas: as brancas (a junta cinza e 1 px claro depois dela) e as pretas atrás (2 px, com a frente escura)
    tx0, tx1, ty0, ty1 = px0, px1, py1, ky1 - 0.025
    passo = 5 / 64                      # uma tecla branca = 5 px numa linha
    BR = _p1_rampa(['#8a8680', '#b4b0a8', '#d6d2ca', '#ece8e0', '#faf8f2'])
    pretas = (0, 1, 3, 4, 5)           # depois do dó, ré, fá, sol e lá
    ntec = int((tx1 - tx0) / passo)

    def teclas(L, n, P):
        u = (P[:, 0] - tx0) / passo
        k = np.floor(u)
        fr = np.floor((u - k) * 5 + 1e-6)   # o px dentro da tecla (0 a 4)
        out = np.tile(BR[3], (len(L), 1))
        pl = np.isin(((k - 1) % 7).astype(int), pretas) & (k > 0) & (k < ntec)       # preta na junta da esquerda
        pr = np.isin((k % 7).astype(int), pretas) & (k + 1 < ntec)                     # preta na junta da direita
        if n[2] > 0.8:
            yy = (P[:, 1] - ty0) * 32
            fim = round((ty1 - ty0) * 32 * 0.55)
            out[(fr == 0) & (yy >= (ty1 - ty0) * 32 - 2)] = BR[1]
            atras = yy < fim
            frente = (yy >= fim) & (yy < fim + 1)
            out[pl & atras & (fr <= 1)] = PRETO[2]
            out[pr & atras & (fr == 4)] = PRETO[4]
            out[pl & frente & (fr <= 1)] = PRETO[0]
            out[pr & frente & (fr == 4)] = PRETO[0]
        else:
            out[:] = BR[2]
            out[fr == 0] = BR[0]
        return _p1_final(out, n, 3)
    _p1_malha((tx0, tx1, ty0, ty1, h + 0.04, h + 0.072), (0.0, 0.0, 0.0, 0.0), emissivo(teclas), seg=1)
    pegadas.append((x0, x1, 0, fundo))


def quadro_esq(y0, y1, z0, z1):
    """
    O quadro na parede da esquerda (x = 0): a moldura grossa de madeira com o chanfro de dentro e o filete
    dourado, e a paisagem pintada no pixel (o céu do fim de tarde, o sol, as montanhas com neve, o lago e os pinheiros).
    """
    e = 0.075                          # a largura da moldura
    xf = 0.06                          # quanto ela sai da parede
    xt = 0.025                         # a tela, mais funda
    o = c.novo_obj(3)
    R = _MAD
    # a moldura: a faixa da frente, o chanfro para dentro, o topo e o lado (tudo em faces planas, com meia-esquadria)
    yi0, yi1, zi0, zi1 = y0 + e, y1 - e, z0 + e, z1 - e
    ch = 0.025
    ya, yb, za, zb = yi0 + ch, yi1 - ch, zi0 + ch, zi1 - ch    # onde o chanfro começa na frente

    def mat(lo, hi, frisos=False):
        def extra(L, n, P):
            ee = np.zeros(len(L))
            if frisos and abs(n[0]) > 0.9:
                # o friso do meio da faixa (uma linha mais escura acompanhando a moldura)
                d = np.minimum.reduce([P[:, 1] - y0, y1 - P[:, 1], (P[:, 2] - z0), (z1 - P[:, 2])])
                ee += np.where(np.abs(d - 0.024) < 0.013, -1.2, 0)
            return ee
        return _p1_mat_rampa(R, lo, hi, extra=extra)
    F = lambda pts, n, m: c.face_plana(pts, n, m, M, o)
    frente = mat(4.2, 4.2, frisos=True)
    F([(xf, y0, z1), (xf, y1, z1), (xf, yb, zb), (xf, ya, zb)], (1, 0, 0), frente)
    F([(xf, y0, z0), (xf, y1, z0), (xf, yb, za), (xf, ya, za)], (1, 0, 0), frente)
    F([(xf, y0, z0), (xf, y0, z1), (xf, ya, zb), (xf, ya, za)], (1, 0, 0), frente)
    F([(xf, y1, z0), (xf, y1, z1), (xf, yb, zb), (xf, yb, za)], (1, 0, 0), frente)
    # o chanfro de dentro: em cima olha para baixo (escuro), embaixo para cima (claro)
    F([(xf, ya, zb), (xf, yb, zb), (xt, yi1, zi1), (xt, yi0, zi1)], (0.6, 0, -0.8), _p1_mat_rampa(R, 1.6, 1.6))
    F([(xf, ya, za), (xf, yb, za), (xt, yi1, zi0), (xt, yi0, zi0)], (0.6, 0, 0.8), _p1_mat_rampa(R, 7.2, 7.2))
    F([(xf, ya, za), (xf, ya, zb), (xt, yi0, zi1), (xt, yi0, zi0)], (0.6, 0.8, 0), _p1_mat_rampa(R, 6.0, 6.0))
    F([(xf, yb, za), (xf, yb, zb), (xt, yi1, zi1), (xt, yi1, zi0)], (0.6, -0.8, 0), _p1_mat_rampa(R, 2.4, 2.4))
    # o topo e o lado de fora
    F([(0, y0, z1), (0, y1, z1), (xf, y1, z1), (xf, y0, z1)], (0, 0, 1), _p1_mat_rampa(R, 7.4, 7.4))
    F([(0, y1, z0), (0, y1, z1), (xf, y1, z1), (xf, y1, z0)], (0, 1, 0), _p1_mat_rampa(R, 5.4, 5.4))

    # a paisagem, no pixel: as faixas (céu, colinas, lago, capim) seguem a linha da parede (2:1); as formas
    # inclinadas (montanhas, pinheiros, sol) são desenhadas no pixel da tela, para as bordas saírem limpas.
    W = int(math.floor((yi1 - yi0) * _KX))
    H = int(math.floor((zi1 - zi0) * _KZ))
    R0 = math.floor(tela(np.array([xt, yi1, zi1]))[1])
    C = {k: hx(v) for k, v in dict(
        c1='#4a6a94', c2='#6688ac', c3='#8eaac2', c4='#c4c6b8', c5='#e6c896', sol='#fff0b4', solb='#f6d27a',
        nu='#eef0ea', nus='#c4ccd4',
        mf='#7080a0', mfs='#5e6c8a', m1='#5e6e88', m1s='#4a5872', neve='#f2f4f4', neves='#c2cad8',
        g1='#6e9048', g1c='#8cac58', lago='#5a86a4', lagoc='#b4d4e2', lagoe='#3e6684', lsol='#f0d890',
        ch='#4a6a32', chc='#62843e', p1='#284630', p1c='#3a5e3c', tr='#5a3a22').items()}

    def pintura(L, n, P):
        i = np.floor((yi1 - P[:, 1]) * _KX + 1e-4).astype(int)
        v = np.floor((zi1 - P[:, 2]) * _KZ + 1e-4).astype(int)
        rs = np.floor(tela(P)[:, 1] + 1e-4).astype(int) - R0
        out = np.zeros((len(L), 3))

        def pinta(m, cor):
            out[m] = C[cor]
        # o céu em faixas, do azul forte em cima ao amarelado no horizonte
        pinta(np.ones(len(L), bool), 'c1')
        pinta(v >= 5, 'c2')
        pinta(v >= 10, 'c3')
        pinta(v >= 14, 'c4')
        pinta(v >= 16, 'c5')
        # a nuvem comprida
        pinta((v == 6) & (i >= 2) & (i <= 6), 'nu')
        pinta((v == 7) & (i >= 1) & (i <= 8), 'nu')
        pinta((v == 7) & (i >= 6) & (i <= 8), 'nus')
        # o sol baixo, à direita (redondo na tela)
        cs, rsol = 4, 3
        d2 = (i - cs) ** 2 + (rs - rsol) ** 2
        pinta(d2 <= 5, 'solb')
        pinta(d2 <= 2, 'sol')
        # as montanhas: a do fundo (clara e azulada) e a grande na frente, com a neve; em 45° na tela
        pf_i, pf_r = 4, 10
        mf = rs >= pf_r + np.abs(i - pf_i)
        pinta(mf, 'mf')
        pinta(mf & (i > pf_i), 'mfs')
        p_i, p_r = 10, 5
        dm = rs - p_r - np.abs(i - p_i)
        mg = dm >= 0
        pinta(mg, 'm1')
        pinta(mg & (i > p_i), 'm1s')
        neve = mg & (rs - p_r <= 1 + (i // 2) % 2)
        pinta(neve, 'neve')
        pinta(neve & (i > p_i), 'neves')
        # as colinas (o topo ondulado em degraus de 2 px), o lago e o capim
        ond = np.array([0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0])[np.clip(i, 0, 19)]
        col = v >= 17 - ond
        pinta(col, 'g1')
        pinta(col & (v == 17 - ond), 'g1c')
        pinta(v >= 20, 'lago')
        pinta(v == 20, 'lagoe')
        pinta(((v == 21) & (((i >= 1) & (i <= 3)) | ((i >= 7) & (i <= 9)))) | ((v == 22) & (i >= 4) & (i <= 5)), 'lagoc')
        pinta((v == 21) & (i >= cs) & (i <= cs + 1), 'lsol')
        pinta(v >= 23, 'ch')
        pinta(v == 23, 'chc')
        # os pinheiros, em degraus de 2:1 na tela (dois à esquerda e um pequeno à direita)
        for (ti, base, alt) in ((1, 25, 8), (4, 25, 6), (W - 2, 24, 4)):
            rb = base - (ti // 2)              # a linha de tela do pé (aproximada pela inclinação da parede)
            k = rs - (rb - alt)
            meia = np.where(k < alt - 1, (k + 1) // 2, 0)
            dentro = (k >= 0) & (k < alt) & (np.abs(i - ti) <= meia)
            pinta(dentro, 'p1')
            pinta(dentro & (i < ti), 'p1c')
            pinta((k == alt - 1) & (i == ti), 'tr')
        # a sombra da moldura na tela (em cima e à esquerda)
        out[v == 0] *= 0.6
        out[i == 0] *= 0.7
        return _p1_final(out, n, 3)
    o2 = c.novo_obj(3, contorno=False)
    c.face_plana([(xt, yi0, zi0), (xt, yi1, zi0), (xt, yi1, zi1), (xt, yi0, zi1)], (1, 0, 0), emissivo(pintura), M, o2)


def porta(y0, y1, alto=2.05):
    """
    A porta na parede da esquerda (x = 0), grossa (a folha passa do friso da parede): o batente com a verga grossa em cima, a folha com os montantes e as
    travessas, a janelinha de 4 vidros em cima (o vão fundo com a sombra, a cruz do caixilho e os reflexos em
    diagonal), as tábuas embaixo, as dobradiças de ferro do lado esquerdo e o espelho com a maçaneta de latão.
    """
    T = 2                              # o batente e a folha são parede: a luz deles é a da parede
    # o batente (os dois montantes; o da direita mostra a espessura do vão) e a verga com o chanfro
    BAT = _p1_mat_rampa(_MAD, 2.6, 5.6, tipo=T)
    _p1_malha((0, 0.115, y0 - 0.1, y0, 0, alto + 0.02), (0.0, 0.015, 0.0, 0.0), BAT, tipo=T, seg=1)
    _p1_malha((0, 0.115, y1, y1 + 0.1, 0, alto + 0.02), (0.0, 0.015, 0.0, 0.0), BAT, tipo=T, seg=1)
    _p1_malha((0, 0.15, y0 - 0.15, y1 + 0.15, alto + 0.02, alto + 0.17), (0.025, 0.025, 0.0, 0.025), _p1_mat_rampa(_MAD, 3.2, 7.4, tipo=T), tipo=T, seg=1)

    # a folha, pintada no pixel da parede (i = coluna da esquerda para a direita, j = linha de cima para baixo)
    W = int(math.floor((y1 - y0) * _KX)) + 1
    H = int(math.floor(alto * _KZ)) + 1
    R = _p1_rampa(['#2a140a', '#3a1c10', '#4a2516', '#5a2f1c', '#6a3922', '#7a4429', '#8a4f30', '#9a5b37', '#aa6840', '#bc7a4c'])
    idx = np.full((H, W), 6)
    # os montantes e as travessas (a moldura da folha)
    jm0 = int(H * 0.47)                # a travessa do meio (da fechadura)
    jt1, jm1, jb0 = 5, jm0 + 6, H - 7
    # as tábuas de baixo, entre os montantes (a junta escura, 1 px claro depois dela, e a tábua alternando o tom)
    larg = 5
    for i in range(3, W - 3):
        f = (i - 3) % larg
        idx[jm1:jb0, i] = 5 + ((i - 3) // larg) % 2
        if f == 0:
            idx[jm1:jb0, i] = 2
        elif f == 1:
            idx[jm1:jb0, i] = 7
    idx[jm1, 3:W - 3] = 2                     # a sombra da travessa nas tábuas
    idx[jm1:jb0, 3] = np.minimum(idx[jm1:jb0, 3], 3)
    # as quinas de luz das peças da moldura
    idx[0, :] = 8
    idx[:, 0] = 8
    idx[:, W - 1] = 4
    idx[jm0, 3:W - 3] = 8
    idx[jm1 - 1, 3:W - 3] = 5
    idx[jb0, 3:W - 3] = 8
    idx[H - 1, :] = 4
    # a janelinha: o vão (sombra em cima e à esquerda, luz embaixo e à direita) e a cruz do caixilho
    ja0, ja1, ia0, ia1 = jt1 + 1, jm0 - 2, 4, W - 4
    vid = np.zeros((H, W), bool)
    vid[ja0:ja1, ia0:ia1] = True
    im, jmid = (ia0 + ia1) // 2, (ja0 + ja1) // 2
    vid[:, im - 1:im + 1] = False
    vid[jmid - 1:jmid + 1, :] = False
    idx[ja0 - 1, ia0 - 1:ia1 + 1] = 2           # o vão: a borda de cima e a da esquerda na sombra
    idx[ja0 - 1:ja1 + 1, ia0 - 1] = 2
    idx[ja1, ia0 - 1:ia1 + 1] = 8              # a de baixo e a da direita pegam luz
    idx[ja0 - 1:ja1 + 1, ia1] = 7
    idx[ja0:ja1, im - 1:im + 1] = 7            # a cruz
    idx[jmid - 1:jmid + 1, ia0:ia1] = 7
    idx[ja0:ja1, im - 1] = 9
    idx[jmid - 1, ia0:ia1] = 9
    idx[jmid, ia0:ia1] = np.where(vid[jmid, ia0:ia1], idx[jmid, ia0:ia1], 5)
    # o vidro: o tom e a sombra do caixilho em cima e à esquerda de cada vidro
    vtom = np.full((H, W), 3)
    for j in range(H):
        for i in range(W):
            if vid[j, i] and not vid[j - 1, i]:
                vtom[j, i] = 1
            elif vid[j, i] and not vid[j, i - 1]:
                vtom[j, i] = 2
    # as dobradiças de ferro (do lado esquerdo) e o espelho da fechadura (do lado direito)
    FE = _p1_rampa(["#1e1c1c", "#34302e", "#4e4946", "#706a64", "#9a948c"])
    fe = np.full((H, W), -1)
    for jd, comp in ((2, 10), (jb0 + 2, 10)):
        fe[jd:jd + 3, 0:comp] = 2
        fe[jd, 0:comp] = 3
        fe[jd + 2, 0:comp] = 1
        fe[jd + 1, comp] = 2                    # a ponta arredondada
        fe[jd + 1, comp - 2] = 0               # o prego
        fe[max(0, jd - 1):jd + 4, 0] = 3        # o nó (o pino) na quina
        fe[jd + 3, 0] = 1
        fe[jd + 1, 3] = 0
    jq = int(round((alto - 1.0) * _KZ))        # a maçaneta a 1 m do chão
    fe[jq - 4:jq + 6, W - 6:W - 3] = 2
    fe[jq - 4, W - 6:W - 3] = 3
    fe[jq - 4:jq + 6, W - 6] = 3
    fe[jq + 5, W - 5:W - 3] = 1
    fe[jq + 3:jq + 5, W - 5] = 0               # o buraco da chave
    img = R[np.clip(idx, 0, len(R) - 1)]
    img = np.where((fe >= 0)[..., None], FE[np.clip(fe, 0, len(FE) - 1)], img)
    VC = _p1_rampa(['#3e6a84', '#5c8eaa', '#86b8d0', '#a6d2e6', '#d4eef6', '#f4fcff'])

    def folha(L, n, P):
        if abs(n[0]) < 0.9:
            return _p1_final(np.tile(R[int(round(3 + 4 * _p1_sol(n)))], (len(L), 1)), n, T)
        i = np.clip(np.floor((y1 - P[:, 1]) * _KX + 1e-4).astype(int), 0, W - 1)
        j = np.clip(np.floor((alto - P[:, 2]) * _KZ + 1e-4).astype(int), 0, H - 1)
        out = img[j, i].copy()
        v = vid[j, i]
        # os reflexos: riscas em 45° na tela (uma larga e uma fina), só no vidro claro
        S = np.floor(tela(P) + 1e-4).astype(int)
        d = (S[:, 0] + S[:, 1]) % 13
        t = vtom[j, i] + np.where(vtom[j, i] == 3, np.where(d < 2, 2, np.where(d == 4, 1, 0)), 0)
        out[v] = VC[np.clip(t[v], 0, len(VC) - 1)]
        return _p1_final(out, n, T)
    o = c.novo_obj(T)
    c.caixa((0, 0.075, y0, y1, 0, alto), emissivo(folha), M, o)
    # a maçaneta (a bola de latão saindo da folha, na frente do espelho)
    yq = y1 - (W - 4.5) / _KX
    zq = alto - (jq + 0.5) / _KZ
    _p1_malha((0.075, 0.145, yq - 0.035, yq + 0.035, zq - 0.035, zq + 0.035), 0.034,
              _p1_mat_rampa(_p1_rampa(['#4a3216', '#6e4c1e', '#9a7028', '#c49a38', '#e2c058', '#f6e090']), 1.6, 5.0), seg=2)
