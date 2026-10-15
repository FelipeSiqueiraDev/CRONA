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
  kind?: 'fire' | 'electric' | 'natural' | 'emergency' | 'personal';
  /** onde a luz fica no cômodo (casas: x, y e a altura): só a luz do cenário tem, e só ela projeta a sombra das peças */
  mundo?: [number, number, number];
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
    l.fillStyle = ambient ? rgba(shade(ambient, -0.86), darkness) : `rgba(6,4,12,${darkness})`;
    l.fillRect(0, 0, W, H);
    l.globalCompositeOperation = 'destination-out';
    const active = lights.map((L) => {
      const [x, y] = toDev(L.x, L.y);
      let f = L.flicker ? 1 - L.flicker * (0.5 + 0.5 * Math.sin(t / 90 + (L.seed ?? 0) * 3.1) * Math.sin(t / 237 + (L.seed ?? 0))) : 1;
      if (L.pulse) f *= 0.35 + 0.65 * Math.max(0, Math.sin(t / L.pulse));
      return { x, y, r: L.radius * scale * (0.97 + 0.03 * f), i: Math.min(1, L.intensity * f), c: L.color };
    });
    for (const a of active) {
      if (a.x + a.r < 0 || a.y + a.r < 0 || a.x - a.r > W || a.y - a.r > H) continue;
      const g = l.createRadialGradient(a.x, a.y, 0, a.x, a.y, a.r);
      g.addColorStop(0, `rgba(0,0,0,${a.i})`);
      g.addColorStop(0.4, `rgba(0,0,0,${a.i * 0.7})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g;
      l.beginPath();
      l.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      l.fill();
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
      const g = main.createRadialGradient(a.x, a.y, 0, a.x, a.y, r);
      g.addColorStop(0, rgba(a.c, 0.2 * a.i));
      g.addColorStop(0.5, rgba(a.c, 0.07 * a.i));
      g.addColorStop(1, rgba(a.c, 0));
      main.fillStyle = g;
      main.beginPath();
      main.arc(a.x, a.y, r, 0, Math.PI * 2);
      main.fill();
    }
    main.restore();
  }
}
