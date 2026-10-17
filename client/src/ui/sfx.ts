/**
 * Sons da interface, sintetizados na hora (Web Audio, sem arquivos):
 * lápis riscando, borracha, papel, pincel, carimbo, teclas da máquina de
 * escrever, item voando e caindo. Volume baixo; dá para desligar no menu.
 */
import { aoLiberar } from './audioCelular';

const KEY = 'crona.sfx';

interface Burst {
  dur: number;
  type: BiquadFilterType;
  freq: number;
  freq2?: number;
  q?: number;
  gain: number;
  attack?: number;
  release?: number;
}

class Sfx {
  enabled = true;
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastTick = 0;

  constructor() {
    try {
      this.enabled = localStorage.getItem(KEY) !== '0';
    } catch {
      /* sem storage */
    }
    if (typeof window === 'undefined') return;
    // libera no gesto que conta (no celular, quando o dedo solta), até o som estar de pé
    aoLiberar(() => this.ctx() !== null);
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    try {
      localStorage.setItem(KEY, v ? '1' : '0');
    } catch {
      /* sem storage */
    }
    if (v) this.paper();
  }

  private ctx(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ac) {
      // o navegador só libera áudio depois de um clique/tecla na página
      const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
      if (ua && !ua.hasBeenActive) return null;
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ac = new AC();
      this.master = this.ac.createGain();
      this.master.gain.value = 0.3;
      this.master.connect(this.ac.destination);
      const len = this.ac.sampleRate * 2;
      const b = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
    }
    // suspenso (antes do gesto) ou interrompido (o iPhone, ao voltar de outro app)
    if (this.ac.state !== 'running' && this.ac.state !== 'closed') void this.ac.resume();
    return this.ac.state === 'running' ? this.ac : null;
  }

  /** Rajada de ruído filtrado com envelope. Devolve o nó de ganho para modulação. */
  private burst(o: Burst, into?: AudioNode) {
    const ac = this.ctx();
    if (!ac || !this.noise || !this.master) return null;
    const t = ac.currentTime + 0.005;
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    const f = ac.createBiquadFilter();
    f.type = o.type;
    f.frequency.setValueAtTime(o.freq, t);
    if (o.freq2) f.frequency.exponentialRampToValueAtTime(o.freq2, t + o.dur);
    f.Q.value = o.q ?? 0.8;
    const g = ac.createGain();
    const a = o.attack ?? 0.01;
    const r = o.release ?? 0.05;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain, t + a);
    g.gain.setValueAtTime(o.gain, t + Math.max(a, o.dur - r));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f).connect(g).connect(into ?? this.master);
    src.start(t, Math.random() * 1.2);
    src.stop(t + o.dur + 0.05);
    return { g, t, ac };
  }

  private tone(f1: number, f2: number, dur: number, gain: number, type: OscillatorType = 'sine') {
    const ac = this.ctx();
    if (!ac || !this.master) return;
    const t = ac.currentTime + 0.005;
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // ---------------------------------------------------------------- o fliperama

  /** Bipe de videogame antigo (onda quadrada, ataque seco), de f1 a f2; `atraso` em segundos, para as notas em sequência. */
  chip(f1: number, f2 = f1, dur = 0.07, gain = 0.09, atraso = 0) {
    const ac = this.ctx();
    if (!ac || !this.master) return;
    const t = ac.currentTime + 0.005 + atraso;
    const o = ac.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(f1, t);
    if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.setValueAtTime(gain, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** O áudio liberado (para a música do fliperama tocar pela mesma saída e respeitar o "Sons: desligados"). */
  audio(): { ac: AudioContext; saida: GainNode; ruido: AudioBuffer } | null {
    const ac = this.ctx();
    return ac && this.master && this.noise ? { ac, saida: this.master, ruido: this.noise } : null;
  }

  /** Um estouro de ruído (a explosão, o carro batendo, a moeda caindo no cofre). */
  ruido(dur: number, freq: number, gain = 0.2, freq2?: number) {
    this.burst({ dur, type: 'bandpass', freq, freq2, q: 1.2, gain, attack: 0.004, release: dur * 0.8 });
  }

  // ---------------------------------------------------------------- o bar (dardos e sinuca); força de 0 a 1

  /** Bola batendo em bola: o estalo seco, mais alto quanto mais forte. */
  bolaNaBola(forca: number) {
    const f = Math.max(0, Math.min(1, forca));
    this.tone(2400 + f * 900, 1700, 0.035, 0.04 + 0.22 * f);
    this.burst({ dur: 0.03, type: 'highpass', freq: 2600, gain: 0.04 + 0.26 * f, attack: 0.001, release: 0.02 });
  }

  /** A bola na tabela: um baque surdo de borracha. */
  tabela(forca: number) {
    const f = Math.max(0, Math.min(1, forca));
    this.burst({ dur: 0.09, type: 'lowpass', freq: 380, gain: 0.05 + 0.25 * f, attack: 0.002, release: 0.07 });
    this.tone(130, 70, 0.08, 0.04 + 0.12 * f);
  }

  /** A bola caindo na caçapa: o "plunc" e ela rolando lá dentro. */
  cacapa() {
    this.tone(320, 110, 0.14, 0.14);
    this.burst({ dur: 0.16, type: 'bandpass', freq: 900, freq2: 300, gain: 0.12, attack: 0.003, release: 0.12 });
    if (typeof window !== 'undefined') window.setTimeout(() => this.burst({ dur: 0.35, type: 'bandpass', freq: 500, freq2: 260, q: 2, gain: 0.05, attack: 0.02, release: 0.3 }), 130);
  }

  /** O taco batendo na branca. */
  taco(forca: number) {
    const f = Math.max(0, Math.min(1, forca));
    this.burst({ dur: 0.04, type: 'highpass', freq: 1400, gain: 0.1 + 0.25 * f, attack: 0.001, release: 0.03 });
    this.tone(900, 420, 0.05, 0.06 + 0.1 * f);
  }

  /** O pó de giz e o ranger do taco na mão. */
  giz() {
    this.burst({ dur: 0.1, type: 'highpass', freq: 5200, gain: 0.04, attack: 0.01, release: 0.08 });
  }

  /** O dardo cortando o ar. */
  dardoVoa() {
    this.burst({ dur: 0.18, type: 'bandpass', freq: 1100, freq2: 3200, q: 1.5, gain: 0.06, attack: 0.03, release: 0.1 });
  }

  /** O dardo cravando no sisal (fora do alvo: na parede de madeira). */
  dardoCrava(noAlvo: boolean) {
    this.burst({ dur: 0.07, type: 'lowpass', freq: noAlvo ? 520 : 900, gain: 0.3, attack: 0.001, release: 0.05 });
    this.tone(noAlvo ? 170 : 260, noAlvo ? 90 : 140, 0.08, 0.18);
  }

  /** Notas em sequência (a ficha caindo, o recorde). */
  arpejo(notas: number[], passo = 0.07, gain = 0.08) {
    notas.forEach((f, i) => this.chip(f, f, passo * 0.9, gain, i * passo));
  }

  // ---------------------------------------------------------------- o carro (a tela da viagem)

  /** Um tom com começo marcado no tempo (para montar o som em sequência). */
  private tomEm(atraso: number, f1: number, f2: number, dur: number, gain: number, type: OscillatorType, filtro?: number) {
    const ac = this.ctx();
    if (!ac || !this.master) return;
    const t = ac.currentTime + atraso;
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.25, dur / 3));
    g.gain.setValueAtTime(gain, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let saida: AudioNode = g;
    if (filtro) {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filtro;
      g.connect(f);
      saida = f;
    }
    o.connect(g);
    saida.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Ruído filtrado com começo marcado (o asfalto, o freio, a batida da porta). */
  private ruidoEm(atraso: number, dur: number, type: BiquadFilterType, f1: number, f2: number, gain: number) {
    const ac = this.ctx();
    if (!ac || !this.noise || !this.master) return;
    const t = ac.currentTime + atraso;
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f1, t);
    f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    f.Q.value = 0.9;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.3, dur / 3));
    g.gain.setValueAtTime(gain, t + dur * 0.65);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /**
   * O motor de verdade (07/10): o estouro de cada cilindro é um dente de serra grave (a frequência é a rotação), com um
   * sub-grave na metade, o ronco do escapamento (ruído que pulsa no ritmo do motor) e um filtro que abre quando acelera.
   * `rot`: [segundos, explosões por segundo]; `vol`: [segundos, volume]. O motor "manca" de leve (a marcha lenta irregular).
   */
  private motorVivo(atraso: number, rot: [number, number][], vol: [number, number][]) {
    const ac = this.ctx();
    if (!ac || !this.noise || !this.master) return;
    const t0 = ac.currentTime + atraso;
    const fim = t0 + Math.max(rot[rot.length - 1][0], vol[vol.length - 1][0]) + 0.1;
    const curva = (p: AudioParam, pts: [number, number][], k = 1) => {
      p.setValueAtTime(pts[0][1] * k, t0 + pts[0][0]);
      for (const [t, v] of pts.slice(1)) p.linearRampToValueAtTime(v * k, t0 + t);
    };
    const saida = ac.createGain();
    curva(saida.gain, vol);
    saida.connect(this.master);
    const filtro = ac.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.Q.value = 2.2;
    curva(filtro.frequency, rot, 6);
    filtro.connect(saida);
    // os estouros
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    curva(o.frequency, rot);
    // a marcha lenta manca: um balanço lento na rotação
    const manca = ac.createOscillator();
    manca.frequency.value = 2.7;
    const mancaG = ac.createGain();
    mancaG.gain.value = 1.6;
    manca.connect(mancaG).connect(o.frequency);
    o.connect(filtro);
    // o sub-grave, meia rotação
    const sub = ac.createOscillator();
    sub.type = 'square';
    curva(sub.frequency, rot, 0.5);
    const subG = ac.createGain();
    subG.gain.value = 0.35;
    sub.connect(subG).connect(filtro);
    // o escapamento: ruído grave que pulsa a cada estouro
    const ruido = ac.createBufferSource();
    ruido.buffer = this.noise;
    ruido.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.8;
    curva(bp.frequency, rot, 5);
    const am = ac.createGain();
    am.gain.value = 0;
    const amProf = ac.createGain();
    amProf.gain.value = 0.9;
    o.connect(amProf).connect(am.gain);
    ruido.connect(bp).connect(am).connect(filtro);
    for (const n of [o, sub, manca]) {
      n.start(t0);
      n.stop(fim);
    }
    ruido.start(t0, Math.random());
    ruido.stop(fim);
  }

  /** O motor de arranque girando: o zumbido do motorzinho, batendo nos tempos de compressão ("rrr-rrr-rrr"). */
  private arranque(atraso: number, dur: number) {
    const ac = this.ctx();
    if (!ac || !this.noise || !this.master) return;
    const t = ac.currentTime + atraso;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
    g.gain.setValueAtTime(0.16, t + dur - 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    // as batidas da compressão: o volume pulsa uns 6 vezes por segundo, acelerando um pouco
    const pulso = ac.createGain();
    pulso.gain.value = 0.55;
    const lfo = ac.createOscillator();
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(5.2, t);
    lfo.frequency.linearRampToValueAtTime(6.8, t + dur);
    const lfoG = ac.createGain();
    lfoG.gain.value = 0.45;
    lfo.connect(lfoG).connect(pulso.gain);
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 1.4;
    const zumbido = ac.createOscillator();
    zumbido.type = 'sawtooth';
    zumbido.frequency.setValueAtTime(110, t);
    zumbido.frequency.linearRampToValueAtTime(135, t + dur);
    const ruido = ac.createBufferSource();
    ruido.buffer = this.noise;
    ruido.loop = true;
    const rg = ac.createGain();
    rg.gain.value = 0.6;
    zumbido.connect(f);
    ruido.connect(rg).connect(f);
    f.connect(pulso).connect(g).connect(this.master);
    for (const n of [zumbido, lfo]) {
      n.start(t);
      n.stop(t + dur + 0.05);
    }
    ruido.start(t, Math.random());
    ruido.stop(t + dur + 0.05);
  }

  /** A chave: entra no contato e gira (dois cliques metálicos). */
  private chave(atraso: number) {
    this.ruidoEm(atraso, 0.03, 'highpass', 4200, 3600, 0.22);
    this.tomEm(atraso, 3100, 2900, 0.04, 0.05, 'square');
    this.ruidoEm(atraso + 0.3, 0.04, 'highpass', 3600, 3000, 0.26);
    this.tomEm(atraso + 0.3, 2500, 2300, 0.05, 0.05, 'square');
  }

  /** A porta da van batendo. */
  private porta(atraso: number) {
    this.tomEm(atraso, 140, 48, 0.22, 0.5, 'sine');
    this.ruidoEm(atraso, 0.16, 'lowpass', 900, 300, 0.35);
  }

  /** A partida: a porta bate, a chave gira, o motor de arranque, o motor pega com uma acelerada, a marcha lenta e a saída. */
  carroPartindo() {
    this.porta(0);
    this.chave(0.6);
    this.arranque(1.0, 1.1);
    // pegou: uma acelerada, cai para a marcha lenta e depois sai acelerando
    this.motorVivo(2.05, [[0, 22], [0.18, 58], [0.55, 30], [1.4, 27], [2.0, 30], [4.2, 62]], [[0, 0.0001], [0.06, 0.32], [0.55, 0.22], [1.4, 0.2], [3.4, 0.24], [4.2, 0.0001]]);
  }

  /** A chegada: o motor desacelera, para, a chave desliga (o motor engasga e morre) e a porta abre e bate. */
  carroChegando() {
    this.motorVivo(0, [[0, 58], [1.6, 32], [2.6, 27], [3.0, 26], [3.25, 14]], [[0, 0.24], [1.6, 0.22], [2.9, 0.2], [3.25, 0.0001]]);
    this.tomEm(1.2, 2500, 1900, 0.7, 0.03, 'sine');
    this.chave(3.0);
    this.porta(4.0);
  }

  /** Grafite no papel: ruído agudo com "arranhado" irregular. */
  pencil(ms: number, vol = 1) {
    const ac = this.ctx();
    if (!ac || !this.master) return;
    const mod = ac.createGain();
    mod.gain.value = 0.55;
    mod.connect(this.master);
    const lfo = ac.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 17 + Math.random() * 9;
    const depth = ac.createGain();
    depth.gain.value = 0.42;
    lfo.connect(depth).connect(mod.gain);
    const b = this.burst({ dur: ms / 1000, type: 'bandpass', freq: 3900, freq2: 3200, q: 1.1, gain: 0.55 * vol, attack: 0.02, release: 0.09 }, mod);
    if (!b) return;
    lfo.start(b.t);
    lfo.stop(b.t + ms / 1000 + 0.05);
  }

  /** Borracha esfregando. */
  erase(ms: number) {
    const b = this.burst({ dur: ms / 1000, type: 'lowpass', freq: 1300, q: 0.7, gain: 0.5, attack: 0.02, release: 0.08 });
    if (!b) return;
    const n = 6;
    for (let i = 0; i < n; i++) {
      const at = b.t + (i / n) * (ms / 1000);
      b.g.gain.setValueAtTime(i % 2 ? 0.18 : 0.5, at);
    }
  }

  /** Folha deslizando / aba virando. */
  paper() {
    this.burst({ dur: 0.22, type: 'bandpass', freq: 2600, freq2: 700, q: 0.7, gain: 0.32, attack: 0.015, release: 0.12 });
  }

  /** Pincel molhado passando. */
  brush(ms: number) {
    this.burst({ dur: ms / 1000, type: 'bandpass', freq: 1100, freq2: 1900, q: 0.55, gain: 0.26, attack: 0.07, release: 0.16 });
  }

  /** Carimbo batendo. */
  stamp() {
    this.tone(130, 45, 0.16, 0.7);
    this.burst({ dur: 0.03, type: 'highpass', freq: 1800, gain: 0.35, attack: 0.002, release: 0.02 });
  }

  /** Tecla da máquina de escrever (com limite de frequência). */
  tick() {
    const now = performance.now();
    if (now - this.lastTick < 28) return;
    this.lastTick = now;
    this.burst({ dur: 0.014, type: 'highpass', freq: 2600 + Math.random() * 900, gain: 0.1 + Math.random() * 0.05, attack: 0.001, release: 0.01 });
  }

  /** Item cortando o ar. */
  whoosh(ms: number) {
    this.burst({ dur: ms / 1000, type: 'bandpass', freq: 420, freq2: 2300, q: 0.9, gain: 0.22, attack: ms / 2500, release: ms / 2000 });
  }

  /** Item chegando no retrato. */
  drop() {
    this.tone(190, 70, 0.14, 0.45);
    this.burst({ dur: 0.07, type: 'lowpass', freq: 700, gain: 0.3, attack: 0.003, release: 0.05 });
  }

  /** Estalo curto (clique de botão/checkbox). */
  click() {
    this.burst({ dur: 0.018, type: 'highpass', freq: 2300, gain: 0.18, attack: 0.001, release: 0.012 });
    this.tone(900, 700, 0.03, 0.06, 'triangle');
  }

  /** "Plim" suave (item aparecendo). */
  pop() {
    this.tone(540, 900, 0.08, 0.18, 'triangle');
  }

  /** Tecla do painel de senha (cada número um tom). */
  beep(n = 0) {
    this.tone(880 + (n % 10) * 22, 880 + (n % 10) * 22, 0.07, 0.12, 'square');
  }

  /**
   * A tranca (17/10): alguém forçou uma porta ou um armário trancado. A maçaneta desce e bate no batente duas vezes,
   * o trinco chacoalha no ferro e a madeira range de leve.
   */
  trancado() {
    for (const [t, f] of [[0, 1] as const, [0.16, 0.85] as const]) {
      this.tomEm(t, 210 * f, 120 * f, 0.07, 0.32, 'square', 900);
      this.ruidoEm(t, 0.05, 'bandpass', 2400 * f, 1600 * f, 0.34);
      this.ruidoEm(t + 0.03, 0.08, 'highpass', 3800, 3000, 0.12);
    }
    this.ruidoEm(0.3, 0.12, 'lowpass', 700, 380, 0.16);
  }

  /** Senha errada: zumbido grave. */
  denied() {
    this.tone(150, 140, 0.32, 0.22, 'sawtooth');
    this.tone(155, 150, 0.32, 0.12, 'square');
  }

  /** Senha certa: trava abrindo (dois tons e um estalo). */
  granted() {
    this.tone(660, 660, 0.09, 0.14, 'square');
    setTimeout(() => this.tone(990, 990, 0.14, 0.14, 'square'), 110);
    setTimeout(() => this.burst({ dur: 0.05, type: 'highpass', freq: 1500, gain: 0.3, attack: 0.002, release: 0.03 }), 260);
  }

  /** Móvel pesado arrastado no chão (geladeira deslizando), com a batida no fim. */
  scrape(ms: number) {
    const b = this.burst({ dur: ms / 1000, type: 'lowpass', freq: 380, freq2: 240, q: 1.4, gain: 0.55, attack: 0.18, release: 0.2 });
    if (!b) return;
    // trepida enquanto arrasta
    for (let i = 0; i < 14; i++) b.g.gain.setValueAtTime(i % 2 ? 0.3 : 0.55, b.t + 0.2 + (i / 14) * (ms / 1000 - 0.4));
    this.burst({ dur: ms / 1000, type: 'bandpass', freq: 1400, freq2: 900, q: 2, gain: 0.08, attack: 0.2, release: 0.2 });
    setTimeout(() => {
      this.tone(90, 50, 0.22, 0.5);
      this.burst({ dur: 0.08, type: 'lowpass', freq: 500, gain: 0.35, attack: 0.003, release: 0.06 });
    }, ms - 60);
  }
}

export const sfx = new Sfx();
