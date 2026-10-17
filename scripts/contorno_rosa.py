"""O contorno rosa (17/10, o Felipe: "cuida pra isso nunca acontecer em lugar nenhum").

Às vezes o gerador desenha a LINHA DE CONTORNO do boneco em magenta escuro (no Tepes armado: ~90, 4, 81), em vez do
marrom-escuro dos outros. Este script acha, na faixa da borda do desenho (até 3 pixels de um pixel transparente), os
pixels com tom magenta (vermelho e azul bem acima do verde) e, com --corrigir, troca a cor deles pela do contorno de
uma pose de referência do mesmo personagem (mesma claridade, o tom da referência). Não apaga nada, não mexe no miolo
do desenho, e o vermelho de verdade (sangue, ferrugem) não entra: ele tem pouco azul.

    python scripts/contorno_rosa.py <imagens ou pastas ...>                       só conta (sai com erro se achar)
    python scripts/contorno_rosa.py --corrigir --ref <pose.png> <imagens ...>     corrige e grava por cima

Cuidado (o cabelo rosa da NPC nova, a camisa rosa, as ameaças de Energia): rosa de verdade também tem tom magenta.
Rode só nas imagens que você olhou e viu o contorno errado, e confira antes e depois.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

FAIXA = 3


def tom_magenta(a: np.ndarray) -> np.ndarray:
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    # só o escuro (a linha do contorno): o tom claro rosado de um cabelo branco não entra
    escuro = np.maximum(np.maximum(r, g), b) < 150
    return (a[..., 3] > 0) & (r - g > 25) & (b - g > 15) & escuro


def faixa_da_borda(alfa: np.ndarray, n: int = FAIXA) -> np.ndarray:
    vazio = alfa < 16
    perto = vazio.copy()
    for _ in range(n):
        v = perto.copy()
        v[1:, :] |= perto[:-1, :]
        v[:-1, :] |= perto[1:, :]
        v[:, 1:] |= perto[:, :-1]
        v[:, :-1] |= perto[:, 1:]
        perto = v
    return perto & ~vazio


def alvo(a: np.ndarray) -> np.ndarray:
    return faixa_da_borda(a[..., 3]) & tom_magenta(a)


def cor_do_contorno(ref: Path) -> np.ndarray:
    """A cor média do contorno da referência (a faixa da borda, só os pixels escuros), em RGB."""
    a = np.array(Image.open(ref).convert('RGBA')).astype(float)
    f = faixa_da_borda(a[..., 3])
    escuro = f & (a[..., :3].sum(axis=2) < 200)
    return a[escuro, :3].mean(axis=0)


def corrigir(p: Path, cor: np.ndarray) -> int:
    a = np.array(Image.open(p).convert('RGBA')).astype(float)
    m = alvo(a)
    n = int(m.sum())
    if n:
        # a mesma claridade relativa do pixel, no tom do contorno da referência
        luz = a[m, :3].max(axis=1, keepdims=True) / 255.0
        a[m, :3] = np.clip(cor * (0.6 + 0.8 * luz), 0, 255)
        Image.fromarray(a.astype('uint8')).save(p)
    return n


def arquivos(args):
    for x in args:
        p = Path(x).resolve()
        yield from (sorted(p.rglob('*.png')) if p.is_dir() else [p])


def main():
    args = sys.argv[1:]
    corr = '--corrigir' in args
    ref = None
    if '--ref' in args:
        i = args.index('--ref')
        ref = Path(args[i + 1])
        del args[i:i + 2]
    lista = [x for x in args if not x.startswith('--')]
    if not lista:
        print(__doc__)
        sys.exit(2)
    if corr and not ref:
        sys.exit('--corrigir precisa de --ref <pose do mesmo personagem com o contorno certo>')
    cor = cor_do_contorno(ref) if ref else None
    achou = 0
    for p in arquivos(lista):
        a = np.array(Image.open(p).convert('RGBA'))
        n = corrigir(p, cor) if corr else int(alvo(a).sum())
        if n:
            achou += 1
            print(f'{"corrigido" if corr else "rosa"}: {p.name} ({n} px)')
    print(f'{achou} imagem(ns) com contorno rosa' + (' (corrigidas)' if corr else ''))
    if achou and not corr:
        sys.exit(1)


if __name__ == '__main__':
    main()
