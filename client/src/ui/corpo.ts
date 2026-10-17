/**
 * O personagem grande da ficha (ao lado da lista de agentes): em pé, respira e
 * pisca. Tudo é desenhado uma vez (canvas); a respiração é uma animação do
 * navegador (transformação suave, sem redesenhar a cada quadro) e a piscada
 * só mostra, por um instante, a camada de olhos fechados já pronta embaixo.
 *
 * Respiração em duas camadas: o corpo inteiro parado e, por cima, a mesma
 * imagem só da cintura para cima (máscara com degradê), que sobe e desce a
 * partir da cintura. Pernas e pés ficam parados; peito, ombros e cabeça
 * respiram, e não aparece emenda (as duas camadas são a mesma imagem).
 *
 * Arte: `corpo.png` e `corpo-olhos-fechados.png` na pasta do personagem
 * (docs/CHECKLIST-TELA-FICHAS.md). Sem elas, usa o quadro parado da folha de
 * sprite e só respira: o quadro de olhos fechados da folha é outra pose (o
 * corpo balança entre os quadros), e trocar por ele faria o boneco tremer.
 */
import { portraitState, type CharacterDef, type DirKey, type PortraitState } from '@crona/shared';
import { breathKeyframes, breathMode, type BreathMode } from '../render/portrait';
import { framesFor, sprites } from '../render/sprites';
import { existeArte } from './icons';
import { reduced } from './motion';

/** Direções da folha na ordem das setas (frente-esquerda, frente-direita, costas...). */
const GIRO = [4, 2, 0, 6];
/** O giro com as poses do tabuleiro (uma imagem por direção): de frente, e dando a volta. */
const GIRO_POSES: DirKey[] = ['s', 'sw', 'w', 'nw', 'n', 'ne', 'e', 'se'];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Fonte {
  aberto: CanvasImageSource & { width: number; height: number };
  fechado: (CanvasImageSource & { width: number; height: number }) | null;
  /** altura da cintura, de baixo para cima (0..1) */
  cintura: number;
  /** pixel art: desenha sem suavizar */
  pixel: boolean;
  /**
   * A caixa comum de todas as direções (em pixels da arte), para o boneco ter o mesmo tamanho em todo giro (o Felipe,
   * 17/10: "padronizar a altura na rotação"). Sem ela, cada pose cabia na caixa sozinha e o boneco mudava de altura.
   */
  quadro?: { w: number; h: number; razao: number };
}

/** A pose recortada no desenho dela (sem a margem transparente da imagem), guardada por endereço. */
const recortes = new Map<string, Promise<HTMLCanvasElement | null>>();
function recortada(url: string): Promise<HTMLCanvasElement | null> {
  let p = recortes.get(url);
  if (!p) {
    p = imagem(url).then((im) => {
      if (!im) return null;
      const c = document.createElement('canvas');
      c.width = im.naturalWidth;
      c.height = im.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(im, 0, 0);
      const { data } = g.getImageData(0, 0, c.width, c.height);
      let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++)
          if (data[(y * c.width + x) * 4 + 3] > 16) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
      if (x1 < 0) return c;
      const r = document.createElement('canvas');
      r.width = x1 - x0 + 1;
      r.height = y1 - y0 + 1;
      r.getContext('2d')!.drawImage(c, x0, y0, r.width, r.height, 0, 0, r.width, r.height);
      return r;
    });
    recortes.set(url, p);
  }
  return p;
}

const artes = new Map<string, Promise<HTMLImageElement | null>>();
function imagem(url: string): Promise<HTMLImageElement | null> {
  let p = artes.get(url);
  if (!p) {
    p = new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = url;
    });
    artes.set(url, p);
  }
  return p;
}

/** Pasta do personagem no repositório (/arte/personagens/<pasta>/folha.webp). */
function pastaDe(def: CharacterDef | undefined): string | null {
  const m = def ? /^\/arte\/personagens\/([a-z0-9-]+)\//.exec(def.sheet) : null;
  return m ? `/arte/personagens/${m[1]}` : null;
}

/** A pintura do corpo (corpo.png) na ficha: desligada, a ficha usa o boneco do tabuleiro. */
const CORPO_PINTADO = false;

export class CorpoView {
  readonly el: HTMLElement;
  private base: HTMLCanvasElement;
  private peito: HTMLElement;
  private pilha: HTMLElement;
  private cvAberto: HTMLCanvasElement;
  private cvFechado: HTMLCanvasElement;
  private def: CharacterDef | undefined;
  private giro = 0;
  /** a pose do tabuleiro: armado e machucado como lá (o Felipe, 17/10: "se estiver armado no tabuleiro, na ficha também") */
  private estado: PortraitState = 'desarmado';
  private fonte: Fonte | null = null;
  private modo: BreathMode = 'calm';
  private anim: Animation | null = null;
  private piscar = 0;
  private vivo = true;
  private ro: ResizeObserver;
  private pedido = 0;

  constructor() {
    this.base = document.createElement('canvas');
    this.base.className = 'corpo-cv';
    this.cvAberto = document.createElement('canvas');
    this.cvAberto.className = 'corpo-cv';
    this.cvFechado = document.createElement('canvas');
    this.cvFechado.className = 'corpo-cv fechado';
    this.peito = document.createElement('div');
    this.peito.className = 'corpo-peito';
    this.peito.append(this.cvAberto, this.cvFechado);
    this.pilha = document.createElement('div');
    this.pilha.className = 'corpo-pilha';
    this.pilha.append(this.base, this.peito);
    this.el = document.createElement('div');
    this.el.className = 'corpo-fig';
    this.el.append(this.pilha);
    this.ro = new ResizeObserver(() => this.desenhar());
    this.ro.observe(this.el);
  }

  /** Troca o personagem (a respiração continua sem pulo quando é o mesmo). */
  setPersonagem(def: CharacterDef | undefined) {
    if (def?.id === this.def?.id && def?.sheet === this.def?.sheet && this.fonte) return;
    this.def = def;
    this.giro = 0;
    void this.carregar();
  }

  /** Respiração pela ficha: machucado, perturbado, PE baixo, morrendo. */
  setCondicoes(c: Parameters<typeof breathMode>[0]) {
    const m = breathMode(c);
    if (m === this.modo && this.anim) return;
    this.modo = m;
    this.respirar();
  }

  /** Armado (arma na mão) e machucado (menos da metade dos PV), como a peça no tabuleiro. */
  setEstado(armado: boolean, machucado: boolean) {
    const e = portraitState(armado, machucado);
    if (e === this.estado) return;
    this.estado = e;
    void this.carregar();
  }

  girar(passo: number) {
    const n = this.def?.poses ? GIRO_POSES.length : GIRO.length;
    this.giro = (this.giro + passo + n) % n;
    void this.carregar();
  }

  destruir() {
    this.vivo = false;
    this.ro.disconnect();
    this.anim?.cancel();
    clearTimeout(this.piscar);
  }

  private async carregar() {
    const pedido = ++this.pedido;
    const def = this.def;
    const pasta = pastaDe(def);
    let fonte: Fonte | null = null;
    // a pintura própria do corpo (corpo.png, do Códex, com cabeção) saiu (o Felipe, 14/10): a ficha mostra o mesmo
    // boneco que anda no tabuleiro, ampliado sem borrar; os retratos pintados das cartas continuam
    if (CORPO_PINTADO && pasta && this.giro === 0 && (await existeArte(`${pasta}/corpo.png`))) {
      const aberto = await imagem(`${pasta}/corpo.png`);
      if (aberto) {
        const fechado = (await existeArte(`${pasta}/corpo-olhos-fechados.png`)) ? await imagem(`${pasta}/corpo-olhos-fechados.png`) : null;
        fonte = { aberto, fechado, cintura: 0.47, pixel: false };
      }
    }
    // o boneco do tabuleiro: a pose da direção (tabuleiro-32bits, a mesma arte que anda na cena)
    // a pose do estado, ou a mais perto dela que existir (armado sem a machucada: a armada; sem nenhuma: a desarmada)
    const armado = this.estado.startsWith('armado');
    const ordem: PortraitState[] = [this.estado, portraitState(armado, false), portraitState(false, this.estado.endsWith('machucado')), 'desarmado'];
    const est = ordem.find((e) => def?.poses?.[e]);
    const poses = (est && def?.poses?.[est]) || Object.values(def?.poses ?? {})[0];
    // a escala sai sempre das desarmadas: o boneco não muda de tamanho ao sacar a arma
    const base = def?.poses?.desarmado ?? poses;
    if (!fonte && poses) {
      const url = poses[GIRO_POSES[this.giro % GIRO_POSES.length]] ?? poses.s ?? poses.se ?? Object.values(poses)[0];
      const aberto = url ? await recortada(url) : null;
      // a mesma escala em todas as direções: a caixa que cabe a maior delas
      const todas = (await Promise.all(Object.values(base ?? poses).map((u) => (u ? recortada(u) : null)))).filter((c): c is HTMLCanvasElement => !!c);
      const quadro = { w: Math.max(...todas.map((c) => c.width)), h: Math.max(...todas.map((c) => c.height)), razao: Math.min(...todas.map((c) => c.height / c.width)) };
      if (aberto) fonte = { aberto, fechado: null, cintura: 0.46, pixel: true, quadro };
    }
    // sem as poses: a folha de sprite antiga
    if (!fonte && def) {
      const lc = sprites.get(def.id)?.lc ?? (await sprites.load(def));
      const frames = lc ? framesFor(lc, GIRO[this.giro]) : null;
      const f0 = frames?.[0];
      if (f0) fonte = { aberto: f0.canvas, fechado: null, cintura: 0.46, pixel: true };
    }
    if (pedido !== this.pedido || !this.vivo) return;
    this.fonte = fonte;
    this.el.classList.toggle('sem-arte', !fonte);
    this.desenhar();
    this.respirar();
  }

  private desenhar() {
    const f = this.fonte;
    const W = this.el.clientWidth;
    const H = this.el.clientHeight;
    if (!f || W < 4 || H < 4) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    // cabe na caixa, pés embaixo; com as poses, a escala é a da caixa comum (o mesmo tamanho em todo giro)
    // a altura é a mesma em todas as direções: a maior que deixa a pose mais larga caber na caixa; a largura acompanha
    // a de cada pose
    const alvo = f.quadro ? Math.min(H, W * f.quadro.razao) : Math.min(H, (W * f.aberto.height) / f.aberto.width);
    const k = alvo / f.aberto.height;
    const w = Math.round(f.aberto.width * k);
    const h = Math.round(f.aberto.height * k);
    for (const cv of [this.base, this.cvAberto, this.cvFechado]) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
    }
    const pinta = (cv: HTMLCanvasElement, src: Fonte['aberto'] | null) => {
      const ctx = cv.getContext('2d')!;
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (!src) return;
      ctx.imageSmoothingEnabled = !f.pixel;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, 0, 0, cv.width, cv.height);
    };
    pinta(this.base, f.aberto);
    pinta(this.cvAberto, f.aberto);
    pinta(this.cvFechado, f.fechado);
    this.peito.style.setProperty('--cintura', `${Math.round(f.cintura * 100)}%`);
    this.pilha.style.width = this.peito.style.width = `${w}px`;
    this.pilha.style.height = this.peito.style.height = `${h}px`;
  }

  private respirar() {
    this.anim?.cancel();
    this.anim = null;
    clearTimeout(this.piscar);
    if (!this.fonte || reduced()) return;
    // fôlego do corpo: o peito sobe um pouco a partir da cintura
    const { frames, total } = breathKeyframes(this.modo, (b) => `scale(${(1 + 0.004 * b).toFixed(5)}, ${(1 + 0.0115 * b).toFixed(5)})`);
    this.anim = this.peito.animate(frames, { duration: total * 1000, iterations: Infinity, delay: -rand(0, total) * 1000 });
    if (this.fonte.fechado) this.agendarPiscada();
  }

  private agendarPiscada() {
    const t = BLINK[this.modo];
    this.piscar = window.setTimeout(() => {
      if (!this.vivo || !this.fonte?.fechado) return;
      if (!this.el.isConnected || document.hidden) return this.agendarPiscada();
      this.cvFechado.classList.add('on');
      window.setTimeout(() => {
        this.cvFechado.classList.remove('on');
        // às vezes duas seguidas
        if (Math.random() < 0.12) {
          window.setTimeout(() => {
            this.cvFechado.classList.add('on');
            window.setTimeout(() => (this.cvFechado.classList.remove('on'), this.agendarPiscada()), rand(...t.dur) * 1000);
          }, 150);
        } else this.agendarPiscada();
      }, rand(...t.dur) * 1000);
    }, rand(...t.every) * 1000);
  }
}

/** Piscadas por modo de respiração: intervalo e duração (s). */
const BLINK: Record<BreathMode, { every: [number, number]; dur: [number, number] }> = {
  calm: { every: [2.8, 6.4], dur: [0.11, 0.15] },
  hurt: { every: [2.2, 5.2], dur: [0.16, 0.22] },
  fast: { every: [1.5, 3.4], dur: [0.09, 0.12] },
  fastHurt: { every: [1.4, 3.6], dur: [0.12, 0.18] },
  slow: { every: [3.5, 7.5], dur: [0.22, 0.32] },
  slowHurt: { every: [3.2, 7], dur: [0.24, 0.36] },
  dying: { every: [3, 6], dur: [0.35, 0.6] },
};
