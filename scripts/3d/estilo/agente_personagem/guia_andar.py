"""
O guia do andar para o gerador de imagem: o boneco 3D (alosi.py) na câmera do jogo, 6 quadros do passo em cada
direção. Sai em 4 folhas (2 direções por folha, 2 linhas x 6 colunas), ampliadas 4x, no fundo magenta.

Uso: python3 guia_andar.py <pasta>
"""
import os
import sys
from multiprocessing import Pool

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from PIL import Image          # noqa: E402

N = 6
FOLHAS = [('n', 'ne'), ('e', 'se'), ('s', 'sw'), ('w', 'nw')]


def _q(args):
    import alosi as A
    d, k = args
    return A.rgba(A.render(d, A.pose(andar=k / N)))


if __name__ == '__main__':
    pasta = sys.argv[1]
    os.makedirs(pasta, exist_ok=True)
    tarefas = [(d, k) for par in FOLHAS for d in par for k in range(N)]
    with Pool(min(8, os.cpu_count() or 2)) as p:
        res = p.map(_q, tarefas)
    Q = dict(zip(tarefas, res))
    w, h = res[0].size
    for i, par in enumerate(FOLHAS):
        f = Image.new('RGBA', (w * N, h * 2), (255, 0, 255, 255))
        for r, d in enumerate(par):
            for k in range(N):
                f.alpha_composite(Q[(d, k)], (k * w, r * h))
        f = f.resize((f.width * 4, f.height * 4), Image.NEAREST)
        f.save(os.path.join(pasta, f'guia-andar-{i + 1}-{par[0]}-{par[1]}.png'))
    print('ok', w, h)
