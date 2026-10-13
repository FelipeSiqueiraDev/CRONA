"""O guia do passo: o boneco 3D na câmera do jogo, parado e com cada pé na frente (3 quadros), por direção."""
import os, sys
from multiprocessing import Pool
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from PIL import Image


def _q(args):
    import alosi as A
    d, fase = args
    J = A.pose() if fase is None else A.pose(andar=fase)
    return A.rgba(A.render(d, J))


if __name__ == '__main__':
    pasta = sys.argv[1]
    dirs = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
    tarefas = [(d, f) for d in dirs for f in (0.0, None, 0.5)]
    with Pool(8) as p:
        res = p.map(_q, tarefas)
    Q = dict(zip(tarefas, res))
    w, h = res[0].size
    for d in dirs:
        f = Image.new('RGBA', (w * 3, h), (255, 0, 255, 255))
        for i, fase in enumerate((0.0, None, 0.5)):
            f.alpha_composite(Q[(d, fase)], (i * w, 0))
        f.resize((f.width * 4, f.height * 4), Image.NEAREST).save(os.path.join(pasta, f'guia-passo-{d}.png'))
    print('ok')
