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
  return { id: 'miguel-albuquerque', nome: 'Miguel Albuquerque', arte: 'miguel-albuquerque', look: { ...lookBase } };
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
