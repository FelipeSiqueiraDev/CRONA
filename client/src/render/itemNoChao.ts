/**
 * Um item largado no chão, como o drop de um jogo (07/10): o ícone pintado de pé e um pouco inclinado, uma sombra
 * achatada embaixo, um brilho quente no chão (o "pegue-me", que pulsa devagar) e um balanço bem leve.
 * Serve ao isométrico e à vista de cima: o ícone não precisa ser a vista de cima literal; ele destaca o item e mostra
 * que alguém o deixou ali. Deitar o ícone na perspectiva do piso o esmagava.
 *
 * (sx, sy) é o ponto do chão em px de tela, `lado` o maior lado do ícone em px de tela e `semente` (0..1) dá a
 * inclinação e a fase do balanço de cada item (itens vizinhos não balançam juntos).
 */
const reduz = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

/** Folga em volta do ícone, em px da imagem, para o desfoque da sombra não ser cortado. */
const SOMBRA_PAD = 8;
const silhuetas = new WeakMap<HTMLImageElement, HTMLCanvasElement>();

/** A silhueta preta e macia do ícone (desfocada uma vez só e guardada). */
function silhueta(img: HTMLImageElement): HTMLCanvasElement {
  let c = silhuetas.get(img);
  if (!c) {
    c = document.createElement('canvas');
    c.width = img.naturalWidth + SOMBRA_PAD * 2;
    c.height = img.naturalHeight + SOMBRA_PAD * 2;
    const g = c.getContext('2d')!;
    g.filter = 'blur(3px)';
    g.drawImage(img, SOMBRA_PAD, SOMBRA_PAD);
    g.filter = 'none';
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#000';
    g.fillRect(0, 0, c.width, c.height);
    silhuetas.set(img, c);
  }
  return c;
}

export function desenharItemNoChao(ctx: CanvasRenderingContext2D, img: HTMLImageElement, sx: number, sy: number, lado: number, semente: number) {
  const t = performance.now() / 1000;
  const parado = !!reduz?.matches;
  const fase = semente * Math.PI * 2;
  const onda = parado ? 0 : Math.sin(t * 1.7 + fase);
  const bob = onda * lado * 0.035;
  const pulso = parado ? 0.8 : 0.78 + onda * 0.22;
  const k = lado / Math.max(img.naturalWidth, img.naturalHeight);
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  const inclina = (semente - 0.5) * 0.34;

  // o brilho e a sombra ficam no MESMO ponto do chão (G): a sombra por cima do brilho, e não um de cada lado
  const gx = sx;
  const gy = sy + h * 0.1;

  // o brilho quente no chão: uma elipse achatada que pulsa
  ctx.save();
  ctx.translate(gx, gy);
  ctx.scale(1, 0.5);
  const r = lado * 0.7;
  const g = ctx.createRadialGradient(0, 0, lado * 0.04, 0, 0, r);
  g.addColorStop(0, `rgba(255, 216, 132, ${(0.55 * pulso).toFixed(3)})`);
  g.addColorStop(0.55, `rgba(255, 190, 92, ${(0.22 * pulso).toFixed(3)})`);
  g.addColorStop(1, 'rgba(255, 190, 92, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // a sombra segue a forma do objeto: a silhueta do próprio ícone, na MESMA direção dele (uma cópia paralela, logo
  // embaixo, centrada em G, dentro do brilho e por cima dele); o ícone é um objeto deitado visto em três quartos, então
  // espelhar ou inclinar a silhueta viraria o sentido; mais fraca quando o ícone sobe no balanço
  const sil = silhueta(img);
  const sw = sil.width * k;
  const sh = sil.height * k;
  ctx.save();
  ctx.translate(gx + lado * 0.04, gy - h * 0.1);
  ctx.rotate(inclina);
  ctx.scale(1, 0.9);
  ctx.globalAlpha = 0.58 - onda * 0.07;
  ctx.drawImage(sil, -sw / 2, -sh / 2, sw, sh);
  ctx.restore();

  // o ícone: apoiado no chão, inclinado, com um contorno de luz suave (o destaque)
  ctx.save();
  ctx.translate(sx, sy - h * 0.3 + bob);
  ctx.rotate(inclina);
  ctx.shadowColor = `rgba(255, 224, 160, ${(0.55 * pulso).toFixed(3)})`;
  ctx.shadowBlur = lado * 0.16;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}
