import type { Clima, Universo } from './entradaCena';

/**
 * A trilha da tela de entrada, sintetizada na hora (Web Audio, sem arquivos), como os sons de
 * sfx.ts: um tema de aventura por universo e o som do ambiente da cena sorteada.
 *
 * - **As músicas:** cada universo tem uma lista e uma é sorteada a cada visita (`?musica=2` escolhe).
 *   Fantasia: a Taverna (alaúde e flauta) e a Marcha dos Heróis (synthwave de aventura). Horror: a
 *   Maré Negra (coro grave e zumbido). Cyberpunk: o Neon Noir (techno sombrio em mi frígio, 112 BPM,
 *   baixo rolando "bombeado" pelo bumbo, riff cortado) e o Overclock (drum & bass hi-tech a 172 BPM:
 *   baixo reese com wobble e distorção, arpejos de bipes, lasers, rufo de caixa e glitch). Oito
 *   compassos que se repetem, com variação a cada volta. De
 *   noite o som fica mais escuro; de dia, mais aberto.
 * - **O ambiente:** a chuva, o trovão em cada relâmpago, o vento na neve e na neblina, o estalar
 *   da vela acesa (no cyberpunk, o zumbido do neon) e os passarinhos de dia.
 *
 * O navegador só deixa tocar depois do primeiro toque ou tecla na página. A escolha (ligada ou
 * desligada) fica neste aparelho.
 */

const CHAVE = 'crona.entrada.musica';
const CHAVE_VOLUME = 'crona.entrada.volume';
/** o volume de 0 a 1 vira o ganho do som (1 = o mais alto, ainda sem distorcer) */
const GANHO = 1;

type Nota = [midi: number | null, tempos: number];
type Timbre = 'flauta' | 'caixinha' | 'neon' | 'coro' | 'riff';
interface Tema {
  nome: string;
  bpm: number;
  acordes: string[];
  melodia: Nota[];
  timbre: Timbre;
  /** o acompanhamento: arpejo subindo (alaúde), caixinha (agudo e lento), o baixo pulsando em
   * colcheias com um arpejo de bipes (synthwave), o baixo rolando em semicolcheias com estacas de
   * acorde (techno), o baixo "reese" com wobble, arpejos rápidos e lasers (drum & bass) ou só o
   * acorde */
  arpejo: 'subindo' | 'caixinha' | 'pulso' | 'rolando' | 'agressivo' | 'nenhum';
  tambor?: boolean;
  /** bateria de pista (bumbo em todo tempo, palma no 2 e no 4, chimbal em semicolcheias) ou
   * drum & bass (bumbo quebrado, caixa seca no 2 e no 4 com caixas fantasma, rufo no fim) */
  estilo?: 'techno' | 'dnb';
  /** o acorde e o baixo abaixam a cada bumbo (compressão "bombeada" das músicas eletrônicas) */
  bombeado?: boolean;
  /** nota grave que fica soando por baixo (o zumbido do horror) */
  zumbido?: number;
}

const NOTAS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'C#5' → 73 */
function midi(n: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
  if (!m) throw new Error(`nota ${n}`);
  return 12 * (Number(m[3]) + 1) + NOTAS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
/** 'A4:1 D5:.5 -:1' → notas (o '-' é pausa) */
function frase(s: string): Nota[] {
  return s
    .split(/\s+/)
    .filter((p) => p && p !== '|')
    .map((p) => {
      const [n, t] = p.split(':');
      return [n === '-' ? null : midi(n), Number(t)];
    });
}
/** 'Dm' → as notas do acorde perto do Dó central */
function acorde(nome: string): number[] {
  const m = /^([A-G][#b]?)(m|dim|sus2)?$/.exec(nome);
  if (!m) throw new Error(`acorde ${nome}`);
  const raiz = midi(`${m[1]}3`);
  const terca = m[2] === 'm' || m[2] === 'dim' ? 3 : m[2] === 'sus2' ? 2 : 4;
  const quinta = m[2] === 'dim' ? 6 : 7;
  return [raiz, raiz + terca, raiz + quinta];
}

/**
 * As músicas de cada universo: uma é sorteada a cada visita (`?musica=1`, `?musica=2` escolhe).
 * Novas entram no fim da lista do universo.
 */
const TEMAS: Record<Universo, Tema[]> = {
  fantasia: [
    {
      nome: 'Taverna',
      bpm: 88,
      acordes: ['Dm', 'C', 'Bb', 'C', 'Dm', 'F', 'C', 'A'],
      melodia: frase(`A4:1 D5:1 E5:1 F5:1 | E5:1.5 D5:.5 C5:1 E5:1 | D5:2 F5:1 D5:1 | C5:1 D5:1 E5:2 |
        F5:1 E5:.5 D5:.5 A5:2 | G5:1 F5:1 E5:1 C5:1 | D5:1.5 E5:.5 C5:1 G4:1 | A4:2 C#5:1 E5:1`),
      timbre: 'flauta',
      arpejo: 'subindo',
    },
    {
      // era a "synthwave" do cyberpunk: com a cara de aventura, ficou na fantasia
      nome: 'Marcha dos Heróis',
      bpm: 96,
      acordes: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'],
      melodia: frase(`E5:1.5 A5:.5 G5:1 E5:1 | F5:1.5 E5:.5 C5:2 | E5:1 G5:1 C6:1.5 B5:.5 | B5:2 D5:1 G5:1 |
        A5:1 G5:.5 E5:.5 A5:2 | C6:1 A5:1 F5:1 A5:1 | G5:1.5 E5:.5 G5:1 C6:1 | B5:3 -:1`),
      timbre: 'neon',
      arpejo: 'pulso',
      tambor: true,
    },
  ],
  horror: [
    {
      nome: 'Maré Negra',
      bpm: 54,
      acordes: ['Am', 'F', 'Dm', 'E', 'Am', 'F', 'Dm', 'E'],
      melodia: frase(`E5:3 F5:1 | E5:2 C5:2 | D5:3 F5:1 | E5:2 G#4:2 |
        A4:2 B4:1 C5:1 | D#5:2 E5:2 | F5:2 D5:1 B4:1 | G#4:4`),
      timbre: 'coro',
      arpejo: 'nenhum',
      zumbido: midi('A1'),
    },
  ],
  cyberpunk: [
    {
      // techno sombrio: mi frígio (o semitom que aperta), 112 BPM, bumbo em todo tempo, baixo
      // rolando em semicolcheias, "bombeado" pelo bumbo, riff curto e cortado, glitch no fim da frase
      nome: 'Neon Noir',
      bpm: 112,
      acordes: ['Em', 'F', 'Em', 'C', 'Em', 'F', 'Dm', 'Em'],
      melodia: frase(`E4:.5 E4:.25 G4:.25 E4:.5 B4:.5 A4:.5 G4:.5 E4:1 |
        F4:.5 F4:.25 A4:.25 F4:.5 C5:.5 Bb4:.5 A4:.5 F4:1 |
        E4:.5 E4:.25 G4:.25 E4:.5 B4:.5 D5:.5 B4:.5 G4:1 |
        C5:.5 C5:.25 B4:.25 G4:.5 E4:.5 G4:1 -:1 |
        E4:.5 E4:.25 G4:.25 E4:.5 B4:.5 A4:.5 G4:.5 E4:1 |
        F4:.5 F4:.25 A4:.25 F4:.5 C5:.5 D5:.5 C5:.5 A4:1 |
        D5:.5 D5:.25 C5:.25 A4:.5 F4:.5 A4:.5 G4:.5 F4:1 |
        E5:.5 B4:.5 G4:.5 B4:.5 E5:1 -:1`),
      timbre: 'riff',
      arpejo: 'rolando',
      tambor: true,
      estilo: 'techno',
      bombeado: true,
    },
    {
      // hi-tech agressivo: drum & bass a 172 BPM, baixo "reese" com wobble e distorção, arpejos de
      // bipes em semicolcheias com saltos aleatórios, estacas, lasers, riff distorcido em fá
      // menor, rufo de caixa e glitch no fim da frase
      nome: 'Overclock',
      bpm: 172,
      acordes: ['Fm', 'Gb', 'Fm', 'Db', 'Fm', 'Gb', 'Bbm', 'C'],
      melodia: frase(`F4:.25 F4:.25 Ab4:.25 F4:.25 C5:.5 Bb4:.25 Ab4:.25 F4:.5 Gb4:.25 F4:.25 F4:1 |
        Gb4:.25 Gb4:.25 Bb4:.25 Gb4:.25 Db5:.5 C5:.25 Bb4:.25 Gb4:.5 Ab4:.25 Gb4:.25 Gb4:1 |
        F4:.25 F4:.25 Ab4:.25 F4:.25 C5:.5 Eb5:.25 C5:.25 Ab4:.5 F4:.5 -:1 |
        Db5:.25 Db5:.25 C5:.25 Ab4:.25 F4:.5 Ab4:.5 C5:.5 Db5:.5 Eb5:1 |
        F4:.25 F4:.25 Ab4:.25 F4:.25 C5:.5 Bb4:.25 Ab4:.25 F4:.5 Gb4:.25 F4:.25 F4:1 |
        Gb4:.25 Gb4:.25 Bb4:.25 Gb4:.25 Db5:.5 Eb5:.25 Db5:.25 Bb4:.5 Gb4:.5 -:1 |
        Bb4:.25 Bb4:.25 Db5:.25 Bb4:.25 F5:.5 Eb5:.25 Db5:.25 Bb4:.5 C5:.25 Db5:.25 Eb5:1 |
        C5:.5 E5:.5 G5:.5 E5:.5 C5:.25 C5:.25 C5:.25 C5:.25 -:1`),
      timbre: 'riff',
      arpejo: 'agressivo',
      tambor: true,
      estilo: 'dnb',
      bombeado: true,
    },
  ],
};

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Trilha {
  /** ligada (a escolha deste aparelho) */
  ligada = true;
  /** o volume, de 0 a 1 (também guardado no aparelho) */
  volume = 0.7;
  /** o som começou ou parou (o navegador liberou, ou segurou) */
  aoMudarEstado: () => void = () => {};
  private ac: AudioContext | null = null;
  private mestre: GainNode | null = null;
  private musica: GainNode | null = null;
  private filtro: BiquadFilterNode | null = null;
  private eco: ConvolverNode | null = null;
  private atraso: DelayNode | null = null;
  private ruido: AudioBuffer | null = null;
  private relogio = 0;
  private proximoCompasso = 0;
  private compasso = 0;
  private volta = 0;
  private proximoEstalo = 0;
  private proximoPassaro = 0;
  private tema: Tema;
  /** qual música da lista do universo (1, 2...) */
  readonly indice: number;
  private tonal: GainNode | null = null;
  /** o controle do volume da chuva e do vento (muda com o clima) */
  private gChuva: GainNode | null = null;
  private gVento: GainNode | null = null;
  private luzDia = 0;
  private velaAcesa = true;
  private fechada = false;

  constructor(
    private universo: Universo,
    private clima: Clima,
    /** a música pedida (1, 2...); sem ela, sorteia */
    pedida?: number,
  ) {
    const lista = TEMAS[universo];
    const i = pedida && pedida >= 1 && pedida <= lista.length ? pedida - 1 : Math.floor(Math.random() * lista.length);
    this.indice = i + 1;
    this.tema = lista[i];
    try {
      this.ligada = localStorage.getItem(CHAVE) !== '0';
      const v = Number(localStorage.getItem(CHAVE_VOLUME));
      if (localStorage.getItem(CHAVE_VOLUME) !== null && Number.isFinite(v)) this.volume = Math.min(1, Math.max(0, v));
    } catch {
      /* sem storage */
    }
  }

  /** Muda o volume (0 a 1). Subir do zero liga a música; ir a zero não desliga, só cala. */
  ajustarVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    try {
      localStorage.setItem(CHAVE_VOLUME, String(Math.round(this.volume * 100) / 100));
    } catch {
      /* sem storage */
    }
    if (this.volume > 0 && !this.ligada) this.alternar();
    else if (this.ligada) this.comecar(0.15);
  }

  /** o nome da música desta visita */
  get nome() {
    return this.tema.nome;
  }

  get tocando() {
    return !!this.ac && this.ac.state === 'running' && this.ligada;
  }

  /** Liga ou desliga (e guarda a escolha). */
  alternar(): boolean {
    this.ligada = !this.ligada;
    try {
      localStorage.setItem(CHAVE, this.ligada ? '1' : '0');
    } catch {
      /* sem storage */
    }
    if (this.ligada) this.comecar();
    else this.calar(0.4);
    return this.ligada;
  }

  /** Começa (chamado num toque ou tecla, quando o navegador deixa); `subida` em segundos. */
  comecar(subida = 3) {
    if (!this.ligada || this.fechada) return;
    if (!this.ac) this.montar();
    const ac = this.ac;
    if (!ac || !this.mestre) return;
    if (ac.state === 'suspended') void ac.resume();
    const t = ac.currentTime;
    this.mestre.gain.cancelScheduledValues(t);
    this.mestre.gain.setValueAtTime(this.mestre.gain.value, t);
    this.mestre.gain.linearRampToValueAtTime(this.volume * GANHO, t + subida);
    if (!this.relogio) {
      this.proximoCompasso = t + 0.3;
      this.relogio = window.setInterval(() => this.agendar(), 90);
    }
  }

  /** A luz da cena: de noite a música fica mais escura. */
  luz(dia: number, vela: boolean) {
    this.luzDia = dia;
    this.velaAcesa = vela;
    if (this.filtro && this.ac) this.filtro.frequency.setTargetAtTime(1500 + 5000 * dia, this.ac.currentTime, 1.5);
  }

  /** Abaixa até sumir (`fechar` desliga de vez, ao sair da tela). */
  calar(segundos = 1, fechar = false) {
    const ac = this.ac;
    if (fechar) this.fechada = true;
    if (!ac || !this.mestre) return;
    const t = ac.currentTime;
    this.mestre.gain.cancelScheduledValues(t);
    this.mestre.gain.setValueAtTime(this.mestre.gain.value, t);
    this.mestre.gain.linearRampToValueAtTime(0, t + segundos);
    if (!fechar) return;
    setTimeout(() => {
      clearInterval(this.relogio);
      this.relogio = 0;
      void ac.close();
      this.ac = null;
    }, segundos * 1000 + 200);
  }

  // ---------------------------------------------------------------- o som da cena

  /**
   * O trovão, `perto` de 0 a 1: o estalo que rasga (quando é perto), o ronco que rola e vai
   * descendo do médio para o grave, e uma camada bem grave para quem tem caixa de som boa.
   * O médio é o que se ouve na caixinha do celular e do notebook. A música abaixa enquanto ele
   * ressoa.
   */
  trovao(perto = Math.random()) {
    const ac = this.ac;
    if (!ac || !this.mestre || !this.ruido || !this.tocando) return;
    // a luz chega antes do som: quanto mais longe, mais demora
    const t = ac.currentTime + 0.12 + (1 - perto) * 1.1;
    const forca = 0.55 + 0.45 * perto;
    const dur = 3.2 + 2.2 * perto;
    // o estalo: dois rasgos curtos e agudos
    if (perto > 0.35) {
      this.rajada(t, 0.4, 'highpass', 1200, 1.1 * forca, 0.002, 0.3);
      this.rajada(t + 0.07, 0.5, 'bandpass', 2400, 0.7 * forca, 0.002, 0.4);
    }
    // o ronco: ruído em laço, num filtro que desce de 900 para 220 Hz, rolando em ondas
    const src = ac.createBufferSource();
    src.buffer = this.ruido;
    src.loop = true;
    src.playbackRate.value = 0.7 + Math.random() * 0.2;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 0.9;
    f.frequency.setValueAtTime(900 * (0.7 + 0.3 * perto), t);
    f.frequency.exponentialRampToValueAtTime(220, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(2.6 * forca, t + 0.12 + (1 - perto) * 0.4);
    g.gain.exponentialRampToValueAtTime(1.2 * forca, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    // as ondas: três tremores lentos somados, cada trovão de um jeito
    const ondas = ac.createGain();
    ondas.gain.value = 1;
    for (const [freq, prof] of [
      [1.3 + Math.random(), 0.35],
      [3 + Math.random() * 2, 0.25],
      [7 + Math.random() * 4, 0.15],
    ]) {
      const lfo = ac.createOscillator();
      lfo.frequency.value = freq;
      const p = ac.createGain();
      p.gain.value = prof;
      lfo.connect(p).connect(ondas.gain);
      lfo.start(t);
      lfo.stop(t + dur + 0.2);
    }
    src.connect(f).connect(ondas).connect(g).connect(this.mestre);
    g.connect(this.eco!);
    src.start(t, Math.random() * 2);
    src.stop(t + dur + 0.2);
    // a camada bem grave
    this.rajada(t + 0.05, dur, 'lowpass', 110, 1.4 * forca, 0.2, dur * 0.8);
    // a música abaixa e volta
    if (this.musica) {
      const m = this.musica.gain;
      m.cancelScheduledValues(t);
      m.setValueAtTime(m.value, t);
      m.linearRampToValueAtTime(0.35, t + 0.2);
      m.linearRampToValueAtTime(0.85, t + dur);
    }
  }

  // ---------------------------------------------------------------- por dentro

  private montar() {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    this.ac = ac;
    // o navegador pode segurar o som até o primeiro toque: quem mostra o botão fica sabendo
    ac.onstatechange = () => this.aoMudarEstado();
    this.mestre = ac.createGain();
    this.mestre.gain.value = 0;
    const compressor = ac.createDynamicsCompressor();
    compressor.threshold.value = -8;
    compressor.knee.value = 6;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.25;
    this.mestre.connect(compressor).connect(ac.destination);
    // o ruído (chuva, vento, trovão, estalos, tambor)
    const len = ac.sampleRate * 3;
    this.ruido = ac.createBuffer(1, len, ac.sampleRate);
    const d = this.ruido.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // o salão: um eco longo, feito de ruído que morre devagar
    this.eco = ac.createConvolver();
    const ir = ac.createBuffer(2, ac.sampleRate * 2.6, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 2.6);
    }
    this.eco.buffer = ir;
    const ecoVolta = ac.createGain();
    ecoVolta.gain.value = 0.55;
    this.eco.connect(ecoVolta).connect(this.mestre);
    // a música passa por um filtro que segue a luz da cena
    this.musica = ac.createGain();
    this.musica.gain.value = 0.85;
    this.filtro = ac.createBiquadFilter();
    this.filtro.type = 'lowpass';
    this.filtro.frequency.value = 1500 + 5000 * this.luzDia;
    // o que é tom (acordes, baixo, melodia) passa por um ganho que o bumbo abaixa (o "bombeado")
    this.tonal = ac.createGain();
    this.tonal.connect(this.musica);
    this.musica.connect(this.filtro);
    this.filtro.connect(this.mestre);
    this.filtro.connect(this.eco);
    // o eco da melodia (repete atrás, mais baixo)
    this.atraso = ac.createDelay(1);
    this.atraso.delayTime.value = (60 / this.tema.bpm) * 0.75;
    const volta = ac.createGain();
    volta.gain.value = 0.28;
    this.atraso.connect(volta).connect(this.atraso);
    volta.connect(this.filtro);
    // o ambiente
    // (a chuva e o vento sempre existem, com volume zero quando o clima não os tem: assim o clima
    // pode mudar ao vivo)
    this.gChuva = this.laco('bandpass', 2200, 0.6, this.nivelChuva(), this.mestre);
    if (this.universo === 'cyberpunk') {
      // o zumbido baixinho do letreiro de neon
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 120;
      const f = ac.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1200;
      f.Q.value = 3;
      const g = ac.createGain();
      g.gain.value = 0.012;
      o.connect(f).connect(g).connect(this.mestre);
      o.start();
    }
    // o vento sobe e desce (um tremor lento no volume, depois do controle do clima)
    const sobeDesce = ac.createGain();
    sobeDesce.gain.value = 0.65;
    sobeDesce.connect(this.mestre);
    const lfo = ac.createOscillator();
    const prof = ac.createGain();
    lfo.frequency.value = 0.07;
    prof.gain.value = 0.35;
    lfo.connect(prof).connect(sobeDesce.gain);
    lfo.start();
    this.gVento = this.laco('bandpass', 420, 1.2, this.nivelVento(), sobeDesce);
  }

  /** O clima mudou ao vivo: a chuva e o vento sobem ou descem sem corte. */
  mudarClima(clima: Clima) {
    this.clima = clima;
    const ac = this.ac;
    if (!ac) return;
    this.gChuva?.gain.setTargetAtTime(this.nivelChuva(), ac.currentTime, 1.2);
    this.gVento?.gain.setTargetAtTime(this.nivelVento(), ac.currentTime, 1.2);
  }

  private nivelChuva() {
    return this.clima === 'tempestade' ? 0.16 : this.clima === 'chuva' ? 0.11 : 0;
  }
  private nivelVento() {
    return this.clima === 'neve' || this.clima === 'neblina' || this.clima === 'tempestade' ? 0.07 : 0;
  }

  /** Ruído em laço, filtrado (a chuva, o vento). */
  private laco(tipo: BiquadFilterType, freq: number, q: number, volume: number, destino: AudioNode): GainNode | null {
    const ac = this.ac;
    if (!ac || !this.ruido) return null;
    const src = ac.createBufferSource();
    src.buffer = this.ruido;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = tipo;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ac.createGain();
    g.gain.value = volume;
    src.connect(f).connect(g).connect(destino);
    src.start();
    return g;
  }

  /** Uma rajada de ruído com envelope (estalo, ronco, tambor). */
  private rajada(t: number, dur: number, tipo: BiquadFilterType, freq: number, volume: number, ataque: number, queda: number, destino?: AudioNode) {
    const ac = this.ac;
    if (!ac || !this.ruido || !this.mestre) return null;
    const src = ac.createBufferSource();
    src.buffer = this.ruido;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ac.createBiquadFilter();
    f.type = tipo;
    f.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + queda);
    src.connect(f).connect(g).connect(destino ?? this.mestre);
    src.start(t, Math.random() * 2);
    src.stop(t + dur + 0.1);
    return g;
  }

  /** Agenda o que toca nos próximos instantes (o relógio roda a cada 90 ms). */
  private agendar() {
    const ac = this.ac;
    if (!ac || ac.state !== 'running') return;
    const tema = this.tema;
    const tempo = 60 / tema.bpm;
    // o navegador segurou o som e soltou agora: começa do compasso de agora, sem atropelar
    if (this.proximoCompasso < ac.currentTime - 0.05) this.proximoCompasso = ac.currentTime + 0.1;
    while (this.proximoCompasso < ac.currentTime + 0.4) {
      this.tocarCompasso(this.proximoCompasso, tempo);
      this.proximoCompasso += tempo * 4;
      this.compasso = (this.compasso + 1) % tema.acordes.length;
      if (this.compasso === 0) this.volta++;
    }
    this.ambiente(ac.currentTime);
  }

  private tocarCompasso(t: number, tempo: number) {
    const tema = this.tema;
    const k = this.compasso;
    const notas = acorde(tema.acordes[k]);
    const dur = tempo * 4;
    // o acorde por baixo e o baixo
    if (tema.arpejo === 'agressivo') for (const n of notas) this.pad(n, t, dur, 0.012);
    else {
      for (const n of notas) this.pad(n, t, dur, tema.timbre === 'coro' ? 0.04 : 0.024);
      this.baixo(notas[0] - 12, t, dur);
    }
    if (tema.zumbido && k === 0) this.pad(tema.zumbido, t, dur * tema.acordes.length, 0.06);
    // o acompanhamento
    if (tema.arpejo === 'subindo')
      for (let i = 0; i < 8; i++) {
        const n = notas[i % 3] + 12 * (1 + Math.floor(i / 3) % 2);
        this.dedilhado(n, t + i * tempo * 0.5, 0.035);
      }
    else if (tema.arpejo === 'caixinha') for (let i = 0; i < 4; i++) this.dedilhado(notas[(i * 2) % 3] + 24, t + i * tempo, 0.035, 1.6);
    else if (tema.arpejo === 'pulso') {
      // o baixo em colcheias, oitava acima e abaixo; por cima, bipes em semicolcheias
      for (let i = 0; i < 8; i++) this.pulso(notas[0] - 12 + (i % 2 ? 12 : 0), t + i * tempo * 0.5, tempo * 0.45);
      for (let i = 0; i < 16; i++) this.dedilhado(notas[i % 3] + 24 + (i % 4 === 3 ? 12 : 0), t + i * tempo * 0.25, 0.014, 0.22);
    }
    else if (tema.arpejo === 'rolando') {
      // o baixo rolando em semicolcheias (uma oitava acima em alguns passos) e as estacas
      // sincopadas do acorde; o "bombeado" abre espaço para o bumbo
      const grave = notas[0] - 12;
      for (let i = 0; i < 16; i++) {
        const nota = grave + (i % 8 === 6 ? 12 : i % 8 === 3 ? 7 : 0);
        this.pulso(nota, t + i * tempo * 0.25, tempo * 0.22, i % 4 === 0 ? 0.11 : 0.08);
      }
      for (const passo of [3, 6, 10, 14]) this.estaca(notas, t + passo * tempo * 0.25, tempo * 0.2);
      // o último compasso da frase: a subida de ruído e, no fim, o glitch
      if (k === 7) {
        this.subida(t, dur);
        this.glitch(t + tempo * 3, tempo);
      }
    } else if (tema.arpejo === 'agressivo') {
      const passo = tempo * 0.25;
      // o baixo reese: a raiz por quase toda a barra e, nas barras ímpares, a quinta no último tempo
      const grave = notas[0] - 12;
      this.reese(grave, t, tempo * (k % 2 ? 3 : 4) - 0.02);
      if (k % 2) this.reese(grave + 7, t + tempo * 3, tempo - 0.02);
      // o arpejo de bipes em semicolcheias, subindo e descendo duas oitavas; de vez em quando pula
      // uma oitava ou cala (cada volta sai diferente)
      const seq = [0, 1, 2, 0, 1, 2, 1, 0];
      for (let i = 0; i < 16; i++) {
        if (Math.random() < 0.16) continue;
        const grau = seq[i % 8];
        const nota = notas[grau % 3] + 24 + (i % 8 >= 3 && i % 8 < 6 ? 12 : 0) + (Math.random() < 0.14 ? 12 : 0);
        this.bipe(nota, t + i * passo, passo * 0.8, i % 4 === 0 ? 0.022 : 0.015);
      }
      // os bipes de dados: agudos, soltos, ao acaso
      for (let i = 0; i < 16; i++)
        if (Math.random() < 0.28) this.bipe(notas[Math.floor(Math.random() * 3)] + 48 + (Math.random() < 0.5 ? 0 : 7), t + i * passo, passo * 0.35, 0.012);
      // as estacas sincopadas do acorde e o laser caindo a cada duas barras
      for (const p of [3, 6, 11, 14]) this.estaca(notas, t + p * passo, passo * 1.6);
      if (k % 2 === 0) this.laser(t);
      // o último compasso da frase: a subida de ruído e o glitch
      if (k === 7) {
        this.subida(t, dur);
        this.glitch(t + tempo * 3, tempo);
      }
    } else if (Math.random() < 0.5) this.dedilhado(notas[2] + 12, t + tempo * 2, 0.04, 2.2);
    if (tema.bombeado && tema.estilo !== 'dnb')
      for (let i = 0; i < 4; i++) {
        const g = this.tonal!.gain;
        g.setValueAtTime(0.25, t + i * tempo);
        g.linearRampToValueAtTime(1, t + i * tempo + tempo * 0.7);
      }
    if (tema.estilo === 'dnb') {
      const passo = tempo * 0.25;
      // o bumbo quebrado: 1 e o "e" do 3 (e, nas barras ímpares, um extra); o último compasso da
      // frase não tem bumbo na metade final (entra o rufo)
      const chutes = k % 2 ? [0, 6, 10] : [0, 10];
      for (const c of chutes) {
        if (k === 7 && c >= 8) continue;
        this.tambor(t + c * passo, 'bumbo', 1.25);
        const g = this.tonal!.gain;
        g.setValueAtTime(0.18, t + c * passo);
        g.linearRampToValueAtTime(1, t + c * passo + tempo * 0.55);
      }
      // a caixa seca no 2 e no 4, com as caixas fantasma entre elas
      if (k !== 7) {
        this.tambor(t + 4 * passo, 'caixa', 1.3);
        this.tambor(t + 12 * passo, 'caixa', 1.3);
        for (const f of [7, 14, 15]) if (Math.random() < 0.75) this.tambor(t + f * passo, 'caixa', 0.4);
      } else {
        // o rufo: caixa em toda semicolcheia da segunda metade, cada vez mais forte
        this.tambor(t + 4 * passo, 'caixa', 1.3);
        for (let i = 8; i < 16; i++) this.tambor(t + i * passo, 'caixa', 0.35 + 0.1 * (i - 8));
      }
      // o chimbal: fechado em toda semicolcheia, aberto no contratempo
      for (let i = 0; i < 16; i++) this.tambor(t + i * passo, i % 4 === 2 ? 'aberto' : 'chocalho', i % 2 ? 0.7 : 1);
    } else if (tema.estilo === 'techno') {
      // bateria de pista: bumbo em todo tempo, palma no 2 e no 4, chimbal aberto no contratempo
      // e fechado nas semicolcheias
      for (let i = 0; i < 4; i++) this.tambor(t + i * tempo, 'bumbo');
      this.tambor(t + tempo, 'caixa');
      this.tambor(t + tempo * 3, 'caixa');
      for (let i = 0; i < 16; i++) this.tambor(t + i * tempo * 0.25, i % 4 === 2 ? 'aberto' : 'chocalho');
    } else if (tema.tambor) {
      // bateria eletrônica: bumbo no 1 e no 3, palma no 2 e no 4, chimbal em colcheias
      this.tambor(t, 'bumbo');
      this.tambor(t + tempo * 2, 'bumbo');
      if (k % 2 === 1) this.tambor(t + tempo * 3.5, 'bumbo');
      this.tambor(t + tempo, 'caixa');
      this.tambor(t + tempo * 3, 'caixa');
      for (let i = 0; i < 8; i++) this.tambor(t + i * tempo * 0.5, 'chocalho');
    }
    // a melodia: na terceira volta descansa (só o acompanhamento), na segunda sobe uma oitava
    if (this.volta % 4 === 2) return;
    const oitava = this.volta % 4 === 1 && tema.timbre !== 'caixinha' ? 12 : 0;
    const inicio = k * 4;
    let pos = 0;
    for (const [n, tempos] of tema.melodia) {
      if (pos >= inicio && pos < inicio + 4 && n !== null) this.voz(n + oitava, t + (pos - inicio) * tempo, tempos * tempo);
      pos += tempos;
    }
  }

  /** Um acorde sustentado: dois serrotes levemente desafinados, filtrados. */
  private pad(n: number, t: number, dur: number, vol: number) {
    const ac = this.ac!;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(1, dur * 0.3));
    g.gain.setValueAtTime(vol, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    for (const det of [-7, 7]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(n);
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.7);
    }
    f.connect(g).connect(this.tonal!);
  }

  private baixo(n: number, t: number, dur: number) {
    const ac = this.ac!;
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = hz(n);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.075, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.02, t + dur * 0.9);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.tonal!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** A distorção (saturação dura): a entrada passa por um "waveshaper" e a saída volta. */
  private curva: Float32Array<ArrayBuffer> | null = null;
  private distorcer(entrada: AudioNode, quanto = 40): AudioNode {
    const ac = this.ac!;
    const ws = ac.createWaveShaper();
    if (!this.curva) {
      const n = 2048;
      const c = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i * 2) / (n - 1) - 1;
        c[i] = ((Math.PI + quanto) * x) / (Math.PI + quanto * Math.abs(x));
      }
      this.curva = c;
    }
    ws.curve = this.curva;
    ws.oversample = '2x';
    entrada.connect(ws);
    return ws;
  }

  /** O baixo "reese": dois serrotes desafinados num filtro que balança (wobble, no andamento da
   * música), sujo de distorção. */
  private reese(n: number, t: number, dur: number, vol = 0.07) {
    const ac = this.ac!;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 7;
    f.frequency.value = 650;
    const lfo = ac.createOscillator();
    lfo.frequency.value = (this.tema.bpm / 60) * 2;
    const prof = ac.createGain();
    prof.gain.value = 520;
    lfo.connect(prof).connect(f.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
    for (const det of [-16, 16]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(n);
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.setValueAtTime(vol, t + Math.max(0.02, dur - 0.03));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    this.distorcer(f, 30).connect(g);
    g.connect(this.tonal!);
  }

  /** Um bipe de dados: onda quadrada curtinha. */
  private bipe(n: number, t: number, dur: number, vol: number) {
    const ac = this.ac!;
    const o = ac.createOscillator();
    o.type = 'square';
    o.frequency.value = hz(n);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 5200;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.03, dur));
    o.connect(f).connect(g);
    g.connect(this.tonal!);
    g.connect(this.eco!);
    o.start(t);
    o.stop(t + Math.max(0.03, dur) + 0.02);
  }

  /** O laser: um serrote que despenca do agudo ao grave em um instante. */
  private laser(t: number) {
    const ac = this.ac!;
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(5200, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.24);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 6500;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.04, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(f).connect(g);
    g.connect(this.musica!);
    g.connect(this.eco!);
    o.start(t);
    o.stop(t + 0.3);
  }

  /** A estaca do techno: o acorde inteiro, serrote curto e brilhante, com eco. */
  private estaca(notas: number[], t: number, dur: number) {
    const ac = this.ac!;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(3600, t);
    f.frequency.exponentialRampToValueAtTime(700, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const n of notas)
      for (const det of [-8, 8]) {
        const o = ac.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(n + 12);
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 0.02);
      }
    f.connect(g);
    g.connect(this.tonal!);
    g.connect(this.eco!);
  }

  /** A falha digital no fim da frase: a mesma nota repetida cada vez mais rápida, caindo. */
  private glitch(t: number, tempo: number) {
    let quando = t;
    let passo = tempo * 0.25;
    for (let i = 0; i < 9; i++) {
      this.dedilhado(midi('E6') - i, quando, 0.02, 0.07);
      this.rajada(quando, 0.04, 'highpass', 6000, 0.03, 0.001, 0.025, this.musica!);
      quando += passo;
      passo *= 0.8;
    }
  }

  /** A subida de ruído que enche o último compasso antes de a frase recomeçar. */
  private subida(t: number, dur: number) {
    const ac = this.ac!;
    if (!this.ruido) return;
    const src = ac.createBufferSource();
    src.buffer = this.ruido;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + dur * 0.95);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.musica!);
    src.start(t, Math.random() * 2);
    src.stop(t + dur + 0.05);
  }

  /** O baixo de synthwave: serrote curto, filtrado, que pulsa. */
  private pulso(n: number, t: number, dur: number, vol = 0.09) {
    const ac = this.ac!;
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = hz(n);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1100, t);
    f.frequency.exponentialRampToValueAtTime(260, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.tonal!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** A corda beliscada (alaúde, harpa) ou a caixinha de música. */
  private dedilhado(n: number, t: number, vol: number, queda = 0.9) {
    const ac = this.ac!;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + queda);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(this.tema.timbre === 'caixinha' ? 6000 : 3200, t);
    f.frequency.exponentialRampToValueAtTime(700, t + queda * 0.7);
    const tipos: OscillatorType[] = this.tema.timbre === 'caixinha' ? ['sine', 'sine'] : ['triangle', 'square'];
    tipos.forEach((tipo, i) => {
      const o = ac.createOscillator();
      o.type = tipo;
      // a caixinha tem um harmônico agudo de metal
      o.frequency.value = hz(n) * (this.tema.timbre === 'caixinha' && i ? 4.01 : 1);
      const gi = ac.createGain();
      gi.gain.value = i ? (this.tema.timbre === 'caixinha' ? 0.25 : 0.18) : 1;
      o.connect(gi).connect(f);
      o.start(t);
      o.stop(t + queda + 0.05);
    });
    f.connect(g).connect(this.tonal!);
  }

  /** A melodia, no timbre do tema. */
  private voz(n: number, t: number, dur: number) {
    const ac = this.ac!;
    const timbre = this.tema.timbre;
    if (timbre === 'caixinha') return this.dedilhado(n, t, 0.09, Math.max(1.2, dur * 1.5));
    const g = ac.createGain();
    // o riff do techno é curto e cortado: some antes do fim da nota
    if (timbre === 'riff') dur *= 0.62;
    const vol = timbre === 'riff' ? 0.07 : timbre === 'neon' ? 0.075 : timbre === 'coro' ? 0.075 : 0.12;
    const ataque = timbre === 'coro' ? 0.35 : timbre === 'neon' ? 0.02 : timbre === 'riff' ? 0.004 : 0.06;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + ataque);
    g.gain.setValueAtTime(vol * 0.85, t + Math.max(ataque, dur - 0.08));
    g.gain.linearRampToValueAtTime(0.0001, t + dur + (timbre === 'coro' ? 0.6 : 0.12));
    const f = ac.createBiquadFilter();
    f.type = timbre === 'coro' ? 'bandpass' : 'lowpass';
    f.frequency.value = timbre === 'coro' ? 900 : timbre === 'neon' ? 2600 : timbre === 'riff' ? 2200 : 3000;
    f.Q.value = timbre === 'coro' ? 1.4 : timbre === 'riff' ? 5 : 0.7;
    // no riff o filtro "late": abre no ataque e fecha
    if (timbre === 'riff') {
      f.frequency.setValueAtTime(4200, t);
      f.frequency.exponentialRampToValueAtTime(900, t + Math.max(0.05, dur));
    }
    // o vibrato entra depois do ataque
    const lfo = ac.createOscillator();
    lfo.frequency.value = timbre === 'coro' ? 4.2 : 5.4;
    const prof = ac.createGain();
    prof.gain.setValueAtTime(0, t);
    prof.gain.linearRampToValueAtTime(timbre === 'riff' ? 0 : timbre === 'neon' ? 5 : 9, t + Math.min(0.4, dur));
    lfo.connect(prof);
    lfo.start(t);
    lfo.stop(t + dur + 0.7);
    const tipos: OscillatorType[] = timbre === 'flauta' ? ['triangle', 'sine'] : timbre === 'riff' ? ['sawtooth', 'square'] : ['sawtooth', 'sawtooth'];
    tipos.forEach((tipo, i) => {
      const o = ac.createOscillator();
      o.type = tipo;
      o.frequency.value = hz(n) * (timbre === 'flauta' && i ? 2 : 1);
      o.detune.value = timbre === 'coro' ? (i ? 9 : -9) : timbre === 'neon' ? (i ? 11 : -11) : timbre === 'riff' ? (i ? 7 : -7) : 0;
      prof.connect(o.detune);
      const gi = ac.createGain();
      gi.gain.value = i ? (timbre === 'neon' ? 0.8 : timbre === 'riff' ? 0.5 : 0.35) : 1;
      o.connect(gi).connect(f);
      o.start(t);
      o.stop(t + dur + 0.7);
    });
    if (this.tema.estilo === 'dnb') this.distorcer(f, 45).connect(g);
    else f.connect(g);
    g.connect(this.tonal!);
    g.connect(this.atraso!);
  }

  private tambor(t: number, tipo: 'bumbo' | 'caixa' | 'chocalho' | 'aberto', vol = 1) {
    const ac = this.ac!;
    if (tipo === 'aberto') return void this.rajada(t, 0.2, 'highpass', 6500, 0.045 * vol, 0.002, 0.13, this.musica!);
    if (tipo === 'chocalho') return void this.rajada(t, 0.08, 'highpass', 7000, 0.025 * vol, 0.002, 0.05, this.musica!);
    if (tipo === 'caixa') {
      // no drum & bass a caixa é seca (a reverberação borra a 172 BPM)
      const seca = this.tema.estilo === 'dnb';
      const g = this.rajada(t, seca ? 0.18 : 0.32, 'bandpass', seca ? 2100 : 1500, 0.16 * vol, 0.002, seca ? 0.12 : 0.26, this.musica!);
      if (g && this.eco && !seca) g.connect(this.eco);
      return;
    }
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.3);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35 * vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(this.musica!);
    o.start(t);
    o.stop(t + 0.5);
  }

  /** O ambiente que não é laço: o estalar da vela (ou o neon piscando) e os passarinhos de dia. */
  private ambiente(agora: number) {
    if (this.universo === 'cyberpunk') {
      // o neon dá um estalo elétrico de vez em quando
      if (agora > this.proximoEstalo) {
        this.proximoEstalo = agora + 3 + Math.random() * 7;
        this.rajada(agora + 0.05, 0.12, 'bandpass', 3200, 0.03, 0.002, 0.08);
      }
    } else if (this.velaAcesa && agora > this.proximoEstalo) {
      this.proximoEstalo = agora + 0.4 + Math.random() * 2.6;
      this.rajada(agora + 0.05, 0.03, 'bandpass', 2500 + Math.random() * 2500, 0.03 + Math.random() * 0.04, 0.001, 0.02);
    }
    const sol = this.luzDia > 0.6 && (this.clima === 'limpo' || this.clima === 'nuvens');
    if (sol && agora > this.proximoPassaro) {
      this.proximoPassaro = agora + 2.5 + Math.random() * 6;
      this.passarinho(agora + 0.1);
    }
  }

  /** Um canto curto: duas ou três notas que escorregam, bem agudas. */
  private passarinho(t: number) {
    const ac = this.ac!;
    const notas = 2 + Math.floor(Math.random() * 3);
    const base = 2600 + Math.random() * 1400;
    for (let i = 0; i < notas; i++) {
      const ti = t + i * (0.09 + Math.random() * 0.05);
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(base * (1 + Math.random() * 0.3), ti);
      o.frequency.exponentialRampToValueAtTime(base * (0.75 + Math.random() * 0.6), ti + 0.07);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, ti);
      g.gain.exponentialRampToValueAtTime(0.025, ti + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ti + 0.08);
      o.connect(g).connect(this.mestre!);
      g.connect(this.eco!);
      o.start(ti);
      o.stop(ti + 0.1);
    }
  }
}
