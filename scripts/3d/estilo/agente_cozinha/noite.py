"""
O clima da cena (estudo): a sala no escuro aconchegante das referências, acesa só pelas luzes que existem nela.

Depois do acabamento (a cor de cada pixel com a luz do dia), a cena inteira é multiplicada pela luz que chega em
cada ponto: um ambiente fraco puxado para o roxo-vinho (as sombras), mais cada fonte de luz de verdade:
  - a janela: o sol do fim da tarde (a mancha que luz_janela calculou, com as sombras das travessas, da cortina e
    dos móveis) e o feixe no ar mais forte;
  - as lâmpadas: luz de ponto morna, que cai com a distância, com a face virada para ela mais clara e a sombra do
    que está embaixo (a mesa tapa o chão; o mapa de sombra de cima);
  - o fogo do fogão: laranja, perto do chão, tremendo com t.
A luz total vai em degraus (pixel art: as poças de luz em anéis nítidos, sem degradê liso). O que emite luz (o céu
na janela, a lâmpada, o fogo) não escurece e ganha um halo em degraus em volta, na tela.
"""
import math
import numpy as np

AMB = 0.3                                  # o ambiente (quanto se vê sem luz nenhuma)
COR_AMB = np.array([0.95, 0.72, 1.0])       # a sombra puxa para o roxo-vinho
DEGRAU = 0.1                                 # o tamanho de cada degrau da luz


def _bloom(m, raio):
    """Quanto cada pixel está perto de um pixel aceso (0..1): caixa somada, rápida."""
    a = m.astype(float)
    k = 2 * raio + 1
    c = np.cumsum(np.cumsum(np.pad(a, ((raio + 1, raio), (raio + 1, raio))), 0), 1)
    s = c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]
    return s / (k * k)


def iluminar(cor, c, t, lampadas, fogo=None, sol=None, feixe=None, luzes=(), janela=None, ceu=True, fundo=(26, 20, 28)):
    P, N = c.mundoP, c.nrm
    h, w = c.obj.shape
    cena = c.obj >= 0
    X, Y, Z = P[..., 0], P[..., 1], P[..., 2]
    tot = np.zeros((h, w))
    rgb = np.zeros((h, w, 3))

    def soma(I, cor_l):
        nonlocal tot, rgb
        tot = tot + I
        rgb = rgb + I[..., None] * (np.array(cor_l) / 255.0)

    # o ambiente: mais fraco no alto das paredes (o teto escuro) e no chão longe de tudo
    amb = np.full((h, w), AMB)
    amb = np.where((c.tipo == 2) & (Z > 1.6), AMB * np.clip(1 - (Z - 1.6) / 3.0, 0.65, 1), amb)
    soma(amb, COR_AMB * 255)
    # o chão mais calmo: menos contraste no xadrez e um pouco mais escuro (os móveis saltam dele)
    chao = cena & (c.tipo == 1) & (c.nz > 0.6)
    if chao.any():
        med = cor[chao].mean(0)
        cor = np.where(chao[..., None], (cor * 0.6 + med * 0.4) * 0.82, cor)
    # a sombra da luz de cima (o que está embaixo da mesa e do tampo)
    cima = c.sombra_direcional((0.05, 0.08, -1.0), res=0.02, raio=1)
    for (L0, _r, forca_l) in lampadas:
        L0 = np.array(L0)
        D = L0 - P
        d = np.linalg.norm(D, axis=-1) + 1e-6
        ndl = np.clip((N * D).sum(-1) / d, 0, 1)
        cai = np.clip(1 - d / 4.2, 0, 1) ** 1.3
        # a cúpula tapa para cima e para o lado: só o cone de baixo acende (e um pouco de luz espalhada)
        cone = 0.15 + 0.85 * np.clip(((L0[2] - Z) / d - 0.2) / 0.5, 0, 1)
        I = 1.7 * forca_l / 0.55 * cai * cone * (0.3 + 0.7 * ndl) * (0.15 + 0.85 * cima)
        soma(I, (255, 196, 128))
    if fogo is not None:
        F0, forca_f = fogo
        tre = 1.0 + 0.08 * math.sin(2 * math.pi * t * 3) + 0.05 * math.sin(2 * math.pi * t * 7 + 1)
        D = np.array(F0) - P
        d = np.linalg.norm(D, axis=-1) + 1e-6
        ndl = np.clip((N * D).sum(-1) / d, 0, 1)
        cai = np.clip(1 - d / 2.4, 0, 1) ** 1.8
        soma(1.1 * forca_f * tre * cai * (0.35 + 0.65 * ndl), (255, 130, 56))
    if sol is not None:
        # (embaixo de móvel o sol não chega: o mapa de cima tapa o que vaza pelo mapa do sol)
        soma(1.35 * sol * np.where((c.tipo == 1) & (cima < 0.5), 0.0, 1.0), (255, 186, 104))
    if janela is not None:
        # o claro que a janela espalha em volta dela (a luz de fora rebatendo no vão)
        D = np.array(janela) - P
        d = np.linalg.norm(D, axis=-1) + 1e-6
        ndl = np.clip((N * D).sum(-1) / d, 0, 1)
        soma(0.45 * np.clip(1 - d / 2.2, 0, 1) ** 2.2 * (0.3 + 0.7 * ndl), (255, 190, 120))
    # em degraus
    q = np.floor(tot / DEGRAU + 0.5) * DEGRAU
    k = rgb / np.maximum(tot, 1e-6)[..., None] * q[..., None]
    out = cor * k
    # o feixe no ar, bem mais forte que de dia
    if feixe is not None:
        out = out + (np.array([255.0, 196.0, 110.0]) - out) * (feixe * 0.34)[..., None]
    # o que emite luz fica como está, com o halo em volta
    emite = np.zeros((h, w), bool)
    if luzes:
        emite |= np.isin(c.obj, list(luzes))
    emite |= cena & (Y < -0.2)                 # o céu na janela (atrás da parede do fundo)
    out = np.where(emite[..., None], cor * 1.08 + 8, out)
    if ceu:
        # o céu do fim da tarde: o que se vê pela janela puxa para o dourado
        m = cena & (Y < -0.2)
        lum = cor[..., :3].mean(-1, keepdims=True)
        dour = np.array([255.0, 214.0, 140.0]) * (0.55 + 0.5 * lum / 255.0)
        out = np.where(m[..., None], out * 0.35 + dour * 0.65, out)
    hal = _bloom(emite, 7)
    hal = np.where(hal > 0.12, 0.22, np.where(hal > 0.03, 0.1, 0.0)) * ~emite
    out = out + (np.array([255.0, 214.0, 150.0]) - out) * hal[..., None]
    # o brilho em volta da lâmpada (a cúpula esconde a lâmpada de cima: o halo vai pelo ponto dela na tela)
    from motor import tela
    yy, xx = np.mgrid[0:h, 0:w]
    for (L0, _r, forca_l) in lampadas:
        sx, sy = tela(np.array(L0))
        r = np.hypot(xx + c.x0 - sx, (yy + c.y0 - sy) * 1.15)
        R = 34 * c.w / 588 * 0.75 / 0.75
        a = np.where(r < R * 0.35, 0.3, np.where(r < R * 0.65, 0.16, np.where(r < R, 0.07, 0.0)))
        out = out + (np.array([255.0, 222.0, 160.0]) - out) * a[..., None]
    out = np.where(cena[..., None], out, np.array(fundo, float))
    return out
