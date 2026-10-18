import type { regras } from '@crona/shared';
import type { Database } from './db';

/**
 * As fichas dos 4 Marcados iguais às do C.R.I.S (18/10, o Felipe: "as fichas dos marcados têm que estar iguais às do
 * C.R.I.S, tudinho, com itens e tudo mais; se tiver algo errado na ficha de lá, deixa de aviso ali pra eles quando
 * entrarem").
 *
 * Atributos, perícias, poderes, rituais e os PV/PE/SAN máximos já batiam (`scripts/dev/comparar-cris.mts`). Muda:
 * - o estado de jogo (PV, PE e SAN de agora) passa a ser o do C.R.I.S;
 * - a mochila fica com os itens do C.R.I.S: saem os achados do conteúdo de exemplo (a Chave da Escrivaninha, o Diário
 *   Rasgado, o Caderno, a Lanterna, a Espingarda, a Munição e a Corda, do `seed.ts`), que sobrecarregavam a Alosi e a
 *   Cora; a Catarina ganha as duas granadas e o Pé de Mesa;
 * - onde o C.R.I.S está diferente do livro, a ficha do CRONA segue o livro e o jogador vê o aviso ao abrir a ficha.
 *
 * Roda uma vez na subida do servidor (`db.fichasCris['marcados-1810']`); o que o mestre mudar depois fica.
 */
interface Igualar {
  nome: string;
  atual: { pv: number; pe: number; san: number };
  novos?: regras.ItemFicha[];
  avisos: string[];
}

const MARCADOS: Igualar[] = [
  {
    nome: 'D.Tepes',
    atual: { pv: 34, pe: 12, san: 6 },
    avisos: [
      'Falta escolher o aumento de atributo do NEX 20% (+1 num atributo, na aba Evolução). O PV 48 do C.R.I.S já conta Vigor 4, mas lá o Vigor está 3: se o aumento foi no Vigor, escolha Vigor e o PV fica 48 aqui também (hoje, 44).',
      'Bloqueio: a RD é o seu bônus de Fortitude, 5 (LR p. 88). No C.R.I.S está 8.',
      'Ser Amaldiçoado (Sangue), a "Mutação Inicial" do C.R.I.S: a RD 5 a balístico e a Sangue, o faro e o Vigor no dano do contra-ataque valem só no dia em que você cumpre a etapa ritualística (SaH p. 17). No C.R.I.S a RD a Sangue fica sempre ligada e a de balístico não aparece. Faro é um sentido, não uma perícia.',
    ],
  },
  {
    nome: 'Catarina Albuquerque',
    atual: { pv: 29, pe: 20, san: 23 },
    novos: [
      { id: 'granada-de-fumaca', tipo: 'equipamento' },
      { id: 'granada-de-fragmentacao', tipo: 'equipamento' },
      { id: 'arma-improvisada', tipo: 'arma', apelido: 'Pé de mesa' },
    ],
    avisos: [
      'Mochila: com as granadas e o Pé de Mesa são 8 espaços, e o seu limite é 7 (Força 1 e a mochila militar). Sobrecarregada, você tem −5 na Defesa e nas perícias de carga e −3 m de deslocamento (LR p. 53). O C.R.I.S tira os 3 m do deslocamento (6 m), mas não tira os 5 da Defesa (19): aqui fica 14 enquanto estiver carregando tudo.',
      'Perito: faltam escolher as duas perícias (na aba Evolução). No C.R.I.S também não estão marcadas.',
    ],
  },
  {
    nome: 'Alosi Walker',
    atual: { pv: 9, pe: 23, san: 28 },
    avisos: [
      'Perícias: a Vontade vem da classe (Ocultista) e da origem (Religioso). Quando isso acontece, você escolhe outra perícia no lugar (LR p. 22): falta escolher uma, na aba Evolução. O C.R.I.S não tem essa perícia a mais.',
    ],
  },
  {
    nome: 'Cora Falcão',
    atual: { pv: 27, pe: 12, san: 11 },
    avisos: [
      'PV máximo: 40. O combatente tem 20 + Vigor no NEX 5% e +4 + Vigor a cada NEX (LR p. 25), e na nossa mesa o Vigor que subiu no NEX 20% vale para todos os NEX (o livro não diz; o C.R.I.S faz assim com o PE da Alosi). O C.R.I.S ficou com 36, a conta com o Vigor 1 de antes.',
    ],
  },
];

type DbCris = Database & { fichasCris?: Record<string, number> };

export function igualarMarcadosCris(db: Database): boolean {
  const feitas = ((db as DbCris).fichasCris ??= {});
  if (feitas['marcados-1810'] !== undefined) return false;
  const fichas = db.fichas ?? [];
  let n = 0;
  for (const m of MARCADOS) {
    const f = fichas.find((x) => x.nome === m.nome && !x.npc);
    if (!f) continue;
    f.atual = { ...f.atual, ...m.atual };
    let uid = Math.max(0, ...fichas.flatMap((x) => x.ficha.inventario.map((i) => i.uid ?? 0))) + 1;
    f.ficha.inventario = [...f.ficha.inventario.filter((i) => i.tipo !== 'cena'), ...(m.novos ?? []).map((i) => ({ ...i, uid: uid++ }))];
    f.ficha.avisos = m.avisos;
    f.atualizadaEm = new Date().toISOString();
    n++;
  }
  feitas['marcados-1810'] = n;
  return true;
}

/**
 * A mochila de agora, na história (18/10, o Felipe: "o Tepes só tem a corrente; a Cora, uma faca e um pé de mesa; a
 * Catarina, um pé de mesa; a Alosi tem a mochila, dois papéis, um com o ritual Cicatrização e outro com Espirais da
 * Perdição, e componentes para rituais: 2 de Morte, 1 de Sangue e 2 de Energia"). Troca a mochila inteira, uma vez.
 */
const componente = (elemento: 'morte' | 'sangue' | 'energia', nome: string): regras.ItemFicha => ({ id: 'componentes-ritualisticos-de-elemento', tipo: 'equipamento', escolha: { elemento }, apelido: `Componentes ritualísticos de ${nome}` });
const papel = (ritual: string): regras.ItemFicha => ({ id: `Papel: ${ritual}`, tipo: 'cena', nome: `Papel com o ritual ${ritual}`, achado: true, espacos: 0, tipoCena: 'document', descricao: `Um papel com o ritual ${ritual} anotado.` });
const MOCHILAS: Record<string, { itens: regras.ItemFicha[]; avisos?: string[] }> = {
  'D.Tepes': { itens: [{ id: 'corrente', tipo: 'arma' }] },
  'Cora Falcão': { itens: [{ id: 'faca', tipo: 'arma' }, { id: 'arma-improvisada', tipo: 'arma', apelido: 'Pé de mesa' }] },
  'Catarina Albuquerque': {
    itens: [{ id: 'arma-improvisada', tipo: 'arma', apelido: 'Pé de mesa' }],
    avisos: ['Perito: faltam escolher as duas perícias (na aba Evolução). No C.R.I.S também não estão marcadas.'],
  },
  'Alosi Walker': {
    itens: [
      { id: 'mochila-militar', tipo: 'equipamento' },
      papel('Cicatrização'),
      papel('Espirais da Perdição'),
      componente('morte', 'Morte'),
      componente('morte', 'Morte'),
      componente('sangue', 'Sangue'),
      componente('energia', 'Energia'),
      componente('energia', 'Energia'),
    ],
  },
};

export function mochilasDaHistoria(db: Database): boolean {
  const feitas = ((db as DbCris).fichasCris ??= {});
  if (feitas['mochilas-1810'] !== undefined) return false;
  const fichas = db.fichas ?? [];
  let n = 0;
  for (const [nome, m] of Object.entries(MOCHILAS)) {
    const f = fichas.find((x) => x.nome === nome && !x.npc);
    if (!f) continue;
    let uid = Math.max(0, ...fichas.flatMap((x) => x.ficha.inventario.map((i) => i.uid ?? 0))) + 1;
    f.ficha.inventario = m.itens.map((i) => ({ ...i, uid: uid++ }));
    if (m.avisos) f.ficha.avisos = m.avisos;
    f.atualizadaEm = new Date().toISOString();
    n++;
  }
  feitas['mochilas-1810'] = n;
  return true;
}
