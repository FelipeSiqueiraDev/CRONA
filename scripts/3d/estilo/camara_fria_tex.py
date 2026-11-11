"""
O piso e a parede da câmara fria do Frigorífico (estilo 'camara_fria'): o ladrilho de pixel art (px/ladrilho) repintado em
azul-petróleo escuro, pela luminância de cada pixel (o desenho, o rejunte e as manchas ficam; o verde e o branco viram azuis).
Roda: python camara_fria_tex.py   (grava client/public/arte/texturas/px/camara_fria/ e o estilo em texturas.json)
"""
import json
import os
import shutil

import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.abspath(os.path.join(AQUI, '..', '..', '..', 'client', 'public', 'arte', 'texturas'))
ORIGEM = os.path.join(TEX, 'px', 'ladrilho')
DESTINO = os.path.join(TEX, 'px', 'camara_fria')

ESCURO = np.array([8, 24, 40], float)
CLARO = np.array([70, 126, 160], float)


def pintar(img):
    a = np.asarray(img.convert('RGBA'), float)
    lum = (a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11) / 255.0
    lum = np.clip((lum - 0.15) / 0.85, 0, 1) ** 1.35
    rgb = ESCURO + (CLARO - ESCURO) * lum[..., None]
    out = np.concatenate([rgb, a[..., 3:4]], axis=-1)
    return Image.fromarray(np.clip(out, 0, 255).round().astype(np.uint8), 'RGBA')


def main():
    os.makedirs(DESTINO, exist_ok=True)
    for nome in os.listdir(ORIGEM):
        if nome.endswith('.png'):
            pintar(Image.open(os.path.join(ORIGEM, nome))).save(os.path.join(DESTINO, nome), optimize=True)
        else:
            shutil.copy(os.path.join(ORIGEM, nome), os.path.join(DESTINO, nome))
    arq = os.path.join(TEX, 'texturas.json')
    j = json.load(open(arq, encoding='utf-8'))
    j['camara_fria'] = {**j['ladrilho'], 'px': 'camara_fria'}
    json.dump(j, open(arq, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print('ok')


if __name__ == '__main__':
    main()
