"""
Os materiais e as peças pequenas da sala de estilo (sala4.py), copiados como estão para a cozinha. Usam o que a
cozinha põe no módulo (c, M, caixa, pegadas): a cozinha chama `ligar(globals())` antes de montar cada quadro.
"""
import math
import numpy as np
import motor as _mt
from motor import tela, ruido, emissivo, KX, KY, KZ, ESC, VISTA

# O giro do móvel desenhado sozinho (exportar_px.py): quem exporta põe aqui a Peca girada antes de desenhar. Os
# materiais recebem o ponto e a normal da cena (local); com a Peca, a luz que os materiais redondos já trazem (vol,
# _p1_mat_rampa) e as fitas e folhas viradas para a câmera (_fita, a espada-de-são-jorge) seguem o mundo girado.
# None (a cena): local = mundo.
GIRO = {'peca': None}


def _peca():
    """A Peca do giro: a de GIRO ou, se ninguém pôs, a que o exportar_px está usando (o PECA['p'] dele)."""
    if GIRO['peca'] is not None:
        return GIRO['peca']
    import sys
    for nome in ('exportar_px', '__main__'):
        pp = getattr(sys.modules.get(nome), 'PECA', None)
        if isinstance(pp, dict) and pp.get('p') is not None and pp['p'] is not _mt.MUNDO:
            return pp['p']
    return None


def n_mundo(N):
    """A normal (uma (3,) ou várias (k, 3)) do quadro do móvel para o mundo girado."""
    p = _peca()
    N = np.asarray(N, float)
    if p is None:
        return N
    if N.ndim == 1:
        return np.array(p.normal(tuple(N)), float)
    return p.normal_vec(N)


def vista_local():
    """O sentido da câmera no quadro do móvel (com o giro, a câmera vista de dentro do móvel girado)."""
    p = _peca()
    if p is None:
        return VISTA.copy()
    q = p.local(np.array([[0.0, 0.0, 0.0], list(VISTA)]))
    return q[1] - q[0]


def frente_tela():
    """(h, r): h = o sentido horizontal para a câmera e r = o que anda para a direita na tela (no quadro do móvel)."""
    v = vista_local()
    h = np.array([v[0], v[1]]) / math.hypot(v[0], v[1])
    return h, np.array([h[1], -h[0]])

ALTO = 2.85
PXM = 0.024 / ESC          # 1 px da arte em metros (o veio da madeira), relativo ao ESC (0,032 m em 0,75; 0,024 m em 1)
c = None
M = _mt.MUNDO
pegadas = []


def caixa(*a, **k):
    return _CAIXA['f'](*a, **k)


_CAIXA = {'f': None}


def ligar(g):
    """Liga este módulo à cena do quadro (c, pegadas e a caixa da cozinha)."""
    global c, pegadas
    c = g['c']
    pegadas = g['pegadas']
    _CAIXA['f'] = g['caixa']




def hx(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def coords(L, n):
    if abs(n[2]) > 0.5:
        return L[:, 0], L[:, 1]
    if abs(n[1]) >= abs(n[0]):
        return L[:, 0], L[:, 2]
    return L[:, 1], L[:, 2]


def liso(c):
    c = hx(c)
    return emissivo(lambda L, n, P: np.tile(c, (len(L), 1)))


def madeira(c, eixo=0, seed=0, veio=True):
    """A madeira do móvel: a cor e o veio claro (riscas finas e quebradas ao longo da peça)."""
    c = hx(c)

    def f(L, n, P):
        a, b = coords(L, n)
        t, s = (a, b) if eixo == 0 else (b, a)
        out = np.tile(c, (len(L), 1))
        if veio:
            g = s / 0.09
            fila = np.floor(g)
            w = (g % 1) - (0.35 + 0.3 * ruido(fila, seed)) - 0.08 * np.sin(t * 5 + fila * 2.1)
            risca = (np.abs(w) < 0.5 * PXM / 0.09) & (np.sin(t * 3.1 + fila * 1.7 + seed) > -0.1)
            out = np.where(risca[:, None], out * 1.1 + 4, out)
        return out
    return emissivo(f)



def tabuas(cores, larg, comp, junta, eixo=0, seed=0, ponta=True, veio=True):
    """Tábuas com o chanfro desenhado: a junta escura, 1 px claro logo depois dela e 1 px mais escuro antes; o veio."""
    cs = [hx(x) for x in cores]
    jc = hx(junta)

    def f(L, n, P):
        a, b = coords(L, n)
        t, s = (a, b) if eixo == 0 else (b, a)
        fila = np.floor(s / larg)
        off = ruido(fila, seed + 1) * comp
        col = np.floor((t + off) / comp) if ponta else np.zeros_like(t)
        k = (ruido(fila, col, seed + 2) * len(cs)).astype(int) % len(cs)
        out = np.stack(cs)[k]
        g = (s / larg) % 1
        e = PXM / larg
        if veio:
            for j, base in enumerate((0.3, 0.62)):
                w = g - (base + 0.12 * ruido(fila, col, seed + 5 + j)) - 0.05 * np.sin(t * 4.3 + fila * 2.3 + j)
                risca = (np.abs(w) < 0.5 * e) & (np.sin(t * 2.7 + fila * 1.3 + j * 2) > -0.25)
                out = np.where(risca[:, None], out * 1.08 + 3, out)
        out = np.where(((g > e) & (g < 2.2 * e))[:, None], out * 1.16 + 6, out)
        out = np.where((g > 1 - e)[:, None], out * 0.86, out)
        jun = g < e
        if ponta:
            h = ((t + off) / comp) % 1
            ep = PXM / comp
            jun |= h < ep
            out = np.where(((h > ep) & (h < 2 * ep))[:, None], out * 1.1 + 4, out)
        return np.where(jun[:, None], jc, out)
    return emissivo(f)



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
    f = _p1_fator(n_mundo(n), tipo)
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
        s = _p1_sol(n_mundo(n))
        idx = np.full(len(L), lo + s * (hi - lo))
        if extra is not None:
            idx = idx + extra(L, np.asarray(n, float) / np.linalg.norm(n), P)
        idx = np.clip(np.round(idx), 0, len(R) - 1).astype(int)
        return _p1_final(R[idx], n, tipo)
    return emissivo(f)



PZ = 1 / KZ              # 1 px da arte na vertical (m): 0,75 / 39,195 / ESC
PH = 1 / KX              # 1 px da arte ao longo de x ou de y (m): 0,75 / 32 / ESC
_QUENTE = np.array([16.0, 4.0, -10.0])
_LUZ2 = np.array([-0.3, 0.55, 1.0]) / np.linalg.norm([-0.3, 0.55, 1.0])


def _fac(n):
    """A luz que o acabamento põe na face (o topo 1, a face +y 0,84, a +x 0,66)."""
    n = np.asarray(n, float)
    n = n / np.linalg.norm(n)
    if n[2] > 0.6:
        return 1.0
    return 0.84 if n[1] >= n[0] else 0.66


def _cru(cor, n):
    """A cor que, depois da luz da face do acabamento, fica igual a `cor` (para o material que já traz a luz)."""
    f = _fac(n_mundo(n))
    return (cor - (1 - f) * _QUENTE) / f


def _tom(cor, k):
    """Clareia (k > 1) ou escurece (k < 1): a sombra puxa para o vermelho-roxo, a luz para o amarelo claro."""
    cor = np.asarray(cor, float)
    k = np.asarray(k, float)
    if k.ndim == 1 and cor.ndim == 2:
        k = k[:, None]
    esc = cor * k + (1 - k) * np.array([11.0, -1.0, 7.0])
    cla = cor + (k - 1) * (np.array([255.0, 238.0, 190.0]) - cor) * 0.9
    return np.where(k < 1, esc, cla)


def _luz_k(d):
    """A luz pela normal (d = normal · luz), em degraus como pixel art."""
    k = np.interp(d, [-1, -0.5, -0.25, 0.46, 0.52, 0.85, 1.0], [0.5, 0.56, 0.66, 0.84, 0.9, 1.0, 1.04])
    return np.round(k / 0.075) * 0.075


def _riscas(t, s, passo, esp, seed, comp=0.22, frac=0.55):
    """Riscas de 1 px (esp) ao longo de t, uma por faixa de `passo`, em pedaços compridos."""
    fila = np.floor(s / passo)
    o = (0.25 + 0.5 * ruido(fila, seed)) * passo
    g = s - fila * passo
    linha = (g >= o) & (g < o + esp)
    seg = np.floor(t / comp + ruido(fila, seed + 1))
    return linha & (ruido(fila, seg, seed + 2) < frac)


def mad2(cor, eixo=0, seed=0, passo=0.1, claro=1.1, escuro=0.9):
    """Madeira de pixel limpo: a cor e o veio em riscas de 1 px, claras e escuras, compridas."""
    c0 = hx(cor)

    def f(L, n, P):
        a, b = coords(L, n)
        t, s = (a, b) if eixo == 0 else (b, a)
        esp = PZ if (abs(n[2]) <= 0.5 and eixo == 0) else PH
        out = np.tile(c0, (len(L), 1))
        r1 = _riscas(t, s, passo, esp, seed)
        r2 = _riscas(t + 0.13, s + passo * 0.5, passo, esp, seed + 9, frac=0.4)
        out = np.where(r1[:, None], _tom(c0, claro), out)
        out = np.where((r2 & ~r1)[:, None], _tom(c0, escuro), out)
        return out
    return emissivo(f)


def tab2(cores, larg, junta='#4a2414', eixo=0, seed=0, comp=None, org=0.0, veio=True, luz_borda=1.1, sombra_borda=0.92):
    """
    Tábuas de pixel limpo: a junta escura de 1 px, a linha clara logo acima dela (a quina que pega luz) e a escura
    logo abaixo; as emendas das pontas (comp) desencontradas; o veio. org: onde começa a primeira tábua.
    """
    cs = np.stack([hx(x) for x in cores])
    jc = hx(junta)

    def f(L, n, P):
        a, b = coords(L, n)
        t, s = (a, b) if eixo == 0 else (b, a)
        vert = abs(n[2]) <= 0.5
        e = PZ if (vert and eixo == 0) else PH          # 1 px de través da tábua
        et = PZ if (vert and eixo == 1) else PH         # 1 px ao longo dela
        s = s - org
        fila = np.floor(s / larg)
        g = s - fila * larg
        if comp:
            off = ruido(fila, seed + 1) * comp
            col = np.floor((t + off) / comp)
            hp = (t + off) - col * comp
        else:
            col = np.zeros_like(t)
            hp = None
        k = (ruido(fila, col, seed + 2) * len(cs)).astype(int) % len(cs)
        out = cs[k]
        if veio:
            # o veio: uma risca mais escura em pedaços bem compridos e uma clara mais curta, desencontradas
            kv = veio if isinstance(veio, float) else 0.9
            o = np.floor((0.42 + 0.2 * ruido(fila, seed + 4)) * larg / e) * e
            lin = (g >= o) & (g < o + e)
            seg = np.floor(t / 0.34 + ruido(fila, col, seed + 5))
            vv = lin & (ruido(fila, seg, seed + 7) < 0.62)
            out = np.where(vv[:, None], _tom(out, kv), out)
            if larg >= 5 * e:
                o2 = np.floor((0.2 + 0.12 * ruido(fila, seed + 8)) * larg / e) * e
                lin2 = (g >= o2) & (g < o2 + e) & ~lin
                seg2 = np.floor(t / 0.2 + ruido(fila, col, seed + 9))
                out = np.where((lin2 & (ruido(fila, seg2, seed + 10) < 0.45))[:, None], _tom(out, 1.06), out)
                # o nó: um caroço escuro de 2 px com o anel um tom abaixo, em algumas tábuas
                tq = np.floor(t / 0.6)
                tem = ruido(fila, tq, seed + 11) < 0.28
                tk = (tq + 0.2 + 0.6 * ruido(fila, tq, seed + 12)) * 0.6
                sk = np.floor((0.55 + 0.2 * ruido(fila, tq, seed + 13)) * larg / e) * e + 0.5 * e
                dt, ds = np.abs(t - tk) / et, np.abs(g - sk) / e
                anel = tem & (dt < 2.6) & (ds < 1.5) & ~((dt > 1.6) & (ds > 0.5))
                caro = tem & (dt < 1.0) & (ds < 0.5)
                out = np.where(anel[:, None], _tom(out, 0.88), out)
                out = np.where(caro[:, None], _tom(out, 0.7), out)
        out = np.where((g >= larg - e)[:, None], _tom(out, luz_borda), out)
        out = np.where(((g >= e) & (g < 2 * e))[:, None], _tom(out, sombra_borda), out)
        jun = g < e
        if hp is not None:
            jun |= hp < et
            out = np.where(((hp >= et) & (hp < 2 * et))[:, None], _tom(out, 1.08), out)
        return np.where(jun[:, None], jc, out)
    return emissivo(f)


def vol(cx, cy, cor, brilho=0.0, faixas=None, costuras=None):
    """
    O material das peças redondas (cilindro, cone): a luz pela normal de cada pixel (o ângulo em volta do eixo e a
    inclinação da face), em degraus. brilho: a risca de luz no lado aceso (o esmalte, o ferro). faixas: função
    (P, cor) -> cor para pintar faixas em volta. costuras: (n, cor) as linhas verticais das aduelas.
    """
    c0 = hx(cor) if isinstance(cor, str) else np.asarray(cor, float)

    def f(L, n, P):
        nn = np.asarray(n, float) / np.linalg.norm(n)
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        ch = math.sqrt(max(0.0, 1 - nn[2] ** 2))
        N = np.stack([ch * np.cos(th), ch * np.sin(th), np.full(len(P), nn[2])], 1)
        d = n_mundo(N) @ _LUZ2
        k = _luz_k(d)
        base = np.tile(c0, (len(P), 1))
        if faixas is not None:
            base = faixas(P, base)
        if costuras is not None:
            nc, cc, r = costuras
            # na tela (pela câmera do giro): x = a distância para a direita, em px (na cena, (X - Y) x KX)
            hv, rv = frente_tela()
            ka = math.sqrt(2) * KX
            sx = (cx - cy) * KX + ((P[:, 0] - cx) * rv[0] + (P[:, 1] - cy) * rv[1]) * ka
            rr = np.hypot(P[:, 0] - cx, P[:, 1] - cy)
            ok = np.zeros(len(P), bool)
            angs = [2 * math.pi * (i + 0.5) / nc for i in range(nc)]
            acam = math.atan2(hv[1], hv[0])
            vis = [a for a in angs if math.cos(a - acam) > -0.05]
            xs = sorted([((math.cos(a) * rv[0] + math.sin(a) * rv[1]) * math.sqrt(2), a) for a in vis])
            for j, (v, a) in enumerate(xs):
                # a costura que fica perto demais da vizinha na tela (perto da borda) some
                viz = [abs(v - w) for (w, _) in xs if w != v]
                if viz and min(viz) * r * KX < 2.6:
                    continue
                sk = KX * ((cx - cy) + rr * v)
                ok |= (sx >= sk - 0.5) & (sx < sk + 0.5) & (np.cos(th - a) > 0.2)
            base = np.where(ok[:, None], hx(cc), base)
        out = _vao(_tom(base, k), P)
        if brilho:
            Nw = n_mundo(N)
            sp = (np.cos(np.arctan2(Nw[:, 1], Nw[:, 0]) - math.radians(112)) > 0.965) & (nn[2] < 0.6)
            out = np.where(sp[:, None], _tom(base, 1.0 + brilho), out)
        return _cru(out, n)
    return emissivo(f)


def _poligono_rodado(cx, cy, perfil, mat, oid, lados=22, tampa_mat=None):
    """Uma peça redonda pelo perfil [(z, r), ...] de baixo para cima (o pote, o barril, o vaso): troncos de cone."""
    for (za, ra), (zb, rb) in zip(perfil[:-1], perfil[1:]):
        c.cilindro(cx, cy, ra, za, zb, mat, M, oid, lados=lados, tampa=False, r1=rb)
    if tampa_mat is not None:
        z, r = perfil[-1]
        pts = [(cx + r * math.cos(2 * math.pi * i / lados), cy + r * math.sin(2 * math.pi * i / lados), z) for i in range(lados)]
        c.face_plana(pts, (0, 0, 1), tampa_mat, M, oid)


def _disco(cx, cy, z, r, mat, oid, lados=22):
    pts = [(cx + r * math.cos(2 * math.pi * i / lados), cy + r * math.sin(2 * math.pi * i / lados), z) for i in range(lados)]
    c.face_plana(pts, (0, 0, 1), mat, M, oid)


def _fita(pts2, cx, cy, mat, oid, w):
    """
    Uma fita fina de frente para a câmera (o galho, a alça): pts2 = [(s, z), ...] no plano vertical que passa por
    (cx, cy) de frente para a câmera; s anda para a direita na tela. Cada trecho é um quadrilátero.
    """
    h, r = frente_tela()
    for (s0, z0), (s1, z1) in zip(pts2[:-1], pts2[1:]):
        ds, dz = s1 - s0, z1 - z0
        l = math.hypot(ds, dz) or 1e-6
        ps, pz = -dz / l * w / 2, ds / l * w / 2
        q = [(s0 + ps, z0 + pz), (s1 + ps, z1 + pz), (s1 - ps, z1 - pz), (s0 - ps, z0 - pz)]
        c.face_plana([(cx + s * r[0], cy + s * r[1], z) for (s, z) in q], (h[0], h[1], 0), mat, M, oid, dois_lados=True)


# ---------------------------------------------------------------- a cadeira ----------------------------------------------------------------
CAD_LADO, CAD_TOPO, CAD_ESC = '#743c22', '#c07c44', '#542a16'
_VAO = {'teto': None}


def _vao(out, P):
    """Dentro do vão da estante: o alto (logo embaixo da prateleira de cima) fica na sombra."""
    t = _VAO['teto']
    if t is None:
        return out
    return np.where((P[:, 2] > t - 0.07)[:, None], _tom(out, 0.8), out)


def _pau(cor, topo=None, quina=1.32, b=None):
    """A peça fina de madeira em cor chapada: a fileira de cima das faces em pé mais clara (a quina que pega luz)."""
    c0 = hx(cor)
    ct = hx(topo) if topo else _tom(c0, 1.3)

    def f(L, n, P):
        if n[2] > 0.5:
            return np.tile(ct, (len(P), 1))
        out = np.tile(c0, (len(P), 1))
        if b is not None and quina:
            out = np.where((P[:, 2] > b[5] - PZ)[:, None], _tom(c0, quina), out)
        return out
    return emissivo(f)



def _barra(b, cor, topo=None, oid=None, quina=1.32):
    o = c.novo_obj(3) if oid is None else oid
    c.caixa(b, _pau(cor, topo, quina, b), M, o)
    return o



# ---------------------------------------------------------------- a mesa ----------------------------------------------------------------
MESA_TAB = ['#8e4a2c', '#86442a', '#965230', '#7e4026']


def _ponta_tabuas(cor, larg, org, junta='#4a2414'):
    """A ponta do tampo (a face em pé onde as tábuas terminam): as juntas descem retas, 1 px."""
    c0, jc = hx(cor), hx(junta)

    def f(L, n, P):
        a, b = coords(L, n)
        g = ((a - org) / larg) % 1 * larg
        out = np.tile(c0, (len(L), 1))
        out = np.where(((g >= larg - PH))[:, None], _tom(c0, 1.08), out)
        return np.where((g < PH)[:, None], jc, out)
    return emissivo(f)




def caneca(mx, my, z, mr=0.064, mh=0.13):
    """A caneca de esmalte creme: a borda azul, o friso, a risca de brilho, o café dentro e a asa do lado."""
    def esmalte(P, base):
        zz = P[:, 2] - z
        base = np.where((zz > mh - PZ)[:, None], hx('#34507a'), base)
        return np.where(((zz > 0.035) & (zz <= 0.035 + PZ))[:, None], hx('#5a78a4'), base)
    o = c.novo_obj(3)
    c.cilindro(mx, my, mr, z, z + mh, vol(mx, my, '#ece2cc', brilho=0.3, faixas=esmalte), M, o, lados=20, tampa=False)

    def cafe(L, n, P):
        r = np.hypot(P[:, 0] - mx, P[:, 1] - my)
        out = np.where((r > mr - 0.016)[:, None], hx('#f4ecda'), hx('#3a2016'))
        return np.where(((r > mr - 0.036) & (r <= mr - 0.016) & (P[:, 1] - my < 0))[:, None], hx('#6a4430'), out)
    _disco(mx, my, z + mh, mr, emissivo(cafe), o, lados=20)
    o = c.novo_obj(3)
    _fita([(0.05, z + 0.105), (0.1, z + 0.1), (0.112, z + 0.065), (0.1, z + 0.03), (0.05, z + 0.026)], mx, my, liso('#d8ccb4'), o, 0.03)




def _garrafa(cx, cy, z):
    """A garrafa de vidro verde-escuro: o corpo, o ombro, o gargalo e a rolha; a risca de brilho do vidro."""
    o = c.novo_obj(3)
    m = vol(cx, cy, '#3e5e44', brilho=0.45)
    _poligono_rodado(cx, cy, [(z, 0.04), (z + 0.14, 0.04), (z + 0.17, 0.028), (z + 0.19, 0.016), (z + 0.24, 0.016)], m, o, lados=16)
    c.cilindro(cx, cy, 0.014, z + 0.24, z + 0.27, vol(cx, cy, '#b8865a'), M, o, lados=12, tampa_mat=liso('#c89a6a'))



# ---------------------------------------------------------------- o barril, os potes e as plantas ----------------------------------------------------------------
def barril_cesto(x, y, r=0.3, h=0.45):
    """
    O barril baixo: as aduelas (uma linha escura de 1 px entre elas, a luz em degraus pela volta), a barriga, as
    cintas de ferro com a quina de cima clara e o brilho, e a tampa de tábuas dentro do anel das aduelas.
    """
    perfil = [(0.0, r * 0.9), (h * 0.22, r * 0.975), (h * 0.5, r), (h * 0.78, r * 0.975), (h, r * 0.9)]
    cintas = ((0.055, 0.115), (h - 0.125, h - 0.065))

    def rr_em(z):
        zs, rs = zip(*perfil)
        return np.interp(z, zs, rs)

    def aduela(P, base):
        th = np.arctan2(P[:, 1] - y, P[:, 0] - x)
        k = np.floor(((th / (2 * math.pi)) * 16 + 16) % 16)
        base = np.where((k % 2 == 0)[:, None], _tom(base, 1.04), base)
        # a sombra de 1 px embaixo de cada cinta
        zz = P[:, 2]
        for (a, b) in cintas:
            base = np.where(((zz < a) & (zz >= a - PZ))[:, None], _tom(base, 0.7), base)
        return base
    o = c.novo_obj(3)
    _poligono_rodado(x, y, perfil, vol(x, y, '#92562e', faixas=aduela, costuras=(16, '#4a2614', r)), o, lados=28)

    def tampa(L, n, P):
        dx, dy = P[:, 0] - x, P[:, 1] - y
        rr = np.hypot(dx, dy)
        ri = r * 0.9 - 0.045
        larg = 4 * PH
        fila = np.floor((dy + 0.4) / larg)
        g = (dy + 0.4) - fila * larg
        cores = np.stack([hx('#d29c5e'), hx('#c48e52'), hx('#d8a868')])
        out = cores[(fila % 3).astype(int)]
        out = np.where((g >= larg - PH)[:, None], _tom(out, 0.9), out)
        out = np.where((g < PH)[:, None], hx('#6a3c1e'), out)
        # o anel das aduelas (a ponta da madeira, mais escura) e a sombra dentro dele
        anel = rr > ri
        out = np.where(anel[:, None], hx('#a0643a'), out)
        out = np.where(((rr > ri - 0.022) & (rr <= ri) & (dy < 0.02))[:, None], _tom(out, 0.8), out)
        return out
    _disco(x, y, h, r * 0.9, emissivo(tampa), o, lados=28)
    for (a, b) in cintas:
        o2 = c.novo_obj(3)

        def ferro(P, base, a=a, b=b):
            zz = P[:, 2]
            base = np.where((zz > b - PZ)[:, None], hx('#8a8e98'), base)
            # os rebites
            th = np.arctan2(P[:, 1] - y, P[:, 0] - x)
            reb = ((((th / (2 * math.pi)) * 8 + 8.25) % 1) < 0.04) & (zz > a + PZ) & (zz <= a + 2 * PZ)
            return np.where(reb[:, None], hx('#a8acb4'), base)
        ra, rb = rr_em(a) + 0.012, rr_em(b) + 0.012
        c.cilindro(x, y, ra, a, b, vol(x, y, '#44464f', brilho=0.5, faixas=ferro), M, o2, lados=28, tampa=False, r1=rb)
    pegadas.append((x - r, x + r, y - r, y + r))


def pote_barro(x, y, z, r=0.09, h=0.16):
    """O pote de barro em jarro: a barriga redonda, a faixa escura com a linha clara, o ombro, o gargalo e a boca."""
    perfil = [(z, r * 0.62), (z + h * 0.12, r * 0.86), (z + h * 0.38, r), (z + h * 0.62, r * 0.93), (z + h * 0.78, r * 0.68),
              (z + h * 0.86, r * 0.5), (z + h * 0.93, r * 0.5), (z + h * 0.93, r * 0.6), (z + h, r * 0.6)]

    def faixa(P, base):
        zz = P[:, 2] - z
        zb = h * 0.5
        base = np.where(((zz > zb) & (zz <= zb + PZ))[:, None], _tom(base, 0.7), base)
        return np.where(((zz > zb + PZ) & (zz <= zb + 2 * PZ))[:, None], _tom(base, 1.18), base)
    o = c.novo_obj(3)
    _poligono_rodado(x, y, perfil, vol(x, y, '#a8603a', brilho=0.12, faixas=faixa), o, lados=20)

    def boca(L, n, P):
        rr = np.hypot(P[:, 0] - x, P[:, 1] - y)
        return _vao(np.where((rr > r * 0.6 - 0.016)[:, None], hx('#c47a4a'), hx('#3a2014')), P)
    _disco(x, y, z + h, r * 0.6, emissivo(boca), o, lados=20)



# ----- a madeira -----
_MAD = _p1_rampa(['#3a1e10', '#4a2716', '#5c321b', '#6e3e22', '#80492a', '#925531', '#a46239', '#b47040', '#c4824c', '#d29658'])

