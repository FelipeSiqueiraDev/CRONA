/**
 * A janela única de refazer a mochila (03/11, o Felipe): cada jogador ganha, uma vez, a chance de pedir itens e mexer nas
 * modificações mesmo fora da base, sempre dentro do livro (patente, espaços, proficiência). Ao "Confirmar equipamento" ela
 * fecha para sempre: daí em diante o equipamento só muda na base (a Sede da Ordem). O marcador é `equipamentoLivre` na ficha;
 * o servidor só deixa passar de `aberto` a `confirmado`.
 */
import { regras, type FichaSalva } from '@crona/shared';
import { h } from './dom';
import { botao, janela } from './fichaModal';

export const equipamentoAberto = (fs?: FichaSalva | null): boolean => fs?.ficha.equipamentoLivre === 'aberto';

/** Pode pedir itens e mexer nas modificações: na base, ou com a janela única aberta. */
export const podeMexerEquipamento = (fs?: FichaSalva | null): boolean => !!fs && (!!fs.naBase || equipamentoAberto(fs));

const numero = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

/** "5/10 espaços · cat. I 1/3 · cat. II 1/1": a mochila de agora contra os limites do livro. */
export function resumoDaMochila(fs: FichaSalva): string {
  const c = regras.calcular(fs.ficha);
  const vagas = c.itens.filter((l) => l.limite > 0);
  return `${numero(c.carga.usados)}/${c.carga.espacos} espaços · ${vagas.map((l) => `cat. ${['0', 'I', 'II', 'III', 'IV'][l.categoria]} ${l.usados}/${l.limite}`).join(' · ') || 'patente sem limite de categoria'}`;
}

export interface AcoesEquipamentoLivre {
  /** abre a requisição de itens da Ordem */
  pedir: () => void;
  /** grava `equipamentoLivre: 'confirmado'` */
  confirmar: () => void;
}

/** O aviso (no padrão do "VOCÊ EVOLUIU"): a chance de refazer a mochila e o que acontece depois de confirmar. */
export function janelaEquipamentoLivre(fs: FichaSalva, ac: AcoesEquipamentoLivre) {
  const j = janela('EQUIPAMENTO', 'mochila', () => {}, 46);
  j.el.classList.add('fc-subida', 'fc-equip-livre');
  const aviso = () => {
    j.corpo.replaceChildren(
      h('p', { class: 'fc-subida-intro' }, 'Esta é a sua chance de refazer a mochila.'),
      h(
        'section',
        { class: 'fc-evo-passo' },
        h('p', { class: 'fc-evo-rot' }, 'O que você pode fazer agora'),
        h(
          'ul',
          { class: 'fc-evo-lista' },
          h('li', null, 'Pedir à Ordem os itens que vai levar, mesmo fora da base.'),
          h('li', null, 'Mexer nas modificações das armas, das proteções e dos itens.'),
          h('li', null, 'Tirar o que não quer mais levar.'),
        ),
        h('p', { class: 'fc-evo-rot' }, 'Tudo segue o livro'),
        h('p', { class: 'fj-dica' }, 'A patente limita as categorias (LR p. 52), os espaços limitam a carga (LR p. 53) e a proficiência conta. A janela não deixa passar do limite.'),
        h('p', { class: 'fc-evo-rot' }, 'Depois de confirmar'),
        h('p', { class: 'fj-dica' }, 'Não volta: daí em diante o equipamento só muda na base (a Sede da Ordem). Escolha com calma e só então confirme.'),
        h('p', { class: 'fc-nota' }, `Mochila de agora: ${resumoDaMochila(fs)}`),
      ),
    );
    j.rodape.replaceChildren(
      botao('Agora não', 'fechar', '', () => j.fechar()),
      botao('Pedir itens', 'mais', '', () => (j.fechar(), ac.pedir())),
      botao('Confirmar equipamento', 'ok', 'forte', confirmacao),
    );
  };
  const confirmacao = () => {
    j.corpo.replaceChildren(
      h('p', { class: 'fc-subida-intro' }, 'Confirmar o equipamento?'),
      h('p', { class: 'fj-dica' }, `Mochila: ${resumoDaMochila(fs)}. Depois de confirmar, a mochila só muda na base da Ordem (a Sede).`),
    );
    j.rodape.replaceChildren(
      botao('Voltar', 'esquerda', '', aviso),
      botao('Sim, confirmar', 'ok', 'forte', () => (j.fechar(), ac.confirmar())),
    );
  };
  aviso();
  return j;
}
