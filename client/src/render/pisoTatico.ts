import type { FloorStyle } from '@crona/shared';
import { hash, shade } from './color';
import { floorLook } from './roomStatic';

/**
 * O piso do mapa tático (a sala vista de cima), desenhado em código, casa a casa (15/10: "limpar a visão tática de tudo":
 * antes vinha a textura pintada do Códex, que não combina com o tabuleiro em pixel). Cada piso tem o desenho dele
 * (tábuas, ladrilho, xadrez, pedra, terra, grama...) na cor do piso do isométrico, com variação por casa e rejunte.
 * `px` = o tamanho de um pixel da tela em casas (as linhas ficam finas, de 1 pixel).
 */
export function pisoDeCima(ctx: CanvasRenderingContext2D, x: number, y: number, estilo: FloorStyle | undefined, px: number) {
  const look = floorLook(estilo);
  const base = look.base;
  const r = hash(x, y, 71);
  // o tom da casa: um pouco mais claro ou mais escuro
  const tom = shade(base, (r - 0.5) * 0.12);
  ctx.fillStyle = tom;
  ctx.fillRect(x, y, 1.002, 1.002);
  const lw = Math.max(px, 0.02);
  ctx.lineWidth = lw;
  ctx.lineCap = 'butt';
  switch (look.kind) {
    case 'plank': {
      // tábuas deitadas (quatro por casa), cada uma com seu tom e as emendas deslocadas
      const n = 4;
      for (let i = 0; i < n; i++) {
        const t = shade(base, (hash(x, y, i, 72) - 0.5) * 0.14);
        ctx.fillStyle = t;
        ctx.fillRect(x, y + i / n, 1.002, 1 / n + 0.002);
        ctx.strokeStyle = look.grout;
        ctx.beginPath();
        ctx.moveTo(x, y + i / n);
        ctx.lineTo(x + 1, y + i / n);
        const em = 0.15 + 0.7 * hash(x, y, i, 73);
        ctx.moveTo(x + em, y + i / n);
        ctx.lineTo(x + em, y + (i + 1) / n);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,240,215,0.05)';
        ctx.fillRect(x, y + i / n + lw, 1, lw);
      }
      break;
    }
    case 'tile':
    case 'checker': {
      const alt = look.kind === 'checker' && (x + y) % 2 === 1;
      if (alt) {
        ctx.fillStyle = look.alt ?? shade(base, -0.4);
        ctx.fillRect(x, y, 1.002, 1.002);
      }
      ctx.strokeStyle = look.grout;
      ctx.strokeRect(x + lw / 2, y + lw / 2, 1 - lw, 1 - lw);
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(x + lw, y + lw, 1 - lw * 2, lw);
      break;
    }
    case 'carpet': {
      ctx.fillStyle = look.alt ?? shade(base, 0.35);
      ctx.fillRect(x + 0.12, y + 0.12, 0.76, 0.76);
      ctx.fillStyle = tom;
      ctx.fillRect(x + 0.2, y + 0.2, 0.6, 0.6);
      break;
    }
    case 'plate': {
      ctx.strokeStyle = look.grout;
      ctx.strokeRect(x + lw / 2, y + lw / 2, 1 - lw, 1 - lw);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      for (const [a, b] of [[0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]]) ctx.fillRect(x + a - lw, y + b - lw, lw * 2, lw * 2);
      break;
    }
    case 'grass':
    case 'rows': {
      ctx.fillStyle = look.alt ?? shade(base, 0.2);
      for (let k = 0; k < 7; k++) ctx.fillRect(x + hash(x, y, k, 74), y + hash(y, x, k, 75), lw * 2, lw * 3);
      if (look.kind === 'rows') {
        ctx.strokeStyle = shade(base, -0.25);
        ctx.beginPath();
        for (let k = 1; k < 4; k++) (ctx.moveTo(x, y + k / 4), ctx.lineTo(x + 1, y + k / 4));
        ctx.stroke();
      }
      break;
    }
    case 'dirt':
    case 'gravel': {
      for (let k = 0; k < 9; k++) {
        ctx.fillStyle = hash(x, y, k, 76) < 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,240,215,0.1)';
        ctx.fillRect(x + hash(x, y, k, 77), y + hash(y, x, k, 78), lw * 2, lw * 2);
      }
      break;
    }
    default: {
      // pedra: quatro lajes com rejunte, cada uma num tom, e uma lasca de vez em quando
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          ctx.fillStyle = shade(base, (hash(x * 2 + i, y * 2 + j, 79) - 0.5) * 0.16);
          ctx.fillRect(x + i / 2, y + j / 2, 0.502, 0.502);
        }
      ctx.strokeStyle = look.grout;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, y);
      ctx.lineTo(x + 0.5, y + 1);
      ctx.moveTo(x, y + 0.5);
      ctx.lineTo(x + 1, y + 0.5);
      ctx.stroke();
      if (r < 0.1) {
        ctx.strokeStyle = 'rgba(8,6,10,0.5)';
        ctx.beginPath();
        ctx.moveTo(x + 0.2, y + 0.3);
        ctx.lineTo(x + 0.35, y + 0.22);
        ctx.lineTo(x + 0.45, y + 0.42);
        ctx.stroke();
      }
    }
  }
}
