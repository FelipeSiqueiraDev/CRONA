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
}

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
      { id: 'agata', nome: 'Ágata', arte: 'agata', nota: 'a ocultista da base', look: { ...lookBase, skin: '#c9926a', hair: '#2a1a16', top: '#7a1e1e', pants: '#2a3040' } },
      { id: 'ivete', nome: 'Ivete', arte: 'ivete', nota: 'armas e equipamentos; o bar de cima', look: { ...lookBase, skin: '#b07a52', hair: '#d8d4cc', top: '#3a5a86', pants: '#1e1c1a' } },
      { id: 'samuel', nome: 'Samuel', arte: 'samuel', nota: 'o C.R.i.S e a tecnologia', look: { ...lookBase, skin: '#6a4430', hair: '#3a2416', top: '#3e5a2c', pants: '#2e2620', shoes: '#e8e4dc' } },
    ],
    [
      { id: 'geraldo-ribeiro', nome: 'Geraldo Ribeiro', arte: 'geraldo-ribeiro', nota: 'o pai da Cora', look: { ...lookBase, skin: '#d2a07a', hair: '#3a2a1e', top: '#b8a68a', pants: '#3a2c22' } },
      { id: 'herman-arantes', nome: 'Herman Arantes', arte: 'herman-arantes', nota: 'o médico da Panacea', look: { ...lookBase, skin: '#d8b090', hair: '#9a9894', top: '#e8e4dc', pants: '#3a4658', shoes: '#e8e4dc' } },
    ],
    // 17/10: quatro NPCs novos, ainda sem nome (o Felipe dá depois; o nome se edita no Elenco)
    [
      { id: 'npc-camisa-rosa', nome: 'Camisa Rosa', arte: 'npc-camisa-rosa', nota: 'nome em aberto', look: { ...lookBase, skin: '#6a4430', hair: '#1e1612', top: '#e89aa8', pants: '#c8b08a', shoes: '#8a6a4a' } },
      { id: 'npc-ruivo', nome: 'Ruivo', arte: 'npc-ruivo', nota: 'nome em aberto', look: { ...lookBase, skin: '#e0b090', hair: '#d0702a', top: '#1e1c1a', pants: '#3a3a3e', shoes: '#6a4a2e' } },
      { id: 'npc-cabelo-rosa', nome: 'Cabelo Rosa', arte: 'npc-cabelo-rosa', nota: 'nome em aberto', look: { ...lookBase, skin: '#c8926a', hair: '#e0a0c0', top: '#1a1a1a', pants: '#1e1c1c', shoes: '#141210' } },
      { id: 'npc-jaleco', nome: 'Jaleco', arte: 'npc-jaleco', nota: 'nome em aberto', look: { ...lookBase, skin: '#e8c8b0', hair: '#141214', top: '#e8e4dc', pants: '#1a1816', shoes: '#141210' } },
    ],
  ];
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
  return { id, nome, look: sanitizeLook(o.look), ...(arte ? { arte } : {}), ...(nota ? { nota } : {}) };
}
