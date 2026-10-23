"""
O tampo de cada móvel, medido na arte (23/10, o Felipe: "os objetos na pontinha das mesas... tem que ficar centralizado
no topo do objeto"). A altura do catálogo é a da pegada nas regras e nem sempre é a do tampo desenhado: a mesa de jantar
tem 0,76 m no catálogo e o tampo dela, com o aumento, fica mais alto; o que ia em cima afundava e aparecia na borda da
frente. Aqui cada móvel é desenhado de novo no giro 4 (de frente para +y) e o tampo é a maior superfície virada para
cima entre 0,2 e 1,4 m dentro da pegada: a altura dela e a caixa dela, em metros a partir da quina da pegada.

No moveis.json: `tampo` = [u0, u1, v0, v1, z] (u ao longo da largura, v ao longo do fundo, com a frente em v alto; z a
altura). O jogo apoia o que está em cima nessa altura e dentro dessa caixa (RoomView.tampo).

O exportar_px.py já grava o tampo a cada exportação; este refaz só a medida, sem exportar a arte de novo.

Uso: python tampos_px.py [móvel ...]      (sem nome: os da lista do catálogo, scripts/3d/estilo/tampos.txt)
"""
import json
import os
import sys


import exportar_px as EX

DESTINO = EX.DESTINO


def medir(nome):
    W, D, _, desenho, _ = EX.ITENS[nome]
    EX.desenhar(nome, 4, desenho)
    return EX.tampo_da_ultima(nome)


def main():
    nomes = sys.argv[1:]
    if not nomes:
        nomes = [n.strip() for n in open(os.path.join(EX.AQUI, 'tampos.txt'), encoding='utf-8') if n.strip()]
    arq = os.path.join(DESTINO, 'moveis.json')
    lista = json.load(open(arq, encoding='utf-8'))
    medidas = {}
    for n in nomes:
        if n not in EX.ITENS or n not in lista:
            print('sem desenho:', n, flush=True)
            continue
        medidas[n] = medir(n)
        print(n, medidas[n], 'real', lista[n].get('real'), flush=True)
    # lido de novo na hora de gravar: outra exportação pode ter mexido no arquivo enquanto isto media
    lista = json.load(open(arq, encoding='utf-8'))
    for n, t in medidas.items():
        if n not in lista:
            continue
        if t is None:
            lista[n].pop('tampo', None)
        else:
            lista[n]['tampo'] = t
    json.dump(lista, open(arq, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    feitos = len(medidas)
    print('ok', feitos)


if __name__ == '__main__':
    main()
