"""
Os guias das ações para o gerador de imagem: o boneco 3D (alosi.py) na câmera do jogo, em poses que o alosi.py não
tem (sentado, abrindo um armário, andando agachado). Fundo magenta, ampliado 4x, como os guias do andar.

  guia-sentado.png          1 linha x 4: sentado (sem a cadeira), nas 4 diagonais se, sw, ne, nw
  guia-abrir.png            4 linhas (se, sw, ne, nw) x 3: o braço sobe até a porta do armário e puxa
  guia-agachado-<a>-<b>.png 2 linhas x 6: o andar agachado (2 direções por folha, como o andar)

Uso: python3 guia_acoes.py <pasta>
"""
import math
import os
import sys
from multiprocessing import Pool

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import numpy as np            # noqa: E402
from PIL import Image         # noqa: E402

N = 6
DIAG = ['se', 'sw', 'ne', 'nw']
PARES = [('n', 'ne'), ('e', 'se'), ('s', 'sw'), ('w', 'nw')]


def pose_livre(pernas, braco, incl=0.0, resp=0.0):
    """Como alosi.pose, mas com o ângulo de cada perna (coxa, joelho, pé) e de cada braço (balanço, cotovelo) dados."""
    import alosi as A
    J = {'resp': resp, 'olhos': True, 'incl': incl, 'braco': braco}
    pes = {}
    for lado, (th, kj, pe) in pernas.items():
        a = 0.095 * (1 if lado == 'd' else -1)
        H = np.array([a, 0.0, A.QUADRIL_Z])
        K = H + A.COXA * np.array([0, math.sin(th), -math.cos(th)])
        th2 = th - kj
        A_ = K + A.CANELA * np.array([0, math.sin(th2), -math.cos(th2)])
        pes[lado] = (H, K, A_, th2 + pe)
        if lado == 'd':
            J['coxa_d'] = th
    baixo = min(A_[2] for (_, _, A_, _) in pes.values())
    sobe = A.TORNOZELO_Z - baixo
    J['sobe'] = sobe
    J['pernas'] = {k: tuple(v + np.array([0, 0, sobe]) if isinstance(v, np.ndarray) else v for v in t) for k, t in pes.items()}
    return J


def sentado():
    # as coxas para a frente (na horizontal), as canelas na vertical, as mãos nas coxas
    return pose_livre({'d': (1.45, 1.45, 0.0), 'e': (1.45, 1.45, 0.0)}, {'d': (0.55, 0.75), 'e': (0.55, 0.75)})


def abrir(k):
    """k = 0, 1, 2: o braço direito sobe até a altura da porta e puxa (o corpo um pouco inclinado para a frente)."""
    bal = [0.35, 1.05, 1.25][k]
    cot = [0.4, 0.25, 0.75][k]
    return pose_livre({'d': (0.05, 0.0, 0.0), 'e': (-0.05, 0.0, 0.0)}, {'d': (bal, cot), 'e': (0.0, 0.18)}, incl=0.04 * k)


def agachado(fase):
    """O andar agachado: o ciclo do andar com os joelhos dobrados, o quadril baixo e o corpo para a frente."""
    import alosi as A
    J0 = A.pose(andar=fase)
    pernas = {}
    p = fase
    Am = 0.32
    for lado, f0 in (('d', 0.0), ('e', 0.5)):
        q = (p - f0) % 1.0
        th = Am * math.cos(2 * math.pi * q)
        if q > 0.5:
            kk = math.sin(math.pi * (q - 0.5) / 0.5)
            kj, pe = 0.75 * kk, -0.3 * kk
        else:
            kj, pe = 0.12 * max(0.0, math.sin(math.pi * q / 0.5)), 0.0
        pernas[lado] = (th + 0.55, kj + 0.95, pe + 0.2)
    bd = -0.35 * math.cos(2 * math.pi * p)
    braco = {'d': (bd + 0.35, 0.6), 'e': (-bd + 0.35, 0.6)}
    return pose_livre(pernas, braco, incl=0.12)


def _q(args):
    import alosi as A
    tipo, d, k = args
    J = sentado() if tipo == 'sentado' else abrir(k) if tipo == 'abrir' else agachado(k / N)
    return A.rgba(A.render(d, J))


def folha(Q, linhas, cols, w, h):
    f = Image.new('RGBA', (w * cols, h * len(linhas)), (255, 0, 255, 255))
    for r, chaves in enumerate(linhas):
        for c, ch in enumerate(chaves):
            f.alpha_composite(Q[ch], (c * w, r * h))
    return f.resize((f.width * 4, f.height * 4), Image.NEAREST)


if __name__ == '__main__':
    pasta = sys.argv[1]
    os.makedirs(pasta, exist_ok=True)
    tarefas = [('sentado', d, 0) for d in DIAG] + [('abrir', d, k) for d in DIAG for k in range(3)]
    tarefas += [('agachado', d, k) for par in PARES for d in par for k in range(N)]
    with Pool(min(8, os.cpu_count() or 2)) as p:
        res = p.map(_q, tarefas)
    Q = dict(zip(tarefas, res))
    w, h = res[0].size
    folha(Q, [[('sentado', d, 0) for d in DIAG]], 4, w, h).save(os.path.join(pasta, 'guia-sentado.png'))
    folha(Q, [[('abrir', d, k) for k in range(3)] for d in DIAG], 3, w, h).save(os.path.join(pasta, 'guia-abrir.png'))
    for a, b in PARES:
        folha(Q, [[('agachado', d, k) for k in range(N)] for d in (a, b)], N, w, h).save(
            os.path.join(pasta, f'guia-agachado-{a}-{b}.png'))
    print('ok')
