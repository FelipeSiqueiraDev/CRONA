"""Os sons das cenas de momento, feitos por código (18/10): trovão, sirene, a pancada na grade e o fundo da cela."""
import subprocess
import sys
import wave

import numpy as np

SR = 44100
OUT = sys.argv[1]
rng = np.random.default_rng(13)


def t_(seg):
    return np.arange(int(seg * SR)) / SR


def passa_baixa(x, fc):
    """Filtro de um polo, aplicado duas vezes (12 dB por oitava)."""
    a = np.exp(-2 * np.pi * fc / SR)
    for _ in range(2):
        y = np.empty_like(x)
        acc = 0.0
        for i in range(len(x)):
            acc = (1 - a) * x[i] + a * acc
            y[i] = acc
        x = y
    return x


def passa_baixa_rapido(x, fc):
    # o mesmo filtro, pela FFT (os sons longos)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / fc) ** 4)
    return np.fft.irfft(X, len(x))


def passa_alta_rapido(x, fc):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (fc / np.maximum(f, 1)) ** 4)
    return np.fft.irfft(X, len(x))


def eco(x, salas=((0.031, 0.5), (0.047, 0.42), (0.071, 0.36), (0.113, 0.3), (0.167, 0.24), (0.241, 0.18)), cauda=2.5):
    """Uma reverberação simples: ecos que se espalham e um rabo de ruído que cai devagar."""
    n = len(x) + int(cauda * SR)
    y = np.zeros(n)
    y[: len(x)] += x
    for d, g in salas:
        k = int(d * SR)
        for r in range(1, 6):
            if k * r < n:
                seg = x[: n - k * r] * (g ** r)
                y[k * r : k * r + len(seg)] += seg
    # a cauda: o próprio som convolvido com um ruído que decai
    ir = rng.normal(0, 1, int(cauda * SR)) * np.exp(-t_(cauda) * 3.2)
    ir = passa_baixa_rapido(ir, 3500)
    m = len(x) + len(ir)
    wet = np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[:n] * 0.012
    return y + wet


def estereo(m, largura=0.004):
    k = int(largura * SR)
    e = np.concatenate([m, np.zeros(k)])
    d = np.concatenate([np.zeros(k), m])
    return np.stack([e, d], 1)


def gravar(nome, x, ganho=0.92):
    x = x / (np.abs(x).max() + 1e-9) * ganho
    if x.ndim == 1:
        x = estereo(x)
    w = f'{OUT}/{nome}.wav'
    with wave.open(w, 'wb') as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes((x * 32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', w, '-codec:a', 'libmp3lame', '-q:a', '3', f'{OUT}/{nome}.mp3'], check=True)
    print(nome, round(len(x) / SR, 1), 's')


def fade(x, ini=0.01, fim=0.3):
    n = len(x)
    e = np.ones(n)
    a, b = int(ini * SR), int(fim * SR)
    if a:
        e[:a] = np.linspace(0, 1, a)
    if b:
        e[-b:] = np.linspace(1, 0, b)
    return x * e


# ------------------------------------------------------------------- o trovão: o estalo perto e o ronco que rola
def trovao():
    dur = 9.0
    t = t_(dur)
    n = len(t)
    # o estalo: ruído branco muito curto e forte, com vários golpes em seguida (o raio se ramificando)
    estalo = np.zeros(n)
    for ini, g in [(0.0, 1.0), (0.05, 0.7), (0.11, 0.85), (0.19, 0.5), (0.32, 0.4)]:
        k = int(ini * SR)
        m = int(0.25 * SR)
        estalo[k : k + m] += rng.normal(0, 1, m) * np.exp(-t_(0.25) * 22) * g
    estalo = passa_alta_rapido(passa_baixa_rapido(estalo, 7000), 300)
    # o ronco: ruído marrom (grave), com rajadas que sobem e descem, caindo devagar
    br = np.cumsum(rng.normal(0, 1, n))
    br -= np.linspace(br[0], br[-1], n)  # o começo e o fim no mesmo lugar (o filtro dá a volta)
    br -= passa_baixa_rapido(br, 8)  # tira a deriva
    ronco = passa_baixa_rapido(br, 160)
    rajada = passa_baixa_rapido(rng.normal(0, 1, n), 2.2)
    rajada = 0.55 + 0.9 * np.abs(rajada) / np.abs(rajada).max()
    env = np.clip(t / 0.25, 0, 1) * np.exp(-t * 0.42)
    ronco = ronco / np.abs(ronco).max() * env * rajada
    meio = passa_baixa_rapido(rng.normal(0, 1, n), 900) * np.exp(-t * 1.6) * 0.25
    x = estalo * 0.7 + ronco * 1.7 + meio
    return fade(eco(x, cauda=2.0), 0.002, 1.8)


# ------------------------------------------------------------------- a sirene: a de ataque aéreo, num lugar vazio
def sirene():
    dur = 16.0
    t = t_(dur)
    # o tom sobe devagar, fica lá em cima, desce gemendo; duas vezes
    def curva(tt):
        c = np.interp(tt, [0, 3.2, 6.0, 8.0, 10.6, 13.5, 16], [90, 470, 470, 160, 455, 455, 70])
        return c
    f = passa_baixa_rapido(curva(t), 3)
    f *= 1 + 0.004 * np.sin(2 * np.pi * 5.3 * t)
    fase = 2 * np.cumsum(np.pi * f / SR)
    # a sirene de rotor tem um som de "buzina": harmônicos fortes, uma quinta junto e um batimento
    x = np.zeros_like(t)
    for h, g in [(1, 1.0), (2, 0.6), (3, 0.45), (4, 0.25), (5, 0.18), (6, 0.1)]:
        x += g * np.sin(h * fase)
        x += 0.55 * g * np.sin(h * fase * 1.498 + 0.7)
    x += 0.25 * np.sin(fase * 1.012)
    vol = np.interp(t, [0, 2.5, 6, 7.6, 8.4, 10.5, 13.5, 15.2, 16], [0, 0.9, 1, 0.55, 0.5, 0.95, 1, 0.4, 0])
    x *= vol
    x = np.tanh(x * 0.9)
    x = passa_baixa_rapido(x, 2600)
    # longe: eco grande da cidade vazia
    longe = ((0.21, 0.5), (0.37, 0.42), (0.59, 0.33), (0.83, 0.25), (1.21, 0.18))
    return fade(eco(x, longe, cauda=3.5), 0.4, 3.0)


# ------------------------------------------------------------------- a mão batendo na grade: o ferro velho vibrando
def pancada():
    dur = 3.6
    t = t_(dur)
    x = np.zeros_like(t)
    # o ferro: parciais desarmônicas (uma barra que vibra), cada uma caindo no seu tempo
    for f, g, dec in [(212, 1.0, 2.6), (583, 0.7, 3.4), (1137, 0.5, 4.5), (1879, 0.35, 6.0), (2803, 0.22, 8.0), (3911, 0.12, 10.0)]:
        x += g * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t * dec)
    # o batimento das barras vizinhas
    x += 0.4 * np.sin(2 * np.pi * 219 * t) * np.exp(-t * 2.4)
    # o golpe: o baque grave e o ruído do contato
    golpe = rng.normal(0, 1, len(t)) * np.exp(-t * 60)
    golpe = passa_baixa_rapido(golpe, 2500)
    baque = np.sin(2 * np.pi * 70 * t) * np.exp(-t * 14)
    x = x * 0.75 + golpe * 1.2 + baque * 0.8
    # a grade chacoalhando: dois golpezinhos depois
    for ini, g in [(0.09, 0.35), (0.17, 0.2)]:
        k = int(ini * SR)
        x[k:] += g * golpe[: len(x) - k]
    salas = ((0.023, 0.55), (0.041, 0.45), (0.067, 0.38), (0.097, 0.3), (0.149, 0.22))
    return fade(eco(x, salas, cauda=2.2), 0.001, 1.2)


# ------------------------------------------------------------------- o fundo da cela: o grave que não para, a goteira
def fundo_cela():
    dur = 40.0  # tocando em volta (a música da cena repete)
    t = t_(dur)
    n = len(t)
    # o grave: duas notas que batem devagar (dá desconforto sem ser música)
    x = 0.5 * np.sin(2 * np.pi * 55 * t) + 0.45 * np.sin(2 * np.pi * 55.7 * t) + 0.22 * np.sin(2 * np.pi * 82.6 * t + 1)
    x *= 0.75 + 0.25 * np.sin(2 * np.pi * t / dur * 3)  # respira (3 vezes no laço: emenda sem estalo)
    # o vento no corredor: ruído filtrado que sobe e desce
    ar = passa_baixa_rapido(rng.normal(0, 1, n), 420)
    ar = ar / np.abs(ar).max() * (0.35 + 0.25 * np.sin(2 * np.pi * t / dur * 2 + 0.5))
    x = x / np.abs(x).max() * 0.6 + ar * 0.5
    # a goteira: pingos com eco, de vez em quando
    pingo = np.sin(2 * np.pi * (1400 + 900 * np.exp(-t_(0.12) * 40)) * t_(0.12)) * np.exp(-t_(0.12) * 45)
    for ini in [2.1, 7.8, 9.4, 15.0, 21.7, 23.1, 29.5, 34.2, 37.0]:
        k = int(ini * SR)
        x[k : k + len(pingo)] += pingo * rng.uniform(0.18, 0.3)
    y = eco(x, cauda=1.5)
    # o laço: o rabo do eco volta para o começo
    cauda = y[n:]
    y = y[:n]
    y[: len(cauda)] += cauda
    return y


def main():
    gravar('trovao', trovao())
    gravar('sirene', sirene(), 0.8)
    gravar('grade-pancada', pancada(), 0.85)
    gravar('fundo-cela', fundo_cela(), 0.55)


main()
