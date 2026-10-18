/**
 * O passo pelas sombras (Magistrada, 18/10): a poça escura que se abre no chão (elipse isométrica 2:1, de borda
 * ondulando, o miolo preto e uma ondinha fria perto da borda) e as marcações das casas que são sombra.
 * As contas do tempo ficam em shared/sombras.ts (`fasePasso`); aqui só o desenho.
 */

/** O raio da poça aberta, em px do mundo (a casa tem 64 × 32: a poça cobre a casa e um tiquinho mais). */
export const POCA_RX = 29;
export const POCA_RY = POCA_RX / 2;

/**
 * A poça no chão, em (x, y) do mundo (o centro da casa). `k` de 0 (fechada) a 1 (aberta). Abre depressa e fecha de dentro
 * para fora; a borda ondula um pouco, cada uma de um jeito (`semente`).
 */
export function desenharPoca(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, agora: number, semente: number) {
  if (k <= 0.01) return;
  const e = 1 - Math.pow(1 - k, 2.2);
  const rx = POCA_RX * e;
  const ry = POCA_RY * e;
  ctx.save();
  ctx.translate(x, y);
  // a borda irregular: uma elipse de 28 pontos com a ondulação de cada um
  const caminho = (esc: number) => {
    ctx.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const o = 1 + 0.07 * Math.sin(a * 3 + agora / 260 + semente) + 0.04 * Math.sin(a * 5 - agora / 190 + semente * 2);
      const px = Math.cos(a) * rx * esc * o;
      const py = Math.sin(a) * ry * esc * o;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  // o halo roxo-azulado em volta, que some para fora
  const halo = ctx.createRadialGradient(0, 0, rx * 0.3, 0, 0, rx * 1.35);
  halo.addColorStop(0, 'rgba(40,18,70,0.55)');
  halo.addColorStop(1, 'rgba(40,18,70,0)');
  ctx.save();
  ctx.scale(1, 0.5);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, rx * 1.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // o corpo da poça: preto no miolo, um roxo muito escuro na borda
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(2,1,6,0.98)');
  g.addColorStop(0.7, 'rgba(6,3,14,0.96)');
  g.addColorStop(1, 'rgba(24,10,44,0.9)');
  ctx.fillStyle = g;
  caminho(1);
  ctx.fill();
  // a ondinha fria que corre para fora (o líquido mexendo)
  const fase = (agora / 700 + semente) % 1;
  ctx.strokeStyle = `rgba(150,110,230,${0.32 * (1 - fase) * e})`;
  ctx.lineWidth = 1;
  caminho(0.35 + 0.6 * fase);
  ctx.stroke();
  ctx.strokeStyle = `rgba(150,100,235,${0.8 * e})`;
  caminho(0.97);
  ctx.stroke();
  ctx.restore();
}

/** Uma casa que vale como sombra, no modo de escolher: o losango roxo e, se foi o mestre que marcou, um pontilhado. */
export function desenharCasaSombra(ctx: CanvasRenderingContext2D, pts: [number, number][], agora: number, estado: 'luz' | 'marcada' | 'mouse', pulsa: number) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  const forte = estado === 'mouse';
  ctx.fillStyle = forte ? 'rgba(160,100,255,0.5)' : `rgba(110,60,200,${0.22 + 0.08 * pulsa})`;
  ctx.fill();
  ctx.lineWidth = forte ? 2 : 1;
  ctx.strokeStyle = forte ? 'rgba(220,190,255,0.95)' : 'rgba(170,130,240,0.65)';
  if (estado === 'marcada') ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.restore();
  void agora;
}
