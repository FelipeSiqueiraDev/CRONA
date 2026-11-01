/**
 * Confere um requisito contra o estado da ficha num NEX e explica o motivo
 * quando não cumpre ("Precisa de Força 2 (tem 1)").
 */
import * as cat from './dados';
import type { Estado } from './estado';
import type { Ficha, ValorEscolha } from './ficha';
import type { AtributoId, Elemento, Grau, Nex, Requisito } from './tipos';
import { GRAUS } from './tipos';

export const NOME_ATRIBUTO: Record<AtributoId, string> = {
  agi: 'Agilidade',
  for: 'Força',
  int: 'Intelecto',
  pre: 'Presença',
  vig: 'Vigor',
};

export const NOME_ELEMENTO: Record<Elemento, string> = {
  sangue: 'Sangue',
  morte: 'Morte',
  conhecimento: 'Conhecimento',
  energia: 'Energia',
  medo: 'Medo',
};

const NOME_GRAU: Record<Grau, string> = { destreinado: 'destreinado', treinado: 'treinado', veterano: 'veterano', expert: 'expert' };

/** Com o que conferir: o estado até o NEX, a ficha e a escolha feita junto. */
export interface Contexto {
  estado: Estado;
  ficha: Ficha;
  nex: Nex;
  /** a escolha feita junto com o poder (ex.: a perícia de Foco em Perícia) */
  escolha?: ValorEscolha;
  /** o elemento do poder paranormal sendo conferido */
  elemento?: Elemento;
  /** id do próprio poder (não conta como requisito de si mesmo) */
  proprio?: string;
}

export interface Resultado {
  ok: boolean;
  motivos: string[];
  /** requisitos que o CRONA não confere sozinho */
  avisos: string[];
}

const sim = (avisos: string[] = []): Resultado => ({ ok: true, motivos: [], avisos });
const nao = (motivo: string): Resultado => ({ ok: false, motivos: [motivo], avisos: [] });

function nomePoder(id: string): string {
  return cat.poder(id)?.nome ?? cat.paranormal(id)?.nome ?? id;
}

/** Elemento em que o poder obtido conta (já resolvido pela escolha em montarEstado). */
function elementoDoObtido(p: Estado['poderes'][number]): Elemento | undefined {
  return p.elemento;
}

export function atende(r: Requisito, c: Contexto): Resultado {
  const st = c.estado;
  switch (r.tipo) {
    case 'atributo': {
      const v = st.atributos[r.atributo];
      return v >= r.min ? sim() : nao(`Precisa de ${NOME_ATRIBUTO[r.atributo]} ${r.min} (tem ${v}).`);
    }
    case 'pericia': {
      const alvo = r.grau ?? 'treinado';
      const ids = r.pericia === 'escolhida' ? (c.escolha?.pericias ?? []) : [r.pericia];
      if (!ids.length) return sim();
      for (const id of ids) {
        const g = st.graus[id];
        if (GRAUS.indexOf(g) < GRAUS.indexOf(alvo)) return nao(`Precisa ser ${NOME_GRAU[alvo]} em ${cat.pericia(id).nome}.`);
      }
      return sim();
    }
    case 'nex':
      return c.nex >= r.min ? sim() : nao(`Só a partir de NEX ${r.min}%.`);
    case 'poder': {
      const tem = st.poderes.filter((p) => p.id === r.poder && p.id !== c.proprio);
      if (!tem.length) return nao(`Precisa do poder ${nomePoder(r.poder)}.`);
      if (r.mesmaEscolha && c.escolha) {
        const igual = tem.some((p) => (c.escolha?.elemento ? p.escolha?.elemento === c.escolha.elemento : true) && (c.escolha?.pericias ? JSON.stringify(p.escolha?.pericias) === JSON.stringify(c.escolha.pericias) : true));
        if (!igual) return nao(`Precisa do poder ${nomePoder(r.poder)} com a mesma escolha.`);
      }
      return sim();
    }
    case 'elemento': {
      const el = c.elemento;
      if (!el) return sim();
      const n = st.poderes.filter((p) => p.tipo === 'paranormal' && p.id !== c.proprio && elementoDoObtido(p) === el).length;
      return n >= r.min ? sim() : nao(`Precisa de ${r.min} outro${r.min > 1 ? 's' : ''} poder${r.min > 1 ? 'es' : ''} de ${NOME_ELEMENTO[el]} (tem ${n}).`);
    }
    case 'afinidade': {
      const el = r.elemento ?? (c.elemento === 'medo' ? undefined : c.elemento);
      if (!st.afinidade || !st.afinidadeAtiva) return nao('Precisa de afinidade com um elemento.');
      if (el && st.afinidade !== el) return nao(`Precisa de afinidade com ${NOME_ELEMENTO[el]}.`);
      return sim();
    }
    case 'classe':
      return st.classe === r.classe ? sim() : nao(`Só para ${cat.classe(r.classe).nome.toLowerCase()}.`);
    case 'trilha':
      return c.ficha.trilha === r.trilha ? sim() : nao(`Só para a trilha ${cat.trilha(r.trilha)?.nome ?? r.trilha}.`);
    case 'circulo': {
      const max = maxCirculo(c);
      return max >= r.min ? sim() : nao(`Precisa conjurar rituais de ${r.min}º círculo.`);
    }
    case 'algum': {
      const res = r.de.map((x) => atende(x, c));
      if (res.some((x) => x.ok)) return sim(res.flatMap((x) => x.avisos));
      return nao(res.flatMap((x) => x.motivos).join(' Ou: '));
    }
    case 'nao': {
      const res = atende(r.req, c);
      return res.ok ? nao(`Não pode ter: ${descreverRequisito(r.req)}.`) : sim();
    }
    case 'texto':
      return sim([`O mestre confere: ${r.texto}.`]);
  }
}

function maxCirculo(c: Contexto): number {
  const st = c.estado;
  const cl = cat.classe(st.classe);
  if (cl.rituais) {
    let m = 0;
    for (const k of [1, 2, 3, 4] as const) if (c.nex >= cl.rituais.circulos[k]) m = k;
    return m;
  }
  return st.rituais.length ? (c.nex >= 75 ? 3 : c.nex >= 45 ? 2 : 1) : 0;
}

/** Texto curto de um requisito (para mostrar na opção). */
export function descreverRequisito(r: Requisito): string {
  switch (r.tipo) {
    case 'atributo':
      return `${NOME_ATRIBUTO[r.atributo]} ${r.min}`;
    case 'pericia':
      return r.pericia === 'escolhida' ? `${NOME_GRAU[r.grau ?? 'treinado']} na perícia escolhida` : `${NOME_GRAU[r.grau ?? 'treinado']} em ${cat.pericia(r.pericia).nome}`;
    case 'nex':
      return `NEX ${r.min}%`;
    case 'poder':
      return nomePoder(r.poder) + (r.mesmaEscolha ? ' (mesma escolha)' : '');
    case 'elemento':
      return `${r.min} outro${r.min > 1 ? 's' : ''} poder${r.min > 1 ? 'es' : ''} do elemento`;
    case 'afinidade':
      return r.elemento ? `afinidade com ${NOME_ELEMENTO[r.elemento]}` : 'afinidade com o elemento';
    case 'classe':
      return cat.classe(r.classe).nome;
    case 'trilha':
      return `trilha ${cat.trilha(r.trilha)?.nome ?? r.trilha}`;
    case 'circulo':
      return `rituais de ${r.min}º círculo`;
    case 'algum':
      return r.de.map(descreverRequisito).join(' ou ');
    case 'nao':
      return `não ter ${descreverRequisito(r.req)}`;
    case 'texto':
      return r.texto;
  }
}

/** O nome da execução do ritual para mostrar (a ficha mostrava o código: "padrao"). */
export const NOME_EXECUCAO: Record<string, string> = { livre: 'livre', reacao: 'reação', movimento: 'movimento', padrao: 'padrão', completa: 'completa' };
export const nomeExecucao = (e: string) => NOME_EXECUCAO[e] ?? e;
