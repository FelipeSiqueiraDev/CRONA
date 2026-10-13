"""
O GIF da cozinha: o fogão aceso (as labaredas da boca aberta, o fogo da fornalha, as brasas) e a cortina da janela
balançando. 24 quadros a 110 ms: o fogo dá duas voltas (12 quadros cada) e a cortina uma; o loop fecha sem salto.
Gera também a imagem parada (o quadro 0, 3x) e a folha com 4 quadros.
"""
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

E = os.path.dirname(os.path.abspath(__file__))
G = os.path.join(E, 'quadros')
os.makedirs(G, exist_ok=True)
N = 24


def um(i):
    out = os.path.join(G, f'q{i:03d}.png')
    tf, tj = (i % 12) / 12, i / N
    subprocess.run([sys.executable, os.path.join(E, 'cozinha.py'), out, f'{tf:.4f}', f'{tj:.4f}'], check=True, capture_output=True)
    return out.replace('.png', '_1x.png')


with ThreadPoolExecutor(4) as ex:
    arqs = list(ex.map(um, range(N)))
imgs = [Image.open(a).convert('RGB') for a in arqs]
w, h = imgs[0].size
# uma paleta só, tirada de uns quadros espalhados (sem pontilhado)
mont = Image.new('RGB', (w * 4, h))
for k, i in enumerate((0, 6, 12, 18)):
    mont.paste(imgs[i], (k * w, 0))
mont.save(os.path.join(E, 'cozinha_folha.png'))
pal = mont.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
fr = [im.quantize(palette=pal, dither=Image.Dither.NONE).resize((w * 2, h * 2), Image.NEAREST) for im in imgs]
saida = os.path.join(E, 'cozinha_viva.gif')
fr[0].save(saida, save_all=True, append_images=fr[1:], duration=110, loop=0, optimize=True, disposal=1)
imgs[0].resize((w * 3, h * 3), Image.NEAREST).save(os.path.join(E, 'cozinha.png'))
imgs[0].save(os.path.join(E, 'cozinha_1x.png'))
print('ok', N, 'quadros', fr[0].size, os.path.getsize(saida) // 1024, 'KB')
