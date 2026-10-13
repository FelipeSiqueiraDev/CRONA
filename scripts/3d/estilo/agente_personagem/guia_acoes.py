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


def pose_livre(pernas, braco, incl=0.0, resp=0.0, largura=0.095):
    """Como alosi.pose, mas com o ângulo de cada perna (coxa, joelho, pé) e de cada braço (balanço, cotovelo) dados."""
    import alosi as A
    J = {'resp': resp, 'olhos': True, 'incl': incl, 'braco': braco}
    pes = {}
    for lado, (th, kj, pe) in pernas.items():
        a = largura * (1 if lado == 'd' else -1)
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
    """
    O andar agachado (sneak walk, como a referência do Felipe): os joelhos bem dobrados e as pernas mais abertas, o
    quadril baixo, o tronco curvado para a frente, mas a cabeça erguida olhando para a frente; os braços soltos, um
    pouco para fora do corpo e dobrados no cotovelo, as mãos na altura dos joelhos; passos curtos, o pé baixo, quase
    sem subir e descer.
    """
    pernas = {}
    p = fase
    Am = 0.22
    for lado, f0 in (('d', 0.0), ('e', 0.5)):
        q = (p - f0) % 1.0
        th = Am * math.cos(2 * math.pi * q)
        if q > 0.5:
            kk = math.sin(math.pi * (q - 0.5) / 0.5)
            kj, pe = 0.45 * kk, -0.2 * kk
        else:
            kj, pe = 0.08 * max(0.0, math.sin(math.pi * q / 0.5)), 0.0
        pernas[lado] = (th + 0.8, kj + 1.35, pe + 0.4)
    bd = -0.18 * math.cos(2 * math.pi * p)
    # os braços: o tronco curvado leva o "para baixo" do corpo para trás; o balanço de 0,8 deixa o braço quase em pé
    # no mundo (um pouco à frente) e o cotovelo dobrado leva o antebraço para a frente, a mão na altura do joelho
    braco = {'d': (bd + 0.8, 0.75), 'e': (-bd + 0.8, 0.75)}
    J = pose_livre(pernas, braco, incl=0.0, largura=0.13)
    J['curva'] = 0.65          # o tronco curvado para a frente (~37 graus)
    J['cabeca_ergue'] = 0.45   # a cabeça volta para cima (olha para a frente, não para o chão)
    J['abre'] = 0.35           # os braços afastados do corpo
    return J


# as peças que ficam com as pernas (o resto do corpo curva para a frente a partir do quadril)
BAIXO = ('calca_', 'bota_', 'quadril', 'cinto', 'livro')
# as peças da cabeça (voltam para cima em volta do pescoço: J['cabeca_ergue'])
CABECA = ('cabeca', 'nariz', 'orelha', 'cabelo')


def _curvar(A):
    """Troca alosi.montar por um que curva o tronco, os braços e a cabeça para a frente (J['curva'], em rad) em volta
    do quadril: o agachado de verdade, e não só os joelhos dobrados. Uma vez só por processo."""
    if getattr(A, '_curvado', False):
        return
    A._curvado = True
    original = A.montar

    def montar(J):
        partes = original(J)
        ang = J.get('curva', 0.0)
        if not ang:
            return partes
        piv = np.array([0.0, 0.0, 0.52 + J['sobe']])

        def volta(L, pv, a):
            # o inverso do giro para a frente de `a` em volta de pv (eixo x): o ponto do mundo volta para a peça reta
            q = L - pv
            ca, sa = math.cos(a), math.sin(a)
            y = ca * q[:, 1] - sa * q[:, 2]
            z = sa * q[:, 1] + ca * q[:, 2]
            return np.stack([q[:, 0], y, z], 1) + pv

        pesc = np.array([0.0, 0.0, 1.1 + J['sobe']])
        ergue = J.get('cabeca_ergue', 0.0)

        def girar(f, cab=False):
            def d(L):
                R = volta(L, piv, ang)
                if cab and ergue:
                    R = volta(R, pesc, -ergue)
                return f(R)
            return d
        for p in partes:
            if not p.nome.startswith(BAIXO):
                cab = p.nome.startswith(CABECA)
                p.d = girar(p.d, cab)
                if p.liso is not None:
                    p.liso = girar(p.liso, cab)
        return partes
    A.montar = montar
    A.detalhes = lambda q: None        # o guia não precisa do rosto (o gerador desenha)


def _q(args):
    import alosi as A
    _curvar(A)
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
