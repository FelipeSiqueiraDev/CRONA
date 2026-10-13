"""
A arte da Viagem (viagem-van.zip, -mundo.zip, -veiculos.zip, -ilustracoes.zip) para dentro do jogo:

  python scripts/3d/viagem_arte.py <pasta com os zips já abertos> [saida]

- O CASCO da van (van-preta-corte.png, só a vista 4): o quadrante da vista 4, como veio, com o ponto onde o chão
  da caixa (z = 0, debaixo das rodas) tem a quina de trás-em-cima (x = 0, y = 0). A escala do gabarito é 1,586
  (folha de 760 x 640 por vista); no jogo a casa meia-largura tem 32 px, então o desenho vai a 1 / 1,586.
- A árvore, o poste, o sedan e o caminhão: uma vista só (a primeira: a frente para baixo-esquerda), recortada e
  reduzida ao tamanho de verdade (52,3 px por metro de altura; o comprimento, pela caixa no isométrico).
- As ilustrações (1920 x 1080) vão como estão para a pasta do botão "Ilustração" (ainda por fazer).

Escreve client/public/arte/viagem/*.png e viagem.json (a âncora de cada peça, em px do PNG).
"""
import json
import os
import sys

import fitz
import numpy as np

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAIDA = os.path.join(RAIZ, 'client', 'public', 'arte', 'viagem')

S = 1.586  # a escala da folha do gabarito para o jogo
PX_Z = 52.3  # px por metro de altura
PX_M = 32 / 0.75  # px por metro no chão, no eixo do losango (meia largura de casa / 0,75 m)


def ler(p):
    pm = fitz.Pixmap(p)
    if pm.alpha == 0:
        pm = fitz.Pixmap(pm, 1)
    return np.frombuffer(pm.samples, np.uint8).reshape(pm.h, pm.w, 4).copy()


def salvar(a, p):
    a = np.ascontiguousarray(a)
    fitz.Pixmap(fitz.csRGB, a.shape[1], a.shape[0], a.tobytes(), True).save(p)


def reduzir(a, largura):
    """reduz com o reamostrador do fitz, mantendo a proporção"""
    h, w = a.shape[:2]
    novo_h = max(1, round(h * largura / w))
    pm = fitz.Pixmap(fitz.csRGB, w, h, np.ascontiguousarray(a).tobytes(), True)
    r = fitz.Pixmap(pm, largura, novo_h)
    return np.frombuffer(r.samples, np.uint8).reshape(r.h, r.w, 4).copy()


def caixa_alfa(a, lim=20):
    ys, xs = np.nonzero(a[..., 3] > lim)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def peca(a, quadrante, alvo_largura=None, alvo_altura=None):
    """a vista do quadrante (0 = em cima à esquerda), recortada, no tamanho do jogo; âncora = meio da base"""
    h, w = a.shape[:2]
    qx, qy = (quadrante % 2) * (w // 2), (quadrante // 2) * (h // 2)
    q = a[qy:qy + h // 2, qx:qx + w // 2]
    x0, y0, x1, y1 = caixa_alfa(q)
    rec = q[y0:y1, x0:x1]
    largura = alvo_largura if alvo_largura else round(rec.shape[1] * alvo_altura / rec.shape[0])
    rec = reduzir(rec, int(largura))
    return rec, (rec.shape[1] / 2, rec.shape[0] - 1)


def main():
    pasta = sys.argv[1]
    saida = sys.argv[2] if len(sys.argv) > 2 else SAIDA
    os.makedirs(saida, exist_ok=True)
    meta = {}

    # o casco da van: o quadrante da vista 4 (embaixo à direita), como veio
    a = ler(os.path.join(pasta, 'zvan', 'van-preta-corte.png'))
    h, w = a.shape[:2]
    qx, qy = w // 2, h // 2
    # a folha 1520 x 1350: as células têm 760 x 640 e o título ocupa 70 px em cima
    q = a[qy - 5:, qx:]
    # o ponto (x = 0, y = 0, z = 0) da caixa na folha, pela conta do gabarito (ver gabarito.py, peça de chão)
    ox = 760 + 380 - (6.0 - 2.25) / 2 * (32 / 0.75) * S
    oy = 70 + 640 + 0.62 * 640 - (6.0 + 2.25) / 2 * (16 / 0.75) * S + 1.7 * 52.3 * S * 0.35
    x0, y0, x1, y1 = caixa_alfa(q)
    recorte = q[max(0, y0 - 4):y1 + 4, max(0, x0 - 4):x1 + 4]
    ox_r = ox - qx - max(0, x0 - 4)
    oy_r = oy - (qy - 5) - max(0, y0 - 4)
    salvar(recorte, os.path.join(saida, 'van-casco.png'))
    meta['van-casco'] = {'arquivo': 'van-casco.png', 'ax': round(float(ox_r), 1), 'ay': round(float(oy_r), 1), 'escala': round(1 / S, 4)}

    # a árvore (6 m), o poste (8 m): uma vista só, pela altura
    for nome, zip_, arq, altura_m in [('arvore', 'zmundo', 'arvore-estrada.png', 6.0), ('poste', 'zmundo', 'poste-luz-estrada.png', 8.0)]:
        rec, (ax, ay) = peca(ler(os.path.join(pasta, zip_, arq)), 0, alvo_altura=altura_m * PX_Z)
        salvar(rec, os.path.join(saida, nome + '.png'))
        meta[nome] = {'arquivo': nome + '.png', 'ax': round(ax, 1), 'ay': round(ay, 1), 'escala': 1}

    # o sedan e o caminhão (a vista 2: vão embora para cima-esquerda, como quem vem na outra mão): pela largura da caixa no isométrico (comprimento + largura, em metros, vezes 42,7 px)
    for nome, arq, comp, larg in [('sedan', 'carro-sedan.png', 4.4, 1.8), ('caminhao', 'caminhao-bau.png', 8.0, 2.5)]:
        rec, (ax, ay) = peca(ler(os.path.join(pasta, 'zveic', arq)), 1, alvo_largura=(comp + larg) * PX_M)
        salvar(rec, os.path.join(saida, nome + '.png'))
        meta[nome] = {'arquivo': nome + '.png', 'ax': round(ax, 1), 'ay': round(ay, 1), 'escala': 1}

    # as ilustrações, como estão
    ilus = os.path.join(saida, 'ilustracoes')
    os.makedirs(ilus, exist_ok=True)
    for f in sorted(os.listdir(os.path.join(pasta, 'zilus'))):
        if f.startswith('ilust-') and f.endswith('.png'):
            with open(os.path.join(pasta, 'zilus', f), 'rb') as o, open(os.path.join(ilus, f), 'wb') as d:
                d.write(o.read())

    with open(os.path.join(saida, 'viagem.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=1, ensure_ascii=False)
    print(json.dumps(meta, ensure_ascii=False))


if __name__ == '__main__':
    main()
