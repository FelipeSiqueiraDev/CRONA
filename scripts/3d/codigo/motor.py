"""
Motor de pixel art isométrico do CRONA (teste, fora do jogo).

A câmera é a do tabuleiro: casa de 64 x 32 px (0,75 m), 52,26 px por metro na vertical,
câmera girada 45° e inclinada 30°. Cada peça é feita de faces planas (caixas, prismas,
cilindros) com um material procedural; o motor pinta pixel a pixel, com profundidade,
e depois põe o contorno, as arestas, a sombra de contato e as luzes.

Mundo: x e y em casas (x desce para a direita na tela, y desce para a esquerda), z em metros.
Peça: coordenadas locais em metros (u ao longo da largura, v do fundo para a frente, z para cima).
"""
import math
import os
import numpy as np

CASA = 0.75
# ESC: quantos pixels de imagem por pixel do tabuleiro. Acima de 1, o desenho é suave (sem degraus nem dither).
ESC = float(os.environ.get('ESC', '1'))
SUAVE = ESC > 1


def Q(x, n):
    """Arredonda em degraus (pixel art) ou deixa liso (modo suave)."""
    return x if SUAVE else np.round(x * n) / n


def bayer_de(h, w):
    if SUAVE:
        return np.full((h, w), 0.5)
    b = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
    return np.tile(b, (h // 4 + 1, w // 4 + 1))[:h, :w]
# o instante da animação (0..1, um loop): quem anima lê daqui
TEMPO = {"t": 0.0}
KX = 32 / CASA * ESC    # px por metro em x - y
KY = 16 / CASA * ESC    # px por metro em x + y
KZ = 52.26 * ESC        # px por metro na vertical
VISTA = np.array([math.cos(math.radians(30)) * math.cos(math.radians(45)),
                  math.cos(math.radians(30)) * math.sin(math.radians(45)),
                  math.sin(math.radians(30))])  # para a câmera (metros)


def tela(P):
    """P em metros (X, Y, Z) -> (sx, sy) em px."""
    X, Y, Z = P[..., 0], P[..., 1], P[..., 2]
    return np.stack([(X - Y) * KX, (X + Y) * KY - Z * KZ], axis=-1)


class Peca:
    """Uma peça posta no mundo: origem (casas), giro do jogo e tamanho da pegada (casas)."""

    def __init__(self, x, y, rot, W, D, du=0.0, dv=0.0):
        self.x, self.y, self.rot, self.W, self.D = x, y, rot, W, D
        # largura e fundo em metros
        self.Wm, self.Dm = W * CASA, D * CASA
        # o deslocamento do desenho dentro da pegada (para centrar o móvel na casa, como o jogo espera)
        self.du, self.dv = du, dv

    def mundo(self, L):
        """local (u, v, z) metros -> mundo (X, Y, Z) metros."""
        u, v, z = L[..., 0] + self.du, L[..., 1] + self.dv, L[..., 2]
        X0, Y0 = self.x * CASA, self.y * CASA
        if self.rot == 4:      # frente para +y
            X, Y = X0 + u, Y0 + v
        elif self.rot == 0:    # frente para -y
            X, Y = X0 + self.Wm - u, Y0 + self.Dm - v
        elif self.rot == 2:    # frente para +x
            X, Y = X0 + v, Y0 + self.Wm - u
        else:                  # 6: frente para -x
            X, Y = X0 + self.Dm - v, Y0 + u
        return np.stack([X, Y, z], axis=-1)

    def local(self, P):
        X, Y, z = P[..., 0], P[..., 1], P[..., 2]
        X0, Y0 = self.x * CASA, self.y * CASA
        if self.rot == 4:
            u, v = X - X0, Y - Y0
        elif self.rot == 0:
            u, v = X0 + self.Wm - X, Y0 + self.Dm - Y
        elif self.rot == 2:
            v, u = X - X0, Y0 + self.Wm - Y
        else:
            v, u = X0 + self.Dm - X, Y - Y0
        return np.stack([u - self.du, v - self.dv, z], axis=-1)

    def normal(self, n):
        nu, nv, nz = n
        if self.rot == 4:
            return (nu, nv, nz)
        if self.rot == 0:
            return (-nu, -nv, nz)
        if self.rot == 2:
            return (nv, -nu, nz)
        return (-nv, nu, nz)


def _normal_vec(self, N):
    nu, nv, nz = N[:, 0], N[:, 1], N[:, 2]
    if self.rot == 4:
        return np.stack([nu, nv, nz], 1)
    if self.rot == 0:
        return np.stack([-nu, -nv, nz], 1)
    if self.rot == 2:
        return np.stack([nv, -nu, nz], 1)
    return np.stack([-nv, nu, nz], 1)


Peca.normal_vec = _normal_vec

LUZ_CHAVE = np.array([-0.35, 0.45, 1.0]) / np.linalg.norm([-0.35, 0.45, 1.0])
MEIO = (LUZ_CHAVE + VISTA) / np.linalg.norm(LUZ_CHAVE + VISTA)


def luz_vec(N):
    """A luz de cada pixel pela normal (a mesma conta da luz_da_face, para muitas normais)."""
    nx, ny, nz = N[:, 0], N[:, 1], N[:, 2]
    hz = np.hypot(nx, ny)
    lado = np.where(hz > 1e-6, 0.77 + 0.09 * (ny - nx) / np.maximum(hz, 1e-6), 1.0)
    return np.where(nz > 0, nz + (1 - nz) * lado, lado * (1 + 0.15 * nz))


MUNDO = Peca(0, 0, 4, 0, 0)  # o próprio mundo (local = mundo em metros)


class Cena:
    def __init__(self, x0, y0, w, h):
        """A tela: canto (x0, y0) em px da projeção e o tamanho."""
        self.x0, self.y0, self.w, self.h = x0, y0, w, h
        self.cor = np.zeros((h, w, 3))
        self.prof = np.full((h, w), -1e9)
        self.obj = np.full((h, w), -1, dtype=np.int32)
        self.face = np.full((h, w), -1, dtype=np.int32)
        self.tipo = np.zeros((h, w), dtype=np.int8)  # 0 nada, 1 chão, 2 parede, 3 móvel
        self.nz = np.zeros((h, w))                     # componente vertical da normal
        self.mundoP = np.zeros((h, w, 3))
        self.nrm = np.zeros((h, w, 3))
        self.faces = 0
        self.objs = []
        self.contornos = {}  # obj -> cor do contorno (ou None = sem contorno)
        self.polis = []      # os polígonos de quem faz sombra (mundo) e a normal
        self.elips = []      # os elipsoides de quem faz sombra
        self.sombreia = {}

    def novo_obj(self, tipo=3, contorno=True, sombra=True):
        self.objs.append(tipo)
        oid = len(self.objs) - 1
        self.contornos[oid] = contorno
        # as paredes não fazem sombra (o sol entra pela janela, que é desenhada nelas)
        self.sombreia[oid] = sombra and tipo != 2
        return oid

    # ---------- faces ----------
    def face_plana(self, pts_local, n_local, mat, peca, oid, dois_lados=False, normais=None):
        """
        Um polígono convexo plano (pontos locais em metros) com a normal (local, para fora). normais: a normal de
        cada pixel no mundo (a superfície curva iluminada lisa, sem facetas).
        """
        Pl = np.array(pts_local, dtype=float)
        Pw = peca.mundo(Pl)
        n = np.array(peca.normal(n_local), dtype=float)
        n = n / np.linalg.norm(n)
        if self.sombreia.get(oid, True):
            self.polis.append((Pw, n))
        if n @ VISTA <= 1e-6:
            if not dois_lados:
                return
            n = -n
            n_local = tuple(-np.array(n_local, dtype=float))
        S = tela(Pw)
        S[:, 0] -= self.x0
        S[:, 1] -= self.y0
        xmin, xmax = int(math.floor(S[:, 0].min())), int(math.ceil(S[:, 0].max()))
        ymin, ymax = int(math.floor(S[:, 1].min())), int(math.ceil(S[:, 1].max()))
        xmin, ymin = max(xmin, 0), max(ymin, 0)
        xmax, ymax = min(xmax, self.w - 1), min(ymax, self.h - 1)
        if xmin > xmax or ymin > ymax:
            return
        ys, xs = np.mgrid[ymin:ymax + 1, xmin:xmax + 1]
        px = xs + 0.5
        py = ys + 0.5
        dentro = np.ones(px.shape, dtype=bool)
        k = len(S)
        # sentido do polígono na tela
        area = sum(S[i, 0] * S[(i + 1) % k, 1] - S[(i + 1) % k, 0] * S[i, 1] for i in range(k))
        sg = 1 if area > 0 else -1
        for i in range(k):
            a, b = S[i], S[(i + 1) % k]
            cr = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0])
            dentro &= cr * sg >= -1e-9
        if not dentro.any():
            return
        # ponto no mundo de cada pixel: resolve a tela e o plano
        d = n @ Pw[0]
        M = np.array([[KX, -KX, 0], [KY, KY, -KZ], n])
        Mi = np.linalg.inv(M)
        sx = px[dentro] + self.x0
        sy = py[dentro] + self.y0
        rhs = np.stack([sx, sy, np.full(sx.shape, d)], axis=0)
        P = (Mi @ rhs).T
        prof = P @ VISTA
        yy, xx = ys[dentro], xs[dentro]
        melhor = prof > self.prof[yy, xx] + 1e-7
        if not melhor.any():
            return
        yy, xx, P, prof = yy[melhor], xx[melhor], P[melhor], prof[melhor]
        L = peca.local(P)
        cor = mat(L, np.array(n_local, dtype=float), P)
        Npx = None
        if normais is not None:
            Npx = normais(P)
            Npx = Npx / np.linalg.norm(Npx, axis=1, keepdims=True)
            if (Npx @ n) .mean() < 0:
                Npx = -Npx
        if not getattr(mat, 'emissivo', False):
            f = luz_vec(Npx)[:, None] if Npx is not None else luz_da_face(n)
            if SUAVE:
                f = f * (0.9 + 0.1 * np.clip(P[:, 2] / 2.4, 0, 1))[:, None]
            cor = cor * f + (1 - f) * np.array([-10.0, -4.0, 14.0])
            b = getattr(mat, 'brilho', 0.0)
            if b:
                NN = Npx if Npx is not None else np.tile(n, (len(P), 1))
                spec = np.clip(NN @ MEIO, 0, 1) ** getattr(mat, 'dureza', 40)
                cor = cor + 255 * b * spec[:, None]
        self.faces += 1
        self.cor[yy, xx] = cor
        self.prof[yy, xx] = prof
        self.obj[yy, xx] = oid
        # a superfície curva (com normais) é uma face só: sem aresta entre os gomos
        self.face[yy, xx] = (-(abs(hash((oid, round(float(Pw[:, 2].min()), 3)))) % 10**8) - 2) if Npx is not None else self.faces
        self.tipo[yy, xx] = self.objs[oid]
        self.nz[yy, xx] = n[2] if Npx is None else Npx[:, 2]
        self.nrm[yy, xx] = n if Npx is None else Npx
        self.mundoP[yy, xx] = P

    def caixa(self, b, mat, peca, oid, faces='todas', ch=0.0):
        """Caixa local (u0, u1, v0, v1, z0, z1) em metros. mat: um material ou um dict por face. ch: o chanfro das quinas."""
        u0, u1, v0, v1, z0, z1 = b
        if SUAVE and ch == 0.0:
            ch = 0.018
        ch = min(ch, (u1 - u0) / 4, (v1 - v0) / 4, (z1 - z0) / 4)
        if ch > 1e-4 and faces == 'todas':
            return self._caixa_chanfrada(b, mat, peca, oid, ch)
        F = {
            'cima': ([(u0, v0, z1), (u1, v0, z1), (u1, v1, z1), (u0, v1, z1)], (0, 0, 1)),
            'frente': ([(u0, v1, z0), (u1, v1, z0), (u1, v1, z1), (u0, v1, z1)], (0, 1, 0)),
            'costas': ([(u0, v0, z0), (u1, v0, z0), (u1, v0, z1), (u0, v0, z1)], (0, -1, 0)),
            'dir': ([(u1, v0, z0), (u1, v1, z0), (u1, v1, z1), (u1, v0, z1)], (1, 0, 0)),
            'esq': ([(u0, v0, z0), (u0, v1, z0), (u0, v1, z1), (u0, v0, z1)], (-1, 0, 0)),
            'baixo': ([(u0, v0, z0), (u1, v0, z0), (u1, v1, z0), (u0, v1, z0)], (0, 0, -1)),
        }
        for nome, (pts, n) in F.items():
            if faces != 'todas' and nome not in faces:
                continue
            m = mat.get(nome, mat.get('*')) if isinstance(mat, dict) else mat
            if m is None:
                continue
            self.face_plana(pts, n, m, peca, oid)

    def _caixa_chanfrada(self, b, mat, peca, oid, c):
        """A caixa com as quinas de cima e as verticais chanfradas (a luz pega no chanfro: o móvel deixa de ser quadradão)."""
        u0, u1, v0, v1, z0, z1 = b
        def m(nome):
            if not isinstance(mat, dict):
                return mat
            return mat.get(nome) or mat.get('*') or mat.get('cima') or next(iter(mat.values()))
        r2 = 1 / math.sqrt(2)
        F = self.face_plana
        # as faces, recuadas do chanfro
        F([(u0 + c, v0 + c, z1), (u1 - c, v0 + c, z1), (u1 - c, v1 - c, z1), (u0 + c, v1 - c, z1)], (0, 0, 1), m('cima'), peca, oid)
        F([(u0 + c, v1, z0), (u1 - c, v1, z0), (u1 - c, v1, z1 - c), (u0 + c, v1, z1 - c)], (0, 1, 0), m('frente'), peca, oid)
        F([(u0 + c, v0, z0), (u1 - c, v0, z0), (u1 - c, v0, z1 - c), (u0 + c, v0, z1 - c)], (0, -1, 0), m('costas'), peca, oid)
        F([(u1, v0 + c, z0), (u1, v1 - c, z0), (u1, v1 - c, z1 - c), (u1, v0 + c, z1 - c)], (1, 0, 0), m('dir'), peca, oid)
        F([(u0, v0 + c, z0), (u0, v1 - c, z0), (u0, v1 - c, z1 - c), (u0, v0 + c, z1 - c)], (-1, 0, 0), m('esq'), peca, oid)
        # os chanfros de cima (com o material da face de cima, um pouco mais claros pela normal)
        top = m('cima')
        F([(u0 + c, v1 - c, z1), (u1 - c, v1 - c, z1), (u1 - c, v1, z1 - c), (u0 + c, v1, z1 - c)], (0, r2, r2), top, peca, oid)
        F([(u0 + c, v0 + c, z1), (u1 - c, v0 + c, z1), (u1 - c, v0, z1 - c), (u0 + c, v0, z1 - c)], (0, -r2, r2), top, peca, oid)
        F([(u1 - c, v0 + c, z1), (u1 - c, v1 - c, z1), (u1, v1 - c, z1 - c), (u1, v0 + c, z1 - c)], (r2, 0, r2), top, peca, oid)
        F([(u0 + c, v0 + c, z1), (u0 + c, v1 - c, z1), (u0, v1 - c, z1 - c), (u0, v0 + c, z1 - c)], (-r2, 0, r2), top, peca, oid)
        # os chanfros verticais
        for (ua, va, ub, vb, nu, nv, nome) in ((u1 - c, v1, u1, v1 - c, r2, r2, 'frente'), (u0 + c, v1, u0, v1 - c, -r2, r2, 'frente'),
                                               (u1 - c, v0, u1, v0 + c, r2, -r2, 'costas'), (u0 + c, v0, u0, v0 + c, -r2, -r2, 'costas')):
            F([(ua, va, z0), (ub, vb, z0), (ub, vb, z1 - c), (ua, va, z1 - c)], (nu, nv, 0), m(nome), peca, oid)
        # os cantos de cima (triângulos)
        k = 1 / math.sqrt(3)
        for su in (-1, 1):
            for sv in (-1, 1):
                uc = u1 if su > 0 else u0
                vc = v1 if sv > 0 else v0
                F([(uc - su * c, vc - sv * c, z1), (uc, vc - sv * c, z1 - c), (uc - su * c, vc, z1 - c)], (su * k, sv * k, k), top, peca, oid)
        # embaixo
        F([(u0, v0, z0), (u1, v0, z0), (u1, v1, z0), (u0, v1, z0)], (0, 0, -1), m('baixo'), peca, oid)

    def cilindro(self, cu, cv, r, z0, z1, mat, peca, oid, lados=28, tampa=True, r1=None, tampa_mat=None):
        """Cilindro (ou tronco de cone, com r1 em cima) em pé no ponto local (cu, cv)."""
        r1 = r if r1 is None else r1
        for i in range(lados):
            a0 = 2 * math.pi * i / lados
            a1 = 2 * math.pi * (i + 1) / lados
            am = (a0 + a1) / 2
            p = [(cu + r * math.cos(a0), cv + r * math.sin(a0), z0), (cu + r * math.cos(a1), cv + r * math.sin(a1), z0),
                 (cu + r1 * math.cos(a1), cv + r1 * math.sin(a1), z1), (cu + r1 * math.cos(a0), cv + r1 * math.sin(a0), z1)]
            inc = (r - r1) / max(1e-6, z1 - z0)
            n = (math.cos(am), math.sin(am), inc)
            Cw = peca.mundo(np.array([[cu, cv, 0.0]]))[0]
            def normais(P, Cw=Cw, inc=inc):
                h = P[:, :2] - Cw[:2]
                h = h / np.maximum(np.linalg.norm(h, axis=1, keepdims=True), 1e-9)
                return np.concatenate([h, np.full((len(P), 1), inc)], 1)
            self.face_plana(p, n, mat, peca, oid, normais=normais if SUAVE else None)
        if tampa:
            pts = [(cu + r1 * math.cos(2 * math.pi * i / lados), cv + r1 * math.sin(2 * math.pi * i / lados), z1) for i in range(lados)]
            self.face_plana(pts, (0, 0, 1), tampa_mat or mat, peca, oid)

    def elipsoide(self, C, R, mat, oid, brilho=0.0, corte_z=None):
        """
        Um elipsoide no mundo (centro C e raios R em metros): fruta, ovo, pão, o gato. Desenhado direto na tela,
        com a normal de cada pixel (luz em 4 degraus, como pixel art) e um ponto de brilho se `brilho`.
        corte_z: corta embaixo dessa altura (o pão que assenta na tábua).
        """
        C, R = np.array(C, float), np.array(R, float)
        if self.sombreia.get(oid, True):
            self.elips.append((C, R, corte_z))
        caixa = np.array([[C[0] + dx * R[0], C[1] + dy * R[1], C[2] + dz * R[2]] for dx in (-1, 1) for dy in (-1, 1) for dz in (-1, 1)])
        S = tela(caixa)
        xmin, xmax = int(S[:, 0].min() - self.x0) - 1, int(S[:, 0].max() - self.x0) + 1
        ymin, ymax = int(S[:, 1].min() - self.y0) - 1, int(S[:, 1].max() - self.y0) + 1
        xmin, ymin, xmax, ymax = max(0, xmin), max(0, ymin), min(self.w - 1, xmax), min(self.h - 1, ymax)
        if xmin > xmax or ymin > ymax:
            return
        ys, xs = np.mgrid[ymin:ymax + 1, xmin:xmax + 1]
        sx = xs.ravel() + 0.5 + self.x0
        sy = ys.ravel() + 0.5 + self.y0
        # o raio de vista de cada pixel: B + t V, B no plano z = 0
        B = np.stack([(sx / KX + sy / KY) / 2, (sy / KY - sx / KX) / 2, np.zeros_like(sx)], axis=1)
        V = np.array([1.0, 1.0, 2 * KY / KZ])
        Bq, Vq = (B - C) / R, V / R
        a = Vq @ Vq
        b = 2 * Bq @ Vq
        cc = (Bq * Bq).sum(1) - 1
        disc = b * b - 4 * a * cc
        ok = disc >= 0
        t = np.where(ok, (-b + np.sqrt(np.maximum(disc, 0))) / (2 * a), 0)
        P = B + t[:, None] * V
        if corte_z is not None:
            ok &= P[:, 2] >= corte_z
        prof = P @ VISTA
        yy, xx = ys.ravel(), xs.ravel()
        ok &= prof > self.prof[yy, xx] + 1e-7
        if not ok.any():
            return
        yy, xx, P, prof = yy[ok], xx[ok], P[ok], prof[ok]
        N = (P - C) / (R * R)
        N /= np.linalg.norm(N, axis=1, keepdims=True)
        Ld = np.array([-0.35, 0.45, 1.0]); Ld /= np.linalg.norm(Ld)
        d = np.clip(N @ Ld, 0, 1)
        f = Q(0.62 + 0.42 * d, 1 / 0.09)
        cor = mat(P - C, N, P)
        cor = cor * f[:, None] + (1 - f)[:, None] * np.array([-10.0, -4.0, 14.0])
        if brilho:
            spec = (N @ (Ld + VISTA) / np.linalg.norm(Ld + VISTA)) > 0.97
            cor = np.where(spec[:, None], cor + 255 * brilho * 0.5, cor)
        self.faces += 1
        self.cor[yy, xx] = cor
        self.prof[yy, xx] = prof
        self.obj[yy, xx] = oid
        self.face[yy, xx] = self.faces
        self.tipo[yy, xx] = self.objs[oid]
        self.nz[yy, xx] = N[:, 2]
        self.nrm[yy, xx] = N
        self.mundoP[yy, xx] = P

    def luz_janela(self, x0, x1, z0, z1, direcao, cor, forca, parede_y=0.0, aceso=None):
        """O sol da janela da parede do fundo (y = parede_y): o que ele alcança (sem contar quem tapa) clareia, em degraus."""
        P = self.mundoP
        Dv = np.array(direcao, float); Dv /= np.linalg.norm(Dv)
        t = (P[..., 1] - parede_y) / Dv[1]
        Q = P - t[..., None] * Dv
        dentro = (Q[..., 0] > x0) & (Q[..., 0] < x1) & (Q[..., 2] > z0) & (Q[..., 2] < z1) & (t > 0.02)
        dentro &= (self.obj >= 0) & (self.tipo != 2)
        # a borda do feixe se desfaz com o dither, e ele enfraquece longe da janela
        fade = np.clip(1 - t / 4.5, 0, 1)
        h, w = fade.shape
        B = bayer_de(h, w)
        q = fade if SUAVE else np.floor(fade * 4 + B * 0.9) / 4
        s = np.where(dentro, q * forca, 0)
        if aceso is not None:
            s = s * aceso
        # no chão a luz pousa mais forte (o retângulo de sol); no que está em pé, mais fraca
        s = np.where(self.tipo == 1, s, s * 0.45)
        self.cor = self.cor + (np.array(cor) - self.cor * 0.25) * np.clip(s, 0, 1)[..., None] * 0.5

    def oclusao(self, W, D, alto):
        """A sombra dos cantos: o chão perto das paredes e o pé e o canto das paredes escurecem (em degraus)."""
        P = self.mundoP
        X, Y, Z = P[..., 0], P[..., 1], P[..., 2]
        f = np.ones(X.shape)
        chao = self.tipo == 1
        d = np.minimum(X, Y)
        f = np.where(chao, 1 - 0.22 * np.clip(1 - d / 0.35, 0, 1) ** 2, f)
        par = self.tipo == 2
        dz = np.clip(1 - Z / 0.45, 0, 1) ** 2 * 0.2
        dc = np.clip(1 - np.where(X < 0.01, Y, X) / 0.3, 0, 1) ** 2 * 0.16
        f = np.where(par, 1 - np.maximum(dz, dc), f)
        f = Q(f, 14)
        self.cor = self.cor * f[..., None]

    def sombra_pequena(self, itens, raio=0.07, forca=0.38):
        """A sombra de contato dos objetos pequenos no tampo onde estão (itens: (x0, x1, y0, y1, z) em metros)."""
        P = self.mundoP
        X, Y, Z = P[..., 0], P[..., 1], P[..., 2]
        fator = np.ones(X.shape)
        sup = (self.tipo == 3) | (self.tipo == 1)
        for (x0, x1, y0, y1, z) in itens:
            perto = np.abs(Z - z) < 0.012
            dx = np.maximum(np.maximum(x0 - X, X - x1), 0)
            dy = np.maximum(np.maximum(y0 - Y, Y - y1), 0)
            d = np.sqrt(dx * dx + dy * dy)
            s = np.clip(1 - d / raio, 0, 1) ** 1.4 * forca
            # só em volta do objeto (dentro da pegada é o próprio objeto)
            s = np.where(d > 0.002, s, 0)
            fator = np.where(perto & sup, np.minimum(fator, 1 - s), fator)
        fator = Q(fator, 10)
        self.cor = self.cor * fator[..., None]

    def feixe_no_ar(self, x0, x1, z0, z1, direcao, cor, forca, t=0.0, passos=14, alcance=3.2):
        """
        O raio de sol visível no ar (a poeira iluminada): para cada pixel, anda do que se vê na direção da câmera e
        soma quanto do caminho fica dentro do feixe da janela. O brilho tremula devagar ao longo do feixe.
        """
        P = self.mundoP
        Dv = np.array(direcao, float); Dv /= np.linalg.norm(Dv)
        V = np.array([1.0, 1.0, 2 * KY / KZ]); V /= np.linalg.norm(V)
        h, w = P.shape[:2]
        dens = np.zeros((h, w))
        vazio = self.obj < 0
        for k in range(passos):
            s = (k + 0.5) / passos * alcance
            Q = P + V * s
            tt = Q[..., 1] / Dv[1]
            R = Q - tt[..., None] * Dv
            dentro = (R[..., 0] > x0) & (R[..., 0] < x1) & (R[..., 2] > z0) & (R[..., 2] < z1) & (tt > 0.05) & (Q[..., 2] > 0)
            # mais forte perto da janela; tremula em faixas que andam devagar
            tremor = 0.75 + 0.25 * np.sin(tt * 5.0 + R[..., 0] * 9.0 - t * 2 * np.pi)
            dens += np.where(dentro, np.clip(1 - tt / 3.0, 0, 1) * tremor, 0)
        dens = np.where(vazio, 0, dens) / passos
        B = bayer_de(h, w)
        q = np.clip(dens * forca, 0, 1) if SUAVE else np.floor(np.clip(dens * forca, 0, 1) * 6 + B) / 6
        self.cor = self.cor + (np.array(cor) - self.cor * 0.3) * q[..., None] * 0.45

    def particulas(self, pts, cor, forca=1.0):
        """Pontinhos de luz (a poeira no sol): 1 px cada, só onde estão na frente do que já foi desenhado."""
        S = tela(np.array(pts))
        for (sx, sy), P in zip(S, pts):
            x, y = int(sx - self.x0), int(sy - self.y0)
            r = max(0, int(ESC * 0.6))
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    xx, yy = x + dx, y + dy
                    if dx * dx + dy * dy > r * r + 0.5:
                        continue
                    if 0 <= xx < self.w and 0 <= yy < self.h and (np.array(P) @ VISTA) > self.prof[yy, xx] - 1e-6:
                        self.cor[yy, xx] = self.cor[yy, xx] * (1 - forca) + np.array(cor) * forca

    def fumaca(self, puffs):
        """Fumaça ou vapor: bolinhas claras em dither (sem tapar o que está na frente). puffs: (centro, raio m, força)."""
        h, w = self.prof.shape
        bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
        for C, r, f in puffs:
            sx, sy = tela(np.array(C))
            sx, sy = sx - self.x0, sy - self.y0
            rp = r * KX
            x0, x1 = max(0, int(sx - rp) - 1), min(w - 1, int(sx + rp) + 1)
            y0, y1 = max(0, int(sy - rp) - 1), min(h - 1, int(sy + rp) + 1)
            if x0 > x1 or y0 > y1:
                continue
            ys, xs = np.mgrid[y0:y1 + 1, x0:x1 + 1]
            d = np.hypot(xs + 0.5 - sx, ys + 0.5 - sy) / rp
            a = np.clip(1 - d, 0, 1) * f
            frente = (np.array(C) @ VISTA) > self.prof[ys, xs] - 1e-6
            if SUAVE:
                k = np.where(frente, a * 0.6, 0)[..., None]
                self.cor[ys, xs] = self.cor[ys, xs] * (1 - k) + np.array([236, 232, 226]) * k
                continue
            m = (a > bayer[ys % 4, xs % 4]) & frente
            self.cor[ys[m], xs[m]] = self.cor[ys[m], xs[m]] * 0.45 + np.array([236, 232, 226]) * 0.55

    def sombra_direcional(self, direcao, res=0.01, vies=0.012, raio=1, amostras=1, abertura=0.0):
        """
        A sombra de uma luz de longe (o sol, a luz de cima): rasteriza quem faz sombra visto da luz (mapa de
        profundidade) e devolve, para cada pixel da tela, quanto ele está aceso (0 a 1). raio: o borrão do mapa
        (em células); amostras/abertura: várias direções em volta da principal (a sombra macia de uma luz grande).
        """
        d0 = np.array(direcao, float); d0 /= np.linalg.norm(d0)
        P = self.mundoP
        aceso = np.zeros(P.shape[:2])
        rng = np.random.default_rng(7)
        dirs = [d0]
        for k in range(amostras - 1):
            j = rng.normal(size=3); j -= (j @ d0) * d0; j /= np.linalg.norm(j)
            dd = d0 + j * abertura * math.sqrt((k + 1) / amostras); dirs.append(dd / np.linalg.norm(dd))
        for d in dirs:
            u = np.cross(d, [0, 0, 1.0]); u /= np.linalg.norm(u); v = np.cross(d, u)
            todos = np.concatenate([Pw for Pw, _ in self.polis])
            gu, gv = todos @ u, todos @ v
            u0, v0 = gu.min() - 0.1, gv.min() - 0.1
            W = int((gu.max() - u0) / res) + 3
            H = int((gv.max() - v0) / res) + 3
            mapa = np.full((H, W), np.inf)
            for Pw, n in self.polis:
                nd = n @ d
                if abs(nd) < 1e-4:
                    continue
                a, b = (Pw @ u - u0) / res, (Pw @ v - v0) / res
                i0, i1 = max(0, int(a.min())), min(W - 1, int(a.max()) + 1)
                j0, j1 = max(0, int(b.min())), min(H - 1, int(b.max()) + 1)
                if i0 > i1 or j0 > j1:
                    continue
                jj, ii = np.mgrid[j0:j1 + 1, i0:i1 + 1]
                pa, pb = ii + 0.5, jj + 0.5
                dentro = np.ones(pa.shape, bool)
                k = len(a)
                area = sum(a[q] * b[(q + 1) % k] - a[(q + 1) % k] * b[q] for q in range(k))
                sg = 1 if area > 0 else -1
                for q in range(k):
                    cr = (a[(q + 1) % k] - a[q]) * (pb - b[q]) - (b[(q + 1) % k] - b[q]) * (pa - a[q])
                    dentro &= cr * sg >= -1e-6
                if not dentro.any():
                    continue
                # a profundidade (ao longo de d) do plano em cada célula
                pu, pv = pa[dentro] * res + u0, pb[dentro] * res + v0
                t = (n @ Pw[0] - pu * (n @ u) - pv * (n @ v)) / nd
                jj, ii = jj[dentro], ii[dentro]
                mapa[jj, ii] = np.minimum(mapa[jj, ii], t)
            for C, R, cz in self.elips:
                a, b = (C @ u - u0) / res, (C @ v - v0) / res
                rr = R.max() / res
                i0, i1 = max(0, int(a - rr)), min(W - 1, int(a + rr) + 1)
                j0, j1 = max(0, int(b - rr)), min(H - 1, int(b + rr) + 1)
                if i0 > i1 or j0 > j1:
                    continue
                jj, ii = np.mgrid[j0:j1 + 1, i0:i1 + 1]
                q = (((ii + 0.5 - a) * res / R[0]) ** 2 + ((jj + 0.5 - b) * res / R[1]) ** 2) < 1
                mapa[jj[q], ii[q]] = np.minimum(mapa[jj[q], ii[q]], C @ d - R.min())
            self._mapa = (mapa, u, v, d, u0, v0, res)
            # quem está na tela: a célula dele e a vizinhança (o borrão)
            a = ((P @ u - u0) / res).astype(int)
            b = ((P @ v - v0) / res).astype(int)
            t = P @ d
            # a margem cresce com a inclinação da face em relação à luz (sem isso a face se sombreia sozinha)
            cs = -(self.nrm @ d)
            tg = np.sqrt(np.clip(1 - cs * cs, 0, 1)) / np.maximum(cs, 0.15)
            margem = vies + res * (raio + 1.5) * tg
            soma = np.zeros(t.shape); cont = 0
            for dj in range(-raio, raio + 1):
                for di in range(-raio, raio + 1):
                    ia = np.clip(a + di, 0, W - 1); ib = np.clip(b + dj, 0, H - 1)
                    soma += (t <= mapa[ib, ia] + margem)
                    cont += 1
            # a face de costas para a luz já é escura pela própria luz da face: não escurece de novo
            aceso += np.where(cs <= 0.02, 1.0, soma / cont)
        aceso /= len(dirs)
        return np.where(self.obj >= 0, aceso, 1.0)

    def escurecer(self, aceso, forca, so=None):
        """Escurece o que está na sombra (a cor puxa para o frio)."""
        k = (1 - aceso) * forca
        if so is not None:
            k = np.where(so, k, 0)
        self.cor = self.cor * (1 - k[..., None]) + k[..., None] * np.array([18.0, 20.0, 34.0]) * 0.6

    def brilho_de_quina(self, forca=1.13):
        """A linha clara na quina da frente dos tampos (o pixel do topo logo acima de uma face em pé da mesma peça)."""
        O, F, nz = self.obj, self.face, self.nz
        h, w = O.shape
        topo = nz > 0.7
        abaixo_O = np.full_like(O, -1); abaixo_O[:-1] = O[1:]
        abaixo_F = np.full_like(F, -1); abaixo_F[:-1] = F[1:]
        abaixo_nz = np.zeros_like(nz); abaixo_nz[:-1] = nz[1:]
        m = topo & (abaixo_O == O) & (abaixo_F != F) & (abaixo_nz < 0.5) & (O >= 0) & (self.tipo == 3)
        self.cor = np.where(m[..., None], self.cor * forca + 6, self.cor)

    # ---------- acabamento ----------
    def contorno(self, escuro=(28, 20, 18)):
        """O contorno de 1 px por fora de cada peça (onde a vizinha é mais funda ou vazia) e as arestas por dentro."""
        h, w = self.prof.shape
        out = self.cor.copy()
        O, D, F = self.obj, self.prof, self.face
        borda = np.zeros((h, w), dtype=bool)
        aresta = np.zeros((h, w), dtype=bool)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            On = np.full_like(O, -1)
            Dn = np.full_like(D, -1e9)
            Fn = np.full_like(F, -1)
            ys = slice(max(0, dy), h + min(0, dy))
            yd = slice(max(0, -dy), h + min(0, -dy))
            xs = slice(max(0, dx), w + min(0, dx))
            xd = slice(max(0, -dx), w + min(0, -dx))
            On[yd, xd] = O[ys, xs]
            Dn[yd, xd] = D[ys, xs]
            Fn[yd, xd] = F[ys, xs]
            outro = (O >= 0) & (On != O) & (Dn < D - 0.02)
            borda |= outro
            aresta |= (O >= 0) & (On == O) & (Fn != F) & (Dn < D - 0.004)
        for oid, c in self.contornos.items():
            if not c:
                m = O == oid
                borda &= ~m
                aresta &= ~m
        if SUAVE:
            # no desenho suave o contorno é mais grosso (uns 0,6 px do tabuleiro), para dentro da peça, e mais leve
            for _ in range(max(0, int(round(ESC * 0.6)) - 1)):
                nb = borda.copy()
                for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                    sh = np.zeros_like(borda)
                    ys = slice(max(0, dy), h + min(0, dy)); yd = slice(max(0, -dy), h + min(0, -dy))
                    xs = slice(max(0, dx), w + min(0, dx)); xd = slice(max(0, -dx), w + min(0, -dx))
                    sh[yd, xd] = borda[ys, xs]
                    On = np.full_like(O, -2); On[yd, xd] = O[ys, xs]
                    nb |= sh & (On == O) & (O >= 0)
                borda = nb
            out[borda] = out[borda] * 0.42 + np.array(escuro) * 0.45
            out[aresta & ~borda] = out[aresta & ~borda] * 0.93
        else:
            # o contorno: a cor da peça bem escura (pixel art de verdade não usa preto puro)
            out[borda] = out[borda] * 0.32 + np.array(escuro) * 0.55
            out[aresta & ~borda] = out[aresta & ~borda] * 0.78
        self.cor = out
        self.borda = borda

    def sombra_de_contato(self, ocup, raio=0.32, forca=0.42):
        """Escurece o chão e o pé das paredes perto das peças (ocup: lista de retângulos no chão, metros)."""
        P = self.mundoP
        fator = np.ones(P.shape[:2])
        chao = (self.tipo == 1) | ((self.tipo == 2) & (P[..., 2] < 0.5))
        X, Y, Z = P[..., 0], P[..., 1], P[..., 2]
        for (x0, x1, y0, y1, alto) in ocup:
            dx = np.maximum(np.maximum(x0 - X, X - x1), 0)
            dy = np.maximum(np.maximum(y0 - Y, Y - y1), 0)
            dist = np.sqrt(dx * dx + dy * dy) + np.maximum(Z, 0) * 0.9
            s = np.clip(1 - dist / raio, 0, 1) ** 1.6 * forca
            fator = np.minimum(fator, 1 - s)
        fator = np.where(chao, fator, 1)
        # em degraus, como pixel art (3 tons de sombra)
        fator = Q(fator, 12)
        self.cor = self.cor * fator[..., None]

    def luz(self, P0, raio, cor, forca, so_chao=False):
        """Uma luz quente (lâmpada, fogo): clareia em volta, em degraus (dither de 2 tons)."""
        P = self.mundoP
        d = np.linalg.norm(P - np.array(P0), axis=-1)
        s = np.clip(1 - d / raio, 0, 1) ** 1.5 * forca
        if so_chao:
            s = np.where(self.tipo == 1, s, s * 0.35)
        s = np.where(self.obj >= 0, s, 0)
        # dither ordenado (Bayer 4x4) para a borda da luz não virar degradê liso
        h, w = s.shape
        B = bayer_de(h, w)
        q = s if SUAVE else np.floor(s * 8 + B) / 8
        c = np.array(cor) / 255.0
        self.cor = self.cor + (np.array(cor) - self.cor * 0.35) * q[..., None] * 0.55 * np.clip(c.mean() + 0.3, 0, 1)

    def imagem(self, fundo=(29, 27, 34)):
        img = np.where((self.obj >= 0)[..., None], self.cor, np.array(fundo))
        return np.clip(img, 0, 255).astype(np.uint8)


# ---------- ajudas de cor ----------
def hexa(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)


def luz_da_face(n):
    """A luz chapada da face pela normal no mundo: o topo 1, a face +y (esquerda na tela) 0,86, a +x (direita) 0,68."""
    nx, ny, nz = n
    lado = 0.77 + 0.09 * (ny - nx) / max(1e-6, math.hypot(nx, ny)) if (nx or ny) else 1.0
    f = nz * 1.0 + (1 - nz) * lado if nz > 0 else lado * (1 + 0.15 * nz)
    return f if SUAVE else round(f / 0.03) * 0.03


def emissivo(f):
    f.emissivo = True
    return f


def suave(a, b, esc, seed=0):
    """Ruído suave (valor interpolado) para manchas orgânicas."""
    A, B = np.asarray(a) / esc, np.asarray(b) / esc
    i, j = np.floor(A), np.floor(B)
    fa, fb = A - i, B - j
    fa, fb = fa * fa * (3 - 2 * fa), fb * fb * (3 - 2 * fb)
    r = lambda x, y: ruido(x, y, seed)
    return (r(i, j) * (1 - fa) + r(i + 1, j) * fa) * (1 - fb) + (r(i, j + 1) * (1 - fa) + r(i + 1, j + 1) * fa) * fb


def ruido(*a):
    """Ruído determinístico por posição (para variar tábua, ladrilho, mancha)."""
    x = np.sin(sum(np.asarray(v) * k for v, k in zip(a, (12.9898, 78.233, 37.719, 4.581)))) * 43758.5453
    return x - np.floor(x)
