"""O GIF do fogo: roda a sala com FOGO_T = 0, 1/8, ... e junta o recorte da lareira. uso: python3 gif_fogo.py saida.gif [quadros] [boca|lareira]"""
import os
import subprocess
import sys
from PIL import Image

aqui = os.path.dirname(os.path.abspath(__file__))
saida = sys.argv[1] if len(sys.argv) > 1 else 'fogo.gif'
n = int(sys.argv[2]) if len(sys.argv) > 2 else 8
qual = sys.argv[3] if len(sys.argv) > 3 else 'lareira'
caixa, z = ((244, 158, 292, 222), 8) if qual == 'boca' else ((222, 120, 318, 248), 5)
quadros = []
for i in range(n):
    tmp = os.path.join(aqui, f'_q{i}.png')
    subprocess.run([sys.executable, os.path.join(aqui, os.environ.get('CENA', 'sala_fogo.py')), tmp], check=True, env=dict(os.environ, FOGO_T=str(i / n)),
                   stdout=subprocess.DEVNULL)
    im = Image.open(tmp).convert('RGB')
    x0, y0, x1, y1 = caixa
    quadros.append(im.crop((x0 * 3, y0 * 3, x1 * 3, y1 * 3)).resize(((x1 - x0) * z, (y1 - y0) * z), Image.NEAREST))
    os.remove(tmp)
quadros[0].save(saida, save_all=True, append_images=quadros[1:], duration=110, loop=0, optimize=False)
# a folha com os quadros lado a lado (para conferir sem tocar o GIF)
W, H = quadros[0].size
folha = Image.new('RGB', (W * n // 2, H * 2))
for i, q in enumerate(quadros):
    folha.paste(q, ((i % (n // 2)) * W, (i // (n // 2)) * H))
folha.save(os.path.splitext(saida)[0] + '_folha.png')
print('ok', saida)
