"""
O boneco limpo do gerador dentro da cozinha 1:1, harmonizado com os móveis:
  - o contorno de fora no jeito dos móveis (a cor da própria peça escurecida e puxada para o marrom quente, não o
    preto), as linhas de dentro mais leves;
  - a sombra no chão em degraus, a mesma dos móveis (a pegada do pé e os anéis que somem);
  - à noite, a luz da cena no lugar onde ele está (a razão entre a cozinha de noite e a de dia no chão em volta
    dos pés), em vez de só escurecer.
Os móveis em tamanho real (AUMENTO=1.0). Frente e trás pela profundidade de cada linha do boneco.

Uso: python3 cena.py <base dos bonecos> [saida.png]   (base_1.png ... base_5.png)
"""
import importlib
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..', '..', 'agente_cozinha'))
sys.path.insert(0, os.path.join(AQUI, '..', '..', '..', 'codigo'))
os.environ.setdefault('AUMENTO', '1.0')
import numpy as np


def pe_x(spr):
    """A âncora: o meio dos pés (a média dos pixels opacos das 6 linhas de baixo), não o meio da caixa."""
    a = spr[-6:, :, 3] > 0
    return int(round(np.nonzero(a)[1].mean()))
                 # noqa: E402
from PIL import Image              # noqa: E402

CASA = 0.75


def _viz(a, dy, dx, fill):
    h, w = a.shape[:2]
    out = np.full_like(a, fill)
    ys = slice(max(0, dy), h + min(0, dy)); yd = slice(max(0, -dy), h + min(0, -dy))
    xs = slice(max(0, dx), w + min(0, dx)); xd = slice(max(0, -dx), w + min(0, -dx))
    out[yd, xd] = a[ys, xs]
    return out


def harmonizar(spr):
    """O contorno e as linhas de dentro no jeito dos móveis (acabar_px da cozinha)."""
    s = spr.astype(float).copy()
    a = s[..., 3] > 0
    rgb = s[..., :3]
    lum = rgb @ np.array([0.3, 0.59, 0.11])
    escuro = a & (lum < 52)
    # a borda de fora: o pixel opaco com um vizinho vazio
    borda = np.zeros(a.shape, bool)
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        borda |= a & ~_viz(a, dy, dx, False)
    # a cor de dentro mais perto (a média dos vizinhos opacos que não são escuros nem borda)
    soma = np.zeros(rgb.shape); n = np.zeros(a.shape)
    for r in (1, 2):
        for dy, dx in ((0, r), (r, 0), (0, -r), (-r, 0), (r, r), (-r, -r), (r, -r), (-r, r)):
            ok = _viz(a & ~escuro & ~borda, dy, dx, False)
            soma += np.where(ok[..., None], _viz(rgb, dy, dx, 0.0), 0)
            n += ok
        if (n[borda] > 0).all():
            break
    dentro = np.where((n > 0)[..., None], soma / np.maximum(n, 1)[..., None], np.array([90.0, 60.0, 50.0]))
    # o contorno dos móveis: cor * 0,28 + (26, 13, 11)
    rgb = np.where(borda[..., None], dentro * 0.28 + np.array([26.0, 13.0, 11.0]), rgb)
    # as linhas de dentro quase pretas: o seletivo dos móveis (cor * 0,52 + (10, 3, 5)), menos no rosto
    meio = escuro & ~borda & (n > 0)
    h = a.shape[0]
    rosto = np.zeros(a.shape, bool)
    rosto[int(h * 0.12):int(h * 0.32)] = True
    meio &= ~rosto
    # só a linha fina (1 px entre duas partes claras); a área escura de verdade (o cinto, a calça) fica como está
    claro = a & ~escuro
    fina = (_viz(claro, 0, 1, False) & _viz(claro, 0, -1, False)) | (_viz(claro, 1, 0, False) & _viz(claro, -1, 0, False))
    meio &= fina
    rgb = np.where(meio[..., None], dentro * 0.5 + np.array([10.0, 3.0, 5.0]), rgb)
    s[..., :3] = rgb
    return np.clip(s, 0, 255)


def _cozinha(noite):
    os.environ['NOITE'] = '1' if noite else '0'
    import janela_cozinha
    import cozinha
    importlib.reload(janela_cozinha)
    importlib.reload(cozinha)
    img = np.array(cozinha.montar(0.0, 1.0)).astype(float)
    return img, cozinha.c


def montar(bonecos, lugares, saida):
    from motor import tela, VISTA, KZ
    dia, c = _cozinha(False)
    noi, c2 = _cozinha(True)
    P = c.mundoP
    chao = (c.tipo == 1) & (c.nz > 0.6) & (c.obj >= 0)
    out = []
    for img, noite in ((dia.copy(), False), (noi.copy(), True)):
        for (cx, cy, n) in lugares:
            x, y = (cx + 0.5) * CASA, (cy + 0.5) * CASA
            spr = bonecos[n]
            # a sombra no chão (os degraus dos móveis: a pegada e três anéis que somem)
            d = np.hypot(P[..., 0] - x, P[..., 1] - y) - 0.15
            ks = np.where(d <= 0, 0.74, np.where(d < 0.045, 0.8, np.where(d < 0.1, 0.87, np.where(d < 0.17, 0.94, 1.0))))
            ks = np.where(chao, ks, 1.0)
            img = img * ks[..., None] + (1 - ks[..., None]) * np.array([14.0, 2.0, 12.0])
            sx, sy = tela(np.array([x, y, 0.0]))
            px, py = int(round(sx - c.x0)), int(round(sy - c.y0))
            h, w = spr.shape[:2]
            x0, y0 = px - pe_x(spr), py - h + 2
            cor = spr[..., :3].copy()
            if noite:
                # a luz da cena onde ele pisa: noite / dia no chão em volta dos pés (fora da sombra dele)
                anel = chao & (d > 0.2) & (d < 0.5)
                k = (noi[anel] + 1) / (dia[anel] + 1)
                f = np.clip(np.median(k, 0), 0.15, 1.3)
                # o alto do corpo pega um pouco mais da luz das lâmpadas (de cima)
                alto = np.linspace(1.12, 1.0, h)[:, None, None]
                cor = cor * f * alto
            z = (py - (y0 + np.arange(h))) / KZ
            dprof = (np.array([x, y, 0.0]) @ VISTA) + z * VISTA[2] + 0.12
            fr = dprof[:, None] >= c.prof[y0:y0 + h, x0:x0 + w] - 0.01
            a = spr[..., 3:4] / 255.0 * fr[..., None]
            img[y0:y0 + h, x0:x0 + w] = img[y0:y0 + h, x0:x0 + w] * (1 - a) + cor * a
        out.append(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)))
    a, b = out
    w, h = a.size
    m = Image.new('RGB', (w * 2 + 10, h), (40, 36, 40)); m.paste(a, (0, 0)); m.paste(b, (w + 10, 0))
    m.resize((m.width * 2, m.height * 2), Image.NEAREST).save(saida)
    return a, b


if __name__ == '__main__':
    base = sys.argv[1]
    saida = sys.argv[2] if len(sys.argv) > 2 else os.path.join(AQUI, 'cena.png')
    bon = {n: harmonizar(np.asarray(Image.open(f'{base}_{n}.png').convert('RGBA'))) for n in range(1, 6)}
    for n, s in bon.items():
        Image.fromarray(s.astype(np.uint8), 'RGBA').save(f'{base}_h_{n}.png')
    # ao lado das cadeiras (8,3) e (4,5), na frente do fogão (2,1)
    montar(bon, [(8, 3, 1), (4, 5, 2), (2, 1, 3)], saida)
    print('ok', saida)
