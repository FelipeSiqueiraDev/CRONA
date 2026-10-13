"""A Alosi (sprite à mão, 2x) dentro da cozinha 1:1: de dia e de noite, lado a lado com as referências."""
import os, sys
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(AQUI, '..', '..', 'agente_cozinha'))
sys.path.insert(0, os.path.join(AQUI, '..', '..', '..', 'codigo'))
import numpy as np
from PIL import Image
from sprite import desenhar
import importlib


def montar(spr, lugares, noite=False, k=2):
    os.environ['NOITE'] = '1' if noite else '0'
    import janela_cozinha, cozinha
    importlib.reload(janela_cozinha)
    importlib.reload(cozinha)
    from motor import tela
    img = np.array(cozinha.montar(0.0, 1.0)).astype(float)
    c = cozinha.c
    for (x, y) in lugares:
        sx, sy = tela(np.array([x, y, 0.0]))
        px, py = int(round(sx - c.x0)), int(round(sy - c.y0))
        # a sombra no chão
        yy, xx = np.mgrid[0:img.shape[0], 0:img.shape[1]]
        e = ((xx - px) / 15.0) ** 2 + ((yy - py) / 6.0) ** 2
        img = np.where((e < 1)[..., None], img * 0.72 + np.array([20, 8, 16]) * 0.28, img)
        s = np.repeat(np.repeat(spr, k, 0), k, 1)
        h, w = s.shape[:2]
        x0, y0 = px - w // 2, py - h + 2 * k
        a = s[..., 3:4] / 255.0
        luz = 0.62 if noite else 1.0
        cor = s[..., :3] * luz + (np.array([30, 10, 40]) * (1 - luz) if noite else 0)
        reg = img[y0:y0 + h, x0:x0 + w]
        img[y0:y0 + h, x0:x0 + w] = reg * (1 - a) + cor * a
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))


if __name__ == '__main__':
    exec(open(os.path.join(AQUI, 'alosi_se.py')).read().split('img = desenhar')[0])
    spr = desenhar(SE)
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, 'cozinha.png')
    lug = [(5.9, 3.3), (6.6, 1.5)]
    a = montar(spr, lug)
    b = montar(spr, lug, noite=True)
    w, h = a.size
    m = Image.new('RGB', (w * 2 + 10, h), (40, 36, 40)); m.paste(a, (0, 0)); m.paste(b, (w + 10, 0))
    m.resize((m.width * 2, m.height * 2), Image.NEAREST).save(out)
    print('ok', out)
