"""Uma cena de momento em MP4 (18/10, o Felipe: "me manda um mp4 da primeira parte do pesadelo"), com os sons dos quadros.

    python scripts/cenas/video.py <cena.json> <saida.mp4> [--segura 4]

Desenha como a tela da cena (client/src/ui/cenaTela.ts): a câmera de um enquadramento ao outro, as camadas entrando, as
transições (dissolve, corte, preto, clarão), o tremor e as faixas do cinema. O quadro que espera o mestre fica `--segura`
segundos. As imagens vêm de client/public (o caminho /arte/... da cena).
"""
import json
import math
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image

PUB = Path(__file__).resolve().parents[2] / 'client' / 'public'
VW, VH, FPS, SR = 1280, 720, 30, 44100
args = sys.argv[1:]
segura = 4.0
if '--segura' in args:
    i = args.index('--segura')
    segura = float(args[i + 1])
    del args[i : i + 2]
cena = json.loads(Path(args[0]).read_text(encoding='utf-8'))
saida = Path(args[1])

_cache: dict[str, Image.Image] = {}


def img(u: str) -> Image.Image:
    if u not in _cache:
        _cache[u] = Image.open(PUB / u.lstrip('/')).convert('RGBA')
    return _cache[u]


MOV = {
    'afasta': ((50, 50, 1.16), (50, 50, 1)),
    'esquerda': ((62, 50, 1.16), (38, 50, 1.16)),
    'direita': ((38, 50, 1.16), (62, 50, 1.16)),
    'cima': ((50, 62, 1.16), (50, 38, 1.16)),
    'baixo': ((50, 38, 1.16), (50, 62, 1.16)),
    'tremor': ((50, 50, 1.07), (50, 50, 1.07)),
    'parado': ((50, 50, 1), (50, 50, 1)),
}


def focos(q):
    if q.get('camera'):
        d, p = q['camera']['de'], q['camera']['para']
        return (d['x'], d['y'], d['zoom']), (p['x'], p['y'], p['zoom'])
    return MOV.get(q.get('movimento'), ((50, 50, 1), (50, 50, 1.16)))


def suave(k):  # cubic-bezier(0.45, 0, 0.55, 1), quase igual
    return k * k * (3 - 2 * k)


def camera(f, iw, ih):
    """A mesma conta de transformDoFoco: a escala e o deslocamento da imagem na janela."""
    x, y, z = f
    s0 = max(VW / iw, VH / ih)
    s = s0 * max(min(VW / iw, VH / ih) / s0, min(4, z))

    def eixo(c, tam, jan):
        if tam * s <= jan:
            return (jan - tam * s) / 2
        return max(jan - tam * s, min(0, jan / 2 - c * s))

    return s, eixo(x / 100 * iw, iw, VW), eixo(y / 100 * ih, ih, VH)


ENT_DUR = {'fade': 1.1, 'corte': 0.001, 'aproxima': 6.0}


def camada_estado(k, t):
    """opacidade, escala extra, deslocamento (fração) e brilho da camada no tempo t do quadro."""
    ent = k.get('entrada', 'fade')
    dur = k.get('duracao', ENT_DUR.get(ent, 0.9))
    u = (t - k.get('atraso', 0)) / dur
    if u <= 0:
        return 0, 1, (0, 0), 1
    u = min(1, u)
    e = 1 - (1 - u) ** 3
    if ent == 'aproxima':
        e = suave(u)
        return min(1, u / 0.35 * 0.55) if u < 0.35 else 0.55 + 0.45 * (u - 0.35) / 0.65, 0.72 + 0.28 * e, (0, 0), 0.15 + 0.85 * e
    desl = {'esquerda': (-0.07, 0), 'direita': (0.07, 0), 'cima': (0, -0.07), 'baixo': (0, 0.07)}.get(ent, (0, 0))
    esc = 1.35 - 0.35 * e if ent == 'zoom' else 1
    return e, esc, (desl[0] * (1 - e), desl[1] * (1 - e)), 1


def desenhar(q, t, dur):
    fundo = img(q['imagem'])
    iw, ih = fundo.size
    de, para = focos(q)
    k = suave(min(1, t / dur)) if dur > 0 else 0
    f = tuple(de[i] + (para[i] - de[i]) * k for i in range(3))
    s, tx, ty = camera(f, iw, ih)
    if q.get('movimento') == 'tremor':
        tx += math.sin(t * 47) * VW * 0.003 + math.sin(t * 31) * VW * 0.002
        ty += math.cos(t * 41) * VH * 0.003
    # o recorte da imagem que aparece na janela, ampliado para a janela
    tela = Image.new('RGBA', (VW, VH), (0, 0, 0, 255))

    def colar(im, esc=1.0, desl=(0, 0), origem=(0.5, 0.6), alpha=1.0, brilho=1.0):
        # a camada tem o tamanho do fundo (pode estar em resolução maior): o ponto (u, v) da camada vai para a tela
        sx = s * esc * iw / im.width
        ox, oy = origem[0] * iw, origem[1] * ih
        # transform: posição na imagem-base = o + (p - o) * esc + desl
        x0 = tx + s * (ox - ox * esc + desl[0] * iw)
        y0 = ty + s * (oy - oy * esc + desl[1] * ih)
        # a parte que cai na tela
        a0, b0 = max(0, -x0 / sx), max(0, -y0 / sx)
        a1, b1 = min(im.width, (VW - x0) / sx), min(im.height, (VH - y0) / sx)
        if a1 <= a0 or b1 <= b0:
            return
        pedaco = im.crop((int(a0), int(b0), math.ceil(a1), math.ceil(b1)))
        w = max(1, round((math.ceil(a1) - int(a0)) * sx))
        h = max(1, round((math.ceil(b1) - int(b0)) * sx))
        pedaco = pedaco.resize((w, h), Image.BILINEAR)
        if brilho < 1 or alpha < 1:
            arr = np.asarray(pedaco).astype(np.float32)
            arr[..., :3] *= brilho
            arr[..., 3] *= alpha
            pedaco = Image.fromarray(arr.clip(0, 255).astype(np.uint8))
        camada = Image.new('RGBA', (VW, VH))
        camada.paste(pedaco, (round(x0 + int(a0) * sx), round(y0 + int(b0) * sx)))
        tela.alpha_composite(camada)

    colar(fundo)
    for c in q.get('camadas', []):
        al, esc, desl, br = camada_estado(c, t)
        if al <= 0:
            continue
        esc *= 1 + 0.035 * c.get('prof', 0) * k
        origem = (0.48, 0.32) if c.get('entrada') == 'aproxima' else (0.5, 0.6)
        colar(img(c['imagem']), esc, desl, origem, al, br)
    return tela


def cinema(tela):
    if cena.get('cinema'):
        faixa = round(VH * 0.105)
        tela.paste((0, 0, 0, 255), (0, 0, VW, faixa))
        tela.paste((0, 0, 0, 255), (0, VH - faixa, VW, VH))
    return tela


quadros = cena['quadros']
durs = [q.get('duracao') or segura for q in quadros]
inicio = np.concatenate([[0], np.cumsum(durs)])
total = inicio[-1]
n = int(total * FPS)
ff = subprocess.Popen(
    ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{VW}x{VH}', '-r', str(FPS), '-i', '-', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-crf', '20', str(saida.with_suffix('.mudo.mp4'))],
    stdin=subprocess.PIPE,
)
for fi in range(n):
    t = fi / FPS
    qi = int(np.searchsorted(inicio, t, side='right') - 1)
    qi = min(qi, len(quadros) - 1)
    q = quadros[qi]
    tq = t - inicio[qi]
    tela = desenhar(q, tq, durs[qi])
    tr = q.get('transicao', 'fade')
    if qi > 0 and tr == 'fade' and tq < 1.6:
        velho = desenhar(quadros[qi - 1], durs[qi - 1] + tq, durs[qi - 1])
        tela = Image.blend(velho, tela, suave(tq / 1.6))
    elif qi > 0 and tr == 'preto':
        if tq < 0.8:
            tela = Image.blend(desenhar(quadros[qi - 1], durs[qi - 1] + tq, durs[qi - 1]), Image.new('RGBA', (VW, VH), (0, 0, 0, 255)), tq / 0.8)
        elif tq < 1.6:
            tela = Image.blend(Image.new('RGBA', (VW, VH), (0, 0, 0, 255)), tela, (tq - 0.8) / 0.8)
    elif qi == 0 and tq < 0.7:
        tela = Image.blend(Image.new('RGBA', (VW, VH), (0, 0, 0, 255)), tela, tq / 0.7)
    if qi > 0 and tr == 'flash' and tq < 0.7:
        tela = Image.blend(tela, Image.new('RGBA', (VW, VH), (255, 255, 255, 255)), 0.95 * (1 - tq / 0.7))
    ff.stdin.write(np.asarray(cinema(tela).convert('RGB')).tobytes())
ff.stdin.close()
ff.wait()

# o som: cada quadro com som toca o dele quando entra (a música da cena, se houver, por baixo)
mix = np.zeros((int(total * SR) + SR, 2), np.float32)


def ler(u):
    tmp = saida.with_suffix('.tmp.wav')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(PUB / u.lstrip('/')), '-ac', '2', '-ar', str(SR), str(tmp)], check=True)
    with wave.open(str(tmp)) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), '<i2').reshape(-1, 2).astype(np.float32) / 32768
    tmp.unlink()
    return x


if cena.get('musica'):
    m = ler(cena['musica'])
    reps = math.ceil(len(mix) / len(m))
    m = np.tile(m, (reps, 1))[: len(mix)] * 0.85
    m[: int(2.2 * SR)] *= np.linspace(0, 1, int(2.2 * SR))[:, None]
    mix += m
for qi, q in enumerate(quadros):
    if q.get('som'):
        x = ler(q['som']) * 0.95
        k = int(inicio[qi] * SR)
        e = min(len(mix), k + len(x))
        mix[k:e] += x[: e - k]
mix = mix[: int(total * SR)]
fim = int(1.2 * SR)
mix[-fim:] *= np.linspace(1, 0, fim)[:, None]
pico = np.abs(mix).max()
if pico > 0.98:
    mix *= 0.98 / pico
wav = saida.with_suffix('.som.wav')
with wave.open(str(wav), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(saida.with_suffix('.mudo.mp4')), '-i', str(wav), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', str(saida)], check=True)
saida.with_suffix('.mudo.mp4').unlink()
wav.unlink()
print(saida, round(total, 1), 's')
