/**
 * Os NPCs do mestre (16/10, o Felipe: "uma aba no menu das criaturas pra NPCs ... eu só clico em usar e boa"): gente da
 * história que o mestre põe na mesa, sem ficha de combate (a peça sem ficha é um NPC; o mestre joga por ela). Cada um tem
 * a arte das 8 direções paradas em arte/personagens/<arte>/ (a folha `oito-direcoes.png` e `tabuleiro-32bits/`), feita
 * pelo Códex a partir de uma imagem do Felipe; sem a arte, o boneco de pixel com as cores do `look`.
 */
import { sanitizeLook, type AvatarLook } from './avatar';

export interface Npc {
  id: string;
  nome: string;
  /** o boneco de pixel enquanto não tem arte */
  look: AvatarLook;
  /** a pasta da arte em arte/personagens/<arte>/ */
  arte?: string;
  /** uma linha para o mestre lembrar quem é ("o irmão da Catarina", "o dono do bar") */
  nota?: string;
  /** o grupo no Elenco (17/10, a sub-aba que abre e fecha: "Ordo Realitas", "Santa Amália"...); sem ele, `grupoDoNpc` */
  grupo?: string;
  /**
   * A altura, em metros, de quem não tem 1,80 m (17/10: a Camarilla, a cachorra do Tepes, ~0,8 m até o alto da cabeça):
   * o boneco do tabuleiro sai nessa escala. Sem ela, a altura de uma pessoa.
   */
  altura?: number;
  /**
   * A outra forma do NPC (19/10): uma criatura do livro (o id em AMEACAS_LIVRO). O clique duplo do mestre na peça troca uma
   * pela outra no mesmo lugar, e as duas nunca ficam em campo juntas (são a mesma pessoa). Fica só no banco.
   */
  forma?: { livro: string };
}

/**
 * Os grupos do Elenco que o jogo já traz, nesta ordem (17/10, o Felipe: "um grupo da Lotus Branca, um da Panacea, e o
 * 'Sede da Ordem' vai virar 'Ordo Realitas'. E um grupo pra cada cidade que estamos criando"). Ficam guardados no banco
 * (`npcGrupos`) mesmo vazios; o mestre cria outros no Elenco.
 */
export const GRUPOS_NPC_PADRAO = ['Ordo Realitas', 'Lotus Branca', 'Panacea', 'Tiradentes', 'Igarapé', 'Santo Berço', 'Santa Amália', 'Fazenda Olhos de Águia', 'Mansão Albuquerque'];
/** O grupo de quem não tem grupo (os criados à mão sem escolher). */
export const GRUPO_SEM = 'Do mestre';

/** Os grupos dos NPCs que o elenco já traz, para os bancos de antes do campo `grupo`. */
const GRUPO_PADRAO: Record<string, string> = {
  'miguel-albuquerque': 'Ordo Realitas',
  agata: 'Ordo Realitas',
  ivete: 'Ordo Realitas',
  samuel: 'Ordo Realitas',
  'geraldo-ribeiro': 'Igarapé',
  'herman-arantes': 'Panacea',
  'npc-camisa-rosa': 'Novos (sem nome)',
  'npc-ruivo': 'Novos (sem nome)',
  'npc-cabelo-rosa': 'Novos (sem nome)',
  'npc-jaleco': 'Novos (sem nome)',
  camarilla: 'Ordo Realitas',
  'helena-duarte': 'Mansão Albuquerque',
  'antonio-valenca': 'Mansão Albuquerque',
  'marina-ferraz': 'Mansão Albuquerque',
  'lucia-moreira': 'Mansão Albuquerque',
  'roberto-salles': 'Mansão Albuquerque',
  'tiago-nobre': 'Mansão Albuquerque',
  'arthur-albuquerque': 'Mansão Albuquerque',
};
/** O grupo do NPC no Elenco: o que o mestre escreveu, o padrão dos que vieram com o jogo, ou "Do mestre". */
export const grupoDoNpc = (n: Npc): string => n.grupo || GRUPO_PADRAO[n.id] || GRUPO_SEM;

/**
 * Os grupos na ordem do Elenco: os guardados (na ordem deles), depois os que algum NPC usa e não estão guardados, e por
 * último "Do mestre" (se alguém estiver nele).
 */
export function gruposDoElenco(guardados: string[], npcs: Npc[]): string[] {
  const out = [...guardados];
  for (const n of npcs) {
    const g = grupoDoNpc(n);
    if (g !== GRUPO_SEM && !out.includes(g)) out.push(g);
  }
  if (npcs.some((n) => grupoDoNpc(n) === GRUPO_SEM)) out.push(GRUPO_SEM);
  return out;
}

/** O nome de um grupo novo, conferido (até 40 letras, sem controle); vazio = inválido. */
export const lerGrupoNpc = (v: unknown): string => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40) : '');

const lookBase: AvatarLook = { skin: '#e8c4a8', hair: '#8a2a1e', hairStyle: 1, top: '#1e1a18', pants: '#1a1816', shoes: '#141210', outfit: 0, extra: 0, charId: null };

/** O primeiro NPC do Felipe (16/10): o Miguel Albuquerque, ruivo, de jaqueta tática preta. */
export function miguelAlbuquerque(): Npc {
  return { id: 'miguel-albuquerque', nome: 'Miguel Albuquerque', arte: 'miguel-albuquerque', nota: 'coordena a rotina da base', look: { ...lookBase } };
}

/**
 * Os NPCs que o elenco já traz, por leva (16/10): o Miguel; a gente da base (Ágata, Ivete, Samuel); o Geraldo e o
 * Arantes; e os quatro de 17/10, ainda sem nome. A nota é só para o mestre lembrar (o elenco não aparece na mesa).
 */
export function npcsPorLeva(): Npc[][] {
  return [
    [miguelAlbuquerque()],
    [
      { id: 'agata', nome: 'Agatha Volkomenn', arte: 'agata', nota: 'ocultista da Ordo Realitas', look: { ...lookBase, skin: '#c9926a', hair: '#2a1a16', top: '#7a1e1e', pants: '#2a3040' } },
      { id: 'ivete', nome: 'Ivete Beicur', arte: 'ivete', nota: 'responsável pelo arsenal da Ordem', look: { ...lookBase, skin: '#b07a52', hair: '#d8d4cc', top: '#3a5a86', pants: '#1e1c1a' } },
      { id: 'samuel', nome: 'Samuel Norte', arte: 'samuel', nota: 'hacker e pesquisador da Ordem', look: { ...lookBase, skin: '#6a4430', hair: '#3a2416', top: '#3e5a2c', pants: '#2e2620', shoes: '#e8e4dc' } },
    ],
    [
      { id: 'geraldo-ribeiro', nome: 'Geraldo Ribeiro', arte: 'geraldo-ribeiro', nota: 'o pai da Cora', look: { ...lookBase, skin: '#d2a07a', hair: '#3a2a1e', top: '#b8a68a', pants: '#3a2c22' } },
      { id: 'herman-arantes', nome: 'Herman Arantes', arte: 'herman-arantes', nota: 'o médico da Panacea', look: { ...lookBase, skin: '#d8b090', hair: '#9a9894', top: '#e8e4dc', pants: '#3a4658', shoes: '#e8e4dc' } },
    ],
    // 17/10: quatro NPCs novos, ainda sem nome (o Felipe dá depois; o nome se edita no Elenco)
    [
      { id: 'npc-camisa-rosa', nome: 'Pedro Cavalcante', arte: 'npc-camisa-rosa', look: { ...lookBase, skin: '#6a4430', hair: '#1e1612', top: '#e89aa8', pants: '#c8b08a', shoes: '#8a6a4a' } },
      { id: 'npc-ruivo', nome: 'Joaquin Oliveira', arte: 'npc-ruivo', look: { ...lookBase, skin: '#e0b090', hair: '#d0702a', top: '#1e1c1a', pants: '#3a3a3e', shoes: '#6a4a2e' } },
      { id: 'npc-cabelo-rosa', nome: 'Rosa Pimenta', arte: 'npc-cabelo-rosa', look: { ...lookBase, skin: '#c8926a', hair: '#e0a0c0', top: '#1a1a1a', pants: '#1e1c1c', shoes: '#141210' } },
      { id: 'npc-jaleco', nome: 'Rebecca Zarkov', arte: 'npc-jaleco', look: { ...lookBase, skin: '#e8c8b0', hair: '#141214', top: '#e8e4dc', pants: '#1a1816', shoes: '#141210' } },
    ],
    // 17/10: a Camarilla, a cachorra caramelo do Tepes (anda no tabuleiro como peça; em pé e sentada)
    [{ id: 'camarilla', nome: 'Camarilla', arte: 'camarilla', nota: 'a cachorra do Tepes', altura: 0.8, look: { ...lookBase, skin: '#c8924a', hair: '#c8924a', top: '#c8924a', pants: '#c8924a', shoes: '#8a5a2a' } }],
    // 21/10: a família Albuquerque e quem trabalha na mansão (as fotos são do Felipe; no tabuleiro, só em pé, agachado, sentado e deitado)
    [
      { id: 'helena-duarte', nome: 'Helena Duarte', arte: 'helena-duarte', nota: 'governanta da Mansão Albuquerque', grupo: 'Mansão Albuquerque', look: { ...lookBase, skin: '#c99a7a', hair: '#2a2220', top: '#1c1816', pants: '#1c1816' } },
      { id: 'antonio-valenca', nome: 'Antônio Valença', arte: 'antonio-valenca', nota: 'mordomo da Mansão Albuquerque', grupo: 'Mansão Albuquerque', look: { ...lookBase, skin: '#c08a62', hair: '#9a9894', top: '#1a1816', pants: '#1a1816' } },
      { id: 'marina-ferraz', nome: 'Marina Ferraz', arte: 'marina-ferraz', nota: 'secretária do Arthur Albuquerque', grupo: 'Mansão Albuquerque', look: { ...lookBase, skin: '#c9926a', hair: '#3a2418', top: '#26201e', pants: '#1a1816' } },
      { id: 'lucia-moreira', nome: 'Lúcia Moreira', arte: 'lucia-moreira', nota: 'cozinheira da Mansão Albuquerque', grupo: 'Mansão Albuquerque', look: { ...lookBase, skin: '#8a5a3a', hair: '#2a2018', top: '#e8e0d0', pants: '#2e3a2a' } },
      { id: 'roberto-salles', nome: 'Roberto Salles', arte: 'roberto-salles', nota: 'chefe da segurança da Mansão Albuquerque', grupo: 'Mansão Albuquerque', look: { ...lookBase, skin: '#b8845e', hair: '#1e1612', top: '#161412', pants: '#161412' } },
      { id: 'tiago-nobre', nome: 'Tiago Nobre', arte: 'tiago-nobre', nota: 'jardineiro da Mansão Albuquerque', grupo: 'Mansão Albuquerque', look: { ...lookBase, skin: '#b07850', hair: '#4a2a18', top: '#4a5030', pants: '#4a3424' } },
      { id: 'arthur-albuquerque', nome: 'Arthur Albuquerque', arte: 'arthur-albuquerque', nota: 'irmão mais novo de Alexander, pai da Catarina; empresário da família no Frigorífico Albuquerque', grupo: 'Mansão Albuquerque', look: { ...lookBase, skin: '#d8a888', hair: '#a63a1e', top: '#1c1a22', pants: '#1c1a22' } },
    ],
  ];
}

/**
 * Os nomes completos que o Felipe deu depois (17/10): no banco que ainda tem o nome antigo de quando o NPC entrou (e a
 * nota antiga), troca; o que o mestre já mudou à mão fica.
 */
const RENOMEADOS: { id: string; de: string; notaDe: string }[] = [
  { id: 'agata', de: 'Ágata', notaDe: 'a ocultista da base' },
  { id: 'ivete', de: 'Ivete', notaDe: 'armas e equipamentos; o bar de cima' },
  { id: 'samuel', de: 'Samuel', notaDe: 'o C.R.i.S e a tecnologia' },
];
export function renomearNpcs(lista: Npc[]): boolean {
  let mudou = false;
  const padrao = npcsPorLeva().flat();
  for (const r of RENOMEADOS) {
    const n = lista.find((x) => x.id === r.id);
    const novo = padrao.find((x) => x.id === r.id);
    if (!n || !novo) continue;
    if (n.nome === r.de) ((n.nome = novo.nome), (mudou = true));
    if (n.nota === r.notaDe) ((n.nota = novo.nota), (mudou = true));
  }
  // a "Sede da Ordem" virou "Ordo Realitas" (17/10)
  for (const n of lista) if (n.grupo === 'Sede da Ordem') ((n.grupo = 'Ordo Realitas'), (mudou = true));
  return mudou;
}

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').trim().slice(0, max) : '');
const slug = (v: unknown) => texto(v, 40).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');

/** O NPC que veio da tela do mestre, conferido (nome; o id sai do nome se não vier). */
export function lerNpc(raw: unknown): Npc | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const nome = texto(o.nome, 40);
  if (!nome) return null;
  const id = slug(o.id) || slug(nome.normalize('NFD').replace(/[̀-ͯ]/g, ''));
  if (!id) return null;
  const arte = slug(o.arte);
  const nota = texto(o.nota, 120);
  const grupo = texto(o.grupo, 40);
  const altura = typeof o.altura === 'number' && o.altura >= 0.2 && o.altura <= 3 ? Math.round(o.altura * 100) / 100 : undefined;
  const livro = o.forma && typeof o.forma === 'object' ? slug((o.forma as Record<string, unknown>).livro) : '';
  return { id, nome, look: sanitizeLook(o.look), ...(arte ? { arte } : {}), ...(nota ? { nota } : {}), ...(grupo ? { grupo } : {}), ...(altura ? { altura } : {}), ...(livro ? { forma: { livro } } : {}) };
}
