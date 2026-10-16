import { rgba, shade } from './color';

/** Luz em coordenadas de mundo (px). */
export interface Light {
  x: number;
  y: number;
  radius: number;
  color: string;
  intensity: number;
  flicker?: number;
  /** período (ms) de pulsação, ex.: luz de emergência */
  pulse?: number;
  seed?: number;
  /** usado pelo clima do quarto (apagão/piscando) */
  /** cristal: o brilho dos cristais de Santo Berço (sem chama, sem fumaça, sem brasa; respira devagar) */
  kind?: 'fire' | 'electric' | 'natural' | 'emergency' | 'personal' | 'cristal';
  /** onde a luz fica no cômodo (casas: x, y e a altura): só a luz do cenário tem, e só ela projeta a sombra das peças */
  mundo?: [number, number, number];
  /** a chama em pixel desta luz de fogo vai desenhada na ordem de profundidade (RoomView): quem fica na frente dela a tapa */
  chamaNaOrdem?: boolean;
  /** o móvel de chão de onde a luz sai (o id do item): a frente dele volta por cima da chama (frenteDoFogo) */
  movel?: number;
  /** a janela de onde a luz entra (o feixe que cai no chão; particles.ts): a parede, o plano, o meio, a largura e a altura */
  feixe?: { wall: 'l' | 'r'; plane: number; pos: number; larg: number; z0: number; z1: number; chao: number };
}

/** Mapa de luz: escurece a cena e "fura" a escuridão onde há luz, depois soma um brilho colorido. */
export class Lighting {
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;

  render(
    main: CanvasRenderingContext2D,
    lights: Light[],
    darkness: number,
    toDev: (x: number, y: number) => [number, number],
    scale: number,
    t: number,
    ambient?: string,
  ) {
    const W = main.canvas.width;
    const H = main.canvas.height;
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W;
      this.canvas.height = H;
    }
    const l = this.ctx;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, W, H);
    // o escuro puxa para a cor do cômodo (roxo na tecnologia, vermelho nos rituais...)
    // (e sempre com um fundo azul-violeta: a sombra fria contra a luz quente é o que dá o contraste de cor das cenas bonitas)
    l.fillStyle = ambient ? rgba(esfriar(shade(ambient, -0.86)), darkness) : `rgba(14,11,34,${darkness})`;
    l.fillRect(0, 0, W, H);
    l.globalCompositeOperation = 'destination-out';
    const active = lights.map((L) => {
      const [x, y] = toDev(L.x, L.y);
      let f = L.flicker ? 1 - L.flicker * (0.5 + 0.5 * Math.sin(t / 90 + (L.seed ?? 0) * 3.1) * Math.sin(t / 237 + (L.seed ?? 0))) : 1;
      if (L.pulse) f *= 0.35 + 0.65 * Math.max(0, Math.sin(t / L.pulse));
      // a luz baixa (lareira, fogueira, vela) cai no chão: a poça é uma elipse (o círculo do piso visto na diagonal);
      // a luz alta (lanterna na parede, lustre) fica redonda
      const k = L.mundo && L.mundo[2] < 1 ? 0.62 : 1;
      return { x, y, r: L.radius * scale * (0.97 + 0.03 * f), i: Math.min(1, L.intensity * f), c: L.color, k };
    });
    for (const a of active) {
      if (a.x + a.r < 0 || a.y + a.r < 0 || a.x - a.r > W || a.y - a.r > H) continue;
      l.save();
      l.translate(a.x, a.y);
      l.scale(1, a.k);
      const g = l.createRadialGradient(0, 0, 0, 0, 0, a.r);
      g.addColorStop(0, `rgba(0,0,0,${a.i})`);
      g.addColorStop(0.4, `rgba(0,0,0,${a.i * 0.7})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g;
      l.beginPath();
      l.arc(0, 0, a.r, 0, Math.PI * 2);
      l.fill();
      l.restore();
    }
    main.save();
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.drawImage(this.canvas, 0, 0);
    main.globalCompositeOperation = 'lighter';
    // um véu bem leve da cor do ambiente no ar
    if (ambient) {
      main.fillStyle = rgba(ambient, 0.035);
      main.fillRect(0, 0, W, H);
    }
    for (const a of active) {
      if (a.x + a.r < 0 || a.y + a.r < 0 || a.x - a.r > W || a.y - a.r > H) continue;
      const r = a.r * 0.85;
      main.save();
      main.translate(a.x, a.y);
      main.scale(1, a.k);
      // a poça de luz colorida: o núcleo quente, o meio e a borda (a cor da luz "pinta" o chão e a parede em volta)
      const g = main.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, rgba(a.c, 0.3 * a.i));
      g.addColorStop(0.35, rgba(a.c, 0.16 * a.i));
      g.addColorStop(0.7, rgba(a.c, 0.06 * a.i));
      g.addColorStop(1, rgba(a.c, 0));
      main.fillStyle = g;
      main.beginPath();
      main.arc(0, 0, r, 0, Math.PI * 2);
      main.fill();
      main.restore();
    }
    main.restore();
  }
}

/** Puxa uma cor escura para o azul-violeta (a sombra fria): metade do caminho até #0e0b22. */
function esfriar(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6), 16);
  const m = (v: number, alvo: number) => Math.round(v * 0.45 + alvo * 0.55);
  const r = m((n >> 16) & 255, 14);
  const g = m((n >> 8) & 255, 11);
  const b = m(n & 255, 34);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}
