"""
Grupo B: as peças de ESTRUTURA do tabuleiro em pixel art 1:1 (a porta, as escadas, as paredes internas, as celas, as
entradas), no estilo da cozinha da fazenda. Formato: o do LEIA-ME (ITENS, SO_GIROS).

Tudo desenhado no giro 4 (a frente para +y, as costas no plano y = 0), a pegada começando em (0, 0).

A porta (`portal`) é a peça mais importante: ela fica na casa da porta, encostada no vão que o jogo abre na parede do
fundo (roomStatic.ts, vaoDaPorta): o vão tem 0,65 m (VAO_PORTA_M) e 2,1 m, o buraco preto da parede 0,70 m (meio
batente de cada lado) e a borda dele uma risca de 2 px até 2,16 m. A moldura cobre a borda: os batentes vão de 0 a
0,05 m e de 0,70 a 0,75 m, a verga até 2,21 m. Os estados: 0 aberta (a folha girada 90° para dentro, no lado da
dobradiça, sem tapar o vão), 1 fechada, 2 trancada (a tranca de ferro atravessada e o cadeado). A arte só existe nas
paredes do fundo (giros 4 e 2: SO_GIROS); a dobradiça fica do lado de trás na tela (giro 4: u pequeno; giro 2: u grande).

As paredes internas e a parede de cela são BLOCOS da casa inteira (0,75 x 0,75 m): emendam em fila, em L e em bloco
(o anexo do Orfanato é um bloco de 5 x 6 delas; as celas da Sede têm paredes em L), sem o contorno escuro entre uma e
outra (o padrão repete a cada 32 px, a casa). A meia parede e a divisória do banheiro são finas.
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
from base_estilo import hx, _tom, PH, PZ, mad2, tab2, liso, _pau
from motor import emissivo, ruido

CASA = 0.75


# =====================================================================================================================
# ajudas
# =====================================================================================================================
def _rot():
    """O giro que o exportador está desenhando (4 na cena)."""
    p = BE._peca()
    return 4 if p is None else p.rot


def _cx(b, mat, oid=None, sombra=True, contorno=True, pegada=False, tipo=3):
    """Uma caixa (u0, u1, v0, v1, z0, z1) num objeto novo (ou no oid). sombra=False: fora da medida `real`."""
    c = CZ.c
    o = c.novo_obj(tipo, contorno=contorno, sombra=sombra) if oid is None else oid
    c.caixa(b, mat, CZ.M, o)
    if pegada:
        CZ.pegadas.append(tuple(b[:4]))
    return o


def _fp(pts, n, mat, oid, dois_lados=False):
    CZ.c.face_plana(pts, n, mat, CZ.M, oid, dois_lados)


def _por_cima_do_chao(buraco):
    """
    O buraco no chão (o poço da escada, o alçapão). O que fica abaixo de z = 0 só aparece pela boca dele: cada pixel
    abaixo do chão cujo raio até a câmera não passa pela boca (u0, u1, v0, v1) é apagado (lá o chão do jogo o tapa).
    E o chão invisível do exportador (z = 0, para a sombra), desenhado depois, tapava o fundo: empurrando a
    profundidade de tudo o que ficou para a frente, por igual (o contorno compara diferenças), ele só pinta onde não há peça.
    """
    from motor import VISTA
    c = CZ.c
    p = BE._peca()
    P = c.mundoP
    abaixo = (c.obj >= 0) & (P[..., 2] < -1e-4)
    Q = P - VISTA[None, None, :] * (P[..., 2:3] / VISTA[2])
    Lq = p.local(Q) if p is not None else Q
    u0, u1, v0, v1 = buraco
    fora = abaixo & ~((Lq[..., 0] > u0) & (Lq[..., 0] < u1) & (Lq[..., 1] > v0) & (Lq[..., 1] < v1))
    c.obj = np.where(fora, -1, c.obj)
    c.tipo = np.where(fora, 0, c.tipo)
    c.prof = np.where(fora, -1e9, c.prof)
    c.prof = np.where(c.obj >= 0, c.prof + 1000.0, c.prof)


def _faixa(a, a0, a1):
    return (a >= a0) & (a < a1)


# =====================================================================================================================
# materiais
# =====================================================================================================================
MOLD = '#9a5d33'        # a moldura (batente e guarnição): madeira média, mais clara que a folha
MOLD_T = '#b8763f'
FOLHA = '#7a4226'       # a folha da porta
FERRO = '#36312e'
FERRO_T = '#5c5550'
LATAO = '#b98d3e'


def almofadas(cor, paineis, eixo='x', tela=1, seed=0, veio=1, borda_luz=1.13, borda_somb=0.8):
    """
    A madeira da folha com as almofadas (o painel rebaixado com o chanfro): a fresta escura de 1 px, o chanfro de
    2 px (claro em cima e do lado da luz, escuro embaixo e do outro lado) e o campo do meio. eixo 'x': a face olha
    para ±y (a = u); 'y': olha para ±x (a = v). tela: +1 se `a` cresce para a direita na tela, -1 se para a esquerda
    (a luz vem de cima à esquerda). Só nas faces largas; o resto é a madeira com o veio.
    """
    base = mad2(cor, eixo=veio, seed=seed, passo=0.07)
    c0 = hx(cor)

    def f(L, n, P):
        out = base(L, n, P)
        larga = abs(n[1]) > 0.5 if eixo == 'x' else abs(n[0]) > 0.5
        if not larga:
            return out
        a = L[:, 0] if eixo == 'x' else L[:, 1]
        z = L[:, 2]
        for (a0, a1, z0, z1) in paineis:
            d = (a >= a0) & (a < a1) & (z >= z0) & (z < z1)
            if not d.any():
                continue
            ea = PH
            fr = d & ((a < a0 + ea) | (a >= a1 - ea) | (z < z0 + PZ) | (z >= z1 - PZ))
            esq = (a < a0 + 3 * ea) if tela > 0 else (a >= a1 - 3 * ea)
            dir_ = (a >= a1 - 3 * ea) if tela > 0 else (a < a0 + 3 * ea)
            cima = z >= z1 - 3 * PZ
            baixo = z < z0 + 3 * PZ
            bev = d & ~fr & (esq | dir_ | cima | baixo)
            luz = bev & (cima | (esq & ~baixo))
            somb = bev & ~luz
            campo = d & ~fr & ~bev
            out = np.where(campo[:, None], _tom(out, 1.04), out)
            out = np.where(luz[:, None], _tom(c0, borda_luz), out)
            out = np.where(somb[:, None], _tom(c0, borda_somb), out)
            out = np.where(fr[:, None], _tom(c0, 0.55), out)
        return out
    return emissivo(f)


def guarnicao(cor, eixo=1, seed=0, frisos=(), topo=None):
    """A guarnição da moldura: a madeira com o veio e os frisos (riscas de 1 px ao longo dela, na face da frente)."""
    base = mad2(cor, eixo=eixo, seed=seed, passo=0.05)
    c0 = hx(cor)
    ct = hx(topo) if topo else _tom(c0, 1.25)

    def f(L, n, P):
        if n[2] > 0.5:
            return np.tile(ct, (len(P), 1))
        out = base(L, n, P)
        if abs(n[1]) > 0.5 and frisos:
            a = L[:, 0] if eixo == 1 else L[:, 2]
            ee = PH if eixo == 1 else PZ
            for (ff, k) in frisos:
                out = np.where(((a >= ff) & (a < ff + ee))[:, None], _tom(c0, k), out)
        return out
    return emissivo(f)


def ferro(cor=FERRO, topo=FERRO_T):
    c0, ct = hx(cor), hx(topo)

    def f(L, n, P):
        if n[2] > 0.5:
            return np.tile(ct, (len(P), 1))
        out = np.tile(c0, (len(P), 1))
        return out
    return emissivo(f)


def latao():
    c0 = hx(LATAO)

    def f(L, n, P):
        if n[2] > 0.5:
            return np.tile(_tom(c0, 1.3), (len(P), 1))
        return np.tile(c0, (len(P), 1))
    return emissivo(f)


# =====================================================================================================================
# a porta (portal)
# =====================================================================================================================
VAO0, VAO1 = 0.05, 0.70          # o vão (0,65 m), entre os batentes
ZV = 2.10                         # o alto do vão
ZG = 2.21                         # o alto da guarnição de cima
FY = -0.005                       # a frente da folha fechada (no plano da parede, por dentro do batente)
ESPF = 0.04                       # a espessura da folha
REV = 0.08                        # o fundo do batente que aparece dentro do vão (o resto da parede é o buraco preto)


def _paineis_folha(a0):
    """As 4 almofadas da folha (2 em cima, compridas; 2 embaixo), com a folha começando em a0 (0,64 m de largura)."""
    m = (0.145, 0.34, 0.41, 0.605)
    return [(a0 - 0.055 + m[0], a0 - 0.055 + m[1], 0.2, 0.92), (a0 - 0.055 + m[2], a0 - 0.055 + m[3], 0.2, 0.92),
            (a0 - 0.055 + m[0], a0 - 0.055 + m[1], 1.13, 1.96), (a0 - 0.055 + m[2], a0 - 0.055 + m[3], 1.13, 1.96)]


def _moldura():
    """O batente e a guarnição: os dois batentes, a verga, a cornija e as soleira; o fundo do batente dentro do vão."""
    # o fundo do batente (o forro dentro da parede), dos dois lados, e a soleira
    forro = mad2('#83502e', eixo=1, seed=31, passo=0.05)
    _cx((VAO0 - 0.015, VAO0, -REV, 0.0, 0.0, ZV), forro)
    _cx((VAO1, VAO1 + 0.015, -REV, 0.0, 0.0, ZV), forro)
    _cx((VAO0, VAO1, -REV, 0.03, 0.0, 0.022), {'cima': tab2(['#8c5a34', '#94603a'], 0.055, '#5a3218', eixo=0, seed=33),
                                               '*': _pau('#6e4026', '#8c5a34', quina=False)})
    # os batentes (a guarnição), com dois frisos e a base mais grossa (o pé do batente)
    for (a0, a1) in ((0.0, VAO0), (VAO1, CASA)):
        fr = ((a0 + 2 * PH, 0.8), (a1 - 2 * PH, 1.12))
        _cx((a0, a1, 0.0, 0.035, 0.0, ZV), guarnicao(MOLD, eixo=1, seed=int(a0 * 100), frisos=fr, topo=MOLD_T))
        _cx((a0 - 0.004, a1 + 0.004, 0.0, 0.045, 0.0, 0.15), _pau('#86502c', '#a86a3c', quina=1.2, b=(0, 0, 0, 0, 0, 0.15)))
    # a verga (a guarnição de cima) e a cornija por cima dela
    _cx((0.0, CASA, 0.0, 0.04, ZV, ZG), guarnicao(MOLD, eixo=0, seed=35, frisos=((ZV + 2 * PZ, 0.82),), topo=MOLD_T))
    _cx((-0.015, CASA + 0.015, 0.0, 0.055, ZG, ZG + 0.035), _pau('#8a522e', '#c08048', quina=1.25, b=(0, 0, 0, 0, 0, ZG + 0.035)))


def _na_face(eixo, face, s, a0, a1, d0, d1, z0, z1):
    """A caixa presa numa face: `a` ao longo dela, `d` para fora (s = +1/-1). eixo 'y': a face é um plano y; 'x': um plano x."""
    p0, p1 = sorted((face + s * d0, face + s * d1))
    return (a0, a1, p0, p1, z0, z1) if eixo == 'y' else (p0, p1, a0, a1, z0, z1)


def _macaneta(eixo, face, s, a, z, sombra=True):
    """A maçaneta de latão com o espelho (a placa comprida) e o buraco da chave embaixo dela."""
    _cx(_na_face(eixo, face, s, a - 0.014, a + 0.014, 0.0, 0.008, z - 0.075, z + 0.06), latao(), sombra=sombra)
    _cx(_na_face(eixo, face, s, a - 0.02, a + 0.02, 0.008, 0.035, z - 0.02, z + 0.02), latao(), sombra=sombra)
    _cx(_na_face(eixo, face, s, a - 0.005, a + 0.005, 0.008, 0.01, z - 0.06, z - 0.035), liso('#1c1410'), sombra=sombra)


def _dobradicas(x0, x1, y0, y1):
    for z in (0.22, 1.02, 1.84):
        _cx((x0, x1, y0, y1, z, z + 0.09), ferro())


def _folha_fechada(rot):
    """A folha fechada no vão: as almofadas, as dobradiças do lado de trás na tela e a maçaneta do outro."""
    a0, a1 = VAO0 + 0.005, VAO1 - 0.005
    _cx((a0, a1, FY - ESPF, FY, 0.006, ZV - 0.004), almofadas(FOLHA, _paineis_folha(a0), 'x', 1, seed=41))
    if rot == 2:
        _macaneta('y', FY, 1, a0 + 0.075, 1.0)
        _dobradicas(a1 - 0.014, a1, FY, FY + 0.006)
    else:
        _macaneta('y', FY, 1, a1 - 0.075, 1.0)
        _dobradicas(a0, a0 + 0.014, FY, FY + 0.006)


def _folha_aberta(rot):
    """
    A folha aberta: girada 90° para dentro da sala, na dobradiça do lado de trás na tela (giro 4: o batente de u
    pequeno; giro 2: o de u grande), encostada no pé do batente. Assim ela não tapa o vão. Fica fora da medida `real`.
    """
    L = VAO1 - VAO0 - 0.01        # a largura da folha
    if rot == 2:
        x1 = VAO1 - 0.005
        b = (x1 - ESPF, x1, FY, FY + L, 0.006, ZV - 0.004)
        o = _cx(b, almofadas(FOLHA, _paineis_folha(FY + 0.06), 'y', 1, seed=41), sombra=False)
        _macaneta('x', x1 - ESPF, -1, FY + L - 0.075, 1.0, sombra=False)
    else:
        x0 = VAO0 + 0.005
        b = (x0, x0 + ESPF, FY, FY + L, 0.006, ZV - 0.004)
        o = _cx(b, almofadas(FOLHA, _paineis_folha(FY + 0.06), 'y', -1, seed=41), sombra=False)
        _macaneta('x', x0 + ESPF, 1, FY + L - 0.075, 1.0, sombra=False)
    CZ.pegadas.append(tuple(b[:4]))
    return o


def _tranca():
    """A porta trancada: a barra de ferro atravessada nos dois batentes (nas presilhas) e o cadeado pendurado."""
    zb = 1.12
    _cx((-0.02, CASA + 0.02, 0.04, 0.062, zb, zb + 0.06), ferro('#2e2a28', '#57504a'))
    for x in (0.012, CASA - 0.042):
        _cx((x, x + 0.03, 0.035, 0.07, zb - 0.03, zb + 0.09), ferro('#26221f', '#4a4440'))
    # os rebites da barra (2 px claros)
    for x in (0.16, 0.59):
        _cx((x, x + 0.022, 0.062, 0.066, zb + 0.02, zb + 0.04), ferro('#6a625a', '#7a7068'))
    # o cadeado: a alça (um U) presa na argola da barra e o corpo de latão com o buraco da chave
    xm = 0.42
    _cx((xm - 0.03, xm - 0.016, 0.066, 0.078, zb - 0.07, zb + 0.02), ferro('#8a8480', '#a8a29c'))
    _cx((xm + 0.016, xm + 0.03, 0.066, 0.078, zb - 0.07, zb + 0.02), ferro('#8a8480', '#a8a29c'))
    _cx((xm - 0.03, xm + 0.03, 0.066, 0.078, zb + 0.02, zb + 0.034), ferro('#8a8480', '#a8a29c'))
    cad = hx('#b48a3c')

    def corpo(L, n, P):
        out = np.tile(cad, (len(P), 1))
        if n[2] > 0.5:
            return np.tile(_tom(cad, 1.25), (len(P), 1))
        z = L[:, 2]
        out = np.where((z >= zb - 0.07 - PZ)[:, None], _tom(cad, 1.15), out)
        out = np.where((z < zb - 0.17 + PZ)[:, None], _tom(cad, 0.8), out)
        if n[1] > 0.5:
            x = L[:, 0]
            fur = (np.abs(x - xm) < PH * 0.6) & (z > zb - 0.135) & (z < zb - 0.1)
            out = np.where(fur[:, None], hx('#2a1c10'), out)
        return out
    _cx((xm - 0.045, xm + 0.045, 0.06, 0.1, zb - 0.17, zb - 0.07), emissivo(corpo))


def _porta(estado):
    def d():
        rot = _rot()
        _moldura()
        if estado == 0:
            _folha_aberta(rot)
        else:
            _folha_fechada(rot)
            if estado == 2:
                _tranca()
    return d


# =====================================================================================================================
# os blocos de parede (sem contorno entre um e outro: o padrão repete a cada casa, 32 px)
# =====================================================================================================================
def _face_info(L, n):
    """(vertical?, a ao longo da face, z). a = u nas faces que olham para ±y, v nas que olham para ±x."""
    if n[2] > 0.5 or n[2] < -0.5:
        return False, None, L[:, 2]
    a = L[:, 0] if abs(n[1]) > 0.5 else L[:, 1]
    return True, a, L[:, 2]


def _celula(a, z, la, lz, seed):
    """Um ruído em blocos compridos (la x lz), repetindo a cada casa ao longo da face (para emendar sem costura)."""
    nz = np.floor(z / lz)
    n_a = max(1, int(round(CASA / la)))
    ia = np.floor((a + (nz % 2) * la * 0.5) / la) % n_a
    return ruido(ia, nz, seed)


def _topo_bloco(ct, L, seed, escuro=0.9, claro=1.1):
    """O topo do bloco: grão em blocos (repete a cada casa), a quina da frente clara e a emenda de trás um tom abaixo."""
    u, v = L[:, 0] % CASA, L[:, 1] % CASA
    out = np.tile(ct, (len(L), 1))
    k = ruido(np.floor(u / (4 * PH)) % 8, np.floor(v / (3 * PH)) % 8, seed + 3)
    out = np.where((k > 0.82)[:, None], _tom(ct, 0.96), out)
    out = np.where(((u < PH) | (v < PH))[:, None], _tom(ct, escuro), out)
    return np.where(((u > CASA - 1.5 * PH) | (v > CASA - 1.5 * PH))[:, None], _tom(ct, claro), out)


def reboco(cor='#e3d5b6', topo='#cfc3a6', h=2.4, barrado=None, seed=0):
    """
    O reboco caiado (a cal creme da cozinha): manchas compridas da cal gasta em dois tons, a sujeira de baixo (dois
    degraus) e, se `barrado` (cor, alto), a faixa de baixo pintada. O topo é a capa de cimento. Sem contorno: a quina de
    cima clareia e a beira de baixo escurece aqui mesmo.
    """
    c0, ct = hx(cor), hx(topo)
    bc = hx(barrado[0]) if barrado else None

    def f(L, n, P):
        vert, a, z = _face_info(L, n)
        if not vert:
            return _topo_bloco(ct, L, seed)
        out = np.tile(c0, (len(P), 1))
        out = np.where((z > h - 0.5)[:, None], _tom(c0, 1.025), out)
        k = _celula(a, z, 8 * PH, 3 * PZ, seed)
        k2 = _celula(a + 0.11, z + 0.05, 6 * PH, 2 * PZ, seed + 7)
        out = np.where((k > 0.86)[:, None], _tom(c0, 0.955), out)
        out = np.where((k2 > 0.9)[:, None], _tom(c0, 1.035), out)
        out = np.where((z < 0.3)[:, None], _tom(out, 0.95), out)
        out = np.where((z < 0.12)[:, None], _tom(out, 0.9), out)
        if barrado:
            hb = barrado[1]
            out = np.where((z < hb)[:, None], np.where((k > 0.8)[:, None], _tom(bc, 0.94), bc), out)
            out = np.where(((z >= hb) & (z < hb + PZ))[:, None], _tom(bc, 0.75), out)
        out = np.where((z > h - PZ)[:, None], _tom(c0, 1.12), out)
        return np.where((z < PZ)[:, None], _tom(out, 0.6), out)
    return emissivo(f)


def concreto(cor='#a19d94', h=2.2, pintura=('#5d6b63', 1.0), seed=0):
    """
    O concreto da cela: as marcas das tábuas da fôrma (1 px escuro e 1 claro embaixo, a cada 18 cm), os furos de
    amarração (4 por casa) com o escorrido, a tinta verde-acinzentada embaixo (a risca em cima, o desgaste) e a capa.
    """
    c0 = hx(cor)
    pc = hx(pintura[0]) if pintura else None

    def f(L, n, P):
        vert, a, z = _face_info(L, n)
        if not vert:
            return _topo_bloco(_tom(c0, 0.92), L, seed, 0.86, 1.1)
        out = np.tile(c0, (len(P), 1))
        k = _celula(a, z, 9 * PH, 4 * PZ, seed)
        out = np.where((k > 0.8)[:, None], _tom(c0, 0.95), out)
        out = np.where((k < 0.12)[:, None], _tom(c0, 1.04), out)
        g = z % 0.18
        out = np.where((g < PZ)[:, None], _tom(c0, 0.86), out)
        out = np.where(((g >= PZ) & (g < 2 * PZ))[:, None], _tom(c0, 1.05), out)
        am = a % CASA
        for (ac, zc) in ((0.19, 0.62), (0.53, 0.62), (0.19, 1.6), (0.53, 1.6)):
            fur = (am >= ac) & (am < ac + 2 * PH) & (z >= zc) & (z < zc + 2 * PZ)
            esc = (am >= ac) & (am < ac + 2 * PH) & (z >= zc - 6 * PZ) & (z < zc)
            out = np.where(esc[:, None], _tom(out, 0.93), out)
            out = np.where(fur[:, None], _tom(c0, 0.55), out)
        if pc is not None:
            hb = pintura[1]
            t = np.where((k > 0.75)[:, None], _tom(pc, 0.93), pc)
            t = np.where((g < PZ)[:, None], _tom(pc, 0.88), t)
            gasto = (_celula(a + 0.3, z, 5 * PH, 2 * PZ, seed + 9) > 0.95) & (z > 0.1)
            t = np.where(gasto[:, None], _tom(pc, 1.12), t)
            out = np.where((z < hb)[:, None], t, out)
            out = np.where(((z >= hb) & (z < hb + 2 * PZ))[:, None], _tom(pc, 0.7), out)
        out = np.where((z > h - PZ)[:, None], _tom(c0, 1.15), out)
        return np.where((z < PZ)[:, None], _tom(out, 0.55), out)
    return emissivo(f)


def _bloco(mat, h, b=None, oid=None):
    """Um bloco de parede (sem contorno) da casa inteira, ou da caixa b."""
    b = b or (0.0, CASA, 0.0, CASA, 0.0, h)
    o = CZ.c.novo_obj(3, contorno=False) if oid is None else oid
    CZ.c.caixa(b, mat, CZ.M, o)
    CZ.pegadas.append(tuple(b[:4]))
    return o


H_IWALL = 3.92 / 1.633            # 2,4 m
H_LOW = 2.12 / 1.633              # 1,3 m
H_CELA = 3.59 / 1.633             # 2,2 m
H_BOX = 2.61 / 1.633              # 1,6 m
BARRADO = ('#9a8f7c', 0.32)


def _iwall():
    _bloco(reboco(h=H_IWALL, barrado=BARRADO, seed=11), H_IWALL)


def _iwall_window():
    """O bloco com a janela de lado a lado: o peitoril, as ombreiras, a verga; o caixilho branco no meio e o vidro."""
    h = H_IWALL
    m = reboco(h=h, barrado=BARRADO, seed=11)
    mv = reboco(cor='#d2c4a4', h=h, seed=12)            # o vão (por dentro da parede) um tom abaixo
    J0, J1, Z0, Z1 = 0.13, 0.62, 0.95, 1.85
    o = CZ.c.novo_obj(3, contorno=False)
    CZ.c.caixa((0, CASA, 0, CASA, 0, Z0), {'*': m, 'cima': mv}, CZ.M, o)
    CZ.c.caixa((0, CASA, 0, CASA, Z1, h), m, CZ.M, o)
    CZ.c.caixa((0, J0, 0, CASA, Z0, Z1), {'*': m, 'dir': mv}, CZ.M, o)
    CZ.c.caixa((J1, CASA, 0, CASA, Z0, Z1), {'*': m, 'esq': mv}, CZ.M, o)
    CZ.pegadas.append((0, CASA, 0, CASA))
    # o peitoril de madeira dos dois lados
    PT = _pau('#7a4a2a', '#a8703e', quina=1.2, b=(0, 0, 0, 0, 0, Z0 + 0.012))
    _cx((J0, J1, -0.02, 0.07, Z0 - 0.03, Z0 + 0.012), PT)
    _cx((J0, J1, CASA - 0.07, CASA + 0.02, Z0 - 0.03, Z0 + 0.012), PT)
    # o caixilho (no meio da parede): o quadro, a travessa e o pinázio, e o vidro
    vm0, vm1 = 0.6, 0.64
    caix = _pau('#e2dac6', '#f4eedc', quina=False)
    o2 = CZ.c.novo_obj(3)
    for b in ((J0, J0 + 0.035, vm0, vm1, Z0, Z1), (J1 - 0.035, J1, vm0, vm1, Z0, Z1), (J0, J1, vm0, vm1, Z0, Z0 + 0.05),
              (J0, J1, vm0, vm1, Z1 - 0.04, Z1), (J0, J1, vm0, vm1, 1.42, 1.455), (0.36, 0.39, vm0, vm1, Z0, Z1)):
        CZ.c.caixa(b, caix, CZ.M, o2)
    vid = hx('#5f7f8a')

    def vidro(L, n, P):
        out = np.tile(vid, (len(P), 1))
        a, z = (L[:, 0], L[:, 2])
        d = np.floor((a - J0) / PH) + np.floor((z - Z0) / PZ) * 0.5
        out = np.where(((d % 16) < 2)[:, None], _tom(vid, 1.35), out)
        out = np.where((z > 1.72)[:, None], _tom(out, 0.85), out)
        return out
    _cx((J0 + 0.03, J1 - 0.03, vm0 + 0.015, vm1 - 0.015, Z0 + 0.05, Z1 - 0.04), emissivo(vidro), contorno=False)


def _iwall_door():
    """O bloco com o vão de passagem (de lado a lado): as ombreiras, a verga de madeira aparente e a soleira de pedra."""
    h = H_IWALL
    m = reboco(h=h, barrado=BARRADO, seed=11)
    mv = reboco(cor='#d2c4a4', h=h, barrado=('#8a806e', 0.32), seed=12)
    J0, J1, ZV2 = 0.1, 0.65, 2.1
    o = CZ.c.novo_obj(3, contorno=False)
    CZ.c.caixa((0, J0, 0, CASA, 0, h), {'*': m, 'dir': mv}, CZ.M, o)
    CZ.c.caixa((J1, CASA, 0, CASA, 0, h), {'*': m, 'esq': mv}, CZ.M, o)
    CZ.c.caixa((J0, J1, 0, CASA, ZV2, h), m, CZ.M, o)
    CZ.pegadas.append((0, J0, 0, CASA))
    CZ.pegadas.append((J1, CASA, 0, CASA))
    VG = mad2('#6e4026', eixo=0, seed=51, passo=0.04)
    for (v0, v1) in ((-0.012, 0.03), (CASA - 0.03, CASA + 0.012)):
        _cx((J0 - 0.06, J1 + 0.06, v0, v1, ZV2 - 0.005, ZV2 + 0.13), {'*': VG, 'cima': liso('#8a5634')})
    _cx((J0, J1, 0.0, CASA, 0.0, 0.025), {'cima': pedra('#a8a294', seed=52), '*': liso('#7e786c')}, contorno=False)


def _iwall_low():
    """A meia parede fina (1,3 m) no fundo da casa: o reboco, o rodapé de madeira dos dois lados e a capa de madeira."""
    h = H_LOW
    E = 0.14
    _bloco(reboco(h=h - 0.05, seed=13), h - 0.05, b=(0.0, CASA, 0.0, E, 0.0, h - 0.05))
    o = CZ.c.novo_obj(3, contorno=False)
    CAPA = {'cima': tab2(['#9a6036', '#a0663a'], 0.075, '#5a3218', eixo=0, seed=55),
            '*': _pau('#7a4628', '#9a6036', quina=1.18, b=(0, 0, 0, 0, 0, h))}
    CZ.c.caixa((0.0, CASA, -0.012, E + 0.012, h - 0.05, h), CAPA, CZ.M, o)
    o2 = CZ.c.novo_obj(3, contorno=False)
    RD = _pau('#6e4026', '#8a5434', quina=1.25, b=(0, 0, 0, 0, 0, 0.1))
    CZ.c.caixa((0.0, CASA, -0.01, E + 0.01, 0.0, 0.1), RD, CZ.M, o2)


def formica(cor='#e4dccb'):
    """A fórmica da divisória: lisa, um brilho comprido em diagonal e a sombrinha embaixo."""
    c0 = hx(cor)

    def f(L, n, P):
        out = np.tile(c0, (len(P), 1))
        vert, a, z = _face_info(L, n)
        if not vert:
            return np.tile(hx('#c8c6c0'), (len(P), 1))
        if abs(n[1]) > 0.5:
            d = np.floor(a / PH) - np.floor(z / PZ) * 0.5
            out = np.where(((d % 32) < 3)[:, None], _tom(c0, 1.06), out)
            out = np.where((z < 0.15 + 2 * PZ)[:, None], _tom(c0, 0.92), out)
        return out
    return emissivo(f)


def _stall_panel():
    """A divisória de fórmica no meio da casa (fina, 1,6 m), com o perfil de alumínio em cima e embaixo e os pés de metal."""
    v0, v1 = 0.355, 0.395
    z0 = 0.15
    o = CZ.c.novo_obj(3, contorno=False)
    CZ.c.caixa((0.0, CASA, v0, v1, z0, H_BOX - 0.02), formica(), CZ.M, o)
    al = _pau('#9a9890', '#d8d6ce', quina=1.15, b=(0, 0, 0, 0, 0, H_BOX))
    _cx((0.0, CASA, v0 - 0.006, v1 + 0.006, H_BOX - 0.02, H_BOX), al, contorno=False)
    _cx((0.0, CASA, v0 - 0.004, v1 + 0.004, z0 - 0.012, z0 + 0.008), _pau('#8a8880', '#b8b6ae', quina=False), contorno=False)
    for u in (0.1, CASA - 0.13):
        _cx((u, u + 0.03, v0 + 0.005, v1 - 0.005, 0.02, z0), _pau('#9c9a94', '#c8c6c0', quina=1.15, b=(0, 0, 0, 0, 0, z0)))
        _cx((u - 0.015, u + 0.045, v0 - 0.03, v1 + 0.03, 0.0, 0.022), _pau('#7c7a74', '#aeaca6', quina=False), pegada=True)
    CZ.pegadas.append((0.0, CASA, v0, v1))


def _cell_front():
    _bloco(concreto(h=H_CELA, seed=21), H_CELA)


def aco(cor='#69737a', a0=0.0, a1=0.6, eixo='x'):
    """
    A chapa da porta de aço: as chapas rebaixadas, o visor gradeado (3 barras), a portinhola da comida, os rebites
    (claros) e a ferrugem na base. a0..a1: a folha ao longo da face larga (a0 do lado esquerdo na tela).
    eixo 'x': a face larga olha para ±y; 'y': para ±x.
    """
    c0 = hx(cor)

    def f(L, n, P):
        out = np.tile(c0, (len(P), 1))
        if n[2] > 0.5 or n[2] < -0.5:
            return np.tile(_tom(c0, 1.2), (len(P), 1))
        larga = abs(n[1]) > 0.5 if eixo == 'x' else abs(n[0]) > 0.5
        if not larga:
            return out
        a = L[:, 0] if eixo == 'x' else L[:, 1]
        z = L[:, 2]
        t = (a - a0) / (a1 - a0)

        def ret(t0, t1, z0, z1):
            return (t >= t0) & (t < t1) & (z >= z0) & (z < z1)
        for (z0, z1) in ((0.14, 0.82), (1.82, 1.97)):
            r = ret(0.13, 0.87, z0, z1)
            out = np.where(r[:, None], _tom(c0, 0.9), out)
            out = np.where((r & (z >= z1 - PZ))[:, None], _tom(c0, 0.72), out)
            out = np.where((r & (z < z0 + PZ))[:, None], _tom(c0, 1.15), out)
        vz = ret(0.3, 0.7, 1.38, 1.68)
        mold = ret(0.25, 0.75, 1.34, 1.72) & ~vz
        out = np.where(mold[:, None], _tom(c0, 1.12), out)
        out = np.where(vz[:, None], hx('#0b0c0e'), out)
        for tb in (0.4, 0.5, 0.6):
            bar = vz & (np.abs(t - tb) * abs(a1 - a0) < PH * 0.75)
            out = np.where(bar[:, None], _tom(c0, 1.2), out)
        pt = ret(0.25, 0.75, 0.92, 1.02)
        out = np.where(pt[:, None], _tom(c0, 0.62), out)
        out = np.where((pt & (z >= 1.02 - PZ))[:, None], _tom(c0, 1.25), out)
        for zr in (0.06, 1.1, 2.0):
            for tr in (0.06, 0.94):
                r = (np.abs(t - tr) * abs(a1 - a0) < PH) & (z >= zr) & (z < zr + PZ)
                out = np.where(r[:, None], _tom(c0, 1.35), out)
        esc = _celula(a, np.zeros_like(z), 2 * PH, 1.0, 3)
        fer = (z < 0.1) | ((z < 0.1 + 0.25 * esc) & (esc > 0.55))
        out = np.where(fer[:, None], out * 0.62 + hx('#7a4428') * 0.38, out)
        return out
    return emissivo(f)


def _cell_door(aberta):
    """
    A porta de aço da cela, na casa inteira entre dois blocos de concreto: as ombreiras e a verga de concreto, o
    batente de aço na frente e a folha. Fechada (estado 0): no plano da frente. Aberta (estado 1): girada 90° para
    dentro, encostada na ombreira do lado de trás na tela (não tapa a passagem).
    """
    def d():
        rot = _rot()
        h = H_CELA
        m = concreto(h=h, seed=21)
        mv = concreto(cor='#8f8b83', h=h, pintura=('#525e57', 1.0), seed=22)
        J0, J1, ZV2 = 0.06, 0.69, 2.08
        o = CZ.c.novo_obj(3, contorno=False)
        CZ.c.caixa((0, J0, 0, CASA, 0, h), {'*': m, 'dir': mv}, CZ.M, o)
        CZ.c.caixa((J1, CASA, 0, CASA, 0, h), {'*': m, 'esq': mv}, CZ.M, o)
        CZ.c.caixa((J0, J1, 0, CASA, ZV2, h), m, CZ.M, o)
        CZ.pegadas.append((0, J0, 0, CASA))
        CZ.pegadas.append((J1, CASA, 0, CASA))
        BT = _pau('#3e4448', '#6a7276', quina=1.2, b=(0, 0, 0, 0, 0, ZV2))
        VF = 0.63
        for b in ((J0, J0 + 0.03, VF, CASA + 0.008, 0, ZV2), (J1 - 0.03, J1, VF, CASA + 0.008, 0, ZV2), (J0, J1, VF, CASA + 0.008, ZV2 - 0.03, ZV2)):
            _cx(b, BT)
        _cx((J0, J1, 0.0, CASA, 0.0, 0.012), {'cima': liso('#5a6064'), '*': liso('#3e4448')}, contorno=False)
        F0, F1 = J0 + 0.03, J1 - 0.03
        if not aberta:
            _cx((F0, F1, VF, VF + 0.05, 0.012, ZV2 - 0.03), aco(a0=F0, a1=F1))
            ul = F0 + 0.02 if rot == 2 else F1 - 0.1
            _cx((ul, ul + 0.08, VF + 0.05, VF + 0.085, 0.95, 1.16), ferro('#40464a', '#7a8286'))
            _cx((ul + 0.03, ul + 0.05, VF + 0.085, VF + 0.09, 1.0, 1.05), liso('#121416'))
            uh = F1 - 0.012 if rot == 2 else F0
            for z in (0.3, 1.0, 1.75):
                _cx((uh - 0.004, uh + 0.016, VF + 0.05, VF + 0.07, z, z + 0.12), ferro('#30363a', '#5a6266'))
        else:
            L = F1 - F0
            if rot == 2:
                b = (F1 - 0.05, F1, VF + 0.05 - L, VF + 0.05, 0.012, ZV2 - 0.03)
                _cx(b, aco(a0=b[2], a1=b[3], eixo='y'), sombra=False)
            else:
                b = (F0, F0 + 0.05, VF + 0.05 - L, VF + 0.05, 0.012, ZV2 - 0.03)
                _cx(b, aco(a0=b[3], a1=b[2], eixo='y'), sombra=False)
            CZ.pegadas.append(tuple(b[:4]))
    return d


# =====================================================================================================================
# pedra, escadas, alçapão, entrada
# =====================================================================================================================
def pedra(cor='#a29c8e', la=0.25, lb=0.19, seed=0, junta=None):
    """Lajes de pedra no plano de cima: a junta de 1 px, a beira clara depois dela, a escura antes da próxima, o tom de cada uma."""
    c0 = hx(cor)
    jc = hx(junta) if junta else _tom(c0, 0.6)

    def f(L, n, P):
        u, v = L[:, 0], L[:, 1]
        fila = np.floor(v / lb)
        uu = u + (fila % 2) * la * 0.5
        col = np.floor(uu / la)
        gu, gv = uu - col * la, v - fila * lb
        k = ruido(col, fila, seed + 1)
        out = np.where((k > 0.66)[:, None], _tom(c0, 1.05), np.where((k < 0.33)[:, None], _tom(c0, 0.94), c0))
        out = np.where((((gu >= PH) & (gu < 2 * PH)) | ((gv >= PH) & (gv < 2 * PH)))[:, None], _tom(out, 1.08), out)
        out = np.where(((gu >= la - PH) | (gv >= lb - PH))[:, None], _tom(out, 0.88), out)
        return np.where(((gu < PH) | (gv < PH))[:, None], jc, out)
    return emissivo(f)


def pedra_parede(cor, seed=0):
    """Pedra aparelhada na parede (o poço): fiadas de 5 px, a junta de 1 px, a beira de cima clara."""
    c0 = hx(cor)

    def f(L, n, P):
        vert, a, z = _face_info(L, n)
        if not vert:
            return np.tile(c0, (len(P), 1))
        bz, bl = 5 * PZ, 9 * PH
        fila = np.floor(z / bz)
        aa = a + (fila % 2) * bl * 0.5
        col = np.floor(aa / bl)
        ga, gz = aa - col * bl, z - fila * bz
        k = ruido(fila, col, seed)
        out = np.where((k > 0.6)[:, None], _tom(c0, 1.06), np.where((k < 0.3)[:, None], _tom(c0, 0.93), c0))
        out = np.where((gz >= bz - PZ)[:, None], _tom(out, 1.1), out)
        return np.where(((gz < PZ) | (ga < PH))[:, None], _tom(c0, 0.6), out)
    return emissivo(f)


def escuro_fundo(mat, z_topo=0.0, fundo=-1.1):
    """O material ficando escuro com a fundura (o poço): em degraus, até quase o preto."""
    def f(L, n, P):
        out = mat(L, n, P)
        z = L[:, 2]
        t = np.clip((z_topo - z) / (z_topo - fundo), 0, 1)
        k = np.where(t < 0.2, 0.86, np.where(t < 0.42, 0.64, np.where(t < 0.66, 0.42, 0.22)))
        return out * k[:, None] + (1 - k[:, None]) * np.array([14.0, 10.0, 12.0])
    return emissivo(f)


def _prisma(p0, p1, w, h, mat, oid):
    """Uma barra reta de p0 a p1 (o corrimão inclinado), de seção w (de lado) x h (de cima a baixo)."""
    p0, p1 = np.array(p0, float), np.array(p1, float)
    d = p1 - p0
    lh = math.hypot(d[0], d[1])
    s = np.array([-d[1], d[0], 0.0]) / lh
    t = np.cross(d, s)
    t = t / np.linalg.norm(t)
    if t[2] < 0:
        t = -t
    S, T = s * w / 2, t * h / 2

    def q(p, a, b):
        return tuple(p + a * S + b * T)
    dd = d / np.linalg.norm(d)
    _fp([q(p0, -1, 1), q(p1, -1, 1), q(p1, 1, 1), q(p0, 1, 1)], tuple(t), mat, oid)
    _fp([q(p0, -1, -1), q(p0, 1, -1), q(p1, 1, -1), q(p1, -1, -1)], tuple(-t), mat, oid)
    _fp([q(p0, 1, -1), q(p0, 1, 1), q(p1, 1, 1), q(p1, 1, -1)], tuple(s), mat, oid)
    _fp([q(p0, -1, -1), q(p1, -1, -1), q(p1, -1, 1), q(p0, -1, 1)], tuple(-s), mat, oid)
    _fp([q(p1, -1, -1), q(p1, 1, -1), q(p1, 1, 1), q(p1, -1, 1)], tuple(dd), mat, oid)
    _fp([q(p0, -1, -1), q(p0, -1, 1), q(p0, 1, 1), q(p0, 1, -1)], tuple(-dd), mat, oid)


DEG = ['#a0663a', '#9a6036', '#a66c3e']      # as tábuas dos degraus


def _stairs_up():
    """
    A escada que sobe (1 x 2): 5 degraus de 20 cm subindo para o fundo (o vão da porta começa no de cima, a 1 m), as
    tábuas com o bocel claro, o espelho mais escuro, a lateral fechada de tábuas e o corrimão de ferro do lado de
    trás na tela, com o pilarete de madeira no pé.
    """
    U0, U1, N, R, T = 0.05, 0.70, 5, 0.2, 0.3
    rot = _rot()
    LAT = tab2(['#7a4628', '#74422a', '#804a2c'], 0.12, '#4a2414', eixo=1, seed=61)
    o_deg = CZ.c.novo_obj(3)
    for k in range(N):
        v1 = 1.5 - T * k
        ESP_ = mad2('#6a3a20', eixo=0, seed=62 + k, passo=0.05)
        CZ.c.caixa((U0, U1, 0.0, v1 - 0.02, 0.0, R * (k + 1) - 0.03), {'frente': ESP_, 'esq': LAT, 'dir': LAT, 'costas': LAT, '*': ESP_}, CZ.M, o_deg)
        # a tábua do degrau, com o bocel saindo 2 cm (a lateral dela continua as tábuas da lateral)
        CZ.c.caixa((U0, U1, max(0.0, v1 - T - 0.02), v1, R * (k + 1) - 0.03, R * (k + 1)),
                   {'cima': tab2(DEG, 0.1, '#5a3218', eixo=0, seed=70 + k), 'esq': LAT, 'dir': LAT, 'costas': LAT,
                    '*': _pau('#8a5430', '#c08048', quina=1.2, b=(0, 0, 0, 0, 0, R * (k + 1)))}, CZ.M, o_deg)
    CZ.pegadas.append((U0, U1, 0.0, 1.5))
    # o corrimão: do lado de trás na tela (giro 4: u grande; giro 2: u pequeno)
    ur = U1 - 0.03 if rot != 2 else U0 + 0.03
    o = CZ.c.novo_obj(3)
    FE = ferro('#2c2826', '#5a524c')
    for k in range(N):
        vm = 1.5 - T * k - T / 2
        CZ.c.caixa((ur - 0.01, ur + 0.01, vm - 0.01, vm + 0.01, R * (k + 1), R * (k + 1) + 0.86), FE, CZ.M, o)
    _prisma((ur, 1.5 - T / 2 + 0.02, R + 0.88), (ur, 0.0, R * N + 0.88 + 0.06), 0.035, 0.035, FE, o)
    _cx((ur - 0.035, ur + 0.035, 1.38, 1.45, 0.0, R + 0.95), {'*': mad2('#6a3a20', eixo=1, seed=77), 'cima': liso('#a8703e')})
    _cx((ur - 0.045, ur + 0.045, 1.37, 1.46, R + 0.95, R + 0.99), _pau('#7a4628', '#c08048', quina=1.2, b=(0, 0, 0, 0, 0, R + 0.99)))


def _poco(u0, u1, v0, v1, fundo, mat_parede):
    """As paredes do poço por dentro (somem no escuro) e o fundo preto."""
    o = CZ.c.novo_obj(3, contorno=False)
    m = escuro_fundo(mat_parede, 0.0, fundo)
    _fp([(u0, v0, fundo), (u1, v0, fundo), (u1, v0, 0), (u0, v0, 0)], (0, 1, 0), m, o)
    _fp([(u0, v0, fundo), (u0, v1, fundo), (u0, v1, 0), (u0, v0, 0)], (1, 0, 0), m, o)
    _fp([(u1, v0, fundo), (u1, v0, 0), (u1, v1, 0), (u1, v1, fundo)], (-1, 0, 0), m, o)
    _fp([(u0, v1, fundo), (u0, v1, 0), (u1, v1, 0), (u1, v1, fundo)], (0, -1, 0), m, o)
    _fp([(u0, v0, fundo), (u0, v1, fundo), (u1, v1, fundo), (u1, v0, fundo)], (0, 0, 1), liso('#0e0a0b'), o)
    return o


def _degraus_descendo(u0, u1, v0, v1, n, r, mat_tab, mat_esp, fundo):
    """Os degraus que descem da frente (v1) para o fundo (v0), escurecendo."""
    t = (v1 - v0) / n
    for k in range(n):
        top = -r * (k + 1)
        if top < fundo + 0.05:
            break
        va = v1 - t * (k + 1)
        _cx((u0, u1, v0, va + t, fundo, top),
            {'cima': escuro_fundo(mat_tab, 0.0, fundo), '*': escuro_fundo(mat_esp, 0.0, fundo)}, contorno=False)


def _escada_desce():
    """
    O vão da escada que desce (1 x 2): o buraco no assoalho com o arremate de madeira, o poço escuro, os degraus
    descendo para o fundo e a balaustrada de madeira nos dois lados compridos e no fundo (a frente é a entrada).
    """
    U0, U1, V0, V1 = 0.09, 0.66, 0.1, 1.44
    FUNDO = -1.3
    _poco(U0, U1, V0, V1, FUNDO, tab2(['#6e4026', '#6a3e24'], 0.1, '#3a1c0c', eixo=1, seed=81))
    _degraus_descendo(U0, U1, V0, V1, 6, 0.19, tab2(DEG, 0.1, '#5a3218', eixo=0, seed=82), mad2('#6a3a20', eixo=0, seed=83), FUNDO)
    ARR = {'cima': mad2('#a0663a', eixo=0, seed=84, passo=0.03), '*': liso('#5a3218')}
    ARRy = {'cima': mad2('#a0663a', eixo=1, seed=85, passo=0.03), '*': liso('#5a3218')}
    _cx((0.03, CASA - 0.03, 0.03, V0, 0.0, 0.02), ARR)
    _cx((0.03, CASA - 0.03, V1, 1.5 - 0.03, 0.0, 0.02), ARR)
    _cx((0.03, U0, V0, V1, 0.0, 0.02), ARRy)
    _cx((U1, CASA - 0.03, V0, V1, 0.0, 0.02), ARRy)
    PIL = {'*': mad2('#9a5a30', eixo=1, seed=86), 'cima': liso('#c88850')}
    BAL = _pau('#b06a38', '#d08c54', quina=False)
    VB = V0 - 0.04
    for (eixo, c0, a0, a1) in (('u', 0.05, VB, V1), ('u', CASA - 0.05, VB, V1), ('v', VB, 0.05, CASA - 0.05)):
        o_bal = CZ.c.novo_obj(3)
        n = max(2, int(round((a1 - a0) / 0.12)))
        for i in range(1, n):
            a = a0 + (a1 - a0) * i / n
            b = (c0 - 0.013, c0 + 0.013, a - 0.013, a + 0.013, 0.05, 0.86) if eixo == 'u' else (a - 0.013, a + 0.013, c0 - 0.013, c0 + 0.013, 0.05, 0.86)
            CZ.c.caixa(b, BAL, CZ.M, o_bal)
            bb = (b[0] - 0.008, b[1] + 0.008, b[2] - 0.008, b[3] + 0.008, 0.4, 0.46)
            CZ.c.caixa(bb, _pau('#9a5a30', '#c88850', quina=False), CZ.M, o_bal)
        e = 0 if eixo == 'v' else 1
        rb = (c0 - 0.03, c0 + 0.03, a0, a1, 0.86, 0.92) if eixo == 'u' else (a0, a1, c0 - 0.03, c0 + 0.03, 0.86, 0.92)
        _cx(rb, {'*': mad2('#9a5a30', eixo=e, seed=87), 'cima': mad2('#c88850', eixo=e, seed=88)})
        bb = (c0 - 0.025, c0 + 0.025, a0, a1, 0.02, 0.06) if eixo == 'u' else (a0, a1, c0 - 0.025, c0 + 0.025, 0.02, 0.06)
        _cx(bb, {'*': liso('#8a4e2a'), 'cima': liso('#b07040')})
    for (u, v) in ((0.05, VB), (CASA - 0.05, VB), (0.05, V1), (CASA - 0.05, V1)):
        _cx((u - 0.035, u + 0.035, v - 0.035, v + 0.035, 0.0, 0.98), PIL, pegada=True)
        _cx((u - 0.045, u + 0.045, v - 0.045, v + 0.045, 0.98, 1.02), _pau('#8a4e2a', '#d09058', quina=1.2, b=(0, 0, 0, 0, 0, 1.02)))
    _por_cima_do_chao((U0, U1, V0, V1))


def _stairs_down():
    """A escada secreta (1 x 1): a boca de pedra no chão e os degraus de pedra descendo para o escuro."""
    U0, U1, V0, V1 = 0.12, 0.63, 0.1, 0.66
    FUNDO = -1.0
    _poco(U0, U1, V0, V1, FUNDO, pedra_parede('#7e776a', seed=92))
    _degraus_descendo(U0, U1, V0, V1, 4, 0.2, pedra('#958e80', la=0.26, lb=0.14, seed=93), liso('#6a6458'), FUNDO)
    PD = pedra('#8e877a', la=0.17, lb=0.12, seed=91)
    BOR = {'cima': PD, '*': liso('#5e584e')}
    _cx((0.04, CASA - 0.04, 0.03, V0, 0.0, 0.03), BOR)
    _cx((0.04, CASA - 0.04, V1, CASA - 0.03, 0.0, 0.03), BOR)
    _cx((0.04, U0, V0, V1, 0.0, 0.03), BOR)
    _cx((U1, CASA - 0.04, V0, V1, 0.0, 0.03), BOR)
    _por_cima_do_chao((U0, U1, V0, V1))


def _alcapao():
    """
    O alçapão (1 x 1), aberto: o quadro de madeira rente ao chão, o buraco com a escadinha descendo e a tampa de
    tábuas em pé, presa no fundo pelas dobradiças, com as ferragens e a argola.
    """
    U0, U1, V0, V1 = 0.12, 0.63, 0.12, 0.63
    FUNDO = -1.0
    _poco(U0, U1, V0, V1, FUNDO, tab2(['#5e3820', '#5a341e'], 0.09, '#2e1608', eixo=1, seed=101))
    o = CZ.c.novo_obj(3, contorno=False)
    ES = escuro_fundo(_pau('#8a5a34', '#b07a48', quina=False), 0.0, FUNDO)
    for u in (0.22, 0.51):
        CZ.c.caixa((u, u + 0.035, V0, V0 + 0.04, FUNDO, 0.0), ES, CZ.M, o)
    for k in range(4):
        z = -0.18 - 0.24 * k
        CZ.c.caixa((0.22, 0.545, V0 + 0.005, V0 + 0.035, z - 0.025, z), ES, CZ.M, o)
    QD = {'cima': mad2('#8a5a34', eixo=0, seed=102, passo=0.03), '*': liso('#4a2a16')}
    QDy = {'cima': mad2('#8a5a34', eixo=1, seed=103, passo=0.03), '*': liso('#4a2a16')}
    _cx((0.06, CASA - 0.06, 0.06, V0, 0.0, 0.025), QD)
    _cx((0.06, CASA - 0.06, V1, CASA - 0.06, 0.0, 0.025), QD)
    _cx((0.06, U0, V0, V1, 0.0, 0.025), QDy)
    _cx((U1, CASA - 0.06, V0, V1, 0.0, 0.025), QDy)
    # a tampa em pé, no fundo, presa nas dobradiças
    TP = tab2(['#8e5a32', '#86542e', '#94603a'], 0.11, '#3e2010', eixo=1, seed=104, org=U0)
    _cx((U0, U1, 0.02, 0.06, 0.025, 0.025 + (V1 - V0)), {'frente': TP, 'costas': TP, '*': _pau('#6a3e22', '#9a6438', quina=False)}, pegada=True)
    for z in (0.12, 0.4):
        _cx((U0 + 0.02, U1 - 0.02, 0.06, 0.068, z, z + 0.045), ferro('#2e2a28', '#5a524c'))
    FA = ferro('#3a3632', '#6a625a')
    _cx((0.355, 0.395, 0.068, 0.078, 0.27, 0.29), FA)
    _cx((0.34, 0.41, 0.07, 0.078, 0.19, 0.205), FA)
    _cx((0.34, 0.353, 0.07, 0.078, 0.19, 0.27), FA)
    _cx((0.397, 0.41, 0.07, 0.078, 0.19, 0.27), FA)
    _por_cima_do_chao((U0, U1, V0, V1))


def _escada_vertical():
    """
    A escada de mão presa na parede do fundo (1 x 1), subindo reto até o alçapão do teto: os dois banzos, os degraus,
    as presilhas de ferro na parede. Acima da viga ela some aos poucos (termina lá em cima).
    """
    V0, V1 = 0.07, 0.12
    BZ = {'*': mad2('#8a5432', eixo=1, seed=111, passo=0.03), 'cima': liso('#b07a48')}
    oids = []
    for u in (0.15, 0.555):
        oids.append(_cx((u, u + 0.045, V0, V1, 0.0, 3.0), BZ))
        CZ.pegadas.append((u, u + 0.045, V0, V1))
        for z in (0.45, 1.5, 2.45):
            oids.append(_cx((u - 0.01, u + 0.055, 0.0, V0 + 0.012, z, z + 0.05), ferro('#2e2a28', '#5a524c')))
    o = CZ.c.novo_obj(3)
    DG = _pau('#9a6238', '#c08a54', quina=1.15, b=(0, 0, 0, 0, 0, 0))
    for k in range(10):
        z = 0.28 + 0.28 * k
        CZ.c.caixa((0.195, 0.555, V0 + 0.008, V1 - 0.008, z, z + 0.035), DG, CZ.M, o)
    oids.append(o)
    for oid in oids:
        CZ.fades.append((oid, 2.4, 0.55))


def capacho():
    """O capacho de fibra de coco: a trama em riscas de 2 px (um tom acima e um abaixo) e os fios soltos escuros."""
    c0 = hx('#9a6a3a')

    def f(L, n, P):
        u, v = L[:, 0], L[:, 1]
        g = np.floor(v / PH) % 4
        out = np.where((g < 2)[:, None], _tom(c0, 1.07), _tom(c0, 0.93))
        k = ruido(np.floor(u / (3 * PH)), np.floor(v / (2 * PH)), 7)
        return np.where((k > 0.85)[:, None], _tom(out, 0.88), out)
    return emissivo(f)


def _entrada(larg):
    """A entrada ao ar livre: a soleira de pedra baixa (3 cm) com as lajes e, em cima, o capacho gasto de borda escura."""
    def d():
        W = larg * CASA
        PD = {'cima': pedra('#a8a092', la=0.32, lb=0.2, seed=121), '*': liso('#6e685c')}
        _cx((0.03, W - 0.03, 0.06, CASA - 0.06, 0.0, 0.03), PD, pegada=True)
        _cx((0.13, W - 0.13, 0.17, CASA - 0.17, 0.03, 0.036), liso('#4a2e18'), contorno=False)
        _cx((0.155, W - 0.155, 0.195, CASA - 0.195, 0.036, 0.04), {'cima': capacho(), '*': liso('#5a3a1e')}, contorno=False)
    return d


# =====================================================================================================================
# o catálogo
# =====================================================================================================================
ITENS = {
    'portal': (1, 1, (0.0, 0.0), _porta(0), {'1': _porta(1), '2': _porta(2)}),
    'stairs_up': (1, 2, (0.0, 0.0), _stairs_up, {}),
    'escada_desce': (1, 2, (0.0, 0.0), _escada_desce, {}),
    'stairs_down': (1, 1, (0.0, 0.0), _stairs_down, {}),
    'escada_vertical': (1, 1, (0.0, 0.0), _escada_vertical, {}),
    'alcapao': (1, 1, (0.0, 0.0), _alcapao, {}),
    'iwall': (1, 1, (0.0, 0.0), _iwall, {}),
    'iwall_low': (1, 1, (0.0, 0.0), _iwall_low, {}),
    'iwall_door': (1, 1, (0.0, 0.0), _iwall_door, {}),
    'iwall_window': (1, 1, (0.0, 0.0), _iwall_window, {}),
    'stall_panel': (1, 1, (0.0, 0.0), _stall_panel, {}),
    'cell_front': (1, 1, (0.0, 0.0), _cell_front, {}),
    'cell_door_steel': (1, 1, (0.0, 0.0), _cell_door(False), {'1': _cell_door(True)}),
    'entrada': (1, 1, (0.0, 0.0), _entrada(1), {}),
    'entrada_larga': (2, 1, (0.0, 0.0), _entrada(2), {}),
}
# a porta só tem arte nas paredes do fundo (giro 4 na 'r', giro 2 na 'l'); nas outras, o jogo desenha a soleira
SO_GIROS = {'portal': (4, 2)}
