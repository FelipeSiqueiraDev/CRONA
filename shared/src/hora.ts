/**
 * A hora do dia (23/10, o Felipe: "se eu quiser fazer de noite e as janelas sumirem o sol, o lado externo também... quero
 * poder mudar a hora do dia: amanhecer, dia, anoitecer e noite"). Vale para a campanha inteira (anoitece em todo lugar
 * junto): o mestre troca no ☀ Clima da cena. "Dia" é o jogo como sempre foi; as outras horas escurecem (mais ao ar
 * livre), tingem o ar, trocam a luz que entra pelas janelas e o céu desenhado nelas.
 */
export type HoraDoDia = 'amanhecer' | 'dia' | 'anoitecer' | 'noite';

export const HORAS: HoraDoDia[] = ['amanhecer', 'dia', 'anoitecer', 'noite'];

export const NOME_HORA: Record<HoraDoDia, string> = { amanhecer: 'Amanhecer', dia: 'Dia', anoitecer: 'Anoitecer', noite: 'Noite' };

export interface JeitoDaHora {
  /** quanto a hora escurece o cômodo (somado à escuridão da cena) e a cena ao ar livre */
  escuro: number;
  escuroFora: number;
  /** a cor do ar (null = a da cena) */
  ambiente: string | null;
  /** a luz que entra pelas janelas: a cor (vazia = a da janela), a força e se o feixe de sol cai no chão */
  janela: { cor: string; forca: number; feixe: boolean };
  /** o céu desenhado nos vidros: em cima e embaixo (vazio = o da arte) e se tem estrelas */
  ceu: [string, string];
  estrelas: boolean;
}

export const JEITO_DA_HORA: Record<HoraDoDia, JeitoDaHora> = {
  amanhecer: { escuro: 0.12, escuroFora: 0.22, ambiente: '#ff9a7a', janela: { cor: '#ffb48a', forca: 0.7, feixe: true }, ceu: ['#6a78b8', '#ffb490'], estrelas: false },
  dia: { escuro: 0, escuroFora: 0, ambiente: null, janela: { cor: '', forca: 1, feixe: true }, ceu: ['', ''], estrelas: false },
  anoitecer: { escuro: 0.28, escuroFora: 0.36, ambiente: '#ff7a4a', janela: { cor: '#ff9a5a', forca: 0.62, feixe: true }, ceu: ['#4a2a6a', '#ff8a4a'], estrelas: false },
  noite: { escuro: 0.55, escuroFora: 0.6, ambiente: '#2a3a7a', janela: { cor: '#7a90d0', forca: 0.3, feixe: false }, ceu: ['#050918', '#18284c'], estrelas: true },
};

/** A hora que veio da rede ou do banco, conferida (null = nenhuma válida). */
export const lerHora = (v: unknown): HoraDoDia | null => (HORAS.includes(v as HoraDoDia) ? (v as HoraDoDia) : null);

/** A escuridão da cena nesta hora (a da cena mais a da hora; ao ar livre, mais). */
export function escuroDaHora(base: number, hora: HoraDoDia | undefined, aberto: boolean): number {
  if (!hora || hora === 'dia') return base;
  const j = JEITO_DA_HORA[hora];
  return Math.min(0.92, base + (aberto ? j.escuroFora : j.escuro));
}
