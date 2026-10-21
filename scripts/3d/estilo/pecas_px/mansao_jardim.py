"""
GRUPO A2 da Mansão Albuquerque: o jardim e o que cerca a casa (anexo, barracão, muro, pilar, portão, estátua, topiária,
canteiro, cipreste e lampião), em pixel art 1:1 feita só por código, no acabamento da fazenda (fazenda_fora.py).

A casa grande (grupo A1) é de pedra escura (cinza-marrom) com cantaria clara e telha ferrugem: o anexo, o barracão, o
muro e o portão usam a MESMA pedra, a mesma cantaria e a mesma telha (as constantes PEDRA, CANTARIA e TELHA daqui).

Tudo desenhado no giro 4 (a frente para +y), a pegada começando em (0, 0), no tamanho congelado do pedido.

O MURO (muro_mansao) é o módulo de 1 casa que se repete em centenas de casas (em x no giro 4 e em y no giro 2) e tem de
emendar sem costura. Por isso ele é feito assim:
  - a geometria vai de x = 0 até x = 0,75 exatos, sem nada passando da casa (a emenda é a mesma em todas as casas);
  - ele NÃO usa o contorno do exportador (o contorno de 1 px na ponta de cada casa viraria uma risca escura a cada casa):
    o contorno de verdade (a base no chão e a quina de trás do capeamento) é pintado no material, só nos lados compridos;
  - o desenho das pedras casa com a vizinha: as faixas de cantaria das pontas (3 px de cada lado) se encontram numa
    junta de 1 px, como uma pilastra de duas metades, e as juntas das lajes do capeamento caem na emenda.
"""
import math
import sys

import numpy as np

import cozinha as CZ
import base_estilo as BE
import fazenda_fora as FF
from base_estilo import hx, liso, mad2, tab2, vol, _tom, _poligono_rodado, _disco, PZ, PH
from motor import ruido, suave, emissivo, MUNDO as M

CASA = 0.75
obj = FF.obj
caixa = FF.caixa
pegada = FF.pegada
pegada_redonda = FF.pegada_redonda

# =====================================================================================================================
# a paleta da mansão (a mesma da casa grande: pedra cinza-marrom escura, cantaria clara, telha ferrugem gasta)
# =====================================================================================================================
PEDRA = ['#665e54', '#5e564d', '#6f665b', '#585048']        # a pedra escura da fachada (já com a luz do giro 4 a menos)
PEDRA_J = '#38312b'
CANTARIA = ['#a39a8c', '#9a9184', '#aca392', '#948b7e']     # a cantaria clara (cunhais, capeamento, molduras)
CANTARIA_J = '#4e463d'
TELHA = ['#9a4a2c', '#a4532f', '#8e4226', '#a85c36']        # a telha ferrugem
TELHA_J = '#3e180e'
CUMEEIRA = '#8a3c22'
FERRO = '#1e1c1f'
OURO = '#b8902a'


def _hex(c):
    return '#%02x%02x%02x' % tuple(np.clip(np.round(np.asarray(c, float)), 0, 255).astype(int))


def _pz(n):
    """n pixels na vertical, em metros."""
    return n * PZ


def _ph(n):
    """n pixels ao longo de x ou de y, em metros."""
    return n * PH


def _frente_y():
    """+1 se a câmera olha o lado +y (local) da peça, -1 se olha o -y (depende do giro): qual quina comprida é a da frente."""
    v = BE.vista_local()
    return 1 if v[1] >= 0 else -1


# =====================================================================================================================
# a pedra em fiadas de pixel (o muro, o pilar): as juntas de 1 px, a luz na quina de cima e a sombra embaixo
# =====================================================================================================================
def mat_cantaria(cores, junta, z0, alt, comp, off=0.0, desloc=0.5, seed=0, suja=0, base_escura=0.0, lado=None):
    """
    Pedra em fiadas de `alt` m (use múltiplos de PZ) com blocos de `comp` m (múltiplos de PH), desencontrados de
    `desloc` do bloco a cada fiada. A junta de 1 px em baixo e no fim de cada bloco, 1 px de luz no alto, 1 px de
    sombra logo acima da junta. `suja`: px do chão que escurecem (a sujeira que o respingo da chuva deixa).
    O material é de FACE EM PÉ; no topo devolve a cor do topo.
    """
    cs = np.stack([hx(x) for x in cores])
    jc = hx(junta)

    def f(L, n, P):
        n = np.asarray(n, float)
        if abs(n[2]) > 0.5:
            return np.tile(cs[0] * 1.05, (len(L), 1))
        lat = L[:, 0] if abs(n[1]) >= abs(n[0]) else L[:, 1]
        z = L[:, 2]
        s = z - z0
        fila = np.floor(s / alt + 1e-9)
        g = s - fila * alt
        u = lat - off + (fila % 2) * comp * desloc
        col = np.floor(u / comp + 1e-9)
        gu = u - col * comp
        ids = fila * 131 + col
        out = cs[(ruido(ids * 0.37, seed + 1.3) * len(cs)).astype(int) % len(cs)]
        out = np.where(((g >= PZ) & (g < 2 * PZ))[:, None], out * 0.93, out)
        out = np.where((g >= alt - PZ)[:, None], np.minimum(out * 1.1 + 5, 255), out)
        out = np.where(((gu >= PH) & (gu < 2 * PH))[:, None], np.minimum(out * 1.05 + 2, 255), out)
        if suja:
            sj = (z < suja * PZ + 2 * PZ * ruido(np.floor(lat / (3 * PH)), 4.0 + seed))
            out = np.where(sj[:, None], out * 0.9, out)
        if base_escura:
            out = np.where((z < base_escura)[:, None], out * 0.93, out)
        out = np.where((gu < PH)[:, None], jc, out)
        out = np.where((g < PZ)[:, None], jc, out)
        return out
    return emissivo(f)


def mat_liso_junta(cor, junta, ponta=True, topo=False, caida=0.0):
    """
    Uma faixa lisa de cantaria (a cimalha, o capeamento): a cor, a junta de 1 px na ponta (x = 0, onde a laje encontra a
    da casa vizinha) e a sombra de 1 px embaixo. topo=True: é a face de cima (a junta atravessa a laje).
    """
    c0 = hx(cor)
    jc = hx(junta)

    def f(L, n, P):
        out = np.tile(c0, (len(L), 1))
        x = L[:, 0]
        if ponta:
            out = np.where((x < PH * (1.1 if topo else 1.0))[:, None], jc, out)
        return out
    return emissivo(f)


def _com_bordas(mat, base=False, topo_y=None, y_tras_escuro=True, luz_frente=True, chao_z=0.0):
    """
    O contorno que o exportador não pinta (a peça é sem contorno por causa da emenda), só nos lados compridos:
      base: 1 px escuro no pé das faces em pé (z < chao_z + PZ);
      topo_y: (ya, yb) as quinas compridas da face de cima: a de trás (contra o fundo) escura, a da frente clara.
    """
    def f(L, n, P):
        out = mat(L, n, P)
        n = np.asarray(n, float)
        if abs(n[2]) > 0.5:
            if topo_y is not None:
                ya, yb = topo_y
                fr = _frente_y()
                y = L[:, 1]
                d_tras = (y - ya) if fr > 0 else (yb - y)
                d_fre = (yb - y) if fr > 0 else (y - ya)
                if y_tras_escuro:
                    out = np.where((d_tras < 2.2 * PH)[:, None], out * 0.32 + np.array([26.0, 13.0, 11.0]), out)
                if luz_frente:
                    out = np.where(((d_fre < 2.0 * PH) & (d_fre >= 0))[:, None], np.minimum(255, out * 1.13 + 9), out)
        elif base:
            if abs(n[1]) >= abs(n[0]):
                out = np.where((L[:, 2] < chao_z + PZ)[:, None], out * 0.32 + np.array([26.0, 13.0, 11.0]), out)
        return out
    f.emissivo = True
    return f


# =====================================================================================================================
# o muro (1 x 1, 2,2 m): emenda sem costura em x (giro 4) e em y (giro 2)
# =====================================================================================================================
MURO_H = 115                 # 2,2 m, em px (115 · PZ)
MY0, MY1 = 0.175, 0.575      # a espessura do muro (0,4 m), centrada na casa


def _muro():
    """
    Ao longo de x de 0 a 0,75: o embasamento largo (0 a 26 px), duas pilastras de cantaria de 3 px nas pontas (que se
    juntam com a da casa vizinha), o painel rebaixado de pedra entre elas (2 px mais fundo que as pilastras), a cimalha
    de cima e o capeamento de lajes (que passa 2 px da parede e pinga). Tudo sem contorno do exportador.
    """
    o = obj(contorno=False)
    c = CZ.c
    R = 2 * PH * 0.0 + 0.047                      # o recuo do painel e o beiral do capeamento: 2 px
    xe = _ph(3)                                    # a pilastra de cada ponta
    zp, zb1, zb2, zc = _pz(26), _pz(32), _pz(98), _pz(106)
    zt = _pz(MURO_H)
    ya, yb = MY0, MY1
    # o embasamento: duas fiadas grandes de pedra escura, a quina de cima (o degrau) clara
    emb = mat_cantaria(PEDRA, PEDRA_J, 0.0, _pz(13), _ph(16), 0.0, 0.5, seed=11, suja=5)
    emb = _com_bordas(emb, base=True)
    topo_emb = liso(_hex(hx(CANTARIA[3]) * 0.92))
    c.caixa((0.0, CASA, ya - R, yb + R, 0.0, zp), {'*': emb, 'cima': topo_emb}, M, o)
    # as pilastras das pontas (cantaria clara em fiadas de 10 px) e o painel rebaixado de pedra escura
    pil = mat_cantaria(CANTARIA, CANTARIA_J, zp, _pz(10), _ph(12), 0.0, 0.5, seed=21)
    topo_pil = liso(_hex(hx(CANTARIA[0]) * 1.0))
    for (xa, xb) in ((0.0, xe), (CASA - xe, CASA)):
        c.caixa((xa, xb, ya, yb, zp, zc), {'*': pil, 'cima': topo_pil}, M, o)
    pan = mat_cantaria(PEDRA, PEDRA_J, zb1, _pz(11), _ph(13), xe, 0.5, seed=31)
    c.caixa((xe, CASA - xe, ya + R, yb - R, zp, zc), {'*': pan, 'cima': topo_pil}, M, o)
    # as duas cimalhas (a de baixo e a de cima do painel): faixas lisas de cantaria, de ponta a ponta
    band = mat_liso_junta(CANTARIA[1], CANTARIA_J)
    banda_topo = liso(CANTARIA[2])
    c.caixa((0.0, CASA, ya, yb, zp, zb1), {'*': band, 'cima': banda_topo}, M, o)
    c.caixa((0.0, CASA, ya, yb, zb2, zc), {'*': band, 'cima': banda_topo}, M, o)
    # o capeamento: a laje de cantaria (passa 2 px de cada lado), a junta cai na emenda
    cap = mat_liso_junta(CANTARIA[0], CANTARIA_J)
    cap_topo = _com_bordas(mat_liso_junta(CANTARIA[2], CANTARIA_J, topo=True), topo_y=(ya - R, yb + R))
    c.caixa((0.0, CASA, ya - R, yb + R, zc, zt), {'*': cap, 'cima': cap_topo}, M, o)
    pegada(0.0, CASA, ya - R, yb + R)
    return o


# =====================================================================================================================
# o pilar de pedra (1 x 1, 3 m): base larga, fuste com painéis salientes, cimalha, capitel e uma esfera de pedra
# =====================================================================================================================
def _esfera_pedra(cx, cy, z, r, cor=CANTARIA[0], lados=0):
    """A esfera de pedra: a luz do motor mais a da face (degraus), cantaria clara com 1 tom de variação em manchas."""
    c0 = hx(cor)

    def f(Pc, N, P):
        a = np.floor((P[:, 0] - P[:, 1]) / (2 * PH))
        b = np.floor((P[:, 0] + P[:, 1]) / (4 * PH) - P[:, 2] / (2 * PZ))
        s = suave(a, b, 3.0, 5)
        out = np.tile(c0, (len(P), 1))
        out = np.where((s > 0.68)[:, None], _tom(c0, 1.07), out)
        out = np.where((s < 0.3)[:, None], _tom(c0, 0.9), out)
        return out
    CZ.c.elipsoide((cx, cy, z), (r, r, r), f, obj())


def _pilar_corpo(cx, cy, larg=0.75, topo=None):
    """O pilar de pedra (a esfera ou o que vem em cima fica por conta de quem chama). Devolve a altura do capitel."""
    c = CZ.c
    h0 = larg / 2
    pil = lambda z0, a, seed: mat_cantaria(PEDRA, PEDRA_J, z0, a, _ph(14), cx - h0, 0.5, seed=seed, suja=4)
    cl = lambda z0, a, seed: mat_cantaria(CANTARIA, CANTARIA_J, z0, a, _ph(12), cx - h0, 0.5, seed=seed)
    topo_c = liso(CANTARIA[0])
    topo_p = liso(_hex(hx(CANTARIA[3]) * 0.95))
    # a base larga (duas fiadas de pedra escura) e o filete de cantaria
    o = obj()
    c.caixa((cx - h0, cx + h0, cy - h0, cy + h0, 0.0, _pz(20)), {'*': _com_bordas(pil(0.0, _pz(10), 41), base=True), 'cima': topo_p}, M, o)
    c.caixa((cx - h0 + 0.03, cx + h0 - 0.03, cy - h0 + 0.03, cy + h0 - 0.03, _pz(20), _pz(26)),
            {'*': mat_liso_junta(CANTARIA[1], CANTARIA_J, ponta=False), 'cima': topo_c}, M, o)
    # o fuste: pedra escura em fiadas de 11 px; os painéis salientes de cantaria nas quatro faces
    fu = 0.52 / 2
    zf0, zf1 = _pz(26), _pz(26 + 11 * 9)
    c.caixa((cx - fu, cx + fu, cy - fu, cy + fu, zf0, zf1), {'*': pil(zf0, _pz(11), 43), 'cima': topo_p}, M, o)
    pw = 0.32 / 2
    zp0, zp1 = _pz(26 + 11 * 2), _pz(26 + 11 * 7)
    for (a0, a1, b0, b1) in ((cx - pw, cx + pw, cy + fu, cy + fu + 0.047), (cx - pw, cx + pw, cy - fu - 0.047, cy - fu),
                             (cx + fu, cx + fu + 0.047, cy - pw, cy + pw), (cx - fu - 0.047, cx - fu, cy - pw, cy + pw)):
        c.caixa((a0, a1, b0, b1, zp0, zp1), {'*': cl(zp0, _pz(11), 47), 'cima': topo_c}, M, o)
    # a cimalha, o friso, o capitel
    o2 = obj()
    zc0 = zf1
    c.caixa((cx - 0.32, cx + 0.32, cy - 0.32, cy + 0.32, zc0, zc0 + _pz(5)), {'*': mat_liso_junta(CANTARIA[1], CANTARIA_J, ponta=False), 'cima': topo_c}, M, o2)
    c.caixa((cx - 0.28, cx + 0.28, cy - 0.28, cy + 0.28, zc0 + _pz(5), zc0 + _pz(10)), {'*': cl(zc0 + _pz(5), _pz(5), 49), 'cima': topo_c}, M, o2)
    c.caixa((cx - 0.34, cx + 0.34, cy - 0.34, cy + 0.34, zc0 + _pz(10), zc0 + _pz(15)), {'*': mat_liso_junta(CANTARIA[0], CANTARIA_J, ponta=False), 'cima': topo_c}, M, o2)
    return zc0 + _pz(15)


def _pilar():
    cx = cy = CASA / 2
    zt = _pilar_corpo(cx, cy)
    o = obj()
    CZ.c.caixa((cx - 0.1, cx + 0.1, cy - 0.1, cy + 0.1, zt, zt + _pz(3)), {'*': mat_liso_junta(CANTARIA[1], CANTARIA_J, ponta=False), 'cima': liso(CANTARIA[0])}, M, o)
    _esfera_pedra(cx, cy, zt + _pz(3) + 0.13, 0.15)
    pegada(0.0, CASA, 0.0, CASA)


# =====================================================================================================================
# o lampião do jardim (1 x 1, 3,2 m): poste de ferro preto, braço, lampião de vidro com chapéu
# =====================================================================================================================
def _lampiao(aceso=True):
    cx = cy = CASA / 2
    c = CZ.c
    fe = '#25232a'
    # o pé quadrado de ferro e a base que sobe afinando
    o = obj()
    c.caixa((cx - 0.15, cx + 0.15, cy - 0.15, cy + 0.15, 0.0, _pz(6)), {'*': liso('#1a181c'), 'cima': liso('#34323a')}, M, o)
    c.caixa((cx - 0.1, cx + 0.1, cy - 0.1, cy + 0.1, _pz(6), _pz(11)), {'*': liso('#22202a'), 'cima': liso('#3a3842')}, M, o)
    _poligono_rodado(cx, cy, [(_pz(11), 0.085), (0.34, 0.07), (0.52, 0.055), (0.62, 0.05)], vol(cx, cy, fe, brilho=0.35), obj(), lados=12,
                     tampa_mat=liso(fe))
    c.cilindro(cx, cy, 0.075, 0.5, 0.56, vol(cx, cy, fe, brilho=0.4), M, obj(), lados=12)
    c.cilindro(cx, cy, 0.036, 0.62, 2.55, vol(cx, cy, fe, brilho=0.4), M, obj(), lados=10, r1=0.03, tampa=False)
    for z in (1.15, 2.2):
        c.cilindro(cx, cy, 0.052, z, z + 0.05, vol(cx, cy, fe, brilho=0.4), M, obj(), lados=10)
    # a barra do acendedor (de ponta a ponta, com um rabo para cima e uma bolinha em cada ponta), ao longo de x
    ob = obj()
    zb = 2.3
    c.caixa((cx - 0.2, cx + 0.2, cy - 0.014, cy + 0.014, zb, zb + 0.03), liso('#2a2830'), M, ob)
    for sg in (-1, 1):
        c.caixa((cx + sg * 0.2 - 0.014, cx + sg * 0.2 + 0.014, cy - 0.014, cy + 0.014, zb, zb + 0.1), liso('#2a2830'), M, ob)
        c.elipsoide((cx + sg * 0.2, cy, zb + 0.13), (0.03, 0.03, 0.03), lambda Pc, N, P: FF._cru_eli(np.tile(hx('#3a3842'), (len(P), 1)), N), ob)
    # o encaixe, a lanterna (quatro vidros), as hastes, o chapéu e o pináculo
    _poligono_rodado(cx, cy, [(2.55, 0.034), (2.57, 0.1), (2.62, 0.115)], vol(cx, cy, fe, brilho=0.3), obj(), lados=4, tampa_mat=liso(fe))
    s = 0.12
    z0, z1 = 2.62, 3.0
    ov = obj(contorno=not aceso)
    if aceso:
        CZ.luzes.add(ov)

    def vidro(L, n, P):
        u = (P[:, 0] - cx) if abs(n[1]) > 0.5 else (P[:, 1] - cy)
        v = (P[:, 2] - z0) / (z1 - z0)
        if not aceso:
            out = np.where((v > 0.6)[:, None], hx('#4c565c'), hx('#3a4248'))
            return np.where((np.abs(v * 1.5 - u * 3.2 - 0.55) < 0.1)[:, None], hx('#8a9aa0'), out)
        r = np.maximum(np.abs(u) / s, np.abs(v - 0.45) * 2)
        return np.where((r < 0.42)[:, None], hx('#fff2c8'), np.where((r < 0.78)[:, None], hx('#ffdc7a'), hx('#f0b048')))
    c.caixa((cx - s, cx + s, cy - s, cy + s, z0, z1), emissivo(vidro), M, ov)
    og = obj()
    for (px_, py_) in ((cx - s, cy - s), (cx + s, cy - s), (cx - s, cy + s), (cx + s, cy + s)):
        c.caixa((px_ - 0.015, px_ + 0.015, py_ - 0.015, py_ + 0.015, z0 - 0.02, z1 + 0.02), liso(fe), M, og)
    c.caixa((cx - s - 0.03, cx + s + 0.03, cy - s - 0.03, cy + s + 0.03, z0 - 0.03, z0 + 0.02), {'*': liso(fe), 'cima': liso('#3a3842')}, M, og)
    _poligono_rodado(cx, cy, [(z1, s + 0.06), (z1 + 0.035, s + 0.06), (z1 + 0.15, 0.03)], vol(cx, cy, fe, brilho=0.35), obj(), lados=4)
    c.cilindro(cx, cy, 0.013, z1 + 0.15, z1 + 0.2, liso(fe), M, obj(), lados=6)
    pegada_redonda(cx, cy, 0.17, 5)


# =====================================================================================================================
# o jardim: estátua, topiária, canteiro, cipreste
# =====================================================================================================================
MARMORE = '#dcd5c6'
PEDESTAL = ['#b4ac9c', '#aba393', '#bdb5a5', '#a59d8d']
MAT_PEDRA_J = '#6e6658'


MARM_RAMPA = [hx(x) for x in ('#7e786f', '#a29c90', '#c4beb0', '#dcd6c8', '#ece7da', '#f8f4ea')]
LD_M = np.array([-0.55, 0.3, 0.8]) / np.linalg.norm([-0.55, 0.3, 0.8])


def _mat_marmore(rampa=MARM_RAMPA, seed=3):
    """
    O mármore de elipsoide: a luz pela normal em 6 degraus de uma rampa de marfim (igual em todas as peças da estátua,
    por isso os braços de esferas saem lisos) e a veia, um degrau acima em manchas de 2 px. Devolve a cor já compensada.
    """
    rp = np.stack([hx(x) if isinstance(x, str) else x for x in rampa])

    def f(Pc, N, P):
        l = np.clip(N @ LD_M, 0, 1) * 0.85 + 0.15 * (N[:, 2] * 0.5 + 0.5)
        nv = np.digitize(l, [0.22, 0.4, 0.56, 0.72, 0.86])
        a = np.floor((P[:, 0] - P[:, 1]) / (2 * PH))
        b = np.floor((P[:, 0] + P[:, 1]) / (4 * PH) - P[:, 2] / (2 * PZ))
        s = suave(a * 0.5 + b * 0.8, b * 0.3, 3.0, seed)
        nv = np.clip(np.where(s > 0.74, nv + 1, nv), 0, len(rp) - 1)
        return FF._cru_eli(rp[nv], N)
    return f


def _tubo_eli(pts, raios, mat, o):
    """Um braço de pedra: a fileira de esferas pelo caminho, de raio variando (sai liso no pixel)."""
    for k in range(len(pts) - 1):
        a, b = np.array(pts[k], float), np.array(pts[k + 1], float)
        n = max(2, int(np.linalg.norm(b - a) / 0.025))
        for j in range(n + (1 if k == len(pts) - 2 else 0)):
            t = j / n
            p = a * (1 - t) + b * t
            r = raios[k] * (1 - t) + raios[k + 1] * t
            CZ.c.elipsoide(tuple(p), (r, r, r), mat, o)


def _estatua():
    """
    A estátua de mármore (2,5 m): o pedestal de pedra clara com friso, e uma figura clássica estilizada de túnica longa
    com cinto, o braço direito levantado segurando uma coroa de louros (de frente para a câmera em todos os giros), o
    esquerdo dobrado sobre o manto caído, os cabelos presos num coque, o rosto liso.
    """
    cx = cy = CASA / 2
    c = CZ.c
    cl = lambda z0, a, seed: mat_cantaria(PEDESTAL, MAT_PEDRA_J, z0, a, _ph(14), cx - 0.3, 0.5, seed=seed)
    top = liso(PEDESTAL[2])
    o = obj()
    c.caixa((cx - 0.31, cx + 0.31, cy - 0.31, cy + 0.31, 0.0, _pz(8)), {'*': _com_bordas(cl(0.0, _pz(8), 5), base=True), 'cima': top}, M, o)
    c.caixa((cx - 0.26, cx + 0.26, cy - 0.26, cy + 0.26, _pz(8), _pz(14)), {'*': mat_liso_junta(PEDESTAL[1], MAT_PEDRA_J, ponta=False), 'cima': top}, M, o)
    zd1 = 0.66
    c.caixa((cx - 0.22, cx + 0.22, cy - 0.22, cy + 0.22, _pz(14), zd1), {'*': cl(_pz(14), _pz(11), 7), 'cima': top}, M, o)
    o2 = obj()
    c.caixa((cx - 0.285, cx + 0.285, cy - 0.285, cy + 0.285, zd1, zd1 + _pz(5)), {'*': mat_liso_junta(PEDESTAL[0], MAT_PEDRA_J, ponta=False), 'cima': top}, M, o2)
    c.caixa((cx - 0.25, cx + 0.25, cy - 0.25, cy + 0.25, zd1 + _pz(5), zd1 + _pz(9)), {'*': mat_liso_junta(PEDESTAL[2], MAT_PEDRA_J, ponta=False), 'cima': top}, M, o2)
    z0 = zd1 + _pz(9)                                   # onde a figura pisa (0,83 m)
    # a túnica: o corpo todo de uma vez (a saia que abre, o cinto, o peito) com as dobras em riscas
    def dobras(P, base):
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        w = np.sin(th * 7.0 + 1.5 * np.sin(P[:, 2] * 5.0 + 1.0))
        base = np.where((w > 0.3)[:, None], _tom(base, 0.84), base)
        base = np.where((w < -0.82)[:, None], _tom(base, 1.05), base)
        zz = P[:, 2] - z0
        cinto = (zz > 0.66) & (zz < 0.7)
        return np.where(cinto[:, None], _tom(base, 0.7), base)
    om = obj()
    perfil = [(z0, 0.215), (z0 + 0.05, 0.225), (z0 + 0.35, 0.2), (z0 + 0.6, 0.15), (z0 + 0.7, 0.13), (z0 + 0.85, 0.15), (z0 + 1.0, 0.17),
              (z0 + 1.07, 0.15)]
    _poligono_rodado(cx, cy, perfil, vol(cx, cy, '#f0eadc', faixas=dobras), om, lados=22)
    zs = z0 + 1.02                                        # a linha dos ombros
    mm = _mat_marmore(seed=4)
    oo = obj()
    c.elipsoide((cx, cy, zs + 0.01), (0.215, 0.135, 0.085), mm, oo)
    # o manto: uma volta de pano sobre o ombro esquerdo caindo pelas costas e pela frente (duas lâminas de pedra)
    c.elipsoide((cx - 0.13, cy + 0.07, zs - 0.32), (0.07, 0.08, 0.3), _mat_marmore(seed=11), oo)
    c.elipsoide((cx - 0.1, cy - 0.1, zs - 0.4), (0.07, 0.07, 0.36), _mat_marmore(seed=13), oo)
    oc = obj()
    c.elipsoide((cx, cy, zs + 0.11), (0.055, 0.055, 0.07), mm, oc)
    zh = zs + 0.26
    c.elipsoide((cx, cy, zh), (0.105, 0.115, 0.135), _mat_marmore(seed=6), oc)
    cabelo = _mat_marmore(['#6e685f', '#8e887c', '#aaa498', '#c2bcae', '#d4cec0', '#e2dcce'], seed=7)
    c.elipsoide((cx, cy - 0.04, zh + 0.04), (0.1, 0.1, 0.11), cabelo, oc)
    c.elipsoide((cx, cy - 0.12, zh - 0.02), (0.06, 0.05, 0.065), cabelo, oc)
    oa = obj()
    mb = _mat_marmore(seed=9)
    _tubo_eli([(cx + 0.2, cy, zs), (cx + 0.31, cy, zs + 0.12), (cx + 0.29, cy, zs + 0.36)], [0.072, 0.06, 0.045], mb, oa)
    c.elipsoide((cx + 0.29, cy, zs + 0.4), (0.055, 0.05, 0.06), mb, oa)
    # a coroa de louros na mão (o anel de folhas fica de frente para a câmera, em qualquer giro)
    h, rv = BE.frente_tela()
    ol = obj()
    mlau = _mat_marmore(['#8a8478', '#aaa498', '#c6c0b2', '#dad4c6', '#e8e3d6', '#f4f0e6'], seed=10)
    xc, yc, zc = cx + 0.29, cy, zs + 0.52
    for k in range(10):
        a = 2 * math.pi * k / 10
        c.elipsoide((xc + rv[0] * 0.11 * math.cos(a), yc + rv[1] * 0.11 * math.cos(a), zc + 0.11 * math.sin(a)), (0.042, 0.042, 0.042), mlau, ol)
    _tubo_eli([(cx - 0.2, cy, zs), (cx - 0.27, cy + 0.04, zs - 0.18), (cx - 0.14, cy + 0.16, zs - 0.3)], [0.072, 0.058, 0.045], mb, oa)
    c.elipsoide((cx - 0.12, cy + 0.17, zs - 0.31), (0.05, 0.05, 0.05), mb, oa)
    pegada(cx - 0.31, cx + 0.31, cy - 0.31, cy + 0.31)


FOLHA_ESC = [hx(x) for x in ('#10241a', '#193522', '#234a2c', '#2f6038', '#427a45', '#5e9654')]
FOLHA_CIP = [hx(x) for x in ('#0b1d16', '#112b1e', '#1a3d28', '#245234', '#306a41', '#428553')]


def _vaso_pedra(cx, cy, h, r, z0=0.0, seed=2):
    """O vaso de pedra clara: o pé quadrado, o bojo, o filete e a boca larga com a terra."""
    c = CZ.c
    o = obj()
    c.caixa((cx - r * 0.78, cx + r * 0.78, cy - r * 0.78, cy + r * 0.78, z0, z0 + h * 0.1),
            {'*': mat_cantaria(PEDESTAL, MAT_PEDRA_J, z0, _pz(6), _ph(10), cx - r, 0.5, seed=seed), 'cima': liso(PEDESTAL[2])}, M, o)

    def banda(P, base):
        z = P[:, 2] - z0
        base = np.where((np.abs(z - h * 0.58) < PZ * 1.2)[:, None], _tom(base, 0.78), base)
        return np.where(((z > h * 0.93) & (z < h * 0.93 + PZ * 1.2))[:, None], _tom(base, 1.12), base)
    perf = [(z0 + h * 0.1, r * 0.55), (z0 + h * 0.2, r * 0.5), (z0 + h * 0.36, r * 0.74), (z0 + h * 0.6, r * 0.97), (z0 + h * 0.8, r * 0.82),
            (z0 + h * 0.92, r * 0.86), (z0 + h, r * 0.98)]
    _poligono_rodado(cx, cy, perf, vol(cx, cy, '#a9a190', faixas=banda), obj(), lados=18, tampa_mat=liso('#2e2216'))


def _topiaria():
    cx = cy = CASA / 2
    c = CZ.c
    _vaso_pedra(cx, cy, 0.62, 0.28)
    c.cilindro(cx, cy, 0.035, 0.55, 1.0, mad2('#4a3322', eixo=1, seed=3, passo=0.04), M, obj(), lados=8, tampa=False)
    o = obj()
    R, zc = 0.37, 1.33
    mat = FF.mat_folha((cx, cy, zc), (R * 1.25, R * 1.25, R * 1.25), FOLHA_ESC, q=0.075, seed=14)
    c.elipsoide((cx, cy, zc), (R, R, R), mat, o)
    pegada_redonda(cx, cy, 0.28, 5)


def _canteiro():
    """O canteiro baixo (2 x 1, 0,55 m): a borda de cantaria, a terra, as hortênsias azuis e rosas e as rosas vermelhas."""
    c = CZ.c
    W, D = 2 * CASA, CASA
    x0, x1, y0, y1 = 0.03, W - 0.03, 0.04, D - 0.04
    e = 0.11
    zb = 0.3
    top = liso(PEDESTAL[2])
    cl = lambda seed: mat_cantaria(PEDESTAL, MAT_PEDRA_J, 0.0, _pz(8), _ph(14), x0, 0.5, seed=seed)
    o = obj()
    for (a0, a1, b0, b1) in ((x0, x1, y0, y0 + e), (x0, x1, y1 - e, y1), (x0, x0 + e, y0 + e, y1 - e), (x1 - e, x1, y0 + e, y1 - e)):
        c.caixa((a0, a1, b0, b1, 0.0, zb), {'*': _com_bordas(cl(3), base=True), 'cima': top}, M, o)
    ot = obj(contorno=False)
    c.caixa((x0 + e, x1 - e, y0 + e, y1 - e, 0.0, zb - 0.05), FF.mat_terra(5), M, ot)
    AZ = [hx(x) for x in ('#243e86', '#3354a6', '#4a6cc4', '#6a8ae0', '#8ea8ee', '#b4c6f6')]
    RS = [hx(x) for x in ('#9a4a78', '#b6618e', '#cc7ca4', '#e098bc', '#ecb4d0', '#f6d2e4')]
    VE = [hx(x) for x in ('#1b3a20', '#25502b', '#336a37', '#44853f', '#5ca04a', '#7cba5e')]
    for (x, y, pal, sd) in ((0.33, 0.28, AZ, 1), (0.75, 0.26, RS, 2), (1.17, 0.28, AZ, 3)):
        zc = zb + 0.02
        og = obj()
        c.elipsoide((x, y, zb - 0.05), (0.24, 0.17, 0.13), FF.mat_folha((x, y, zb), (0.3, 0.2, 0.2), VE, q=0.06, seed=sd + 20), og, corte_z=zb - 0.04)
        ob = obj()
        mat = FF.mat_folha((x, y, zc + 0.08), (0.28, 0.2, 0.2), pal, q=0.042, seed=sd)
        c.elipsoide((x, y, zc + 0.05), (0.24, 0.19, 0.19), mat, ob, corte_z=zb)
        for a in (-0.7, 0.2, 0.9):
            c.elipsoide((x + 0.14 * math.sin(a * 2), y + 0.07 * math.cos(a * 2) * 0.5, zc + 0.12), (0.09, 0.08, 0.09), mat, ob, corte_z=zb)
    for (x, y, sd) in ((0.5, 0.55, 4), (1.0, 0.55, 5), (0.22, 0.5, 6), (1.28, 0.5, 7)):
        orr = obj()
        mat = FF.mat_folha((x, y, zb + 0.08), (0.18, 0.15, 0.14), VE, q=0.05, seed=sd, flores=('#c8182c', '#7a0e1c'))
        c.elipsoide((x, y, zb + 0.06), (0.16, 0.13, 0.13), mat, orr, corte_z=zb)
    pegada(x0, x1, y0, y1)


def _cipreste():
    """O cipreste (1 x 1, 4,6 m): alto e estreito, em tufos que afinam para a ponta; o tronco aparece só no pé."""
    cx = cy = CASA / 2
    FF._tronco(cx, cy, 0.7, r0=0.075, r1=0.055, cor='#4a3322')
    o = obj()
    rng = np.random.default_rng(23)
    mat = FF.mat_folha((cx, cy, 2.4), (0.45, 0.45, 2.6), FOLHA_CIP, q=0.1, seed=23)
    #         z     raio  meia-altura
    tiers = [(0.8, 0.24, 0.4), (1.25, 0.3, 0.5), (1.85, 0.33, 0.62), (2.55, 0.33, 0.68), (3.2, 0.29, 0.64), (3.8, 0.22, 0.6), (4.25, 0.13, 0.5)]
    for (z, r, hz) in tiers:
        FF._cachos(o, cx, cy, z, r, hz, int(26 * r / 0.3), r * 0.2, r * 0.3, rng, mat, achata=1.5, sobe=0.5)
    CZ.c.elipsoide((cx, cy, 4.38), (0.06, 0.06, 0.22), mat, o)
    pegada_redonda(cx, cy, 0.25, 5)


# =====================================================================================================================
# o anexo e o barracão: os materiais (pedra rústica, tábua gasta, telha remendada) e as peças pequenas
# =====================================================================================================================
def _lat_tela(P):
    """A coordenada que anda para a direita na tela (no quadro da peça girada): os blocos têm juntas verticais em qualquer giro."""
    h, rv = BE.frente_tela()
    return P[:, 0] * rv[0] + P[:, 1] * rv[1]


def _fn_rustica(seed=0, alt=(8, 12), comp=(0.26, 0.5)):
    """As pedras de uma parede rústica: fiadas de altura variada (8 a 12 px) e blocos de comprimento variado."""
    rng = np.random.default_rng(seed)
    hs = rng.integers(alt[0], alt[1] + 1, 400)
    edges = np.cumsum(hs).astype(float)
    cp = rng.uniform(comp[0], comp[1], 400)
    of = rng.uniform(0, 1, 400)

    def fn(P):
        zp = P[:, 2] / PZ + 80.0
        fila = np.clip(np.searchsorted(edges, zp, side='right'), 0, 399)
        lat = _lat_tela(P)
        col = np.floor(lat / cp[fila] + of[fila])
        return (fila * 1000 + col).astype(np.int64)
    return fn


def _mancha_pedra(L, n, P, out, ids):
    """A pedra escura manchada: o escorrido da chuva em riscas finas de cima para baixo e o pé mais sujo."""
    a = _lat_tela(L)
    esc = suave(np.floor(a / (2 * PH)) * 0.5, P[:, 2] / 1.6, 1.2, 77) > 0.66
    out = np.where(esc[:, None], out * 0.88, out)
    return np.where((P[:, 2] < 0.3 + 0.12 * suave(a, 0.0, 0.3, 78))[:, None], out * 0.9, out)


def mat_pedra_rustica(seed=0):
    return FF.mat_juntas(PEDRA, _fn_rustica(seed), PEDRA_J, seed=seed + 2, extra=_mancha_pedra)


def _embasamento(B, z1, esp=0.035):
    """O pé de pedra da casa (blocos grandes e escuros, mais largos que a parede) com o filete de cantaria no alto."""
    X0, X1, Y0, Y1 = B
    m = FF.mat_juntas(PEDRA, _fn_rustica(8, alt=(11, 14), comp=(0.4, 0.6)), PEDRA_J, seed=5)
    caixa((X0 - esp, X1 + esp, Y0 - esp, Y1 + esp, 0, z1), m)
    caixa((X0 - esp - 0.02, X1 + esp + 0.02, Y0 - esp - 0.02, Y1 + esp + 0.02, z1, z1 + 0.05), liso(CANTARIA[3]))


def _cunhais(B, z1, larg=0.26, esp=0.03):
    """Os cunhais de cantaria clara nas quatro quinas (blocos que se alternam, longos e curtos, saindo da parede)."""
    X0, X1, Y0, Y1 = B
    mat = mat_cantaria(CANTARIA, CANTARIA_J, 0.0, _pz(11), larg, 0.0, 0.5, seed=17)
    topo = liso(CANTARIA[0])
    for (xa, ya) in ((X0, Y0), (X1, Y0), (X0, Y1), (X1, Y1)):
        sx = 1 if xa > (X0 + X1) / 2 else -1
        sy = 1 if ya > (Y0 + Y1) / 2 else -1
        # a face de y (comprida em x) e a face de x (comprida em y): cada uma é uma placa fina na parede
        bx0, bx1 = (xa - larg, xa) if sx > 0 else (xa, xa + larg)
        by0, by1 = (ya, ya + esp) if sy > 0 else (ya - esp, ya)
        caixa((bx0, bx1, by0, by1, 0.36, z1), {'*': mat, 'cima': topo}, contorno=True)
        cx0, cx1 = (xa, xa + esp) if sx > 0 else (xa - esp, xa)
        cy0, cy1 = (ya - larg, ya) if sy > 0 else (ya, ya + larg)
        caixa((cx0, cx1, cy0, cy1, 0.36, z1), {'*': mat, 'cima': topo})


def mat_tabuas_gastas(seed=0, larg=_pz(9), cores=None):
    """As tábuas deitadas do barracão: cinza-marrom de sol e chuva, a junta de 1 px, o veio e o escorrido."""
    cores = cores or ['#7c6e5e', '#74675a', '#867866', '#6e6254']
    base = tab2(cores, larg, '#2c251f', eixo=0, seed=seed, comp=1.3)

    def f(L, n, P):
        out = base(L, n, P)
        a, b = BE.coords(L, np.asarray(n, float))
        esc = suave(np.floor(a / (2 * PH)) * 0.5, L[:, 2] / 1.4, 1.1, 91 + seed) > 0.68
        out = np.where(esc[:, None], out * 0.9, out)
        return np.where((L[:, 2] < 0.5 + 0.1 * suave(a, 0, 0.3, 92))[:, None], out * 0.92, out)
    return emissivo(f)


class _telha_remendada:
    """Enquanto está ligado, as águas que o FF.telhado desenha ganham os remendos: grupos de telhas novas, mais claras."""

    def __init__(self, area=(0.9, 0.5), forca=0.82, seed=5, luz=1.17):
        self.area, self.forca, self.seed, self.luz = area, forca, seed, luz

    def __enter__(self):
        self.orig = FF.mat_telha
        area, forca, seed, luz = self.area, self.forca, self.seed, self.luz
        orig = self.orig

        def nova(*a, **k):
            f = orig(*a, **k)

            def g(L, n, P):
                out = f(L, n, P)
                bx = np.floor(L[:, 0] / area[0])
                bz = np.floor(L[:, 2] / area[1] + 0.37 * (bx % 2))
                rem = ruido(bx, bz, seed) > forca
                novo = np.minimum(out * luz + np.array([16.0, 9.0, 1.0]) * (luz - 1) / 0.17, 255)
                return np.where(rem[:, None], novo, out)
            g.emissivo = True
            return g
        FF.mat_telha = nova

    def __exit__(self, *e):
        FF.mat_telha = self.orig
        return False


def mat_madeira_porta(cor, a0, a1, z0, z1, ferro=True, eixo_lat=0):
    """A porta de tábuas pesadas: tábuas em pé de 5 px com a fresta, o veio, duas ferragens compridas com rebites e a argola."""
    cs = [hx(_hex(hx(cor) * k)) for k in (0.92, 1.0, 1.08)]
    fe = hx('#2a2628')

    def f(L, n, P):
        x = P[:, 0] if eixo_lat == 0 else P[:, 1]
        z = P[:, 2]
        u = (x - a0) / (5 * PH)
        col = np.floor(u)
        g = u - col
        out = np.stack(cs)[(ruido(col * 0.7, 3.3) * 3).astype(int) % 3]
        out = np.where((g < 1 / 5)[:, None], hx('#1c1612'), out)
        out = np.where(((g >= 1 / 5) & (g < 2 / 5))[:, None], out * 1.07, out)
        veio = ((np.floor(z / (2 * PZ) + col * 3) % 7) == 0) & (g > 0.5) & (g < 0.8)
        out = np.where(veio[:, None], out * 0.9, out)
        if ferro:
            h = z1 - z0
            for zc in (z0 + h * 0.2, z0 + h * 0.74):
                fita = (z > zc) & (z < zc + 4 * PZ)
                out = np.where(fita[:, None], fe, out)
                out = np.where((fita & (z >= zc + 3 * PZ))[:, None], hx('#4c464a'), out)
                reb = fita & (np.floor((x - a0) / PH) % 7 == 3) & (z > zc + PZ) & (z < zc + 3 * PZ)
                out = np.where(reb[:, None], hx('#7a7478'), out)
            # a argola de ferro (um anel de 4 px)
            am = a1 - 0.2
            d = np.hypot((x - am) / PH, (z - (z0 + h * 0.46)) / PZ)
            out = np.where(((d < 3.3) & (d > 1.7))[:, None], hx('#3a3638'), out)
        return out
    return emissivo(f)


def _porta_tabuas(B, face, a, z0, w, h, cor='#4e3a2a', ferro=True, folhas=1):
    """A porta de tábuas pesadas numa moldura de cantaria (batentes, verga alta com a pedra-chave), na fachada `face`."""
    p = FF._plano(B, face)
    bx = lambda l0, l1, e0, e1, za, zb: FF._bx(face, p, l0, l1, e0, e1, za, zb)
    a0, a1 = a - w / 2, a + w / 2
    z1 = z0 + h
    eixo_lat = 0 if face in ('+y', '-y') else 1
    mj = mat_cantaria(CANTARIA, CANTARIA_J, z0, _pz(11), 0.3, a0 - 0.2, 0.5, seed=33)
    topo = liso(CANTARIA[0])
    caixa(bx(a0 - 0.15, a0, 0, 0.07, z0, z1 + 0.04), {'*': mj, 'cima': topo})
    caixa(bx(a1, a1 + 0.15, 0, 0.07, z0, z1 + 0.04), {'*': mj, 'cima': topo})
    caixa(bx(a0 - 0.2, a1 + 0.2, 0, 0.09, z1 + 0.04, z1 + 0.24), {'*': mat_liso_junta(CANTARIA[1], CANTARIA_J, ponta=False), 'cima': topo})
    caixa(bx(a - 0.07, a + 0.07, 0.09, 0.12, z1 + 0.04, z1 + 0.24), {'*': liso(CANTARIA[2]), 'cima': topo})
    caixa(bx(a0, a1, -0.03, 0.02, z0, z1), mat_madeira_porta(cor, a0, a1, z0, z1, ferro, eixo_lat))
    # a sombra do vão, em cima, e a soleira
    caixa(bx(a0, a1, 0.0, 0.03, z1 - 0.03, z1), liso('#2a1e16'), contorno=False)


def _janela_grade(B, face, a, z0, w, h, barras=3, escuro='#16110d'):
    """A janelinha de pedra com grade de ferro: o vão escuro, as barras de ferro, a verga e o peitoril de cantaria."""
    p = FF._plano(B, face)
    bx = lambda l0, l1, e0, e1, za, zb: FF._bx(face, p, l0, l1, e0, e1, za, zb)
    a0, a1 = a - w / 2, a + w / 2
    eixo_lat = 0 if face in ('+y', '-y') else 1

    def vao(L, n, P):
        lat = P[:, 0] if eixo_lat == 0 else P[:, 1]
        v = (P[:, 2] - z0) / h
        u = (lat - a0) / w
        out = np.tile(hx(escuro), (len(P), 1))
        out = np.where(((v < 0.35) & (u > 0.3))[:, None], hx('#241c16'), out)
        return out
    caixa(bx(a0, a1, -0.04, 0.0, z0, z0 + h), emissivo(vao))
    topo = liso(CANTARIA[0])
    mj = mat_liso_junta(CANTARIA[1], CANTARIA_J, ponta=False)
    caixa(bx(a0 - 0.08, a0, 0, 0.06, z0, z0 + h), {'*': mj, 'cima': topo})
    caixa(bx(a1, a1 + 0.08, 0, 0.06, z0, z0 + h), {'*': mj, 'cima': topo})
    caixa(bx(a0 - 0.12, a1 + 0.12, 0, 0.09, z0 + h, z0 + h + 0.1), {'*': mj, 'cima': topo})
    caixa(bx(a0 - 0.13, a1 + 0.13, 0, 0.11, z0 - 0.07, z0), {'*': mj, 'cima': topo})
    ob = obj()
    for k in range(barras):
        xb = a0 + w * (k + 1) / (barras + 1)
        CZ.c.caixa(bx(xb - 0.014, xb + 0.014, 0.0, 0.03, z0, z0 + h), liso('#2c2a2e'), M, ob)
    CZ.c.caixa(bx(a0, a1, 0.0, 0.03, z0 + h * 0.5 - 0.014, z0 + h * 0.5 + 0.014), liso('#2c2a2e'), M, ob)


def _mat_ripas(cor, horizontal=True, seed=0):
    """As ripas do caixote: faixas de 4 px com a fresta, e os pés (ripas de canto) mais escuros."""
    cs = [hx(_hex(hx(cor) * k)) for k in (0.94, 1.0, 1.06)]

    def f(L, n, P):
        n = np.asarray(n, float)
        if abs(n[2]) > 0.5:
            return np.tile(hx(_hex(hx(cor) * 1.08)), (len(P), 1))
        a, b = BE.coords(L, n)
        u = b / (4.5 * PZ)
        fila = np.floor(u)
        g = u - fila
        out = np.stack(cs)[(ruido(fila * 0.9, seed + 1) * 3).astype(int) % 3]
        out = np.where((g < 1 / 4.5)[:, None], hx('#2a2018'), out)
        poste = ((a % 0.5) < 0.05) | ((a % 0.5) > 0.45)
        return np.where(poste[:, None], hx(_hex(hx(cor) * 0.8)), out)
    return emissivo(f)


def _caixote(x0, x1, y0, y1, z0, z1, cor='#7e6446', seed=0):
    o = obj()
    CZ.c.caixa((x0, x1, y0, y1, z0, z1), {'*': _mat_ripas(cor, seed=seed), 'cima': liso(_hex(hx(cor) * 1.08))}, M, o)
    # a tampa levemente maior (a ripa de cima)
    CZ.c.caixa((x0 - 0.012, x1 + 0.012, y0 - 0.012, y1 + 0.012, z1 - 0.025, z1 + 0.01), {'*': liso(_hex(hx(cor) * 0.86)), 'cima': liso(_hex(hx(cor) * 1.12))}, M, o)


def _degraus(xm, y_parede, larg, n=2, alt=0.15, prof=0.34):
    """Os degraus de pedra na frente da porta (de frente para +y): cada um mais largo e mais baixo."""
    for k in range(n):
        h = alt * (n - k)
        y1_ = y_parede + prof * (k + 1)
        mat = mat_cantaria(PEDRA + CANTARIA[:2], CANTARIA_J, 0.0, _pz(8), 0.4, xm - larg / 2, 0.5, seed=60 + k)
        topo = liso(CANTARIA[k % 2])
        caixa((xm - larg / 2 - 0.04 * k, xm + larg / 2 + 0.04 * k, y_parede - 0.02, y1_, 0.0, h), {'*': _com_bordas(mat, base=True), 'cima': topo})


# =====================================================================================================================
# o anexo de pedra (8 x 6 casas, 4,4 m): depósito e sala de armas no canto do jardim
# =====================================================================================================================
def _anexo():
    c = CZ.c
    W, D = 8 * CASA, 6 * CASA
    X0, X1, Y0, Y1 = 0.2, W - 0.2, 0.2, D - 0.7
    B = (X0, X1, Y0, Y1)
    ZE = 2.7
    ZR = 4.32
    YR = (Y0 + Y1) / 2
    BEI = 0.3
    KT = (ZR - ZE) / (YR - Y0)
    xm = 4 * CASA + CASA / 2
    PAR = mat_pedra_rustica(3)
    caixa((X0, X1, Y0, Y1, 0, ZE), PAR)
    # o embasamento de blocos grandes e o filete
    _embasamento(B, 0.4)
    _cunhais(B, ZE - 0.05)
    # a cimalha embaixo do beiral (a faixa de cantaria que corre a casa)
    caixa((X0 - 0.05, X1 + 0.05, Y0 - 0.05, Y1 + 0.05, ZE - 0.16, ZE - 0.04), {'*': mat_liso_junta(CANTARIA[1], CANTARIA_J, ponta=False), 'cima': liso(CANTARIA[0])})
    # a porta de tábuas no meio da casa 4, os degraus, a janelinha com grade (esquerda) e as frestas das empenas e do fundo
    _porta_tabuas(B, '+y', xm, 0.0, 1.05, 2.0, cor='#4e3a2a')
    _janela_grade(B, '+y', 1.55, 1.25, 0.55, 0.65, 3)
    _janela_grade(B, '+y', W - 1.55, 1.25, 0.55, 0.65, 3)
    _janela_grade(B, '-y', xm, 1.4, 0.5, 0.6, 3)
    for face in ('+x', '-x'):
        _janela_grade(B, face, (Y0 + Y1) / 2, 1.3, 0.34, 0.55, 2)
    _degraus(xm, Y1, 1.6, 2, 0.15, 0.36)
    # o telhado de duas águas (cumeeira em x) de telha ferrugem
    zb = ZE - BEI * KT
    with _telha_remendada((0.3, 0.2), 0.93, 3):
        FF.telhado(X0, X1, Y0, Y1, [(Y0 - BEI, zb), (YR, ZR), (Y1 + BEI, zb)], 'x', TELHA, TELHA_J, PAR, testeira=CANTARIA[3],
                   cumeeira=CUMEEIRA, seed=2, falta=0.0, musgo=0.0)
    # os barris e os caixotes encostados do lado de fora (à direita da porta e no canto da esquerda)
    BE.barril_cesto(xm + 1.15, Y1 + 0.35, r=0.27, h=0.8)
    BE.barril_cesto(xm + 1.62, Y1 + 0.3, r=0.25, h=0.74)
    BE.barril_cesto(xm + 1.38, Y1 + 0.78, r=0.25, h=0.62)
    _caixote(0.5, 1.15, Y1 + 0.04, Y1 + 0.58, 0.0, 0.52, seed=1)
    _caixote(0.56, 1.1, Y1 + 0.06, Y1 + 0.52, 0.52, 0.98, cor='#745c40', seed=2)
    _caixote(1.2, 1.7, Y1 + 0.04, Y1 + 0.5, 0.0, 0.46, cor='#86694a', seed=3)
    # as pedras e o mato do pé (poucos: a casa é cuidada)
    pegada(X0, X1, Y0, Y1)
    pegada(xm - 0.8, xm + 0.8, Y1, Y1 + 0.38)
    pegada(0.5, 1.7, Y1 + 0.04, Y1 + 0.58)
    pegada(xm + 0.95, xm + 1.9, Y1 + 0.08, Y1 + 1.05)


# =====================================================================================================================
# o barracão dos empregados (9 x 9 casas, 4,6 m): comprido, de tábuas gastas, telha remendada, varandinha com banco
# =====================================================================================================================
MAD_B = '#4e4034'


def _banco_madeira(x0, x1, y0, zb, prof=0.4):
    """O banco de tábuas (assento e encosto) com pés, de frente para +y, sobre o piso zb."""
    t = tab2(['#8a7a64', '#80705c', '#907e68'], 0.1, '#2a2218', eixo=0, seed=4)
    liso_ = liso('#5e5040')
    o = obj()
    CZ.c.caixa((x0, x1, y0 + 0.12, y0 + prof, zb + 0.42, zb + 0.47), {'*': liso_, 'cima': t}, M, o)
    CZ.c.caixa((x0, x1, y0, y0 + 0.05, zb + 0.5, zb + 0.95), {'*': mat_tabuas_gastas(8, _pz(7), ['#8a7a64', '#80705c', '#907e68']), 'cima': liso_}, M, o)
    for xx in (x0 + 0.06, x1 - 0.11):
        CZ.c.caixa((xx, xx + 0.05, y0 + 0.16, y0 + prof - 0.04, zb, zb + 0.42), liso_, M, o)
        CZ.c.caixa((xx, xx + 0.05, y0, y0 + 0.05, zb, zb + 0.5), liso_, M, o)


def _barracao():
    c = CZ.c
    W, D = 9 * CASA, 9 * CASA
    X0, X1, Y0, Y1 = 0.15, W - 0.15, 0.3, 4.65
    B = (X0, X1, Y0, Y1)
    ZE = 2.5
    ZR = 4.42
    YR = (Y0 + Y1) / 2
    BEI = 0.3
    KT = (ZR - ZE) / (YR - Y0)
    xm = 4 * CASA + CASA / 2
    TAB = mat_tabuas_gastas(5)
    caixa((X0, X1, Y0, Y1, 0, ZE), TAB)
    # o embasamento de pedra (a mesma da casa grande) e os esteios de canto de madeira mais escura
    _embasamento(B, 0.34)
    for (xa, ya) in ((X0, Y0), (X1, Y0), (X0, Y1), (X1, Y1)):
        caixa((xa - 0.08, xa + 0.08, ya - 0.08, ya + 0.08, 0.3, ZE), {'*': mad2('#52423a', eixo=1, seed=2, passo=0.04), 'cima': liso('#6a5a4c')})
    caixa((X0 - 0.04, X1 + 0.04, Y0 - 0.04, Y1 + 0.04, ZE - 0.14, ZE - 0.02), {'*': mad2('#4a3c32', eixo=0, seed=3, passo=0.05), 'cima': liso('#6a5a4c')})
    # a porta dupla no meio da casa 4, as janelinhas de madeira (venezianas de tábua) e a porta dos fundos
    MOL = '#6e5e4e'
    VZ = '#4a4036'
    FF.porta(B, '+y', xm, 0.0, 1.3, 2.05, '#4a3a2c', folhas=2, moldura=MOL)
    for xx in (1.25, 2.2, W - 2.2, W - 1.25):
        FF.janela(B, '+y', xx, 1.15, 0.5, 0.62, 'escuro', venez=VZ, moldura=MOL, cruz=True, peitoril=True)
    for k, yy in enumerate((1.6, 3.4)):
        FF.janela(B, '+x', yy, 1.15, 0.5, 0.62, 'escuro', venez=VZ, moldura=MOL)
        FF.janela(B, '-x', yy, 1.15, 0.5, 0.62, 'escuro', venez=VZ, moldura=MOL)
    for xx in (1.4, W - 1.4):
        FF.janela(B, '-y', xx, 1.15, 0.5, 0.62, 'escuro', venez=VZ, moldura=MOL)
    FF.porta(B, '-y', xm, 0.0, 0.95, 2.0, '#4a3a2c', folhas=1, moldura=MOL)
    # o telhado de telha ferrugem remendada
    zb = ZE - BEI * KT
    with _telha_remendada((0.6, 0.32), 0.84, 11, 1.26):
        FF.telhado(X0, X1, Y0, Y1, [(Y0 - BEI, zb), (YR, ZR), (Y1 + BEI, zb)], 'x', TELHA, TELHA_J, TAB, testeira='#5e5044',
                   cumeeira=CUMEEIRA, seed=7, falta=0.0, musgo=0.0)
    # a varandinha coberta (o piso de tábuas, quatro esteios, o telhado de uma água) com o banco
    PX0, PX1 = xm - 1.5, xm + 1.5
    PY1 = Y1 + 1.5
    ZP = 0.22
    deck = tab2(['#8a7a64', '#82725e', '#907e68'], 0.14, '#2a2218', eixo=1, seed=9, comp=1.6, org=Y1)
    caixa((PX0, PX1, Y1, PY1, 0.0, ZP), {'cima': deck, '*': mat_tabuas_gastas(12, _pz(7))})
    for xx in (PX0 + 0.12, PX1 - 0.12):
        caixa((xx - 0.07, xx + 0.07, PY1 - 0.2, PY1 - 0.06, ZP, 2.0), {'*': mad2('#52423a', eixo=1, seed=4, passo=0.04), 'cima': liso('#6a5a4c')})
        caixa((xx - 0.06, xx + 0.06, Y1 + 0.02, Y1 + 0.14, ZP, 2.2), {'*': mad2('#52423a', eixo=1, seed=5, passo=0.04), 'cima': liso('#6a5a4c')})
    caixa((PX0 + 0.02, PX1 - 0.02, PY1 - 0.21, PY1 - 0.05, 2.0, 2.12), {'*': mad2('#4a3c32', eixo=0, seed=6, passo=0.05), 'cima': liso('#6a5a4c')})
    with _telha_remendada((0.45, 0.28), 0.78, 4, 1.26):
        FF._agua_uma(PX0 - 0.1, PX1 + 0.1, PY1 + 0.12, 2.0, Y1, 2.38, TELHA, TELHA_J, musgo=0.0)
    _banco_madeira(PX0 + 0.35, PX0 + 1.5, Y1 + 0.06, ZP)
    # a lenha e o barril ao lado da varanda
    BE.barril_cesto(PX1 + 0.5, Y1 + 0.35, r=0.26, h=0.7)
    _caixote(PX0 - 0.75, PX0 - 0.2, Y1 + 0.05, Y1 + 0.55, 0.0, 0.46, seed=5)
    pegada(X0, X1, Y0, Y1)
    pegada(PX0, PX1, Y1, PY1)
    pegada(PX1 + 0.2, PX1 + 0.8, Y1 + 0.1, Y1 + 0.62)
    pegada(PX0 - 0.78, PX0 - 0.18, Y1 + 0.05, Y1 + 0.55)


# =====================================================================================================================
# o portão principal (4 x 1, 3,1 m): dois pilares grandes com lampiões de ferro e as duas folhas de ferro forjado
# =====================================================================================================================
FER = '#2a282d'
FER_T = '#3c3a42'


def _normal_lado(aberta, sg, side):
    """A normal (local) de uma face da lança, virada para um dos lados da folha."""
    if not aberta:
        return (0, side, 0)
    return (side * sg, 0, 0)


def _folha_portao(xh, sg, aberta, yc=CASA / 2):
    """
    Uma folha do portão presa no pilar em xh (sg = +1 abre para +x, -1 para -x). Fechada, corre ao longo de x; aberta, gira
    90 graus para dentro (-y), rente à face de dentro do pilar. Moldura (2 estiles, 4 travessas), as barras com ponta de
    lança e as volutas (anéis de ferro) no meio e no alto.
    """
    c = CZ.c
    L = 0.79
    e = 0.036
    o = obj(contorno=False)
    yh = 0.66                                # onde a folha aberta prende (a frente do pilar)

    def B(s0, s1, t0, t1, z0, z1):
        if not aberta:
            a, b = sorted((xh + sg * s0, xh + sg * s1))
            return (a, b, yc + t0, yc + t1, z0, z1)
        xx = xh + sg * 0.03
        a, b = sorted((yh - s0, yh - s1))
        xa, xb = sorted((xx + t0, xx + t1))
        return (xa, xb, a, b, z0, z1)

    def pt(s, t, z):
        if not aberta:
            return (xh + sg * s, yc + t, z)
        xx = xh + sg * 0.03
        return (xx + t, yh - s, z)
    ferro = {'*': liso(FER), 'cima': liso(FER_T)}
    ZT = 2.02
    for (s0, s1) in ((0.0, 0.05), (L - 0.05, L)):
        c.caixa(B(s0, s1, -e / 2, e / 2, 0.1, ZT + 0.04), ferro, M, o)
    for (z0, z1) in ((0.1, 0.18), (0.62, 0.66), (1.28, 1.32), (ZT - 0.02, ZT + 0.04)):
        c.caixa(B(0.0, L, -e / 2, e / 2, z0, z1), ferro, M, o)
    n = 7
    for k in range(n):
        s_ = 0.05 + (L - 0.1) * (k + 0.5) / n
        c.caixa(B(s_ - 0.016, s_ + 0.016, -0.014, 0.014, 0.18, ZT + 0.22), ferro, M, o)
        c.caixa(B(s_ - 0.03, s_ + 0.03, -0.013, 0.013, ZT + 0.2, ZT + 0.235), {'*': liso(FER_T), 'cima': liso('#4a4852')}, M, o)
        for side in (1, -1):
            c.face_plana([pt(s_ - 0.03, side * 0.0135, ZT + 0.235), pt(s_ + 0.03, side * 0.0135, ZT + 0.235), pt(s_, side * 0.0135, ZT + 0.35)],
                         _normal_lado(aberta, sg, side), liso('#3a3840'), M, o, dois_lados=True)
    ov = obj(contorno=False)
    for (sc, zc, r) in ((L * 0.3, 0.4, 0.11), (L * 0.7, 0.4, 0.11), (L * 0.5, 1.62, 0.13)):
        for k in range(18):
            a = 2 * math.pi * k / 18
            p = pt(sc + r * math.cos(a), 0.0, zc + r * math.sin(a))
            c.elipsoide(p, (0.02, 0.02, 0.02), lambda Pc, N, P: FF._cru_eli(np.tile(hx('#5a5862'), (len(P), 1)), N), ov)
    return o


def _brasao(xm, yc, aberta):
    """O brasão simples no meio das duas folhas (escudo de ferro com friso dourado e uma faixa), nas duas faces."""
    if aberta:
        return
    c = CZ.c
    w, h = 0.34, 0.42
    zc = 1.15
    o = obj(contorno=False)
    ouro, fundo = hx(OURO), hx('#2a1c1e')

    def esc(L, n, P):
        u = (P[:, 0] - xm) / (w / 2)
        v = (P[:, 2] - zc) / (h / 2)
        borda = np.where(v > 0, np.abs(u), np.abs(u) / np.maximum(1 - 0.85 * v * v, 0.05))
        dentro = (np.abs(u) < 1) & (np.abs(v) < 1) & (borda < 1.0)
        aro = dentro & ((borda > 0.82) | (v > 0.8))
        out = np.tile(hx(FER), (len(P), 1))
        out = np.where(dentro[:, None], fundo, out)
        out = np.where(aro[:, None], ouro, out)
        faixa = dentro & ~aro & (np.abs(u * 0.9 + v * 0.5) < 0.2)
        return np.where(faixa[:, None], ouro * 0.85, out)
    for side in (1, -1):
        y0 = yc + side * 0.018
        c.caixa((xm - w / 2, xm + w / 2, min(y0, y0 + side * 0.012), max(y0, y0 + side * 0.012), zc - h / 2, zc + h / 2),
                {'*': emissivo(esc), 'cima': liso(FER_T)}, M, o)


def _lampiao_pilar(cx, cy, z0):
    """O lampião de ferro em cima do pilar: base, quatro vidros pálidos, hastes, chapéu e pináculo."""
    c = CZ.c
    fe = '#25232a'
    s = 0.11
    o = obj()
    c.caixa((cx - s - 0.03, cx + s + 0.03, cy - s - 0.03, cy + s + 0.03, z0, z0 + 0.04), {'*': liso(fe), 'cima': liso('#3a3842')}, M, o)
    z1 = z0 + 0.04
    z2 = z1 + 0.24

    def vidro(L, n, P):
        v = (P[:, 2] - z1) / (z2 - z1)
        u = (P[:, 0] - cx) if abs(n[1]) > 0.5 else (P[:, 1] - cy)
        out = np.where((v > 0.55)[:, None], hx('#c8bc90'), hx('#b4a878'))
        return np.where((np.abs(v * 1.5 - u * 3.5 - 0.5) < 0.12)[:, None], hx('#eee4bc'), out)
    ov = obj()
    c.caixa((cx - s, cx + s, cy - s, cy + s, z1, z2), emissivo(vidro), M, ov)
    og = obj()
    for (px_, py_) in ((cx - s, cy - s), (cx + s, cy - s), (cx - s, cy + s), (cx + s, cy + s)):
        c.caixa((px_ - 0.015, px_ + 0.015, py_ - 0.015, py_ + 0.015, z1, z2 + 0.01), liso(fe), M, og)
    _poligono_rodado(cx, cy, [(z2, s + 0.05), (z2 + 0.03, s + 0.05), (z2 + 0.13, 0.03)], vol(cx, cy, fe, brilho=0.35), obj(), lados=4)
    c.cilindro(cx, cy, 0.013, z2 + 0.13, z2 + 0.18, liso(fe), M, obj(), lados=6)
    return z2 + 0.18


def _portao(aberto=False):
    c = CZ.c
    W, D = 4 * CASA, CASA
    yc = D / 2
    LP = 0.7
    for cx_ in (LP / 2, W - LP / 2):
        zt = _pilar_corpo(cx_, yc, larg=LP)
        o = obj()
        c.caixa((cx_ - 0.12, cx_ + 0.12, yc - 0.12, yc + 0.12, zt, zt + _pz(4)),
                {'*': mat_liso_junta(CANTARIA[1], CANTARIA_J, ponta=False), 'cima': liso(CANTARIA[0])}, M, o)
        _lampiao_pilar(cx_, yc, zt + _pz(4))
        pegada(cx_ - LP / 2, cx_ + LP / 2, yc - LP / 2, yc + LP / 2)
    _folha_portao(LP, 1, aberto)
    _folha_portao(W - LP, -1, aberto)
    _brasao(W / 2, yc, aberto)
    if not aberto:
        pegada(LP, W - LP, yc - 0.03, yc + 0.03)
    else:
        pegada(LP, LP + 0.06, yc - 0.45, yc + 0.35)
        pegada(W - LP - 0.06, W - LP, yc - 0.45, yc + 0.35)



ITENS = {
    'muro_mansao': (1, 1, (0.0, 0.0), _muro, {}),
    'muro_pilar': (1, 1, (0.0, 0.0), _pilar, {}),
    'lampiao_jardim': (1, 1, (0.0, 0.0), lambda: _lampiao(True), {'1': lambda: _lampiao(False)}),
    'estatua_jardim': (1, 1, (0.0, 0.0), _estatua, {}),
    'topiaria': (1, 1, (0.0, 0.0), _topiaria, {}),
    'canteiro_flores': (2, 1, (0.0, 0.0), _canteiro, {}),
    'cipreste': (1, 1, (0.0, 0.0), _cipreste, {}),
    'anexo_mansao': (8, 6, (0.0, 0.0), _anexo, {}),
    'barracao_mansao': (9, 9, (0.0, 0.0), _barracao, {}),
    'portao_mansao': (4, 1, (0.0, 0.0), lambda: _portao(False), {'1': lambda: _portao(True)}),
}
