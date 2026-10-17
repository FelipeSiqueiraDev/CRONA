import type { ParticleKind, RoomMap } from '@crona/shared';
import { rgba } from './color';
import { iso } from './iso';
import { fogoVivo, type Light } from './lighting';
import { apagandoDe, esquecerSopros, SOPRO_MS } from './sopro';

/**
 * A vida do cômodo (só enfeite, cada tela sorteia a sua). Desde 14/10 vale em TODAS as cenas (o Felipe: "as chamas
 * estão estáticas e mortas... particulazinhas sutis mas que trazem vida"), mesmo sem partículas escolhidas na cena:
 *  - a chama: em cima de cada fogo (lareira, fogueira, vela, tocha, fogão), as línguas que mexem e o brilho que respira;
 *  - o feixe da janela: a luz entrando e caindo no chão, respirando devagar;
 *  - poeira: pontinhos flutuando que só aparecem onde tem luz (no feixe da janela, perto do fogo);
 *  - fumaça: fios subindo das velas, candelabros e arandelas;
 *  - brasas: faíscas subindo do fogo, de vez em quando.
 * As escolhidas na cena (Ambiente) valem com a quantidade escolhida; as que entram sozinhas, mais discretas.
 */

interface P {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  seed: number;
  /** fumaça em fio (a da vela soprada): fina e enrolando, em vez do rolo que abre */
  fio?: boolean;
}

/** O fio de fumaça da vela soprada sobe do pavio até aqui (ms, contando de quando ela apagou). */
const FUMACA_MS = 2600;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Particles {
  private list: P[] = [];
  private kinds = new Set<ParticleKind>();
  /** caixa do chão do cômodo, em px de mundo */
  private box = { x0: 0, x1: 0, y0: 0, y1: 0 };
  private tiles = 0;
  private last = 0;
  private emit = new Map<string, number>();
  /** quanto de cada partícula: 1 a escolhida na cena; menos a que entra sozinha */
  private peso: Record<'dust' | 'smoke' | 'embers', number> = { dust: 1, smoke: 1, embers: 1 };

  setRoom(map: RoomMap, kinds: string[] | undefined, aberto = false) {
    const escolhidas = new Set((kinds ?? []).filter((k): k is ParticleKind => k === 'dust' || k === 'smoke' || k === 'embers'));
    // todas entram; as que a cena não escolheu ficam discretas (a poeira ao ar livre quase some: só perto da luz)
    this.kinds = new Set<ParticleKind>(['dust', 'smoke', 'embers']);
    this.peso = {
      dust: escolhidas.has('dust') ? 1 : aberto ? 0.25 : 0.55,
      smoke: escolhidas.has('smoke') ? 1 : 0.7,
      embers: escolhidas.has('embers') ? 1 : 0.8,
    };
    this.list = [];
    this.emit.clear();
    this.sopros.clear();
    esquecerSopros();
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    let n = 0;
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const h = map.floorHeight(x, y);
        if (h === null) continue;
        n++;
        const [sx, sy] = iso(x + 0.5, y + 0.5, h);
        x0 = Math.min(x0, sx);
        x1 = Math.max(x1, sx);
        y0 = Math.min(y0, sy);
        y1 = Math.max(y1, sy);
      }
    this.tiles = n;
    this.box = { x0, x1, y0: y0 - 110, y1 };
  }

  get active() {
    return this.kinds.size > 0;
  }

  /** Luz no ponto (0..1): quanto ele está perto de alguma fonte. */
  private lightAt(x: number, y: number, lights: Light[]) {
    let s = 0;
    let c = '#fff2d8';
    let best = 0;
    for (const L of lights) {
      const d = Math.hypot(x - L.x, y - L.y);
      if (d >= L.radius) continue;
      const v = (1 - d / L.radius) * L.intensity;
      s += v;
      if (v > best) {
        best = v;
        c = L.color;
      }
    }
    return { v: Math.min(1, s), c };
  }

  /** Avança e desenha (coordenadas de mundo; o ctx já está na câmera). level = quantidade 0..1; escuro = 0..1. */
  draw(ctx: CanvasRenderingContext2D, now: number, lights: Light[], level: number, escuro = 0.5) {
    if (!this.kinds.size) return;
    const dt = Math.max(0, Math.min(0.1, (now - (this.last || now)) / 1000));
    this.last = now;
    level = Math.max(0, Math.min(1, level));
    const tempo = now / 1000;
    // a luz da janela e o fogo vivo vêm antes das partículas (a poeira passa por dentro do feixe)
    for (const L of lights) if (L.feixe) this.feixe(ctx, L, tempo, escuro);
    // a chama que já vai desenhada na ordem de profundidade (chamaNaOrdem) só deixa aqui o brilho: quem está na frente
    // do fogo tapa a chama, não é atravessado por ela
    for (const L of lights) if (L.kind === 'fire') this.chama(ctx, L, tempo, L.chamaNaOrdem ? 'brilho' : 'tudo');
    // poeira: no máximo uma por casa e meia (160 no total), vezes a quantidade escolhida
    if (this.kinds.has('dust')) {
      const want = Math.round(Math.min(160, this.tiles / 1.5) * level * this.peso.dust);
      let dust = 0;
      for (const p of this.list) if (p.kind === 'dust') dust++;
      // baixou a quantidade: as que sobram somem
      for (let i = this.list.length - 1; i >= 0 && dust > want; i--)
        if (this.list[i].kind === 'dust') {
          this.list.splice(i, 1);
          dust--;
        }
      for (; dust < want; dust++) {
        const b = this.box;
        this.list.push({ kind: 'dust', x: rand(b.x0, b.x1), y: rand(b.y0, b.y1), vx: rand(-3, 3), vy: rand(-2.5, 1.5), age: rand(0, 6), life: rand(7, 14), size: rand(0.6, 1.5), seed: Math.random() * 100 });
      }
    }
    // fumaça e brasas saem do fogo
    // a vela soprada (sopro.ts): guarda onde ela fica, para o fio de fumaça subir dali depois que a chama some
    for (const L of lights) {
      const a = L.kind === 'fire' && L.seed !== undefined ? apagandoDe(L.seed) : 0;
      if (a > 0 && !this.sopros.has(L.seed!)) this.sopros.set(L.seed!, { L, t0: now - a * SOPRO_MS, proxima: 0 });
    }
    for (const [seed, so] of this.sopros) if (now >= so.t0 + FUMACA_MS) this.sopros.delete(seed);
    const fire = lights.filter((L) => L.kind === 'fire' && !(L.seed !== undefined && this.sopros.has(L.seed) && apagandoDe(L.seed) > 0));
    // o fio de fumaça: sobe fino e enrolando do pavio, quando a chama está quase sumindo
    for (const so of this.sopros.values()) {
      const k = (now - so.t0) / SOPRO_MS;
      if (k < 0.55 || now >= so.t0 + FUMACA_MS || now < so.proxima) continue;
      so.proxima = now + rand(55, 95);
      const ainda = 1 - (now - so.t0) / FUMACA_MS;
      this.list.push({ kind: 'smoke', x: so.L.x + rand(-0.4, 0.4), y: so.L.y - 3, vx: rand(-1, 1), vy: rand(-13, -9), age: 0, life: rand(1.6, 2.4), size: 0.5 + 0.5 * ainda, seed: so.L.x * 0.37, fio: true });
    }
    for (const L of fire) {
      const key = `${Math.round(L.x)},${Math.round(L.y)}`;
      const next = this.emit.get(key) ?? now + rand(0, 800);
      if (now < next) {
        this.emit.set(key, next);
        continue;
      }
      // menos quantidade = cada vela solta fumaça e brasa mais de vez em quando
      this.emit.set(key, now + rand(380, 700) / Math.max(0.15, level));
      if (Math.random() > level) continue;
      if (this.kinds.has('smoke') && Math.random() < this.peso.smoke) this.list.push({ kind: 'smoke', x: L.x + rand(-2, 2), y: L.y - 6, vx: rand(-2, 2), vy: rand(-16, -10), age: 0, life: rand(2.2, 3.6), size: rand(1.5, 2.5), seed: Math.random() * 100 });
      // fogo grande (lareira, fogueira) solta mais brasa que a vela
      if (this.kinds.has('embers') && Math.random() < (L.radius >= 200 ? 0.55 : 0.22) * this.peso.embers) this.list.push({ kind: 'embers', x: L.x + rand(-3, 3), y: L.y - 4, vx: rand(-6, 6), vy: rand(-28, -16), age: 0, life: rand(0.8, 1.8), size: rand(0.8, 1.4), seed: Math.random() * 100 });
    }
    if (this.list.length > 420) this.list.splice(0, this.list.length - 420);

    const t = now / 1000;
    ctx.save();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.list.splice(i, 1);
        continue;
      }
      const k = p.age / p.life;
      const fade = Math.min(1, k * 5) * Math.min(1, (1 - k) * 4);
      if (p.kind === 'dust') {
        p.x += (p.vx + Math.sin(t * 0.7 + p.seed) * 2) * dt;
        p.y += (p.vy + Math.cos(t * 0.5 + p.seed) * 1.5) * dt;
        const L = this.lightAt(p.x, p.y, lights);
        const a = fade * (0.04 + 0.75 * L.v);
        if (a < 0.02) continue;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba(L.c, a);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'smoke') {
        // o fio enrola mais quanto mais sobe; o rolo da chama acesa balança e abre
        p.x += (p.vx + (p.fio ? Math.sin(t * 2.6 + p.seed + p.age * 3) * 2.5 * (0.3 + k) : Math.sin(t * 2 + p.seed) * 5)) * dt;
        p.y += p.vy * dt;
        const r = p.size + k * (p.fio ? 3.5 : 9);
        ctx.globalCompositeOperation = 'source-over';
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        // o fio é mais cinza e mais denso: aparece contra a parede clara e no escuro
        const cor = p.fio ? '120,114,108' : '160,150,140';
        g.addColorStop(0, `rgba(${cor},${(p.fio ? 0.42 : 0.16) * fade * (1 - k)})`);
        g.addColorStop(1, `rgba(${cor},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      } else {
        p.x += (p.vx + Math.sin(t * 9 + p.seed) * 8) * dt;
        p.y += p.vy * dt;
        p.vy *= 0.99;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,${150 + Math.round(80 * (1 - k))},60,${0.9 * fade})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** as velas sopradas agora há pouco (sopro.ts): onde fica o pavio e quando apagou, para o fio de fumaça */
  private sopros = new Map<number, { L: Light; t0: number; proxima: number }>();

  /** o fogo em pixel de cada chama (a grade de calor que queima sozinha), pela semente da luz */
  private fogos = new Map<string, FogoPx>();

  /**
   * A chama viva, EM PIXEL (15/10, o Felipe: "que fogueira zuada": a chama lisa por cima da pixel art não servia): uma
   * gradezinha de calor que queima sozinha, como nos jogos de pixel (o calor nasce embaixo, sobe esfriando e balança
   * para os lados), pintada pixel a pixel com a paleta do fogo do tabuleiro, sem suavizar, 12 quadros por segundo.
   * Fica por cima da chama desenhada, no mesmo tamanho: é ela que parece dançar. E o brilho em volta respira.
   */
  chama(ctx: CanvasRenderingContext2D, L: Light, t: number, parte: 'tudo' | 'brilho' | 'chama' = 'tudo') {
    if (L.intensity <= 0.05) return;
    // o tamanho pelo fogo: a fogueira e a lareira grandes, a tocha média, a vela pequena
    const tipo = L.radius >= 200 ? FOGO_GRANDE : L.radius >= 140 ? FOGO_MEDIO : FOGO_PEQUENO;
    const chave = `${L.seed ?? 0}:${Math.round(L.x)}:${Math.round(L.y)}:${tipo.w}`;
    let f = this.fogos.get(chave);
    if (!f || f.tipo !== tipo) {
      f = novoFogo(tipo);
      this.fogos.set(chave, f);
    }
    const quadro = Math.floor(t * 12);
    if (parte !== 'brilho' && quadro !== f.quadro) {
      f.quadro = quadro;
      queimar(f);
    }
    // o brilho respira junto com a luz do fogo (lighting.ts, fogoVivo, no mesmo relógio)
    const vivo = fogoVivo(Date.now(), L.seed ?? 0);
    const tremor = 0.72 + 0.28 * vivo.f;
    // soprada (sopro.ts): a chama perde o calor de cima para baixo (encolhe para o pavio) e some
    const sopro = apagandoDe(L.seed);
    // e, acesa, baixa um pouco quando o fogo engasga (a chama encolhe e volta, como a de verdade)
    const perde = Math.round(sopro * sopro * 11 + (1 - vivo.f) * 2.2);
    // a chama pequena pende um pixel para o lado no balanço do ar
    const x0 = Math.round(L.x - tipo.w / 2 + (tipo === FOGO_PEQUENO ? vivo.dx * 0.9 : 0));
    const y0 = Math.round(L.y + tipo.base - tipo.h);
    ctx.save();
    // o brilho em volta (macio: é luz, não desenho)
    if (parte !== 'chama') {
      ctx.globalCompositeOperation = 'lighter';
      const r = tipo.brilho * (0.92 + 0.08 * tremor);
      const cx = L.x;
      const cy = y0 + tipo.h * 0.6;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(255,160,70,${0.14 * tremor * L.intensity})`);
      g.addColorStop(1, 'rgba(255,110,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    if (parte === 'brilho') {
      ctx.restore();
      return;
    }
    // a chama, pixel a pixel
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = Math.min(1, 0.4 + L.intensity * 0.6);
    for (let y = 0; y < tipo.h; y++)
      for (let x = 0; x < tipo.w; x++) {
        const q = f.calor[y * tipo.w + x] - perde - (sopro > 0 ? Math.round((1 - y / tipo.h) * sopro * 6) : 0);
        if (q < 2) continue;
        ctx.fillStyle = PALETA_FOGO[Math.min(PALETA_FOGO.length - 1, q)];
        ctx.fillRect(x0 + x, y0 + y, 1, 1);
      }
    ctx.restore();
  }

  /**
   * O feixe da janela: a luz entra pela janela, desce para dentro do cômodo e cai no chão (o desenho da janela
   * projetado no piso), mais forte perto da janela e sumindo no chão, respirando devagar (a nuvem que passa).
   */
  private feixe(ctx: CanvasRenderingContext2D, L: Light, t: number, escuro: number) {
    const f = L.feixe;
    if (!f || L.intensity <= 0.05) return;
    // o quanto a luz anda para dentro por unidade de altura que desce
    const anda = 0.95;
    const pontos = (z: number) => {
      const d = Math.max(0, z - f.chao) * anda;
      return [-1, 1].map((lado) => {
        const ao = f.pos + (lado * f.larg) / 2;
        return f.wall === 'l'
          ? { w: iso(f.plane + 0.05, ao, z), c: iso(f.plane + 0.05 + d, ao, f.chao) }
          : { w: iso(ao, f.plane + 0.05, z), c: iso(ao, f.plane + 0.05 + d, f.chao) };
      });
    };
    const [b0, b1] = pontos(f.z0);
    const [t0, t1] = pontos(f.z1);
    const respira = 0.82 + 0.18 * Math.sin(t * 0.45 + (L.seed ?? 0)) * Math.sin(t * 0.17 + (L.seed ?? 0) * 2);
    // mais visível no escuro (no claro, o feixe quase não aparece)
    const a = (0.05 + 0.09 * Math.min(1, escuro * 1.3)) * respira * L.intensity;
    const [cr, cg, cb] = corRgb(L.color);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // o volume: da janela até a mancha no chão (o contorno de tudo)
    const casca = envoltoria([b0.w, b1.w, t0.w, t1.w, b0.c, b1.c, t0.c, t1.c]);
    const mx = (b0.w[0] + t1.w[0]) / 2;
    const my = (b0.w[1] + t1.w[1]) / 2;
    const fx = (t0.c[0] + t1.c[0]) / 2;
    const fy = (t0.c[1] + t1.c[1]) / 2;
    const g = ctx.createLinearGradient(mx, my, fx, fy);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
    g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    casca.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    // a mancha da janela no chão
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${a * 0.9})`;
    ctx.beginPath();
    ctx.moveTo(b0.c[0], b0.c[1]);
    ctx.lineTo(b1.c[0], b1.c[1]);
    ctx.lineTo(t1.c[0], t1.c[1]);
    ctx.lineTo(t0.c[0], t0.c[1]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/** "#rrggbb" -> [r, g, b]. */
function corRgb(c: string): [number, number, number] {
  const h = c.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A envoltória convexa dos pontos (a cadeia monótona), no sentido da volta. */
function envoltoria(p: [number, number][]): [number, number][] {
  const q = [...p].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const giro = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const baixo: [number, number][] = [];
  for (const x of q) {
    while (baixo.length >= 2 && giro(baixo[baixo.length - 2], baixo[baixo.length - 1], x) <= 0) baixo.pop();
    baixo.push(x);
  }
  const cima: [number, number][] = [];
  for (let i = q.length - 1; i >= 0; i--) {
    const x = q[i];
    while (cima.length >= 2 && giro(cima[cima.length - 2], cima[cima.length - 1], x) <= 0) cima.pop();
    cima.push(x);
  }
  return baixo.slice(0, -1).concat(cima.slice(0, -1));
}

// ---------------------------------------------------------------- o fogo em pixel

/** A paleta do fogo (do frio para o quente): o vermelho escuro da borda, o laranja, o amarelo e o miolo quase branco. */
const PALETA_FOGO = ['', '', '#5a1408', '#8a2210', '#b8380e', '#d8561a', '#ee7a22', '#f89a2e', '#ffbb44', '#ffd664', '#ffeaa0', '#fff8dc'];

interface TipoFogo {
  w: number;
  h: number;
  /** onde fica o pé da chama, em px abaixo do ponto da luz */
  base: number;
  /** o raio do brilho em volta */
  brilho: number;
  /** quanto o calor perde por linha (maior = chama mais baixa) */
  perde: number;
}
const FOGO_GRANDE: TipoFogo = { w: 15, h: 22, base: 7, brilho: 26, perde: 0.62 };
const FOGO_MEDIO: TipoFogo = { w: 7, h: 12, base: 4, brilho: 15, perde: 0.95 };
const FOGO_PEQUENO: TipoFogo = { w: 3, h: 6, base: 2, brilho: 8, perde: 1.4 };

interface FogoPx {
  tipo: TipoFogo;
  calor: Uint8Array;
  quadro: number;
}

function novoFogo(tipo: TipoFogo): FogoPx {
  const f: FogoPx = { tipo, calor: new Uint8Array(tipo.w * tipo.h), quadro: -1 };
  // já nasce queimando (sem o quadro de "acendendo")
  for (let i = 0; i < tipo.h * 2; i++) queimar(f);
  return f;
}

/**
 * Um passo do fogo: a linha de baixo nasce quente (mais no meio), e cada pixel acima pega o calor do de baixo (às vezes
 * do vizinho, o balanço), perdendo um pouco; perto das bordas perde mais, e a chama afina em ponta.
 */
function queimar(f: FogoPx) {
  const { w, h, perde } = f.tipo;
  const c = f.calor;
  const topo = PALETA_FOGO.length - 1;
  const meio = (w - 1) / 2;
  for (let x = 0; x < w; x++) {
    const borda = Math.abs(x - meio) / Math.max(1, meio);
    c[(h - 1) * w + x] = Math.max(0, Math.round(topo - borda * 5 - Math.random() * 2.2));
  }
  for (let y = 0; y < h - 1; y++)
    for (let x = 0; x < w; x++) {
      const dx = Math.round(Math.random() * 2 - 1);
      const sx = Math.min(w - 1, Math.max(0, x + dx));
      const de = c[(y + 1) * w + sx];
      const borda = Math.abs(x - meio) / Math.max(1, meio);
      const perda = (Math.random() < 0.5 ? 0 : 1) * perde + borda * borda * 1.6 + (Math.random() < perde * 0.35 ? 1 : 0);
      c[y * w + x] = Math.max(0, Math.round(de - perda));
    }
}

