"""O GIF da sala: o fogo aceso, apagando, a fumaça indo embora; a cortina balança o tempo todo."""
import os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
E = os.path.dirname(os.path.abspath(__file__))
G = f'{E}/gif'
ACESO, APAGA, FUMA = 24, 28, 20
quadros = []
for i in range(ACESO + APAGA + FUMA):
    amb = {'FOGO_T': f'{(i % 12) / 12:.4f}', 'JANELA_T': f'{(i % 16) / 16:.4f}', 'FOGO_FUMACA_T': f'{i / 12:.4f}'}
    if i < ACESO:
        amb['FOGO_FORCA'] = '1'
    elif i < ACESO + APAGA:
        k = (i - ACESO + 1) / APAGA
        amb['FOGO_FORCA'] = f'{1 - (3 * k * k - 2 * k ** 3):.4f}'
    else:
        k = (i - ACESO - APAGA + 1) / FUMA
        amb['FOGO_FORCA'] = '0'
        amb['FOGO_FUMACA'] = f'{1 - k:.4f}'
    quadros.append(amb)


def um(i):
    out = f'{G}/q{i:03d}.png'
    subprocess.run([sys.executable, f'{E}/sala4.py', out], env={**os.environ, **quadros[i]}, check=True, capture_output=True)
    return out


with ThreadPoolExecutor(4) as ex:
    arqs = list(ex.map(um, range(len(quadros))))
imgs = []
for a in arqs:
    im = Image.open(a).convert('RGB')
    im = im.resize((im.width // 3, im.height // 3), Image.NEAREST)   # de volta a 1 px da arte
    imgs.append(im.resize((im.width * 2, im.height * 2), Image.NEAREST))
pal = [im.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE) for im in imgs]
pal[0].save(f'{E}/sala_viva.gif', save_all=True, append_images=pal[1:], duration=110, loop=0, optimize=False, disposal=1)
print('ok', len(imgs), imgs[0].size, os.path.getsize(f'{E}/sala_viva.gif') // 1024, 'KB')
