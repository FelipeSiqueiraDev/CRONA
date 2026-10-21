import { combate, existidoPadrao, type AvatarLook, type Criatura } from '@crona/shared';
import type { Database } from './db';

/**
 * Os Açougueiros (21/10, o Felipe: "fazer os AÇOUGUEIROS também"): quatro ameaças do culto, de máscara de animal, cada uma
 * uma criatura do bestiário com a arte própria (arte/personagens/<bicho>-acougueiro: foto, rosto e o boneco do tabuleiro).
 *
 * A ficha de combate NÃO tem números do livro: eles vieram só como ilustração. Entra a ficha rápida em branco, no elemento
 * Sangue, com PV provisório, e o mestre define o resto pelo painel da ameaça. Entram uma vez; o que o mestre mudar fica.
 */
const lookBase: AvatarLook = { skin: '#b88a74', hair: '#2a1a16', hairStyle: 0, top: '#2a1a1a', pants: '#2a2224', shoes: '#1c1a17', outfit: 0, extra: 0, charId: null };

const ACOUGUEIROS: { id: string; nome: string; skin: string }[] = [
  { id: 'galo-acougueiro', nome: 'Galo (Açougueiro)', skin: '#c49a82' },
  { id: 'touro-acougueiro', nome: 'Touro (Açougueiro)', skin: '#c49078' },
  { id: 'porco-acougueiro', nome: 'Porco (Açougueiro)', skin: '#d29a8a' },
  { id: 'ovelha-acougueiro', nome: 'Ovelha (Açougueira)', skin: '#caa088' },
];

function criatura(a: (typeof ACOUGUEIROS)[number]): Criatura {
  const ficha = combate.fichaAmeacaVazia();
  ficha.tipo = 'Pessoa';
  ficha.elemento = 'sangue';
  ficha.notas = 'Açougueiro do culto: ficha a definir pelo mestre (o PV e os testes são provisórios).';
  return { id: a.id, nome: a.nome, ficha, pv: 20, aparencias: [{ id: 'padrao', nome: 'Padrão', arte: a.id, look: { ...lookBase, skin: a.skin } }] };
}

export function acougueirosNoBestiario(db: Database): boolean {
  const d = db as Database & { acougueiros2110?: boolean };
  if (d.acougueiros2110) return false;
  d.acougueiros2110 = true;
  db.bestiario ??= [existidoPadrao()];
  for (const a of ACOUGUEIROS) if (!db.bestiario.some((c) => c.id === a.id)) db.bestiario.push(criatura(a));
  return true;
}
