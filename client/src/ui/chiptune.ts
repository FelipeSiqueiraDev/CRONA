/**
 * A música do fliperama (08/10): um sequenciador de chiptune, como o chip de som dos videogames
 * antigos. Quatro vozes: o pulso estreito (a melodia), o pulso cheio (o arpejo), o triângulo (o baixo)
 * e o ruído (a bateria: k = bumbo, s = caixa, h = chimbal). Tudo sintetizado na hora, sem arquivos,
 * pela mesma saída dos sons (sfx.ts): "Sons: desligados" cala a música também.
 *
 * Cada música é escrita em texto, uma casa por semicolcheia (16 por compasso): a nota ("E5", "F#4"),
 * "." para pausa e "-" para segurar a nota de antes.
 */
import { sfx } from './sfx';

type Voz = 'pulso' | 'quadrada' | 'triangulo' | 'bateria';

interface Faixa {
  voz: Voz;
  notas: string[];
  vol: number;
}

interface Musica {
  bpm: number;
  faixas: Faixa[];
  /** toca uma vez só (as vinhetas) */
  uma?: boolean;
}

/** "E5 . A5 -" vira ['E5', '.', 'A5', '-']; os compassos podem vir em linhas separadas. */
const t = (...linhas: string[]) => linhas.join(' ').split(/\s+/).filter(Boolean);
/** Repete um trecho (o baixo e a bateria que se repetem). */
const vezes = (n: number, ...linhas: string[]) => Array.from({ length: n }, () => t(...linhas)).flat();

const MUSICAS: Record<string, Musica> = {
  // o menu: o tema do Suvaco Seco (lá menor: Am, F, C, G)
  menu: {
    bpm: 112,
    faixas: [
      {
        voz: 'pulso',
        vol: 0.1,
        notas: t(
          'E5 . A5 . C6 . B5 A5 . G5 - - E5 - . .',
          'F5 . A5 . C6 . D6 C6 . A5 - - F5 - . .',
          'E5 . G5 . C6 . E6 D6 . C6 - - G5 - E5 .',
          'D5 . G5 . B5 . D6 - C6 . B5 . G5 - - .',
        ),
      },
      {
        voz: 'quadrada',
        vol: 0.035,
        notas: t(...['A4 C5 E5 C5', 'F4 A4 C5 A4', 'C5 E5 G5 E5', 'G4 B4 D5 B4'].map((a) => `${a} ${a} ${a} ${a}`)),
      },
      { voz: 'triangulo', vol: 0.22, notas: t(...['A2 . A3 .', 'F2 . F3 .', 'C3 . C4 .', 'G2 . G3 .'].map((b) => `${b} ${b} ${b} ${b}`)) },
      { voz: 'bateria', vol: 0.5, notas: vezes(4, 'k . h . s . h . k k h . s . h h') },
    ],
  },
  // o PONG (09/10, refeito): eletrônico de fliperama, ré menor, a melodia quicando entre duas oitavas como a bola
  // (A: Dm, C, Bb, A; B: F, Am, Dm, A)
  pong: {
    bpm: 118,
    faixas: [
      {
        voz: 'pulso',
        vol: 0.085,
        notas: t(
          'D5 . . A4 . . D5 . F5 . E5 . D5 . A4 .',
          'C5 . . G4 . . C5 . E5 . D5 . C5 . G4 .',
          'A#4 . . F4 . . A#4 . D5 . C5 . A#4 . F5 .',
          'A4 . . E4 . . A4 . C#5 - E5 - A5 - - .',
          'F5 . F5 . A5 . F5 . G5 . G5 . A#5 . G5 .',
          'A5 . A5 . C6 . A5 . G5 - F5 - E5 - - .',
          'D5 . F5 . A5 . D6 . C6 . A#5 . A5 . G5 .',
          'F5 . E5 . D5 . C#5 . D5 - - - . . . .',
        ),
      },
      { voz: 'quadrada', vol: 0.028, notas: t(...['D4 F4 A4 F4', 'C4 E4 G4 E4', 'A#3 D4 F4 D4', 'A3 C#4 E4 C#4', 'F4 A4 C5 A4', 'A3 C4 E4 C4', 'D4 F4 A4 F4', 'A3 C#4 E4 C#4'].map((a) => `${a} ${a} ${a} ${a}`)) },
      { voz: 'triangulo', vol: 0.21, notas: t(...['D2', 'C2', 'A#1', 'A1', 'F2', 'A1', 'D2', 'A1'].map((r) => { const o = r.replace(/\d/, (n) => String(Number(n) + 1)); return `${r} . ${o} . ${r} . ${o} . ${r} . ${o} . ${r} ${r} ${o} .`; })) },
      { voz: 'bateria', vol: 0.38, notas: vezes(4, 'k . h . s . h . k . h k s . h h') },
    ],
  },
  // o ATRAVESSA: correria na avenida (mi menor; A: Em, C, D, B; B: G, Am, D, Em-B)
  atravessa: {
    bpm: 156,
    faixas: [
      {
        voz: 'pulso',
        vol: 0.085,
        notas: t(
          'B4 . E5 . G5 . E5 . B5 . A5 G5 F#5 . E5 .',
          'C5 . E5 . G5 . E5 . C6 . B5 A5 G5 . E5 .',
          'D5 . F#5 . A5 . F#5 . D6 . C6 B5 A5 . F#5 .',
          'B4 . D#5 . F#5 . B5 . A5 - G5 - F#5 - D#5 .',
          'G5 . G5 . A5 . B5 . D6 . B5 . A5 . G5 .',
          'A5 . A5 . B5 . C6 . E6 . C6 . B5 . A5 .',
          'F#5 . G5 . A5 . B5 . A5 . G5 . F#5 . D5 .',
          'E5 . F#5 . G5 . B5 . E6 - - - D#6 - B5 .',
        ),
      },
      { voz: 'quadrada', vol: 0.026, notas: t(...['E4 G4', 'E4 G4', 'G4 C5', 'D4 A4', 'D4 B4', 'C5 E5', 'D4 A4', 'D#4 B4'].map((a) => { const [x, y] = a.split(' '); return `. . ${x} . . . ${y} . . . ${x} . . . ${y} .`; })) },
      { voz: 'triangulo', vol: 0.22, notas: t(...['E2 E2 E3 E2', 'C2 C2 C3 C2', 'D2 D2 D3 D2', 'B1 B1 B2 B1', 'G2 G2 G3 G2', 'A2 A2 A3 A2', 'D2 D2 D3 D2', 'E2 E2 B1 B1'].map((b) => `${b} ${b} ${b} ${b}`)) },
      { voz: 'bateria', vol: 0.45, notas: vezes(4, 'k h s h k h s h k h s h k k s h') },
    ],
  },
  // o PULA-PULA: saltitante (dó maior; A: C, F, G, C; B: Am, Dm, G, C), a melodia subindo como o agente
  pula: {
    bpm: 132,
    faixas: [
      {
        voz: 'pulso',
        vol: 0.085,
        notas: t(
          'C5 . E5 G5 . E5 C6 . G5 . E5 . G5 - - .',
          'A5 . F5 A5 . C6 A5 . F5 . A5 . C6 - - .',
          'B5 . G5 B5 . D6 B5 . G5 . B5 . D6 . B5 .',
          'C6 . G5 E5 . G5 C6 . E6 - D6 - C6 - - .',
          'E6 . D6 . C6 . A5 . B5 . C6 . E6 - - .',
          'F6 . E6 . D6 . A5 . B5 . D6 . F6 - - .',
          'D6 . C6 . B5 . G5 . A5 . B5 . D6 . G6 .',
          'E6 . G6 . E6 . C6 . D6 - B5 - C6 - - .',
        ),
      },
      { voz: 'quadrada', vol: 0.028, notas: t(...['C5 E5 G5 E5', 'F4 A4 C5 A4', 'G4 B4 D5 B4', 'C5 E5 G5 C6', 'A4 C5 E5 C5', 'D5 F5 A5 F5', 'G4 B4 D5 B4', 'C5 E5 G5 C6'].map((a) => `${a} ${a} ${a} ${a}`)) },
      {
        voz: 'triangulo',
        vol: 0.22,
        notas: t(
          'C3 . . C3 G2 . C3 . C3 . . C3 G2 . E3 .',
          'F2 . . F2 C3 . F2 . F2 . . F2 C3 . A2 .',
          'G2 . . G2 D3 . G2 . G2 . . G2 D3 . B2 .',
          'C3 . . C3 G2 . C3 . C3 . E3 . G3 . C3 .',
          'A2 . . A2 E3 . A2 . A2 . . A2 E3 . C3 .',
          'D3 . . D3 A2 . D3 . D3 . . D3 A2 . F2 .',
          'G2 . . G2 D3 . G2 . G2 . B2 . D3 . G2 .',
          'C3 . . C3 G2 . C3 . C3 . E3 . G3 . C4 .',
        ),
      },
      { voz: 'bateria', vol: 0.35, notas: vezes(4, 'k . h . s . h h k . h . s . h .') },
    ],
  },
  // o recorde: a fanfarra das iniciais
  recorde: {
    bpm: 140,
    faixas: [
      { voz: 'pulso', vol: 0.1, notas: t('C5 E5 G5 C6 - . G5 C6 E6 - - . D6 C6 D6 E6', 'F6 - E6 - D6 - C6 - D6 - - . G5 - - .') },
      { voz: 'triangulo', vol: 0.22, notas: t('C3 . C4 . C3 . C4 . A2 . A3 . A2 . A3 .', 'F2 . F3 . F2 . F3 . G2 . G3 . G2 . G3 .') },
      { voz: 'bateria', vol: 0.4, notas: vezes(2, 'k . h h s . h . k . h h s . s s') },
    ],
  },
  // os dardos e a sinuca: uma bossinha de jukebox, baixinha (Am7, D9, Gmaj7, E7)
  bar: {
    bpm: 104,
    faixas: [
      {
        voz: 'pulso',
        vol: 0.055,
        notas: t(
          'E5 - - - . . C5 D5 E5 - - . . . . .',
          'F#5 - - - . . E5 F#5 A5 - - . . . . .',
          'B5 - - - A5 - G5 - F#5 - - . E5 . . .',
          'D5 - - . G#4 - - . B4 - - . . . . .',
          'E5 - - - . . G5 - A5 - C6 - B5 - A5 .',
          'F#5 - - - E5 - D5 - C5 - - . A4 . . .',
          'B4 - D5 - F#5 - A5 - G5 - - - F#5 - - .',
          'E5 - - - D5 - - - B4 - - - . . . .',
        ),
      },
      // o violão: duas vozes batendo no ritmo da bossa
      ...[
        ['G4', 'C5', 'F#4', 'G#4'],
        ['C5', 'E5', 'B4', 'D5'],
      ].map((acorde) => ({
        voz: 'quadrada' as const,
        vol: 0.016,
        notas: vezes(2, ...['A', 'B', 'C', 'D'].map((_, i) => `${acorde[i]} . . ${acorde[i]} . . ${acorde[i]} . . . ${acorde[i]} . . ${acorde[i]} . .`)),
      })),
      {
        voz: 'triangulo',
        vol: 0.2,
        notas: vezes(2, 'A2 . . A2 E2 . . . A2 . . A2 E2 . . .', 'D2 . . D2 A2 . . . D2 . . D2 A2 . . .', 'G2 . . G2 D2 . . . G2 . . G2 D2 . . .', 'E2 . . E2 B1 . . . E2 . . E2 G#2 . . .'),
      },
      { voz: 'bateria', vol: 0.16, notas: vezes(8, 'h h h h h h h h h h h h h h h h') },
      { voz: 'bateria', vol: 0.22, notas: vezes(8, 'k . . s . . k . . . s . . s . .') },
    ],
  },
  // as vinhetas
  vitoria: {
    bpm: 200,
    uma: true,
    faixas: [
      { voz: 'pulso', vol: 0.12, notas: t('C5 E5 G5 C6 . G5 C6 E6 - - - - . . . .') },
      { voz: 'triangulo', vol: 0.24, notas: t('C3 . G3 . C4 . . . C3 - - - . . . .') },
      { voz: 'bateria', vol: 0.4, notas: t('k . . . k . . . s . . . . . . .') },
    ],
  },
  derrota: {
    bpm: 150,
    uma: true,
    faixas: [
      { voz: 'pulso', vol: 0.11, notas: t('G4 . F#4 . F4 . E4 - - - - - . . . .') },
      { voz: 'triangulo', vol: 0.22, notas: t('G2 . F#2 . F2 . E2 - - - - - . . . .') },
    ],
  },
};

const NOTA: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function frequencia(nota: string): number | null {
  const m = /^([A-G]#?)(\d)$/.exec(nota);
  if (!m) return null;
  const midi = (Number(m[2]) + 1) * 12 + NOTA[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const CHAVE = 'crona.fliperama.musica';

class Chiptune {
  /** a música ligada (o botão ♪ do gabinete) */
  ligada = true;
  private atual: { nome: string; m: Musica } | null = null;
  private passo = 0;
  private proximo = 0;
  private timer = 0;
  private saida: GainNode | null = null;
  private ac: AudioContext | null = null;
  private pulso: PeriodicWave | null = null;

  constructor() {
    try {
      this.ligada = localStorage.getItem(CHAVE) !== '0';
    } catch {
      /* sem armazenamento */
    }
  }

  alternar() {
    this.ligada = !this.ligada;
    try {
      localStorage.setItem(CHAVE, this.ligada ? '1' : '0');
    } catch {
      /* sem armazenamento */
    }
    if (this.saida && this.ac) this.saida.gain.setTargetAtTime(this.ligada ? 0.4 : 0, this.ac.currentTime, 0.05);
    return this.ligada;
  }

  /** Toca a música (a mesma que já toca continua de onde está). */
  tocar(nome: keyof typeof MUSICAS) {
    if (this.atual?.nome === nome) return;
    this.atual = { nome, m: MUSICAS[nome] };
    this.passo = 0;
    this.proximo = 0;
    if (!this.timer) this.timer = window.setInterval(() => this.agendar(), 25);
  }

  parar() {
    this.atual = null;
    clearInterval(this.timer);
    this.timer = 0;
    // corta o que já estava agendado
    if (this.saida && this.ac) {
      const s = this.saida;
      s.gain.setTargetAtTime(0, this.ac.currentTime, 0.03);
      this.saida = null;
      window.setTimeout(() => s.disconnect(), 400);
    }
  }

  /** Agenda as notas que caem nos próximos 120 ms (o relógio do áudio é o que manda, não o do navegador). */
  private agendar() {
    const a = sfx.audio();
    const cur = this.atual;
    if (!a || !cur) return;
    if (this.ac !== a.ac || !this.saida) {
      this.ac = a.ac;
      this.saida = a.ac.createGain();
      this.saida.gain.value = this.ligada ? 0.4 : 0;
      this.saida.connect(a.saida);
      this.pulso = null;
      this.proximo = 0;
    }
    const ac = a.ac;
    const casa = 60 / cur.m.bpm / 4;
    const tamanho = Math.max(...cur.m.faixas.map((f) => f.notas.length));
    if (this.proximo < ac.currentTime) this.proximo = ac.currentTime + 0.05;
    while (this.proximo < ac.currentTime + 0.12) {
      if (cur.m.uma && this.passo >= tamanho) {
        this.atual = null;
        return;
      }
      const i = this.passo % tamanho;
      for (const f of cur.m.faixas) {
        const n = f.notas[i % f.notas.length];
        if (!n || n === '.' || n === '-') continue;
        // segura enquanto vier "-"
        let dura = 1;
        while (f.notas[(i + dura) % f.notas.length] === '-' && dura < 16) dura++;
        this.nota(a, f, n, this.proximo, casa * dura);
      }
      this.passo++;
      this.proximo += casa;
    }
  }

  private nota(a: { ac: AudioContext; ruido: AudioBuffer }, f: Faixa, n: string, t: number, dura: number) {
    const ac = a.ac;
    const g = ac.createGain();
    g.connect(this.saida!);
    if (f.voz === 'bateria') {
      if (n === 'k') {
        // o bumbo: um seno que despenca
        const o = ac.createOscillator();
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        g.gain.setValueAtTime(f.vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.18);
        return;
      }
      const src = ac.createBufferSource();
      src.buffer = a.ruido;
      const filtro = ac.createBiquadFilter();
      filtro.type = n === 'h' ? 'highpass' : 'bandpass';
      filtro.frequency.value = n === 'h' ? 7000 : 1800;
      const d = n === 'h' ? 0.035 : 0.12;
      g.gain.setValueAtTime(f.vol * (n === 'h' ? 0.35 : 0.6), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(filtro).connect(g);
      src.start(t, Math.random());
      src.stop(t + d + 0.02);
      return;
    }
    const hz = frequencia(n);
    if (!hz) return;
    const o = ac.createOscillator();
    if (f.voz === 'pulso') o.setPeriodicWave((this.pulso ??= this.ondaDePulso(ac, 0.25)));
    else o.type = f.voz === 'quadrada' ? 'square' : 'triangle';
    o.frequency.setValueAtTime(hz, t);
    // um vibrato leve nas notas longas da melodia
    if (f.voz === 'pulso' && dura > 0.3) {
      const lfo = ac.createOscillator();
      const prof = ac.createGain();
      lfo.frequency.value = 5.5;
      prof.gain.setValueAtTime(0, t);
      prof.gain.linearRampToValueAtTime(hz * 0.012, t + dura);
      lfo.connect(prof).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dura);
    }
    const fim = t + dura * 0.92;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(f.vol, t + 0.006);
    g.gain.setValueAtTime(f.vol * 0.8, Math.max(t + 0.01, fim - 0.03));
    g.gain.exponentialRampToValueAtTime(0.0001, fim);
    o.connect(g);
    o.start(t);
    o.stop(fim + 0.02);
  }

  /** A onda de pulso estreita (25%), a voz mais "videogame" de todas. */
  private ondaDePulso(ac: AudioContext, duty: number) {
    const n = 48;
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    return ac.createPeriodicWave(re, im);
  }
}

export const musica = new Chiptune();
export type NomeMusica = keyof typeof MUSICAS;
