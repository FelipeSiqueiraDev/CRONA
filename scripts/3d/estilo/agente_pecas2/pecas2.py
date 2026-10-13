# ===================== peças 2: as peças pequenas com o desenho da referência =====================
# Para colar na cena: estas defs vão depois das defs antigas (as substituem) e antes da montagem.
# Na montagem, o trecho do vasinho de galhos (o cilindro em (0.66, 5.0), os três galhos e a pegada) vira só:
#     vasinho_galhos(0.66, 5.0)
# Usa o que a cena já tem: c, M, caixa, pegadas, hx, coords, ruido, emissivo, np, math.
# Tudo em pixel limpo: as riscas e as faixas têm a espessura de 1 px exato na tela (PZ na vertical, PH ao longo de x
# ou de y), e o veio vem em pedaços compridos (nunca um pixel solto).

PZ = 1 / 39.195          # 1 px da arte na vertical (m)
PH = 1 / 32.0            # 1 px da arte ao longo de x ou de y (m)
_QUENTE = np.array([16.0, 4.0, -10.0])
_LUZ = np.array([-0.3, 0.55, 1.0]) / np.linalg.norm([-0.3, 0.55, 1.0])


def _fac(n):
    """A luz que o acabamento põe na face (o topo 1, a face +y 0,84, a +x 0,66)."""
    n = np.asarray(n, float)
    n = n / np.linalg.norm(n)
    if n[2] > 0.6:
        return 1.0
    return 0.84 if n[1] >= n[0] else 0.66


def _cru(cor, n):
    """A cor que, depois da luz da face do acabamento, fica igual a `cor` (para o material que já traz a luz)."""
    f = _fac(n)
    return (cor - (1 - f) * _QUENTE) / f


def _tom(cor, k):
    """Clareia (k > 1) ou escurece (k < 1): a sombra puxa para o vermelho-roxo, a luz para o amarelo claro."""
    cor = np.asarray(cor, float)
    k = np.asarray(k, float)
    if k.ndim == 1 and cor.ndim == 2:
        k = k[:, None]
    esc = cor * k + (1 - k) * np.array([11.0, -1.0, 7.0])
    cla = cor + (k - 1) * (np.array([255.0, 238.0, 190.0]) - cor) * 0.9
    return np.where(k < 1, esc, cla)


def _luz_k(d):
    """A luz pela normal (d = normal · luz), em degraus como pixel art."""
    k = np.interp(d, [-1, -0.5, -0.25, 0.46, 0.52, 0.85, 1.0], [0.5, 0.56, 0.66, 0.84, 0.9, 1.0, 1.04])
    return np.round(k / 0.075) * 0.075


def _riscas(t, s, passo, esp, seed, comp=0.22, frac=0.55):
    """Riscas de 1 px (esp) ao longo de t, uma por faixa de `passo`, em pedaços compridos."""
    fila = np.floor(s / passo)
    o = (0.25 + 0.5 * ruido(fila, seed)) * passo
    g = s - fila * passo
    linha = (g >= o) & (g < o + esp)
    seg = np.floor(t / comp + ruido(fila, seed + 1))
    return linha & (ruido(fila, seg, seed + 2) < frac)


def mad2(cor, eixo=0, seed=0, passo=0.1, claro=1.1, escuro=0.9):
    """Madeira de pixel limpo: a cor e o veio em riscas de 1 px, claras e escuras, compridas."""
    c0 = hx(cor)

    def f(L, n, P):
        a, b = coords(L, n)
        t, s = (a, b) if eixo == 0 else (b, a)
        esp = PZ if (abs(n[2]) <= 0.5 and eixo == 0) else PH
        out = np.tile(c0, (len(L), 1))
        r1 = _riscas(t, s, passo, esp, seed)
        r2 = _riscas(t + 0.13, s + passo * 0.5, passo, esp, seed + 9, frac=0.4)
        out = np.where(r1[:, None], _tom(c0, claro), out)
        out = np.where((r2 & ~r1)[:, None], _tom(c0, escuro), out)
        return out
    return emissivo(f)


def tab2(cores, larg, junta='#4a2414', eixo=0, seed=0, comp=None, org=0.0, veio=True, luz_borda=1.1, sombra_borda=0.92):
    """
    Tábuas de pixel limpo: a junta escura de 1 px, a linha clara logo acima dela (a quina que pega luz) e a escura
    logo abaixo; as emendas das pontas (comp) desencontradas; o veio. org: onde começa a primeira tábua.
    """
    cs = np.stack([hx(x) for x in cores])
    jc = hx(junta)

    def f(L, n, P):
        a, b = coords(L, n)
        t, s = (a, b) if eixo == 0 else (b, a)
        vert = abs(n[2]) <= 0.5
        e = PZ if (vert and eixo == 0) else PH          # 1 px de través da tábua
        et = PZ if (vert and eixo == 1) else PH         # 1 px ao longo dela
        s = s - org
        fila = np.floor(s / larg)
        g = s - fila * larg
        if comp:
            off = ruido(fila, seed + 1) * comp
            col = np.floor((t + off) / comp)
            hp = (t + off) - col * comp
        else:
            col = np.zeros_like(t)
            hp = None
        k = (ruido(fila, col, seed + 2) * len(cs)).astype(int) % len(cs)
        out = cs[k]
        if veio:
            # uma risca de veio por tábua, um pouco mais escura, em pedaços bem compridos
            o = np.floor((0.45 + 0.2 * ruido(fila, seed + 4)) * larg / e) * e
            lin = (g >= o) & (g < o + e)
            seg = np.floor(t / 0.34 + ruido(fila, col, seed + 5))
            vv = lin & (ruido(fila, seg, seed + 7) < 0.6)
            out = np.where(vv[:, None], _tom(out, veio if isinstance(veio, float) else 0.93), out)
        out = np.where((g >= larg - e)[:, None], _tom(out, luz_borda), out)
        out = np.where(((g >= e) & (g < 2 * e))[:, None], _tom(out, sombra_borda), out)
        jun = g < e
        if hp is not None:
            jun |= hp < et
            out = np.where(((hp >= et) & (hp < 2 * et))[:, None], _tom(out, 1.08), out)
        return np.where(jun[:, None], jc, out)
    return emissivo(f)


def vol(cx, cy, cor, brilho=0.0, faixas=None, costuras=None):
    """
    O material das peças redondas (cilindro, cone): a luz pela normal de cada pixel (o ângulo em volta do eixo e a
    inclinação da face), em degraus. brilho: a risca de luz no lado aceso (o esmalte, o ferro). faixas: função
    (P, cor) -> cor para pintar faixas em volta. costuras: (n, cor) as linhas verticais das aduelas.
    """
    c0 = hx(cor) if isinstance(cor, str) else np.asarray(cor, float)

    def f(L, n, P):
        nn = np.asarray(n, float) / np.linalg.norm(n)
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        ch = math.sqrt(max(0.0, 1 - nn[2] ** 2))
        N = np.stack([ch * np.cos(th), ch * np.sin(th), np.full(len(P), nn[2])], 1)
        d = N @ _LUZ
        k = _luz_k(d)
        base = np.tile(c0, (len(P), 1))
        if faixas is not None:
            base = faixas(P, base)
        if costuras is not None:
            nc, cc, r = costuras
            sx = (P[:, 0] - P[:, 1]) * 32
            rr = np.hypot(P[:, 0] - cx, P[:, 1] - cy)
            ok = np.zeros(len(P), bool)
            angs = [2 * math.pi * (i + 0.5) / nc for i in range(nc)]
            vis = [a for a in angs if math.cos(a - math.radians(45)) > -0.05]
            xs = sorted([(math.cos(a) - math.sin(a), a) for a in vis])
            for j, (v, a) in enumerate(xs):
                # a costura que fica perto demais da vizinha na tela (perto da borda) some
                viz = [abs(v - w) for (w, _) in xs if w != v]
                if viz and min(viz) * r * 32 < 2.6:
                    continue
                sk = 32 * ((cx - cy) + rr * v)
                ok |= (sx >= sk - 0.5) & (sx < sk + 0.5) & (np.cos(th - a) > 0.2)
            base = np.where(ok[:, None], hx(cc), base)
        out = _vao(_tom(base, k), P)
        if brilho:
            sp = (np.cos(th - math.radians(112)) > 0.965) & (nn[2] < 0.6)
            out = np.where(sp[:, None], _tom(base, 1.0 + brilho), out)
        return _cru(out, n)
    return emissivo(f)


def _poligono_rodado(cx, cy, perfil, mat, oid, lados=22, tampa_mat=None):
    """Uma peça redonda pelo perfil [(z, r), ...] de baixo para cima (o pote, o barril, o vaso): troncos de cone."""
    for (za, ra), (zb, rb) in zip(perfil[:-1], perfil[1:]):
        c.cilindro(cx, cy, ra, za, zb, mat, M, oid, lados=lados, tampa=False, r1=rb)
    if tampa_mat is not None:
        z, r = perfil[-1]
        pts = [(cx + r * math.cos(2 * math.pi * i / lados), cy + r * math.sin(2 * math.pi * i / lados), z) for i in range(lados)]
        c.face_plana(pts, (0, 0, 1), tampa_mat, M, oid)


def _disco(cx, cy, z, r, mat, oid, lados=22):
    pts = [(cx + r * math.cos(2 * math.pi * i / lados), cy + r * math.sin(2 * math.pi * i / lados), z) for i in range(lados)]
    c.face_plana(pts, (0, 0, 1), mat, M, oid)


def _fita(pts2, cx, cy, mat, oid, w):
    """
    Uma fita fina de frente para a câmera (o galho, a alça): pts2 = [(s, z), ...] no plano vertical que passa por
    (cx, cy) de frente para a câmera; s anda para a direita na tela. Cada trecho é um quadrilátero.
    """
    k = 1 / math.sqrt(2)
    for (s0, z0), (s1, z1) in zip(pts2[:-1], pts2[1:]):
        ds, dz = s1 - s0, z1 - z0
        l = math.hypot(ds, dz) or 1e-6
        ps, pz = -dz / l * w / 2, ds / l * w / 2
        q = [(s0 + ps, z0 + pz), (s1 + ps, z1 + pz), (s1 - ps, z1 - pz), (s0 - ps, z0 - pz)]
        c.face_plana([(cx + s * k, cy - s * k, z) for (s, z) in q], (k, k, 0), mat, M, oid)


# ---------------------------------------------------------------- a cadeira ----------------------------------------------------------------
CAD_LADO, CAD_TOPO, CAD_ESC = '#743c22', '#c07c44', '#542a16'
_VAO = {'teto': None}


def _vao(out, P):
    """Dentro do vão da estante: o alto (logo embaixo da prateleira de cima) fica na sombra."""
    t = _VAO['teto']
    if t is None:
        return out
    return np.where((P[:, 2] > t - 0.07)[:, None], _tom(out, 0.8), out)


def _pau(cor, topo=None, quina=1.32, b=None):
    """A peça fina de madeira em cor chapada: a fileira de cima das faces em pé mais clara (a quina que pega luz)."""
    c0 = hx(cor)
    ct = hx(topo) if topo else _tom(c0, 1.3)

    def f(L, n, P):
        if n[2] > 0.5:
            return np.tile(ct, (len(P), 1))
        out = np.tile(c0, (len(P), 1))
        if b is not None and quina:
            out = np.where((P[:, 2] > b[5] - PZ)[:, None], _tom(c0, quina), out)
        return out
    return emissivo(f)


def _barra(b, cor, topo=None, oid=None, quina=1.32):
    o = c.novo_obj(3) if oid is None else oid
    c.caixa(b, _pau(cor, topo, quina, b), M, o)
    return o


def cadeira(x, y, costas, s=0.44):
    """
    A cadeira rústica da referência: os pés de trás sobem e viram os montantes do encosto, o encosto de três
    travessas (a de cima larga) com a quina clara, o assento de duas tábuas claras com a saia escura embaixo e as
    travessas baixas entre os pés. Peças finas em cor chapada (sem veio, que nelas vira pontilhado).
    """
    hs = 0.47

    def B(u0, u1, v0, v1, z0, z1):
        # local: u de través, v da costa (0) para a frente (s)
        if costas == '-y':
            return (x + u0, x + u1, y + v0, y + v1, z0, z1)
        if costas == '+y':
            return (x + u0, x + u1, y + s - v1, y + s - v0, z0, z1)
        if costas == '-x':
            return (x + v0, x + v1, y + u0, y + u1, z0, z1)
        return (x + s - v1, x + s - v0, y + u0, y + u1, z0, z1)
    eu = 0 if costas in ('-y', '+y') else 1      # o eixo de u no tampo
    p = 2 * PH                                  # os pés e montantes: 2 px de cada lado
    fr = 2 * PH                                 # o fundo das travessas: o tampo delas dá 2 px exatos na tela
    # o encosto (um objeto: os montantes e as travessas, sem contorno entre eles)
    o = c.novo_obj(3)
    for u0 in (0.015, s - 0.015 - p):
        _barra(B(u0, u0 + p, 0.015, 0.015 + p, 0, 1.03), CAD_LADO, CAD_TOPO, o, quina=False)
    zt = 1.0
    for (h_, gap) in ((5, 0), (3, 2), (3, 2)):
        z1 = zt - gap * PZ
        z0 = z1 - h_ * PZ
        _barra(B(0.015 + p, s - 0.015 - p, 0.015 + (p - fr) / 2, 0.015 + (p + fr) / 2, z0, z1), CAD_LADO, CAD_TOPO, o, quina=False)
        zt = z0
    # o assento: duas tábuas claras e a saia escura embaixo
    o = c.novo_obj(3)
    bs = B(0.0, s, 0.0, s, hs - 3 * PZ, hs)
    c.caixa(bs, {'cima': tab2(['#c88248', '#c07c44'], s / 2, '#5a2c16', eixo=eu, seed=25, org=(y if eu == 0 else x), veio=False),
                 '*': _pau(CAD_LADO, quina=False, b=bs)}, M, o)
    _barra(B(0.03, s - 0.03, 0.03, s - 0.03, hs - 6 * PZ, hs - 3 * PZ), CAD_ESC, oid=o, quina=False)
    # os pés da frente
    for u0 in (0.015, s - 0.015 - p):
        _barra(B(u0, u0 + p, s - 0.015 - p, s - 0.015, 0, hs - 3 * PZ), CAD_LADO, CAD_TOPO, quina=False)
    # a travessa baixa da frente
    _barra(B(0.015 + p, s - 0.015 - p, s - 0.015 - p / 2 - PH / 2, s - 0.015 - p / 2 + PH / 2, 0.12, 0.12 + 2 * PZ), CAD_LADO, quina=False)
    pegadas.append((x, x + s, y, y + s))


# ---------------------------------------------------------------- a mesa ----------------------------------------------------------------
MESA_TAB = ['#c8844a', '#c07c44', '#cd8b50', '#bb7840']


def _ponta_tabuas(cor, larg, org, junta='#4a2414'):
    """A ponta do tampo (a face em pé onde as tábuas terminam): as juntas descem retas, 1 px."""
    c0, jc = hx(cor), hx(junta)

    def f(L, n, P):
        a, b = coords(L, n)
        g = ((a - org) / larg) % 1 * larg
        out = np.tile(c0, (len(L), 1))
        out = np.where(((g >= larg - PH))[:, None], _tom(c0, 1.08), out)
        return np.where((g < PH)[:, None], jc, out)
    return emissivo(f)


def mesa(x, y, w, d, h=0.78, tampo=0.09, perna=0.1, tabua=0.21):
    """
    A mesa de tábuas grossas: o tampo de tábuas com as emendas desencontradas e a quina clara, as juntas descendo
    pela ponta, a saia escura recuada e os pés grossos com o veio comprido.
    """
    eixo = 0 if w >= d else 1
    org = y if eixo == 0 else x
    TOPO = tab2(MESA_TAB, tabua, '#4e2614', eixo=eixo, seed=31, comp=(0.78 if max(w, d) > 1.0 else None), org=org)
    lado_long = mad2('#94542e', eixo=0, seed=32, passo=0.045)
    ponta = _ponta_tabuas('#94542e', tabua, org)
    mats = {'cima': TOPO, 'frente': lado_long if eixo == 0 else ponta, 'dir': ponta if eixo == 0 else lado_long, '*': lado_long}
    caixa((x, x + w, y, y + d, h - tampo, h), mats, sombra=False)
    # a saia (recuada) e os pés
    caixa((x + 0.06, x + w - 0.06, y + 0.06, y + d - 0.06, h - tampo - 0.11, h - tampo), mad2('#6a3820', eixo=0, seed=33, passo=0.05), sombra=False)
    PE = {'cima': mad2('#a8643a'), '*': mad2('#86492a', eixo=1, seed=34, passo=0.05)}
    for (a, b) in ((x + 0.04, y + 0.04), (x + w - 0.04 - perna, y + 0.04), (x + 0.04, y + d - 0.04 - perna), (x + w - 0.04 - perna, y + d - 0.04 - perna)):
        caixa((a, a + perna, b, b + perna, 0, h - tampo), PE, sombra=False)
    pegadas.append((x, x + w, y, y + d))


# ---------------------------------------------------------------- a mesinha ----------------------------------------------------------------
def mesinha(x, y, w=0.85, d=0.68):
    """A mesinha da frente do sofá (com o quadro de travessas embaixo), a bolsa de couro com a alça e a caneca."""
    mesa(x, y, w, d, h=0.6, tampo=0.07, perna=0.08, tabua=0.17)
    TR = {'cima': mad2('#a8643a', eixo=0), '*': mad2('#7a4226', eixo=0, seed=35, passo=0.04)}
    TRy = {'cima': mad2('#a8643a', eixo=1), '*': mad2('#7a4226', eixo=0, seed=35, passo=0.04)}
    o = c.novo_obj(3)
    for b in (y + 0.06, y + d - 0.09):
        c.caixa((x + 0.12, x + w - 0.12, b, b + 0.03, 0.1, 0.15), TR, M, o)
    for a in (x + 0.06, x + w - 0.09):
        c.caixa((a, a + 0.03, y + 0.12, y + d - 0.12, 0.1, 0.15), TRy, M, o)
    bolsa(x + 0.1, x + 0.46, y + 0.14, y + 0.33, 0.6)
    caneca(x + 0.63, y + 0.42, 0.6)


def bolsa(bx0, bx1, by0, by1, bz, alto=0.16):
    """A bolsa de couro: o corpo de quinas redondas, as duas correias claras com a fivela, a boca e a alça em arco."""
    COURO, COURO_T, CORREIA = hx('#6a3622'), hx('#94543a'), hx('#a8683e')
    xs = (bx0 + (bx1 - bx0) * 0.24, bx0 + (bx1 - bx0) * 0.76)

    def couro(L, n, P):
        if n[2] > 0.5:
            out = np.tile(COURO_T, (len(P), 1))
            corr = np.zeros(len(P), bool)
            for xc in xs:
                corr |= (P[:, 0] >= xc - PH) & (P[:, 0] < xc + PH)
            return np.where(corr[:, None], _tom(CORREIA, 1.1), out)
        out = np.tile(COURO, (len(P), 1))
        z = P[:, 2] - bz
        if n[1] > 0.5:
            corr = np.zeros(len(P), bool)
            fiv = np.zeros(len(P), bool)
            for xc in xs:
                cc = (P[:, 0] >= xc - PH) & (P[:, 0] < xc + PH)
                corr |= cc
                fiv |= cc & (z > alto * 0.55) & (z <= alto * 0.55 + 2 * PZ)
            out = np.where(corr[:, None], CORREIA, out)
            out = np.where(fiv[:, None], hx('#e6c060'), out)
            # a costura embaixo da boca
            out = np.where(((z > alto - 2 * PZ) & (z <= alto - PZ) & ~corr)[:, None], _tom(COURO, 1.25), out)
        elif n[0] > 0.5:
            out = np.where(((z > alto - 2 * PZ) & (z <= alto - PZ))[:, None], _tom(COURO, 1.25), out)
        return out
    o = c.novo_obj(3)
    c.caixa((bx0, bx1, by0, by1, bz, bz + alto), emissivo(couro), M, o, ch=0.035)
    ym = (by0 + by1) / 2
    c.caixa((bx0 + 0.04, bx1 - 0.04, ym - PH, ym + PH, bz + alto, bz + alto + PZ * 1.5), _pau('#3e2014', '#5a3020', quina=False), M, o)
    # a alça em arco, de pé no plano do meio da bolsa
    o = c.novo_obj(3)
    xm = (bx0 + bx1) / 2
    arco = [(xm - 0.08 + 0.16 * i / 10, bz + alto + 0.02 + 0.075 * math.sin(math.pi * i / 10)) for i in range(11)]
    for (u0, z0), (u1, z1) in zip(arco[:-1], arco[1:]):
        du, dz = u1 - u0, z1 - z0
        l = math.hypot(du, dz)
        pu, pz = -dz / l * 0.02, du / l * 0.02
        q = [(u0 + pu, z0 + pz), (u1 + pu, z1 + pz), (u1 - pu, z1 - pz), (u0 - pu, z0 - pz)]
        c.face_plana([(u, ym, zz) for (u, zz) in q], (0, 1, 0), liso('#5a2e1c'), M, o)


def caneca(mx, my, z, mr=0.064, mh=0.13):
    """A caneca de esmalte creme: a borda azul, o friso, a risca de brilho, o café dentro e a asa do lado."""
    def esmalte(P, base):
        zz = P[:, 2] - z
        base = np.where((zz > mh - PZ)[:, None], hx('#34507a'), base)
        return np.where(((zz > 0.035) & (zz <= 0.035 + PZ))[:, None], hx('#5a78a4'), base)
    o = c.novo_obj(3)
    c.cilindro(mx, my, mr, z, z + mh, vol(mx, my, '#ece2cc', brilho=0.3, faixas=esmalte), M, o, lados=20, tampa=False)

    def cafe(L, n, P):
        r = np.hypot(P[:, 0] - mx, P[:, 1] - my)
        out = np.where((r > mr - 0.016)[:, None], hx('#f4ecda'), hx('#3a2016'))
        return np.where(((r > mr - 0.036) & (r <= mr - 0.016) & (P[:, 1] - my < 0))[:, None], hx('#6a4430'), out)
    _disco(mx, my, z + mh, mr, emissivo(cafe), o, lados=20)
    o = c.novo_obj(3)
    _fita([(0.05, z + 0.105), (0.1, z + 0.1), (0.112, z + 0.065), (0.1, z + 0.03), (0.05, z + 0.026)], mx, my, liso('#d8ccb4'), o, 0.03)


# ---------------------------------------------------------------- os livros e as coisas da estante ----------------------------------------------------------------
LIVRO_CORES = ['#84362a', '#3e5266', '#5a6230', '#9e6a34', '#5a3446', '#2e4c3c', '#6e4228', '#94744c', '#5e2422', '#46585e']
PAPEL = '#e6d6b2'
PAPEL_VAO = '#bba57e'      # o papel do topo dos livros em pé (fica na sombra da prateleira)


def _lombada(cor, x0, z0, alto, larg, seed, ang=0.0, frente='y', ymax=None, hmin=None):
    """
    O livro em pé: a lombada com as faixas (claras ou escuras) ou o rótulo creme, a fileira clara do lado da luz;
    no topo, o papel creme com a capa na frente; do lado, a capa mais escura. Faixa só em livro de 2 px ou mais.
    """
    c0 = hx(cor)
    up = (-math.sin(ang), math.cos(ang))
    ac = (math.cos(ang), math.sin(ang))
    estilo = int(ruido(seed, 3.3) * 5)
    if larg < 0.06 and estilo == 0:
        estilo = 1
    if larg < 0.085 and estilo == 2:
        estilo = 3

    def f(L, n, P):
        dx, dz = P[:, 0] - x0, P[:, 2] - z0
        v = dx * up[0] + dz * up[1]
        u = dx * ac[0] + dz * ac[1]
        out = np.tile(c0, (len(P), 1))
        nn = np.asarray(n, float)
        if (frente == 'y' and nn[1] > 0.5) or (frente == 'x' and nn[0] > 0.5):
            if frente == 'x':
                v = P[:, 2] - z0
            band = lambda vv, k=1: (v >= vv) & (v < vv + k * PZ)
            if estilo == 0:
                m = band(alto * 0.14) | band(alto * 0.8)
                out = np.where(m[:, None], _tom(c0, 1.45), out)
            elif estilo == 1:
                out = np.where((band(alto * 0.72, 2) | band(alto * 0.14))[:, None], _tom(c0, 0.6), out)
            elif estilo == 2:
                out = np.where(band(alto * 0.5, 2)[:, None], hx('#c8b088'), out)
            if frente == 'y':
                out = np.where((u < PH)[:, None], _tom(out, 1.14), out)
        elif nn[2] > 0.5:
            # o topo: a capa e o papel juntos, na cor do livro mais clara (o creme puro soltava pixel)
            out = _tom(c0, 1.3)
        else:
            # a capa à mostra: mais escura, com o friso claro 1 px para dentro da borda
            out = _tom(out, 0.85)
            if ymax is not None:
                hc = P[:, 1] if frente == 'y' else P[:, 0]
                vv = v if frente == 'y' else P[:, 2] - z0
                lo = hmin if hmin is not None else -1e9
                dentro = (hc < ymax - PH) & (hc >= lo + PH) & (vv >= PZ) & (vv < alto - PZ)
                fr = (hc >= ymax - 2 * PH) | (hc < lo + 2 * PH) | (vv >= alto - 2 * PZ) | (vv < 2 * PZ)
                out = np.where((fr & dentro)[:, None], _tom(c0, 1.08), out)
        return _vao(out, P)
    return emissivo(f)


def _livro_inclinado(xl, z, w, alto, y0, y1, ang, cor, seed):
    """O livro encostado no vizinho (de pé, inclinado ang para a esquerda), apoiado na quina de baixo."""
    o = c.novo_obj(3)
    up = np.array([-math.sin(ang), math.cos(ang)])
    ac = np.array([math.cos(ang), math.sin(ang)])
    p0 = np.array([xl, z])
    p1 = p0 + ac * w
    p2 = p1 + up * alto
    p3 = p0 + up * alto
    mat = _lombada(cor, xl, z, alto, w, seed, ang=ang, ymax=y1, hmin=y0)
    c.face_plana([(p0[0], y1, p0[1]), (p1[0], y1, p1[1]), (p2[0], y1, p2[1]), (p3[0], y1, p3[1])], (0, 1, 0), mat, M, o)
    c.face_plana([(p3[0], y0, p3[1]), (p2[0], y0, p2[1]), (p2[0], y1, p2[1]), (p3[0], y1, p3[1])], (up[0], 0, up[1]), mat, M, o)
    c.face_plana([(p1[0], y0, p1[1]), (p2[0], y0, p2[1]), (p2[0], y1, p2[1]), (p1[0], y1, p1[1])], (ac[0], 0, ac[1]), mat, M, o)
    return p1[0]


def _livro_deitado(x0, x1, y0, y1, z0, z1, cor, frente='y'):
    """
    O livro deitado na pilha (3 px de grosso): na lombada, a cor com a fileira do meio clara; na ponta, o papel creme
    entre a capa de baixo e a de cima (1 px cada); em cima, a capa.
    """
    c0 = hx(cor)

    def f(L, n, P):
        out = np.tile(c0, (len(P), 1))
        nn = np.asarray(n, float)
        zz = P[:, 2] - z0
        meio = (zz >= PZ) & (zz < 2 * PZ)
        papel = (frente == 'y' and nn[0] > 0.5) or (frente == 'x' and nn[1] > 0.5)
        if papel:
            out = np.where(meio[:, None], hx(PAPEL), _tom(c0, 0.9))
        elif abs(nn[2]) < 0.5:
            out = np.where(meio[:, None], _tom(c0, 1.22), out)
        return _vao(out, P)
    caixa((x0, x1, y0, y1, z0, z1), emissivo(f), sombra=False)


def _tigelas(cx, cy, z, n=3, r=0.095, cor='#5e7686'):
    """A pilha de tigelas de barro esmaltado (azul-cinza): um bloco que abre para cima, a borda clara de cada uma."""
    o = c.novo_obj(3)
    hb = 2 * PZ
    zt = z + n * hb

    def bordas(P, base):
        zz = P[:, 2] - z
        topo = np.zeros(len(P), bool)
        for k in range(n):
            topo |= (zz >= (k + 1) * hb - PZ) & (zz < (k + 1) * hb)
        return np.where(topo[:, None], _tom(base, 1.32), _tom(base, 0.92))
    _poligono_rodado(cx, cy, [(z, r * 0.62), (z + hb, r * 0.8), (zt, r)], vol(cx, cy, cor, brilho=0.25, faixas=bordas), o, lados=20)

    def dentro(L, n_, P):
        rr = np.hypot(P[:, 0] - cx, P[:, 1] - cy)
        out = np.where((rr > r - 0.018)[:, None], _tom(hx(cor), 1.3), _tom(hx(cor), 0.66))
        return _vao(np.where(((rr < r * 0.6) & (P[:, 1] - cy > 0))[:, None], _tom(hx(cor), 0.84), out), P)
    _disco(cx, cy, zt, r, emissivo(dentro), o, lados=20)


def _caixinha(x0, x1, y0, y1, z0, z1, cor='#7a4a2c', frente='y'):
    """A caixinha de madeira com a tampa (a linha clara) e o fecho de latão."""
    c0 = hx(cor)

    def f(L, n, P):
        out = np.tile(c0, (len(P), 1))
        nn = np.asarray(n, float)
        if abs(nn[2]) < 0.5:
            zz = P[:, 2] - z1
            out = np.where(((zz > -0.04 - PZ) & (zz <= -0.04))[:, None], _tom(c0, 0.62), out)
            out = np.where(((zz > -0.04) & (zz <= -0.04 + PZ))[:, None], _tom(c0, 1.2), out)
            if (frente == 'y' and nn[1] > 0.5) or (frente == 'x' and nn[0] > 0.5):
                a = P[:, 0] if frente == 'y' else -P[:, 1]
                m = (x0 + x1) / 2 if frente == 'y' else -(y0 + y1) / 2
                fe = (np.abs(a - m) < 0.022) & (zz > -0.06) & (zz <= -0.025)
                out = np.where(fe[:, None], hx('#d8ac4a'), out)
        else:
            out = _tom(out, 1.12)
        return _vao(out, P)
    caixa((x0, x1, y0, y1, z0, z1), emissivo(f), sombra=False)


def _fileira(x, x1, yb0, yb1, z, alto, seed, n, tomba=False):
    """Uma fileira de livros em pé (larguras e alturas variadas); tomba: o último encosta no vizinho."""
    for k in range(n):
        ww = round((0.05 + 0.035 * ruido(k, seed + 3)) / PH) * PH
        if x + ww > x1:
            break
        cor = LIVRO_CORES[int(ruido(seed, k, 5.1) * len(LIVRO_CORES))]
        hh = alto * (0.72 + 0.26 * ruido(k, seed + 2))
        yy1 = yb1 - 0.03 * ruido(k, seed + 8)
        o = c.novo_obj(3)
        c.caixa((x, x + ww, yb0, yy1, z, z + hh), _lombada(cor, x, z, hh, ww, int(seed * 31 + k * 7), ymax=yy1, hmin=yb0), M, o)
        x += ww
    if tomba and x < x1 - 0.12:
        cor = LIVRO_CORES[int(ruido(seed, 12.7) * len(LIVRO_CORES))]
        hh = alto * 0.84
        ang = math.radians(18 + 8 * ruido(seed, 13.3))
        xl = x + hh * math.sin(ang) + 0.004
        x = _livro_inclinado(xl, z, 2 * PH, hh, yb0, yb1 - 0.01, ang, cor, int(seed * 13))
    return x


def _pilha(x, comp, yb0, yb1, z, seed, n=3):
    """A pilha de livros deitados, cada um um pouco torto em relação ao de baixo."""
    zz = z
    for k in range(n):
        cor = LIVRO_CORES[int(ruido(seed, k, 7.7) * len(LIVRO_CORES))]
        enc = 0.025 * ruido(seed, k, 9.1)
        cc = comp - 0.03 * k
        _livro_deitado(x + enc, x + enc + cc, yb0 + 0.015 * k, yb1 - 0.01 * k, zz, zz + 3 * PZ, cor)
        zz += 3 * PZ
    return x + comp + 0.03


# os arranjos de cada prateleira (fileiras de livros, pilhas, tigelas, potes e a caixinha), um por prateleira
_ARRANJOS = (
    (('fileira', 5, False), ('tigelas',), ('fileira', 4, False)),
    (('pilha', 3), ('fileira', 6, True), ('pote',)),
    (('fileira', 3, False), ('caixinha',), ('fileira', 4, False), ('pilha', 2)),
    (('pote',), ('fileira', 5, False), ('pilha', 3)),
)


def livros(x0, x1, y, z, fundo, seed, alto=0.3):
    """
    O que fica numa prateleira (de frente para +y), num arranjo que muda com a semente: fileiras de livros em pé
    (alturas diferentes, às vezes um tombado no vizinho), pilhas deitadas, tigelas, o pote de barro e a caixinha.
    """
    x = x0 + 0.03
    yb0, yb1 = y + 0.06, y + fundo - 2 * PH - 0.005
    for j, item in enumerate(_ARRANJOS[seed % len(_ARRANJOS)]):
        sd = seed * 10 + j
        if item[0] == 'fileira':
            x = _fileira(x, x1 - 0.03, yb0, yb1, z, alto, sd, item[1], item[2]) + 0.03
        elif item[0] == 'pilha':
            x = _pilha(x, 0.22, yb0 + 0.02, yb1, z, sd, item[1])
        elif item[0] == 'tigelas':
            _tigelas(x + 0.1, yb1 - 0.1, z)
            x += 0.3
        elif item[0] == 'pote':
            pote_barro(x + 0.085, yb1 - 0.09, z, r=0.075, h=0.17)
            x += 0.26
        else:
            _caixinha(x, x + 0.2, yb0 + 0.03, yb1, z, z + 0.13)
            x += 0.23
        if x > x1 - 0.08:
            break


def estante_parede_tras(x0, x1, fundo=0.42, h=1.75, prat=(0.05, 0.45, 0.85, 1.25), seed=1):
    """
    A estante de livros alta encostada na parede de trás (y = 0): o fundo escuro de tábuas, os lados com a quina
    clara, as prateleiras grossas com a frente clara, o rodapé, o tampo saliente e as coisas em cima.
    """
    LADO = mad2('#7a4028', eixo=1, seed=41, passo=0.07)
    TOPO = tab2(['#c27e46', '#ba7842'], 0.21, '#5a2c16', eixo=0, seed=42, org=0.0)
    FRENTE = mad2('#9e5a34', eixo=1, seed=43, passo=0.03)
    DENTRO = mad2('#3e2216', eixo=1, seed=44, passo=0.07, claro=1.06, escuro=0.94)

    def fundo_m(L, n, P):
        g = (P[:, 0] - x0) % 0.16
        out = np.tile(hx('#30190f'), (len(P), 1))
        out = np.where((g < PH)[:, None], hx('#26140c'), out)
        # a sombra embaixo de cada prateleira (no fundo)
        for z in prat[1:] + (h - 0.05,):
            out = np.where(((P[:, 2] < z) & (P[:, 2] > z - 0.06))[:, None], out * 0.78, out)
        return out
    caixa((x0, x1, 0, 0.03, 0, h), emissivo(fundo_m))
    caixa((x0, x0 + 0.06, 0, fundo, 0, h), {'cima': TOPO, 'frente': FRENTE, 'dir': DENTRO, '*': LADO})
    caixa((x1 - 0.06, x1, 0, fundo, 0, h), {'cima': TOPO, 'frente': FRENTE, '*': LADO})
    caixa((x0 + 0.06, x1 - 0.06, fundo - 0.03, fundo, 0, prat[0]), mad2('#7a4226', seed=45, passo=0.03))

    def prateleira(zp):
        def topo(L, n, P):
            out = np.tile(hx('#b8743e'), (len(P), 1))
            yy = P[:, 1]
            out = np.where((yy < fundo - 0.12)[:, None], _tom(out, 0.78), out)
            out = np.where((yy < fundo - 0.24)[:, None], _tom(hx('#b8743e'), 0.62), out)
            return np.where((yy > fundo - PH)[:, None], _tom(hx('#b8743e'), 1.12), out)
        caixa((x0 + 0.06, x1 - 0.06, 0.03, fundo, zp, zp + 0.045), {'cima': emissivo(topo), '*': mad2('#a86438', eixo=0, seed=46, passo=0.03)})
    for i, z in enumerate(prat):
        prateleira(z)
        _VAO['teto'] = prat[i + 1] if i + 1 < len(prat) else h - 0.08
        livros(x0 + 0.06, x1 - 0.06, 0.0, z + 0.045, fundo, seed + i, alto=0.32)
    _VAO['teto'] = None
    caixa((x0 - 0.025, x1 + 0.025, 0, fundo + 0.025, h - 0.05, h), {'cima': TOPO, '*': mad2('#a86438', eixo=0, seed=47, passo=0.03)})
    caixa((x0 - 0.01, x1 + 0.01, 0.0, fundo + 0.01, h - 0.08, h - 0.05), mad2('#6e3a20', seed=48, passo=0.03))
    # em cima: dois potes e a garrafa
    pote_barro(x0 + 0.16, fundo / 2, h, r=0.08, h=0.17)
    pote_barro(x0 + 0.36, fundo / 2 + 0.04, h, r=0.055, h=0.12)
    _garrafa(x0 + 0.54, fundo / 2, h)


def _garrafa(cx, cy, z):
    """A garrafa de vidro verde-escuro: o corpo, o ombro, o gargalo e a rolha; a risca de brilho do vidro."""
    o = c.novo_obj(3)
    m = vol(cx, cy, '#3e5e44', brilho=0.45)
    _poligono_rodado(cx, cy, [(z, 0.04), (z + 0.14, 0.04), (z + 0.17, 0.028), (z + 0.19, 0.016), (z + 0.24, 0.016)], m, o, lados=16)
    c.cilindro(cx, cy, 0.014, z + 0.24, z + 0.27, vol(cx, cy, '#b8865a'), M, o, lados=12, tampa_mat=liso('#c89a6a'))


def estante_baixa(y0, y1, fundo=0.48, h=1.0):
    """
    A estante baixa encostada na parede da esquerda (x = 0), aberta para +x: duas prateleiras com a cesta, os
    livros deitados e em pé, as tigelas e a caixinha; em cima, o pote de barro e o pinheirinho.
    """
    LADO = mad2('#7a4028', eixo=0, seed=51, passo=0.07)
    TOPO = tab2(['#c27e46', '#ba7842'], 0.16, '#5a2c16', eixo=1, seed=52, org=0.0)
    FRENTE = mad2('#9e5a34', eixo=1, seed=53, passo=0.03)
    DENTRO = mad2('#3e2216', eixo=0, seed=54, passo=0.07, claro=1.06, escuro=0.94)

    def fundo_m(L, n, P):
        g = (P[:, 1] - y0) % 0.16
        out = np.tile(hx('#30190f'), (len(P), 1))
        out = np.where((g < PH)[:, None], hx('#26140c'), out)
        for z in (0.44, h - 0.05):
            out = np.where(((P[:, 2] < z) & (P[:, 2] > z - 0.06))[:, None], out * 0.78, out)
        return out
    caixa((0, 0.03, y0, y1, 0, h), emissivo(fundo_m))
    caixa((0, fundo, y0, y0 + 0.06, 0, h), {'cima': TOPO, 'dir': FRENTE, 'frente': DENTRO, '*': LADO})
    caixa((0, fundo, y1 - 0.06, y1, 0, h), {'cima': TOPO, 'dir': FRENTE, '*': LADO})
    caixa((fundo - 0.03, fundo, y0 + 0.06, y1 - 0.06, 0, 0.04), mad2('#7a4226', eixo=1, seed=55, passo=0.03))

    def prateleira(zp):
        def topo(L, n, P):
            out = np.tile(hx('#b8743e'), (len(P), 1))
            xx = P[:, 0]
            out = np.where((xx < fundo - 0.12)[:, None], _tom(out, 0.78), out)
            out = np.where((xx < fundo - 0.26)[:, None], _tom(hx('#b8743e'), 0.62), out)
            return np.where((xx > fundo - PH)[:, None], _tom(hx('#b8743e'), 1.12), out)
        caixa((0.03, fundo, y0 + 0.06, y1 - 0.06, zp, zp + 0.045), {'cima': emissivo(topo), '*': mad2('#a86438', eixo=0, seed=56, passo=0.03)})
    prateleira(0.04)
    prateleira(0.44)
    caixa((0, fundo + 0.025, y0 - 0.025, y1 + 0.025, h - 0.05, h), {'cima': TOPO, '*': mad2('#a86438', eixo=0, seed=57, passo=0.03)})
    # embaixo: a pilha de livros deitados (atrás), a cesta de vime e o pote de barro (na frente)
    zp = 0.085
    _VAO['teto'] = 0.44
    for k, (cor, enc) in enumerate((('#5a3a26', 0.0), ('#84362a', 0.025), ('#3e5266', 0.005))):
        _livro_deitado(0.07 + enc, fundo - 0.06 - enc * 0.5, y0 + 0.1 + enc, y0 + 0.42 - enc, zp + k * 3 * PZ, zp + (k + 1) * 3 * PZ, cor, frente='x')
    _cesto(fundo / 2 + 0.01, y0 + 0.74, zp)
    pote_barro(fundo / 2 + 0.03, y1 - 0.26, zp, r=0.085, h=0.19)
    # em cima: três livros em pé (lombada para +x), a caixinha e as tigelas
    zp = 0.485
    _VAO['teto'] = h - 0.05
    yy = y0 + 0.1
    for k in range(4):
        ww = round((0.055 + 0.03 * ruido(k, 4.1)) / PH) * PH
        hh = 0.26 + 0.1 * ruido(k, 4.2)
        cor = LIVRO_CORES[int(ruido(k, 4.3) * len(LIVRO_CORES))] if k < 3 else '#4e2e1e'
        o = c.novo_obj(3)
        c.caixa((0.06, fundo - 0.07, yy, yy + ww, zp, zp + hh), _lombada(cor, 0, zp, hh, ww, 70 + k, frente='x', ymax=fundo - 0.07, hmin=0.06), M, o)
        yy += ww
    _tigelas(fundo / 2 + 0.06, y0 + 0.74, zp, n=3)
    _caixinha(0.1, fundo - 0.06, y1 - 0.62, y1 - 0.34, zp, zp + 0.14, frente='x')
    _VAO['teto'] = None
    # em cima: o pote de barro e o pinheirinho
    pote_barro(fundo / 2, y0 + 0.3, h, r=0.11, h=0.2)
    pinheirinho(fundo / 2, y1 - 0.3, h)
    pegadas.append((0, fundo, y0, y1))


def _cesto(cx, cy, z, r=0.13, hh=0.2):
    """A cesta de vime: as fiadas trançadas (desencontradas, 2 px) e a borda grossa enrolada."""
    def trama(P, base):
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        fila = np.floor((P[:, 2] - z) / (2 * PZ))
        col = np.floor((th * r) / 0.05 + fila * 0.5)
        alt = (col + fila) % 2 == 0
        base = np.where(alt[:, None], _tom(base, 1.1), _tom(base, 0.92))
        return np.where((((P[:, 2] - z) % (2 * PZ)) < PZ * 0.999)[:, None] & ~alt[:, None], _tom(base, 0.9), base)
    o = c.novo_obj(3)
    _poligono_rodado(cx, cy, [(z, r * 0.85), (z + hh, r)], vol(cx, cy, '#c49a5c', faixas=trama), o, lados=20)
    c.cilindro(cx, cy, r + 0.008, z + hh - 0.035, z + hh, vol(cx, cy, '#a87a42'), M, o, lados=20, tampa=False)

    def miolo(L, n, P):
        rr = np.hypot(P[:, 0] - cx, P[:, 1] - cy)
        return np.where((rr > r - 0.02)[:, None], hx('#c8a062'), hx('#4a3020'))
    _disco(cx, cy, z + hh, r + 0.008, emissivo(miolo), o, lados=20)


# ---------------------------------------------------------------- o barril, os potes e as plantas ----------------------------------------------------------------
def barril_cesto(x, y, r=0.3, h=0.45):
    """
    O barril baixo: as aduelas (uma linha escura de 1 px entre elas, a luz em degraus pela volta), a barriga, as
    cintas de ferro com a quina de cima clara e o brilho, e a tampa de tábuas dentro do anel das aduelas.
    """
    perfil = [(0.0, r * 0.9), (h * 0.22, r * 0.975), (h * 0.5, r), (h * 0.78, r * 0.975), (h, r * 0.9)]
    cintas = ((0.055, 0.115), (h - 0.125, h - 0.065))

    def rr_em(z):
        zs, rs = zip(*perfil)
        return np.interp(z, zs, rs)

    def aduela(P, base):
        th = np.arctan2(P[:, 1] - y, P[:, 0] - x)
        k = np.floor(((th / (2 * math.pi)) * 16 + 16) % 16)
        base = np.where((k % 2 == 0)[:, None], _tom(base, 1.04), base)
        # a sombra de 1 px embaixo de cada cinta
        zz = P[:, 2]
        for (a, b) in cintas:
            base = np.where(((zz < a) & (zz >= a - PZ))[:, None], _tom(base, 0.7), base)
        return base
    o = c.novo_obj(3)
    _poligono_rodado(x, y, perfil, vol(x, y, '#92562e', faixas=aduela, costuras=(16, '#4a2614', r)), o, lados=28)

    def tampa(L, n, P):
        dx, dy = P[:, 0] - x, P[:, 1] - y
        rr = np.hypot(dx, dy)
        ri = r * 0.9 - 0.045
        larg = 4 * PH
        fila = np.floor((dy + 0.4) / larg)
        g = (dy + 0.4) - fila * larg
        cores = np.stack([hx('#d29c5e'), hx('#c48e52'), hx('#d8a868')])
        out = cores[(fila % 3).astype(int)]
        out = np.where((g >= larg - PH)[:, None], _tom(out, 0.9), out)
        out = np.where((g < PH)[:, None], hx('#6a3c1e'), out)
        # o anel das aduelas (a ponta da madeira, mais escura) e a sombra dentro dele
        anel = rr > ri
        out = np.where(anel[:, None], hx('#a0643a'), out)
        out = np.where(((rr > ri - 0.022) & (rr <= ri) & (dy < 0.02))[:, None], _tom(out, 0.8), out)
        return out
    _disco(x, y, h, r * 0.9, emissivo(tampa), o, lados=28)
    for (a, b) in cintas:
        o2 = c.novo_obj(3)

        def ferro(P, base, a=a, b=b):
            zz = P[:, 2]
            base = np.where((zz > b - PZ)[:, None], hx('#8a8e98'), base)
            # os rebites
            th = np.arctan2(P[:, 1] - y, P[:, 0] - x)
            reb = ((((th / (2 * math.pi)) * 8 + 8.25) % 1) < 0.04) & (zz > a + PZ) & (zz <= a + 2 * PZ)
            return np.where(reb[:, None], hx('#a8acb4'), base)
        ra, rb = rr_em(a) + 0.012, rr_em(b) + 0.012
        c.cilindro(x, y, ra, a, b, vol(x, y, '#44464f', brilho=0.5, faixas=ferro), M, o2, lados=28, tampa=False, r1=rb)
    pegadas.append((x - r, x + r, y - r, y + r))


def pote_barro(x, y, z, r=0.09, h=0.16):
    """O pote de barro em jarro: a barriga redonda, a faixa escura com a linha clara, o ombro, o gargalo e a boca."""
    perfil = [(z, r * 0.62), (z + h * 0.12, r * 0.86), (z + h * 0.38, r), (z + h * 0.62, r * 0.93), (z + h * 0.78, r * 0.68),
              (z + h * 0.86, r * 0.5), (z + h * 0.93, r * 0.5), (z + h * 0.93, r * 0.6), (z + h, r * 0.6)]

    def faixa(P, base):
        zz = P[:, 2] - z
        zb = h * 0.5
        base = np.where(((zz > zb) & (zz <= zb + PZ))[:, None], _tom(base, 0.7), base)
        return np.where(((zz > zb + PZ) & (zz <= zb + 2 * PZ))[:, None], _tom(base, 1.18), base)
    o = c.novo_obj(3)
    _poligono_rodado(x, y, perfil, vol(x, y, '#a8603a', brilho=0.12, faixas=faixa), o, lados=20)

    def boca(L, n, P):
        rr = np.hypot(P[:, 0] - x, P[:, 1] - y)
        return _vao(np.where((rr > r * 0.6 - 0.016)[:, None], hx('#c47a4a'), hx('#3a2014')), P)
    _disco(x, y, z + h, r * 0.6, emissivo(boca), o, lados=20)


PINHO = ['#142c28', '#1c3e36', '#255446', '#2f6a52', '#3f8160', '#5c9c72', '#86ba8a']


def _copa(cx, cy, r, z0, z1, oid, dentes, prof, giro, zprox):
    """
    Uma camada do pinheiro: a pirâmide de base em estrela (as pontas dos galhos em dentes no contorno). A luz vem
    pela volta (lisa, em degraus); as pontas de baixo pegam luz e o alto, embaixo da camada de cima, fica escuro.
    """
    pts = []
    nv = dentes * 2
    for i in range(nv):
        a = giro + 2 * math.pi * i / nv
        rr = r if i % 2 == 0 else r * (1 - prof)
        pts.append(np.array([cx + rr * math.cos(a), cy + rr * math.sin(a), z0]))
    ap = np.array([cx, cy, z1])
    nzc = r / math.hypot(r, z1 - z0)
    chc = math.sqrt(1 - nzc ** 2)
    rampa = np.stack([hx(x_) for x_ in PINHO])

    def f(L, n, P):
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        d = chc * (np.cos(th) * _LUZ[0] + np.sin(th) * _LUZ[1]) + nzc * _LUZ[2]
        idx = np.clip(np.round((d - 0.25) / 0.16), 0, 3).astype(int) + 1
        zz = P[:, 2]
        idx = np.where((zz < z0 + PZ) & (d > 0.1), idx + 1, idx)
        idx = np.where(zz > zprox - PZ, idx - 1, idx)
        return _cru(rampa[np.clip(idx, 0, len(PINHO) - 1)], n)
    mat = emissivo(f)
    for i in range(nv):
        p, q = pts[i], pts[(i + 1) % nv]
        nrm = np.cross(p - ap, q - ap)
        if nrm[2] < 0:
            nrm = -nrm
        c.face_plana([tuple(ap), tuple(p), tuple(q)], tuple(nrm / np.linalg.norm(nrm)), mat, M, oid)


def pinheirinho(x, y, z):
    """O pinheirinho no vaso de barro: cinco camadas de galhos em dentes, verde-azulado, a luz do lado esquerdo."""
    perfil = [(z, 0.07), (z + 0.1, 0.094), (z + 0.135, 0.1)]
    o = c.novo_obj(3)

    def aro(P, base):
        zz = P[:, 2] - z
        base = np.where((zz > 0.1 + PZ * 0.5)[:, None], _tom(base, 1.1), base)
        return np.where(((zz > 0.1 - PZ) & (zz <= 0.1))[:, None], _tom(base, 0.7), base)
    _poligono_rodado(x, y, perfil, vol(x, y, '#b0623a', faixas=aro), o, lados=20)

    def terra(L, n, P):
        rr = np.hypot(P[:, 0] - x, P[:, 1] - y)
        return np.where((rr > 0.084)[:, None], hx('#9a5432'), hx('#3e2a1c'))
    _disco(x, y, z + 0.135, 0.1, emissivo(terra), o, lados=20)
    o = c.novo_obj(3)
    c.cilindro(x, y, 0.018, z + 0.13, z + 0.2, vol(x, y, '#6a4428'), M, o, lados=8, tampa=False)
    o = c.novo_obj(3)
    camadas = ((0.18, 0.18, 0.34), (0.15, 0.26, 0.41), (0.12, 0.33, 0.48), (0.088, 0.4, 0.55), (0.055, 0.47, 0.62))
    for k, (r, a, b) in enumerate(camadas):
        zprox = z + camadas[k + 1][1] if k + 1 < len(camadas) else 1e9
        _copa(x, y, r, z + a, z + b, o, dentes=11 - k, prof=0.3, giro=0.35 * k, zprox=zprox)


def vaso(x, y, z):
    """O vasinho de barro da mesa com a suculenta: as folhas grossas em leque, cada uma com o lado aceso."""
    o = c.novo_obj(3)
    perfil = [(z, 0.045), (z + 0.065, 0.058), (z + 0.065, 0.064), (z + 0.09, 0.064)]

    def aro(P, base):
        return np.where((P[:, 2] > z + 0.065 + PZ * 0.5)[:, None], _tom(base, 1.08), base)
    _poligono_rodado(x, y, perfil, vol(x, y, '#b0623a', faixas=aro), o, lados=18)

    def terra(L, n, P):
        rr = np.hypot(P[:, 0] - x, P[:, 1] - y)
        return np.where((rr > 0.05)[:, None], hx('#c47448'), hx('#3e2a1c'))
    _disco(x, y, z + 0.09, 0.064, emissivo(terra), o, lados=18)
    o = c.novo_obj(3)
    # as folhas gordas de ponta romba, em leque (as de fora mais escuras); o lado esquerdo de cada uma aceso
    folhas = ((-58, 0.1, 0.07, '#2c623a'), (58, 0.1, 0.07, '#285a36'), (-28, 0.13, 0.075, '#367842'),
              (28, 0.13, 0.075, '#2f6a3e'), (0, 0.155, 0.08, '#4a9450'))
    k = 1 / math.sqrt(2)
    zb = z + 0.075
    for (ang, l, w, cor) in folhas:
        a_ = math.radians(ang)
        ts, tz = math.sin(a_), math.cos(a_)
        ns, nz_ = -tz, ts
        forma = ((0.0, 0.18), (0.25, 0.5), (0.6, 0.5), (0.92, 0.3), (1.0, 0.0), (0.92, -0.3), (0.6, -0.5), (0.25, -0.5), (0.0, -0.18))
        pts = [(u * l * ts + v * w * ns, zb + u * l * tz + v * w * nz_) for (u, v) in forma]
        c0 = hx(cor)

        def f(L, n, P, c0=c0, ns=ns, nz_=nz_):
            s_ = (P[:, 0] - x) * k - (P[:, 1] - y) * k
            lado = s_ * ns + (P[:, 2] - zb) * nz_
            out = np.where((lado > 0.004)[:, None], _tom(c0, 1.22), c0)
            return _cru(out, n)
        c.face_plana([(x + s_ * k, y - s_ * k, zz) for (s_, zz) in pts], (k, k, 0), emissivo(f), M, o)


def vasinho_galhos(x, y):
    """O vaso alto de barro no canto, com as faixas claras, os galhos secos e as plumas de capim."""
    o = c.novo_obj(3)
    perfil = [(0.0, 0.08), (0.05, 0.1), (0.14, 0.105), (0.22, 0.085), (0.26, 0.06), (0.29, 0.058), (0.3, 0.07)]

    def faixas(P, base):
        zz = P[:, 2]
        for z0 in (0.07, 0.17):
            base = np.where(((zz > z0) & (zz <= z0 + 2 * PZ))[:, None], hx('#d8c49a'), base)
        return base
    _poligono_rodado(x, y, perfil, vol(x, y, '#8e4a2c', brilho=0.15, faixas=faixas), o, lados=20)

    def boca(L, n, P):
        rr = np.hypot(P[:, 0] - x, P[:, 1] - y)
        return np.where((rr > 0.055)[:, None], hx('#a65a36'), hx('#2e1a10'))
    _disco(x, y, 0.3, 0.07, emissivo(boca), o, lados=20)
    # os galhos: fitas de frente para a câmera (o lado esquerdo de cada um, 1 px, mais claro)
    galhos = (
        [(-0.01, 0.28), (-0.05, 0.45), (-0.1, 0.62)],
        [(0.0, 0.28), (0.03, 0.48), (0.05, 0.68)],
        [(0.015, 0.28), (0.07, 0.42), (0.13, 0.56)],
        [(-0.005, 0.28), (-0.02, 0.5), (-0.07, 0.66), (-0.08, 0.72)],
        [(0.04, 0.5), (0.1, 0.62), (0.12, 0.66)],
    )
    og = c.novo_obj(3, contorno=False)
    k = 1 / math.sqrt(2)
    for g in galhos:
        _fita(g, x, y, liso('#3e2416'), og, 0.03)
    # as plumas de capim (creme, o lado esquerdo aceso, o direito na sombra)
    for (s0, z0, s1, z1, w) in ((-0.1, 0.6, -0.16, 0.84, 0.1), (0.05, 0.68, 0.08, 0.93, 0.105)):
        of = c.novo_obj(3)
        ds, dz = s1 - s0, z1 - z0
        l = math.hypot(ds, dz)
        ts, tz = ds / l, dz / l
        ns, nz_ = -tz, ts
        pts = []
        for i in range(10):
            a_ = 2 * math.pi * i / 10
            u, v = math.cos(a_) * l / 2, math.sin(a_) * w / 2 * (0.75 + 0.3 * math.cos(a_))
            pts.append((s0 + ds / 2 + u * ts + v * ns, z0 + dz / 2 + u * tz + v * nz_))

        def pluma(L, n, P, s0=s0, z0=z0, ns=ns, nz_=nz_, ds=ds, dz=dz):
            sp = (P[:, 0] - x) * k - (P[:, 1] - y) * k
            lado = (sp - s0 - ds / 2) * ns + (P[:, 2] - z0 - dz / 2) * nz_
            out = np.where((lado > 0.012)[:, None], hx('#f2e6c8'), hx('#dccaa0'))
            out = np.where((lado < -0.016)[:, None], hx('#b49a72'), out)
            return _cru(out, n)
        c.face_plana([(x + a * k, y - a * k, b) for (a, b) in pts], (k, k, 0), emissivo(pluma), M, of)
    pegadas.append((x - 0.1, x + 0.1, y - 0.1, y + 0.1))
