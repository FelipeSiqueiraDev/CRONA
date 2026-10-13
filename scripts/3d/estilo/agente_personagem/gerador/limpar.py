"""
Limpa a folha que o gerador de imagem fez (pixel art "falsa": blocos de tamanho irregular, alfa macio, cores demais)
para pixel art de verdade: acha a grade, pega a cor do meio de cada bloco, alfa só 0 ou 255, paleta limitada,
separa os bonecos.

Uso: python3 limpar.py folha.png [px_x px_y off_x off_y] [cores]
"""
import sys, os
import numpy as np
from PIL import Image


def grade(a):
    """O passo e o começo da grade em x e em y (o que mais bate com as bordas das cores)."""
    g = a[..., :3].mean(2) * (a[..., 3] / 255)
    out = []
    for ax in (1, 0):
        d = np.abs(np.diff(g, axis=ax)).sum(1 - ax)
        best = (0, 0, 0)
        for p in np.arange(5.0, 12.01, 0.02):
            for off in np.arange(0, p, 0.25):
                idx = np.arange(off, len(d) - 1, p).astype(int)
                v = d[idx].mean()
                if v > best[0]:
                    best = (v, p, off)
        out.append(best[1:])
    return out


def reduzir(a, px, py, ox, oy):
    H, W = a.shape[:2]
    xs = np.arange(ox + px / 2, W - 1, px)
    ys = np.arange(oy + py / 2, H - 1, py)
    out = np.zeros((len(ys), len(xs), 4))
    for i, y in enumerate(ys):
        for j, x in enumerate(xs):
            y0, y1 = int(y - py * 0.25), int(y + py * 0.25) + 1
            x0, x1 = int(x - px * 0.25), int(x + px * 0.25) + 1
            blk = a[y0:y1, x0:x1].reshape(-1, 4)
            op = blk[blk[:, 3] > 127]
            if len(op) * 2 >= len(blk):
                out[i, j, :3] = np.median(op[:, :3], 0)
                out[i, j, 3] = 255
    return out


def paleta(n, cores):
    m = n[..., 3] > 0
    im = Image.fromarray(np.where(m[..., None], n[..., :3], 0).astype(np.uint8))
    q = im.quantize(cores, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    o = n.copy()
    o[..., :3] = np.asarray(q)
    return o


def solto(n):
    """O pixel opaco sem vizinho opaco (ou o furo sem vizinho vazio) some."""
    a = n[..., 3] > 0
    v = np.zeros(a.shape, int)
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        v += np.roll(np.roll(a, dy, 0), dx, 1)
    n[a & (v == 0), 3] = 0
    return n


def separar(n):
    """Os bonecos: as faixas de colunas com algo opaco."""
    col = (n[..., 3] > 0).any(0)
    bon, x = [], 0
    while x < len(col):
        if col[x]:
            x0 = x
            while x < len(col) and col[x]:
                x += 1
            if x - x0 > 4:
                bon.append((x0, x))
        x += 1
    return bon


if __name__ == '__main__':
    f = sys.argv[1]
    a = np.asarray(Image.open(f).convert('RGBA')).astype(float)
    if len(sys.argv) >= 6:
        px, py, ox, oy = map(float, sys.argv[2:6])
    else:
        (px, ox), (py, oy) = grade(a)
    cores = int(sys.argv[6]) if len(sys.argv) > 6 else 40
    print('grade', px, py, ox, oy)
    n = solto(paleta(reduzir(a, px, py, ox, oy), cores))
    base = os.path.splitext(f)[0]
    Image.fromarray(n.astype(np.uint8), 'RGBA').save(base + '_limpo.png')
    ys = np.nonzero((n[..., 3] > 0).any(1))[0]
    for k, (x0, x1) in enumerate(separar(n)):
        b = n[ys.min():ys.max() + 1, x0:x1]
        Image.fromarray(b.astype(np.uint8), 'RGBA').save(f'{base}_{k + 1}.png')
        print(k + 1, b.shape[1], 'x', b.shape[0])


def reduzir_detalhe(a, px, py, ox, oy, lim_escuro=0.22, lim_forte=0.22):
    """
    Como reduzir(), mas guarda o detalhe fino: em cada bloco, a linha escura (contorno, aro dos óculos, olho) ganha
    se cobrir 22% do bloco; depois a cor forte (o dourado, o vinho do livro) se cobrir 22%; senão, a mediana.
    """
    H, W = a.shape[:2]
    xs = np.arange(ox + px / 2, W - 1, px)
    ys = np.arange(oy + py / 2, H - 1, py)
    out = np.zeros((len(ys), len(xs), 4))
    for i, y in enumerate(ys):
        for j, x in enumerate(xs):
            y0, y1 = int(y - py / 2), int(y + py / 2) + 1
            x0, x1 = int(x - px / 2), int(x + px / 2) + 1
            blk = a[max(0, y0):y1, max(0, x0):x1].reshape(-1, 4)
            op = blk[blk[:, 3] > 127]
            if len(op) * 2 < len(blk):
                continue
            rgb = op[:, :3]
            lum = rgb @ np.array([0.3, 0.59, 0.11])
            sat = rgb.max(1) - rgb.min(1)
            escuro = lum < 55
            forte = (sat > 90) & ~escuro
            if escuro.mean() >= lim_escuro:
                c = np.median(rgb[escuro], 0)
            elif forte.mean() >= lim_forte:
                c = np.median(rgb[forte], 0)
            else:
                # a mediana do miolo (sem as bordas do bloco, que misturam com o vizinho)
                yy, xx = np.mgrid[max(0, y0):y1, max(0, x0):x1]
                mio = (np.abs(yy - y) <= py * 0.3) & (np.abs(xx - x) <= px * 0.3)
                m = mio.reshape(-1)[blk[:, 3] > 127]
                c = np.median(rgb[m] if m.any() else rgb, 0)
            out[i, j, :3] = c
            out[i, j, 3] = 255
    return out


def limpar_detalhe(f, px, py, ox, oy, cores=128, sufixo='_d', **k):
    a = np.asarray(Image.open(f).convert('RGBA')).astype(float)
    n = solto(paleta(reduzir_detalhe(a, px, py, ox, oy, **k), cores))
    base = os.path.splitext(f)[0] + sufixo
    Image.fromarray(n.astype(np.uint8), 'RGBA').save(base + '_limpo.png')
    ys = np.nonzero((n[..., 3] > 0).any(1))[0]
    for k, (x0, x1) in enumerate(separar(n)):
        b = n[ys.min():ys.max() + 1, x0:x1]
        Image.fromarray(b.astype(np.uint8), 'RGBA').save(f'{base}_{k + 1}.png')
    return base


def cortes(perfil, passo=8.0, folga=2.2, peso=40.0):
    """
    As divisas da grade de um eixo, para a pixel art "irregular" do gerador (cada pixel dele tem 6 a 10 px):
    programação dinâmica que escolhe cortes onde a borda é forte, com o passo perto do esperado.
    """
    n = len(perfil)
    e = perfil / (perfil.max() + 1e-9)
    lo, hi = int(passo - folga), int(passo + folga) + 1
    melhor = np.full(n + 1, -1e18)
    de = np.full(n + 1, -1)
    for i in range(0, hi):
        melhor[i] = e[i] if i < n else 0
    for i in range(hi, n + 1):
        for s in range(lo, hi + 1):
            j = i - s
            if j < 0 or melhor[j] < -1e17:
                continue
            v = melhor[j] + (e[i] if i < n else 0) - peso * ((s - passo) / passo) ** 2
            if v > melhor[i]:
                melhor[i], de[i] = v, j
    fim = int(np.argmax(melhor[n - hi:]) + n - hi)
    cs = [fim]
    while de[cs[-1]] >= 0:
        cs.append(de[cs[-1]])
    return sorted(cs)


def reduzir_grade(a, passo=8.0):
    """Reduz pela grade achada (cortes em x e em y): cada célula vira um pixel (a mediana do miolo dela)."""
    g = a[..., :3].mean(2) * (a[..., 3] / 255)
    px_ = np.abs(np.diff(g, axis=1)).sum(0)
    py_ = np.abs(np.diff(g, axis=0)).sum(1)
    cx = cortes(np.append(px_, 0), passo)
    cy = cortes(np.append(py_, 0), passo)
    out = np.zeros((len(cy) - 1, len(cx) - 1, 4))
    reduzir_grade.cortes = (cx, cy)
    for i in range(len(cy) - 1):
        for j in range(len(cx) - 1):
            y0, y1, x0, x1 = cy[i], cy[i + 1], cx[j], cx[j + 1]
            my, mx = max(1, (y1 - y0) // 4), max(1, (x1 - x0) // 4)
            blk = a[y0 + my:y1 - my, x0 + mx:x1 - mx].reshape(-1, 4)
            if not len(blk):
                continue
            op = blk[blk[:, 3] > 127]
            if len(op) * 2 >= len(blk):
                out[i, j, :3] = np.median(op[:, :3], 0)
                out[i, j, 3] = 255
    return out


def _faixas(m, folga=20):
    """As faixas (início, fim) onde m tem algo, separadas por vãos maiores que folga."""
    xs = np.nonzero(m)[0]
    out, ini = [], xs[0]
    for p, q in zip(xs[:-1], xs[1:]):
        if q - p > folga:
            out.append((ini, p + 1)); ini = q
    out.append((ini, xs[-1] + 1))
    return out


def limpar_grade(f, passo=8.0, cores=128, sufixo='_g'):
    """Separa os bonecos na imagem grande (linhas e colunas) e reduz cada um pela grade dele."""
    A = np.asarray(Image.open(f).convert('RGBA')).astype(float)
    base = os.path.splitext(f)[0] + sufixo
    res, k0 = [], 0
    for (r0, r1) in _faixas((A[..., 3] > 127).any(1), 10):
        a = A.copy()
        a[:r0, ..., 3] = 0
        a[r1:, ..., 3] = 0
        b, r = _limpar_linha(a, passo, cores, base, k0)
        res += r
        k0 += len(r)
    return base, res


def _limpar_linha(a, passo, cores, base, k0):
    col = (a[..., 3] > 127).any(0)
    xs = np.nonzero(col)[0]
    grupos, ini = [], xs[0]
    for p, q in zip(xs[:-1], xs[1:]):
        if q - p > 20:
            grupos.append((ini, p + 1)); ini = q
    grupos.append((ini, xs[-1] + 1))
    res = []
    for k, (x0, x1) in enumerate(grupos):
        sx0 = max(0, x0 - 4)
        sub = a[:, sx0:x1 + 4]
        ys = np.nonzero((sub[..., 3] > 127).any(1))[0]
        sy0 = max(0, ys.min() - 4)
        sub = sub[sy0:ys.max() + 5]
        n = solto(paleta(reduzir_grade(sub, passo), cores))
        cx, cy = reduzir_grade.cortes
        ys2 = np.nonzero((n[..., 3] > 0).any(1))[0]; xs2 = np.nonzero((n[..., 3] > 0).any(0))[0]
        n = n[ys2.min():ys2.max() + 1, xs2.min():xs2.max() + 1]
        # do pixel da imagem grande para o do boneco reduzido
        def mapa(X, Y, cx=cx, cy=cy, sx0=sx0, sy0=sy0, ox=xs2.min(), oy=ys2.min()):
            j = np.searchsorted(cx, X - sx0, side='right') - 1 - ox
            i = np.searchsorted(cy, Y - sy0, side='right') - 1 - oy
            return j, i
        olhos = achar_olhos(a, x0, x1, ys.min(), ys.max())
        n = desenhar_olhos(n, [mapa(X, Y) for (X, Y) in olhos])
        Image.fromarray(n.astype(np.uint8), 'RGBA').save(f'{base}_{k0 + k + 1}.png')
        res.append(n.shape)
    return base, res


def achar_olhos(a, x0, x1, y0, y1):
    """Os olhos na imagem grande: os grupos de pixels quase brancos (o brilho na lente) no alto do boneco."""
    H = y1 - y0
    reg = a[y0:y0 + int(H * 0.3), x0:x1]
    m = (reg[..., :3].min(-1) > 215) & (reg[..., 3] > 200)
    ys, xs = np.nonzero(m)
    if not len(xs):
        return []
    ordem = np.argsort(xs)
    xs, ys = xs[ordem], ys[ordem]
    grupos, atual = [], [0]
    for k in range(1, len(xs)):
        if xs[k] - xs[k - 1] > 12:
            grupos.append(atual); atual = []
        atual.append(k)
    grupos.append(atual)
    out = []
    for g in grupos:
        if len(g) < 3:
            continue
        out.append((x0 + xs[g].mean(), y0 + ys[g].mean()))
    return out


ARO = np.array([96.0, 52.0, 30.0])
OLHO = np.array([46.0, 24.0, 20.0])
BRILHO = np.array([250.0, 246.0, 236.0])


def desenhar_olhos(n, olhos):
    """Os óculos redondos (aro de 1 px, 5 x 4) com o olho de 1 x 2 e o brilho, no lugar de cada olho achado."""
    n = n.copy()
    H, W = n.shape[:2]

    def p(x, y, c):
        if 0 <= y < H and 0 <= x < W and n[y, x, 3] > 0:
            n[y, x, :3] = c
    for (x, y) in olhos:
        x, y = int(x), int(y)
        for dx in (-1, 0, 1):
            p(x + dx, y - 2, ARO); p(x + dx, y + 2, ARO)
        for dy in (-1, 0, 1):
            p(x - 2, y + dy, ARO); p(x + 2, y + dy, ARO)
        p(x, y, OLHO); p(x, y + 1, OLHO); p(x - 1, y, BRILHO)
    if len(olhos) == 2:
        (xa, ya), (xb, yb) = sorted(olhos)
        for x in range(int(xa) + 3, int(xb) - 2):
            p(x, int(round((ya + yb) / 2)) - 1, ARO)
    return n
