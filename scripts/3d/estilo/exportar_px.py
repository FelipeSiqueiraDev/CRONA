"""
Exporta os móveis da cozinha (agente_cozinha/cozinha.py) para o jogo, em pixel art 1:1 (ESC 1: 1 pixel da imagem =
1 pixel do tabuleiro), nos 4 giros, no formato de client/public/arte/mobiliario/moveis.json.

Cada móvel é desenhado sozinho, pela mesma função da cena, girado em volta da pegada dele: o motor recebe uma Peca
girada (o ponto local é o ponto da cena, então os materiais continuam iguais) e o acabamento é o da cena (a luz de
cada face, o brilho da quina, o contorno de 1 px), com a sombra macia num chão invisível (semitransparente, dentro
da imagem) e o que passa da viga (a chaminé) sumindo em transparência.

No moveis.json: `escala` 1, `pixel` (o jogo desenha sem suavizar, no pixel inteiro, sem esticar) e `real` (a medida
de verdade, já com o `aumento` do catálogo: a arte vem no tamanho final).

Uso: python exportar_px.py [móvel ...] [--grupo modulo] [--destino pasta] [--folha saida.png]
     (sem nome: todos os de ITENS, inclusive os dos módulos de pecas_px/)
"""
import json
import os
import sys

os.environ['ESC'] = '1'
AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(AQUI, '..', '..', '..'))
sys.path.insert(0, os.path.join(AQUI, '..', 'codigo'))
sys.path.insert(0, os.path.join(AQUI, 'agente_cozinha'))
import numpy as np                     # noqa: E402
from PIL import Image                  # noqa: E402
import motor                           # noqa: E402
from motor import Cena, Peca, CASA, tela   # noqa: E402
import base_estilo as BE               # noqa: E402
import cozinha as CZ                   # noqa: E402

DESTINO = os.path.join(REPO, 'client', 'public', 'arte', 'mobiliario')


def _cadeira():
    s = 0.44 * 1.2
    CZ.cadeira(0.375 - s / 2, 0.375 - s / 2, '-y')


# def do catálogo: (largura e fundo em casas, a quina da pegada na cena (m), o desenho, os estados {estado: desenho})
# Todos desenhados de frente para +y (o giro 4 do jogo).
ITENS = {
    'armario_cozinha': (2, 1, (0.0, 0.0), lambda: CZ.armario(0.0, '+y', enfeite=0), {}),
    'armario_cozinha_l': (2, 3, (0.0, 0.0), lambda: CZ.armario_l(), {}),
    'fogao_lenha': (2, 1, (1.5, 0.0), lambda: CZ.fogao(aceso=False), {'1': lambda: CZ.fogao(aceso=True)}),
    'pia_cozinha': (2, 1, (3.0, 0.0), lambda: CZ.pia(), {}),
    'mesa_cozinha': (3, 2, (3.0, 2.25), lambda: CZ.mesa(2.775, 2.1, 2.7, 1.8, 0.94), {}),
    # as gêmeas vazias (o jogo troca quando os jogadores pegam o que estava em cima/dentro): o mesmo móvel e a mesma
    # âncora, sem os objetos soltos. A mesa da cozinha já é só a mesa: a vazia é ela mesma.
    'armario_cozinha!vazio': (2, 1, (0.0, 0.0), lambda: CZ.armario(0.0, '+y', enfeite=0, vazio=True), {}),
    'mesa_cozinha!vazio': (3, 2, (3.0, 2.25), lambda: CZ.mesa(2.775, 2.1, 2.7, 1.8, 0.94), {}),
    'chair_wood': (1, 1, (0.0, 0.0), _cadeira, {}),
    'crate_wood': (1, 1, (0.0, 3.0), lambda: CZ.caixotes(0.05, 3.06), {}),
    'barrel': (1, 1, (0.0, 3.75), lambda: CZ.barril(0.37, 4.12), {}),
    'plant': (1, 1, (6.75, 3.75), lambda: CZ.espada_sao_jorge(7.12, 4.12), {}),
}
# o fogo do fogão aceso (só no giro de frente da cena: nos outros, a fornalha fica de lado ou de costas)
FOGO = {'fogao_lenha': {'1': 1.0}}
# peças com arte só em alguns giros (a porta: só nas paredes do fundo, giros 4 e 2; nos outros, o jogo desenha a soleira)
SO_GIROS = {}


def _carregar_grupos():
    """
    Os móveis dos outros cômodos ficam em módulos separados (pecas_px/<grupo>.py), um por grupo, para vários
    trabalharem ao mesmo tempo: cada módulo tem o seu ITENS (o mesmo formato daqui) e, se precisar, o FOGO.
    O desenho usa as peças do cozinha.py (CZ) e do base_estilo.py (BE), sempre em volta da pegada na cena.
    """
    import importlib
    pasta = os.path.join(AQUI, 'pecas_px')
    if not os.path.isdir(pasta):
        return
    sys.path.insert(0, pasta)
    for arq in sorted(os.listdir(pasta)):
        if not arq.endswith('.py') or arq.startswith('_'):
            continue
        mod = importlib.import_module(arq[:-3])
        for k, v in getattr(mod, 'ITENS', {}).items():
            if k in ITENS:
                raise SystemExit(f'{k} está em dois lugares (pecas_px/{arq} e outro)')
            ITENS[k] = v
        FOGO.update(getattr(mod, 'FOGO', {}))
        SO_GIROS.update(getattr(mod, 'SO_GIROS', {}))


_carregar_grupos()


# ---------- o motor girado: a Peca da pegada no lugar do MUNDO, e os materiais recebem o ponto da cena ----------
_face_plana = motor.Cena.face_plana
_elipsoide = motor.Cena.elipsoide
PECA = {'p': motor.MUNDO}


def _mat_da_cena(mat):
    """O material recebe o ponto da cena (o local), não o do mundo girado: os padrões não giram errado."""
    def f(L, n, P):
        return mat(L, n, L)
    for k in ('emissivo', 'brilho', 'dureza'):
        if hasattr(mat, k):
            setattr(f, k, getattr(mat, k))
    return f


def _face_plana_girada(self, pts, n, mat, peca, oid, dois_lados=False, normais=None):
    if peca is motor.MUNDO or peca is CZ.M or peca is BE.M:
        peca = PECA['p']
    return _face_plana(self, pts, n, _mat_da_cena(mat), peca, oid, dois_lados, normais)


def _elipsoide_girado(self, C, R, mat, oid, brilho=0.0, corte_z=None):
    p = PECA['p']
    Cw = p.mundo(np.array(C, float)[None])[0]
    R = np.array(R, float)
    if p.rot in (2, 6):
        R = R[[1, 0, 2]]

    def m(L, n, P):
        return mat(p.local(P), n, p.local(P))
    for k in ('emissivo', 'brilho', 'dureza'):
        if hasattr(mat, k):
            setattr(m, k, getattr(mat, k))
    return _elipsoide(self, Cw, R, m, oid, brilho, corte_z)


motor.Cena.face_plana = _face_plana_girada
motor.Cena.elipsoide = _elipsoide_girado


def _viz(a, dy, dx, fill):
    h, w = a.shape[:2]
    out = np.full_like(a, fill)
    ys = slice(max(0, dy), h + min(0, dy))
    yd = slice(max(0, -dy), h + min(0, -dy))
    xs = slice(max(0, dx), w + min(0, dx))
    xd = slice(max(0, -dx), w + min(0, -dx))
    out[yd, xd] = a[ys, xs]
    return out


def desenhar(nome, rot, desenho, forca=0.0):
    """Um móvel num giro: a imagem RGBA (1 px = 1 px do tabuleiro), a âncora (a quina da frente da base) e a medida."""
    W, D, (ox, oy), _, _ = ITENS[nome]
    Wm, Dm = W * CASA, D * CASA
    fx, fy = (Wm, Dm) if rot in (0, 4) else (Dm, Wm)
    p = Peca(ox / CASA, oy / CASA, rot, W, D, -ox, -oy)
    PECA['p'] = p
    folga = 1.2
    cantos = np.array([[x, y, z] for x in (ox - folga, ox + fx + folga) for y in (oy - folga, oy + fy + folga) for z in (0, 4.6)])
    S = tela(cantos)
    x0, y0 = int(S[:, 0].min()) - 4, int(S[:, 1].min()) - 4
    c = Cena(x0, y0, int(S[:, 0].max() - x0) + 4, int(S[:, 1].max() - y0) + 4)
    CZ.c = c
    CZ.pegadas, CZ.luzes, CZ.vidros, CZ.fades, CZ.fades_atras, CZ.lampadas, CZ.itens_peq = [], set(), [], [], [], [], []
    BE.ligar(vars(CZ))
    desenho()
    # o chão invisível que recebe a sombra (no mundo girado)
    chao = c.novo_obj(1, contorno=False, sombra=False)
    _face_plana(c, [(ox - folga, oy - folga, 0), (ox + fx + folga, oy - folga, 0), (ox + fx + folga, oy + fy + folga, 0), (ox - folga, oy + fy + folga, 0)],
                (0, 0, 1), BE.liso('#000000'), motor.MUNDO, chao)
    cor = c.cor.copy()
    nrm, obj, tipo, face, prof, P = c.nrm, c.obj, c.tipo, c.face, c.prof, c.mundoP
    h, w = obj.shape
    Ln = p.local(P)                       # o ponto na cena (para a sombra, o vidro e o que some)
    X, Y, Z = Ln[..., 0], Ln[..., 1], Ln[..., 2]
    nz, nx, ny = nrm[..., 2], nrm[..., 0], nrm[..., 1]
    topo = nz > 0.6
    esq = ~topo & (ny >= nx)
    f = np.where(topo, 1.0, np.where(esq, 0.84, 0.66))
    quente = np.array([16.0, 4.0, -10.0])
    luz_m = np.isin(obj, list(CZ.luzes))
    cor = np.where(luz_m[..., None], cor, cor * f[..., None] + (1 - f[..., None]) * quente)
    movel = (obj >= 0) & (tipo != 1)
    no_chao = tipo == 1
    # a sombra macia no chão (dois degraus) embaixo da pegada, um pouco para a frente e a direita (no mundo)
    Xw, Yw = P[..., 0], P[..., 1]
    dentro = np.zeros((h, w), bool)
    volta = np.zeros((h, w), bool)
    for (a0, a1, b0, b1) in CZ.pegadas:
        q = p.mundo(np.array([[a0, b0, 0.0], [a1, b1, 0.0]]))
        A0, A1 = q[:, 0].min(), q[:, 0].max()
        B0, B1 = q[:, 1].min(), q[:, 1].max()
        dentro |= no_chao & (Xw > A0 + 0.02) & (Xw < A1 + 0.08) & (Yw > B0 + 0.02) & (Yw < B1 + 0.1)
        volta |= no_chao & (Xw > A0 - 0.05) & (Xw < A1 + 0.16) & (Yw > B0 - 0.05) & (Yw < B1 + 0.2)
    alfa_chao = np.where(dentro, 0.32, np.where(volta, 0.14, 0.0))
    # os objetos pequenos nos tampos: a sombrinha de contato
    for (a0, a1, b0, b1, zz) in CZ.itens_peq:
        perto = (np.abs(Z - zz) < 0.012) & (tipo == 3) & topo
        dx = np.maximum(np.maximum(a0 - X, X - a1), 0)
        dy = np.maximum(np.maximum(b0 - Y, Y - b1), 0)
        d = np.hypot(dx, dy)
        som = perto & (d > 0.002) & (d < 0.05) & (X > a0 - 0.01) & (Y > b0 - 0.01)
        cor = np.where(som[..., None], cor * 0.8, cor)
    # o brilho da quina de cima e o contorno (só entre peças do móvel; o chão invisível não conta)
    obj_m = np.where(movel, obj, -1)
    prof_m = np.where(movel, prof, -1e9)
    # o brilho das quinas, as arestas de dentro e o contorno (forte por fora, seletivo entre peças): o mesmo da cena
    sem_contorno = np.isin(obj, [o for o, v in c.contornos.items() if not v])
    cor = CZ.acabar_px(cor, obj, nrm, face, prof, tipo, luz_m, sem_contorno, movel)
    # o vidro dos armários
    if CZ.vidros:
        sx = np.arange(w)[None, :] + c.x0
        sy = np.arange(h)[:, None] + c.y0
        reflexo = ((sx + sy) % 17 < 2) | ((sx + sy) % 17 == 4)
        for (a0, a1, b0, b1, z0, z1) in CZ.vidros:
            m = movel & (X > a0) & (X < a1) & (Y > b0) & (Y < b1) & (Z > z0) & (Z < z1)
            cor = np.where(m[..., None], cor * 0.86 + np.array([196.0, 222.0, 226.0]) * 0.14, cor)
            cor = np.where((m & reflexo)[..., None], cor * 0.8 + np.array([240.0, 250.0, 250.0]) * 0.2, cor)
    alfa = np.where(movel, 1.0, alfa_chao)
    # o que passa da viga (a chaminé) some em transparência, em 5 degraus
    for (oid, zf, alto) in CZ.fades:
        m = (obj == oid) & (Z > zf)
        k = np.ceil(np.clip((Z - zf) / alto, 0, 1) * 5) / 5
        alfa = np.where(m, alfa * (1 - k), alfa)
    # o fogo (desenhado na tela pela cena: só no giro em que a cena está de frente, onde o mundo é a própria cena)
    if forca > 0 and rot == 4:
        cor = np.where(movel[..., None], cor, np.array([214.0, 214.0, 210.0]))
        cor = CZ._fogo(cor, 0.0, forca)
    img = np.zeros((h, w, 4))
    img[..., :3] = np.where(movel[..., None], cor, np.array([22.0, 16.0, 14.0]))
    img[..., 3] = alfa * 255
    img = np.clip(img, 0, 255).round().astype(np.uint8)
    ys, xs = np.nonzero(img[..., 3] > 0)
    a0, a1, b0, b1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    img = img[b0:b1, a0:a1]
    qx, qy = tela(np.array([ox + fx, oy + fy, 0.0]))
    # a medida de verdade (na orientação da cena, giro 4): a caixa do que faz sombra, no ponto da cena
    pts = np.concatenate([Pw for Pw, _ in c.polis] + [np.array([C - R, C + R]) for C, R, _ in c.elips])
    pl = p.local(pts)
    real = [round(float(np.ptp(pl[:, 0])), 3), round(float(np.ptp(pl[:, 1])), 3), round(float(pl[:, 2].max()), 3)]
    return img, (qx - x0 - a0, qy - y0 - b0), real


def exportar(nome, destino):
    W, D, _, desenho, estados = ITENS[nome]
    pasta = os.path.join(destino, nome)
    os.makedirs(pasta, exist_ok=True)

    def vistas(des, suf='', estado='0'):
        out = {}
        real = None
        for rot in SO_GIROS.get(nome, (4, 2, 0, 6)):
            img, (ax, ay), r = desenhar(nome, rot, des, FOGO.get(nome, {}).get(estado, 0.0))
            real = real or r
            arq = f'giro-{rot}{suf}.png'
            Image.fromarray(img, 'RGBA').save(os.path.join(pasta, arq), optimize=True)
            out[str(rot)] = {'arquivo': f'{nome}/{arq}', 'ax': round(float(ax), 1), 'ay': round(float(ay), 1)}
            print(f'{nome} giro {rot}{suf}: {img.shape[1]}x{img.shape[0]}', flush=True)
        return out, real

    giros, real = vistas(desenho)
    ent = {'escala': 1, 'pixel': True, 'exato': True, 'codigo': True, 'giros': giros, 'real': real}
    if nome in SO_GIROS:
        ent['soGiros'] = True
    if estados:
        ent['estados'] = {k: {'giros': vistas(d, f'-{k}', k)[0]} for k, d in estados.items()}
    return ent


def folha(nomes, destino, saida):
    """Os 4 giros de cada móvel lado a lado, num chão de casas (para conferir de olho), ampliado 2x."""
    from PIL import ImageDraw
    lista = json.load(open(os.path.join(destino, 'moveis.json'), encoding='utf-8'))
    linhas = []
    for n in nomes:
        g = lista.get(n, {}).get('giros', {})
        imgs = [Image.open(os.path.join(destino, g[r]['arquivo'])) for r in ('4', '2', '0', '6') if r in g]
        est = lista.get(n, {}).get('estados', {})
        for k, e in est.items():
            imgs += [Image.open(os.path.join(destino, e['giros'][r]['arquivo'])) for r in ('4',) if r in e['giros']]
        if imgs:
            linhas.append((n, imgs))
    if not linhas:
        return
    larg = max(sum(i.width + 12 for i in imgs) for _, imgs in linhas) + 170
    alt = sum(max(i.height for i in imgs) + 14 for _, imgs in linhas)
    F = Image.new('RGBA', (larg, alt), (196, 186, 166, 255))
    d = ImageDraw.Draw(F)
    y = 0
    for n, imgs in linhas:
        h = max(i.height for i in imgs)
        d.text((4, y + 4), n, fill=(40, 30, 20, 255))
        x = 170
        for i in imgs:
            F.alpha_composite(i, (x, y + h - i.height + 7))
            x += i.width + 12
        y += h + 14
    F.resize((F.width * 2, F.height * 2), Image.NEAREST).save(saida)
    print('folha', saida)


def main():
    args = sys.argv[1:]
    saida_folha = None
    if '--folha' in args:
        i = args.index('--folha')
        saida_folha = args[i + 1]
        del args[i:i + 2]
    if '--grupo' in args:
        i = args.index('--grupo')
        mod = __import__(args[i + 1])
        del args[i:i + 2]
        args += list(mod.ITENS)
    destino = DESTINO
    if '--destino' in args:
        i = args.index('--destino')
        destino = os.path.abspath(args[i + 1])
        del args[i:i + 2]
    nomes = args or list(ITENS)
    arq = os.path.join(destino, 'moveis.json')
    lista = json.load(open(arq, encoding='utf-8')) if os.path.exists(arq) else {}
    for n in nomes:
        novo = exportar(n, destino)
        velho = lista.get(n, {})
        # o que a arte nova não traz e o jogo usa continua o de antes: a vista de cima (mapa tático), a caixa da
        # ordem de desenho e o encostar na parede (a porta é parede na ordem de desenho), o balanço da lâmpada
        for k in ('cima', 'caixa', 'encosta', 'pendulo', 'falha', 'cimaEstados'):
            if k in velho and k not in novo:
                novo[k] = velho[k]
        # a tela acesa: as cores que piscam na luz do cômodo continuam; o ponto do brilho era da imagem antiga e sai
        if 'tela' in velho and 'tela' not in novo:
            novo['tela'] = {**velho['tela'], 'giros': {}, **({'paredes': {}} if 'paredes' in velho['tela'] else {})}
        # a variante (`<def>!vazio`, `<def>@metal`): a caixa, o encostar e o resto do jogo são os da peça base
        raiz = n.split('!')[0].split('@')[0]
        base = lista.get(raiz, {}) if raiz != n else {}
        for k in ('caixa', 'encosta', 'pendulo', 'falha'):
            if k in base:
                novo[k] = base[k]
        if 'tela' in base and 'tela' not in novo:
            novo['tela'] = {**base['tela'], 'giros': {}, **({'paredes': {}} if 'paredes' in base['tela'] else {})}
        lista[n] = novo
    os.makedirs(destino, exist_ok=True)
    json.dump(lista, open(arq, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print('ok', len(nomes))
    if saida_folha:
        folha(nomes, destino, saida_folha)


if __name__ == '__main__':
    main()
