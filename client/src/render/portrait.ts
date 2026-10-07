import { portraitState, PORTRAIT_STATES, type AvatarLook, type CharacterDef, type PortraitArt, type VitalConditions } from '@crona/shared';
import { reduced } from '../ui/motion';
import { drawPixelHead } from './avatarPixel';
import { framesFor, removeBackground, sprites, type SpriteFrame } from './sprites';

/**
 * Como o personagem respira no retrato. Pela ficha (regras do livro):
 * machucado = irregular e calmo; perturbado = rápido; PE baixo = bem devagar;
 * morrendo = fraco e espaçado.
 */
export type BreathMode = 'calm' | 'hurt' | 'fast' | 'fastHurt' | 'slow' | 'slowHurt' | 'dying';

export function breathMode(c: VitalConditions): BreathMode {
  if (c.morrendo) return 'dying';
  const irregular = c.machucado || c.enlouquecendo;
  if (c.perturbado || c.enlouquecendo) return irregular ? 'fastHurt' : 'fast';
  if (c.cansado) return irregular ? 'slowHurt' : 'slow';
  return irregular ? 'hurt' : 'calm';
}

export interface PortraitOpts {
  /**
   * Direção da peça (0..7) de onde sai o rosto quando o retrato vem da folha:
   * 4 = frente para a esquerda (padrão), 2 = frente para a direita.
   */
  dir?: number;
  /** estado do retrato: com a arma, machucado */
  armed?: boolean;
  hurt?: boolean;
  /** respiração (retrato vivo) */
  breath?: BreathMode;
}

/** Retrato de corpo inteiro pronto: sem fundo e com o recorte do busto. */
interface Art {
  img: HTMLCanvasElement;
  /** recorte (cabeça até a cintura) na imagem */
  crop: { x: number; y: number; w: number; h: number };
}

const arts = new Map<string, Promise<Art | null>>();

/** Carrega uma imagem de retrato, tira o fundo branco e acha o busto (uma vez por arquivo). */
function loadArt(url: string): Promise<Art | null> {
  let p = arts.get(url);
  if (!p) {
    p = new Promise<Art | null>((res) => {
      const im = new Image();
      im.onload = () => {
        const W = im.naturalWidth;
        const H = im.naturalHeight;
        const img = document.createElement('canvas');
        img.width = W;
        img.height = H;
        const ctx = img.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(im, 0, 0);
        const data = ctx.getImageData(0, 0, W, H);
        removeBackground(data);
        ctx.putImageData(data, 0, 0);
        const d = data.data;
        let y0 = H;
        let y1 = -1;
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x += 2)
            if (d[(y * W + x) * 4 + 3] > 96) {
              if (y < y0) y0 = y;
              y1 = y;
              break;
            }
        if (y1 < 0) return res(null);
        const fh = y1 - y0 + 1;
        // centro da cabeça (quarto de cima), para o recorte não pular quando a arma aparece
        let sum = 0;
        let n = 0;
        for (let y = y0; y < y0 + fh * 0.22; y++)
          for (let x = 0; x < W; x += 2)
            if (d[(y * W + x) * 4 + 3] > 96) {
              sum += x;
              n++;
            }
        const cx = n ? sum / n : W / 2;
        // o rosto: a pele entre o alto da cabeça e o queixo. O recorte fecha nele, com os olhos um pouco
        // acima do meio, e não no topo do cabelo (o cabelo volumoso puxava o retrato para o canto)
        let px = 0;
        let py = 0;
        let pn = 0;
        for (let y = Math.round(y0 + fh * 0.08); y < y0 + fh * 0.42; y += 2)
          for (let x = 0; x < W; x += 2) {
            const i = (y * W + x) * 4;
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];
            if (d[i + 3] > 200 && r > 110 && r > g && g > b && r - b > 35 && r - g < 90) {
              px += x;
              py += y;
              pn++;
            }
          }
        if (pn > 200) {
          const ch = Math.min(fh * 0.5, W);
          const fx = px / pn;
          const fy = py / pn;
          res({ img, crop: { x: fx - ch / 2, y: fy - ch * 0.46, w: ch, h: ch } });
          return;
        }
        const ch = fh * 0.6;
        res({ img, crop: { x: cx - ch / 2, y: y0 - fh * 0.03, w: ch, h: ch } });
      };
      im.onerror = () => res(null);
      im.src = url;
    });
    arts.set(url, p);
  }
  return p;
}

/** O estado pedido, ou o mais parecido que o personagem tem. */
function pickArt(def: CharacterDef | undefined, armed: boolean, hurt: boolean): PortraitArt | null {
  const list = def?.portraits;
  if (!list) return null;
  const want = [portraitState(armed, hurt), portraitState(armed, false), portraitState(!armed, hurt), ...PORTRAIT_STATES];
  for (const s of want) if (list[s]) return list[s]!;
  return null;
}

function background(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const bg = ctx.createRadialGradient(w / 2, h * 0.4, 2, w / 2, h / 2, w * 0.75);
  bg.addColorStop(0, '#3a3129');
  bg.addColorStop(1, '#14100e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
}

interface Drawn {
  canvas: HTMLCanvasElement;
  /** redesenha de olhos abertos ou fechados (false se não tem olhos fechados) */
  paint: (closed: boolean) => boolean;
}

/**
 * Desenha o retrato num canvas quadrado. Com os retratos do personagem (um
 * por estado), mostra o busto da imagem do estado atual; sem eles, recorta o
 * rosto da folha de sprite; sem folha, desenha a cabeça pixel.
 */
function drawPortrait(look: AvatarLook | null, size: number, opts: PortraitOpts): Drawn {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(size * dpr);
  c.style.width = c.style.height = `${size}px`;
  const ctx = c.getContext('2d')!;
  const W = c.width;
  const H = c.height;
  const def = look?.charId ? sprites.def(look.charId) : undefined;
  const art = pickArt(def, !!opts.armed, !!opts.hurt);
  let paint: (closed: boolean) => boolean;

  if (art) {
    c.classList.add('full');
    let open: Art | null = null;
    let shut: Art | null = null;
    paint = (closed) => {
      background(ctx, W, H);
      const a = closed && shut ? shut : open;
      if (a) {
        const k = W / a.crop.w;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(a.img, -a.crop.x * k, -a.crop.y * k, a.img.width * k, a.img.height * k);
      }
      return !closed || !!shut;
    };
    void loadArt(art.open).then((a) => {
      open = a;
      paint(false);
    });
    if (art.closed)
      void loadArt(art.closed).then((a) => {
        // o recorte segue o de olhos abertos (a mesma pose)
        shut = a && open ? { img: a.img, crop: open.crop } : a;
      });
  } else {
    paint = (closed) => {
      background(ctx, W, H);
      if (!look) return false;
      const sp = def ? sprites.get(look.charId) : null;
      if (!sp) {
        if (!def) {
          ctx.imageSmoothingEnabled = false;
          drawPixelHead(ctx, look, W / 2, H * 0.54, (W / 40) * 1.05);
        }
        return false;
      }
      const frames = framesFor(sp.lc, opts.dir ?? 4);
      const f0 = frames?.[0];
      if (!frames || !f0) return false;
      // olhos fechados = 3ª coluna da folha, só se for a mesma pose (senão o rosto pularia)
      const fb = frames[2];
      const same = !!fb && Math.abs(fb.w - f0.w) < 1.5 && Math.abs(fb.h - f0.h) < 1.5;
      const f: SpriteFrame = closed && same ? fb : f0;
      const side = Math.min(f0.w, f0.h * 0.5);
      const k = (W * 0.92) / side;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(f.canvas, W * 0.04 - ((f0.w - side) / 2) * k, H * 0.06, f.w * k, f.h * k);
      return !closed || same;
    };
    if (def && look?.charId && !sprites.get(look.charId)) void sprites.load(def).then(() => paint(false));
  }
  paint(false);
  return { canvas: c, paint };
}

/** Retrato parado (entregas, listas). */
export function portraitCanvas(look: AvatarLook | null, size = 88, opts: PortraitOpts = {}): HTMLCanvasElement {
  return drawPortrait(look, size, opts).canvas;
}

// ---------------------------------------------------------------------------
// retrato vivo: respira (animação do navegador, sem redesenhar) e pisca

const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface BreathStyle {
  /** duração de um fôlego (s) */
  len: [number, number];
  /** fundura (1 = normal) */
  amp: [number, number];
  /** chance de prender o ar um instante depois de soltar, e por quanto tempo */
  hold: number;
  holdLen: [number, number];
  /** chance de puxar o ar em duas vezes */
  hitch: number;
}

const STYLES: Record<BreathMode, BreathStyle> = {
  calm: { len: [4.3, 4.9], amp: [0.92, 1], hold: 0, holdLen: [0, 0], hitch: 0 },
  hurt: { len: [3.4, 5.8], amp: [0.5, 1.05], hold: 0.3, holdLen: [0.35, 1.1], hitch: 0.3 },
  fast: { len: [1.7, 2.2], amp: [0.55, 0.75], hold: 0, holdLen: [0, 0], hitch: 0.05 },
  fastHurt: { len: [1.5, 2.6], amp: [0.4, 0.8], hold: 0.15, holdLen: [0.2, 0.5], hitch: 0.25 },
  slow: { len: [7.5, 9.5], amp: [0.8, 0.95], hold: 0.25, holdLen: [0.6, 1.4], hitch: 0 },
  slowHurt: { len: [6.5, 10], amp: [0.5, 0.9], hold: 0.35, holdLen: [0.6, 1.6], hitch: 0.25 },
  dying: { len: [5.5, 8.5], amp: [0.25, 0.45], hold: 0.5, holdLen: [0.8, 2], hitch: 0.3 },
};

/** Peito cheio: sobe os ombros a partir da cintura (bem pouco). */
const chest = (b: number) => `scale(${(1 + 0.003 * b).toFixed(5)}, ${(1 + 0.012 * b).toFixed(5)})`;

/**
 * Uma volta de ~45 s de fôlegos, em quadros-chave com curva suave em cada
 * trecho. `forma` transforma a fundura do fôlego (0..1) no `transform` CSS.
 */
export function breathKeyframes(mode: BreathMode, forma: (b: number) => string = chest): { frames: Keyframe[]; total: number } {
  const st = STYLES[mode];
  const pts: { t: number; b: number }[] = [{ t: 0, b: 0 }];
  let t = 0;
  while (t < 42 || pts.length < 4) {
    const len = rand(...st.len);
    const amp = rand(...st.amp);
    const inhale = len * 0.42;
    if (Math.random() < st.hitch) {
      // puxa, para um tiquinho, puxa o resto
      pts.push({ t: t + inhale * 0.5, b: amp * 0.55 }, { t: t + inhale * 0.62, b: amp * 0.52 });
    }
    pts.push({ t: t + inhale, b: amp }, { t: t + len, b: 0 });
    t += len;
    if (Math.random() < st.hold) {
      t += rand(...st.holdLen);
      pts.push({ t, b: 0 });
    }
  }
  const frames = pts.map((p) => ({ offset: p.t / t, transform: forma(p.b), easing: 'ease-in-out' }));
  frames[frames.length - 1].offset = 1;
  return { frames, total: t };
}

/** Piscadas por modo: intervalo e duração (s). */
const BLINK: Record<BreathMode, { every: [number, number]; dur: [number, number] }> = {
  calm: { every: [2.6, 6.2], dur: [0.1, 0.14] },
  hurt: { every: [2.2, 5.2], dur: [0.16, 0.22] },
  fast: { every: [1.4, 3.4], dur: [0.09, 0.12] },
  fastHurt: { every: [1.4, 3.6], dur: [0.12, 0.18] },
  slow: { every: [3.5, 7.5], dur: [0.22, 0.32] },
  slowHurt: { every: [3.2, 7], dur: [0.24, 0.36] },
  dying: { every: [3, 6], dur: [0.35, 0.6] },
};

/**
 * Retrato que respira e pisca, bem de leve. A imagem é desenhada uma vez; a
 * respiração é uma transformação suave do navegador (não treme) e a piscada
 * só troca a imagem por um instante.
 */
export function livePortrait(look: AvatarLook | null, size = 88, opts: PortraitOpts = {}): HTMLElement {
  const d = drawPortrait(look, size, opts);
  const wrap = document.createElement('div');
  wrap.className = 'breath';
  wrap.append(d.canvas);
  if (reduced()) return wrap;
  const mode = opts.breath ?? 'calm';
  const { frames, total } = breathKeyframes(mode);
  wrap.animate(frames, { duration: total * 1000, iterations: Infinity, delay: -rand(0, total) * 1000 });
  // piscar: só enquanto estiver na tela
  let seen = false;
  let waits = 0;
  const bl = BLINK[mode];
  const next = (ms: number) => setTimeout(blink, ms);
  const blink = () => {
    if (!wrap.isConnected) {
      // saiu da tela (ou nunca entrou): para
      if (seen || ++waits > 30) return;
      next(1000);
      return;
    }
    seen = true;
    if (!d.paint(true)) return next(rand(...bl.every) * 1000);
    setTimeout(() => {
      d.paint(false);
      // às vezes duas seguidas
      next(Math.random() < 0.12 ? 160 : rand(...bl.every) * 1000);
    }, rand(...bl.dur) * 1000);
  };
  next(rand(0.8, 4) * 1000);
  return wrap;
}
