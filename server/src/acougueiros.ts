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

/**
 * A Dança das Lâminas da Ovelha (01/11): o mestre tinha posto os golpes como ataques soltos ("Dança das Lâminas (1º)",
 * "(2º)", "(3º)"), e a tela mandava cada um como uma ação padrão (o 2º era recusado). Os golpes em sequência viram um
 * ataque só, de ação completa, com o bônus de cada golpe; o lembrete das notas (Defesa 16 depois, anda 3 m entre eles)
 * vira a Defesa −2 e o lembrete do ataque. Vale para o bestiário e para as fichas editadas no combate.
 */
export function juntarSequencias(f: combate.FichaAmeaca): boolean {
  const re = /^(.*\S)\s*\((\d)º\)$/;
  const grupos = new Map<string, combate.AtaqueAmeaca[]>();
  for (const a of f.ataques) {
    const m = re.exec(a.nome);
    if (m) grupos.set(m[1], [...(grupos.get(m[1]) ?? []), a]);
  }
  let mudou = false;
  for (const [nome, lista] of grupos) {
    if (lista.length < 2) continue;
    const ordem = [...lista].sort((a, b) => Number(re.exec(a.nome)![2]) - Number(re.exec(b.nome)![2]));
    const base = ordem[0];
    const dancaOvelha = /dança das lâminas/i.test(nome) && /defesa 16/i.test(f.notas ?? '');
    const junto: combate.AtaqueAmeaca = {
      ...base,
      nome,
      bonus: base.bonus,
      golpes: ordem.map((a) => a.bonus),
      completa: true,
      ...(dancaOvelha ? { defesaDepois: 16 - f.defesa, nota: 'Anda 3 m entre os golpes.' } : {}),
    };
    const i = f.ataques.indexOf(base);
    f.ataques = f.ataques.filter((a) => !lista.includes(a));
    f.ataques.splice(Math.min(i, f.ataques.length), 0, junto);
    mudou = true;
  }
  return mudou;
}

export function dancaDasLaminas0111(db: Database): boolean {
  const d = db as Database & { danca0111?: boolean };
  if (d.danca0111) return false;
  d.danca0111 = true;
  for (const c of db.bestiario ?? []) juntarSequencias(c.ficha);
  for (const camp of Object.values(db.campaigns ?? {})) for (const f of Object.values(camp.ameacas ?? {})) juntarSequencias(f);
  return true;
}
