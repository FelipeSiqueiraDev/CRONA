import type { Loot, LootKind } from '@crona/shared';

/**
 * O que alguém largou no chão, em pixel por código (03/11, o Felipe: "ele tá feião no chão"). Sem a arte do Códex no
 * tabuleiro (arteCodex.ts), a pilha era uma bolsa de caixas igual para tudo; aqui cada item vira o desenho pequeno do
 * que ele é (faca, arma de fogo, papel, chave, frasco, fita, caixa, bolsa), deitado no piso na projeção 2:1 do jogo.
 *
 * O desenho é a vista de cima, uma grade de pixels (1 pixel = 1/16 de casa). Na tela, o passo em `u` vale (2, 1) e o
 * passo em `v`, (-2, 1): cada pixel da grade vira uma tira de 4 x 1 na linha dele, e as tiras vizinhas se encaixam sem
 * buraco, com a escadinha 2:1 do resto do mapa. Embaixo, uma sombra de contato e um aro dourado que pulsa de leve (o
 * "pegue-me": o item não pode se misturar com o chão).
 */

type Grade = string[];
const PALETA: Record<string, string> = {
  k: '#1b1612', // contorno
  b: '#d5dce2', // lâmina clara
  d: '#8a929a', // lâmina escura
  h: '#9a6a3c', // cabo de madeira
  H: '#6b4426',
  g: '#c9a86a', // metal dourado
  G: '#8f7238',
  m: '#5c6168', // aço da arma
  M: '#3a3e44',
  p: '#eadfc4', // papel
  P: '#c9b88f',
  l: '#7a6a52', // linhas de texto
  r: '#b8322a', // vermelho (caixa, lacre, frasco)
  R: '#6e1510',
  t: '#d9e4e8', // vidro
  s: '#a8794a', // lona
  S: '#6e4c2c',
  c: '#2a2622', // miolo da fita
  f: '#9aa3ab', // fita
};

const DESENHOS: Record<string, Grade> = {
  faca: ['..kkkkkkk.', 'khhgbbbbbk', 'khhgdddk..', '.kkkkkk...'],
  arma: ['.kkkkkkk..', 'kmmmmmmmk.', 'kMMMMMkkk.', '.kmmk.....', '.kHHk.....', '..kk......'],
  papel: ['.kkkkkkk.', 'kppppppPk', 'kplllllPk', 'kppppppPk', 'kplllllPk', 'kppppppPk', 'kpllpppPk', '.kkkkkkk.'],
  carta: ['.kkkkkkkk.', 'kpppppppPk', 'kPpppprpPk', 'kpPpppppPk', 'kpppPPPpPk', '.kkkkkkkk.'],
  chave: ['..kkk.......', '.kgggk......', 'kg.kgkkkkkkk', 'kg.kgggggggk', '.kgggkGGkGGk', '..kkk.kkkkkk'],
  frasco: ['..kkk..', '.ktttk.', 'kttrrtk', 'ktrrrrk', 'ktrrrrk', '.kRRRk.', '..kkk..'],
  fita: ['.kkkkkk.', 'kffffffk', 'kffccffk', 'kffccffk', 'kffffffk', '.kkkkkk.'],
  caixa: ['.kkkkkkkk.', 'krrrrrrrRk', 'krRRRRrrRk', 'krrppprrRk', 'krrrrrrrRk', '.kkkkkkkk.'],
  bolsa: ['..kkkkk..', '.kssssSk.', 'ksssssssk', 'ksSSsssSk', 'ksssssssk', '.kSSSSSk.', '..kkkkk..'],
};

const ARMA_DE_FOGO = /pistola|rev[oó]lver|fuzil|espingarda|escopeta|metralhadora|submetralhadora|carabina|arma de fogo|ca[cç]a/i;

/** O desenho de um item: pelo tipo (e, nas armas, pelo nome: de fogo ou de lâmina). */
function desenhoDe(l: Pick<Loot, 'name' | 'kind' | 'item'>): Grade {
  const kind: LootKind = l.kind;
  if (kind === 'weapon') return ARMA_DE_FOGO.test(`${l.item?.id ?? ''} ${l.name}`) ? DESENHOS.arma : DESENHOS.faca;
  return (
    {
      document: DESENHOS.papel,
      letter: DESENHOS.carta,
      key: DESENHOS.chave,
      potion: DESENHOS.frasco,
      tape: DESENHOS.fita,
      box: DESENHOS.caixa,
      misc: DESENHOS.bolsa,
    } as Record<LootKind, Grade>
  )[kind] ?? DESENHOS.bolsa;
}

const reduz = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

/** Onde cada item cai na casa, em pixels da grade a partir do centro (até 3) e se o desenho gira 90°. */
const LUGARES: [number, number][] = [
  [0, 0],
  [-4, 3],
  [3, -4],
];

/** Uma grade na tela: (cx, cy) é o ponto do chão que vira o centro; `giro` troca u e v (o desenho deita noutro eixo). */
function pixels(ctx: CanvasRenderingContext2D, g: Grade, cx: number, cy: number, ou: number, ov: number, giro: boolean, cor: (c: string) => string | null) {
  const h = g.length;
  const w = g[0].length;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const c = g[j][i];
      if (c === '.') continue;
      const col = cor(c);
      if (!col) continue;
      // a grade sai do centro dela; a ordem dos pixels segue a profundidade (u + v), do fundo para a frente
      const a = (giro ? j - h / 2 : i - w / 2) + ou;
      const b = (giro ? i - w / 2 : j - h / 2) + ov;
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(cx + 2 * (a - b)) - 1, Math.round(cy + (a + b)), 4, 1);
    }
  }
}

/**
 * Desenha o que está na pilha: até 3 itens, cada um do que é, com sombra e aro. (cx, cy) é o centro da casa no chão,
 * em px de tela (a mesma `iso()` do tabuleiro); `semente` (0..1) dá a fase do pulso e o eixo em que cada item deita.
 */
export function desenharLargadoPixel(ctx: CanvasRenderingContext2D, loot: Pick<Loot, 'name' | 'kind' | 'item'>[], cx: number, cy: number, semente: number) {
  const itens = loot.slice(0, 3);
  const t = performance.now() / 1000;
  const onda = reduz?.matches ? 0 : Math.sin(t * 1.7 + semente * Math.PI * 2);
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // o aro dourado no chão: o losango da casa, bem fino, que pulsa devagar
  ctx.globalAlpha = 0.28 + 0.14 * onda;
  ctx.strokeStyle = '#ffd27a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const rx = itens.length > 1 ? 22 : 15;
  const ry = rx / 2;
  ctx.moveTo(cx, cy - ry);
  ctx.lineTo(cx + rx, cy);
  ctx.lineTo(cx, cy + ry);
  ctx.lineTo(cx - rx, cy);
  ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 1;

  // do fundo para a frente: o item de trás não tapa o da frente
  const feitos = itens.map((l, i) => {
    const [ou, ov] = LUGARES[i];
    const giro = ((semente * 7 + i * 3) | 0) % 2 === 1;
    return { g: desenhoDe(l), ou, ov, giro, prof: ou + ov };
  });
  feitos.sort((p, q) => p.prof - q.prof);
  for (const f of feitos) {
    // a sombra de contato: o mesmo desenho, 1 pixel para baixo e para a frente, escuro e translúcido
    ctx.globalAlpha = 0.26;
    pixels(ctx, f.g, cx, cy + 1, f.ou + 1, f.ov + 1, f.giro, () => '#000');
    ctx.globalAlpha = 1;
    pixels(ctx, f.g, cx, cy, f.ou, f.ov, f.giro, (c) => PALETA[c] ?? null);
  }
  ctx.restore();
}

/** Qual desenho vale para o item (os testes). */
export const desenhoDoItem = desenhoDe;
