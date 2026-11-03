import { regras } from '@crona/shared';
import type { Database } from './db';

/**
 * As decisões do Felipe de 03/11/2026 sobre as fichas, uma vez só (`db.ajustesFichas0311`):
 *  - a mochila do Ômega-99 e a da ??? ficam vazias (estavam acima do limite do livro);
 *  - PV, PE e SAN atuais dos quatro jogadores sobem ao máximo (o do motor), na ficha e na peça do tabuleiro;
 *  - os quatro ganham a janela única de refazer a mochila (`equipamentoLivre: 'aberto'`), que substitui o aviso de
 *    refazer o equipamento de 19/10; a mochila de agora é o ponto de partida (Tepes e Alosi começam vazios);
 *  - a arma de Calibre Grosso passa a usar a munição de calibre grosso (LR p. 60): o pacote de munição normal da arma
 *    vira o de calibre grosso, sem perder a quantidade (a Cora: fuzil de caça + 3 balas longas).
 */
const JOGADORES = ['D.Tepes', 'Catarina Albuquerque', 'Alosi Walker', 'Cora Falcão'];
const ESVAZIAR = ['omega-99', 'interrogacao'];

export function ajustesFichas0311(db: Database): boolean {
  const d = db as Database & { ajustesFichas0311?: boolean };
  if (d.ajustesFichas0311) return false;
  d.ajustesFichas0311 = true;
  const agora = new Date().toISOString();
  for (const f of db.fichas ?? []) {
    let mexeu = false;
    if (f.npc && ESVAZIAR.includes(f.npc)) {
      f.ficha.inventario = [];
      mexeu = true;
    }
    if (!f.npc && JOGADORES.includes(f.nome)) {
      f.ficha.equipamentoLivre = 'aberto';
      delete f.ficha.refazerEquipamento;
      const c = regras.calcular(f.ficha);
      f.atual = { ...f.atual, pv: c.pv, pe: c.pe, san: c.san };
      const v = { pv: c.pv, pvMax: c.pv, pe: c.pe, peMax: c.pe, san: c.san, sanMax: c.san };
      if (f.personagem)
        for (const r of db.rooms)
          for (const t of r.tokens ?? []) if (t.look?.charId === f.personagem && t.vitals) t.vitals = { ...t.vitals, ...v };
      mexeu = true;
    }
    if (calibreGrosso(f.ficha)) mexeu = true;
    if (mexeu) f.atualizadaEm = agora;
  }
  return true;
}

/** A munição normal da arma de Calibre Grosso vira a de calibre grosso, se nenhuma outra arma da mochila usa a normal. */
function calibreGrosso(ficha: regras.Ficha): boolean {
  let mexeu = false;
  const inv = ficha.inventario ?? [];
  const usaNormal = (municao: string) => inv.some((x) => x.tipo === 'arma' && regras.catalogo.arma(x.id)?.municao === municao && !x.modificacoes?.includes('calibre-grosso'));
  for (const it of inv) {
    if (it.tipo !== 'arma' || !it.modificacoes?.includes('calibre-grosso')) continue;
    const municao = regras.catalogo.arma(it.id)?.municao;
    if (!municao || usaNormal(municao)) continue;
    const grosso = regras.catalogo.equipamento(municao + '-calibre-grosso');
    if (!grosso) continue;
    for (const m of inv)
      if (m.tipo === 'equipamento' && m.id === municao && !m.modificacoes?.length) {
        m.id = grosso.id;
        m.nome = grosso.nome;
        mexeu = true;
      }
  }
  return mexeu;
}
