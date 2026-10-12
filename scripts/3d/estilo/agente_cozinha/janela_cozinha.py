"""
Cópia do janela_px (agente_janela) para a COZINHA: a janela vai na parede de TRÁS (y = 0), em cima da pia.
Toda a conta é feita no quadro da parede (x = a distância da parede para dentro, y = ao longo dela, z), como na
janela original da parede da esquerda; a peça _Troca leva esse quadro para o mundo (troca x e y).

A janela aberta na parede da esquerda (x = 0), com a cortina de linho que balança no vento e o sol que entra por ela.

Uso, por quadro (t de 0 a 1 = o instante do loop):
    janela(c, t)                 # depois de montar a sala (fura a parede, põe o batente, o céu, o varão e a cortina)
    cor = luz_janela(cor, c, t)  # no acabamento, depois da luz das faces e das sombras, ANTES do brilho e do contorno
    cor = poeira_janela(cor, c, t)  # no fim, DEPOIS do contorno (os grãos de poeira de 1 px no feixe)

A parede tem de ser a caixa (-ESP, 0, ...) com a face visível em x = 0 (tipo 2). A janela é toda tipo 2 (não faz
sombra no mapa do sol); a sombra do batente, das travessas e da cortina no chão é feita pela conta da própria janela.
"""
import math
import numpy as np
from motor import MUNDO, emissivo, ruido, tela, VISTA



class _Troca:
    """Local (distância da parede, ao longo dela, z) -> mundo (x, y, z) = (ao longo, distância, z)."""

    def mundo(self, L):
        return np.stack([L[..., 1], L[..., 0], L[..., 2]], axis=-1)

    def local(self, P):
        return np.stack([P[..., 1], P[..., 0], P[..., 2]], axis=-1)

    def normal(self, n):
        return (n[1], n[0], n[2])

    def normal_vec(self, N):
        return N[:, [1, 0, 2]]


M = _Troca()


def _w(Q):
    """Do quadro da parede para o mundo (ou de volta: é a mesma troca)."""
    return np.asarray(Q)[..., [1, 0, 2]]

# ---------- as medidas (metros) ----------
YA, YB = 3.28, 4.22        # o vão, ao longo da parede (x no mundo), em cima da pia (3,0 a 4,5)
ZA, ZB = 1.24, 2.22        # o peitoril e a verga
ESP = 0.16                 # a grossura da parede
ZT = 1.94                  # a travessa de baixo da bandeira (o vidro fixo em cima)
TT = 0.05                  # a grossura da travessa
YM = (YA + YB) / 2         # o pinázio do meio da bandeira
XV = -0.07                 # o plano do caixilho (travessas e vidro), dentro da grossura da parede
XR = 0.19                 # o varão
ZR = 2.38                  # a altura do varão
ZC0, ZC1 = 1.12, 2.37      # a cortina: a barra de baixo e o alto (presa no varão)
LARG = 0.36                # a largura de cada folha da cortina (franzida)
PREGAS = 3                 # as pregas de cada folha
SOL = np.array([2.4, 0.35, -1.0])     # o sentido em que a luz anda (de fora para dentro e para baixo), no quadro da parede
SOL = SOL / np.linalg.norm(SOL)
SOL_W = _w(SOL)                         # o mesmo sentido no mundo
COR_SOL = np.array([255.0, 228.0, 168.0])


def _hx(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def _liso(cor):
    c = _hx(cor)
    return emissivo(lambda L, n, P: np.tile(c, (len(L), 1)))


def _madeira(cor, eixo=1, seed=0):
    """A madeira do batente: a cor e um veio fino e quebrado (como a madeira() da cena)."""
    c = _hx(cor)

    def f(L, n, P):
        if abs(n[2]) > 0.5:
            a, b = L[:, 0], L[:, 1]
        elif abs(n[1]) >= abs(n[0]):
            a, b = L[:, 0], L[:, 2]
        else:
            a, b = L[:, 1], L[:, 2]
        t, s = (a, b) if eixo == 0 else (b, a)
        g = s / 0.09
        fila = np.floor(g)
        w = (g % 1) - (0.35 + 0.3 * ruido(fila, seed)) - 0.08 * np.sin(t * 5 + fila * 2.1)
        risca = (np.abs(w) < 0.5 * 0.032 / 0.09) & (np.sin(t * 3.1 + fila * 1.7 + seed) > -0.1)
        return np.where(risca[:, None], c * 1.1 + 4, np.tile(c, (len(L), 1)))
    return emissivo(f)


def _caixa(c, b, mat):
    o = c.novo_obj(2)
    c.caixa(b, mat, M, o)
    return o


# ---------- a cortina ----------
def _onda(t, fase):
    """O vento: um sopro que vem e vai (0 a 1), com um tremido menor no meio. Fecha o loop em t = 1."""
    a = 2 * math.pi * (t + fase)
    return 0.5 - 0.5 * math.cos(a) + 0.12 * math.sin(2 * a)


def _folha(lado, t):
    """
    A grade da folha da cortina no instante t: X, Y, Z (ns + 1, nz + 1) e o papel de cada faixa (a prega).
    lado = +1: a folha da frente (perto de YB, à esquerda na tela); -1: a de trás (perto de YA).
    """
    ns, nz = PREGAS * 8, 18
    s = np.linspace(0, 1, ns + 1)[:, None]          # 0 = a ponta de fora (na parede), 1 = a beira solta
    zz = np.linspace(0, 1, nz + 1)[None, :]          # 0 = o alto, 1 = a barra
    fase = 0.0 if lado > 0 else 0.18
    v = _onda(t, fase)
    w = zz ** 1.7                                    # o vento mexe mais embaixo
    solta = 0.35 + 0.65 * s                          # e mais na beira solta que na ponta presa
    # onde fica a folha: de fora (passa um pouco do vão) para dentro do vão
    if lado > 0:
        y_fora, y_dentro = YB + 0.24, YB + 0.24 - LARG
    else:
        y_fora, y_dentro = YA - 0.24, YA - 0.24 + LARG
    para_dentro = -lado                              # o sentido do meio do vão
    # as pregas: a fazenda vai e volta da parede (fundo da prega na parede, a crista para a sala)
    gira = 0.45 * w * solta * math.sin(2 * math.pi * (t + fase) + 0.8) + 0 * s
    pr = 0.5 - 0.5 * np.cos(2 * math.pi * PREGAS * s + gira)
    fundo = 0.075 * (1 - 0.25 * zz)                  # embaixo a prega abre um pouco
    X = XR - 0.04 + fundo * pr
    # a barra se afasta da parede com o sopro, e a beira solta abre um pouco para o meio do vão
    X = X + 0.065 * w * solta * v
    Y = y_fora + (y_dentro - y_fora) * s
    Y = Y + para_dentro * (0.02 * zz + 0.035 * w * s * v)
    Y = Y + 0.012 * w * s * math.sin(2 * math.pi * (t + fase) * 2 + 1.3)
    # a barra sobe um tiquinho quando o pano é empurrado (o comprimento se mantém)
    Z = ZC1 - (ZC1 - ZC0) * zz
    Z = Z + 0.035 * w * solta * v
    Z = Z + 0.008 * np.sin(2 * math.pi * 2 * s) * zz      # a barra ondulada pelas pregas
    # a fase da prega no meio de cada pedaço (0 = o fundo, junto da parede; 0,5 = a crista, mais para a sala)
    sm = (s[1:] + s[:-1]) / 2
    gm = (gira[:-1, :-1] + gira[1:, :-1] + gira[:-1, 1:] + gira[1:, 1:]) / 4
    fase_prega = (PREGAS * sm + gm / (2 * math.pi)) % 1.0
    return X, Y, Z + 0 * X, np.broadcast_to(fase_prega, (ns, nz))


# o linho: claro, meio, sombra e o fundo da prega
LINHO = [_hx('#fff6e4'), _hx('#f0dfbf'), _hx('#d6bd92'), _hx('#a98d66')]


def _tom_prega(f, lado):
    """O tom pela fase da prega. Na folha da frente a face larga (na tela) é a que sobe do fundo para a crista;
    na de trás, a que desce. A outra face fica quase de lado: 1 px escuro (a dobra)."""
    if lado < 0:
        f = (1.0 - f) % 1.0
    if f < 0.07:
        return 2          # o fundo da prega, na sombra
    if f < 0.36:
        return 1          # a face larga
    if f < 0.55:
        return 0          # a crista, na luz
    return 3              # a dobra que volta para a parede


def _mat_linho(tom):
    base = LINHO[tom]

    def f(L, n, P):
        out = np.tile(base, (len(L), 1))
        # contra a luz (na frente do vão aberto) o pano acende quente
        atras = (P[:, 1] > YA + 0.01) & (P[:, 1] < YB - 0.01) & (P[:, 2] > ZA + 0.02) & (P[:, 2] < ZB - 0.02)
        out = np.where(atras[:, None], out * 1.04 + np.array([10.0, 7.0, 0.0]), out)
        # a bainha embaixo (mais escura) e a beira de cima franzida
        bainha = P[:, 2] < _bainha_z(P)
        out = np.where(bainha[:, None], out * 0.86, out)
        return out
    return emissivo(f)


_BAINHA = {'z': None}


def _bainha_z(P):
    return _BAINHA['z'] if _BAINHA['z'] is not None else ZC0 + 0.05


def _cortina(c, lado, t):
    X, Y, Z, papel = _folha(lado, t)
    o = c.novo_obj(2)
    _BAINHA['z'] = float(Z[:, -1].mean()) + 0.055
    mats = {k: _mat_linho(k) for k in range(4)}
    ns, nz = X.shape[0] - 1, X.shape[1] - 1
    for i in range(ns):
        for j in range(nz):
            p00 = np.array((X[i, j], Y[i, j], Z[i, j]))
            p10 = np.array((X[i + 1, j], Y[i + 1, j], Z[i + 1, j]))
            p01 = np.array((X[i, j + 1], Y[i, j + 1], Z[i, j + 1]))
            p11 = np.array((X[i + 1, j + 1], Y[i + 1, j + 1], Z[i + 1, j + 1]))
            m = mats[_tom_prega(float(papel[i, j]), lado)]
            for tri in ((p00, p10, p11), (p00, p11, p01)):
                a, b, d = tri
                n = np.cross(b - a, d - a)
                if np.linalg.norm(n) < 1e-9:
                    continue
                n = n / np.linalg.norm(n)
                if n @ VISTA < 0:
                    n = -n
                c.face_plana([tuple(q) for q in tri], tuple(n), m, M, o)
    # o pano é um só: a luz da face (do acabamento) fica igual em todo ele; os tons vêm das pregas
    sel = c.obj == o
    c.nrm[sel] = (0.0, 1.0, 0.0)
    c.nz[sel] = 0.0
    return o


def _cobre_cortina(Py, Pz, Px, t):
    """
    Para os raios do sol (o ponto P e o sentido SOL, para trás): quanto a cortina tapa (0 ou 1), pelas duas folhas.
    A cortina é tomada como a superfície média da folha (x da altura) e a faixa de y que ela cobre naquela altura.
    """
    cob = np.zeros(Py.shape, bool)
    for lado in (+1, -1):
        X, Y, Z, _ = _folha(lado, t)
        zs = Z.mean(0)[::-1]
        xs = X.mean(0)[::-1]
        y_in = Y[-1][::-1]
        y_out = Y[0][::-1]
        # anda para trás até o plano médio da cortina (duas voltas: o x depende da altura)
        xm = np.full(Py.shape, float(xs.mean()))
        for _ in range(2):
            s = (Px - xm) / SOL[0]
            zq = Pz - s * SOL[2]
            xm = np.interp(zq, zs, xs)
        s = (Px - xm) / SOL[0]
        yq, zq = Py - s * SOL[1], Pz - s * SOL[2]
        a = np.interp(zq, zs, np.minimum(y_in, y_out))
        b = np.interp(zq, zs, np.maximum(y_in, y_out))
        cob |= (yq > a) & (yq < b) & (zq > zs[0]) & (zq < zs[-1]) & (s > 0)
    return cob


# ---------- a janela ----------
XF = -0.9                  # o pano de fundo lá fora (longe da parede)
KV = VISTA[2] / VISTA[0]   # o raio de vista desce KV metros a cada metro em x


def _ceu(L, n, P):
    """Lá fora: o céu claro em faixas, uma nuvem, o morro e as copas (em degraus de pixel). y, z: 0..1 no vão visto."""
    y = (L[:, 1] - (YA + XF)) / (YB - YA)
    z = (L[:, 2] - (ZA + KV * XF)) / (ZB - ZA)
    out = np.tile(_hx('#c4e4f1'), (len(L), 1))
    out = np.where((z > 0.62)[:, None], _hx('#acd7ec'), out)
    out = np.where((z > 0.86)[:, None], _hx('#9acce6'), out)
    nuv = (((y - 0.3) / 0.22) ** 2 + ((z - 0.74) / 0.05) ** 2 < 1) | (((y - 0.44) / 0.14) ** 2 + ((z - 0.785) / 0.05) ** 2 < 1)
    out = np.where(nuv[:, None], _hx('#f4fbfd'), out)
    morro = z < 0.36 + 0.06 * np.sin(y * 3.4 + 0.4)
    out = np.where(morro[:, None], _hx('#93bb8c'), out)
    onda = 0.07 * np.abs(np.sin(y * 9.0)) + 0.03 * np.sin(y * 3.7)
    copa = z < 0.24 + onda
    out = np.where(copa[:, None], _hx('#5f9a52'), out)
    out = np.where((copa & (z > 0.2 + onda))[:, None], _hx('#7cb463'), out)
    out = np.where((z < 0.1 + 0.04 * np.sin(y * 6.0 + 1.0))[:, None], _hx('#4d8446'), out)
    return out


_ceu = emissivo(_ceu)


def _vidro(L, n, P):
    y, z = L[:, 1], L[:, 2]
    out = np.tile(_hx('#cfe9f3'), (len(L), 1))
    risca = ((z + (y - YA) * 0.9) % 0.42) < 0.05
    return np.where(risca[:, None], _hx('#f2fafc'), out)


_vidro = emissivo(_vidro)


def janela(c, t):
    """Monta a janela e a cortina na cena para o instante t (0..1). Chamar depois de montar a sala."""
    # 1. fura a parede: o que se via da face x = 0 dentro do vão some
    P = c.mundoP
    furo = (c.tipo == 2) & (np.abs(P[..., 1]) < 0.03) & (P[..., 0] > YA) & (P[..., 0] < YB) & (P[..., 2] > ZA) & (P[..., 2] < ZB)
    c.prof[furo] = -1e9
    c.obj[furo] = -1
    # 2. lá fora (um pano de fundo longe o bastante para cobrir tudo que se vê pelo vão)
    o = c.novo_obj(2, contorno=False)
    # só o pedaço que se vê pelo vão (o vão empurrado no sentido da vista até lá): fora dele não aparece nada
    ya, yb, za, zb = YA + XF - 0.03, YB + XF + 0.03, ZA + KV * XF - 0.03, ZB + KV * XF + 0.03
    c.face_plana([(XF, ya, za), (XF, yb, za), (XF, yb, zb), (XF, ya, zb)], (1, 0, 0), _ceu, M, o)
    # 3. a grossura da parede no vão: o fundo do peitoril e a ombreira de trás (as que a câmera vê)
    forro = _madeira('#9a6038', eixo=1)
    o = c.novo_obj(2)
    c.face_plana([(-ESP, YA, ZA), (0, YA, ZA), (0, YB, ZA), (-ESP, YB, ZA)], (0, 0, 1), _madeira('#a86a3e', eixo=1), M, o)
    c.face_plana([(-ESP, YA, ZA), (0, YA, ZA), (0, YA, ZB), (-ESP, YA, ZB)], (0, 1, 0), forro, M, o)
    # 4. o caixilho: a travessa da bandeira, o pinázio e o vidro fixo em cima
    _caixa(c, (XV - 0.04, XV, YA, YB, ZT, ZT + TT), _madeira('#8a5232', eixo=0))
    _caixa(c, (XV - 0.04, XV, YM - 0.022, YM + 0.022, ZT + TT, ZB), _madeira('#8a5232'))
    o = c.novo_obj(2, contorno=False)
    c.face_plana([(XV - 0.02, YA, ZT + TT), (XV - 0.02, YB, ZT + TT), (XV - 0.02, YB, ZB), (XV - 0.02, YA, ZB)], (1, 0, 0), _vidro, M, o)
    # 5. o batente por dentro (as duas ombreiras e a verga com a cornija) e o peitoril com o avental
    BAT = _madeira('#9a5e36')
    _caixa(c, (0, 0.05, YA - 0.08, YA, ZA, ZB + 0.08), BAT)
    _caixa(c, (0, 0.05, YB, YB + 0.08, ZA, ZB + 0.08), BAT)
    _caixa(c, (0, 0.055, YA - 0.1, YB + 0.1, ZB, ZB + 0.1), _madeira('#9a5e36', eixo=0))
    _caixa(c, (0, 0.075, YA - 0.13, YB + 0.13, ZB + 0.1, ZB + 0.135), {'cima': _liso('#b4743f'), '*': _madeira('#a2663a', eixo=0)})
    _caixa(c, (0, 0.04, YA - 0.06, YB + 0.06, ZA - 0.17, ZA - 0.05), _madeira('#8a5232', eixo=0))
    _caixa(c, (-0.02, 0.14, YA - 0.13, YB + 0.13, ZA - 0.05, ZA), {'cima': _madeira('#b8783f', eixo=0), '*': _madeira('#9a5e36', eixo=0)})
    # 6. o varão com os suportes e as ponteiras
    FER = _liso('#4a3226')
    for yy in (YA - 0.27, YB + 0.27):
        _caixa(c, (0, XR, yy - 0.02, yy + 0.02, ZR - 0.03, ZR), FER)
    _caixa(c, (XR - 0.016, XR + 0.016, YA - 0.33, YB + 0.33, ZR - 0.015, ZR + 0.017), {'cima': _liso('#6e4a34'), '*': FER})
    for yy in (YA - 0.36, YB + 0.33):
        _caixa(c, (XR - 0.025, XR + 0.025, yy, yy + 0.03, ZR - 0.025, ZR + 0.027), {'cima': _liso('#7a5238'), '*': FER})
    # 7. as duas folhas da cortina
    _cortina(c, -1, t)
    _cortina(c, +1, t)


# ---------- a luz ----------
_CACHE = {}


def _mapa_sol(c):
    """O mapa de sombra do sol (os móveis tapando a luz), feito uma vez por sala (o mesmo para todos os quadros)."""
    chave = (len(c.polis), c.w, c.h, round(float(c.polis[-1][0].sum()), 4) if c.polis else 0)
    if chave not in _CACHE:
        c.sombra_direcional(SOL_W, res=0.015, raio=1)
        _CACHE.clear()
        _CACHE[chave] = c._mapa
    return _CACHE[chave]


def _aceso_mapa(c, Q, nrm=None, vies=0.02):
    """Q no MUNDO (e nrm no mundo)."""
    mapa, u, v, d, u0, v0, res = _mapa_sol(c)
    H, W = mapa.shape
    a = np.clip(((Q @ u - u0) / res).astype(int), 0, W - 1)
    b = np.clip(((Q @ v - v0) / res).astype(int), 0, H - 1)
    t = Q @ d
    if nrm is not None:
        cs = -(nrm @ d)
        tg = np.sqrt(np.clip(1 - cs * cs, 0, 1)) / np.maximum(cs, 0.15)
        margem = vies + res * 2.5 * tg
    else:
        margem = vies
    soma = np.zeros(t.shape)
    for dj in (-1, 0, 1):
        for di in (-1, 0, 1):
            soma += t <= mapa[np.clip(b + dj, 0, H - 1), np.clip(a + di, 0, W - 1)] + margem
    return soma / 9


def _passa(Px, Py, Pz, d, t):
    """Quanto da luz que anda no sentido d chega ao ponto P vindo do vão (0..1): o vão, as travessas, o vidro e a cortina."""
    ok = Px > 0.003
    k = np.ones(Px.shape)
    for xp in (0.0, -ESP):
        s = (Px - xp) / d[0]
        yq, zq = Py - s * d[1], Pz - s * d[2]
        ok &= (yq > YA) & (yq < YB) & (zq > ZA) & (zq < ZB)
    s = (Px - XV) / d[0]
    yq, zq = Py - s * d[1], Pz - s * d[2]
    trav = (zq > ZT) & (zq < ZT + TT)
    pin = (zq > ZT + TT) & (np.abs(yq - YM) < 0.022)
    k = np.where(trav | pin, 0.0, np.where(zq > ZT + TT, 0.72, 1.0))
    cob = _cobre_cortina(Py, Pz, Px, t)
    k = np.where(cob, k * 0.42, k)
    return np.where(ok, k, 0.0)


def _degraus(x):
    """0..1 em 3 degraus (pixel art): sombra, meia luz, luz."""
    return np.where(x > 0.8, 1.0, np.where(x > 0.45, 0.62, np.where(x > 0.16, 0.3, 0.0)))


def luz_janela(cor, c, t):
    """
    O sol da janela no acabamento (cor: a imagem antes de ampliar). A mancha quente no chão e nos móveis (o vão
    projetado, com a sombra das travessas e da cortina, em 3 degraus) e o feixe bem leve no ar.
    """
    Pw = c.mundoP
    P = _w(Pw)
    h, w = c.obj.shape
    X, Y, Z = P[..., 0], P[..., 1], P[..., 2]
    recebe = (c.obj >= 0) & ((c.tipo == 1) | (c.tipo == 3) | ((c.tipo == 2) & (c.nz > 0.6) & (X > 0.003)))
    idx = np.nonzero(recebe & (X > 0.003) & (Z < ZB))
    Px, Py, Pz = X[idx], Y[idx], Z[idx]
    # a borda macia: o sol não é um ponto (5 sentidos em volta do principal)
    acc = np.zeros(Px.shape)
    u = np.cross(SOL, [0, 0, 1.0]); u /= np.linalg.norm(u)
    v = np.cross(SOL, u)
    amostras = [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)]
    for (a, b) in amostras:
        d = SOL + 0.011 * (a * u + b * v)
        d = d / np.linalg.norm(d)
        acc += _passa(Px, Py, Pz, d, t)
    acc /= len(amostras)
    # os móveis tapando (o mapa do sol)
    Q = np.stack([Px, Py, Pz], 1)
    ac = _aceso_mapa(c, _w(Q), c.nrm[idx])
    # a face de costas para o sol não acende
    vira = (c.nrm[idx] @ SOL_W) < -0.05
    acc = acc * ac * vira
    q = np.zeros((h, w))
    q[idx] = _degraus(acc)
    # no chão pousa inteira; nos móveis um pouco menos (já têm a luz da face)
    forca = np.where(c.tipo == 1, 1.0, 0.9)[..., None]
    k = q[..., None] * forca
    # clareia sem lavar a cor: a madeira no sol fica mais clara e mais quente (não bege)
    cor = cor * (1 + 0.24 * k) + np.array([28.0, 24.0, 8.0]) * k
    # o feixe no ar: o caminho da câmera até o que se vê, quanto dele cai dentro do sol
    V = VISTA / np.linalg.norm(VISTA)
    dens = np.zeros((h, w))
    alvo = (c.obj >= 0)
    ii = np.nonzero(alvo)
    P0 = P[ii]
    passos = 18
    for kk in range(passos):
        s = (kk + 0.5) / passos * 3.4
        Qa = P0 + V * s
        dentro = (Qa[:, 2] > 0.02) & (Qa[:, 2] < ZB) & (Qa[:, 0] < 3.0) & (Qa[:, 1] < 7.5) & (Qa[:, 0] > 0.02)
        luz = _passa(Qa[:, 0], Qa[:, 1], Qa[:, 2], SOL, t)
        dens[ii] += np.where(dentro, luz, 0) * np.clip(1.15 - Qa[:, 0] / 2.4, 0, 1)
    dens /= passos
    # dois degraus bem leves, sem pontilhado
    f = np.where(dens > 0.075, 1.0, np.where(dens > 0.03, 0.5, 0.0))
    cor = cor + (COR_SOL - cor) * (f * 0.12)[..., None]
    _ULTIMO['feixe'] = f
    return cor


_ULTIMO = {}


def _poeira(t):
    """Os grãos: começam num ponto do vão e andam no sentido do sol; flutuam devagar num laço (fecha em t = 1)."""
    pts = []
    for i in range(9):
        y0 = YA + 0.1 + 0.7 * ruido(i, 3)
        z0 = ZA + 0.15 + 0.6 * ruido(i, 5)
        s = 0.35 + 1.1 * ruido(i, 7)
        base = np.array([0.0, y0, z0]) + s * SOL
        f1, f2, f3 = ruido(i, 11), ruido(i, 13), ruido(i, 17)
        a = 2 * math.pi * t
        # cada grão anda numa voltinha (uns 2 a 3 px) e desce e sobe devagar
        off = np.array([0.05 * math.sin(a + 6.28 * f1), 0.06 * math.cos(a + 6.28 * f2), 0.07 * math.sin(a + 6.28 * f3) + 0.025 * math.sin(2 * a + 6.28 * f1)])
        pts.append(base + off)
    return np.array(pts)


def poeira_janela(cor, c, t):
    """Os grãos de poeira de 1 px no feixe (no fim do acabamento, depois do contorno)."""
    pts = _poeira(t)
    luz = _passa(pts[:, 0], pts[:, 1], pts[:, 2], SOL, t)
    luz = luz * _aceso_mapa(c, _w(pts))
    pts = _w(pts)
    S = tela(pts)
    cor = cor.copy()
    for (sx, sy), p, l in zip(S, pts, luz):
        if l < 0.25:
            continue
        a = 0.6 * min(1.0, l)              # na sombra da cortina o grão some aos poucos
        x, y = int(math.floor(sx - c.x0)), int(math.floor(sy - c.y0))
        if 0 <= x < c.w and 0 <= y < c.h and (p @ VISTA) > c.prof[y, x]:
            cor[y, x] = cor[y, x] * (1 - a) + np.array([255.0, 244.0, 214.0]) * a
    return cor
