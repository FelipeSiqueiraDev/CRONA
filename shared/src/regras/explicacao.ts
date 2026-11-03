/**
 * Por que cada pendência existe (03/11, o Felipe: "as pendências você deixa de aviso tipo o 'você evoluiu', só que
 * explicada do porquê"). O texto sai das regras do motor (`ganhosDoNex`, a classe, a trilha, a origem e as
 * habilidades do catálogo), nunca de um texto fixo por pessoa: vale para qualquer jogador e NEX.
 */
import * as cat from './dados';
import type { Ficha } from './ficha';
import type { Pendencia } from './estado';
import { resumoEvolucao } from './evolucao';
import { ganhosDoNex } from './nex';
import type { Habilidade, Nex, Ref } from './tipos';
import { NEX_LISTA } from './tipos';

export interface ExplicacaoPendencia {
  /** a regra do livro que gera a escolha, com o NEX dela */
  porque: string;
  ref?: Ref;
}

const LR = (pagina: number): Ref => ({ fonte: 'LR', pagina });
const SAH = (pagina: number): Ref => ({ fonte: 'SaH', pagina });

/** Os NEX em que a classe ganha esse tipo de coisa (a tabela do livro, via `ganhosDoNex`). */
function nexDe(f: Ficha, tipo: string): Nex[] {
  return NEX_LISTA.filter((n) => ganhosDoNex(f.classe, n, f.comecouMundano).some((g) => g.tipo === tipo));
}
const lista = (ns: Nex[]) => (ns.length > 1 ? `${ns.slice(0, -1).map((n) => `${n}%`).join(', ')} e ${ns[ns.length - 1]}%` : ns.map((n) => `${n}%`).join(''));

/** A habilidade ou o poder do catálogo pelo id, com de onde ele veio na ficha. */
function acharHabilidade(f: Ficha, id: string): { h: Habilidade | undefined; de: string } {
  const classe = f.classe ? cat.classe(f.classe) : undefined;
  const hc = classe?.habilidades.find((x) => x.id === id);
  if (hc) return { h: hc, de: `habilidade de classe do ${classe!.nome.toLowerCase()}` };
  const trilha = f.trilha ? cat.trilha(f.trilha) : undefined;
  const ht = trilha?.habilidades.find((x) => x.id === id);
  if (ht) return { h: ht, de: `habilidade da trilha ${trilha!.nome}` };
  const origem = f.origem ? cat.origem(f.origem) : undefined;
  if (origem?.poder?.id === id) return { h: origem.poder, de: `poder da origem ${origem.nome}` };
  const p = cat.poder(id);
  if (p) return { h: p as unknown as Habilidade, de: 'poder' };
  return { h: undefined, de: 'habilidade' };
}

export function explicarPendencia(f: Ficha, p: Pendencia): ExplicacaoPendencia {
  const classe = f.classe ? cat.classe(f.classe).nome.toLowerCase() : 'agente';
  const nex = `NEX ${p.nex}%`;
  switch (p.tipo) {
    case 'poder':
      return { porque: `Todo ${classe} ganha um poder de classe nos NEX ${lista(nexDe(f, 'poder'))}. Você está no ${nex}, então chegou a hora de escolher mais um.`, ref: LR(23) };
    case 'atributo':
      return p.nex === 5 && f.comecouMundano
        ? { porque: 'Quem entra na Ordem começando como pessoa comum treina o corpo e a mente: você ganha pontos de atributo no treinamento, até o máximo de 3 em cada.', ref: LR(22) }
        : { porque: `Nos NEX ${lista(nexDe(f, 'atributo'))} todo agente aumenta um atributo em +1 (até o máximo de 5). Você está no ${nex}, então escolhe qual sobe.`, ref: LR(23) };
    case 'grau':
      return { porque: `Nos NEX ${lista(nexDe(f, 'grau'))} as perícias treinadas sobem de grau: veterano no primeiro, expert no segundo. Você escolhe quais sobem.`, ref: LR(23) };
    case 'trilha':
      return { porque: `No NEX 10% todo ${classe} escolhe a trilha da sua classe, o caminho que define as habilidades dele nos NEX seguintes. A escolha vale para o resto da vida do agente.`, ref: LR(23) };
    case 'versatilidade':
      return { porque: 'No NEX 50% o agente escolhe entre mais um poder da própria classe ou o primeiro poder de outra trilha dela: é a versatilidade.', ref: LR(23) };
    case 'afinidade':
      return { porque: 'No NEX 50% o agente se alinha a um dos quatro elementos (Sangue, Morte, Conhecimento ou Energia). Ela marca o elemento do agente daí em diante.', ref: LR(23) };
    case 'periciaIntelecto':
      return { porque: `O seu Intelecto subiu, e cada ponto de Intelecto dá uma perícia treinada a mais. Por isso, no ${nex}, você escolhe uma perícia nova para treinar.`, ref: LR(22) };
    case 'pericias':
      return /^Escolha mais/.test(p.texto)
        ? { porque: 'A classe dá um número de perícias treinadas somado ao Intelecto, fora as da origem e as fixas da classe. Perícia que repete (a classe e a origem dão a mesma) vale uma vez só: a que sobra você escolhe livremente no lugar.', ref: LR(22) }
        : { porque: `A origem e a classe dão perícias treinadas; onde o livro deixa "à escolha", é você quem escolhe (${nex}).`, ref: LR(22) };
    case 'ritual': {
      if (p.alvo) {
        const { h, de } = acharHabilidade(f, p.alvo);
        return { porque: `${h?.nome ?? 'Esta habilidade'} (${de}) ensina rituais à sua escolha: você decide quais, dentro dos círculos que já pode lançar.`, ref: h?.ref ?? LR(32) };
      }
      return { porque: `O ocultista aprende um ritual novo a cada NEX a partir de 10%, de um círculo que já pode lançar. Você está no ${nex}, então escolhe o ritual deste NEX.`, ref: LR(32) };
    }
    case 'paranormal':
      return { porque: `Um poder seu pede que você escolha um poder paranormal (${nex}). Ele vem de uma habilidade ou da origem do agente, e quem escolhe qual é você.`, ref: LR(24) };
    case 'classe':
      return { porque: 'A classe define PV, PE, SAN, perícias e habilidades do agente; todo agente escolhe uma na criação.', ref: LR(22) };
    case 'origem':
      return { porque: 'A origem é o que o agente fazia antes da Ordem: dá perícias treinadas e um poder. Todo agente escolhe uma na criação.', ref: LR(22) };
    case 'atributos':
      return { porque: 'Os pontos de atributo da criação são distribuídos pelo jogador (cada atributo de 0 a 3 no início).', ref: LR(22) };
    case 'parametro': {
      // a Progressão de NEX do Monstruoso (SaH p. 17 e 99) é uma alteração geral, não uma habilidade do catálogo
      if (f.trilha === 'monstruoso' && p.alvo?.startsWith('alteracao-nex')) {
        const anterior = NEX_LISTA[Math.max(0, NEX_LISTA.indexOf(p.nex) - 1)];
        const g = resumoEvolucao(f, anterior).find((x) => x.nex === p.nex)?.ganhos.find((x) => x.titulo === 'Alteração do Monstruoso');
        return { porque: `Quem segue a trilha Monstruoso recebe, no ${nex}, uma alteração que traz uma vantagem e um preço: ${g?.texto ?? 'a escolha é sua.'} Por isso você escolhe agora.`, ref: g?.ref ?? SAH(99) };
      }
      const { h, de } = acharHabilidade(f, p.alvo ?? '');
      if (!h) return { porque: `Uma escolha da sua ficha (${nex}) ficou em aberto: sem ela a habilidade não funciona.` };
      return { porque: `${h.nome} é ${de === 'poder' ? 'um poder seu' : `uma ${de}`} e só funciona depois de você escolher o que ela pede${h.resumo ? `: ${h.resumo}` : '.'}`, ref: h.ref };
    }
  }
}

