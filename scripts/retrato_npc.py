"""O retrato do NPC a partir da foto de referência (17/10, o Felipe: "ali na direita eu queria as fotinhas bonitas que te
mandei de referência deles"), no formato dos retratos dos agentes: busto (da cabeça à cintura), fundo transparente,
1024 x 1280, gravado como retrato-desarmado.png na pasta do personagem (o jogo acha sozinho e faz ele respirar).

    python scripts/retrato_npc.py <foto.png> <pasta do personagem> [--busto 0.46] [--ver saida.png]

--busto: quanto da altura da figura (de cima para baixo) entra no retrato (padrão 0.46: cabeça, peito e cintura).
Precisa do rembg (pip install "rembg[cpu]").
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image
from rembg import new_session, remove

W, H = 1024, 1280
MARGEM_TOPO = 0.03


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('foto')
    ap.add_argument('pasta')
    ap.add_argument('--busto', type=float, default=0.46)
    ap.add_argument('--ver')
    ap.add_argument('--modelo', default='isnet-anime')
    a = ap.parse_args()

    im = Image.open(a.foto).convert('RGBA')
    sem = remove(im, session=new_session(a.modelo))
    alfa = np.array(sem)[..., 3]
    ys, xs = np.nonzero(alfa > 40)
    topo, base = ys.min(), ys.max()
    altura = base - topo
    corte_y1 = int(topo + altura * a.busto)
    # a largura do busto: a do desenho nessa faixa, com folga; centrado no meio dela
    faixa = alfa[topo:corte_y1] > 40
    cols = np.nonzero(faixa.any(axis=0))[0]
    cx = (cols.min() + cols.max()) / 2
    alto = corte_y1 - topo
    # a caixa no formato 4:5 que cabe o busto inteiro (a cabeça com uma folga em cima)
    caixa_h = alto / (1 - MARGEM_TOPO)
    caixa_w = max(caixa_h * W / H, (cols.max() - cols.min()) * 1.04)
    caixa_h = caixa_w * H / W
    x0 = int(round(cx - caixa_w / 2))
    y0 = int(round(topo - caixa_h * MARGEM_TOPO))
    recorte = Image.new('RGBA', (int(caixa_w), int(caixa_h)), (0, 0, 0, 0))
    recorte.paste(sem.crop((x0, y0, x0 + int(caixa_w), y0 + int(caixa_h))), (0, 0))
    # embaixo, o corpo some aos poucos (como nos retratos dos agentes, que terminam na cintura)
    arr = np.array(recorte).astype(float)
    hh = arr.shape[0]
    fim = int(hh * 0.88)
    for y in range(fim, hh):
        arr[y, :, 3] *= max(0.0, 1 - (y - fim) / (hh - fim))
    final = Image.fromarray(arr.astype('uint8')).resize((W, H), Image.LANCZOS)
    destino = Path(a.pasta) / 'retrato-desarmado.png'
    final.save(destino)
    print(destino, final.size)
    if a.ver:
        fundo = Image.new('RGBA', (W, H), (70, 70, 80, 255))
        fundo.alpha_composite(final)
        fundo.convert('RGB').resize((W // 2, H // 2)).save(a.ver)


if __name__ == '__main__':
    main()
