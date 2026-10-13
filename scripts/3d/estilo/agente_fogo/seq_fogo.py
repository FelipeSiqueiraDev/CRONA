"""
A sequência do fogo apagando (GIF de teste): 12 quadros aceso (o loop), 24 apagando (forca 1 -> 0) e 16 de fumaça
final (forca 0, fumaca 1 -> 0).
uso: python3 seq_fogo.py saida.gif [sala|lareira|boca]
  sala: a sala inteira (2x); grava também saida_folha.png (a sala, 1 quadro a cada 4) e saida_folha_lareira.png
  (a lareira com a chaminé e o céu em cima, 3x, 1 quadro a cada 4).
"""
import os
import subprocess
import sys
from PIL import Image

aqui = os.path.dirname(os.path.abspath(__file__))
saida = sys.argv[1] if len(sys.argv) > 1 else 'fogo_apagando.gif'
qual = sys.argv[2] if len(sys.argv) > 2 else 'sala'
CAIXAS = {'boca': ((244, 158, 292, 222), 8), 'lareira': ((222, 120, 318, 248), 5), 'sala': (None, 2)}
caixa, z = CAIXAS[qual]
plano = []
for i in range(12):
    plano.append(dict(FOGO_T=i / 12, FOGO_FORCA=1.0))
for i in range(24):
    plano.append(dict(FOGO_T=(12 + i) / 12, FOGO_FORCA=1 - (i + 1) / 24))
for i in range(16):
    # a fumaça que sobra depois de apagar vai acabando
    plano.append(dict(FOGO_T=(36 + i) / 12, FOGO_FORCA=0.0, FOGO_FUMACA=max(0.0, 1 - (i + 1) / 16) ** 0.8))
artes = []
for n, p in enumerate(plano):
    p['FOGO_FUMACA_T'] = n / 12
    tmp = os.path.join(aqui, f'_s{n}.png')
    subprocess.run([sys.executable, os.path.join(aqui, 'sala_fogo2.py'), tmp], check=True,
                   env=dict(os.environ, **{k: str(v) for k, v in p.items()}), stdout=subprocess.DEVNULL)
    im = Image.open(tmp).convert('RGB')
    os.remove(tmp)
    artes.append(im.resize((im.width // 3, im.height // 3), Image.NEAREST))   # 1 px = 1 px da arte


def recorte(a, cx, zz):
    if cx is None:
        return a.resize((a.width * zz, a.height * zz), Image.NEAREST)
    x0, y0, x1, y1 = cx
    return a.crop(cx).resize(((x1 - x0) * zz, (y1 - y0) * zz), Image.NEAREST)


quadros = [recorte(a, caixa, z) for a in artes]
dur = [100] * 12 + [140] * 24 + [140] * 15 + [900]
quadros[0].save(saida, save_all=True, append_images=quadros[1:], duration=dur, loop=0)


def folha(imgs, nome, cols):
    W, H = imgs[0].size
    f = Image.new('RGB', (W * cols, H * ((len(imgs) + cols - 1) // cols)), (40, 40, 40))
    for i, q in enumerate(imgs):
        f.paste(q, ((i % cols) * W, (i // cols) * H))
    f.save(nome)


base = os.path.splitext(saida)[0]
sel = list(range(0, len(artes), 4))
if qual == 'sala':
    folha([artes[i] for i in sel], base + '_folha.png', 5)
    folha([recorte(artes[i], (222, 10, 318, 248), 3) for i in sel], base + '_folha_lareira.png', 7)
else:
    folha([quadros[i] for i in sel], base + '_folha.png', 7)
print('ok', saida, len(quadros))
