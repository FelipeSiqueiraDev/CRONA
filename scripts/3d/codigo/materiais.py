"""Materiais procedurais (pixel art): cada um recebe os pontos locais (metros) e a normal local."""
import numpy as np
from motor import hexa, ruido, emissivo, suave, SUAVE


def _cor(c):
    return hexa(c) if isinstance(c, str) else np.array(c, dtype=float)


def liso(c):
    c = _cor(c)
    return lambda L, n, P: np.tile(c, (len(L), 1))


def misturar(a, b, t):
    return _cor(a) * (1 - t) + _cor(b) * t


def coord_face(L, n):
    """As duas coordenadas da face (a horizontal e a vertical, em metros) pela normal local."""
    u, v, z = L[:, 0], L[:, 1], L[:, 2]
    if abs(n[2]) > 0.5:
        return u, v
    if abs(n[1]) >= abs(n[0]):
        return u, z
    return v, z


def tabuas(c, larg=0.11, junta='#00000000', eixo='a', var=0.07, veio=True, junta_escura=0.72, seed=0):
    """Tábuas: faixas de largura `larg` ao longo do eixo da face; cada tábua com um tom; a junta mais escura."""
    c = _cor(c)

    def f(L, n, P):
        a, b = coord_face(L, n)
        t, s = (a, b) if eixo == 'a' else (b, a)
        i = np.floor(t / larg)
        k = ruido(i, seed)
        tom = 1 + (k - 0.5) * 2 * var
        cor = c[None, :] * tom[:, None]
        # veio: no desenho suave, linhas onduladas finas ao longo da tábua; no pixel, riscas
        if veio and SUAVE:
            ond = np.sin((t / larg + 0.15 * np.sin(s * 7 + i * 1.3) + suave(s, i, 0.3, seed + 4) * 0.6) * 2 * np.pi * 3)
            cor = np.where((ond > 0.93)[:, None], cor * 0.93, cor)
        elif veio:
            r = ruido(np.floor(s / 0.09), i, seed + 3)
            fino = (np.abs((t / larg) % 1 - (0.3 + 0.4 * r)) < 0.06) & (ruido(np.floor(s / 0.05), i) > 0.55)
            cor = np.where(fino[:, None], cor * 0.9, cor)
        frac = (t / larg) % 1
        j = (frac < 0.08)
        cor = np.where(j[:, None], cor * junta_escura, cor)
        return cor
    return f


def ladrilho(c, rejunte, tam=0.75, var=0.04, seed=0, alt=None):
    """Ladrilho quadrado (tam em metros), com o rejunte de 1 px e um tom por peça; alt: a cor do xadrez."""
    c, rj = _cor(c), _cor(rejunte)
    altc = _cor(alt) if alt is not None else None

    def f(L, n, P):
        a, b = coord_face(L, n)
        ia, ib = np.floor(a / tam), np.floor(b / tam)
        k = ruido(ia, ib, seed)
        base = np.tile(c, (len(L), 1))
        if altc is not None:
            base = np.where(((ia + ib) % 2 == 1)[:, None], altc[None, :], base)
        cor = base * (1 + (k[:, None] - 0.5) * 2 * var)
        # rejunte: perto da borda da peça (em px: 1 px é ~0,016 m no chão)
        fa, fb = (a / tam) % 1, (b / tam) % 1
        e = 0.018 / tam
        rej = (fa < e) | (fb < e)
        cor = np.where(rej[:, None], rj[None, :], cor)
        # um brilho fino na borda de cima de cada peça (o vidrado)
        bri = ((fa > e) & (fa < 2.2 * e)) | ((fb > e) & (fb < 2.2 * e))
        cor = np.where((bri & ~rej)[:, None], cor * 1.06, cor)
        return cor
    return f


def com_detalhe(base, *camadas):
    """Aplica camadas por cima: cada camada é (função de máscara(L, n), cor ou fator)."""
    def f(L, n, P):
        cor = base(L, n, P)
        for m, c in camadas:
            mask = m(L, n)
            if mask is None or not mask.any():
                continue
            if isinstance(c, (int, float)):
                cor = np.where(mask[:, None], cor * c, cor)
            elif callable(c):
                cor = np.where(mask[:, None], c(L, n, P), cor)
            else:
                cor = np.where(mask[:, None], _cor(c)[None, :], cor)
        return cor
    if getattr(base, 'emissivo', False):
        f = emissivo(f)
    return f


def painel(a0, a1, b0, b1, borda=0.025):
    """Máscaras de um painel rebaixado na face (coordenadas da face): a luz em cima/esquerda, a sombra embaixo/direita."""
    def dentro(L, n):
        a, b = coord_face(L, n)
        return (a > a0) & (a < a1) & (b > b0) & (b < b1)

    def sombra(L, n):
        a, b = coord_face(L, n)
        d = dentro(L, n)
        return d & ((b > b1 - borda) | (a < a0 + borda))

    def luz(L, n):
        a, b = coord_face(L, n)
        d = dentro(L, n)
        return d & ((b < b0 + borda) | (a > a1 - borda)) & ~sombra(L, n)
    return dentro, sombra, luz


def regiao(a0, a1, b0, b1):
    def m(L, n):
        a, b = coord_face(L, n)
        return (a >= a0) & (a <= a1) & (b >= b0) & (b <= b1)
    return m


def linha_h(b, esp=0.016, a0=-1e9, a1=1e9):
    def m(L, n):
        a, bb = coord_face(L, n)
        return (np.abs(bb - b) < esp / 2) & (a >= a0) & (a <= a1)
    return m


def linha_v(a, esp=0.016, b0=-1e9, b1=1e9):
    def m(L, n):
        aa, b = coord_face(L, n)
        return (np.abs(aa - a) < esp / 2) & (b >= b0) & (b <= b1)
    return m
