/**
 * Texturas do protótipo 3D do Bar (todas desenhadas por código num canvas, sem arquivo de imagem): o piso de madeira, a
 * parede (rodapé de madeira e reboco), a janela da noite, as janelas acesas dos prédios e o tapete.
 */
import * as THREE from 'three';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Sorteio com semente (para as texturas serem iguais em toda abertura). */
export function sorteio(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tex(c: HTMLCanvasElement, repete = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repete) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A altura da parede (o pé-direito do bar, em metros) e a largura de metros que a textura da parede cobre. */
export const PAREDE_ALTURA = 2.8;
export const PAREDE_LARGURA = 1.5;
/** O lado, em metros, que a textura do piso cobre. */
export const PISO_LADO = 3;

/**
 * O piso de tábuas de verdade: a textura cobre 3 m × 3 m com 25 fileiras de tábuas de 12 cm de largura, cada fileira com
 * as suas emendas (tábuas de 0,9 a 2,2 m) deslocadas, o veio, os nós e o desgaste. As tábuas que passam da borda da textura
 * continuam do outro lado com a mesma cor, então não se vê a emenda do quadrado.
 */
export function pisoMadeira(): THREE.CanvasTexture {
  const T = 1000;
  const [c, g] = canvas(T, T);
  const r = sorteio(7);
  const fileiras = 25;
  const h = T / fileiras;
  const pxM = T / PISO_LADO;
  g.fillStyle = '#2a1608';
  g.fillRect(0, 0, T, T);
  const retangulo = (x: number, y: number, w: number, hh: number) => {
    // a tábua que passa da borda direita continua na esquerda
    if (x + w <= T) return [[x, w, 0]] as [number, number, number][];
    return [[x, T - x, 0], [0, x + w - T, T - x]] as [number, number, number][];
  };
  for (let i = 0; i < fileiras; i++) {
    const y = i * h;
    let x = r() * T;
    const inicio = x;
    while (x < inicio + T - 1) {
      const comp = Math.min(inicio + T - x, (0.9 + r() * 1.3) * pxM);
      const base = 66 + r() * 34;
      const quente = r() * 10;
      const cor = `rgb(${base + 40 + quente},${base + 14},${base - 16})`;
      const sementeVeio = r();
      for (const [xx, ww, deslocamento] of retangulo(x % T, y, comp, h)) {
        g.fillStyle = cor;
        g.fillRect(xx, y, ww, h);
        // o veio: linhas longas, na direção da tábua, que continuam de uma parte para a outra
        const rv = sorteio((sementeVeio * 1e6) | 0);
        for (let k = 0; k < 9; k++) {
          const ly = y + 3 + rv() * (h - 6);
          const lx = rv() * comp - deslocamento;
          const len = 40 + rv() * 220;
          g.fillStyle = `rgba(${rv() < 0.55 ? '34,17,6' : '214,164,100'},${0.06 + rv() * 0.13})`;
          const a = Math.max(xx, xx + lx);
          const b = Math.min(xx + ww, xx + lx + len);
          if (b > a) g.fillRect(a, ly, b - a, 1);
        }
        // o desgaste das quinas e a luz do topo da tábua
        g.fillStyle = 'rgba(255,224,170,0.1)';
        g.fillRect(xx, y + 2, ww, 2);
        g.fillStyle = 'rgba(12,5,1,0.35)';
        g.fillRect(xx, y + h - 4, ww, 3);
      }
      // um nó de vez em quando
      if (r() < 0.14) {
        const kx = (x + comp * (0.2 + r() * 0.6)) % T;
        const ky = y + 8 + r() * (h - 16);
        g.fillStyle = 'rgba(30,14,5,0.55)';
        g.beginPath();
        g.ellipse(kx, ky, 4 + r() * 3, 2.4 + r() * 1.4, 0, 0, 7);
        g.fill();
      }
      // a emenda de topo
      g.fillStyle = 'rgba(12,5,1,0.9)';
      g.fillRect(x % T, y, 2, h);
      x += comp;
    }
    // a fresta entre as fileiras
    g.fillStyle = 'rgba(10,4,1,0.92)';
    g.fillRect(0, y, T, 2);
  }
  // a mancha de uso e a sujeira, em manchas largas
  for (let k = 0; k < 26; k++) {
    g.fillStyle = `rgba(${r() < 0.6 ? '20,10,4' : '255,220,160'},${0.025 + r() * 0.045})`;
    g.beginPath();
    g.ellipse(r() * T, r() * T, 30 + r() * 120, 14 + r() * 50, r() * 3, 0, 7);
    g.fill();
  }
  return tex(c);
}

/**
 * A parede do bar em escala de verdade (a textura cobre 1,5 m × 2,8 m, a 340 px por metro): rodapé de 12 cm, lambri de
 * madeira com três almofadas de 50 cm até 0,90 m, o guarda-cadeira de 5 cm, o papel de parede de listras e floral miúdo
 * (o desenho se repete a cada 12 cm) manchado de fumaça, e a moldura de teto de 8 cm.
 */
export function parede(): THREE.CanvasTexture {
  const W = 512;
  const H = 952;
  const [c, g] = canvas(W, H);
  const r = sorteio(11);
  const pxM = W / PAREDE_LARGURA;
  const y = (m: number) => H - m * pxM; // altura em metros → pixel
  // o papel de parede
  g.fillStyle = '#8c6a3e';
  g.fillRect(0, 0, W, H);
  const periodo = 0.12 * pxM;
  for (let x = 0; x < W; x += periodo) {
    g.fillStyle = 'rgba(60,36,14,0.22)';
    g.fillRect(x, 0, periodo * 0.18, H);
    g.fillStyle = 'rgba(255,226,170,0.07)';
    g.fillRect(x + periodo * 0.5, 0, periodo * 0.08, H);
  }
  // o floral miúdo (losangos com ponto), em fileiras alternadas
  for (let fy = y(2.72); fy < y(0.95); fy += periodo) {
    const k = Math.round((fy - y(2.72)) / periodo) % 2;
    for (let x = periodo * (0.5 + k * 0.5); x < W + periodo; x += periodo) {
      g.fillStyle = 'rgba(48,26,10,0.34)';
      g.beginPath();
      g.moveTo(x, fy - 7);
      g.lineTo(x + 5, fy);
      g.lineTo(x, fy + 7);
      g.lineTo(x - 5, fy);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(234,190,110,0.3)';
      g.fillRect(x - 1, fy - 1, 2, 2);
    }
  }
  // o reboco manchado e a fumaça perto do teto
  for (let i = 0; i < 1100; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '255,235,200' : '40,24,10'},${0.015 + r() * 0.04})`;
    g.fillRect(r() * W, r() * y(0.95), 2 + r() * 16, 2 + r() * 8);
  }
  const fumaca = g.createLinearGradient(0, 0, 0, y(2.0));
  fumaca.addColorStop(0, 'rgba(20,10,4,0.5)');
  fumaca.addColorStop(1, 'rgba(20,10,4,0)');
  g.fillStyle = fumaca;
  g.fillRect(0, 0, W, y(2.0));
  // o lambri: três almofadas de 50 cm entre 0,12 m e 0,90 m
  const topoL = y(0.9);
  const baseL = y(0.12);
  g.fillStyle = '#3a2214';
  g.fillRect(0, topoL, W, baseL - topoL);
  const larg = W / 3;
  for (let i = 0; i < 3; i++) {
    const x0 = i * larg;
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(x0, topoL, 3, baseL - topoL);
    const mx = 0.06 * pxM;
    g.fillStyle = '#4a2c1a';
    g.fillRect(x0 + mx, topoL + mx, larg - 2 * mx, baseL - topoL - 2 * mx);
    g.fillStyle = 'rgba(255,196,130,0.1)';
    g.fillRect(x0 + mx, topoL + mx, larg - 2 * mx, 3);
    g.fillRect(x0 + mx, topoL + mx, 3, baseL - topoL - 2 * mx);
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(x0 + mx, baseL - mx - 3, larg - 2 * mx, 3);
    g.fillRect(x0 + larg - mx - 3, topoL + mx, 3, baseL - topoL - 2 * mx);
    for (let k = 0; k < 10; k++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '24,12,4' : '210,150,90'},${0.06 + r() * 0.1})`;
      g.fillRect(x0 + mx + r() * (larg - 2 * mx), topoL + mx + r() * (baseL - topoL - 2 * mx), 1, 14 + r() * 50);
    }
  }
  // o guarda-cadeira (5 cm, entre 0,90 m e 0,95 m) e o rodapé de 12 cm
  g.fillStyle = '#5a3a20';
  g.fillRect(0, y(0.95), W, y(0.9) - y(0.95));
  g.fillStyle = 'rgba(255,214,150,0.28)';
  g.fillRect(0, y(0.95), W, 2);
  g.fillStyle = '#2a170c';
  g.fillRect(0, y(0.12), W, y(0) - y(0.12));
  g.fillStyle = 'rgba(255,200,140,0.14)';
  g.fillRect(0, y(0.12), W, 2);
  // a moldura de teto (8 cm) com a sombra embaixo
  g.fillStyle = '#4a3322';
  g.fillRect(0, 0, W, y(2.72));
  g.fillStyle = 'rgba(255,214,150,0.22)';
  g.fillRect(0, y(2.8) + 3, W, 2);
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.fillRect(0, y(2.72) - 3, W, 3);
  return tex(c);
}

/** A janela da noite: a rua com os prédios acesos. */
export function noiteNaJanela(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 192);
  const grad = g.createLinearGradient(0, 0, 0, 192);
  grad.addColorStop(0, '#0c1230');
  grad.addColorStop(1, '#2a1a30');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 192);
  const r = sorteio(5);
  for (let i = 0; i < 6; i++) {
    const w = 30 + r() * 40;
    const x = i * 44 - 10;
    const hh = 60 + r() * 90;
    g.fillStyle = '#10101c';
    g.fillRect(x, 192 - hh, w, hh);
    for (let k = 0; k < 14; k++) {
      g.fillStyle = r() < 0.55 ? '#ffc760' : '#1c1c2c';
      g.fillRect(x + 4 + r() * (w - 12), 192 - hh + 6 + r() * (hh - 12), 5, 6);
    }
  }
  return tex(c, false);
}

/** O prédio da vizinhança, com as janelas acesas (cor e emissivo). */
export function predio(semente: number): { mapa: THREE.CanvasTexture; emissivo: THREE.CanvasTexture } {
  const [c, g] = canvas(128, 256);
  const [ce, ge] = canvas(128, 256);
  const r = sorteio(semente);
  const cor = `hsl(${(r() * 30 + 10) | 0},${(r() * 25 + 10) | 0}%,${(r() * 12 + 14) | 0}%)`;
  g.fillStyle = cor;
  g.fillRect(0, 0, 128, 256);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 246; y += 18) {
    for (let x = 8; x < 120; x += 20) {
      const acesa = r() < 0.5;
      g.fillStyle = acesa ? '#6a5530' : '#0a0a12';
      g.fillRect(x, y, 11, 10);
      if (acesa) {
        ge.fillStyle = r() < 0.2 ? '#ffe9a0' : '#ffb040';
        ge.fillRect(x, y, 11, 10);
      }
    }
  }
  return { mapa: tex(c), emissivo: tex(ce) };
}

/** O tapete (padrão de losangos); `base` e `claro` são as cores. */
export function tapete(base: string, claro: string): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = claro;
  g.lineWidth = 6;
  g.strokeRect(10, 10, 236, 236);
  g.lineWidth = 3;
  g.strokeRect(24, 24, 208, 208);
  g.fillStyle = claro;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      const x = 64 + i * 64;
      const y = 64 + j * 64;
      g.beginPath();
      g.moveTo(x, y - 22);
      g.lineTo(x + 22, y);
      g.lineTo(x, y + 22);
      g.lineTo(x - 22, y);
      g.closePath();
      g.globalAlpha = 0.5;
      g.fill();
      g.globalAlpha = 1;
    }
  return tex(c, false);
}

/** A sombra mole de baixo dos pés. */
export function sombraMole(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.65)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return tex(c, false);
}

/** Um quadro de parede: moldura e uma pintura abstrata. */
export function quadro(semente: number): THREE.CanvasTexture {
  const [c, g] = canvas(128, 96);
  const r = sorteio(semente);
  g.fillStyle = `hsl(${(r() * 360) | 0},30%,22%)`;
  g.fillRect(0, 0, 128, 96);
  for (let i = 0; i < 9; i++) {
    g.fillStyle = `hsla(${(r() * 360) | 0},${(40 + r() * 40) | 0}%,${(30 + r() * 30) | 0}%,0.8)`;
    g.beginPath();
    g.arc(r() * 128, r() * 96, 8 + r() * 30, 0, 7);
    g.fill();
  }
  return tex(c, false);
}
