/**
 * O que o livro dá a cada NEX que um agente subiu (21/10, o Felipe: o aviso de "você evoluiu" tem de dizer, conforme o
 * livro, o que entra sozinho e o que o jogador escolhe). Só junta o que o motor e o catálogo já sabem: `ganhosDoNex`
 * (LR p. 23, Tab. 1.2 a 1.5), as escalas das habilidades de classe (Ataque Especial, Perito, Escolhido pelo Outro
 * Lado), a habilidade da trilha e os máximos de PV, PE e SAN.
 */
import { calcular } from './calcular';
import { ESCALAS_CLASSE } from './dados/classes';
import * as cat from './dados';
import type { Ficha } from './ficha';
import { ganhosDoNex, limitePeDoNex, nexAte } from './nex';
import type { Nex, Ref } from './tipos';

export interface GanhoLivro {
  titulo: string;
  texto?: string;
  ref?: Ref;
  /** o jogador escolhe (pendência), em vez de entrar sozinho */
  escolha?: boolean;
  /** o mestre aplica na ficha (fora das contas do motor) */
  mestre?: boolean;
}

export interface PassoEvolucao {
  nex: Nex;
  ganhos: GanhoLivro[];
  /** máximos neste NEX e quanto subiram em relação ao NEX anterior */
  pv: { total: number; mais: number };
  pe: { total: number; mais: number };
  san: { total: number; mais: number };
  limitePe: number;
}

const refTexto = (r?: Ref) => (r ? `${r.fonte} p. ${r.pagina}` : '');
export const textoRef = refTexto;

const LR = (pagina: number): Ref => ({ fonte: 'LR', pagina });

/** Os passos de NEX entre `de` (exclusivo) e o NEX da ficha (inclusivo). */
export function resumoEvolucao(f: Ficha, de: Nex): PassoEvolucao[] {
  const passos: PassoEvolucao[] = [];
  let antes = calcular({ ...f, nex: de });
  const classe = f.classe ? cat.classe(f.classe) : null;
  const trilha = f.trilha ? cat.trilha(f.trilha) : undefined;
  for (const nex of nexAte(f.nex, de).filter((n) => n > de)) {
    const k = calcular({ ...f, nex });
    const ganhos: GanhoLivro[] = [];
    for (const g of ganhosDoNex(f.classe, nex, f.comecouMundano)) {
      switch (g.tipo) {
        case 'poder':
          ganhos.push({ titulo: 'Poder de classe', texto: 'Você escolhe um poder da sua classe.', ref: LR(23), escolha: true });
          break;
        case 'atributo':
          ganhos.push({ titulo: 'Aumento de atributo', texto: '+1 em um atributo, até o máximo de 5.', ref: LR(23), escolha: true });
          break;
        case 'grau':
          ganhos.push({ titulo: 'Grau de treinamento', texto: 'Perícias treinadas sobem de grau (veterano em 35%, expert em 70%).', ref: LR(23), escolha: true });
          break;
        case 'habilidadeTrilha': {
          const h = trilha?.habilidades.find((x) => x.nex === nex);
          ganhos.push({ titulo: h ? `Habilidade de trilha: ${h.nome}` : 'Habilidade de trilha', texto: h?.resumo, ref: h?.ref ?? trilha?.ref });
          break;
        }
        case 'trilha':
          ganhos.push({ titulo: 'Trilha', texto: 'Você escolhe a trilha da sua classe e ganha a primeira habilidade dela.', ref: LR(23), escolha: true });
          break;
        case 'versatilidade':
          ganhos.push({ titulo: 'Versatilidade', texto: 'Um poder de classe ou o primeiro poder de outra trilha da classe.', ref: LR(23), escolha: true });
          break;
        case 'afinidade':
          ganhos.push({ titulo: 'Afinidade', texto: 'Você escolhe o elemento de afinidade.', ref: LR(23), escolha: true });
          break;
        case 'ritual':
          ganhos.push({ titulo: 'Ritual novo', texto: 'Você aprende um ritual de um círculo que já pode lançar.', ref: LR(32), escolha: true });
          break;
        default:
          break;
      }
    }
    // as habilidades de classe que crescem neste NEX (Tab. 1.3, 1.4 e 1.5)
    for (const h of classe?.habilidades ?? []) {
      const e = ESCALAS_CLASSE[h.id]?.find((x) => x.nex === nex);
      if (!e) continue;
      const texto =
        h.id === 'escolhido-pelo-outro-lado' ? `Libera o ${e.texto} de rituais.` : `${e.custoPe ?? h.custoPe ?? 0} PE: ${e.texto}.`;
      ganhos.push({ titulo: `${h.nome} cresce`, texto, ref: h.ref });
    }
    // o Monstruoso segue a Progressão de NEX do SaH (p. 17 e 99): as alterações de 25% e 35% entram nas contas e pedem uma escolha
    if (f.trilha === 'monstruoso') {
      const SAH99: Ref = { fonte: 'SaH', pagina: 99 };
      if (nex === 25)
        ganhos.push({
          titulo: 'Alteração do Monstruoso',
          texto: 'Faz testes de Ocultismo mesmo sem treino e, se for treinado, recebe +2 (já nas contas). Em troca, sofre −5 numa perícia à sua escolha entre Diplomacia, Enganação ou Intimidação.',
          ref: SAH99,
          escolha: true,
        });
      if (nex === 35)
        ganhos.push({
          titulo: 'Alteração do Monstruoso',
          texto: 'Escolhe um atributo (menos Presença) e soma ao total de PE (já nas contas). Em troca, sofre −5 numa perícia à sua escolha entre Atletismo, Fortitude ou Reflexos.',
          ref: SAH99,
          escolha: true,
        });
      if (nex === 50)
        ganhos.push({ titulo: 'Alteração do Monstruoso', texto: 'Na próxima vez que Transcender, ganha afinidade com um elemento à escolha (Conhecimento, Energia, Morte ou Sangue); daí em diante recebe as alterações desse elemento (o mestre aplica).', ref: SAH99, mestre: true });
    }
    passos.push({
      nex,
      ganhos,
      pv: { total: k.pv, mais: k.pv - antes.pv },
      pe: { total: k.pe, mais: k.pe - antes.pe },
      san: { total: k.san, mais: k.san - antes.san },
      limitePe: limitePeDoNex(nex),
    });
    antes = k;
  }
  return passos;
}
