"""
GRUPO F, "laboratório, saúde e arsenal": as peças do Laboratório, da Enfermaria, do Arsenal e da Prisão da Sede (em
uso, limpas mas velhas), da enfermaria e da sala de cirurgia do Orfanato e dos aparelhos do calabouço da Fazenda, em
pixel art 1:1 no estilo da cozinha da fazenda (agente_cozinha/cozinha.py).

Cada peça é desenhada no giro 4 (a frente para +y), com a pegada começando em (0, 0), no tamanho final do catálogo
(def.height / 1,633 em metros; o `aumento` já entra). O exportador (exportar_px.py) gira e faz o acabamento.

Decisões (o que o catálogo deixava em aberto):
  - stool_lab, stool_metal, toilet_steel: o `height` é a altura do ASSENTO.
  - flasks, med_tray, vitals_monitor: desenhados no chão da casa (z = 0); o jogo empilha em cima do tampo.
  - estados: monitores 0 = ligado, '1' = desligado; baú e armários 0 = fechado, '1' = aberto (como a arte antiga);
    bed_curtain 0 = fechada (o pano nos três lados), '1' = aberta (franzida nos cantos de trás; o fundo é o lado
    `aberto`, sem pano). O trilho fica a 2,2 m, preso no teto por hastes que sobem e somem.
  - posto_enfermagem: o def não tem `vazio`; o balcão em L ocupa o fundo inteiro e desce pela esquerda até a frente.
  - mesas (contenção, vidro, arsenal): só tampo e pernas nas quinas (nada embaixo); a de vão 'fundo' tem o painel
    de trás.
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
import casa as CA
from base_estilo import (hx, liso, mad2, tab2, vol, _tom, _pau, _barra, _p1_malha, _poligono_rodado, _disco, _fita,
                         PH, PZ)
from motor import emissivo, ruido, suave, KX, KZ

M = BE.M
CASA = 0.75
UN = 1.633                      # unidades do jogo por metro


def C():
    return CZ.c


def caixa(b, mat, ch=0.0):
    return CZ.caixa(b, mat, tipo=3, sombra=False, ch=ch)


def peg(x0, x1, y0, y1):
    CZ.pegadas.append((x0, x1, y0, y1))


def novo(contorno=True, sombra=True):
    return C().novo_obj(3, contorno=contorno, sombra=sombra)


def luz_obj():
    o = C().novo_obj(3, contorno=False, sombra=False)
    CZ.luzes.add(o)
    return o


# =====================================================================================================================
# as cores (rampas curtas; o desgaste puxa um tom)
# =====================================================================================================================
INOX, INOX_T, INOX_E = '#a7aeb0', '#c4cacb', '#6e7476'
ESMALTE, ESMALTE_E = '#d6d1c2', '#a8a294'          # o branco de hospital, velho (creme)
OLIVA, OLIVA_C, OLIVA_E = '#59603a', '#6f774a', '#3e4428'
CINZA_A, CINZA_A_E = '#7a8486', '#566062'           # o aço cinza dos armários
AZUL_A = '#62727e'                                  # o aço azulado do vestiário
PRETO = '#2c2e30'
CROMO = ('#9aa4a8', '#e2e8ea')
MENTA, MENTA_E, MENTA_C = '#8cbaa4', '#6a9884', '#a8d0bc'
TELA_V = '#5ef0a0'


# =====================================================================================================================
# os materiais
# =====================================================================================================================
def _uv(n, P):
    """As coordenadas na face: (x, y) no topo, (x, z) na face ±y, (y, z) na face ±x."""
    if abs(n[2]) > 0.5:
        return P[:, 0], P[:, 1]
    if abs(n[1]) >= abs(n[0]):
        return P[:, 0], P[:, 2]
    return P[:, 1], P[:, 2]


def _lado(n):
    if n[2] > 0.5:
        return 't'
    if n[2] < -0.5:
        return 'b'
    if abs(n[1]) >= abs(n[0]):
        return 'f' if n[1] > 0 else 'c'
    return 'd' if n[0] > 0 else 'e'


def _ret(a, b, a0, a1, z0, z1):
    return (a >= a0) & (a < a1) & (b >= z0) & (b < z1)


def _moldura(a, b, a0, a1, z0, z1, ea=PH, eb=PZ):
    d = _ret(a, b, a0, a1, z0, z1)
    return d & ((a < a0 + ea) | (a >= a1 - ea) | (b < z0 + eb) | (b >= z1 - eb))


def pintar_paineis(out, a, b, lado, paineis, c0):
    """
    Os painéis desenhados numa face: (lado, tipo, a0, a1, z0, z1) com lado 'f' (+y), 'c' (-y), 'd' (+x), 'e' (-x) e
    't' (topo, a/b = x/y). Tipos: 'porta' (a fresta escura, a luz em cima e à esquerda, a sombra embaixo e à direita),
    'grade' (as venezianas: a fenda escura e o lábio claro, a cada 3 px), 'placa' (a plaquinha clara sem texto),
    'fresta' (só a fresta), '#rrggbb' (pinta o retângulo), 'cruz:#rrggbb' (a cruz da saúde).
    """
    fr = _tom(c0, 0.42)
    for (ld, k, a0, a1, z0, z1) in paineis:
        if ld != lado:
            continue
        d = _ret(a, b, a0, a1, z0, z1)
        if not d.any():
            continue
        if k in ('porta', 'fresta'):
            borda = _moldura(a, b, a0, a1, z0, z1)
            if k == 'porta':
                luz = d & ~borda & ((b >= z1 - 2 * PZ) | (a < a0 + 2 * PH))
                som = d & ~borda & ((b < z0 + 2 * PZ) | (a >= a1 - 2 * PH))
                out = np.where(luz[:, None], _tom(out, 1.1), out)
                out = np.where(som[:, None], _tom(out, 0.86), out)
            out = np.where(borda[:, None], fr, out)
        elif k == 'grade':
            g = np.floor((b - z0) / PZ) % 3
            out = np.where((d & (g == 0))[:, None], _tom(c0, 0.38), out)
            out = np.where((d & (g == 1))[:, None], _tom(c0, 1.18), out)
        elif k == 'placa':
            out = np.where(d[:, None], hx('#d8d2be'), out)
            out = np.where(_moldura(a, b, a0, a1, z0, z1)[:, None], hx('#8a8474'), out)
        elif k.startswith('cruz:'):
            cc = hx(k[5:])
            ma, mb = (a0 + a1) / 2, (z0 + z1) / 2
            wa, wb = (a1 - a0) / 6, (z1 - z0) / 6
            cr = d & (((np.abs(a - ma) < wa) & (np.abs(b - mb) < 3 * wb)) | ((np.abs(b - mb) < wb) & (np.abs(a - ma) < 3 * wa)))
            out = np.where(cr[:, None], cc, out)
        else:
            out = np.where(d[:, None], hx(k), out)
    return out


def chapa(cor, riscas='v', seed=0, k=(1.05, 0.95), passo=0.07, gasto=0.0, topo=None, paineis=(), manchas=None, extra=None):
    """
    A chapa de metal (pintada ou escovada): a cor e riscas compridas de 1 px um tom acima e abaixo ('v' em pé, 'h'
    deitadas); gasto: as manchas de uso em blocos de 2 px; paineis: os painéis de pintar_paineis; manchas:
    (cor, força, escala) as manchas de ferrugem ou de sujeira; extra(out, a, b, lado, P).
    """
    c0 = hx(cor)
    ct = hx(topo) if topo else c0

    def f(L, n, P):
        lado = _lado(n)
        top = lado in 'tb'
        a, b = _uv(n, P)
        base = ct if top else c0
        out = np.tile(base, (len(P), 1))
        if riscas:
            if top:
                t, s, esp = (a, b, PH) if riscas == 'h' else (b, a, PH)
            else:
                t, s, esp = (a, b, PZ) if riscas == 'h' else (b, a, PH)
            r1 = BE._riscas(t, s, passo, esp, seed, comp=0.3, frac=0.5)
            r2 = BE._riscas(t + 0.11, s + passo * 0.5, passo, esp, seed + 7, comp=0.3, frac=0.35)
            out = np.where(r1[:, None], _tom(base, k[0]), out)
            out = np.where((r2 & ~r1)[:, None], _tom(base, k[1]), out)
        if gasto:
            g = suave(np.floor(a / (2 * PH)) * 2 * PH, np.floor(b / (2 * PZ)) * 2 * PZ, 0.09, seed + 3)
            out = np.where((g > 1 - gasto)[:, None], _tom(out, 0.9), out)
        if manchas:
            mc, mf, me = manchas
            g = suave(np.floor(a / (2 * PH)) * 2 * PH + seed, np.floor(b / (2 * PZ)) * 2 * PZ, me, seed + 11)
            out = np.where((g > 1 - mf)[:, None], out * 0.45 + hx(mc) * 0.55, out)
            out = np.where((g > 1 - mf * 0.5)[:, None], out * 0.6 + hx(mc) * 0.4 * 0.7, out)
        if paineis:
            out = pintar_paineis(out, a, b, lado, paineis, base)
        if extra is not None:
            out = extra(out, a, b, lado, P)
        return out
    return emissivo(f)


def vidro_mat(cor='#b4d2d0'):
    """O vidro chapado (o tampo, o visor): o tom claro e os reflexos em diagonal de 2 e 1 px."""
    c0 = hx(cor)

    def f(L, n, P):
        a, b = _uv(n, P)
        g = np.floor(a / PH) + np.floor(b / (PH if abs(n[2]) > 0.5 else PZ))
        out = np.tile(c0, (len(P), 1))
        out = np.where(((g % 19) < 2)[:, None], _tom(c0, 1.25), out)
        out = np.where(((g % 19) == 4)[:, None], _tom(c0, 1.15), out)
        return out
    return emissivo(f)


def tubo(b, cor=CROMO[0], topo=CROMO[1], oid=None):
    """O tubo fino de metal (a barra com a quina clara)."""
    return _barra(b, cor, topo, oid=oid, quina=1.3)


def tubo_x(x0, x1, y, z, r=PH, cor=CROMO[0], topo=CROMO[1], oid=None):
    return tubo((x0, x1, y - r, y + r, z - r * 0.8, z + r * 0.8), cor, topo, oid)


def tubo_y(y0, y1, x, z, r=PH, cor=CROMO[0], topo=CROMO[1], oid=None):
    return tubo((x - r, x + r, y0, y1, z - r * 0.8, z + r * 0.8), cor, topo, oid)


def poste(x, y, z0, z1, r=0.014, cor='#a8b0b4', brilho=0.6, oid=None):
    o = novo() if oid is None else oid
    C().cilindro(x, y, r, z0, z1, vol(x, y, cor, brilho=brilho), M, o, lados=10, tampa_mat=liso(cor))
    return o


def rodinha(x, y, r=0.03, cor='#2a2a2c'):
    """O rodízio: o garfo cromado e a roda preta (vista de lado: um disco baixo)."""
    o = novo()
    C().cilindro(x, y, r, 0.0, r * 1.6, vol(x, y, cor), M, o, lados=10, tampa_mat=liso('#4a4a4c'))
    C().cilindro(x, y, r * 0.45, r * 1.6, r * 2.4, vol(x, y, '#a8b0b4', brilho=0.5), M, o, lados=8, tampa_mat=liso('#c8d0d2'))


def anel(cx, cy, r, z0, z1, mat, oid, lados=20):
    """O anel (a faixa em volta, aberta em cima e embaixo): as faces dos dois lados (vê-se a parte de dentro atrás)."""
    for i in range(lados):
        a0 = 2 * math.pi * i / lados
        a1 = 2 * math.pi * (i + 1) / lados
        am = (a0 + a1) / 2
        p0 = (cx + r * math.cos(a0), cy + r * math.sin(a0))
        p1 = (cx + r * math.cos(a1), cy + r * math.sin(a1))
        C().face_plana([(p0[0], p0[1], z0), (p1[0], p1[1], z0), (p1[0], p1[1], z1), (p0[0], p0[1], z1)],
                       (math.cos(am), math.sin(am), 0), mat, M, oid, dois_lados=True)


def estrela(cx, cy, r, z0, z1, cor='#3a3c3e', rodas=True):
    """A base em cruz de quatro braços (cadeira, suporte de soro, monitor) com os rodízios nas pontas."""
    m = {'cima': liso(_hexs(_tom(hx(cor), 1.25))), '*': chapa(cor, riscas=None)}
    e = 0.022
    caixa((cx - r, cx + r, cy - e, cy + e, z0, z1), m)
    caixa((cx - e, cx + e, cy - r, cy + r, z0, z1), m)
    if rodas:
        for (a, b) in ((cx - r + 0.02, cy), (cx + r - 0.02, cy), (cx, cy - r + 0.02), (cx, cy + r - 0.02)):
            rodinha(a, b, 0.022)


def _hexs(c):
    c = np.clip(np.round(np.asarray(c, float)), 0, 255).astype(int)
    return '#%02x%02x%02x' % tuple(c)


def frasco(x, y, z, perfil, liq, nivel, vid='#cfe2e0', rolha=None, boca=None, lados=16):
    """
    O frasco de vidro: o perfil [(z, r)] relativo a z; abaixo de `nivel` (m acima de z) o líquido, acima o vidro
    claro; a risca de brilho do vidro. rolha: a cor da rolha/tampa no topo.
    """
    lc, vc = hx(liq), hx(vid)

    def faixas(P, base):
        zz = P[:, 2] - z
        out = np.where((zz < nivel)[:, None], lc, vc)
        out = np.where(((zz >= nivel - PZ) & (zz < nivel))[:, None], _tom(lc, 1.3), out)
        return out
    o = novo()
    pts = [(z + a, r) for (a, r) in perfil]
    _poligono_rodado(x, y, pts, vol(x, y, vid, brilho=0.6, faixas=faixas), o, lados=lados,
                     tampa_mat=liso(rolha if rolha else _hexs(_tom(vc, 0.8))))
    return o


def tubo_ensaio(x, y, z, h, liq, nivel=0.5, r=PH):
    """O tubo de ensaio (2 px): o vidro claro em cima, o líquido embaixo, a boca."""
    def f(L, n, P):
        zz = P[:, 2] - z
        out = np.where((zz < h * nivel)[:, None], hx(liq), hx('#d6e8e6'))
        return out
    o = novo()
    C().caixa((x - r, x + r, y - r, y + r, z, z + h), {'cima': liso('#eef6f4'), '*': emissivo(f)}, M, o)


def tela_mat(liga=True, seed=0, ondas=None, a0=0.0, a1=1.0, b0=0.0, b1=1.0, lado='f'):
    """
    A tela do monitor (na face 'f' ou 'd'): ligada, o fundo verde-escuro com a grade, as linhas de onda (verde, a do
    batimento com o pico; amarela; ciano) e os números em blocos; desligada, o vidro escuro com o reflexo.
    ondas: [(cor, z relativo 0..1, tipo)] tipo 'ecg', 'seno', 'serra'.
    """
    ondas = ondas or [(TELA_V, 0.72, 'ecg'), ('#f0d24a', 0.42, 'seno'), ('#5ad8f0', 0.18, 'serra')]

    def f(L, n, P):
        a, b = _uv(n, P)
        u = (a - a0) / max(1e-6, a1 - a0)
        v = (b - b0) / max(1e-6, b1 - b0)
        ia = np.floor((a - a0) / PH)
        if not liga:
            out = np.tile(hx('#2c3634'), (len(P), 1))
            g = ia + np.floor((b - b0) / PZ)
            out = np.where(((g % 14) < 2)[:, None], hx('#46524f'), out)
            return out
        out = np.tile(hx('#0e2a20'), (len(P), 1))
        grade = (ia % 6 == 0) | (np.floor((b - b0) / PZ) % 5 == 0)
        out = np.where(grade[:, None], hx('#16382a'), out)
        alt = (b1 - b0) / PZ
        for (cor, zc, tp) in ondas:
            x = ia
            if tp == 'ecg':
                ph = x % 22
                yv = np.where(ph == 8, 6, np.where(ph == 9, -3, np.where(ph == 7, 1, np.where((ph > 13) & (ph < 17), 1, 0))))
            elif tp == 'seno':
                yv = np.round(1.6 * np.sin(x * 0.45))
            else:
                yv = np.round((x % 9) / 3.0) - 1
            yz = np.floor((b - b0) / PZ) - np.round(zc * alt)
            hit = (u < 0.7) & (np.abs(yz - yv) < 0.6)
            # o pico do ecg: a linha em pé
            if tp == 'ecg':
                hit |= (u < 0.7) & (ph == 8) & (yz >= 0) & (yz <= 6)
                hit |= (u < 0.7) & (ph == 9) & (yz <= 0) & (yz >= -3)
            out = np.where(hit[:, None], hx(cor), out)
        # os números (blocos de 2 px à direita, sem texto)
        for i, (cor, zc, tp) in enumerate(ondas):
            nb = (u > 0.76) & (u < 0.95) & (np.abs(np.floor((b - b0) / PZ) - np.round(zc * alt)) < 2.5)
            nb &= (ia % 3 != 2)
            out = np.where(nb[:, None], _tom(hx(cor), 0.95), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# o laboratório: as bancadas, os frascos, a impressora 3D, a mesa de vidro, a banqueta
# =====================================================================================================================
BANC = '#c2c0ae'          # o corpo das bancadas (esmalte cinza-creme de laboratório, velho)
EPOXI = '#2e3134'         # o tampo preto


def _tampo_epoxi(seed=0):
    c0 = hx(EPOXI)

    def f(L, n, P):
        a, b = _uv(n, P)
        out = np.tile(c0, (len(P), 1))
        r1 = BE._riscas(a, b, 0.09, PH, seed, comp=0.25, frac=0.35)
        out = np.where(r1[:, None], _tom(c0, 1.12), out)
        g = suave(np.floor(a / (2 * PH)) * 2 * PH, np.floor(b / (2 * PH)) * 2 * PH, 0.14, seed + 2)
        out = np.where((g > 0.8)[:, None], _tom(c0, 1.07), out)
        return out
    return emissivo(f)


def _modulos(x0, x1, z0, z1, n, lado):
    """As portas e as gavetas de uma fileira de módulos: cada um com a gaveta em cima e a porta embaixo."""
    pain = []
    xs = np.linspace(x0, x1, n + 1)
    zg = z1 - 0.15
    for i in range(n):
        a0, a1 = xs[i] + 0.012, xs[i + 1] - 0.012
        if i % 3 == 2:
            zz = np.linspace(z0 + 0.01, z1 - 0.01, 4)
            for j in range(3):
                pain.append((lado, 'porta', a0, a1, zz[j] + 0.006, zz[j + 1] - 0.006))
        else:
            pain.append((lado, 'porta', a0, a1, zg + 0.006, z1 - 0.01))
            pain.append((lado, 'porta', a0, a1, z0 + 0.01, zg - 0.006))
    return pain, xs, zg


def _puxadores(xs, z0, z1, zg, y, sentido, n):
    for i in range(n):
        a0, a1 = xs[i], xs[i + 1]
        m = (a0 + a1) / 2
        if i % 3 == 2:
            zz = np.linspace(z0 + 0.01, z1 - 0.01, 4)
            for j in range(3):
                zc = zz[j + 1] - 0.05
                _barra((m - 0.05, m + 0.05, *_yp(y, sentido), zc - PZ * 0.6, zc + PZ * 0.6), CROMO[0], CROMO[1], quina=False)
        else:
            zc = z1 - 0.06
            _barra((m - 0.05, m + 0.05, *_yp(y, sentido), zc - PZ * 0.6, zc + PZ * 0.6), CROMO[0], CROMO[1], quina=False)
            zc = zg - 0.06
            xx = a1 - 0.06 if i % 2 == 0 else a0 + 0.06
            _barra((xx - PH * 0.6, xx + PH * 0.6, *_yp(y, sentido), zc - 0.08, zc), CROMO[0], CROMO[1], quina=False)


def _yp(y, s):
    return (y, y + 0.018) if s > 0 else (y - 0.018, y)


def bancada(n_casas, tipo):
    """
    A bancada de laboratório (0,92 m): o rodapé preto recuado, o corpo de esmalte com as gavetas e as portas, o tampo
    de epóxi preto saliente. 'curta': a cuba com a torneira de pescoço; 'parede': a prateleira de reagentes atrás;
    'ilha': as portas dos dois lados, a prateleira no meio e o microscópio.
    """
    w = n_casas * CASA
    x0, x1, y0, y1 = 0.02, w - 0.02, 0.05, 0.7
    zt = 1.5 / UN
    tp = 0.04
    zr = 0.09
    nm = n_casas if n_casas > 2 else 2
    pf, xs, zg = _modulos(x0 + 0.02, x1 - 0.02, zr, zt - tp, nm, 'f')
    pc = []
    if tipo == 'ilha':
        pc, _, _ = _modulos(x0 + 0.02, x1 - 0.02, zr, zt - tp, nm, 'c')
    lat = [(ld, 'fresta', y0 + 0.03, y1 - 0.03, zr + 0.02, zt - tp - 0.02) for ld in ('d', 'e')]
    caixa((x0 + 0.03, x1 - 0.03, y0 + 0.04, y1 - 0.05, 0.0, zr), chapa('#26282a', riscas=None))
    caixa((x0, x1, y0, y1, zr, zt - tp), chapa(BANC, seed=3, k=(1.03, 0.97), passo=0.11, gasto=0.06, paineis=pf + pc + lat))
    _puxadores(xs, zr, zt - tp, zg, y1, 1, nm)
    if tipo == 'ilha':
        _puxadores(xs, zr, zt - tp, zg, y0, -1, nm)
    caixa((x0 - 0.015, x1 + 0.015, y0 - (0.015 if tipo == 'ilha' else 0.0), y1 + 0.025, zt - tp, zt),
          {'cima': _tampo_epoxi(seed=n_casas), '*': chapa('#3a3d40', riscas=None)})
    peg(x0, x1, y0, y1)
    if tipo == 'curta':
        # a cuba (o fundo preto rebaixado, a borda) e a torneira de pescoço de ganso com as duas manoplas
        cx, cy = x1 - 0.42, 0.38
        o = novo()
        C().face_plana(CA._ret_redondo(cx, cy, 0.2, 0.16, 0.03, zt + 0.002), (0, 0, 1),
                       CA.bacia(cx, cy, 0.2, 0.16, 0.03, zt + 0.002, aro=0.03, agua=False, esmalte='#a4acb0'), M, o)
        caixa((cx - 0.21, cx + 0.21, cy - 0.17, cy + 0.17, zt, zt + 0.002), liso('#7a8286'))
        tx, ty = cx, y0 + 0.06
        poste(tx, ty, zt, zt + 0.3, 0.014, '#9aa4a8')
        tubo_y(ty, ty + 0.14, tx, zt + 0.3, r=0.014)
        tubo((tx - 0.014, tx + 0.014, ty + 0.12, ty + 0.15, zt + 0.22, zt + 0.3))
        for dx in (-0.1, 0.1):
            poste(tx + dx, ty, zt, zt + 0.07, 0.012, '#9aa4a8')
            _barra((tx + dx - 0.035, tx + dx + 0.035, ty - 0.01, ty + 0.01, zt + 0.07, zt + 0.07 + 2 * PZ), '#c83a2e' if dx < 0 else '#3a6ab8', quina=False)
        # o frasco lavador e a estante de tubos no canto esquerdo
        frasco(x0 + 0.16, 0.2, zt, [(0, 0.04), (0.12, 0.04), (0.15, 0.02), (0.17, 0.008)], '#e8f0f0', 0.09, '#e6eeee', rolha='#d84a3a')
        _estante_tubos(x0 + 0.3, x0 + 0.62, 0.16, zt, seed=1)
    elif tipo == 'parede':
        caixa((x0 + 0.04, x1 - 0.04, y0 + 0.005, y0 + 0.03, zt, zt + 0.14), chapa(BANC, riscas=None, topo='#d8d6c6'))
        _prateleira_reagentes(x0 + 0.04, x1 - 0.04, y0 + 0.03, y0 + 0.17, zt, zt + 0.52, seed=2)
        # as torneirinhas de gás no espelho
        for xx in np.linspace(x0 + 0.4, x1 - 0.4, 4):
            _torneira_gas(xx, y0 + 0.17, zt + 0.08)
        frasco(x0 + 0.62, 0.42, zt, [(0, 0.05), (0.1, 0.05), (0.13, 0.02), (0.18, 0.02)], '#58b06a', 0.07)
        frasco(x0 + 0.78, 0.48, zt, [(0, 0.035), (0.14, 0.035), (0.15, 0.02), (0.16, 0.02)], '#e0b040', 0.08)
        _estante_tubos(x1 - 0.9, x1 - 0.55, 0.36, zt, seed=4)
        _caderno(x1 - 0.42, x1 - 0.12, 0.3, 0.6, zt)
    else:
        _prateleira_reagentes(x0 + 0.25, x1 - 0.25, 0.3, 0.45, zt, zt + 0.5, seed=5, dupla=True)
        _microscopio(x0 + 0.5, 0.58, zt)
        _estante_tubos(x1 - 0.75, x1 - 0.45, 0.6, zt, seed=6)
        frasco(x1 - 0.25, 0.6, zt, [(0, 0.06), (0.04, 0.06), (0.13, 0.02), (0.18, 0.02)], '#8a50b0', 0.06)


def _prateleira_reagentes(x0, x1, y0, y1, zb, zt, seed=0, dupla=False):
    """O espelho de reagentes: os dois montantes de aço, a prateleira de cima com os frascos âmbar e brancos."""
    for xx in (x0, x1 - 0.03):
        caixa((xx, xx + 0.03, y0, y1, zb, zt), chapa(CINZA_A, riscas=None, topo='#9aa2a4'))
    if dupla:
        caixa((x0 + 0.03, x1 - 0.03, (y0 + y1) / 2 - 0.01, (y0 + y1) / 2 + 0.01, zb, zb + 0.2), chapa(CINZA_A_E, riscas='h', seed=seed))
    zs = zt - 0.03
    caixa((x0, x1, y0, y1, zs, zt), {'cima': liso('#9aa2a4'), '*': chapa(CINZA_A, riscas=None)})
    xs = np.arange(x0 + 0.07, x1 - 0.05, 0.085)
    for i, xx in enumerate(xs):
        r = ruido(i, seed)
        cy = (y0 + y1) / 2
        if r < 0.4:
            frasco(xx, cy, zt, [(0, 0.03), (0.09, 0.03), (0.11, 0.015), (0.13, 0.015)], '#6a3010', 0.1, '#8a4a1a', rolha='#2a2a2a')
        elif r < 0.7:
            o = novo()
            C().cilindro(xx, cy, 0.03, zt, zt + 0.1, vol(xx, cy, '#e6e2d8'), M, o, lados=12, tampa_mat=liso('#3a6ab8' if r < 0.55 else '#c83a2e'))
        elif r < 0.85:
            frasco(xx, cy, zt, [(0, 0.032), (0.07, 0.032), (0.09, 0.016), (0.12, 0.016)], '#4a8ac0', 0.06)
        # (r >= 0.85: o vão)


def _torneira_gas(x, y, z):
    _barra((x - 0.015, x + 0.015, y, y + 0.05, z - 0.015, z + 0.015), '#b8862e', '#e8c060', quina=False)
    _barra((x - 0.03, x + 0.03, y + 0.02, y + 0.035, z + 0.015, z + 0.015 + 2 * PZ), '#c83a2e', quina=False)


def _estante_tubos(x0, x1, y, z, seed=0, fileiras=1):
    """A estante de tubos de ensaio de arame: a base e a régua furada, os tubos com líquidos de cores."""
    caixa((x0, x1, y - 0.04, y + 0.04, z, z + 0.015), chapa('#d8d4c8', riscas=None))
    for xx in (x0, x1 - 0.015):
        caixa((xx, xx + 0.015, y - 0.04, y + 0.04, z, z + 0.09), liso('#d8d4c8'))
    caixa((x0, x1, y - 0.04, y + 0.04, z + 0.075, z + 0.09), {'cima': liso('#ece8dc'), '*': liso('#c8c4b8')})
    cores = ['#d84a3a', '#58b06a', '#e0b040', '#4a8ac0', '#8a50b0', '#e88a3a']
    for j in range(fileiras):
        yy = y + (j - (fileiras - 1) / 2) * 0.05
        for i, xx in enumerate(np.arange(x0 + 0.04, x1 - 0.03, 0.05)):
            if ruido(i, j, seed) < 0.18:
                continue
            tubo_ensaio(xx, yy, z + 0.015, 0.13, cores[int(ruido(i, j, seed + 1) * 6)], 0.45 + 0.3 * ruido(i, seed + 2))


def _caderno(x0, x1, y0, y1, z):
    """O caderno de anotações aberto: as duas folhas creme, as linhas cinzas (sem texto) e o lápis."""
    def f(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        out = np.tile(hx('#ece4cc'), (len(P), 1))
        lin = (np.floor((Y - y0) / PH) % 3 == 0) & (np.abs(X - (x0 + x1) / 2) > 0.02) & (Y > y0 + 0.04)
        out = np.where(lin[:, None], hx('#b8b0a0'), out)
        out = np.where((np.abs(X - (x0 + x1) / 2) < PH)[:, None], hx('#a89c84'), out)
        return out
    caixa((x0, x1, y0, y1, z, z + 2 * PZ), {'cima': emissivo(f), '*': liso('#3a4a6a')})
    _barra((x0 + 0.04, x1 - 0.02, y1 + 0.02, y1 + 0.02 + 2 * PH, z, z + 2 * PZ), '#e0b040', quina=False)
    CZ.itens_peq.append((x0, x1, y0, y1, z))


def _microscopio(x, y, z):
    """O microscópio: o pé em ferradura, o braço curvo, o tubo inclinado com a ocular, a platina e as objetivas."""
    P = '#2e3436'
    caixa((x - 0.08, x + 0.08, y - 0.1, y + 0.06, z, z + 0.035), chapa(P, riscas=None, topo='#44494c'))
    caixa((x - 0.025, x + 0.025, y - 0.1, y - 0.05, z + 0.035, z + 0.26), chapa(P, riscas=None, topo='#44494c'))
    caixa((x - 0.06, x + 0.06, y - 0.06, y + 0.06, z + 0.12, z + 0.135), {'cima': liso('#3a3f42'), '*': liso('#1e2224')})
    _barra((x - 0.03, x + 0.03, y - 0.01, y + 0.03, z + 0.135, z + 0.135 + PZ), '#d8e4e6', quina=False)
    o = novo()
    C().cilindro(x, y - 0.02, 0.022, z + 0.16, z + 0.2, vol(x, y - 0.02, '#b8c0c4', brilho=0.5), M, o, lados=10)
    o = novo()
    C().cilindro(x, y - 0.06, 0.028, z + 0.2, z + 0.32, vol(x, y - 0.06, P, brilho=0.4), M, o, lados=12, tampa_mat=liso('#1a1c1e'))
    C().cilindro(x, y - 0.06, 0.018, z + 0.32, z + 0.38, vol(x, y - 0.06, '#d0d6d8', brilho=0.5), M, o, lados=10, tampa_mat=liso('#202224'))
    _barra((x + 0.025, x + 0.05, y - 0.08, y - 0.04, z + 0.1, z + 0.14), '#5a6064', quina=False)
    CZ.itens_peq.append((x - 0.08, x + 0.08, y - 0.1, y + 0.06, z))


def flasks():
    """Os frascos (0,25 m): o erlenmeyer verde, o balão de fundo redondo no anel de cortiça, a proveta e a estante de tubos."""
    frasco(0.24, 0.42, 0.0, [(0, 0.075), (0.02, 0.078), (0.1, 0.035), (0.15, 0.018), (0.2, 0.018), (0.205, 0.022)], '#4ec070', 0.08)
    o = novo()
    C().cilindro(0.5, 0.36, 0.07, 0.0, 0.025, vol(0.5, 0.36, '#a87a4a'), M, o, lados=16, tampa_mat=liso('#c89a62'))
    frasco(0.5, 0.36, 0.015, [(0, 0.03), (0.02, 0.07), (0.06, 0.088), (0.1, 0.07), (0.13, 0.025), (0.21, 0.02), (0.215, 0.024)], '#b0386a', 0.1)
    frasco(0.58, 0.58, 0.0, [(0, 0.05), (0.012, 0.05), (0.014, 0.03), (0.24, 0.03), (0.245, 0.036)], '#e0b040', 0.11)
    _estante_tubos(0.1, 0.42, 0.66, 0.0, seed=9)
    CZ.itens_peq.append((0.1, 0.65, 0.25, 0.72, 0.0))
    peg(0.12, 0.62, 0.28, 0.7)


def impressora_3d():
    """
    A impressora 3D (1,3 m) em cima do gabinete de aço: o gabinete com a porta, a caixa de perfis pretos com as
    janelas de acrílico, a mesa de impressão com a peça laranja, o pórtico com o bico, o carretel de filamento em
    cima e o visor aceso.
    """
    x0, x1, y0, y1 = 0.1, 0.65, 0.1, 0.66
    zg = 0.72
    zt = 2.12 / UN
    caixa((x0 + 0.02, x1 - 0.02, y0 + 0.02, y1 - 0.03, 0.0, 0.07), chapa('#26282a', riscas=None))
    caixa((x0, x1, y0, y1, 0.07, zg), chapa(CINZA_A, seed=8, gasto=0.06, topo='#8e9698',
                                            paineis=[('f', 'porta', x0 + 0.03, x1 - 0.03, 0.1, zg - 0.03), ('f', 'grade', x0 + 0.12, x1 - 0.12, zg - 0.16, zg - 0.08)]))
    _barra((x1 - 0.08, x1 - 0.08 + PH * 1.2, y1, y1 + 0.02, 0.32, 0.46), CROMO[0], CROMO[1], quina=False)
    # a caixa: o fundo e o teto pretos, os perfis nas quinas, as janelas (o vidro tinge o que está dentro)
    a0, a1, b0, b1 = x0 + 0.02, x1 - 0.02, y0 + 0.02, y1 - 0.02
    zb, zc = zg, zt - 0.06
    caixa((a0, a1, b0, b1, zb, zb + 0.05), chapa('#2a2c2e', riscas=None, topo='#3a3c3e',
                                                 paineis=[('f', '#1a3a4a', a1 - 0.16, a1 - 0.04, zb + 0.012, zb + 0.04)]))
    o = luz_obj()
    C().face_plana([(a1 - 0.15, b1 + 0.001, zb + 0.016), (a1 - 0.05, b1 + 0.001, zb + 0.016), (a1 - 0.05, b1 + 0.001, zb + 0.037),
                    (a1 - 0.15, b1 + 0.001, zb + 0.037)], (0, 1, 0), liso('#6ad0f0'), M, o)
    caixa((a0 + 0.01, a1 - 0.01, b0 + 0.005, b0 + 0.02, zb + 0.05, zc), chapa('#3a3c3e', riscas=None))       # o fundo
    for (xx, yy) in ((a0, b0), (a1 - 0.03, b0), (a0, b1 - 0.03), (a1 - 0.03, b1 - 0.03)):
        caixa((xx, xx + 0.03, yy, yy + 0.03, zb + 0.05, zc), chapa('#2a2c2e', riscas=None, topo='#4a4c4e'))
    caixa((a0, a1, b0, b1, zc, zt), {'cima': chapa('#2e3032', riscas=None, paineis=[('t', '#1e2022', a0 + 0.04, a1 - 0.04, b0 + 0.04, b1 - 0.04)]),
                                     '*': chapa('#2a2c2e', riscas=None)})
    # dentro: a mesa de impressão, a peça (um vasinho laranja), o pórtico e o bico
    caixa((a0 + 0.06, a1 - 0.06, b0 + 0.06, b1 - 0.06, zb + 0.12, zb + 0.14), {'cima': liso('#3a4246'), '*': liso('#1a1c1e')})
    cx, cy = (a0 + a1) / 2, (b0 + b1) / 2
    o = novo()
    _poligono_rodado(cx, cy, [(zb + 0.14, 0.05), (zb + 0.2, 0.06), (zb + 0.25, 0.04)], vol(cx, cy, '#e8782e', faixas=lambda P, b: np.where(
        (np.floor(P[:, 2] / PZ) % 2 == 0)[:, None], _tom(b, 0.93), b)), o, lados=16, tampa_mat=liso('#f08a3e'))
    tubo_x(a0 + 0.03, a1 - 0.03, cy - 0.04, zc - 0.12, r=0.012, cor='#5a6064', topo='#8a9094')
    tubo_x(a0 + 0.03, a1 - 0.03, cy + 0.04, zc - 0.12, r=0.012, cor='#5a6064', topo='#8a9094')
    caixa((cx - 0.045, cx + 0.045, cy - 0.05, cy + 0.05, zc - 0.16, zc - 0.08), chapa('#c83a2e', riscas=None, topo='#e05a4a'))
    _barra((cx - PH, cx + PH, cy - PH, cy + PH, zc - 0.2, zc - 0.16), '#b8862e', '#e8c060', quina=False)
    CZ.vidros.append((a0 + 0.001, a1 - 0.001, b0 + 0.02, b1 - 0.001, zb + 0.05, zc - 0.001))
    # o carretel de filamento em cima
    o = novo()
    sx, sy = cx, cy + 0.02
    C().cilindro(sx, sy, 0.1, zt, zt + 0.012, vol(sx, sy, '#2a2c2e'), M, o, lados=20, tampa_mat=liso('#3a3c3e'))
    o = novo()
    C().cilindro(sx, sy, 0.085, zt + 0.012, zt + 0.06, vol(sx, sy, '#e8782e', faixas=lambda P, b: np.where(
        (np.floor(P[:, 2] / PZ) % 2 == 0)[:, None], _tom(b, 0.9), b)), M, o, lados=20, tampa=False)
    o = novo()
    def topo_car(L, n, P):
        rr = np.hypot(P[:, 0] - sx, P[:, 1] - sy)
        out = np.where((rr < 0.035)[:, None], hx('#1a1c1e'), hx('#3a3c3e'))
        return np.where(((rr > 0.06) & (rr < 0.075))[:, None], hx('#4a4c4e'), out)
    C().cilindro(sx, sy, 0.1, zt + 0.06, zt + 0.072, vol(sx, sy, '#2a2c2e'), M, o, lados=20, tampa_mat=emissivo(topo_car))
    peg(x0, x1, y0, y1)


def mesa_vidro_lab():
    """
    A mesa de vidro do laboratório (1 x 3 casas, aumento 1,2: 0,9 x 2,7 m; 1,08 m): o tampo de vidro verde-claro com
    a borda, o quadro e as pernas de aço, o painel de trás (o vão é 'fundo'); duas fileiras de tubos de ensaio, os
    frascos coloridos e o bico de Bunsen.
    """
    w, d = 0.75 * 1.2, 2.25 * 1.2
    x, y = 0.375 - w / 2, 1.125 - d / 2
    h = 1.76 / UN
    tv = 0.025
    # o quadro de aço logo embaixo do vidro e as pernas
    m = 0.04
    QD = chapa(INOX, riscas='h', seed=21, topo=INOX_T)
    caixa((x + m, x + w - m, y + m, y + d - m, h - tv - 0.05, h - tv), QD)
    for (a, b) in ((x + m, y + m), (x + w - m - 0.045, y + m), (x + m, y + d - m - 0.045), (x + w - m - 0.045, y + d - m - 0.045)):
        caixa((a, a + 0.045, b, b + 0.045, 0.0, h - tv - 0.05), chapa(INOX, riscas='v', seed=22, topo=INOX_T))
        caixa((a - 0.005, a + 0.05, b - 0.005, b + 0.05, 0.0, 0.025), liso('#3a3c3e'))
    # o painel de trás (o vão 'fundo'), entre as pernas de trás
    caixa((x + m + 0.05, x + w - m - 0.05, y + m + 0.01, y + m + 0.03, 0.2, h - tv - 0.05), chapa(CINZA_A, riscas='h', seed=23))
    # o vidro
    o = novo()
    C().caixa((x, x + w, y, y + d, h - tv, h), {'cima': vidro_mat('#b6d6d0'), '*': liso('#7eb0a6')}, M, o)
    peg(x, x + w, y, y + d)
    # em cima: as duas fileiras de tubos, os frascos e o bico de Bunsen
    _estante_tubos(x + 0.1, x + w - 0.1, y + 0.45, h, seed=11, fileiras=2)
    _estante_tubos(x + 0.1, x + w - 0.1, y + 0.9, h, seed=12, fileiras=2)
    frasco(x + 0.25, y + 1.4, h, [(0, 0.075), (0.02, 0.078), (0.1, 0.035), (0.15, 0.018), (0.2, 0.018)], '#4a8ac0', 0.08)
    frasco(x + 0.6, y + 1.5, h, [(0, 0.03), (0.02, 0.07), (0.06, 0.085), (0.1, 0.07), (0.13, 0.025), (0.2, 0.02)], '#d84a3a', 0.09)
    frasco(x + 0.45, y + 1.85, h, [(0, 0.05), (0.12, 0.05), (0.14, 0.02), (0.18, 0.02)], '#e0b040', 0.08)
    frasco(x + 0.22, y + 2.05, h, [(0, 0.04), (0.1, 0.04), (0.12, 0.018), (0.15, 0.018)], '#8a50b0', 0.06)
    # o bico de Bunsen: a base, o tubo, a chama azul
    bx, by = x + 0.62, y + 2.2
    o = novo()
    C().cilindro(bx, by, 0.05, h, h + 0.02, vol(bx, by, '#3a3c3e'), M, o, lados=14, tampa_mat=liso('#4a4c4e'))
    C().cilindro(bx, by, 0.014, h + 0.02, h + 0.16, vol(bx, by, '#b8862e', brilho=0.5), M, o, lados=10, tampa_mat=liso('#2a2a2a'))
    ol = luz_obj()
    C().elipsoide(np.array([bx, by, h + 0.2]), np.array([0.018, 0.018, 0.04]), liso('#5a8af0'), ol)
    ol2 = luz_obj()
    C().elipsoide(np.array([bx + 0.003, by + 0.003, h + 0.19]), np.array([0.01, 0.01, 0.022]), liso('#bcd4ff'), ol2)
    _barra((bx - 0.06, bx - 0.02, by - PH, by + PH, h, h + 2 * PZ), '#c8a070', quina=False)
    CZ.itens_peq.append((x + 0.1, x + w - 0.1, y + 0.35, y + 2.3, h))


def stool_lab():
    """
    A banqueta de laboratório (aumento 1,2; o assento a 0,74 m): o assento de vinil preto estofado, a coluna a gás
    cromada, o anel dos pés e a base de quatro braços com rodízios.
    """
    cx, cy = 0.375, 0.375
    h = 1.21 / UN
    r = 0.18 * 1.2
    estrela(cx, cy, 0.26, 0.05, 0.08, cor='#2e3032')
    o = novo()
    C().cilindro(cx, cy, 0.035, 0.06, 0.12, vol(cx, cy, '#2a2c2e'), M, o, lados=12)
    poste(cx, cy, 0.12, h - 0.08, 0.02, '#b0b8bc', brilho=0.7)
    o = novo()
    anel(cx, cy, 0.17, 0.33, 0.33 + 2 * PZ, vol(cx, cy, '#a8b0b4', brilho=0.6), o)
    for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        _barra((cx + min(0, dx * 0.17), cx + max(0, dx * 0.17) + (PH if dx == 0 else 0), cy + min(0, dy * 0.17), cy + max(0, dy * 0.17) + (PH if dy == 0 else 0),
                0.33, 0.33 + PZ), '#8a9296', quina=False)
    o = novo()
    C().cilindro(cx, cy, 0.09, h - 0.09, h - 0.07, vol(cx, cy, '#3a3c3e'), M, o, lados=14, tampa=False)
    # o assento: a almofada de vinil (o brilho na beira de cima)
    o = novo()

    def vinil(L, n, P):
        rr = np.hypot(P[:, 0] - cx, P[:, 1] - cy) / r
        out = np.tile(hx('#34363a'), (len(P), 1))
        out = np.where((rr < 0.55)[:, None], hx('#3e4146'), out)
        bx, by = (P[:, 0] - cx) / r + 0.3, (P[:, 1] - cy) / r + 0.35
        out = np.where((np.hypot(bx, by * 1.6) < 0.18)[:, None], hx('#6a6e74'), out)
        return out
    C().cilindro(cx, cy, r, h - 0.07, h - 0.01, vol(cx, cy, '#2a2c30', brilho=0.25), M, o, lados=28, tampa=False)
    C().cilindro(cx, cy, r, h - 0.01, h, vol(cx, cy, '#34363a'), M, o, lados=28, tampa_mat=emissivo(vinil), r1=r - 0.015)
    peg(cx - 0.22, cx + 0.22, cy - 0.22, cy + 0.22)


# =====================================================================================================================
# a saúde: o leito, a cortina, o soro, os monitores, o carrinho, o armário de remédios, o posto, o vaso de aço
# =====================================================================================================================
_ACO = BE._p1_rampa(['#4a5052', '#5e6466', '#737a7c', '#8a9092', '#a0a6a8', '#b6bcbe', '#cad0d2', '#dde2e3'])


def aco_rampa(lo=2.6, hi=6.4):
    return BE._p1_mat_rampa(_ACO, lo, hi)


def hospital_bed():
    """
    O leito hospitalar (1 x 3 casas; o colchão a 0,7 m): o chassi baixo nos rodízios, as cabeceiras de tubo com o
    painel de esmalte, as grades de meia cama na cabeceira, o colchão com o lençol, a manta azul e o travesseiro, a
    prancheta pendurada no pé e a manivela.
    """
    x0, x1, y0, y1 = 0.08, 0.67, 0.04, 2.21
    ztop = 1.14 / UN
    zb = 0.48
    for (a, b) in ((x0 + 0.05, y0 + 0.1), (x1 - 0.05, y0 + 0.1), (x0 + 0.05, y1 - 0.1), (x1 - 0.05, y1 - 0.1)):
        rodinha(a, b, 0.035)
    # o chassi: a caixa baixa e as duas colunas, o estrado de chapa
    caixa((x0 + 0.08, x1 - 0.08, y0 + 0.15, y1 - 0.15, 0.1, 0.17), chapa('#5a6062', riscas='h', seed=31))
    for yy in (y0 + 0.35, y1 - 0.45):
        caixa((x0 + 0.2, x1 - 0.2, yy, yy + 0.1, 0.17, zb - 0.03), chapa('#8a9092', riscas='v', seed=32, topo='#a8aeb0'))
    caixa((x0 + 0.01, x1 - 0.01, y0 + 0.08, y1 - 0.08, zb - 0.06, zb), chapa(ESMALTE, riscas='h', seed=33, topo='#e2ded0'))
    CA.leito(x0 + 0.01, x1 - 0.01, y0 + 0.08, y1 - 0.1, zb, ztop, 'listra', 1, seed=4)
    # as cabeceiras: os dois postes de tubo e o painel
    for (yy, zt_, pz) in ((y0, 1.02, 0.95), (y1 - 0.04, 0.86, 0.8)):
        for xx in (x0, x1 - 0.035):
            caixa((xx, xx + 0.035, yy, yy + 0.04, 0.12, zt_), chapa('#c8ccc8', riscas=None, topo='#e6eae6'))
        caixa((x0 + 0.035, x1 - 0.035, yy + 0.005, yy + 0.035, zb - 0.04, pz),
              chapa(ESMALTE, riscas=None, gasto=0.08, seed=34, paineis=[(ld, 'fresta', x0 + 0.07, x1 - 0.07, zb, pz - 0.05) for ld in ('f', 'c')]))
        tubo_x(x0, x1, yy + 0.02, zt_ - 0.015, r=0.02, cor='#c8ccc8', topo='#eef2ee')
    # a prancheta pendurada no pé (o papel sem texto: as linhas cinzas)
    cx = (x0 + x1) / 2

    def papel(out, a, b, lado, P):
        lin = (np.floor(b / PZ) % 3 == 0) & (np.abs(a - cx) < 0.07) & (b < pz2 - 0.04) & (b > 0.62)
        return np.where(lin[:, None], hx('#a09a8c'), out)
    pz2 = 0.82
    caixa((cx - 0.11, cx + 0.11, y1, y1 + 0.012, 0.58, pz2), {'frente': chapa('#ece6d6', riscas=None, extra=papel), '*': liso('#8a5a34')})
    _barra((cx - 0.04, cx + 0.04, y1 + 0.006, y1 + 0.02, pz2 - 0.03, pz2 + 0.01), '#b8bcbe', '#e2e6e8', quina=False)
    # as grades de meia cama (os dois tubos e os montantes) dos dois lados, na cabeceira
    for xx in (x0 - 0.01, x1 - 0.015):
        o = novo()
        for zz in (ztop + 0.08, ztop + 0.2):
            tubo((xx, xx + 0.025, y0 + 0.18, y0 + 0.95, zz - 0.012, zz + 0.012), '#c8ccc8', '#eef2ee', oid=o)
        for yy in (y0 + 0.24, y0 + 0.88):
            tubo((xx, xx + 0.025, yy - 0.012, yy + 0.012, zb - 0.04, ztop + 0.2), '#b8bcb8', '#e2e6e2', oid=o)
    # a manivela embaixo do pé
    _barra((cx - PH, cx + PH, y1 - 0.06, y1 + 0.03, 0.3, 0.3 + 2 * PZ), '#8a9092', quina=False)
    _barra((cx - 0.02, cx + 0.02, y1 + 0.02, y1 + 0.04, 0.24, 0.32), '#3a3c3e', quina=False)
    peg(x0, x1, y0, y1)


def iv_stand():
    """O suporte de soro (1,9 m): a base de quatro braços com rodízios, a haste cromada, os ganchos, a bolsa de soro e a de sangue com o equipo."""
    cx, cy = 0.375, 0.375
    estrela(cx, cy, 0.25, 0.05, 0.075, cor='#a8b0b4')
    poste(cx, cy, 0.075, 1.9, 0.014, '#b8c0c4', brilho=0.7)
    o = novo()
    tubo((cx - 0.17, cx + 0.17, cy - PH, cy + PH, 1.84, 1.84 + 2 * PZ), oid=o)
    for dx in (-0.16, 0.16):
        tubo((cx + dx - PH, cx + dx + PH, cy - PH, cy + PH, 1.79, 1.86), oid=o)
    # a bolsa de soro (plástico claro, o líquido, a etiqueta branca) e a de sangue (menor)
    for (dx, liq, alto, larg) in ((0.13, '#e8e4c0', 0.3, 0.075), (-0.13, '#8a1e1c', 0.2, 0.06)):
        bx = cx + dx
        zt = 1.78
        z0 = zt - alto

        def bolsa(L, n, P, z0=z0, alto=alto, liq=liq, bx=bx, larg=larg):
            zz = P[:, 2] - z0
            out = np.where((zz < alto * 0.72)[:, None], hx(liq), hx('#e6eeec'))
            et = (np.abs(P[:, 0] - bx) < larg * 0.55) & (zz > alto * 0.3) & (zz < alto * 0.62)
            if liq == '#e8e4c0':
                out = np.where(et[:, None], hx('#f8f6f0'), out)
                out = np.where((et & (np.floor(zz / PZ) % 3 == 0) & (np.abs(P[:, 0] - bx) < larg * 0.35))[:, None], hx('#7a8ab0'), out)
            return out
        _p1_malha((bx - larg, bx + larg, cy - 0.018, cy + 0.018, z0, zt), (0.03, 0.012, 0.03, 0.02), emissivo(bolsa), seg=2)
        tubo((bx - PH, bx + PH, cy - PH, cy + PH, zt, 1.8), '#d8dcdc', '#ffffff')
        # a câmara de gotejamento e o equipo descendo
        o = novo()
        C().cilindro(bx, cy, 0.014, z0 - 0.08, z0, vol(bx, cy, '#d8e4e4', brilho=0.5), M, o, lados=8)
        o = novo()
        s = 1 if dx > 0 else -1
        _fita([(0.0, z0 - 0.08), (-0.01 * s, z0 - 0.4), (-0.05 * s, 1.0), (-0.1 * s, 0.86), (-0.12 * s, 0.95)], bx, cy,
              liso('#c8d6d6' if liq != '#8a1e1c' else '#7a2222'), o, 0.022)
    peg(cx - 0.25, cx + 0.25, cy - 0.25, cy + 0.25)


def _monitor(cx, cy, z0, w, d, h, liga, alca=True, casco='#cfcbbd'):
    """
    O monitor de sinais (a caixa bege de quinas arredondadas, a moldura escura, a tela, a coluna de botões à direita
    e a alça em cima). liga: a tela acesa com as ondas (um objeto de luz) ou o vidro apagado.
    """
    x0, x1, y0, y1 = cx - w / 2, cx + w / 2, cy - d / 2, cy + d / 2
    sa0, sa1 = x0 + 0.03, x1 - 0.08
    sb0, sb1 = z0 + 0.04, z0 + h - 0.035
    pain = [('f', '#2a2c2e', sa0 - 0.012, sa1 + 0.012, sb0 - 0.012, sb1 + 0.012),
            ('f', 'grade', x0 + 0.02, x1 - 0.02, z0 + 0.01, z0 + 0.03)]
    o = novo()
    C().caixa((x0, x1, y0, y1, z0, z0 + h), chapa(casco, riscas=None, gasto=0.06, seed=41, paineis=pain), M, o, ch=0.012)
    # os botões (2 x 2 px) e o led
    bx = x1 - 0.045
    for i, cor in enumerate(('#c8302a', '#3a3c3e', '#3a3c3e', '#3a3c3e')):
        zz = sb1 - 0.03 - i * 0.045
        _barra((bx - PH, bx + PH, y1, y1 + 0.01, zz - PZ, zz + PZ), cor, quina=False)
    if liga:
        ol = luz_obj()
        _barra((bx - PH, bx + PH, y1, y1 + 0.01, sb0, sb0 + 2 * PZ), '#5ef0a0', quina=False, oid=ol)
    ot = luz_obj() if liga else novo(contorno=False)
    C().face_plana([(sa0, y1 + 0.002, sb0), (sa1, y1 + 0.002, sb0), (sa1, y1 + 0.002, sb1), (sa0, y1 + 0.002, sb1)], (0, 1, 0),
                   tela_mat(liga, a0=sa0, a1=sa1, b0=sb0, b1=sb1), M, ot)
    if alca:
        o = novo()
        for xx in (x0 + 0.05, x1 - 0.06):
            tubo((xx, xx + 0.015, cy - 0.01, cy + 0.01, z0 + h, z0 + h + 0.045), '#3a3c3e', '#5a5c5e', oid=o)
        tubo((x0 + 0.05, x1 - 0.045, cy - 0.012, cy + 0.012, z0 + h + 0.035, z0 + h + 0.055), '#3a3c3e', '#5a5c5e', oid=o)


def vitals_monitor(liga=True):
    """O monitor de sinais vitais de mesa (0,34 m): a caixa, os pezinhos, a tela com a linha verde do batimento."""
    cx, cy = 0.375, 0.4
    for xx in (cx - 0.15, cx + 0.12):
        _barra((xx, xx + 0.03, cy - 0.1, cy + 0.08, 0.0, 0.02), '#3a3c3e', quina=False)
    _monitor(cx, cy, 0.02, 0.36, 0.2, 0.27, liga)
    peg(cx - 0.18, cx + 0.18, cy - 0.1, cy + 0.1)


def monitor_suporte(liga=True):
    """O monitor no pé de rodinhas (1,45 m): a base, a haste, o cesto de arame dos cabos e o monitor com a alça."""
    cx, cy = 0.375, 0.375
    estrela(cx, cy, 0.24, 0.05, 0.075, cor='#3a3c3e')
    poste(cx, cy, 0.075, 1.08, 0.018, '#a8b0b4', brilho=0.6)
    # o cesto de arame (o fundo e as paredes de grade) com os cabos enrolados
    b = (cx - 0.12, cx + 0.12, cy + 0.03, cy + 0.19, 0.62, 0.74)

    def grade(out, a, bb, lado, P):
        if lado in 'tb':
            return out
        fio = (np.floor(a / PH) % 3 == 0) | (np.floor(bb / PZ) % 4 == 0)
        return np.where(fio[:, None], hx('#c8ccce'), hx('#3a3e40'))
    caixa(b, {'cima': None, 'baixo': liso('#8a9092'), '*': chapa('#8a9092', riscas=None, extra=grade)})
    caixa((b[0] + 0.01, b[1] - 0.01, b[2] + 0.01, b[3] - 0.01, 0.62, 0.625), liso('#3a3e40'))
    o = novo()
    _fita([(-0.08, 0.7), (-0.03, 0.74), (0.04, 0.72), (0.08, 0.75)], cx, cy + 0.11, liso('#2a2c2e'), o, 0.02)
    caixa((cx - 0.05, cx + 0.05, cy - 0.04, cy + 0.03, 1.06, 1.1), chapa('#3a3c3e', riscas=None))
    _monitor(cx, cy, 1.1, 0.4, 0.17, 0.3, liga)
    peg(cx - 0.24, cx + 0.24, cy - 0.24, cy + 0.24)


def trolley():
    """
    O carrinho de instrumentos de inox (0,95 m): os quatro tubos, a bandeja de cima com a beira, a prateleira de
    baixo, a barra de empurrar, os rodízios; em cima o bisturi, a tesoura, a pinça, a cuba rim, as gazes e o iodo;
    embaixo as toalhas verdes dobradas e a bacia.
    """
    x0, x1, y0, y1 = 0.12, 0.63, 0.17, 0.6
    h = 1.55 / UN
    zt = h - 0.05
    for (a, b) in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
        rodinha(a, b, 0.03)
        poste(a, b, 0.07, zt + 0.03 if b > y0 else h, 0.013, '#b0b8bc', brilho=0.6)
    tubo_x(x0, x1, y0, h - 0.01, r=0.014)
    TB = {'cima': chapa(INOX_T, riscas='h', seed=51, passo=0.05), '*': chapa(INOX, riscas=None)}
    for (zz, beira) in ((zt, 0.025), (0.3, 0.025)):
        caixa((x0 - 0.01, x1 + 0.01, y0 - 0.01, y1 + 0.01, zz - 0.015, zz), TB)
        for bb in ((x0 - 0.01, x1 + 0.01, y0 - 0.01, y0 + 0.005), (x0 - 0.01, x1 + 0.01, y1 - 0.005, y1 + 0.01),
                   (x0 - 0.01, x0 + 0.005, y0 - 0.01, y1 + 0.01), (x1 - 0.005, x1 + 0.01, y0 - 0.01, y1 + 0.01)):
            caixa((*bb, zz, zz + beira), {'cima': liso(INOX_T), '*': chapa(INOX, riscas=None)})
    # em cima
    o = novo()
    _p1_malha((x0 + 0.04, x0 + 0.22, y0 + 0.05, y0 + 0.16, zt, zt + 0.035), (0.05, 0.05, 0.02, 0.005), aco_rampa(3.0, 6.6), seg=2)
    _gaze(x1 - 0.17, x1 - 0.05, y0 + 0.05, y0 + 0.17, zt)
    for (xx, yy, cor, cab) in ((x0 + 0.06, y1 - 0.12, '#c8d0d2', '#3a6ab8'), (x0 + 0.06, y1 - 0.07, '#c8d0d2', '#c8d0d2')):
        _barra((xx, xx + 0.16, yy - PH * 0.6, yy + PH * 0.6, zt, zt + 1.4 * PZ), cor, '#eef4f6', quina=False)
        _barra((xx, xx + 0.07, yy - PH * 0.6, yy + PH * 0.6, zt, zt + 1.8 * PZ), cab, quina=False)
    # a tesoura: as duas lâminas abertas e os aros
    tx, ty = x1 - 0.22, y1 - 0.12
    _barra((tx, tx + 0.12, ty - PH * 0.5, ty + PH * 0.5, zt, zt + PZ), '#c8d0d2', quina=False)
    _barra((tx, tx + 0.12, ty + 0.03 - PH * 0.5, ty + 0.03 + PH * 0.5, zt, zt + PZ), '#c8d0d2', quina=False)
    for dy in (0.0, 0.03):
        _barra((tx - 0.035, tx, ty + dy - 0.015, ty + dy + 0.015, zt, zt + PZ), '#3a3c3e', quina=False)
    frasco(x1 - 0.06, y1 - 0.06, zt, [(0, 0.03), (0.07, 0.03), (0.085, 0.014), (0.11, 0.014)], '#6a2410', 0.08, '#7a3a1a', rolha='#2a2a2a')
    # embaixo: as toalhas verdes dobradas e a bacia
    for k in range(3):
        caixa((x0 + 0.03 + 0.006 * k, x0 + 0.24 - 0.004 * k, y0 + 0.06, y0 + 0.3, 0.3 + k * 0.035, 0.3 + (k + 1) * 0.035 - 0.004),
              {'cima': liso('#7aa890'), '*': chapa('#6a9884', riscas='h', passo=0.02)})
    o = novo()
    _poligono_rodado(x1 - 0.13, (y0 + y1) / 2, [(0.3, 0.08), (0.36, 0.1), (0.37, 0.105)], vol(x1 - 0.13, (y0 + y1) / 2, INOX, brilho=0.5), o,
                     lados=18, tampa_mat=liso('#6e7678'))
    CZ.itens_peq.append((x0, x1, y0, y1, zt))
    peg(x0 - 0.02, x1 + 0.02, y0 - 0.02, y1 + 0.02)


def _gaze(x0, x1, y0, y1, z):
    """As gazes dobradas (a pilha branca com a trama de 1 px)."""
    def f(L, n, P):
        out = np.tile(hx('#f2f0ea'), (len(P), 1))
        tr = (np.floor(P[:, 0] / PH) + np.floor(P[:, 1] / PH)) % 4 == 0
        return np.where(tr[:, None], hx('#dedad0'), out)
    caixa((x0, x1, y0, y1, z, z + 0.03), {'cima': emissivo(f), '*': liso('#e2ded4')})
    CZ.itens_peq.append((x0, x1, y0, y1, z))


def med_tray():
    """A bandeja de remédios (0,16 m): a bandeja de inox com a beira, os frascos de remédio, as seringas, o algodão e a gaze."""
    x0, x1, y0, y1 = 0.15, 0.6, 0.22, 0.54
    caixa((x0, x1, y0, y1, 0.0, 0.012), {'cima': chapa(INOX_T, riscas='h', seed=61, passo=0.05), '*': chapa(INOX, riscas=None)})
    for bb in ((x0, x1, y0, y0 + 0.012), (x0, x1, y1 - 0.012, y1), (x0, x0 + 0.012, y0, y1), (x1 - 0.012, x1, y0, y1)):
        caixa((*bb, 0.012, 0.035), {'cima': liso(INOX_T), '*': chapa(INOX, riscas=None)})
    z = 0.012
    frasco(x0 + 0.07, y0 + 0.08, z, [(0, 0.03), (0.08, 0.03), (0.095, 0.015), (0.12, 0.015)], '#6a2410', 0.09, '#8a4a1a', rolha='#e6e2d8')
    frasco(x0 + 0.14, y0 + 0.07, z, [(0, 0.022), (0.06, 0.022), (0.07, 0.012), (0.085, 0.012)], '#e6eef0', 0.05, rolha='#3a6ab8')
    frasco(x0 + 0.2, y0 + 0.09, z, [(0, 0.022), (0.06, 0.022), (0.07, 0.012), (0.085, 0.012)], '#e6eef0', 0.05, rolha='#c83a2e')
    # as seringas (o corpo branco, o êmbolo, a agulha)
    for (yy, xs) in ((y1 - 0.08, x0 + 0.06), (y1 - 0.13, x0 + 0.1)):
        _barra((xs, xs + 0.1, yy - PH, yy + PH, z, z + 2 * PZ), '#eef0f0', '#ffffff', quina=False)
        _barra((xs - 0.03, xs, yy - PH * 0.5, yy + PH * 0.5, z, z + PZ), '#c8ccd0', quina=False)
        _barra((xs + 0.1, xs + 0.15, yy - PH * 0.4, yy + PH * 0.4, z, z + PZ), '#a4aeb2', quina=False)
    for (xx, yy) in ((x1 - 0.1, y0 + 0.08), (x1 - 0.06, y0 + 0.12)):
        o = novo()
        C().elipsoide(np.array([xx, yy, z + 0.022]), np.array([0.03, 0.03, 0.024]), liso('#f6f4ee'), o)
    _gaze(x1 - 0.16, x1 - 0.04, y1 - 0.15, y1 - 0.04, z)
    CZ.itens_peq.append((x0, x1, y0, y1, 0.0))
    peg(x0, x1, y0, y1)


def medical_cabinet():
    """
    O armário de remédios (2 casas, 1,9 m): o rodapé recuado, o corpo de baixo com as duas portas de chapa, o de cima
    com as duas portas de vidro (os frascos, as caixas e os rolos de esparadrapo nas prateleiras), a cimalha e a cruz.
    """
    x0, x1, y0, y1 = 0.04, 1.46, 0.07, 0.6
    zt = 3.1 / UN
    zm = 0.88
    meio = (x0 + x1) / 2
    E = '#d2cebf'
    caixa((x0 + 0.04, x1 - 0.04, y0 + 0.03, y1 - 0.04, 0.0, 0.08), chapa('#3a3c3e', riscas=None))
    pain = [('f', 'porta', x0 + 0.03, meio - 0.006, 0.11, zm - 0.03), ('f', 'porta', meio + 0.006, x1 - 0.03, 0.11, zm - 0.03),
            ('f', '#f2eee4', x0 + 0.08, x0 + 0.24, zm - 0.24, zm - 0.08), ('f', 'cruz:#c8302a', x0 + 0.08, x0 + 0.24, zm - 0.24, zm - 0.08)]
    caixa((x0, x1, y0, y1, 0.08, zm), chapa(E, riscas='v', k=(1.03, 0.97), seed=71, gasto=0.08, paineis=pain))
    for xx in (meio - 0.04, meio + 0.04 - PH * 1.2):
        _barra((xx, xx + PH * 1.2, y1, y1 + 0.02, zm - 0.3, zm - 0.14), CROMO[0], CROMO[1], quina=False)
    _barra((meio + 0.07, meio + 0.07 + 2 * PH, y1, y1 + 0.01, zm - 0.1, zm - 0.1 + 2 * PZ), '#3a3c3e', quina=False)
    # a parte de cima: o fundo, os lados, o teto (finos: vê-se o lado de dentro pelo vidro)
    zc = zt - 0.08
    CAR = chapa(E, riscas='v', k=(1.03, 0.97), seed=72)
    caixa((x0, x1, y0, y0 + 0.02, zm, zc), {'frente': liso('#e6e2d6'), '*': CAR})
    for xx in (x0, x1 - 0.025):
        caixa((xx, xx + 0.025, y0, y1, zm, zc), {'dir': liso('#dcd8cc'), 'esq': liso('#dcd8cc'), '*': CAR})
    caixa((x0, x1, y0, y1, zm, zm + 0.02), {'cima': liso('#e8e4d8'), '*': CAR})
    # as prateleiras de vidro e o que está nelas
    zs = [zm + 0.02, zm + 0.33, zm + 0.62]
    for zz in zs[1:]:
        caixa((x0 + 0.025, x1 - 0.025, y0 + 0.02, y1 - 0.04, zz - 0.012, zz), {'cima': liso('#c8dcd8'), '*': liso('#9abcb6')})
    k = 0
    for i, zz in enumerate(zs):
        xx = x0 + 0.09
        while xx < x1 - 0.1:
            r = ruido(k, i, 7.0)
            k += 1
            cy = y0 + 0.2 + 0.1 * ruido(k, 3.0)
            if r < 0.3:
                frasco(xx, cy, zz, [(0, 0.035), (0.11, 0.035), (0.13, 0.016), (0.16, 0.016)], '#6a2410', 0.12, '#8a4a1a', rolha='#2a2a2a')
                xx += 0.1
            elif r < 0.55:
                c = ['#e6e2d8', '#d8e4ea', '#f0e2b8'][int(r * 30) % 3]
                caixa((xx - 0.05, xx + 0.05, cy - 0.06, cy + 0.06, zz, zz + 0.14 + 0.05 * ruido(k, 1.0)),
                      chapa(c, riscas=None, paineis=[('f', ['#3a6ab8', '#c8302a', '#3a8a5a'][k % 3], xx - 0.05, xx + 0.05, zz + 0.04, zz + 0.07)]))
                xx += 0.13
            elif r < 0.75:
                frasco(xx, cy, zz, [(0, 0.03), (0.09, 0.03), (0.1, 0.02), (0.12, 0.02)], '#e8f0f0', 0.06, '#e6eeee',
                       rolha=['#3a6ab8', '#c8302a', '#e6e2d8'][k % 3])
                xx += 0.09
            elif r < 0.88:
                o = novo()
                C().cilindro(xx, cy, 0.04, zz, zz + 0.04, vol(xx, cy, '#f2eee4'), M, o, lados=14, tampa_mat=emissivo(
                    lambda L, n, P, xx=xx, cy=cy: np.where((np.hypot(P[:, 0] - xx, P[:, 1] - cy) < 0.018)[:, None], hx('#a8a294'), hx('#f6f2e8'))))
                xx += 0.1
            else:
                xx += 0.08
    # as portas de vidro: a moldura (os montantes e as travessas) e o vidro
    yf0, yf1 = y1 - 0.03, y1
    FR = chapa(E, riscas=None, topo='#e8e4d8')
    for (a, b) in ((x0, x0 + 0.045), (meio - 0.025, meio + 0.025), (x1 - 0.045, x1)):
        caixa((a, b, yf0, yf1, zm, zc), FR)
    for (za, zb_) in ((zm, zm + 0.05), (zc - 0.05, zc)):
        caixa((x0, x1, yf0, yf1, za, zb_), FR)
    for xx in (meio - 0.045, meio + 0.045 - PH * 1.2):
        _barra((xx, xx + PH * 1.2, yf1, yf1 + 0.02, zm + 0.3, zm + 0.48), CROMO[0], CROMO[1], quina=False)
    CZ.vidros.append((x0 + 0.03, x1 - 0.03, y0 + 0.025, yf1 - 0.001, zm + 0.05, zc - 0.05))
    # a cimalha
    caixa((x0 - 0.02, x1 + 0.02, y0 - 0.01, y1 + 0.02, zc, zt), {'cima': liso('#e2ded2'), '*': chapa(E, riscas=None)})
    peg(x0, x1, y0, y1)


def eletroencefalografo():
    """
    O eletroencefalógrafo (1,3 m) no carrinho: o gabinete bege com as gavetas e os rodízios, o aparelho com a fileira
    de botões e as canetas, o papel saindo pela frente com as linhas, e a haste com a touca de eletrodos pendurada e
    os fios coloridos.
    """
    x0, x1, y0, y1 = 0.1, 0.65, 0.12, 0.62
    BEG = '#c4baa0'
    for (a, b) in ((x0 + 0.04, y0 + 0.04), (x1 - 0.04, y0 + 0.04), (x0 + 0.04, y1 - 0.04), (x1 - 0.04, y1 - 0.04)):
        rodinha(a, b, 0.03)
    zc = 0.68
    pain = [('f', 'porta', x0 + 0.03, x1 - 0.03, zc - 0.17, zc - 0.03), ('f', 'porta', x0 + 0.03, x1 - 0.03, zc - 0.33, zc - 0.19),
            ('f', 'porta', x0 + 0.03, x1 - 0.03, 0.1, zc - 0.35)]
    caixa((x0, x1, y0, y1, 0.07, zc), chapa(BEG, riscas='v', k=(1.03, 0.97), seed=81, gasto=0.1, paineis=pain, topo='#d4cab0'))
    for zz in (zc - 0.1, zc - 0.26):
        _barra((0.32, 0.43, y1, y1 + 0.018, zz - PZ, zz + PZ), CROMO[0], CROMO[1], quina=False)
    # o aparelho: a caixa e o painel escuro inclinado com os botões
    za = zc + 0.2
    pain2 = [('f', '#3a3a36', x0 + 0.04, x1 - 0.04, zc + 0.05, za - 0.03)]

    def botoes(out, a, b, lado, P):
        if lado != 'f':
            return out
        g = (np.floor((a - x0) / PH) % 4 < 2) & (np.floor((b - zc) / PZ) % 4 < 2) & (b > zc + 0.07) & (b < za - 0.05) & (a > x0 + 0.06) & (a < x1 - 0.06)
        cores = np.where((np.floor((a - x0) / (4 * PH)) % 5 == 0)[:, None], hx('#c8302a'), hx('#d8d0b8'))
        return np.where(g[:, None], cores, out)
    caixa((x0 + 0.02, x1 - 0.02, y0 + 0.02, y1 - 0.08, zc, za), chapa(BEG, riscas=None, seed=82, paineis=pain2, extra=botoes, topo='#d8ceb4'))
    # a mesinha do papel (o rolo atrás) e as canetas
    caixa((x0 + 0.06, x1 - 0.06, y0 + 0.1, y1 - 0.1, za, za + 0.06), chapa('#8a8270', riscas=None, topo='#a8a08a'))
    for i in range(8):
        xx = x0 + 0.1 + i * 0.044
        _barra((xx - PH * 0.6, xx + PH * 0.6, y1 - 0.28, y1 - 0.12, za + 0.06, za + 0.06 + PZ * 1.5), '#2a2a2a', quina=False)
    # o papel: sai na frente da mesinha e desce dobrado na frente do aparelho
    pa0, pa1 = x0 + 0.13, x1 - 0.13

    def papel(L, n, P):
        a, b = _uv(n, P)
        out = np.tile(hx('#efe8d2'), (len(P), 1))
        if abs(n[2]) > 0.5:
            t = P[:, 1]
            k = 0.9
        else:
            t = -P[:, 2]
            k = 1.0
        for i in range(3):
            ac = pa0 + 0.06 + i * (pa1 - pa0 - 0.12) / 2
            off = np.round(0.7 * np.sin(np.floor(t / PZ) * 0.9 + i * 1.7)) + (np.floor(t / PZ) % 13 == i * 3) * 2
            out = np.where((np.abs(np.floor((a - ac) / PH) - off) < 0.6)[:, None], hx('#2a2a40'), out)
        out = np.where((np.floor((a - pa0) / PH) % 4 == 2)[:, None] & (np.floor(t / PZ) % 6 == 0)[:, None], hx('#e0c8c0'), out)
        return out
    o = novo()
    zp = za + 0.06 + 0.002
    C().face_plana([(pa0, y1 - 0.12, zp), (pa1, y1 - 0.12, zp), (pa1, y1 - 0.04, zp), (pa0, y1 - 0.04, zp)], (0, 0, 1), emissivo(papel), M, o, dois_lados=True)
    C().face_plana([(pa0, y1 - 0.04, zp), (pa1, y1 - 0.04, zp), (pa1, y1 + 0.03, zc + 0.12), (pa0, y1 + 0.03, zc + 0.12)], (0, 0.9, 0.44), emissivo(papel), M, o, dois_lados=True)
    C().face_plana([(pa0, y1 + 0.03, zc + 0.12), (pa1, y1 + 0.03, zc + 0.12), (pa1, y1 + 0.03, zc - 0.05), (pa0, y1 + 0.03, zc - 0.05)], (0, 1, 0), emissivo(papel), M, o, dois_lados=True)
    # a haste atrás com o braço e a touca de eletrodos
    hx_, hy = x1 - 0.09, y0 + 0.06
    poste(hx_, hy, za, 2.12 / UN, 0.014, '#a8b0b4')
    tubo_y(hy, hy + 0.2, hx_, 2.12 / UN - 0.01, r=0.012)
    tx, ty, tz = hx_, hy + 0.19, 2.12 / UN - 0.12

    def touca(L, n, P):
        ang = np.arctan2(P[:, 1] - ty, P[:, 0] - tx)
        el = (np.abs(((ang * 6 / math.pi) % 1) - 0.5) < 0.12) & (np.abs(((P[:, 2] - tz) / 0.025) % 1 - 0.5) < 0.25)
        out = np.tile(hx('#e2dccb'), (len(P), 1))
        out = np.where(((np.floor(ang * 12 / math.pi) % 2 == 0))[:, None], hx('#d2cab4'), out)
        return np.where(el[:, None], hx('#3a6ab8'), out)
    o = novo()
    C().elipsoide(np.array([tx, ty, tz]), np.array([0.09, 0.09, 0.08]), emissivo(touca), o, corte_z=tz - 0.02)
    for i, cor in enumerate(('#c8302a', '#3a6ab8', '#e0b040', '#3a8a5a', '#2a2a2a')):
        o = novo()
        s0 = -0.06 + i * 0.03
        _fita([(s0, tz - 0.02), (s0 * 1.2, tz - 0.12), (s0 * 0.8 - 0.06, za + 0.1)], tx, ty, liso(cor), o, 0.01)
    peg(x0, x1, y0, y1)


def posto_enfermagem(vazio=False):
    """
    O posto de enfermagem (7 x 3 casas, balcão em L de 1,1 m): o balcão comprido no fundo e o braço descendo pela
    esquerda até a frente; o corpo creme com as portas e as gavetas, o rodapé, o tampo de fórmica com a borda; em
    cima o computador antigo com o teclado, o telefone, as pastas, a bandeja de papéis, o porta-canetas e a fileira
    de fichários; a cruz verde na ponta do braço.
    vazio: a gêmea esvaziada (posto_enfermagem!vazio): só o balcão, sem nada em cima.
    """
    h = 1.8 / UN
    tp = 0.035
    E = '#d4cebc'
    W = 7 * CASA
    x0, x1, y0, y1 = 0.03, W - 0.03, 0.05, 0.78         # o balcão comprido
    lx0, lx1, ly1 = 0.03, 0.8, 3 * CASA - 0.04          # o braço
    # as portas e gavetas da frente do comprido (de lx1 até o fim) e do lado +x do braço
    pf, xs, zg = _modulos(lx1 + 0.03, x1 - 0.03, 0.09, h - tp, 7, 'f')
    pd = []
    ys = np.linspace(y1 + 0.03, ly1 - 0.03, 3)
    for i in range(2):
        pd.append(('d', 'porta', ys[i] + 0.012, ys[i + 1] - 0.012, h - tp - 0.16, h - tp - 0.02))
        pd.append(('d', 'porta', ys[i] + 0.012, ys[i + 1] - 0.012, 0.11, h - tp - 0.18))
    cruz = [('f', '#f2eee4', lx0 + 0.22, lx1 - 0.22, h - 0.45, h - 0.12), ('f', 'cruz:#3a9a5a', lx0 + 0.22, lx1 - 0.22, h - 0.45, h - 0.12)]
    CORPO = chapa(E, riscas='v', k=(1.03, 0.97), seed=91, gasto=0.07, paineis=pf + pd + cruz)
    caixa((x0 + 0.03, x1 - 0.03, y0 + 0.03, y1 - 0.05, 0.0, 0.09), chapa('#4a4844', riscas=None))
    caixa((lx0 + 0.03, lx1 - 0.05, y1 - 0.05, ly1 - 0.05, 0.0, 0.09), chapa('#4a4844', riscas=None))
    caixa((x0, x1, y0, y1, 0.09, h - tp), CORPO)
    caixa((lx0, lx1, y1, ly1, 0.09, h - tp), CORPO)
    _puxadores(xs, 0.09, h - tp, zg, y1, 1, 7)
    for i in range(2):
        m = (ys[i] + ys[i + 1]) / 2
        _barra((lx1, lx1 + 0.018, m - 0.05, m + 0.05, h - tp - 0.09 - PZ * 0.6, h - tp - 0.09 + PZ * 0.6), CROMO[0], CROMO[1], quina=False)
    # o tampo de fórmica (o salpicado em blocos de 2 px) com a borda escura
    def formica(L, n, P):
        a, b = _uv(n, P)
        out = np.tile(hx('#bdb8a8'), (len(P), 1))
        g = ruido(np.floor(a / (2 * PH)), np.floor(b / (2 * PH)), 3.0)
        out = np.where((g > 0.9)[:, None], hx('#a8a292'), out)
        out = np.where((g < 0.06)[:, None], hx('#d0ccbe'), out)
        return out
    TP = {'cima': emissivo(formica), '*': chapa('#6a6458', riscas=None)}
    caixa((x0 - 0.015, x1 + 0.015, y0 - 0.01, y1 + 0.025, h - tp, h), TP)
    caixa((lx0 - 0.015, lx1 + 0.025, y1 + 0.025, ly1 + 0.025, h - tp, h), TP)
    peg(x0, x1, y0, y1)
    peg(lx0, lx1, y1, ly1)
    if vazio:
        return
    # o computador (o monitor de tubo bege, o teclado) no canto
    _crt(1.25, 0.3, h)
    _teclado(1.05, 1.5, 0.55, 0.7, h)
    # o telefone, as pastas, a bandeja, o porta-canetas, os fichários
    _telefone(2.05, 0.45, h)
    for k, cor in enumerate(('#c8a050', '#7aa0c0', '#c8a050')):
        caixa((2.6 + 0.01 * k, 2.95 + 0.01 * k, 0.3 - 0.01 * k, 0.6 - 0.01 * k, h + k * 0.012, h + (k + 1) * 0.012),
              {'cima': liso(cor), '*': chapa('#efe8d2', riscas=None)})
    CZ.itens_peq.append((2.6, 2.97, 0.28, 0.6, h))
    caixa((3.3, 3.7, 0.3, 0.62, h, h + 0.04), {'cima': emissivo(lambda L, n, P: np.where((np.floor(P[:, 1] / PH) % 3 == 0)[:, None], hx('#b8b0a0'), hx('#f2eee4'))),
                                              '*': chapa('#3a3c3e', riscas=None)})
    CZ.itens_peq.append((3.3, 3.7, 0.3, 0.62, h))
    o = novo()
    C().cilindro(3.9, 0.45, 0.04, h, h + 0.1, vol(3.9, 0.45, '#3a3c3e'), M, o, lados=12, tampa_mat=liso('#1a1a1a'))
    for i, cor in enumerate(('#c8302a', '#3a6ab8', '#2a2a2a')):
        _barra((3.88 + i * 0.015, 3.88 + i * 0.015 + PH, 0.44, 0.44 + PH, h + 0.1, h + 0.16), cor, quina=False)
    for i in range(7):
        cor = ['#3a5a8a', '#8a2a24', '#3a6a4a', '#c8a050', '#3a5a8a', '#5a3a6a', '#8a2a24'][i]
        xx = 4.2 + i * 0.075
        caixa((xx, xx + 0.065, 0.12, 0.42, h, h + 0.3), chapa(cor, riscas=None, topo=_hexs(_tom(hx(cor), 1.15)),
                                                             paineis=[('f', '#ece6d2', xx + 0.015, xx + 0.05, h + 0.15, h + 0.24)]))
    # no braço: a prancheta e a caixa de luvas
    caixa((0.2, 0.55, 1.3, 1.62, h, h + 0.012), {'cima': emissivo(lambda L, n, P: np.where(
        ((np.floor(P[:, 1] / PH) % 3 == 0) & (P[:, 1] > 1.36))[:, None], hx('#a8a090'), hx('#f2eee2'))), '*': liso('#8a5a34')})
    CZ.itens_peq.append((0.2, 0.55, 1.3, 1.62, h))
    caixa((0.25, 0.55, 1.85, 2.0, h, h + 0.1), chapa('#e6eef2', riscas=None, topo='#f2f6f8', paineis=[('f', '#5a8ac8', 0.25, 0.55, h + 0.03, h + 0.06)]))


def _crt(cx, cy, z):
    """O monitor de tubo antigo: a caixa bege da frente, o fundo afunilado, a tela acesa azul-esverdeada, o pé."""
    caixa((cx - 0.09, cx + 0.09, cy - 0.08, cy + 0.08, z, z + 0.03), chapa('#cfc8b4', riscas=None))
    caixa((cx - 0.13, cx + 0.13, cy - 0.12, cy + 0.02, z + 0.06, z + 0.26), chapa('#bdb6a0', riscas=None))
    caixa((cx - 0.06, cx + 0.06, cy - 0.06, cy + 0.04, z + 0.03, z + 0.06), chapa('#bdb6a0', riscas=None))
    w, sz0, sz1 = 0.2, z + 0.05, z + 0.38
    caixa((cx - w, cx + w, cy + 0.02, cy + 0.1, sz0, sz1), chapa('#d8d0ba', riscas=None, gasto=0.05,
                                                                  paineis=[('f', '#2a2c2a', cx - w + 0.03, cx + w - 0.03, sz0 + 0.05, sz1 - 0.03)]), ch=0.01)
    ot = luz_obj()

    def tela(L, n, P):
        a, b = P[:, 0], P[:, 2]
        out = np.tile(hx('#2e5a6a'), (len(P), 1))
        lin = (np.floor((sz1 - 0.05 - b) / PZ) % 3 == 0) & (b < sz1 - 0.07) & (b > sz0 + 0.1)
        comp = (a - (cx - w + 0.06)) < (0.12 + 0.16 * ruido(np.floor((sz1 - b) / (3 * PZ)), 2.0))
        out = np.where((lin & comp)[:, None], hx('#8ad8e0'), out)
        out = np.where(((b > sz1 - 0.065) & (b < sz1 - 0.045))[:, None], hx('#4a8aa0'), out)
        return out
    C().face_plana([(cx - w + 0.045, cy + 0.101, sz0 + 0.065), (cx + w - 0.045, cy + 0.101, sz0 + 0.065), (cx + w - 0.045, cy + 0.101, sz1 - 0.045),
                    (cx - w + 0.045, cy + 0.101, sz1 - 0.045)], (0, 1, 0), emissivo(tela), M, ot)
    _barra((cx + w - 0.05, cx + w - 0.05 + 2 * PH, cy + 0.1, cy + 0.11, sz0 + 0.02, sz0 + 0.02 + 2 * PZ), '#5ef0a0', quina=False)


def _teclado(x0, x1, y0, y1, z):
    def f(L, n, P):
        a, b = P[:, 0], P[:, 1]
        k = (np.floor((a - x0) / PH) % 3 < 2) & (np.floor((b - y0) / PH) % 3 < 2) & (a > x0 + 0.02) & (a < x1 - 0.02) & (b > y0 + 0.02) & (b < y1 - 0.02)
        return np.where(k[:, None], hx('#e2dcc8'), hx('#9a9480'))
    caixa((x0, x1, y0, y1, z, z + 0.03), {'cima': emissivo(f), '*': chapa('#c4bca6', riscas=None)})
    CZ.itens_peq.append((x0, x1, y0, y1, z))


def _telefone(cx, cy, z):
    caixa((cx - 0.1, cx + 0.1, cy - 0.09, cy + 0.09, z, z + 0.06), chapa('#2e3032', riscas=None, topo='#3e4044',
                                                                         paineis=[('t', '#c8c4b4', cx - 0.06, cx + 0.06, cy + 0.0, cy + 0.07)]))
    _p1_malha((cx - 0.12, cx + 0.12, cy - 0.08, cy - 0.01, z + 0.06, z + 0.1), (0.04, 0.03, 0.02, 0.02), BE._p1_mat_rampa(_ACO, 0.2, 1.6), seg=2)
    CZ.itens_peq.append((cx - 0.1, cx + 0.1, cy - 0.09, cy + 0.09, z))


def toilet_steel():
    """
    O vaso de aço da cela (o assento a 0,45 m): o bloco de inox encostado com a pia em cima (a cuba, o bico e o
    botão), a bacia redonda de aço sem tampa com a água, e o pé.
    """
    cx = 0.375
    zs = 0.73 / UN
    zb = 0.92
    A = aco_rampa(2.4, 6.4)
    o = novo()
    C().caixa((cx - 0.26, cx + 0.26, 0.03, 0.27, 0.0, zb), {'*': chapa(INOX, riscas='v', seed=101, k=(1.07, 0.94), gasto=0.1),
                                                          'cima': chapa(INOX_T, riscas=None)}, M, o, ch=0.025)
    o = novo()
    C().face_plana(CA._ret_redondo(cx, 0.15, 0.2, 0.09, 0.04, zb + 0.002), (0, 0, 1),
                   CA.bacia(cx, 0.15, 0.2, 0.09, 0.04, zb + 0.002, aro=0.03, agua=False, esmalte='#b4babc'), M, o)
    _barra((cx - 0.015, cx + 0.015, 0.04, 0.1, zb + 0.002, zb + 0.06), '#8a9092', '#cad0d2', quina=False)
    _barra((cx - 0.015, cx + 0.015, 0.08, 0.11, zb + 0.03, zb + 0.06), '#8a9092', '#cad0d2', quina=False)
    _barra((cx + 0.1, cx + 0.15, 0.27, 0.285, zb - 0.12, zb - 0.07), '#6e7476', '#a0a6a8', quina=False)
    _p1_malha((cx - 0.13, cx + 0.13, 0.22, 0.52, 0.0, 0.26), (0.1, 0.12, 0.0, 0.04), A, seg=2)
    _p1_malha((cx - 0.2, cx + 0.2, 0.2, 0.66, 0.2, zs), (0.17, 0.22, 0.1, 0.02), A, seg=3)
    o = novo()
    C().face_plana(CA._ret_redondo(cx, 0.43, 0.185, 0.215, 0.16, zs + 0.002), (0, 0, 1),
                   CA.bacia(cx, 0.43, 0.185, 0.215, 0.16, zs + 0.002, aro=0.04, agua=True, esmalte='#c4cacc'), M, o)
    peg(cx - 0.26, cx + 0.26, 0.03, 0.66)


def trash_bin():
    """A lixeira de pedal (0,4 m): o corpo de inox escovado, o aro de baixo, a tampa abaulada com a dobradiça e o pedal."""
    cx, cy = 0.375, 0.38
    r = 0.15
    zt = 0.65 / UN

    def faixa(P, b):
        zz = P[:, 2]
        b = np.where((zz < 0.03)[:, None], hx('#3a3c3e'), b)
        return np.where(((zz > zt - 0.05) & (zz < zt - 0.05 + PZ))[:, None], _tom(b, 0.8), b)
    o = novo()
    _poligono_rodado(cx, cy, [(0.0, r * 0.94), (zt - 0.04, r)], vol(cx, cy, '#a8aeb0', brilho=0.6, faixas=faixa), o, lados=24)
    o = novo()
    _poligono_rodado(cx, cy, [(zt - 0.04, r + 0.008), (zt - 0.02, r + 0.006), (zt, r * 0.82), (zt + 0.012, r * 0.5)],
                     vol(cx, cy, '#b8bec0', brilho=0.6), o, lados=24, tampa_mat=liso('#d2d8da'))
    _barra((cx - 0.05, cx + 0.05, cy - r - 0.02, cy - r + 0.01, zt - 0.06, zt - 0.03), '#5a6062', quina=False)
    _barra((cx - 0.06, cx + 0.06, cy + r - 0.02, cy + r + 0.05, 0.015, 0.04), '#2e3032', '#4a4c4e', quina=False)
    peg(cx - r, cx + r, cy - r, cy + r)


def mesa_contencao():
    """
    A mesa de contenção (2 x 3 casas, aumento 1,2: 1,8 x 2,7 m; 1,08 m): o tampo de inox com a beira levantada e o
    ralo no pé, as quatro pernas quadradas (nada embaixo: passa-se por baixo), as correias de couro de través com as
    fivelas, as algemas de couro dos pulsos e dos tornozelos; a ferrugem e as manchas velhas.
    """
    w, d = 1.5 * 1.2, 2.25 * 1.2
    x, y = 0.75 - w / 2, 1.125 - d / 2
    h = 1.76 / UN
    tp = 0.06
    m = 0.1
    for (a, b) in ((x + m, y + m), (x + w - m - 0.06, y + m), (x + m, y + d - m - 0.06), (x + w - m - 0.06, y + d - m - 0.06)):
        caixa((a, a + 0.06, b, b + 0.06, 0.03, h - tp), chapa(INOX, riscas='v', seed=111, manchas=('#6a3a1e', 0.18, 0.12), topo=INOX_T))
        caixa((a - 0.01, a + 0.07, b - 0.01, b + 0.07, 0.0, 0.03), liso('#3a3c3e'))
    # o tampo com a beira e o ralo
    cx = x + w / 2

    def topo(out, a, b, lado, P):
        if lado != 't':
            return out
        ral = np.hypot((a - cx) / PH, (b - (y + d - 0.2)) / PH)
        out = np.where((ral < 2.2)[:, None], hx('#1e2022'), out)
        out = np.where(((ral >= 2.2) & (ral < 3.2))[:, None], hx('#7a8284'), out)
        # o escorrido escuro até o ralo
        esc = (np.abs(a - cx - 0.03 * np.sin(b * 9)) < 0.03) & (b > y + d * 0.55) & (b < y + d - 0.2)
        return np.where(esc[:, None], _tom(out, 0.8), out)
    TOPO = chapa(INOX_T, riscas='h', seed=112, passo=0.05, k=(1.06, 0.94), manchas=('#5a2418', 0.1, 0.22), extra=topo)
    caixa((x, x + w, y, y + d, h - tp, h - 0.015), {'cima': TOPO, '*': chapa(INOX, riscas=None, manchas=('#5a3a1e', 0.12, 0.14))})
    B = {'cima': liso(INOX_T), '*': chapa(INOX, riscas=None, manchas=('#5a3a1e', 0.1, 0.14))}
    caixa((x, x + w, y, y + 0.035, h - 0.015, h + 0.01), B)
    caixa((x, x + w, y + d - 0.035, y + d, h - 0.015, h + 0.01), B)
    caixa((x, x + 0.035, y + 0.035, y + d - 0.035, h - 0.015, h + 0.01), B)
    caixa((x + w - 0.035, x + w, y + 0.035, y + d - 0.035, h - 0.015, h + 0.01), B)
    peg(x + m, x + w - m, y + m, y + d - m)
    # as correias de través (o couro marrom gasto, a costura, a fivela) e as algemas
    COURO = chapa('#6a3a1e', riscas='h', seed=113, passo=0.03, k=(1.12, 0.88), gasto=0.15)
    for yc in (y + 0.75, y + 1.35, y + 2.0):
        caixa((x - 0.01, x + w + 0.01, yc - 0.045, yc + 0.045, h - 0.015, h + 0.022), {'cima': COURO, '*': chapa('#5a3018', riscas=None)})
        for xx in (x - 0.012, x + w + 0.002):
            caixa((xx, xx + 0.012, yc - 0.045, yc + 0.045, h - 0.22, h - 0.015), chapa('#5a3018', riscas='v', seed=114))
        _barra((x + w * 0.62, x + w * 0.62 + 0.07, yc - 0.055, yc + 0.055, h + 0.022, h + 0.03), '#a8aeb0', '#dde2e3', quina=False)
        _barra((x + w * 0.62 + 0.015, x + w * 0.62 + 0.055, yc - 0.035, yc + 0.035, h + 0.022, h + 0.031), '#5a3018', quina=False)
    for (xx, yc) in ((x + 0.12, y + 1.0), (x + w - 0.24, y + 1.0), (x + w / 2 - 0.25, y + d - 0.3), (x + w / 2 + 0.13, y + d - 0.3)):
        caixa((xx, xx + 0.12, yc - 0.05, yc + 0.05, h, h + 0.05), {'cima': chapa('#7a4424', riscas=None, paineis=[('t', '#3a1e10', xx + 0.03, xx + 0.09, yc - 0.025, yc + 0.025)]),
                                                                  '*': chapa('#5a3018', riscas='h', seed=115)}, ch=0.01)
        _barra((xx + 0.04, xx + 0.08, yc + 0.05, yc + 0.06, h + 0.015, h + 0.035), '#a8aeb0', '#dde2e3', quina=False)


def bed_curtain(fechada=True):
    """
    A cortina do leito (3 x 4 casas, 2,2 m): o trilho de tubo em U (os lados e a frente; o fundo é o lado aberto),
    preso no teto por quatro hastes que sobem e somem; o pano verde-claro franzido nas argolas, com a barra de baixo.
    Fechada: o pano corre pelos três lados. Aberta: franzido nos dois cantos de trás.
    """
    xl, xr, yb, yf = 0.06, 3 * CASA - 0.06, 0.06, 4 * CASA - 0.1
    zr = 3.59 / UN
    z0, z1 = 0.32, zr - 0.07
    # o trilho e as quinas
    o = novo()
    TR = ('#c8ccc6', '#eef2ec')
    tubo_y(yb, yf, xl, zr, r=0.018, cor=TR[0], topo=TR[1], oid=o)
    tubo_y(yb, yf, xr, zr, r=0.018, cor=TR[0], topo=TR[1], oid=o)
    tubo_x(xl, xr, yf, zr, r=0.018, cor=TR[0], topo=TR[1], oid=o)
    for (a, b) in ((xl, yb), (xr, yb), (xl, yf), (xr, yf)):
        _barra((a - 0.03, a + 0.03, b - 0.03, b + 0.03, zr - 0.03, zr + 0.03), '#a8aca6', '#d8dcd6', quina=False)
        of = C().novo_obj(3, sombra=False, contorno=False)
        C().caixa((a - 0.012, a + 0.012, b - 0.012, b + 0.012, zr + 0.03, zr + 0.75), liso('#9ea29c'), M, of)
        CZ.fades.append((of, zr + 0.1, 0.5))
    def lado(p0, p1, passo, fundo, ini=1):
        p0, p1 = np.array(p0, float), np.array(p1, float)
        L = np.linalg.norm(p1 - p0)
        u = (p1 - p0) / L
        v = np.array([-u[1], u[0]])
        n = max(2, int(round(L / passo)))
        pts = [p0 + u * L * i / n + v * fundo * (ini if i % 2 else -ini) * 0.5 for i in range(n + 1)]
        PANO = _pano_mat(z0, z1, 0 if abs(u[0]) > 0.5 else 1, p0[0] if abs(u[0]) > 0.5 else p0[1], 2 * L / n)
        oc = novo()
        for a, b in zip(pts[:-1], pts[1:]):
            dd = b - a
            nn = np.array([-dd[1], dd[0]]) / np.linalg.norm(dd)
            C().face_plana([(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)], (nn[0], nn[1], 0), PANO, M, oc, dois_lados=True)
        # as argolas
        for p in pts[::2]:
            _barra((p[0] - PH, p[0] + PH, p[1] - PH, p[1] + PH, z1 - 0.01, zr - 0.012), '#8a8e88', '#c8ccc6', quina=False)
        CZ.pegadas.append((min(p0[0], p1[0]) - 0.03, max(p0[0], p1[0]) + 0.03, min(p0[1], p1[1]) - 0.03, max(p0[1], p1[1]) + 0.03))
    if fechada:
        lado((xl, yb + 0.04), (xl, yf), 0.07, 0.035)
        lado((xl, yf), (xr, yf), 0.07, 0.035)
        lado((xr, yf), (xr, yb + 0.04), 0.07, 0.035)
    else:
        lado((xl, yb + 0.04), (xl, yb + 0.55), 0.045, 0.05)
        lado((xr, yb + 0.55), (xr, yb + 0.04), 0.045, 0.05)


def _pano_mat(z0, z1, eixo, org, periodo):
    """
    O pano da cortina: o verde-claro com as pregas pintadas (a crista clara, o meio, o fundo escuro, um período por
    dobra), a barra de baixo (a costura clara e a escura) e o cabeçalho branco de cima.
    """
    c0 = hx(MENTA)

    def f(L, n, P):
        zz = P[:, 2]
        al = np.floor((P[:, eixo] - org) / PH) * PH
        u = ((al - org) / periodo + 0.25) % 1
        out = np.tile(c0, (len(P), 1))
        out = np.where((u < 0.3)[:, None], _tom(c0, 1.12), out)
        out = np.where(((u >= 0.62) & (u < 0.82))[:, None], _tom(c0, 0.84), out)
        out = np.where((u >= 0.82)[:, None], _tom(c0, 0.93), out)
        out = np.where((zz < z0 + 0.06)[:, None], _tom(c0, 0.94), out)
        out = np.where(((zz >= z0 + 0.06) & (zz < z0 + 0.06 + PZ))[:, None], _tom(c0, 0.78), out)
        out = np.where(((zz >= z0 + 0.06 + PZ) & (zz < z0 + 0.06 + 2 * PZ))[:, None], _tom(c0, 1.12), out)
        out = np.where((zz > z1 - 0.05)[:, None], hx('#e8ece4'), out)
        out = np.where(((zz > z1 - 0.05 - PZ) & (zz <= z1 - 0.05))[:, None], _tom(c0, 0.8), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# o arsenal e a prisão: as armas, as caixas, os armários de aço, as mesas, as banquetas, a cama de ferro
# =====================================================================================================================
COR_MAD_ARMA = '#7a4626'
COR_ARMA = '#2a2c2e'


def _pe(b, cor, topo=None):
    """Uma peça de arma (a caixa chapada com a quina clara)."""
    return _barra(b, cor, topo or _hexs(_tom(hx(cor), 1.35)), quina=1.25)


def fuzil_em_pe(x, y, z0, cor=COR_MAD_ARMA, d=0.022):
    """O fuzil em pé no rack (o perfil no plano x-z, para a frente): a coronha, o punho, o carregador, a caixa, o guarda-mão e o cano."""
    Y = (y - d, y + d)
    _pe((x - 0.055, x + 0.03, *Y, z0, z0 + 0.06), '#1e1e20')                  # a soleira
    _pe((x - 0.05, x + 0.03, *Y, z0 + 0.06, z0 + 0.2), cor)
    _pe((x - 0.035, x + 0.03, *Y, z0 + 0.2, z0 + 0.32), cor)
    _pe((x - 0.03, x + 0.035, y - d * 0.9, y + d * 0.9, z0 + 0.32, z0 + 0.62), COR_ARMA)   # a caixa da culatra
    _pe((x - 0.075, x - 0.03, y - d * 0.7, y + d * 0.7, z0 + 0.34, z0 + 0.42), COR_ARMA)    # o punho
    _pe((x + 0.035, x + 0.1, y - d * 0.7, y + d * 0.7, z0 + 0.44, z0 + 0.56), '#3a3c3e')    # o carregador
    _pe((x + 0.085, x + 0.12, y - d * 0.7, y + d * 0.7, z0 + 0.4, z0 + 0.46), '#3a3c3e')
    _pe((x - 0.025, x + 0.028, *Y, z0 + 0.62, z0 + 0.86), cor)                # o guarda-mão
    _pe((x - 0.008, x + 0.008, y - 0.008, y + 0.008, z0 + 0.86, z0 + 1.08), '#3a3c3e')     # o cano
    _pe((x - 0.012, x + 0.012, y - 0.01, y + 0.01, z0 + 1.0, z0 + 1.03), '#1e1e20')


def espada_em_pe(x, y, z0, comp=0.78, guarda='#b8862e'):
    """A espada em pé, a ponta para baixo: a lâmina com o fio claro, a guarda de latão, o punho de couro e o pomo."""
    o = novo()
    zl = z0 + comp

    def lamina(L, n, P):
        out = np.tile(hx('#b8c0c4'), (len(P), 1))
        out = np.where((np.abs(P[:, 0] - x) < PH * 0.5)[:, None], hx('#8a9498'), out)
        out = np.where((P[:, 0] > x + 0.016)[:, None], hx('#eef4f6'), out)
        return out
    C().face_plana([(x - 0.006, y, z0), (x + 0.006, y, z0), (x + 0.028, y, z0 + 0.1), (x + 0.028, y, zl), (x - 0.028, y, zl), (x - 0.028, y, z0 + 0.1)],
                   (0, 1, 0), emissivo(lamina), M, o, dois_lados=True)
    _pe((x - 0.07, x + 0.07, y - 0.015, y + 0.015, zl, zl + 0.025), guarda)
    _pe((x - 0.015, x + 0.015, y - 0.015, y + 0.015, zl + 0.025, zl + 0.17), '#4a2a16')
    o = novo()
    C().elipsoide(np.array([x, y, zl + 0.19]), np.array([0.025, 0.02, 0.025]), liso(guarda), o, brilho=0.4)


def fuzil_deitado(x, y, z, cor=COR_MAD_ARMA, comp=1.0):
    """O fuzil deitado de lado no tampo (o perfil no plano x-y, a coronha em x e o cano para +x)."""
    k = comp
    h = 0.04
    _pe((x, x + 0.06 * k, y - 0.05, y + 0.03, z, z + h), '#1e1e20')
    _pe((x + 0.06 * k, x + 0.32 * k, y - 0.045, y + 0.03, z, z + h), cor)
    _pe((x + 0.32 * k, x + 0.6 * k, y - 0.03, y + 0.035, z, z + h * 1.1), COR_ARMA)
    _pe((x + 0.33 * k, x + 0.39 * k, y + 0.035, y + 0.1, z, z + h * 0.8), COR_ARMA)
    _pe((x + 0.46 * k, x + 0.55 * k, y + 0.035, y + 0.15, z, z + h * 0.8), '#3a3c3e')
    _pe((x + 0.6 * k, x + 0.84 * k, y - 0.024, y + 0.028, z, z + h), cor)
    _pe((x + 0.84 * k, x + 1.06 * k, y - 0.008, y + 0.008, z + 0.01, z + 0.026), '#3a3c3e')
    _pe((x + 0.4 * k, x + 0.52 * k, y - 0.01, y + 0.012, z + h * 1.1, z + h * 1.1 + 0.03), '#1e1e20')     # a mira
    CZ.itens_peq.append((x, x + 1.06 * k, y - 0.05, y + 0.15, z))


def espingarda_deitada(x, y, z):
    _pe((x, x + 0.34, y - 0.045, y + 0.025, z, z + 0.04), '#8a5430')
    _pe((x + 0.34, x + 0.48, y - 0.025, y + 0.025, z, z + 0.045), COR_ARMA)
    _pe((x + 0.38, x + 0.44, y + 0.025, y + 0.07, z, z + 0.03), COR_ARMA)
    _pe((x + 0.48, x + 1.0, y - 0.012, y + 0.012, z + 0.008, z + 0.03), '#3a3c3e')
    _pe((x + 0.6, x + 0.8, y - 0.024, y + 0.024, z, z + 0.035), '#8a5430')
    CZ.itens_peq.append((x, x + 1.0, y - 0.045, y + 0.07, z))


def pistola_deitada(x, y, z, cor=COR_ARMA):
    """A pistola deitada (vista de cima): o ferrolho e o cabo em L."""
    _pe((x, x + 0.19, y - 0.018, y + 0.018, z, z + 0.03), cor)
    _pe((x, x + 0.06, y + 0.018, y + 0.12, z, z + 0.028), '#3a2a20')
    _pe((x + 0.06, x + 0.09, y + 0.018, y + 0.05, z, z + 0.012), cor)
    CZ.itens_peq.append((x, x + 0.19, y - 0.02, y + 0.12, z))


def carregador(x, y, z):
    _pe((x, x + 0.05, y, y + 0.16, z, z + 0.025), '#3a3c3e')
    _pe((x + 0.012, x + 0.038, y - 0.012, y, z + 0.006, z + 0.022), '#c8a050')
    CZ.itens_peq.append((x, x + 0.05, y - 0.012, y + 0.16, z))


def faca_deitada(x, y, z):
    o = novo()

    def lam(L, n, P):
        return np.where((P[:, 1] > y + 0.005)[:, None], hx('#e2eaec'), hx('#a8b0b4'))
    C().face_plana([(x + 0.12, y - 0.012, z + 0.008), (x + 0.3, y - 0.012, z + 0.008), (x + 0.33, y + 0.015, z + 0.008), (x + 0.12, y + 0.02, z + 0.008)],
                   (0, 0, 1), emissivo(lam), M, o)
    _pe((x, x + 0.12, y - 0.016, y + 0.02, z, z + 0.022), '#2a2a2a')
    _pe((x + 0.11, x + 0.125, y - 0.035, y + 0.04, z, z + 0.024), '#8a9094')
    CZ.itens_peq.append((x, x + 0.33, y - 0.035, y + 0.04, z))


def lata_municao(x0, x1, y0, y1, z0, alto, seed=0, cor=OLIVA):
    """A lata de munição: o corpo verde-oliva gasto, a tampa com a borda, a alça dobrada em cima, a trava do lado e a faixa amarela."""
    zt = z0 + alto
    zl = zt - 0.035
    pain = [('f', '#c8a83a', x0 + 0.03, x1 - 0.03, z0 + alto * 0.35, z0 + alto * 0.35 + 2 * PZ),
            ('d', '#c8a83a', y0 + 0.04, y1 - 0.04, z0 + alto * 0.35, z0 + alto * 0.35 + 2 * PZ)]
    caixa((x0, x1, y0, y1, z0, zl), chapa(cor, riscas='h', seed=seed, k=(1.05, 0.94), gasto=0.14, paineis=pain))
    caixa((x0 - 0.008, x1 + 0.008, y0 - 0.008, y1 + 0.008, zl, zt), {'cima': chapa(_hexs(_tom(hx(cor), 1.12)), riscas=None, gasto=0.1, seed=seed + 1),
                                                                    '*': chapa(_hexs(_tom(hx(cor), 0.9)), riscas=None)})
    cx = (x0 + x1) / 2
    # a alça: a barra dobrada em cima, presa nos dois apoios
    for yy in (y0 + 0.07, y1 - 0.09):
        _barra((cx - 0.02, cx + 0.02, yy, yy + 0.02, zt, zt + 0.012), '#3a3e2a', quina=False)
    _barra((cx - 0.012, cx + 0.012, y0 + 0.08, y1 - 0.08, zt + 0.01, zt + 0.022), '#2a2c2e', '#4a4c4e', quina=False)
    # a trava do lado (+x)
    _barra((x1 + 0.008, x1 + 0.022, y1 - 0.12, y1 - 0.05, zt - 0.1, zt - 0.01), '#4a4e36', '#6e7450', quina=False)


def ammo_box():
    """A caixa de munição (0,3 m): duas latas verde-oliva lado a lado."""
    zt = 0.49 / UN
    lata_municao(0.1, 0.35, 0.12, 0.64, 0.0, zt, seed=121)
    lata_municao(0.4, 0.65, 0.1, 0.62, 0.0, zt, seed=122, cor='#545a36')
    peg(0.1, 0.65, 0.1, 0.64)


def chest_army(aberto=False):
    """
    O baú militar (0,45 m): as tábuas pintadas de verde-oliva, as cantoneiras e as bordas de aço, as alças de corda
    nos lados, os dois fechos e a plaquinha na frente. Aberto: a tampa em pé atrás, o lado de dentro escuro, o colete
    dobrado e as duas lanternas.
    """
    x0, x1, y0, y1 = 0.06, 0.69, 0.15, 0.62
    zt = 0.73 / UN
    zl = zt - 0.12
    TAB = tab2(['#5a6038', '#556036', '#5e643c'], 0.1, '#2e3220', eixo=0, seed=131, comp=None, org=0.0)
    AC = '#3a3e34'
    pain = [('f', 'placa', (x0 + x1) / 2 - 0.09, (x0 + x1) / 2 + 0.09, zl - 0.14, zl - 0.06)]
    if not aberto:
        caixa((x0, x1, y0, y1, 0.0, zl), {'cima': liso('#4a5030'), '*': _sobre(TAB, pain)})
        caixa((x0 - 0.008, x1 + 0.008, y0 - 0.008, y1 + 0.008, zl, zt),
              {'cima': tab2(['#5e643c', '#5a6038', '#626a40'], 0.1, '#2e3220', eixo=0, seed=132, org=y0), '*': TAB})
    else:
        e = 0.025
        D = {'*': TAB, 'cima': liso('#6a704a')}
        caixa((x0, x1, y1 - e, y1, 0.0, zl), {'frente': _sobre(TAB, pain), '*': TAB, 'cima': liso('#6a704a')})
        caixa((x0, x1, y0, y0 + e, 0.0, zl), D)
        caixa((x0, x0 + e, y0, y1, 0.0, zl), D)
        caixa((x1 - e, x1, y0, y1, 0.0, zl), D)
        caixa((x0 + e, x1 - e, y0 + e, y1 - e, 0.0, 0.03), liso('#2a2c22'))
        # o colete dobrado e as lanternas
        _p1_malha((x0 + 0.04, x1 - 0.04, y0 + 0.04, y1 - 0.04, 0.03, zl - 0.06), (0.05, 0.05, 0.03, 0.05),
                  BE._p1_mat_rampa(BE._p1_rampa(['#4a3e26', '#5e5032', '#72633e', '#86764a', '#9a8858', '#ac9a66']), 1.2, 4.8), seg=2)
        for (xx, zz) in ((x0 + 0.2, zl - 0.07), (x0 + 0.38, zl - 0.07)):
            _pe((xx - 0.025, xx + 0.025, y0 + 0.1, y0 + 0.3, zz, zz + 0.05), '#2a2a2a')
            _pe((xx - 0.032, xx + 0.032, y0 + 0.3, y0 + 0.36, zz, zz + 0.064), '#3a3c3e')
            _barra((xx - 0.022, xx + 0.022, y0 + 0.36, y0 + 0.362, zz + 0.006, zz + 0.058), '#f0e8b8', quina=False)
        # a tampa em pé atrás (a parte de dentro para a frente)
        caixa((x0 - 0.008, x1 + 0.008, y0 - 0.12, y0 - 0.008, zl, zl + (y1 - y0) + 0.016),
              {'frente': chapa('#3a4028', riscas='h', seed=133), '*': TAB})
    # as cantoneiras de aço nas quinas e as bordas
    for (a, b) in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
        _barra((a - 0.012, a + 0.012, b - 0.012, b + 0.012, 0.0, zl), AC, '#5a5e54', quina=False)
    _barra((x0 - 0.01, x1 + 0.01, y1, y1 + 0.012, 0.0, 0.025), AC, quina=False)
    _barra((x0 - 0.01, x1 + 0.01, y1, y1 + 0.012, zl - 0.025, zl), AC, '#5a5e54', quina=False)
    # as alças de corda nos lados e os fechos
    for xx in (x0 - 0.02, x1 + 0.005):
        _barra((xx, xx + 0.015, (y0 + y1) / 2 - 0.08, (y0 + y1) / 2 + 0.08, zl - 0.1, zl - 0.07), '#b8a070', '#d8c090', quina=False)
    if not aberto:
        for xx in (x0 + 0.12, x1 - 0.16):
            _barra((xx, xx + 0.04, y1 + 0.008, y1 + 0.02, zl - 0.06, zl + 0.04), '#8a9094', '#c8ced0', quina=False)
    peg(x0, x1, y0, y1)


def _sobre(mat, paineis):
    """O material com os painéis por cima."""
    def f(L, n, P):
        out = mat(L, n, P)
        a, b = _uv(n, P)
        return pintar_paineis(out, a, b, _lado(n), paineis, out[0] if len(out) else hx('#808080'))
    return emissivo(f)


def armario_aco(x0, x1, y0, y1, zt, cor, portas=1, aberto=False, conteudo=None, cadeado=True, seed=0):
    """
    O armário de chapa: o rodapé, o corpo com as frestas, as portas com as venezianas em cima e embaixo, a plaquinha,
    o puxador e o cadeado. Aberto (uma porta): a carcaça fina, o lado de dentro, a porta aberta a 90° pela
    dobradiça da esquerda e o `conteudo()`.
    """
    zb = 0.06
    zc = zt - 0.04
    W = (x1 - x0) / portas
    pf = []
    for i in range(portas):
        a0, a1 = x0 + i * W + 0.02, x0 + (i + 1) * W - 0.02
        pf += [('f', 'porta', a0, a1, zb + 0.03, zc - 0.03), ('f', 'grade', a0 + 0.05, a1 - 0.05, zc - 0.2, zc - 0.08),
               ('f', 'grade', a0 + 0.05, a1 - 0.05, zb + 0.08, zb + 0.2), ('f', 'placa', a0 + 0.05, min(a1 - 0.05, a0 + 0.17), zc - 0.3, zc - 0.24)]
    lat = [(ld, 'fresta', y0 + 0.03, y1 - 0.03, zb + 0.03, zc - 0.03) for ld in ('d', 'e')]
    CORPO = chapa(cor, riscas='v', seed=seed, k=(1.05, 0.95), gasto=0.1, topo=_hexs(_tom(hx(cor), 1.1)), paineis=pf + lat)
    caixa((x0 + 0.02, x1 - 0.02, y0 + 0.02, y1 - 0.03, 0.0, zb), chapa('#26282a', riscas=None))
    if not aberto:
        caixa((x0, x1, y0, y1, zb, zc), CORPO)
        for i in range(portas):
            a1 = x0 + (i + 1) * W - 0.02
            hx0 = a1 - 0.07
            _barra((hx0, hx0 + 0.025, y1, y1 + 0.02, zc * 0.52 - 0.08, zc * 0.52 + 0.04), '#3a3c3e', '#6a6c6e', quina=False)
            if cadeado:
                _cadeado(hx0 + 0.0125, y1 + 0.02, zc * 0.52 - 0.13)
    else:
        e = 0.02
        IN = chapa(_hexs(_tom(hx(cor), 0.78)), riscas='v', seed=seed + 1)
        caixa((x0, x1, y0, y0 + e, zb, zc), {'frente': IN, '*': CORPO})
        caixa((x0, x0 + e, y0, y1, zb, zc), {'dir': IN, '*': CORPO})
        caixa((x1 - e, x1, y0, y1, zb, zc), {'esq': IN, '*': CORPO})
        caixa((x0, x1, y0, y1, zb, zb + e), {'cima': IN, '*': CORPO})
        caixa((x0, x1, y0, y1, zc - e, zc), {'baixo': IN, '*': CORPO})
        # a porta aberta (a parte de dentro olha para +x)
        pd = [('d', 'porta', y1 + 0.02, y1 + W - 0.02, zb + 0.03, zc - 0.03), ('d', 'grade', y1 + 0.07, y1 + W - 0.07, zc - 0.2, zc - 0.08),
              ('d', 'grade', y1 + 0.07, y1 + W - 0.07, zb + 0.08, zb + 0.2)]
        caixa((x0 - 0.02, x0, y1, y1 + W, zb + 0.01, zc - 0.01), {'dir': chapa(_hexs(_tom(hx(cor), 0.88)), riscas='v', seed=seed + 2, paineis=pd), '*': CORPO})
        if conteudo:
            conteudo(x0 + e, x1 - e, y0 + e, y1, zb + e, zc - e)
    caixa((x0 - 0.01, x1 + 0.01, y0 - 0.005, y1 + 0.01, zc, zt), {'cima': chapa(_hexs(_tom(hx(cor), 1.12)), riscas=None, gasto=0.1, seed=seed + 3),
                                                                 '*': chapa(_hexs(_tom(hx(cor), 0.92)), riscas=None)})
    peg(x0, x1, y0, y1)


def _cadeado(x, y, z):
    """O cadeado de latão (o corpo e a alça)."""
    _barra((x - 0.025, x + 0.025, y, y + 0.02, z - 0.05, z), '#b8862e', '#e8c060', quina=False)
    _barra((x - 0.017, x - 0.009, y + 0.005, y + 0.015, z, z + 0.035), '#9aa2a6', quina=False)
    _barra((x + 0.009, x + 0.017, y + 0.005, y + 0.015, z, z + 0.035), '#9aa2a6', quina=False)
    _barra((x - 0.017, x + 0.017, y + 0.005, y + 0.015, z + 0.028, z + 0.038), '#9aa2a6', '#d0d6d8', quina=False)


def _prateleiras(x0, x1, y0, y1, zs, cor):
    for zz in zs:
        caixa((x0, x1, y0, y1, zz - 0.015, zz), {'cima': liso(_hexs(_tom(hx(cor), 0.95))), '*': chapa(_hexs(_tom(hx(cor), 0.8)), riscas=None)})


def locker_ammo(aberto=False):
    """O armário de munição (1,9 m): o aço verde-oliva com o cadeado. Aberto: as latas de munição e os carregadores nas prateleiras."""
    def dentro(x0, x1, y0, y1, z0, z1):
        zs = [z0 + 0.45, z0 + 0.9, z0 + 1.35]
        _prateleiras(x0, x1, y0, y1 - 0.04, zs, OLIVA)
        lata_municao(x0 + 0.03, x0 + 0.24, y0 + 0.05, y0 + 0.4, z0, 0.22, seed=141)
        lata_municao(x0 + 0.28, x1 - 0.03, y0 + 0.05, y0 + 0.4, z0, 0.22, seed=142, cor='#545a36')
        lata_municao(x0 + 0.05, x1 - 0.05, y0 + 0.05, y0 + 0.38, zs[0], 0.2, seed=143)
        for i in range(6):
            carregador(x0 + 0.04 + i * 0.07, y0 + 0.12, zs[1])
        for i in range(3):
            caixa((x0 + 0.03 + i * 0.15, x0 + 0.15 + i * 0.15, y0 + 0.06, y0 + 0.3, zs[2], zs[2] + 0.12),
                  chapa(['#8a6a3a', '#a07a44', '#8a6a3a'][i], riscas=None, paineis=[('f', '#d8c8a0', x0 + 0.05 + i * 0.15, x0 + 0.13 + i * 0.15, zs[2] + 0.04, zs[2] + 0.08)]))
    armario_aco(0.08, 0.67, 0.08, 0.66, 3.1 / UN, OLIVA, 1, aberto, dentro, seed=151)


def locker(aberto=False):
    """O armário de metal da prisão (1,95 m): o aço cinza. Aberto: o macacão laranja no cabide, as botinas e a toalha na prateleira."""
    def dentro(x0, x1, y0, y1, z0, z1):
        zs = [z1 - 0.3]
        _prateleiras(x0, x1, y0, y1 - 0.04, zs, CINZA_A)
        caixa((x0 + 0.05, x1 - 0.05, y0 + 0.06, y0 + 0.36, zs[0], zs[0] + 0.1), {'cima': liso('#e8e4d8'), '*': chapa('#d8d2c2', riscas='h', passo=0.02)})
        tubo_x(x0, x1, (y0 + y1) / 2, zs[0] - 0.08, r=0.012)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        _barra((cx - 0.15, cx + 0.15, cy - 0.01, cy + 0.01, zs[0] - 0.16, zs[0] - 0.14), '#8a5a34', quina=False)
        LAR = chapa('#d8642a', riscas='v', seed=161, passo=0.04, k=(1.08, 0.9))
        caixa((cx - 0.15, cx + 0.15, cy - 0.04, cy + 0.04, zs[0] - 0.62, zs[0] - 0.15), LAR)
        for dx in (-0.1, 0.03):
            caixa((cx + dx, cx + dx + 0.07, cy - 0.035, cy + 0.035, zs[0] - 1.0, zs[0] - 0.62), LAR)
        for dx in (-0.12, 0.0):
            _pe((cx + dx, cx + dx + 0.1, y0 + 0.15, y0 + 0.4, z0, z0 + 0.09), '#2a2018')
    armario_aco(0.12, 0.63, 0.1, 0.62, 3.18 / UN, CINZA_A, 1, aberto, dentro, cadeado=False, seed=171)


def locker_row():
    """Os armários de vestiário (2 casas, 1,9 m): três portas estreitas de aço azulado com as venezianas, as plaquinhas e os cadeados."""
    armario_aco(0.04, 1.46, 0.08, 0.62, 3.1 / UN, AZUL_A, 3, seed=181)


def weapon_rack():
    """
    O armário de armas (2 casas, 2 m): o aço verde-oliva aberto na frente, as duas gavetas embaixo, o pente de
    madeira com os encaixes, cinco fuzis em pé e duas espadas; a cimalha.
    """
    x0, x1, y0, y1 = 0.04, 1.46, 0.1, 0.66
    zt = 3.27 / UN
    zg = 0.5
    zc = zt - 0.06
    meio = (x0 + x1) / 2
    pain = [('f', 'porta', x0 + 0.03, meio - 0.006, 0.1, zg - 0.03), ('f', 'porta', meio + 0.006, x1 - 0.03, 0.1, zg - 0.03),
            ('f', 'placa', x0 + 0.25, x0 + 0.45, zg - 0.16, zg - 0.1), ('f', 'placa', meio + 0.25, meio + 0.45, zg - 0.16, zg - 0.1)]
    COR = chapa(OLIVA, riscas='v', seed=191, gasto=0.12, k=(1.05, 0.95), topo=OLIVA_C, paineis=pain)
    IN = chapa('#3e4428', riscas='v', seed=192)
    caixa((x0 + 0.02, x1 - 0.02, y0 + 0.02, y1 - 0.03, 0.0, 0.07), chapa('#26282a', riscas=None))
    caixa((x0, x1, y0, y1, 0.07, zg), COR)
    for xx in ((x0 + meio) / 2, (meio + x1) / 2):
        _barra((xx - 0.06, xx + 0.06, y1, y1 + 0.02, zg - 0.08, zg - 0.08 + 2 * PZ), '#8a9094', '#c8ced0', quina=False)
    e = 0.03
    caixa((x0, x1, y0, y0 + e, zg, zc), {'frente': IN, '*': COR})
    caixa((x0, x0 + e, y0, y1, zg, zc), {'dir': IN, '*': COR})
    caixa((x1 - e, x1, y0, y1, zg, zc), {'esq': IN, '*': COR})
    caixa((x0 - 0.015, x1 + 0.015, y0 - 0.01, y1 + 0.02, zc, zt), {'cima': chapa(OLIVA_C, riscas=None, gasto=0.1), '*': chapa(OLIVA, riscas=None)})
    caixa((x0, x1, y0, y1, zc - 0.03, zc), {'baixo': IN, '*': COR})
    # o pé do rack (os encaixes da coronha) e o pente de madeira
    caixa((x0 + e, x1 - e, y0 + 0.2, y1 - 0.06, zg, zg + 0.06), {'cima': liso('#2a2c22'), '*': mad2('#6a4024', seed=193, passo=0.04)})
    zp = 1.22

    def pente(out, a, b, lado, P):
        if lado not in 'ft':
            return out
        g = (a - x0 - 0.17 + 0.02) % 0.19
        return np.where(((g > 0.0) & (g < 0.04) & (a < x0 + 0.9))[:, None], hx('#2a1a10'), out)
    caixa((x0 + e, x1 - e, y0 + 0.22, y0 + 0.32, zp, zp + 0.06), {'cima': chapa('#7a4a28', riscas=None, extra=pente), '*': chapa('#6a4024', riscas=None, extra=pente)})
    for i in range(4):
        fuzil_em_pe(x0 + 0.17 + i * 0.19, y0 + 0.27, zg + 0.03, cor=COR_MAD_ARMA if i % 2 == 0 else '#3a3c3e')
    espada_em_pe(x1 - 0.42, y0 + 0.27, zg + 0.06)
    espada_em_pe(x1 - 0.2, y0 + 0.27, zg + 0.06, comp=0.66, guarda='#8a9094')
    peg(x0, x1, y0, y1)


def mesa_arsenal():
    """
    A mesa grande do arsenal (4 x 2 casas, aumento 1,2: 3,6 x 1,8 m; 1,1 m): o tampo grosso de tábuas escuras com a
    cinta de aço, as pernas de cantoneira verde-oliva, o painel de trás (o vão é 'fundo'); em cima a lona com o
    fuzil desmontado, a espingarda, as pistolas, os carregadores, a faca, a lata de munição, o pano e a almotolia.
    """
    w, d = 3.0 * 1.2, 1.5 * 1.2
    x, y = 1.5 - w / 2, 0.75 - d / 2
    h = 1.8 / UN
    tp = 0.07
    caixa((x, x + w, y, y + d, h - tp, h), {'cima': tab2(['#6e4a30', '#684428', '#74503a', '#644026'], 0.22, '#2e1e12', eixo=0, seed=201, comp=1.1, org=y),
                                            '*': chapa('#4a4e34', riscas='h', seed=202)})
    m = 0.05
    PE = chapa(OLIVA, riscas='v', seed=203, gasto=0.12, topo=OLIVA_C)
    for (a, b) in ((x + m, y + m), (x + w - m - 0.08, y + m), (x + m, y + d - m - 0.08), (x + w - m - 0.08, y + d - m - 0.08)):
        caixa((a, a + 0.08, b, b + 0.08, 0.0, h - tp), PE)
    caixa((x + m + 0.08, x + w - m - 0.08, y + m + 0.02, y + m + 0.05, 0.25, h - tp), chapa(OLIVA_E, riscas='h', seed=204))
    peg(x, x + w, y, y + d)
    # a lona verde e o que está em cima
    lx0, lx1, ly0, ly1 = x + 0.25, x + 1.65, y + 0.35, y + 1.3

    def lona(L, n, P):
        a, b = P[:, 0], P[:, 1]
        out = np.tile(hx('#5e6644'), (len(P), 1))
        tr = (np.floor(a / PH) + np.floor(b / PH)) % 5 == 0
        out = np.where(tr[:, None], hx('#565e3e'), out)
        bd = (a < lx0 + 0.03) | (a > lx1 - 0.03) | (b < ly0 + 0.03) | (b > ly1 - 0.03)
        return np.where(bd[:, None], hx('#4a5032'), out)
    caixa((lx0, lx1, ly0, ly1, h, h + PZ), {'cima': emissivo(lona), '*': liso('#3e442a')})
    z = h + PZ
    fuzil_deitado(lx0 + 0.15, ly0 + 0.3, z, comp=1.05)
    pistola_deitada(lx0 + 0.25, ly1 - 0.3, z)
    pistola_deitada(lx0 + 0.6, ly1 - 0.28, z, cor='#3a3c3e')
    for i in range(3):
        carregador(lx0 + 0.95 + i * 0.08, ly1 - 0.32, z)
    faca_deitada(lx1 - 0.45, ly0 + 0.12, z)
    espingarda_deitada(x + 1.85, y + 1.2, h)
    lata_municao(x + 2.0, x + 2.25, y + 0.25, y + 0.75, h, 0.25, seed=205)
    CZ.itens_peq.append((x + 2.0, x + 2.25, y + 0.25, y + 0.75, h))
    # o pano sujo e a almotolia de óleo
    _p1_malha((x + 2.6, x + 2.95, y + 0.4, y + 0.7, h, h + 0.04), (0.08, 0.06, 0.01, 0.03),
              BE._p1_mat_rampa(BE._p1_rampa(['#6a6252', '#847a66', '#9a9078', '#b0a68c', '#c4ba9e']), 0.8, 3.6), seg=2)
    o = novo()
    ox, oy = x + 3.1, y + 0.45
    _poligono_rodado(ox, oy, [(h, 0.05), (h + 0.06, 0.05), (h + 0.08, 0.03), (h + 0.1, 0.012)], vol(ox, oy, '#c8a03a', brilho=0.5), o, lados=14)
    o = novo()
    _fita([(0.0, h + 0.1), (0.05, h + 0.2), (0.07, h + 0.23)], ox, oy, liso('#a88a3a'), o, 0.012)
    CZ.itens_peq.append((ox - 0.05, ox + 0.05, oy - 0.05, oy + 0.05, h))
    for k in range(3):
        caixa((x + 2.5 + k * 0.012, x + 2.78 + k * 0.012, y + 1.1 - k * 0.01, y + 1.45 - k * 0.01, h + k * PZ, h + (k + 1) * PZ),
              {'cima': liso('#ece4cc' if k < 2 else '#e8dcbc'), '*': liso('#d0c4a8')})
    CZ.itens_peq.append((x + 2.5, x + 2.8, y + 1.08, y + 1.45, h))


def stool_metal():
    """A banqueta giratória de aço (aumento 1,2; o assento a 0,72 m): o assento de chapa com o parafuso, o fuso, as quatro pernas e o anel dos pés."""
    cx, cy = 0.375, 0.375
    h = 1.18 / UN
    r = 0.17 * 1.2
    a = 0.14
    PE = '#3a3e40'
    for (sx, sy) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        caixa((cx + sx * a - 0.018, cx + sx * a + 0.018, cy + sy * a - 0.018, cy + sy * a + 0.018, 0.02, 0.46), chapa(PE, riscas=None, topo='#5a5e60'))
        caixa((cx + sx * a - 0.022, cx + sx * a + 0.022, cy + sy * a - 0.022, cy + sy * a + 0.022, 0.0, 0.02), liso('#1a1a1a'))
    o = novo()
    anel(cx, cy, a * 1.414, 0.22, 0.22 + 2 * PZ, vol(cx, cy, '#5a5e60', brilho=0.4), o, lados=4)
    caixa((cx - a - 0.02, cx + a + 0.02, cy - a - 0.02, cy + a + 0.02, 0.46, 0.5), chapa(PE, riscas=None, topo='#4e5254'))

    def rosca(P, b):
        return np.where((np.floor(P[:, 2] / PZ) % 2 == 0)[:, None], _tom(b, 0.82), b)
    o = novo()
    C().cilindro(cx, cy, 0.022, 0.5, h - 0.04, vol(cx, cy, '#8a9094', brilho=0.5, faixas=rosca), M, o, lados=10, tampa=False)
    o = novo()

    def assento(L, n, P):
        rr = np.hypot(P[:, 0] - cx, P[:, 1] - cy)
        out = np.tile(hx('#5a6064'), (len(P), 1))
        out = np.where((rr < 0.035)[:, None], hx('#3a3e40'), out)
        out = np.where(((rr > r - 0.03) & (rr < r - 0.03 + PH))[:, None], hx('#4a5054'), out)
        bx, by = (P[:, 0] - cx) / r + 0.35, (P[:, 1] - cy) / r + 0.3
        return np.where((np.hypot(bx, by * 1.5) < 0.16)[:, None], hx('#8a9094'), out)
    C().cilindro(cx, cy, r, h - 0.04, h, vol(cx, cy, '#4a5054', brilho=0.3), M, o, lados=28, tampa_mat=emissivo(assento))
    peg(cx - a - 0.02, cx + a + 0.02, cy - a - 0.02, cy + a + 0.02)


def bed():
    """
    A cama de ferro da cela (o colchão a 0,5 m): a armação de cantoneira pintada, a cabeceira e o pé de grade, o
    estrado de molas, o colchão fino de listras gasto, o cobertor cinza dobrado no pé e o travesseiro achatado.
    """
    x0, x1, y0, y1 = 0.08, 0.67, 0.05, 2.2
    ztop = 0.82 / UN
    zm = 0.36
    FER = '#4a524e'
    F = chapa(FER, riscas=None, gasto=0.2, seed=211, topo='#6a726e', manchas=('#5a3a24', 0.12, 0.1))
    for (yy, zt_) in ((y0, 0.82), (y1 - 0.04, 0.66)):
        for xx in (x0, x1 - 0.04):
            caixa((xx, xx + 0.04, yy, yy + 0.04, 0.0, zt_), F)
        o = novo()
        tubo((x0 + 0.04, x1 - 0.04, yy + 0.008, yy + 0.032, zt_ - 0.04, zt_ - 0.01), FER, '#6a726e', oid=o)
        tubo((x0 + 0.04, x1 - 0.04, yy + 0.008, yy + 0.032, zm - 0.05, zm - 0.02), FER, '#6a726e', oid=o)
        for xx in np.arange(x0 + 0.1, x1 - 0.06, 0.09):
            tubo((xx - 0.008, xx + 0.008, yy + 0.012, yy + 0.028, zm - 0.02, zt_ - 0.04), FER, '#6a726e', oid=o)
    for xx in (x0, x1 - 0.035):
        caixa((xx, xx + 0.035, y0 + 0.04, y1 - 0.04, zm - 0.06, zm - 0.01), F)

    def molas(L, n, P):
        g = (np.floor(P[:, 0] / PH) % 3 == 0) | (np.floor(P[:, 1] / PH) % 3 == 0)
        return np.where(g[:, None], hx('#6a726e'), hx('#2a2e2c'))
    caixa((x0 + 0.035, x1 - 0.035, y0 + 0.04, y1 - 0.04, zm - 0.04, zm - 0.03), {'cima': emissivo(molas), '*': liso('#3a403c')})

    def listras(L, n, P):
        a, b = _uv(n, P)
        if abs(n[2]) > 0.5:
            t = P[:, 0]
        elif abs(n[1]) >= abs(n[0]):
            t = P[:, 0]
        else:
            t = P[:, 1]
        out = np.where((np.floor(t / PH) % 5 < 2)[:, None], hx('#8a96a0'), hx('#d4d0c4'))
        g = suave(np.floor(P[:, 0] / (2 * PH)) * 2 * PH, np.floor(P[:, 1] / (2 * PH)) * 2 * PH, 0.18, 9)
        out = np.where((g > 0.74)[:, None], _tom(out, 0.84), out)
        return out
    _p1_malha((x0 + 0.03, x1 - 0.03, y0 + 0.05, y1 - 0.05, zm - 0.03, ztop - 0.02), (0.04, 0.05, 0.02, 0.03), emissivo(listras), seg=2)
    # o travesseiro achatado e o cobertor dobrado
    _p1_malha((x0 + 0.06, x1 - 0.06, y0 + 0.08, y0 + 0.36, ztop - 0.03, ztop + 0.05), (0.06, 0.07, 0.02, 0.04), CA.lencol('#d8d2c2'), seg=2)
    COB = BE._p1_mat_rampa(BE._p1_rampa(['#3a3c40', '#46484c', '#525458', '#5e6064', '#6a6c70', '#76787c']), 1.0, 4.6)
    _p1_malha((x0 + 0.02, x1 - 0.02, y1 - 0.75, y1 - 0.12, ztop - 0.04, ztop + 0.05), (0.04, 0.06, 0.04, 0.04), COB, seg=2)
    for yy in (y1 - 0.7, y1 - 0.2):
        _barra((x0 + 0.02, x1 - 0.02, yy, yy + 0.03, ztop + 0.045, ztop + 0.052), '#2a2c30', quina=False)
    peg(x0, x1, y0, y1)


# =====================================================================================================================
# o catálogo deste grupo
# =====================================================================================================================
ITENS = {
    'bancada_lab_curta': (2, 1, (0.0, 0.0), lambda: bancada(2, 'curta'), {}),
    'bancada_lab_ilha': (4, 1, (0.0, 0.0), lambda: bancada(4, 'ilha'), {}),
    'bancada_lab_parede': (4, 1, (0.0, 0.0), lambda: bancada(4, 'parede'), {}),
    'flasks': (1, 1, (0.0, 0.0), flasks, {}),
    'impressora_3d': (1, 1, (0.0, 0.0), impressora_3d, {}),
    'mesa_vidro_lab': (1, 3, (0.0, 0.0), mesa_vidro_lab, {}),
    'stool_lab': (1, 1, (0.0, 0.0), stool_lab, {}),
    'mesa_contencao': (2, 3, (0.0, 0.0), mesa_contencao, {}),
    'trolley': (1, 1, (0.0, 0.0), trolley, {}),
    'bed_curtain': (3, 4, (0.0, 0.0), lambda: bed_curtain(True), {'1': lambda: bed_curtain(False)}),
    'eletroencefalografo': (1, 1, (0.0, 0.0), eletroencefalografo, {}),
    'hospital_bed': (1, 3, (0.0, 0.0), hospital_bed, {}),
    'iv_stand': (1, 1, (0.0, 0.0), iv_stand, {}),
    'med_tray': (1, 1, (0.0, 0.0), med_tray, {}),
    'medical_cabinet': (2, 1, (0.0, 0.0), medical_cabinet, {}),
    'monitor_suporte': (1, 1, (0.0, 0.0), lambda: monitor_suporte(True), {'1': lambda: monitor_suporte(False)}),
    'posto_enfermagem': (7, 3, (0.0, 0.0), posto_enfermagem, {}),
    'posto_enfermagem!vazio': (7, 3, (0.0, 0.0), lambda: posto_enfermagem(True), {}),   # a gêmea vazia: sem nada em cima
    'toilet_steel': (1, 1, (0.0, 0.0), toilet_steel, {}),
    'trash_bin': (1, 1, (0.0, 0.0), trash_bin, {}),
    'vitals_monitor': (1, 1, (0.0, 0.0), lambda: vitals_monitor(True), {'1': lambda: vitals_monitor(False)}),
    'ammo_box': (1, 1, (0.0, 0.0), ammo_box, {}),
    'chest_army': (1, 1, (0.0, 0.0), lambda: chest_army(False), {'1': lambda: chest_army(True)}),
    'locker_ammo': (1, 1, (0.0, 0.0), lambda: locker_ammo(False), {'1': lambda: locker_ammo(True)}),
    'mesa_arsenal': (4, 2, (0.0, 0.0), mesa_arsenal, {}),
    'stool_metal': (1, 1, (0.0, 0.0), stool_metal, {}),
    'weapon_rack': (2, 1, (0.0, 0.0), weapon_rack, {}),
    'bed': (1, 3, (0.0, 0.0), bed, {}),
    'locker': (1, 1, (0.0, 0.0), lambda: locker(False), {'1': lambda: locker(True)}),
    'locker_row': (2, 1, (0.0, 0.0), locker_row, {}),
}
