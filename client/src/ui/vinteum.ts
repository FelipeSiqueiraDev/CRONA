/**
 * O 21 da Sala de Jogos da mansão (23/10), no celular de quem joga (ou na janelinha do mestre, pelos NPCs). As regras
 * ficam em shared/src/bar/vinteum.ts: cada aparelho refaz a partida pelas jogadas guardadas, com o sapato da semente.
 *
 * - A MESA (antes de começar): cada um marca se quer ser o dealer; quem chegou primeiro escolhe as fichas e começa.
 * - A RODADA: as fichas de apostar (5, 25, 100, 500, 1000) montam a aposta; na vez, Pedir, Parar, Dobrar e Dividir. O
 *   dealer de gente distribui, vira a carta e compra; a casa faz isso sozinha.
 *
 * O feltro verde em meia-lua com o friso de couro, as cartas entrando uma a uma do sapato, as fichas empilhadas na
 * aposta e a faixa de quem joga. Desenhado por código (cartas e fichas em CSS).
 */
import { bar } from '@crona/shared';
import { faixa } from './barFx';
import type { Dados, Mesa, TelaDoBar } from './barJogos';
import { botaoMusica } from './dardos';
import { musica } from './chiptune';
import { h } from './dom';
import { sfx } from './sfx';
import './vinteum.css';

const V = bar.vinteum;
type Partida = bar.vinteum.Partida;
const curto = (n: string) => n.split(/\s+/)[0] ?? n;
/** o tempo entre uma carta e outra saindo do sapato */
const PASSO_CARTA = 0.32;
/** a cor de cada ficha de apostar */
const COR_FICHA: Record<number, string> = { 5: '#d8402f', 25: '#2f9a52', 100: '#232328', 500: '#7a3ab0', 1000: '#d8a830' };
const COMO: Record<bar.vinteum.Resultado['como'], string> = { bj: 'BLACKJACK', ganhou: 'GANHOU', empate: 'EMPATE', perdeu: 'PERDEU', estourou: 'ESTOUROU' };

export class Vinteum implements TelaDoBar {
  readonly el: HTMLElement;
  private banca = h('div', { class: 'v21-banca' });
  private casa = h('div', { class: 'v21-casa' });
  private meio = h('div', { class: 'v21-meio' });
  private lugares = h('div', { class: 'v21-lugares' });
  private palco: HTMLElement;
  private aviso = h('p', { class: 'bj-aviso' });
  private controles = h('div', { class: 'v21-controles' });
  private nova: HTMLButtonElement;
  private m: Mesa | null = null;
  private p: Partida = V.nova(1);
  private ligado = false;
  /** as fichas que o primeiro lugar escolheu para começar */
  private fichas = 500;
  /** a aposta montada (antes de mandar) */
  private montada = 0;
  /** as cartas que já apareceram (as novas entram voando do sapato) */
  private vistas = new Set<string>();
  private recado = '';
  private recadoAte = 0;
  private vezAnunciada = '';
  /** quantas cartas entraram no último desenho (a faixa da vez espera elas chegarem) */
  private novasAgora = 0;

  constructor() {
    this.nova = h('button', { class: 'bj-bt', type: 'button', onclick: () => this.mandar(this.m?.eu[0] ?? 0, { tipo: 'mesa' }) }, 'Nova partida') as HTMLButtonElement;
    this.palco = h('div', { class: 'bj-palco v21-feltro' }, this.casa, this.meio, this.lugares);
    this.el = h(
      'div',
      { class: 'bj bj-21' },
      h('header', { class: 'bj-topo' }, h('b', null, '21'), h('span', null, 'blackjack · a banca para no 17 · o 21 de saída paga 3 para 2'), botaoMusica()),
      this.banca,
      this.palco,
      this.aviso,
      this.controles,
      h('footer', { class: 'bj-rodape' }, this.nova, h('button', { class: 'bj-bt sair', type: 'button', onclick: () => this.m?.sair() }, 'Sair')),
    );
  }

  // ---------------------------------------------------------------- a mesa e as jogadas

  mesa(m: Mesa, log: { de: number; dados: Dados }[]) {
    const mudou = !this.m || this.m.jogadores.join('|') !== m.jogadores.join('|');
    this.m = m;
    if (mudou || log.length) {
      this.p = V.nova(m.jogadores.length);
      for (const { de, dados } of log) this.p = V.jogar(this.p, de, dados);
      // ao reconectar, o que já estava na mesa não voa de novo
      this.vistas.clear();
      this.marcarVistas();
      this.montada = 0;
    }
    this.render();
  }

  jogada(de: number, dados: Dados) {
    this.aplicar(de, dados);
  }

  /** Manda a jogada do lugar `de` (o deste aparelho) e aplica aqui. */
  private mandar(de: number, dados: Dados) {
    if (!this.m) return;
    const antes = this.p;
    const depois = V.jogar(antes, de, dados);
    if (depois === antes) return;
    if (dados.tipo === 'comecar' || dados.tipo === 'mesa') sfx.arpejo([523, 659, 784], 0.06);
    else sfx.click();
    this.m.enviar(dados, true, de);
    this.aplicar(de, dados);
  }

  private aplicar(de: number, d: Dados) {
    const antes = this.p;
    const depois = V.jogar(antes, de, d);
    if (depois === antes) return;
    this.p = depois;
    if (d.tipo === 'mesa') this.vistas.clear();
    if (d.tipo === 'aposta') sfx.chip(900, 700, 0.04, 0.05);
    this.reagir(antes, depois, de, d);
    this.render();
  }

  /** O que muda na tela além das cartas: o fim da rodada, a banca quebrando, a vez de alguém. */
  private reagir(antes: Partida, p: Partida, de: number, d: Dados) {
    const m = this.m;
    if (!m) return;
    const nome = (i: number) => curto(m.jogadores[i] ?? '');
    if (d.tipo === 'comecar') {
      musica.tocar('bar');
      this.avisar(p.dealer === null ? `A casa é a banca. ${p.fichasIniciais} fichas para cada um.` : `${nome(p.dealer)} é o dealer. ${p.fichasIniciais} fichas para cada um.`);
    }
    if (p.fase === 'fim' && antes.fase !== 'fim') {
      // o resultado entra depois das cartas da banca
      const atraso = this.cartasNovasDaCasa() * PASSO_CARTA * 1000 + 300;
      window.setTimeout(() => {
        if (!this.ligado) return;
        const meus = p.resultados.filter((r) => m.eu.includes(r.lugar));
        const ganhou = meus.some((r) => r.como === 'bj' || r.como === 'ganhou');
        const perdeu = meus.length > 0 && meus.every((r) => r.como === 'perdeu' || r.como === 'estourou');
        if (meus.some((r) => r.como === 'bj')) faixa(this.palco, 'BLACKJACK!', 'festa'), sfx.arpejo([523, 659, 784, 1046, 1318], 0.08);
        else if (ganhou) faixa(this.palco, 'GANHOU!', 'festa'), sfx.arpejo([659, 880, 1046], 0.07);
        else if (perdeu) faixa(this.palco, 'A BANCA LEVOU', 'ruim'), sfx.chip(300, 120, 0.3, 0.07);
        else if (meus.length) faixa(this.palco, 'EMPATE', 'vez');
        if (p.dealer !== null && m.eu.includes(p.dealer)) {
          const saldo = (antes.banca ?? 0) - (p.banca ?? 0);
          faixa(this.palco, saldo > 0 ? `A BANCA PAGOU ${saldo}` : saldo < 0 ? `A BANCA LEVOU ${-saldo}` : 'A BANCA EMPATOU', saldo > 0 ? 'ruim' : 'festa');
        }
      }, atraso);
    }
    if (p.fase === 'acabou' && antes.fase !== 'acabou') {
      const atraso = this.cartasNovasDaCasa() * PASSO_CARTA * 1000 + 1900;
      window.setTimeout(() => {
        if (!this.ligado) return;
        faixa(this.palco, p.fim.toUpperCase(), 'festa');
        musica.tocar(this.venceuAPartida(p) ? 'vitoria' : 'derrota');
        window.setTimeout(() => this.ligado && musica.tocar('bar'), 3200);
      }, atraso);
    }
    // estourou com a carta que pediu
    if (d.tipo === 'pedir' || d.tipo === 'dobrar') {
      const l = p.lugares[de];
      const mao = l?.maos[antes.lugares[de]?.ativa ?? 0];
      if (mao && V.total(mao.cartas).valor > 21) {
        window.setTimeout(() => this.ligado && faixa(this.palco, m.eu.includes(de) && m.eu.length === 1 ? 'ESTOUROU!' : `${nome(de).toUpperCase()} ESTOUROU`, 'ruim'), PASSO_CARTA * 1000);
        sfx.chip(260, 90, 0.35, 0.07);
      }
    }
  }

  private venceuAPartida(p: Partida) {
    const m = this.m;
    if (!m) return false;
    if (p.dealer !== null && m.eu.includes(p.dealer)) return (p.banca ?? 0) > 0;
    return m.eu.some((i) => (p.lugares[i]?.fichas ?? 0) > 0);
  }

  /** "SUA VEZ" quando chega a vez deste aparelho (de jogar, de apostar ou de distribuir). */
  private anunciar() {
    const m = this.m;
    const p = this.p;
    if (!m || !this.ligado) return;
    const chave = `${p.rodada}|${p.fase}|${p.vez}|${p.lugares[p.vez]?.ativa ?? 0}`;
    if (chave === this.vezAnunciada) return;
    const minha = this.ator();
    if (minha === null || (p.fase !== 'jogadores' && p.fase !== 'distribuir' && p.fase !== 'dealer')) return;
    this.vezAnunciada = chave;
    const texto = p.fase === 'jogadores' ? (m.eu.length === 1 ? 'SUA VEZ!' : `VEZ DE ${curto(m.jogadores[minha]).toUpperCase()}`) : 'A BANCA É SUA';
    window.setTimeout(() => this.ligado && faixa(this.palco, texto, 'minha'), this.novasAgora * PASSO_CARTA * 1000);
    sfx.arpejo([659, 880], 0.07, 0.06);
    navigator.vibrate?.([20, 30, 20]);
  }

  /** O lugar deste aparelho que tem algo a fazer agora (ou null). */
  private ator(): number | null {
    const m = this.m;
    if (!m) return null;
    const p = this.p;
    for (const i of m.eu) {
      const pd = V.pode(p, i);
      if (pd.apostar || pd.pedir || pd.distribuir || pd.virar || pd.comprar) return i;
    }
    return null;
  }

  private avisar(t: string) {
    this.recado = t;
    this.recadoAte = performance.now() + 2600;
    window.setTimeout(() => {
      if (performance.now() >= this.recadoAte) (this.recado = ''), this.render();
    }, 2700);
  }

  // ---------------------------------------------------------------- ligar

  ligar() {
    this.ligado = true;
    this.el.classList.add('entra');
    musica.tocar('bar');
    this.anunciar();
  }

  desligar() {
    this.ligado = false;
    musica.parar();
  }

  // ---------------------------------------------------------------- as cartas

  /** As cartas que ainda não apareceram (as que vão voar do sapato agora), na ordem em que saem. */
  private cartasNovas() {
    let n = 0;
    this.percorrer((k) => !this.vistas.has(k) && n++);
    return n;
  }

  private cartasNovasDaCasa() {
    return this.p.casa.filter((_, i) => !this.vistas.has(`c${i}`)).length;
  }

  private marcarVistas() {
    this.percorrer((k) => this.vistas.add(k));
  }

  /** As chaves de todas as cartas na mesa (a da banca virada para baixo tem a chave dela, e a virada outra). */
  private percorrer(f: (chave: string) => void) {
    const p = this.p;
    p.lugares.forEach((l, i) => l.maos.forEach((m, k) => m.cartas.forEach((_, j) => f(`l${i}m${k}c${j}${m.dividida ? 'd' : ''}`))));
    p.casa.forEach((_, i) => f(`c${i}`));
    if (p.virada && p.casa.length > 1) f('virada');
  }

  /** Uma carta: o valor e o naipe nos cantos e o naipe grande no meio; `costas` = virada para baixo. */
  private carta(c: number, chave: string, ordem: { n: number }, costas = false): HTMLElement {
    const nova = !this.vistas.has(chave);
    const el = costas
      ? h('div', { class: 'v21-carta costas' })
      : h(
          'div',
          { class: `v21-carta${V.vermelha(c) ? ' vermelha' : ''}` },
          h('span', { class: 'v21-canto' }, V.rotulo(c), h('i', null, V.NAIPES[V.naipe(c)])),
          h('b', null, V.NAIPES[V.naipe(c)]),
          h('span', { class: 'v21-canto baixo' }, V.rotulo(c), h('i', null, V.NAIPES[V.naipe(c)])),
        );
    if (nova) {
      el.classList.add('entra');
      const atraso = ordem.n++ * PASSO_CARTA;
      el.style.animationDelay = `${atraso}s`;
      window.setTimeout(() => this.ligado && sfx.chip(1400, 900, 0.025, 0.04), atraso * 1000);
      this.vistas.add(chave);
    }
    return el;
  }

  /** A pilha de fichas de uma aposta (das maiores para as menores, no máximo oito discos). */
  private pilha(valor: number): HTMLElement {
    const discos: number[] = [];
    let resto = valor;
    for (const f of [...V.FICHAS_APOSTA].reverse())
      while (resto >= f && discos.length < 8) (discos.push(f), (resto -= f));
    return h(
      'div',
      { class: 'v21-pilha', title: `${valor} fichas` },
      ...discos.reverse().map((f, i) => h('i', { style: `--cor:${COR_FICHA[f]};--i:${i}` })),
      h('b', null, String(valor)),
    );
  }

  // ---------------------------------------------------------------- a tela

  private render() {
    const m = this.m;
    if (!m) return;
    const p = this.p;
    const ordem = { n: 0 };
    this.novasAgora = this.cartasNovas();
    const nome = (i: number) => curto(m.jogadores[i] ?? '');
    const eu = (i: number) => m.eu.includes(i);
    this.el.classList.toggle('na-mesa', p.fase === 'mesa');

    // a banca, em cima
    this.banca.replaceChildren(
      p.fase === 'mesa'
        ? h('span', null, 'Mesa aberta')
        : p.dealer === null
          ? h('span', null, 'Banca: ', h('b', null, 'a casa'))
          : h('span', null, `Banca: ${nome(p.dealer)}${eu(p.dealer) ? ' (você)' : ''} · `, h('b', null, `${p.banca ?? 0} fichas`)),
      ...(p.fase !== 'mesa' ? [h('span', null, `Rodada ${p.rodada}`)] : []),
    );

    // as cartas da banca: a segunda para baixo até virar (as das rodadas que fecharam na hora já vêm viradas)
    const tc = V.total(p.casa);
    const mostra = p.virada ? p.casa : p.casa.slice(0, 1);
    const cartasCasa = p.casa.map((c, i) => {
      if (i === 1 && !p.virada) return this.carta(c, `c${i}`, ordem, true);
      const el = this.carta(c, i === 1 ? 'virada' : `c${i}`, ordem);
      if (i === 1) this.vistas.add('c1');
      return el;
    });
    this.casa.replaceChildren(
      h('div', { class: 'v21-rotulo' }, p.dealer === null ? 'A CASA' : `DEALER · ${nome(p.dealer).toUpperCase()}`),
      h('div', { class: 'v21-cartas' }, ...cartasCasa),
      ...(p.casa.length ? [h('div', { class: `v21-total${tc.valor > 21 && p.virada ? ' estourou' : ''}` }, p.virada ? String(tc.valor) : String(V.total(mostra).valor))] : []),
    );

    // o meio do feltro: a frase pintada (e o recado da mesa, se houver)
    this.meio.replaceChildren(h('span', null, 'BLACKJACK PAGA 3 PARA 2'), h('small', null, 'A BANCA COMPRA ATÉ 16 E PARA NO 17'));

    // os lugares
    const resultado = (i: number, k: number) => p.resultados.find((r) => r.lugar === i && r.mao === k);
    const atrasoRes = `${(this.novasAgora + 0.5) * PASSO_CARTA}s`;
    this.lugares.replaceChildren(
      ...m.jogadores.map((_, i) => {
        if (p.fase === 'mesa')
          return h(
            'div',
            { class: `v21-lugar${eu(i) ? ' eu' : ''}` },
            h('header', null, h('span', null, nome(i), m.npc[i] ? h('small', null, ' NPC') : eu(i) ? h('small', null, ' você') : null)),
            h('em', { class: p.querDealer[i] && V.dealerDaMesa(p) === i ? 'dealer' : '' }, p.querDealer[i] && V.dealerDaMesa(p) === i ? 'quer ser o dealer' : i === 0 ? 'abre a mesa' : 'jogador'),
          );
        const l = p.lugares[i];
        if (i === p.dealer)
          return h('div', { class: `v21-lugar dealer${eu(i) ? ' eu' : ''}` }, h('header', null, h('span', null, nome(i), h('small', null, ' dealer'))), h('em', { class: 'dealer' }, 'em pé, atrás da mesa'));
        const vez = p.fase === 'jogadores' && p.vez === i;
        const fora = !V.joga(p, i);
        return h(
          'div',
          { class: `v21-lugar${eu(i) ? ' eu' : ''}${vez ? ' vez' : ''}${fora ? ' fora' : ''}` },
          h('header', null, h('span', null, nome(i), m.npc[i] ? h('small', null, ' NPC') : eu(i) ? h('small', null, ' você') : null), h('b', null, String(l.fichas))),
          fora
            ? h('em', null, 'sem fichas')
            : l.maos.length
              ? h(
                  'div',
                  { class: 'v21-maos' },
                  ...l.maos.map((mao, k) => {
                    const t = V.total(mao.cartas);
                    const r = resultado(i, k);
                    return h(
                      'div',
                      { class: `v21-mao${vez && l.ativa === k ? ' ativa' : ''}` },
                      h('div', { class: 'v21-cartas' }, ...mao.cartas.map((c, j) => this.carta(c, `l${i}m${k}c${j}${mao.dividida ? 'd' : ''}`, ordem))),
                      h('div', { class: 'v21-pe' }, this.pilha(mao.aposta), h('span', { class: `v21-total${t.valor > 21 ? ' estourou' : ''}` }, t.mole && t.valor < 21 ? `${t.valor - 10}/${t.valor}` : String(t.valor))),
                      r ? h('div', { class: `v21-res ${r.como}`, style: `animation-delay:${atrasoRes}` }, COMO[r.como], r.volta > mao.aposta ? h('small', null, ` +${r.volta - mao.aposta}`) : null) : null,
                    );
                  }),
                )
              : l.aposta
                ? this.pilha(l.aposta)
                : h('em', null, p.fase === 'apostas' ? 'apostando…' : ''),
        );
      }),
    );
    this.marcarVistas();
    this.renderControles();
    this.renderAviso();
    this.nova.disabled = !(m.eu.includes(0) || p.fase === 'acabou') || p.fase === 'mesa';
    this.el.classList.toggle('minha-vez', this.ator() !== null);
    this.anunciar();
  }

  private renderAviso() {
    const m = this.m!;
    const p = this.p;
    const nome = (i: number) => curto(m.jogadores[i] ?? '');
    const a = this.ator();
    let t = '';
    if (p.fase === 'mesa') t = m.eu.includes(0) ? 'Escolha as fichas de cada um e comece. Quem quiser ser o dealer marca antes.' : `Esperando ${nome(0)} começar a mesa.`;
    else if (p.fase === 'apostas') t = a !== null ? `${m.eu.length > 1 ? `${nome(a)}: ` : ''}monte a aposta com as fichas e aposte.` : 'Esperando as apostas.';
    else if (p.fase === 'distribuir') t = a !== null ? 'Todos apostaram: distribua as cartas.' : `Esperando ${nome(p.dealer!)} distribuir.`;
    else if (p.fase === 'jogadores') t = a !== null ? `${m.eu.length > 1 ? `Vez de ${nome(a)}: ` : 'Sua vez: '}pedir, parar, dobrar ou dividir.` : `Vez de ${nome(p.vez)}.`;
    else if (p.fase === 'dealer') t = a !== null ? (p.virada ? 'A banca tem menos de 17: compre.' : 'Os jogadores pararam: vire a sua carta.') : `${nome(p.dealer!)} joga pela banca.`;
    else if (p.fase === 'fim') t = 'Rodada fechada. Próxima rodada quando quiserem.';
    else if (p.fase === 'acabou') t = `${p.fim} Nova partida volta para a mesa.`;
    this.aviso.textContent = this.recado || t;
  }

  private renderControles() {
    const m = this.m!;
    const p = this.p;
    const bt = (rotulo: string, f: () => void, cls = '', ok = true) => {
      const b = h('button', { class: `bj-bt ${cls}`, type: 'button', onclick: f }, rotulo) as HTMLButtonElement;
      b.disabled = !ok;
      return b;
    };
    const filhos: HTMLElement[] = [];
    if (p.fase === 'mesa') {
      // ser o dealer: cada lugar deste aparelho marca o seu
      for (const i of m.eu)
        if (m.jogadores.length > 1)
          filhos.push(
            h(
              'label',
              { class: 'v21-quero' },
              h('input', { type: 'checkbox', checked: p.querDealer[i], onchange: (e: Event) => this.mandar(i, { tipo: 'quero', dealer: (e.target as HTMLInputElement).checked }) }),
              h('span', null, m.eu.length > 1 ? `${curto(m.jogadores[i])} quer ser o dealer` : 'Quero ser o dealer'),
            ),
          );
      if (m.eu.includes(0)) {
        filhos.push(
          h('div', { class: 'v21-opcoes', role: 'group', 'aria-label': 'Fichas para cada um' }, h('small', null, 'Fichas para cada um'), ...V.FICHAS_OPCOES.map((f) => bt(String(f), () => ((this.fichas = f), sfx.click(), this.render()), f === this.fichas ? 'on' : ''))),
          bt('Começar', () => this.mandar(0, { tipo: 'comecar', fichas: this.fichas, semente: bar.novaSemente() }), 'forte'),
        );
      }
    } else {
      const a = this.ator();
      const pd = a !== null ? V.pode(p, a) : null;
      if (pd?.apostar && a !== null) {
        const l = p.lugares[a];
        this.montada = Math.min(this.montada, l.fichas);
        const min = Math.min(V.APOSTA_MINIMA, l.fichas);
        filhos.push(
          h(
            'div',
            { class: 'v21-fichas' },
            ...V.FICHAS_APOSTA.map((f) => {
              const b = h('button', { class: 'v21-ficha', type: 'button', style: `--cor:${COR_FICHA[f]}`, title: `+${f}`, onclick: () => ((this.montada = Math.min(l.fichas, this.montada + f)), sfx.chip(1100, 800, 0.03, 0.05), this.render()) }, String(f)) as HTMLButtonElement;
              b.disabled = this.montada + f > l.fichas && this.montada >= l.fichas;
              return b;
            }),
          ),
          h(
            'div',
            { class: 'v21-linha' },
            bt('Limpar', () => ((this.montada = 0), this.render()), '', this.montada > 0),
            bt('Tudo', () => ((this.montada = l.fichas), this.render())),
            bt(`Apostar ${this.montada || ''}`.trim(), () => {
              const v = this.montada;
              this.montada = 0;
              this.mandar(a, { tipo: 'aposta', valor: v });
            }, 'forte', this.montada >= min && this.montada > 0),
          ),
        );
      } else if (pd?.pedir && a !== null) {
        filhos.push(
          h('div', { class: 'v21-linha' }, bt('Pedir', () => this.mandar(a, { tipo: 'pedir' }), 'forte'), bt('Parar', () => this.mandar(a, { tipo: 'parar' }))),
          h('div', { class: 'v21-linha' }, bt('Dobrar', () => this.mandar(a, { tipo: 'dobrar' }), '', pd.dobrar), bt('Dividir', () => this.mandar(a, { tipo: 'dividir' }), '', pd.dividir)),
        );
      } else if (pd?.distribuir && a !== null) filhos.push(bt('Distribuir as cartas', () => this.mandar(a, { tipo: 'distribuir' }), 'forte'));
      else if (pd?.virar && a !== null) filhos.push(bt('Virar a carta', () => this.mandar(a, { tipo: 'virar' }), 'forte'));
      else if (pd?.comprar && a !== null) filhos.push(bt('Comprar', () => this.mandar(a, { tipo: 'comprar' }), 'forte'));
      else if (p.fase === 'fim') filhos.push(bt('Próxima rodada', () => this.mandar(m.eu[0], { tipo: 'proxima' }), 'forte'));
    }
    this.controles.replaceChildren(...filhos);
  }
}
