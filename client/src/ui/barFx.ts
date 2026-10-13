/**
 * Os efeitos dos dardos e da sinuca (08/10): faíscas, confete, pó, os números que sobem do lugar da
 * jogada, o tremor e o clarão, desenhados por cima do canvas do jogo (em pixels de tela de verdade,
 * já com a densidade do aparelho). E a faixa que atravessa o palco ("VEZ DE CATARINA").
 */
import { h } from './dom';

interface Peca {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  max: number;
  cor: string;
  tam: number;
  peso: number;
  /** confete: o papelzinho girando */
  giro: number;
}

interface Texto {
  x: number;
  y: number;
  t: string;
  vida: number;
  max: number;
  cor: string;
  tam: number;
}

const CONFETE = ['#f6cf6a', '#f0503f', '#4f9bff', '#79d98f', '#e070b0', '#ffffff'];
const reduzido = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export class Festa {
  private pecas: Peca[] = [];
  private textos: Texto[] = [];
  tremor = 0;
  private clarao = { cor: '#fff', vida: 0, max: 1 };

  /** `k` = pixels de tela por unidade (a densidade): os efeitos acompanham o tamanho do canvas. */
  constructor(public k = 1) {}

  faiscas(x: number, y: number, cor: string | string[], n = 12, vel = 4, peso = 0.12, vida = 30, tam = 3) {
    if (reduzido()) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = vel * (0.35 + Math.random() * 0.9) * this.k;
      const max = vida * (0.6 + Math.random() * 0.6);
      this.pecas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: max, max, cor: Array.isArray(cor) ? cor[i % cor.length] : cor, tam: tam * this.k, peso: peso * this.k, giro: 0 });
    }
  }

  /** Confete caindo de cima, na largura `w`. */
  confete(w: number, n = 70) {
    if (reduzido()) n = 16;
    for (let i = 0; i < n; i++) {
      const max = 90 + Math.random() * 70;
      this.pecas.push({
        x: Math.random() * w,
        y: -Math.random() * 120 * this.k,
        vx: (Math.random() - 0.5) * 2 * this.k,
        vy: (1.5 + Math.random() * 2.5) * this.k,
        vida: max,
        max,
        cor: CONFETE[i % CONFETE.length],
        tam: (4 + Math.random() * 3) * this.k,
        peso: 0.02 * this.k,
        giro: Math.random() * 6,
      });
    }
  }

  /** O número que sobe do lugar da jogada ("T20", "+60", "BOA!"). */
  texto(x: number, y: number, t: string, cor = '#ffd27a', tam = 18) {
    this.textos.push({ x, y, t, vida: 60, max: 60, cor, tam: tam * this.k });
  }

  tremer(n: number) {
    if (!reduzido()) this.tremor = Math.max(this.tremor, n * this.k);
  }

  piscar(cor: string, vida = 14) {
    this.clarao = { cor, vida, max: vida };
  }

  /** O deslocamento do tremor deste quadro (para o jogo transladar o desenho). */
  sacode() {
    const t = this.tremor;
    return t ? { x: (Math.random() * 2 - 1) * t, y: (Math.random() * 2 - 1) * t } : { x: 0, y: 0 };
  }

  passo() {
    for (const p of this.pecas) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.peso;
      p.vx *= p.giro ? 0.99 : 0.95;
      if (p.giro) (p.giro += 0.15), (p.x += Math.sin(p.giro) * 0.6 * this.k);
      p.vida--;
    }
    this.pecas = this.pecas.filter((p) => p.vida > 0);
    for (const t of this.textos) (t.y -= 0.7 * this.k), t.vida--;
    this.textos = this.textos.filter((t) => t.vida > 0);
    this.tremor = this.tremor < 0.3 ? 0 : this.tremor * 0.85;
    if (this.clarao.vida > 0) this.clarao.vida--;
  }

  desenhar(g: CanvasRenderingContext2D, w: number, hh: number) {
    for (const p of this.pecas) {
      g.globalAlpha = Math.min(1, (p.vida / p.max) * 2);
      g.fillStyle = p.cor;
      if (p.giro) {
        // o papelzinho de confete: fino quando está de lado
        const larg = Math.abs(Math.cos(p.giro)) * p.tam + 1;
        g.fillRect(p.x - larg / 2, p.y - p.tam / 3, larg, (p.tam * 2) / 3);
      } else g.fillRect(p.x - p.tam / 2, p.y - p.tam / 2, p.tam * (p.vida / p.max) + 1, p.tam * (p.vida / p.max) + 1);
    }
    g.globalAlpha = 1;
    for (const t of this.textos) {
      const nasce = Math.min(1, (t.max - t.vida) / 8);
      const escala = 0.6 + nasce * 0.4 + (nasce < 1 ? 0.25 * Math.sin(nasce * Math.PI) : 0);
      g.save();
      g.globalAlpha = Math.min(1, t.vida / 20);
      g.translate(t.x, t.y);
      g.scale(escala, escala);
      g.font = `700 ${Math.round(t.tam)}px 'Pixel Numeros', 'Pixelify Sans', monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 4 * this.k;
      g.strokeStyle = 'rgba(20, 10, 2, 0.9)';
      g.strokeText(t.t, 0, 0);
      g.fillStyle = t.cor;
      g.fillText(t.t, 0, 0);
      g.restore();
    }
    if (this.clarao.vida > 0) {
      g.globalAlpha = (this.clarao.vida / this.clarao.max) * 0.35;
      g.fillStyle = this.clarao.cor;
      g.fillRect(0, 0, w, hh);
      g.globalAlpha = 1;
    }
  }
}

/** A faixa que atravessa o palco: entra pela esquerda, fica um instante e sai pela direita. */
export function faixa(palco: HTMLElement, texto: string, tipo: 'vez' | 'minha' | 'ruim' | 'festa' = 'vez') {
  palco.querySelector('.bj-faixa')?.remove();
  const el = h('div', { class: `bj-faixa ${tipo}`, 'aria-live': 'polite' }, h('span', null, texto));
  palco.append(el);
  el.addEventListener('animationend', (e) => {
    if ((e as AnimationEvent).animationName === 'bj-faixa') el.remove();
  });
}
