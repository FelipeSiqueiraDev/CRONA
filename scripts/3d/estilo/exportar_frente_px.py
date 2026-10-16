"""
A profundidade de cada pixel dos móveis com fogo (a lanterna do poste, a lareira, a fogueira, a forja, o fogão, as
velas), para o fogo animado ficar DENTRO do móvel e não por cima dele (16/10, o Felipe: "o fogo só tá por cima do
poste e não dentro dele"). O jogo desenha a chama e, por cima dela, repõe só os pixels do móvel que estão mais perto
da câmera que a chama (a grade da frente da lanterna, a boca da lareira, as lenhas da frente da fogueira).

Grava, ao lado de cada giro, prof-<giro>[-<estado>].png: a profundidade em metros (na direção da câmera, maior = mais
perto), contada da quina da frente da pegada no chão (a âncora do giro), em 16 bits nos canais R (alto) e G (baixo):
v = (metros + 8) * 4000; alfa 0 onde não há móvel. No moveis.json, `prof` em cada vista de giro.

Uso: python exportar_frente_px.py [móvel ...]   (sem nome: os móveis com fogo, FOGO_PADRAO)
"""
import json
import os
import sys

import numpy as np
from PIL import Image

import exportar_px as EX
from exportar_px import ITENS

FOGO_PADRAO = ['poste_ferro', 'poste_cristal', 'lareira', 'fogueira', 'forja', 'fogao_lenha', 'candles', 'candelabra']
# quanto mais perto da câmera que a chama (metros) um pixel tem de estar para tapá-la (`folgaFogo` no moveis.json): na
# lanterna, a grade fininha na frente da chama tapa logo; na fogueira e na forja, a chama queima no meio das lenhas e
# só o anel de pedras da frente a tapa
FOLGA = {'fogueira': 0.3, 'forja': 0.25, 'lareira': 0.12, 'fogao_lenha': 0.05}


def gravar_prof(prof, arq):
    v = np.clip(np.round((np.nan_to_num(prof, nan=-8.0) + 8.0) * 4000), 0, 65535).astype(np.uint32)
    img = np.zeros(prof.shape + (4,), np.uint8)
    img[..., 0] = v >> 8
    img[..., 1] = v & 255
    img[..., 3] = np.where(np.isnan(prof), 0, 255)
    Image.fromarray(img, 'RGBA').save(arq, optimize=True)


def exportar(nome, lista):
    W, D, _, desenho, estados = ITENS[nome]
    ent = lista.get(nome)
    if not ent:
        print(nome, ': sem arte no moveis.json (rode o exportar_px.py antes)')
        return
    pasta = os.path.join(EX.DESTINO, nome)
    ent['folgaFogo'] = FOLGA.get(nome, 0.02)
    for estado, des in [('0', desenho)] + list((estados or {}).items()):
        alvo = ent['giros'] if estado == '0' else ent.get('estados', {}).get(estado, {}).get('giros')
        if not alvo:
            continue
        suf = '' if estado == '0' else f'-{estado}'
        for g, vista in alvo.items():
            img, _, _ = EX.desenhar(nome, int(g), des, EX.FOGO.get(nome, {}).get(estado, 0.0))
            prof = EX.ULTIMA['prof']
            arte = Image.open(os.path.join(EX.DESTINO, vista['arquivo']))
            if arte.size != (img.shape[1], img.shape[0]):
                print(nome, g, estado, ': o desenho mudou desde a arte do jogo (rode o exportar_px.py antes)', arte.size, img.shape[1::-1])
                continue
            arq = f'prof-{g}{suf}.png'
            gravar_prof(prof, os.path.join(pasta, arq))
            vista['prof'] = f'{nome}/{arq}'
        print(nome, 'estado', estado, 'giros', list(alvo))


def main():
    nomes = sys.argv[1:] or FOGO_PADRAO
    arq = os.path.join(EX.DESTINO, 'moveis.json')
    lista = json.load(open(arq, encoding='utf-8'))
    for n in nomes:
        exportar(n, lista)
    json.dump(lista, open(arq, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
