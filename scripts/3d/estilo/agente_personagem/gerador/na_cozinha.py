"""Os bonecos limpos do gerador dentro da cozinha 1:1 (de dia e de noite), no tamanho real (1 px = 1 px)."""
import os, sys
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..', 'sprite'))
import numpy as np
from PIL import Image
from na_cozinha import montar as _m          # o de agente_personagem/sprite

base = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, 'alosi_v1')
k = int(sys.argv[2]) if len(sys.argv) > 2 else 1


def um(n):
    return np.asarray(Image.open(f'{base}_{n}.png').convert('RGBA')).copy()


def montar(noite):
    import na_cozinha as NC
    lug = [((5.9, 3.3), 1), ((6.7, 1.45), 2), ((2.3, 1.35), 3)]
    img = None
    # um de cada vez: a função recebe um sprite e uma lista de lugares
    os.environ['NOITE'] = '1' if noite else '0'
    import importlib, janela_cozinha, cozinha
    importlib.reload(janela_cozinha); importlib.reload(cozinha)
    from motor import tela
    img = np.array(cozinha.montar(0.0, 1.0)).astype(float)
    c = cozinha.c
    for (x, y), n in lug:
        spr = um(n)
        sx, sy = tela(np.array([x, y, 0.0]))
        px, py = int(round(sx - c.x0)), int(round(sy - c.y0))
        yy, xx = np.mgrid[0:img.shape[0], 0:img.shape[1]]
        e = ((xx - px) / 15.0) ** 2 + ((yy - py) / 6.0) ** 2
        img = np.where((e < 1)[..., None], img * 0.72 + np.array([20, 8, 16]) * 0.28, img)
        s = np.repeat(np.repeat(spr, k, 0), k, 1).astype(float)
        h, w = s.shape[:2]
        x0, y0 = px - w // 2, py - h + 2
        a = s[..., 3:4] / 255.0
        cor = s[..., :3] * (0.6 if noite else 1.0) + (np.array([24, 8, 34]) * 0.4 if noite else 0)
        img[y0:y0 + h, x0:x0 + w] = img[y0:y0 + h, x0:x0 + w] * (1 - a) + cor * a
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))


a, b = montar(False), montar(True)
w, h = a.size
m = Image.new('RGB', (w * 2 + 10, h), (40, 36, 40)); m.paste(a, (0, 0)); m.paste(b, (w + 10, 0))
m.resize((m.width * 2, m.height * 2), Image.NEAREST).save(os.path.join(AQUI, f'cozinha_{k}x.png'))
print('ok')
