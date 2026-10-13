import type { WallFurniDef } from '@crona/shared';
import { rgba, rng, shade } from './color';
import { drawBlood, drawSigil, type LightKind } from './furniFloor';
import { drawFlame, OUTLINE } from './painter';
import { arteCarregada } from '../ui/icons';

/**
 * A escrita de sangue pintada pelo Códex (10/10, pedida: arte/paredes/escrita-sangue-orfanato.png, de frente, chapada,
 * fundo transparente): quando existe, vai na parede no lugar da letra de código (a parede inclina sozinha).
 */
const ESCRITA_PINTADA = '/arte/paredes/escrita-sangue-orfanato.png';
let escritaPintada: HTMLImageElement | null = null;
void arteCarregada.then((lista) => {
  if (!lista.has(ESCRITA_PINTADA)) return;
  const img = new Image();
  img.onload = () => (escritaPintada = img);
  img.src = ESCRITA_PINTADA;
});

/** Luz em coordenadas locais do item (px a partir do canto superior esquerdo). */
export interface WallLight {
  x: number;
  y: number;
  radius: number;
  color: string;
  intensity: number;
  flicker?: number;
  pulse?: number;
  kind?: LightKind;
}

type Draw = (ctx: CanvasRenderingContext2D, d: WallFurniDef, state: number, seed: number, t: number) => void;

function frameRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

function tornPaper(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, seed: number) {
  const r = rng(seed);
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 1; i <= 6; i++) ctx.lineTo(x + (w * i) / 6, y + (r() - 0.5) * 2);
  for (let i = 1; i <= 7; i++) ctx.lineTo(x + w + (r() - 0.5) * 2, y + (h * i) / 7);
  for (let i = 5; i >= 0; i--) ctx.lineTo(x + (w * i) / 6, y + h + (r() - 0.5) * 3);
  for (let i = 6; i >= 1; i--) ctx.lineTo(x + (r() - 0.5) * 2, y + (h * i) / 7);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.save();
  ctx.translate(1.5, 1.5);
  ctx.fill();
  ctx.restore();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, shade(color, 0.08));
  g.addColorStop(1, shade(color, -0.22));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = 'rgba(90,60,30,0.18)';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(x + r() * w, y + r() * h, 2 + r() * 5, 1 + r() * 4, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function pin(ctx: CanvasRenderingContext2D, x: number, y: number, c = '#b3261e') {
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x - 2, y - 2, 4, 4);
  ctx.fillStyle = c;
  ctx.fillRect(x - 1, y - 1, 2, 2);
}

function writing(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, lines: number, seed: number, color = 'rgba(40,30,25,0.6)') {
  const r = rng(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < lines; i++) ctx.fillRect(x, y + i * 3, w * (0.5 + r() * 0.5), 1);
}

const draws: Record<string, Draw> = {
  poster_sigil(ctx, d, _s, seed) {
    const [paper, red] = d.colors;
    tornPaper(ctx, 2, 2, d.w - 4, d.h - 4, paper, seed);
    drawSigil(ctx, d.w / 2, d.h / 2 + 2, 14, red, seed, false);
    writing(ctx, 8, d.h - 9, d.w - 16, 2, seed + 1, 'rgba(120,20,20,0.6)');
    pin(ctx, 5, 5);
    pin(ctx, d.w - 5, 5);
  },

  notes(ctx, d, _s, seed) {
    const r = rng(seed);
    const sheets: [number, number, number, number, number][] = [
      [2, 6, 16, 20, -0.08],
      [15, 2, 18, 22, 0.06],
      [8, 16, 20, 18, 0.03],
    ];
    for (const [x, y, w, h, a] of sheets) {
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(a);
      tornPaper(ctx, -w / 2, -h / 2, w, h, shade(d.colors[0], (r() - 0.5) * 0.2), seed + x);
      writing(ctx, -w / 2 + 3, -h / 2 + 4, w - 6, Math.floor(h / 3.5), seed + y);
      pin(ctx, 0, -h / 2 + 2, r() < 0.5 ? '#b3261e' : '#c9a54a');
      ctx.restore();
    }
    // foto
    frameRect(ctx, 26, 20, 11, 13, '#e8e0d0');
    ctx.fillStyle = '#2a2a2e';
    ctx.fillRect(27, 21, 9, 9);
    ctx.fillStyle = '#6a6a70';
    ctx.fillRect(30, 23, 3, 3);
    ctx.fillRect(29, 26, 5, 4);
  },

  board(ctx, d, _s, seed) {
    const [wood, red] = d.colors;
    frameRect(ctx, 0, 0, d.w, d.h, shade(wood, -0.3));
    ctx.fillStyle = '#8a6a42';
    ctx.fillRect(3, 3, d.w - 6, d.h - 6);
    const r = rng(seed);
    ctx.fillStyle = 'rgba(60,40,20,0.35)';
    for (let i = 0; i < 60; i++) ctx.fillRect(3 + r() * (d.w - 7), 3 + r() * (d.h - 7), 1, 1);
    const pins: [number, number][] = [];
    const items: [number, number, number, number, boolean][] = [
      [7, 7, 12, 14, true],
      [26, 6, 14, 11, false],
      [48, 8, 11, 14, true],
      [10, 28, 15, 12, false],
      [34, 24, 12, 15, true],
      [55, 28, 14, 12, false],
    ];
    for (const [x, y, w, h, photo] of items) {
      if (photo) {
        frameRect(ctx, x, y, w, h, '#e8e0d0');
        ctx.fillStyle = '#2a2a30';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 4);
        ctx.fillStyle = '#7a7a80';
        ctx.fillRect(x + w / 2 - 2, y + 3, 4, 4);
        ctx.fillRect(x + w / 2 - 3, y + 7, 6, h - 10);
      } else {
        tornPaper(ctx, x, y, w, h, '#d8cdb0', seed + x);
        writing(ctx, x + 2, y + 3, w - 4, Math.floor(h / 3.5), seed + y);
      }
      pins.push([x + w / 2, y + 2]);
    }
    ctx.strokeStyle = red;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const order = [0, 4, 2, 5, 3, 0, 1];
    order.forEach((i, k) => (k ? ctx.lineTo(pins[i][0], pins[i][1]) : ctx.moveTo(pins[i][0], pins[i][1])));
    ctx.stroke();
    for (const [x, y] of pins) pin(ctx, x, y);
  },

  window(ctx, d, state) {
    const [frame, glow] = d.colors;
    const on = state === 0;
    frameRect(ctx, 0, 0, d.w, d.h, shade(frame, -0.3));
    const g = ctx.createLinearGradient(0, 3, 0, d.h - 3);
    g.addColorStop(0, on ? shade(glow, -0.25) : '#0c1118');
    g.addColorStop(1, on ? shade(glow, -0.7) : '#05070a');
    ctx.fillStyle = g;
    ctx.fillRect(3, 3, d.w - 6, d.h - 6);
    if (on) {
      const rg = ctx.createRadialGradient(d.w * 0.66, d.h * 0.3, 1, d.w * 0.66, d.h * 0.3, 14);
      rg.addColorStop(0, 'rgba(230,240,255,0.85)');
      rg.addColorStop(1, 'rgba(160,200,255,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(3, 3, d.w - 6, d.h - 6);
    }
    ctx.fillStyle = '#16181c';
    for (let i = 1; i < 4; i++) ctx.fillRect((d.w * i) / 4 - 1, 3, 2, d.h - 6);
    ctx.fillRect(3, d.h / 2 - 1, d.w - 6, 2);
    ctx.fillStyle = shade(frame, -0.1);
    ctx.fillRect(-2, d.h - 3, d.w + 4, 4);
  },

  sconce(ctx, d, state, seed, t) {
    const [metal, wax] = d.colors;
    const on = state === 0;
    frameRect(ctx, 5, 12, 6, 14, shade(metal, -0.2));
    ctx.fillStyle = metal;
    ctx.fillRect(7, 20, 2, 4);
    frameRect(ctx, 3, 16, 10, 3, metal);
    frameRect(ctx, 6, 7, 4, 9, wax);
    if (on) drawFlame(ctx, 8, 7, 0.9, t / 1000 + seed);
  },

  door_sealed(ctx, d, _s, seed) {
    const [paint, red] = d.colors;
    frameRect(ctx, 0, 0, d.w, d.h, '#1c1a1a');
    const g = ctx.createLinearGradient(0, 0, d.w, 0);
    g.addColorStop(0, shade(paint, 0.12));
    g.addColorStop(1, shade(paint, -0.35));
    ctx.fillStyle = g;
    ctx.fillRect(3, 3, d.w - 6, d.h - 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(6.5, 6.5, d.w - 13, d.h * 0.42);
    ctx.strokeRect(6.5, d.h * 0.52, d.w - 13, d.h * 0.42);
    drawSigil(ctx, d.w / 2, d.h * 0.3, 11, shade(red, -0.35), seed, false);
    drawBlood(ctx, d.w / 2, d.h * 0.72, 8, '#3a0606', seed, 0.4);
    frameRect(ctx, d.w - 11, d.h * 0.55, 5, 3, '#8a8f96');
    ctx.strokeStyle = 'rgba(255,230,220,0.18)';
    const r = rng(seed + 2);
    for (let i = 0; i < 5; i++) {
      const x = 8 + r() * (d.w - 16);
      const y = 10 + r() * (d.h - 20);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 4 + r() * 5, y + 8 + r() * 6);
      ctx.stroke();
    }
  },

  pipes(ctx, d) {
    const [metal] = d.colors;
    const pipe = (y: number, h: number, c: string) => {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, shade(c, 0.25));
      g.addColorStop(1, shade(c, -0.4));
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(0, y - 1, d.w, h + 2);
      ctx.fillStyle = g;
      ctx.fillRect(0, y, d.w, h);
    };
    pipe(3, 6, metal);
    pipe(12, 5, shade(metal, -0.15));
    for (const x of [10, 38, 58]) frameRect(ctx, x, 1, 4, 18, shade(metal, -0.3));
    ctx.strokeStyle = '#8a1414';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(26, 6, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#8a1414';
    ctx.fillRect(25, 2, 2, 8);
    ctx.fillRect(22, 5, 8, 2);
  },

  wall_shelf(ctx, d) {
    const [wood] = d.colors;
    const jars = [
      [6, 9, '#6e1010'],
      [17, 11, '#3a5a2a'],
      [34, 8, '#8a6a2a'],
    ] as const;
    for (const [x, h, c] of jars) {
      frameRect(ctx, x, 17 - h, 8, h, '#7a8a90');
      ctx.fillStyle = c;
      ctx.fillRect(x + 1, 17 - h * 0.6, 6, h * 0.6);
      ctx.fillStyle = '#2a2622';
      ctx.fillRect(x, 17 - h - 2, 8, 2);
    }
    frameRect(ctx, 26, 11, 5, 6, '#d8cfb8');
    ctx.fillStyle = '#2a1a14';
    ctx.fillRect(27, 13, 1, 1);
    ctx.fillRect(29, 13, 1, 1);
    frameRect(ctx, 0, 17, d.w, 4, wood);
    frameRect(ctx, 6, 21, 3, 5, shade(wood, -0.3));
    frameRect(ctx, d.w - 9, 21, 3, 5, shade(wood, -0.3));
  },

  antlers(ctx, d) {
    const [bone] = d.colors;
    const cx = d.w / 2;
    ctx.strokeStyle = OUTLINE;
    ctx.lineCap = 'round';
    const branch = (w: number, c: string) => {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * 4, 20);
        ctx.quadraticCurveTo(cx + s * 12, 14, cx + s * 16, 3);
        ctx.moveTo(cx + s * 9, 15);
        ctx.lineTo(cx + s * 17, 13);
        ctx.moveTo(cx + s * 13, 9);
        ctx.lineTo(cx + s * 9, 2);
        ctx.moveTo(cx + s * 15, 6);
        ctx.lineTo(cx + s * 19, 4);
        ctx.stroke();
      }
    };
    branch(4, OUTLINE);
    branch(2, bone);
    frameRect(ctx, cx - 6, 16, 12, 8, bone);
    frameRect(ctx, cx - 4, 24, 8, 8, bone);
    ctx.fillStyle = '#2a1a14';
    ctx.fillRect(cx - 4, 19, 3, 3);
    ctx.fillRect(cx + 1, 19, 3, 3);
    ctx.fillRect(cx - 1, 27, 2, 3);
    frameRect(ctx, cx - 9, 30, 18, 3, '#3d2819');
  },

  emergency(ctx, d, state, _seed, t) {
    const [body, red] = d.colors;
    const on = state === 0;
    frameRect(ctx, 1, 2, d.w - 2, d.h - 4, body);
    const k = on ? 0.35 + 0.65 * Math.max(0, Math.sin(t / 260)) : 0;
    ctx.fillStyle = on ? `rgba(255,${60 + k * 80},${40 + k * 40},${0.45 + k * 0.55})` : '#3a1a18';
    ctx.beginPath();
    ctx.ellipse(d.w / 2, d.h / 2 + 1, d.w / 2 - 4, d.h / 2 - 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (on) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + k * 0.4})`;
      ctx.fillRect(d.w / 2 - 4, d.h / 2 - 2, 3, 2);
      ctx.strokeStyle = red;
      ctx.lineWidth = 1;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (let x = 5; x < d.w - 4; x += 3) ctx.fillRect(x, 4, 1, d.h - 8);
  },

  clock(ctx, d) {
    const [frame, face] = d.colors;
    const c = d.w / 2;
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = frame;
    ctx.beginPath();
    ctx.arc(c, c, c - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(c, c, c - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2420';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.fillRect(c + Math.cos(a) * (c - 5) - 0.5, c + Math.sin(a) * (c - 5) - 0.5, 1, 1);
    }
    const now = new Date();
    const hA = ((now.getHours() % 12) + now.getMinutes() / 60) / 12 * Math.PI * 2 - Math.PI / 2;
    const mA = (now.getMinutes() / 60) * Math.PI * 2 - Math.PI / 2;
    const sA = (now.getSeconds() / 60) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = '#1a1512';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.cos(hA) * 4, c + Math.sin(hA) * 4);
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.cos(mA) * 6.5, c + Math.sin(mA) * 6.5);
    ctx.stroke();
    ctx.strokeStyle = '#8a1414';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.cos(sA) * 7, c + Math.sin(sA) * 7);
    ctx.stroke();
  },

  // ---------- Sede da Ordem ----------
  /** Quadro a óleo com moldura dourada (paisagem escura). */
  painting(ctx, d, _s, seed) {
    const [gold, canvasC] = d.colors;
    frameRect(ctx, 0, 0, d.w, d.h, shade(gold, -0.2));
    ctx.fillStyle = gold;
    ctx.fillRect(2, 2, d.w - 4, d.h - 4);
    ctx.fillStyle = canvasC;
    ctx.fillRect(5, 5, d.w - 10, d.h - 10);
    const r = rng(seed + 21);
    const g = ctx.createLinearGradient(0, 5, 0, d.h - 5);
    g.addColorStop(0, '#5a4a30');
    g.addColorStop(1, '#1a140c');
    ctx.fillStyle = g;
    ctx.fillRect(5, 5, d.w - 10, d.h - 10);
    ctx.fillStyle = 'rgba(20,30,20,0.8)';
    ctx.beginPath();
    ctx.moveTo(5, d.h - 5);
    for (let x = 5; x <= d.w - 5; x += 6) ctx.lineTo(x, d.h * 0.55 - r() * 8);
    ctx.lineTo(d.w - 5, d.h - 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(230,200,140,0.5)';
    ctx.beginPath();
    ctx.arc(d.w * 0.7, d.h * 0.35, 3, 0, Math.PI * 2);
    ctx.fill();
  },

  /** Letreiro "BAR" em neon rosa (apaga no apagão). */
  neon(ctx, d, state, seed, t) {
    const [tube, core] = d.colors;
    const on = state === 0;
    // o neon zune: quase sempre firme, respira um pouco e de vez em quando dá duas piscadas rápidas
    const ciclo = (t + seed * 977) % 6100;
    const pisca = (ciclo > 5600 && ciclo < 5660) || (ciclo > 5740 && ciclo < 5790) ? 0.3 : 1;
    const vivo = on ? (0.9 + 0.1 * Math.sin(t / 140)) * pisca : 0;
    if (vivo > 0) {
      // o brilho rosa que o letreiro joga na parede em volta dele
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(d.w / 2, d.h / 2, 2, d.w / 2, d.h / 2, d.w * 0.85);
      g.addColorStop(0, rgba(tube, 0.34 * vivo));
      g.addColorStop(0.45, rgba(tube, 0.12 * vivo));
      g.addColorStop(1, rgba(tube, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-d.w * 0.35, -d.h * 1.1, d.w * 1.7, d.h * 3.2);
      ctx.restore();
    }
    frameRect(ctx, 0, 2, d.w, d.h - 4, '#141012');
    ctx.save();
    ctx.font = `bold ${d.h - 8}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (vivo > 0) {
      ctx.shadowColor = tube;
      ctx.shadowBlur = 14 * vivo;
    }
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = vivo > 0 ? tube : shade(tube, -0.6);
    ctx.strokeText('BAR', d.w / 2, d.h / 2 + 1);
    // segunda passada: o tubo aceso por dentro, quase branco
    ctx.shadowBlur = 4 * vivo;
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = vivo > 0 ? core : shade(tube, -0.4);
    ctx.globalAlpha = vivo > 0 ? 0.75 + 0.25 * vivo : 1;
    ctx.strokeText('BAR', d.w / 2, d.h / 2 + 1);
    ctx.restore();
  },

  dartboard(ctx, d) {
    const [black, red, cream] = d.colors;
    const c = d.w / 2;
    const ring = (r: number, col: string) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.fill();
    };
    ring(c, OUTLINE);
    ring(c - 1, black);
    // setores claros e escuros
    for (let i = 0; i < 20; i++) {
      const a0 = (i / 20) * Math.PI * 2;
      ctx.fillStyle = i % 2 ? cream : '#1e1a16';
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, c - 3, a0, a0 + Math.PI / 10);
      ctx.closePath();
      ctx.fill();
    }
    ctx.lineWidth = 1.5;
    for (const r of [c - 3.5, c * 0.55]) {
      ctx.strokeStyle = red;
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ring(2.4, '#2f7a3a');
    ring(1.2, red);
    // dardos cravados
    ctx.strokeStyle = '#c9c4bc';
    ctx.lineWidth = 1;
    for (const [x, y] of [
      [c + 4, c - 3],
      [c - 5, c + 2],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 3, y - 4);
      ctx.stroke();
      ctx.fillStyle = red;
      ctx.fillRect(x + 2.5, y - 5.5, 2, 2);
    }
  },

  /** Tela de projeção: enrolada no alto; ligada, mostra o mapa da missão. */
  screen(ctx, d, state, seed, t) {
    const [cloth, cas] = d.colors;
    const on = state === 0;
    frameRect(ctx, 0, 0, d.w, 5, cas);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(2, 5, d.w - 4, d.h - 6);
    ctx.fillStyle = on ? shade(cloth, 0.05) : shade(cloth, -0.25);
    ctx.fillRect(3, 5, d.w - 6, d.h - 7);
    if (on) {
      // mapa projetado: ruas, pontos marcados e a luz tremendo de leve
      const r = rng(seed + 9);
      ctx.strokeStyle = 'rgba(40,60,70,0.55)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.moveTo(4 + r() * (d.w - 8), 6);
        ctx.lineTo(4 + r() * (d.w - 8), d.h - 3);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(160,30,20,0.8)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(10 + r() * (d.w - 20), 12 + r() * (d.h - 22), 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(255,250,235,${0.08 + 0.04 * Math.sin(t / 90 + seed)})`;
      ctx.fillRect(3, 5, d.w - 6, d.h - 7);
    }
    ctx.fillStyle = cas;
    ctx.fillRect(d.w / 2 - 3, d.h - 3, 6, 3);
  },

  mirror(ctx, d) {
    const [glass, frame] = d.colors;
    frameRect(ctx, 0, 0, d.w, d.h, frame);
    const g = ctx.createLinearGradient(0, 0, d.w, d.h);
    g.addColorStop(0, shade(glass, 0.2));
    g.addColorStop(1, shade(glass, -0.35));
    ctx.fillStyle = g;
    ctx.fillRect(3, 3, d.w - 6, d.h - 6);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.moveTo(6, d.h - 8);
    ctx.lineTo(d.w - 12, 5);
    ctx.lineTo(d.w - 8, 5);
    ctx.lineTo(10, d.h - 8);
    ctx.closePath();
    ctx.fill();
  },

  /**
   * A escrita de sangue (09/10, o Orfanato): as frases dos transtornados, escritas à mão com o dedo, letra por letra
   * torta, e o sangue escorrendo das linhas. O texto inteiro também vai na pista da parede (Examinar).
   */
  escrita(ctx, d, _state, seed) {
    if (escritaPintada) {
      ctx.drawImage(escritaPintada, 0, 0, d.w, d.h);
      return;
    }
    const [cor] = d.colors;
    const linhas = [
      'O DIABO OBSERVA E RECOMPENSA',
      'A DOR EXTREMA.',
      'O SANGUE É O CAMINHO PARA',
      'OS DESEJOS MAIS PROFUNDOS.',
      'O CORPO É O CANAL DA REVELAÇÃO',
      'E O SOFRIMENTO É O IDIOMA',
      'DOS ESCOLHIDOS.',
    ];
    const r = rng(seed + 5);
    const escuro = shade(cor, -0.55);
    const lh = d.h / 7.2;
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // a letra de dedo: grossa e sem serifa, do tamanho que enche a parede
    const fonte = (px: number) => `900 ${px}px Impact, "Arial Black", "Franklin Gothic Heavy", sans-serif`;
    ctx.font = fonte(10);
    const larga = Math.max(...linhas.map((l) => ctx.measureText(l).width + l.length * 0.6));
    const fs = Math.max(6, Math.min(Math.round(lh * 0.8), Math.floor((10 * (d.w - 12)) / larga)));
    // as marcas de mão: a palma e os dedos borrados, escorregando, onde o dedo foi molhado de novo
    const mao = (x: number, y: number, s: number, giro: number, a: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(giro);
      ctx.fillStyle = rgba(cor, a);
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.42, s * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse(-s * 0.32 + k * s * 0.21, -s * 0.72 - (k === 1 || k === 2 ? s * 0.1 : 0), s * 0.08, s * 0.24, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.ellipse(s * 0.5, -s * 0.12, s * 0.08, s * 0.2, -0.9, 0, Math.PI * 2);
      ctx.fill();
      // o arrasto da mão escorregando
      ctx.fillStyle = rgba(cor, a * 0.35);
      ctx.fillRect(-s * 0.38, 0, s * 0.76, s * (0.6 + r() * 0.8));
      ctx.restore();
    };
    mao(d.w * 0.05, d.h * 0.78, fs * 1.6, -0.25, 0.75);
    mao(d.w * 0.93, d.h * 0.3, fs * 1.4, 0.3, 0.6);
    linhas.forEach((l, i) => {
      const y = 1 + i * lh;
      ctx.font = fonte(fs);
      const largura = ctx.measureText(l).width + l.length * 0.6;
      let x = Math.max(2, (d.w - largura) / 2 + (r() - 0.5) * 10);
      const inclina = (r() - 0.5) * 0.03;
      // o sangue no dedo: forte no começo de cada palavra, falhando até a próxima molhada
      let carga = 1;
      for (const ch of l) {
        if (ch === ' ') {
          carga = Math.min(1, carga + 0.55 + r() * 0.3);
          x += fs * 0.32;
          continue;
        }
        const tam = Math.round(fs * (0.88 + r() * 0.26));
        ctx.font = fonte(tam);
        const yy = y + (x - 2) * inclina + (r() - 0.5) * 1.8 + (fs - tam) * 0.6;
        ctx.save();
        ctx.translate(x, yy);
        ctx.rotate((r() - 0.5) * 0.22);
        const a = 0.35 + carga * 0.6;
        // o borrão do dedo (duas passadas fora do lugar), o contorno do sangue secando e o miolo vivo
        ctx.fillStyle = rgba(cor, a * 0.3);
        ctx.fillText(ch, -0.8 + r() * 0.6, 0.6);
        ctx.fillText(ch, 0.7, -0.4 + r() * 0.6);
        if (carga >= 0.5) {
          ctx.strokeStyle = rgba(escuro, a * 0.85);
          ctx.lineWidth = Math.max(1.2, tam * 0.11);
          ctx.strokeText(ch, 0, 0);
          ctx.fillStyle = rgba(cor, a);
          ctx.fillText(ch, 0, 0);
        } else {
          // o dedo seco: a letra sai só riscada, falhando
          ctx.setLineDash([1.4 + r(), 1 + r() * 1.2]);
          ctx.strokeStyle = rgba(cor, a + 0.15);
          ctx.lineWidth = Math.max(1.4, tam * 0.16);
          ctx.strokeText(ch, 0, 0);
          ctx.setLineDash([]);
        }
        ctx.restore();
        // o sangue escorrendo das letras molhadas
        if (carga > 0.6 && r() < 0.32) {
          const len = 2 + r() * lh * 1.1;
          const dx = x + r() * tam * 0.5;
          ctx.fillStyle = rgba(cor, 0.8);
          ctx.fillRect(dx, yy + tam * 0.85, 0.9 + r() * 0.6, len);
          ctx.beginPath();
          ctx.arc(dx + 0.6, yy + tam * 0.85 + len, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        x += ctx.measureText(ch).width + 0.6;
        carga = Math.max(0.12, carga - 0.09 - r() * 0.05);
      }
    });
    ctx.restore();
  },

  /** A fuligem do incêndio na parede: manchas pretas subindo do chão, mais fortes embaixo. */
  fuligem(ctx, d, _state, seed) {
    const [cor] = d.colors;
    const r = rng(seed + 11);
    for (let i = 0; i < 7; i++) {
      const x = d.w * (0.15 + r() * 0.7);
      const y = d.h * (0.35 + r() * 0.6);
      const rx = d.w * (0.18 + r() * 0.3);
      const ry = d.h * (0.25 + r() * 0.35);
      const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
      g.addColorStop(0, rgba(cor, 0.75));
      g.addColorStop(0.6, rgba(cor, 0.35));
      g.addColorStop(1, rgba(cor, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  extinguisher(ctx, d) {
    const [red, black] = d.colors;
    frameRect(ctx, 1, 6, d.w - 2, d.h - 7, red);
    ctx.fillStyle = shade(red, 0.25);
    ctx.fillRect(3, 8, 2, d.h - 12);
    ctx.fillStyle = black;
    ctx.fillRect(d.w / 2 - 2, 1, 4, 5);
    ctx.fillRect(d.w / 2 + 1, 2, 4, 2);
    ctx.fillStyle = '#e8e4dc';
    ctx.fillRect(3, d.h * 0.45, d.w - 6, 5);
  },
};

export function drawWallFurni(ctx: CanvasRenderingContext2D, def: WallFurniDef, state: number, seed: number, t: number) {
  const f = draws[def.kind];
  if (f) f(ctx, def, state, seed, t);
  else frameRect(ctx, 0, 0, def.w, def.h, def.colors[0] ?? '#888');
}

export function wallLights(def: WallFurniDef, state: number): WallLight[] {
  const on = state === 0;
  switch (def.kind) {
    case 'window':
      return on ? [{ x: def.w / 2, y: def.h / 2, radius: 140, color: '#6fa8ff', intensity: 0.55, kind: 'natural' }] : [];
    case 'sconce':
      return on ? [{ x: 8, y: 6, radius: 120, color: '#ffb45a', intensity: 0.9, flicker: 0.12, kind: 'fire' }] : [];
    case 'emergency':
      return on ? [{ x: def.w / 2, y: def.h / 2 + 4, radius: 170, color: '#ff2a1a', intensity: 0.8, pulse: 260, kind: 'emergency' }] : [];
    case 'neon':
      return on ? [{ x: def.w / 2, y: def.h / 2, radius: 110, color: def.colors[0], intensity: 0.65, flicker: 0.03, kind: 'electric' }] : [];
    case 'screen':
      return on ? [{ x: def.w / 2, y: def.h / 2, radius: 120, color: '#f2eadc', intensity: 0.45, kind: 'electric' }] : [];
    case 'tv':
      // só uma vida na parede: bem mais fraca que o fliperama (a que desliga, desligada, apaga)
      return def.states && !on ? [] : [{ x: def.w / 2, y: def.h * 0.35, radius: 85, color: '#a8e8b8', intensity: 0.26, flicker: 0.12, kind: 'electric' }];
    case 'cage_lamp':
      return on ? [{ x: def.w / 2, y: def.h * 0.55, radius: 150, color: def.colors[1] ?? '#ffd9a0', intensity: 0.7, flicker: 0.02, kind: 'electric' }] : [];
    case 'crack':
      // a luz dourada que vaza de dentro da rachadura (não é da Sede: o apagão não a apaga)
      return [{ x: def.w / 2, y: def.h * 0.45, radius: 150, color: def.colors[0], intensity: 0.95, flicker: 0.1, kind: 'fire' }];
    default:
      return [];
  }
}
