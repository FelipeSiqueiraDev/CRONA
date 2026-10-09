/**
 * A van preta vista de cima (07/10), em pixel art, para a janela de escolher quem vai e onde senta: a frente à direita, o
 * teto aberto (vê-se o piso e os bancos), o capô, o para-brisa, os faróis, as lanternas e as rodas aparecendo dos lados.
 * Desenhada uma vez numa tela pequena (`VAN_W` × `VAN_H`) e ampliada com pixels grandes. `BANCOS_NO_DESENHO` diz onde cai
 * o meio de cada banco (x da van 0, 2, 4 e y 0, 1, 2), para os botões ficarem em cima.
 */

export const VAN_W = 176;
export const VAN_H = 92;

/** O meio de cada banco no desenho, pela coluna (x da van) e a fileira (y da van). */
export function meioDoBanco(x: number, y: number): [number, number] {
  const colunas: Record<number, number> = { 0: 32, 2: 66, 4: 101 };
  return [colunas[x] ?? 32, 28 + y * 18];
}

const CONTORNO = '#17121c';

function ret(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cor: string) {
  ctx.fillStyle = cor;
  ctx.fillRect(x, y, w, h);
}

/** Um banco visto de cima: o assento, o encosto atrás (à esquerda) e o apoio de cabeça. */
function banco(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ret(ctx, cx - 11, cy - 8, 22, 16, CONTORNO);
  ret(ctx, cx - 10, cy - 7, 20, 14, '#4a4a58');
  ret(ctx, cx - 4, cy - 6, 13, 12, '#5d5d6e');
  ret(ctx, cx - 3, cy - 5, 11, 2, '#6f6f82');
  // o encosto e o apoio de cabeça
  ret(ctx, cx - 10, cy - 7, 5, 14, '#393946');
  ret(ctx, cx - 12, cy - 4, 3, 8, '#2e2e39');
}

export function desenhoDaVan(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = VAN_W;
  c.height = VAN_H;
  const ctx = c.getContext('2d')!;
  // a sombra no chão
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(10, 14, 162, 74);
  // as rodas, aparecendo dos lados
  for (const x of [22, 128])
    for (const y of [7, 79]) {
      ret(ctx, x, y, 22, 6, CONTORNO);
      ret(ctx, x + 1, y + 1, 20, 4, '#26262c');
      ret(ctx, x + 4, y + 2, 14, 1, '#3a3a42');
    }
  // o casco: a carroceria preta, com a frente arredondada
  ret(ctx, 6, 10, 158, 72, CONTORNO);
  ret(ctx, 164, 13, 4, 66, CONTORNO);
  ret(ctx, 168, 18, 2, 56, CONTORNO);
  ret(ctx, 7, 11, 156, 70, '#2a2a33');
  ret(ctx, 163, 14, 4, 64, '#2a2a33');
  ret(ctx, 167, 19, 2, 54, '#2a2a33');
  // o brilho da lataria nas beiradas de cima
  ret(ctx, 8, 12, 150, 2, '#3e3e4a');
  ret(ctx, 8, 12, 2, 66, '#34343f');
  // o piso por dentro (o teto aberto) e as laterais
  ret(ctx, 12, 16, 112, 60, '#1c1c23');
  ret(ctx, 14, 18, 108, 56, '#4b4f57');
  for (let x = 16; x < 120; x += 6) ret(ctx, x, 19, 1, 54, '#444850');
  // o painel, o volante (do lado do motorista, embaixo) e o para-brisa
  ret(ctx, 116, 18, 8, 56, '#24242c');
  ret(ctx, 117, 19, 6, 54, '#31313b');
  ctx.fillStyle = CONTORNO;
  ctx.beginPath();
  ctx.arc(113, 64, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a5a66';
  ctx.beginPath();
  ctx.arc(113, 64, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = CONTORNO;
  ctx.fillRect(112, 63, 2, 2);
  ret(ctx, 124, 16, 10, 60, CONTORNO);
  ret(ctx, 125, 17, 8, 58, '#5f8fae');
  ret(ctx, 126, 18, 2, 30, '#9cc6dc');
  // o capô e a grade
  ret(ctx, 134, 15, 30, 62, '#2f2f39');
  ret(ctx, 136, 17, 26, 1, '#41414d');
  ret(ctx, 148, 20, 1, 52, '#26262e');
  // os faróis e as lanternas
  ret(ctx, 166, 18, 3, 9, '#f2d77a');
  ret(ctx, 166, 65, 3, 9, '#f2d77a');
  ret(ctx, 5, 14, 3, 8, '#c8322a');
  ret(ctx, 5, 70, 3, 8, '#c8322a');
  // os retrovisores
  ret(ctx, 124, 6, 6, 5, CONTORNO);
  ret(ctx, 125, 7, 4, 3, '#3a3a44');
  ret(ctx, 124, 81, 6, 5, CONTORNO);
  ret(ctx, 125, 82, 4, 3, '#3a3a44');
  // os bancos
  for (const x of [0, 2, 4])
    for (const y of [0, 1, 2]) {
      if (x === 4 && y === 1) continue;
      const [cx, cy] = meioDoBanco(x, y);
      banco(ctx, cx, cy);
    }
  // a van pintada do Códex (arte/viagem/pixel/van-de-cima.png, em escala 4, os bancos nos mesmos pontos): quando
  // carrega, toma o lugar do desenho na mesma tela
  void fetch('/api/arte')
    .then((r) => r.json() as Promise<{ arquivos: string[] }>)
    .then((j) => {
      if (!j.arquivos.includes(VAN_ARTE)) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, VAN_W, VAN_H);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, VAN_W, VAN_H);
      };
      img.src = VAN_ARTE;
    })
    .catch(() => {});
  return c;
}

const VAN_ARTE = '/arte/viagem/pixel/van-de-cima.png';

/** A vanzinha de lado (40 × 22), para a barra do trajeto da tela de viagem: a frente à direita. */
export function vanDeLado(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 40;
  c.height = 22;
  const ctx = c.getContext('2d')!;
  // o corpo, com o capô baixo na frente
  ret(ctx, 2, 3, 30, 14, CONTORNO);
  ret(ctx, 32, 8, 6, 9, CONTORNO);
  ret(ctx, 3, 4, 28, 12, '#2c2c36');
  ret(ctx, 31, 9, 6, 7, '#2c2c36');
  ret(ctx, 3, 4, 28, 1, '#45454f');
  // as janelas e o para-brisa
  for (const x of [6, 13, 20]) ret(ctx, x, 6, 5, 4, '#7fb2cf');
  ret(ctx, 27, 6, 4, 5, '#9fc9de');
  ret(ctx, 6, 6, 1, 4, '#b8dcec');
  // o farol e a lanterna
  ret(ctx, 37, 10, 1, 2, '#f2d77a');
  ret(ctx, 2, 5, 1, 3, '#c8322a');
  // as rodas
  for (const x of [6, 27]) {
    ret(ctx, x, 15, 7, 6, CONTORNO);
    ret(ctx, x + 1, 16, 5, 4, '#30303a');
    ret(ctx, x + 2, 17, 3, 2, '#8a8f98');
  }
  return c;
}
