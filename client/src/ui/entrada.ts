import type { ClientMsg } from '@crona/shared';
import { h } from './dom';
import { existeArte } from './icons';
import { Cena, UNIVERSOS, pedidos, type CenaLayout, type Clima, type Pol } from './entradaCena';
import MARCA from './entradaMarca.json';
import PAINEL from './entradaPainel.json';
import { Trilha } from './entradaTrilha';

/**
 * A tela de entrada da plataforma: a arte do Felipe (a mesa de RPG à luz de vela, com o painel
 * do CRONA) ocupa a tela, e os campos de verdade ficam exatamente em cima dos desenhados. Duas
 * artes, uma para o computador (1672×941) e uma para o celular (941×1672); o "palco" escala a
 * arte inteira para cobrir a tela, sempre com o painel à vista.
 *
 * Por cima, o que dá vida: a chama da vela tremulando e iluminando a mesa, o céu piscando, a
 * lua, a fumaça da caneca, o emblema brilhando com faíscas, a poeira na luz, o brilho correndo
 * no botão, e as transições de entrar, trocar de modo, errar e sair.
 *
 * Modos: entrar (e-mail e senha), criar conta (nome, e-mail e senha) e o aviso do jogador que
 * ainda não tem ficha ligada à conta. A conta é do servidor (`contaEntrar`, `contaCriar`); a
 * resposta chega pela mensagem `conta` e o main.ts chama `resposta`.
 */

type Modo = 'entrar' | 'criar' | 'semFicha';
/** [y, altura] em pixels do palco */
type Caixa = [number, number];
interface Ret {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Marca extends Ret {
  /** o meio do emblema */
  emblema: number[];
  /** as estrelinhas da logo: onde ficam (x, y, w, h), onde estão na folha (sx) e o tamanho (tam) */
  brilhos: { x: number; y: number; w: number; h: number; sx: number; tam: number }[];
}

interface Layout {
  nome: 'computador' | 'celular';
  w: number;
  h: number;
  fundo: string;
  /** tamanho da letra e dos ícones (1 = computador) */
  u: number;
  /** a área de dentro do painel que os campos cobrem (o título e o rodapé da arte ficam à vista) */
  painel: Ret;
  /** o painel inteiro, com o emblema: fica sempre à vista */
  moldura: Ret;
  /** os campos e botões: de onde a onde, na horizontal */
  campo: { x: number; w: number };
  entrar: { email: Caixa; senha: Caixa; botao: Caixa; ou: number; outro: Caixa };
  criar: { nome: Caixa; email: Caixa; senha: Caixa; botao: Caixa; ou: number; outro: Caixa };
  /**
   * A logo do CRONA (o d20 com as letras), uma imagem por cima do painel, e as estrelinhas em volta dela
   * (client/src/ui/entradaMarca.json, gerado por scripts/entrada-logo.py)
   */
  marca: Marca;
  /** x, y e raio do brilho */
  chama: [number, number, number];
  lua: [number, number, number];
  fumaca: [number, number];
  emblema: [number, number, number];
  /** x0, y0, x1, y1: onde o céu pisca */
  ceu: [number, number, number, number];
  /** o fundo vivo: céu, luz, clima e peças trocáveis (entradaCena.ts) */
  cena: Omit<CenaLayout, 'nome' | 'w' | 'h'>;
}

/** As medidas saíram da própria arte (as bordas dos campos desenhados). */
const COMPUTADOR: Layout = {
  nome: 'computador',
  w: 1672,
  h: 941,
  fundo: '/arte/login/fundo-computador.webp',
  u: 1,
  painel: { x: 862, y: 384, w: 510, h: 368 },
  moldura: { x: 845, y: 28, w: 550, h: 799 },
  campo: { x: 905, w: 421 },
  entrar: { email: [398, 59], senha: [475, 59], botao: [553, 61], ou: 653, outro: [678, 50] },
  criar: { nome: [396, 52], email: [458, 52], senha: [520, 52], botao: [584, 56], ou: 656, outro: [678, 50] },
  marca: MARCA.computador,
  chama: [429, 160, 205],
  lua: [1448, 27, 64],
  fumaca: [1560, 345],
  emblema: [...MARCA.computador.emblema, 130] as [number, number, number],
  ceu: [1250, 0, 1672, 110],
  cena: {
    // a janela: nas imagens dos temas os vidros em magenta vão de 834 a 1672, até a altura 240 (o painel
    // cobre parte dele)
    janela: [820, 0, 1672, 245],
    // o painel, o escudo do emblema que sobe acima dele e o enfeite de baixo
    painel: PAINEL.computador.contorno as Pol[],
    // o sol atravessa a janela de um lado ao outro, até o horizonte da cidade
    sol: { x0: 880, x1: 1650, horizonte: 122, alto: 24 },
    lua: [1330, 40, 15],
    // a vela (ou o abajur) da mesa: o miolo da chama e o tamanho dela
    chama: [429, 162, 16, 34],
    cantos: [
      [165, 95],
      [1645, 262],
      [25, 135],
      [815, 915],
    ],
    evitar: [[1440, 0, 1672, 62]],
    raios: { y0: 240, y1: 941, xs: [1400, 1480, 1570], desvio: 300, largura: 30 },
    nevoa: [0, 640, 1672, 941],
    // a cidade atrás dos vidros em magenta: o castelo cai na parte da janela que aparece (encosta na
    // direita e, em tela mais estreita, anda para a esquerda; a ponta que sobra esmaece)
    paisagem: { x: 952, y: -70, w: 720 },
    px: 3,
  },
};
const CELULAR: Layout = {
  nome: 'celular',
  w: 941,
  h: 1672,
  fundo: '/arte/login/fundo-celular.webp',
  u: 1.36,
  painel: { x: 176, y: 716, w: 598, h: 480 },
  moldura: { x: 155, y: 288, w: 635, h: 1002 },
  campo: { x: 217, w: 506 },
  entrar: { email: [740, 79], senha: [839, 79], botao: [941, 80], ou: 1063, outro: [1097, 69] },
  criar: { nome: [736, 68], email: [818, 68], senha: [900, 68], botao: [984, 72], ou: 1076, outro: [1097, 69] },
  marca: MARCA.celular,
  chama: [192, 205, 230],
  lua: [720, 85, 72],
  fumaca: [848, 495],
  emblema: [...MARCA.celular.emblema, 160] as [number, number, number],
  ceu: [505, 0, 941, 250],
  cena: {
    janela: [415, 0, 941, 320],
    painel: PAINEL.celular.contorno as Pol[],
    sol: { x0: 440, x1: 850, horizonte: 106, alto: 24 },
    lua: [700, 45, 18],
    chama: [192, 204, 20, 36],
    cantos: [
      [150, 70],
      [614, 316],
      [246, 1364],
      [75, 475],
    ],
    evitar: [[715, 20, 845, 105]],
    raios: { y0: 320, y1: 1672, xs: [470, 620, 780], desvio: 360, largura: 40 },
    nevoa: [0, 1250, 941, 1672],
    paisagem: { x: 421, y: -33, w: 520 },
    px: 3,
  },
};

const SVG = (corpo: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${corpo}</svg>`;
const ICONE = {
  email: SVG('<rect x="3" y="5.5" width="18" height="13"/><path d="M3.5 6.5 12 13l8.5-6.5"/>'),
  senha: SVG('<rect x="5" y="10.5" width="14" height="10"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><path d="M12 14.5v2.5"/>'),
  nome: SVG('<circle cx="12" cy="8.5" r="3.6"/><path d="M4.5 20.5c1.2-4 4-5.6 7.5-5.6s6.3 1.6 7.5 5.6"/>'),
  ver: SVG('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>'),
  som: SVG('<path d="M4 9.5h4l5-4.5v14l-5-4.5H4z"/>'),
  esconder: SVG('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/><path d="M4 20 20 4"/>'),
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EntradaOpcoes {
  /** manda a mensagem da conta para o servidor */
  enviar(m: ClientMsg): void;
  /** o jogador sem ficha quer só ver o tabuleiro */
  verMesa(): void;
  /** sair da conta (o jogador sem ficha) */
  sairDaConta(): void;
}

export class Entrada {
  readonly el: HTMLElement;
  private palco: HTMLElement;
  private fundo: HTMLImageElement;
  private fx: HTMLElement;
  private poeira: HTMLCanvasElement;
  /**
   * A logo (dourada), a variação azul-prateada dela (uma faixa que a revela de tempos em tempos, com um
   * clarão azul em volta) e um fio de luz branca no meio da faixa
   */
  private marcaOuro: HTMLImageElement;
  private marcaAzul: HTMLImageElement;
  private marcaFio: HTMLImageElement;
  /** a cidade lá fora do tema (atrás dos vidros em magenta) e a versão dela com neve, se existirem */
  private paisagem: { normal: string; neve: string | null } | null = null;
  /** o fundo vivo: a hora, o clima e o universo sorteado */
  private cena = new Cena();
  /** a trilha e o som do ambiente */
  private trilha: Trilha;
  private botaoSom: HTMLButtonElement;
  /** o botão do som com o volume, que abre ao passar o mouse (no celular, no primeiro toque) */
  private caixaSom: HTMLElement;
  private volume: HTMLInputElement;
  private aoTocar = (ev: Event) => {
    if (ev.target instanceof Node && this.caixaSom.contains(ev.target)) return;
    // um toque fora fecha o volume aberto no celular
    this.caixaSom.classList.remove('aberta');
    this.trilha.comecar();
    this.mostrarSom();
  };
  private painel: HTMLFormElement;
  private campos: Record<'nome' | 'email' | 'senha', { caixa: HTMLElement; input: HTMLInputElement }>;
  private olho: HTMLButtonElement;
  private principal: HTMLButtonElement;
  private outro: HTMLButtonElement;
  private ou: HTMLElement;
  private erroEl: HTMLElement;
  private msg: HTMLElement;
  private layout: Layout | null = null;
  private modo: Modo = 'entrar';
  private esperando = false;
  private quadro = 0;
  /** as mariposas que rodeiam a vela acesa, de noite */
  private mariposas = Array.from({ length: 3 }, (_, i) => ({ f: i * 2.1, v: 0.018 + i * 0.006, r: 20 + i * 9, o: i * 1.7 }));
  private particulas: { x: number; y: number; vx: number; vy: number; r: number; f: number; quente: boolean; magia: boolean }[] = [];
  private erroTempo = 0;
  private aoRedimensionar = () => this.ajustar();

  constructor(private op: EntradaOpcoes) {
    this.fundo = h('img', { class: 'ent-fundo', alt: '', draggable: 'false' });
    this.poeira = h('canvas', { class: 'ent-poeira', 'aria-hidden': 'true' });
    const marca = (cls: string, src: string) => {
      const img = h('img', { class: `ent-marca ${cls}`, alt: '', draggable: 'false', 'aria-hidden': 'true' });
      img.src = src;
      return img;
    };
    this.marcaOuro = marca('ent-marca-ouro', '/arte/login/logo-ouro.webp');
    this.marcaAzul = marca('ent-marca-azul', '/arte/login/logo-azul.webp');
    this.marcaFio = marca('ent-marca-fio', '/arte/login/logo-ouro.webp');
    this.fx = h('div', { class: 'ent-fx', 'aria-hidden': 'true' });
    const campo = (qual: 'nome' | 'email' | 'senha', rotulo: string, tipo: string, auto: string) => {
      const input = h('input', { class: 'ent-input', type: tipo, placeholder: rotulo, 'aria-label': rotulo, autocomplete: auto, spellcheck: 'false', autocapitalize: 'off' });
      const caixa = h('label', { class: `ent-campo ent-${qual}` }, h('span', { class: 'ent-ic', html: ICONE[qual] }), input);
      return { caixa, input };
    };
    this.campos = {
      nome: campo('nome', 'Nome do personagem', 'text', 'nickname'),
      email: campo('email', 'E-mail', 'email', 'username email'),
      senha: campo('senha', 'Senha', 'password', 'current-password'),
    };
    this.campos.nome.input.autocapitalize = 'words';
    this.olho = h('button', { class: 'ent-olho', type: 'button', 'aria-label': 'Mostrar a senha', html: ICONE.ver, onclick: () => this.alternarSenha() });
    this.campos.senha.caixa.append(this.olho);
    this.principal = h('button', { class: 'ent-botao ent-principal', type: 'submit' }, h('span', { class: 'ent-rotulo' }, 'ENTRAR'));
    this.outro = h('button', { class: 'ent-botao ent-outro', type: 'button', onclick: () => this.trocar() }, h('span', { class: 'ent-rotulo' }, 'CRIAR CONTA'));
    this.ou = h('div', { class: 'ent-ou' }, h('span', null, 'ou'));
    this.erroEl = h('div', { class: 'ent-erro', role: 'alert' });
    this.msg = h('div', { class: 'ent-msg' });
    this.painel = h(
      'form',
      { class: 'ent-painel', novalidate: true, onsubmit: (e: Event) => (e.preventDefault(), this.enviar()) },
      this.campos.nome.caixa,
      this.campos.email.caixa,
      this.campos.senha.caixa,
      this.msg,
      this.principal,
      this.ou,
      this.erroEl,
      this.outro,
    );
    this.palco = h('div', { class: 'ent-palco' }, this.fundo, this.cena.ceu, this.cena.arte, this.fx, this.cena.luz, this.poeira, this.marcaOuro, this.marcaAzul, this.marcaFio, this.painel);
    const s = this.cena.sorteio;
    const pedida = Number(pedidos.ler('musica'));
    this.trilha = new Trilha(s.universo, s.clima, Number.isFinite(pedida) && pedida > 0 ? pedida : undefined);
    this.botaoSom = h(
      'button',
      { class: 'ent-som', type: 'button', onclick: () => this.tocarBotaoSom() },
      h('span', { class: 'ent-som-ic', html: ICONE.som }),
      h('span', { class: 'ent-som-barras', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
    );
    this.volume = h('input', {
      class: 'ent-volume-faixa',
      type: 'range',
      min: '0',
      max: '100',
      step: '1',
      'aria-label': 'Volume da música',
      oninput: () => this.mudarVolume(),
    });
    this.volume.value = String(Math.round(this.trilha.volume * 100));
    this.caixaSom = h(
      'div',
      { class: 'ent-som-caixa' },
      // o aviso quando o navegador segura o som até o primeiro toque
      h('span', { class: 'ent-som-dica', 'aria-hidden': 'true' }, matchMedia('(hover: none)').matches ? 'toque para ouvir' : 'clique para ouvir'),
      h('div', { class: 'ent-volume' }, this.volume),
      this.botaoSom,
    );
    this.el = h('div', { class: 'entrada', role: 'dialog', 'aria-label': 'Entrar no CRONA' }, this.palco, this.caixaSom);
    this.mostrarSom();
    this.el.addEventListener('pointerdown', this.aoTocar);
    Object.assign(this.el.dataset, { musica: String(this.trilha.indice), universo: s.universo, clima: s.clima, vela: s.vela ? 'acesa' : 'apagada', monstro: s.monstro ? 'sim' : 'nao' });
    this.el.style.setProperty('--chama', UNIVERSOS[s.universo].luz.join(', '));
    this.el.style.setProperty('--vela', s.vela ? '1' : '0');
    this.cena.aoRelampago = () => this.trilha.trovao(0.3 + Math.random() * 0.7);
    this.cena.aoMudar = (c) => {
      const p = c.pesos;
      this.trilha.luz(p.dia + p.dourado * 0.5, s.vela);
      this.el.style.setProperty('--noite', p.noite.toFixed(3));
      this.el.style.setProperty('--dourado', p.dourado.toFixed(3));
      this.el.style.setProperty('--dia', p.dia.toFixed(3));
    };
    this.cena.aoMudar(this.cena);
    this.fundo.addEventListener('load', () => {
      // a cena reiluminada fica por cima da arte; a tela aparece quando ela fica pronta
      const L = this.layout;
      if (!L) return;
      this.posicionarMarca(L);
      // se a cena demorar ou falhar (a imagem de outro endereço não deixa ler os pixels), a tela
      // aparece com a arte de sempre e os brilhos em CSS
      const semCena = () => {
        this.el.classList.add('sem-cena', 'pronta');
      };
      const espera = setTimeout(semCena, 4000);
      // a paisagem lá fora (se o tema tiver) carrega antes de montar
      const carregar = (url: string | null) =>
        url
          ? new Promise<HTMLImageElement | null>((ok) => {
              const img = new Image();
              img.onload = () => ok(img);
              img.onerror = () => ok(null);
              img.src = url;
            })
          : Promise.resolve(null);
      Promise.all([carregar(this.paisagem?.normal ?? null), carregar(this.paisagem?.neve ?? null)])
        .then(([p, n]) => this.cena.montar({ ...L.cena, nome: L.nome, w: L.w, h: L.h }, this.fundo, p, n))
        .then(() => {
          clearTimeout(espera);
          if (this.layout !== L) return;
          this.cena.passo(performance.now(), 16);
          this.el.classList.remove('sem-cena');
          this.el.classList.add('pronta');
        })
        .catch((erro) => {
          clearTimeout(espera);
          console.warn('[entrada] a cena não montou:', erro);
          semCena();
        });
    });
  }

  /** Mostra a tela (com um aviso, se houver: "sua sessão terminou"). */
  mostrar(aviso?: string) {
    if (!this.el.isConnected) document.body.append(this.el);
    addEventListener('resize', this.aoRedimensionar);
    addEventListener('keydown', this.aoTocar);
    this.ajustar();
    this.definirModo('entrar', false);
    if (aviso) this.erro(aviso);
    this.animar();
    // a música tenta começar já; se o navegador segurar, começa no primeiro toque ou tecla
    this.trilha.aoMudarEstado = () => this.mostrarSom();
    this.trilha.comecar();
    this.mostrarSom();
    // no computador, o cursor já no e-mail
    if (matchMedia('(pointer: fine)').matches) setTimeout(() => this.campos.email.input.focus(), 700);
  }

  /** A conta respondeu com erro: a mensagem e o painel tremendo. */
  erro(texto: string) {
    this.esperar(false);
    this.erroEl.textContent = texto;
    this.painel.classList.add('com-erro');
    this.painel.classList.remove('treme');
    void this.painel.offsetWidth;
    this.painel.classList.add('treme');
    clearTimeout(this.erroTempo);
    this.erroTempo = window.setTimeout(() => this.painel.classList.remove('com-erro'), 6000);
  }

  /** A conta abriu: o botão diz quem entrou enquanto o tabuleiro carrega. */
  sucesso(nome: string) {
    this.esperando = true;
    this.painel.classList.remove('com-erro');
    this.painel.classList.add('certo');
    this.rotulo(this.principal, `BEM-VINDO, ${nome.toUpperCase()}`);
  }

  /** O jogador entrou, mas a conta dele ainda não tem ficha. */
  semFicha(nome: string) {
    this.esperar(false);
    this.painel.classList.remove('certo');
    this.msg.replaceChildren(
      h('b', null, `Olá, ${nome}!`),
      h('span', null, 'Sua conta ainda não tem ficha. Peça ao mestre o link da sua ficha e abra-o neste aparelho: ela fica ligada à sua conta.'),
    );
    this.definirModo('semFicha');
  }

  /** O tabuleiro abriu: a tela some devagar. */
  sair() {
    if (!this.el.isConnected || this.el.classList.contains('saindo')) return;
    this.el.classList.add('saindo');
    this.trilha.calar(1.4, true);
    setTimeout(() => this.destruir(), 900);
  }

  destruir() {
    cancelAnimationFrame(this.quadro);
    removeEventListener('resize', this.aoRedimensionar);
    removeEventListener('keydown', this.aoTocar);
    this.trilha.calar(0.2, true);
    this.el.remove();
  }

  // ---------------------------------------------------------------- formulário
  private enviar() {
    if (this.esperando) return;
    if (this.modo === 'semFicha') return this.op.verMesa();
    const nome = this.campos.nome.input.value.trim();
    const email = this.campos.email.input.value.trim();
    const senha = this.campos.senha.input.value;
    if (this.modo === 'criar') {
      if (nome.length < 2) return this.erro('Escreva o seu nome (pelo menos 2 letras).'), this.campos.nome.input.focus();
      if (!EMAIL_RE.test(email)) return this.erro('Confira o e-mail.'), this.campos.email.input.focus();
      if (senha.length < 6) return this.erro('A senha precisa de pelo menos 6 caracteres.'), this.campos.senha.input.focus();
    } else {
      // entrar: o e-mail ou o nome da conta, e a senha (a regra dos 6 caracteres é só para criar)
      if (email.length < 2) return this.erro('Escreva o e-mail ou o nome da conta.'), this.campos.email.input.focus();
      if (!senha) return this.erro('Escreva a senha.'), this.campos.senha.input.focus();
    }
    this.esperar(true);
    this.op.enviar(this.modo === 'criar' ? { t: 'contaCriar', nome, email, senha } : { t: 'contaEntrar', email, senha });
  }

  private trocar() {
    if (this.esperando) return;
    if (this.modo === 'semFicha') return this.op.sairDaConta();
    this.definirModo(this.modo === 'entrar' ? 'criar' : 'entrar');
  }

  private esperar(sim: boolean) {
    this.esperando = sim;
    this.painel.classList.toggle('esperando', sim);
    for (const c of Object.values(this.campos)) c.input.disabled = sim;
    if (sim) this.rotulo(this.principal, this.modo === 'criar' ? 'CRIANDO...' : 'ENTRANDO...');
    else this.definirModo(this.modo, false);
  }

  private alternarSenha() {
    const i = this.campos.senha.input;
    const ver = i.type === 'password';
    i.type = ver ? 'text' : 'password';
    this.olho.innerHTML = ver ? ICONE.esconder : ICONE.ver;
    this.olho.setAttribute('aria-label', ver ? 'Esconder a senha' : 'Mostrar a senha');
    i.focus();
  }

  private rotulo(b: HTMLButtonElement, texto: string) {
    b.querySelector('.ent-rotulo')!.textContent = texto;
  }

  /** Põe cada peça no lugar do modo (com transição quando muda). */
  private definirModo(modo: Modo, animar = true) {
    const mudou = modo !== this.modo;
    this.modo = modo;
    const L = this.layout;
    if (!L) return;
    this.painel.classList.toggle('sem-transicao', !animar);
    this.painel.dataset.modo = modo;
    const pos = modo === 'criar' ? L.criar : L.entrar;
    const p = L.painel;
    const caixa = (el: HTMLElement, c: Caixa, visivel = true) => {
      el.style.left = `${L.campo.x - p.x}px`;
      el.style.width = `${L.campo.w}px`;
      el.style.top = `${c[0] - p.y}px`;
      el.style.height = `${c[1]}px`;
      el.classList.toggle('oculto', !visivel);
    };
    caixa(this.campos.nome.caixa, modo === 'criar' ? L.criar.nome : L.entrar.email, modo === 'criar');
    caixa(this.campos.email.caixa, pos.email, modo !== 'semFicha');
    caixa(this.campos.senha.caixa, pos.senha, modo !== 'semFicha');
    caixa(this.msg, [pos.email[0], pos.senha[0] + pos.senha[1] - pos.email[0]], modo === 'semFicha');
    caixa(this.principal, pos.botao);
    caixa(this.outro, pos.outro);
    this.ou.style.top = this.erroEl.style.top = `${pos.ou - p.y}px`;
    this.ou.style.left = this.erroEl.style.left = `${L.campo.x - p.x}px`;
    this.ou.style.width = this.erroEl.style.width = `${L.campo.w}px`;
    this.campos.senha.input.autocomplete = modo === 'criar' ? 'new-password' : 'current-password';
    // para entrar, vale o e-mail ou o nome da conta
    const email = this.campos.email.input;
    email.placeholder = modo === 'criar' ? 'E-mail' : 'E-mail ou nome';
    email.setAttribute('aria-label', email.placeholder);
    email.type = modo === 'criar' ? 'email' : 'text';
    if (!this.esperando) {
      this.rotulo(this.principal, modo === 'criar' ? 'CRIAR CONTA' : modo === 'semFicha' ? 'VER O TABULEIRO' : 'ENTRAR');
      this.rotulo(this.outro, modo === 'criar' ? 'JÁ TENHO CONTA' : modo === 'semFicha' ? 'SAIR DA CONTA' : 'CRIAR CONTA');
    }
    if (mudou && animar) {
      this.painel.classList.remove('troca');
      void this.painel.offsetWidth;
      this.painel.classList.add('troca');
      if (modo === 'criar') setTimeout(() => this.campos.nome.input.focus(), 250);
      this.painel.classList.remove('com-erro');
    }
  }

  /**
   * O toque no botão do som. No computador o volume abre com o mouse em cima, e o clique liga e
   * desliga. No celular (sem mouse), o primeiro toque abre o volume e o segundo liga e desliga.
   * Se a música ainda não começou (o navegador espera o primeiro toque), o toque faz começar.
   */
  private tocarBotaoSom() {
    const semMouse = matchMedia('(hover: none)').matches;
    if (semMouse && !this.caixaSom.classList.contains('aberta')) {
      this.caixaSom.classList.add('aberta');
      this.trilha.comecar();
    } else if (this.trilha.ligada && !this.trilha.tocando) this.trilha.comecar();
    else this.trilha.alternar();
    this.mostrarSom();
  }

  private mudarVolume() {
    this.trilha.ajustarVolume(Number(this.volume.value) / 100);
    this.mostrarSom();
  }

  /**
   * Muda a cena sem recarregar: o clima (e o som dele), a vela e o monstro. A música não para.
   * (O passeio da prévia usa isto; no jogo, o clima fica o da visita.)
   */
  mudarCena(op: { clima?: Clima; vela?: boolean; monstro?: boolean }) {
    this.cena.mudar(op);
    const s = this.cena.sorteio;
    if (op.clima) this.trilha.mudarClima(s.clima);
    Object.assign(this.el.dataset, { clima: s.clima, vela: s.vela ? 'acesa' : 'apagada', monstro: s.monstro ? 'sim' : 'nao' });
    this.el.style.setProperty('--vela', s.vela ? '1' : '0');
    this.cena.aoMudar(this.cena);
  }

  /** O botão do som: ligado (as barrinhas dançam quando toca), desligado, ou esperando o toque. */
  private mostrarSom() {
    const ligada = this.trilha.ligada;
    this.volume.style.setProperty('--v', `${this.volume.value}%`);
    this.caixaSom.classList.toggle('mudo', !ligada || this.trilha.volume === 0);
    this.caixaSom.classList.toggle('esperando', ligada && this.trilha.volume > 0 && !this.trilha.tocando);
    this.botaoSom.classList.toggle('desligado', !ligada || this.trilha.volume === 0);
    this.botaoSom.classList.toggle('tocando', this.trilha.tocando);
    this.botaoSom.setAttribute('aria-pressed', String(ligada));
    this.botaoSom.setAttribute('aria-label', ligada ? 'Desligar a música' : 'Ligar a música');
    this.botaoSom.title = ligada ? 'Música ligada' : 'Música desligada';
    // o navegador demora um instante para liberar o som
    if (ligada && !this.trilha.tocando) setTimeout(() => this.botaoSom.classList.toggle('tocando', this.trilha.tocando), 400);
  }

  // ---------------------------------------------------------------- palco
  /** A logo nova, no lugar dela em cada tela (o painel desenhado não tem mais o emblema nem as letras). */
  private posicionarMarca(L: Layout) {
    const { x, y, w, h: alt } = L.marca;
    for (const el of [this.marcaOuro, this.marcaAzul, this.marcaFio]) Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${alt}px` });
  }

  /** Escala a arte para cobrir a tela, com o painel inteiro à vista. */
  private ajustar() {
    const vw = innerWidth;
    const vh = innerHeight;
    // no celular, o teclado aberto encolhe a tela: não refaz o palco enquanto digita
    const digitando = document.activeElement instanceof HTMLInputElement && this.painel.contains(document.activeElement);
    const L = vw / vh < 0.85 ? CELULAR : COMPUTADOR;
    if (digitando && L === this.layout) return;
    if (L !== this.layout) this.montar(L);
    const m = L.moldura;
    let s = Math.max(vw / L.w, vh / L.h);
    s = Math.min(s, (vw - 16) / m.w, (vh - 16) / m.h);
    let tx = (vw - L.w * s) / 2;
    let ty = (vh - L.h * s) / 2;
    // sem mostrar o vazio além da arte
    if (L.w * s >= vw) tx = Math.min(0, Math.max(vw - L.w * s, tx));
    if (L.h * s >= vh) ty = Math.min(0, Math.max(vh - L.h * s, ty));
    // o painel inteiro à vista
    const x0 = m.x * s + tx;
    const x1 = (m.x + m.w) * s + tx;
    const y0 = m.y * s + ty;
    const y1 = (m.y + m.h) * s + ty;
    if (x1 > vw - 8) tx -= x1 - (vw - 8);
    else if (x0 < 8) tx += 8 - x0;
    if (y1 > vh - 8) ty -= y1 - (vh - 8);
    else if (y0 < 8) ty += 8 - y0;
    this.palco.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    // o pedaço da arte que aparece (no celular estreito, as laterais ficam de fora)
    this.cena.visivel = [-tx / s, -ty / s, (vw - tx) / s, (vh - ty) / s];
  }

  /** Monta o palco de um tamanho (computador ou celular). */
  private montar(L: Layout) {
    this.layout = L;
    this.el.dataset.layout = L.nome;
    this.palco.style.width = `${L.w}px`;
    this.palco.style.height = `${L.h}px`;
    this.palco.style.setProperty('--u', String(L.u));
    // a imagem do universo sorteado, quando o Códex já pintou (fundo-<tela>-<universo>.webp);
    // sem ela, a de hoje (que é a da fantasia)
    const universo = this.cena.sorteio.universo;
    const propria = `/arte/login/fundo-${L.nome}-${universo}.webp`;
    // a cidade lá fora: com neve, a versão de telhados brancos (se o Códex já pintou)
    const paisagem = `/arte/login/paisagem-${universo}.webp`;
    const comNeve = `/arte/login/paisagem-${universo}-neve.webp`;
    void Promise.all([existeArte(propria), existeArte(paisagem), existeArte(comNeve)]).then(([tem, temPaisagem, temNeve]) => {
      if (this.layout !== L) return;
      this.cena.fundoProprio = tem;
      this.paisagem = temPaisagem ? { normal: paisagem, neve: temNeve ? comNeve : null } : null;
      this.el.dataset.fundo = tem ? universo : 'hoje';
      this.fundo.src = tem ? propria : L.fundo;
    });
    this.poeira.width = L.w;
    this.poeira.height = L.h;
    const p = L.painel;
    Object.assign(this.painel.style, { left: `${p.x}px`, top: `${p.y}px`, width: `${p.w}px`, height: `${p.h}px` });
    this.montarFx(L);
    this.definirModo(this.modo, false);
  }

  /** As luzes e os enfeites que mexem, nos lugares da arte. */
  private montarFx(L: Layout) {
    const em = (x: number, y: number, cls: string, extra = '') => h('i', { class: cls, style: `left:${x}px;top:${y}px;${extra}` });
    const [cx, cy, cr] = L.chama;
    const [lx, ly, lr] = L.lua;
    const [ex, ey, er] = L.emblema;
    const [fx, fy] = L.fumaca;
    const [c0, c1, c2, c3] = L.ceu;
    // a luz da vela na mesa inteira e o halo em volta da chama (somem com a vela apagada; de dia, mais fracos)
    const vela = h('div', { class: 'fx-grupo fx-vela' }, em(cx, cy, 'fx-luz-vela', `--r:${cr * 2.6}px`), em(cx, cy, 'fx-chama', `--r:${cr}px`));
    // a vela apagada solta um fio de fumaça do pavio
    const pavio = h('div', { class: 'fx-grupo fx-pavio' });
    const [px, py, , ph] = L.cena.chama;
    for (let i = 0; i < 3; i++) pavio.append(em(px, py + ph * 0.7, 'fx-fumaca fx-fumaca-pavio', `animation-delay:${(i * 1.6).toFixed(2)}s`));
    // a lua e as estrelas: só de noite e com o céu aberto
    const noite = h('div', { class: 'fx-grupo fx-noite' }, em(lx, ly, 'fx-lua', `--r:${lr}px`));
    for (let i = 0; i < 16; i++) {
      const x = c0 + Math.random() * (c2 - c0);
      const y = c1 + Math.random() * (c3 - c1);
      noite.append(em(x, y, 'fx-estrela', `animation-delay:${(Math.random() * 4).toFixed(2)}s;animation-duration:${(2.2 + Math.random() * 2.6).toFixed(2)}s`));
    }
    const nodes: HTMLElement[] = [vela, pavio, noite, em(ex, ey, 'fx-emblema', `--r:${er}px`)];
    // a fumaça da caneca
    for (let i = 0; i < 4; i++) nodes.push(em(fx + (i % 2 ? 10 : -6) * L.u, fy, 'fx-fumaca fx-vapor', `animation-delay:${(i * 1.25).toFixed(2)}s`));
    // as estrelinhas em volta do emblema: as da arte, recortadas (scripts na pasta da entrada),
    // cada uma piscando no seu ritmo; as grandes respiram devagar e de vez em quando faíscam
    for (const b of L.marca.brilhos) {
      const tipo = b.tam > 300 ? 'grande' : b.tam > 60 ? 'media' : 'pequena';
      const dur = { grande: 3.6, media: 2.8, pequena: 2.1 }[tipo] + Math.random() * 1.4;
      nodes.push(
        em(
          b.x + b.w / 2,
          b.y + b.h / 2,
          `fx-brilho fx-brilho-${tipo}`,
          `width:${b.w}px;height:${b.h}px;background:url(/arte/login/brilhos/${L.nome}.png) -${b.sx}px 0 no-repeat;--dur:${dur.toFixed(2)}s;animation-delay:${(-Math.random() * dur).toFixed(2)}s`,
        ),
      );
    }
    this.fx.replaceChildren(...nodes);
    // a poeira na luz: mais perto da vela, mais quente; na fantasia, umas faíscas de magia
    const magia = !!UNIVERSOS[this.cena.sorteio.universo].magia;
    this.particulas = Array.from({ length: L.nome === 'celular' ? 46 : 60 }, () => {
      const perto = Math.random() < 0.55;
      return {
        magia: magia && Math.random() < 0.3,
        x: perto ? cx + (Math.random() - 0.5) * cr * 3 : Math.random() * L.w,
        y: perto ? cy + Math.random() * cr * 2.2 : Math.random() * L.h,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -0.05 - Math.random() * 0.12,
        r: 0.8 + Math.random() * 1.8,
        f: Math.random() * Math.PI * 2,
        quente: perto,
      };
    });
  }

  /** A poeira flutuando (pausa quando a aba some ou pede menos movimento). */
  private animar() {
    const ctx = this.poeira.getContext('2d');
    // pedindo menos movimento, a cena fica parada (mas com a hora e o clima certos)
    const parado = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!ctx) return;
    let antes = performance.now();
    let ultimaCena = 0;
    const passo = (agora: number) => {
      this.quadro = requestAnimationFrame(passo);
      const L = this.layout;
      if (!L || document.hidden) return;
      if (this.cena.pronta) {
        if (!parado) this.cena.passo(agora, Math.min(50, agora - antes));
        else if (agora - ultimaCena > 30000) (this.cena.passo(agora, 0), (ultimaCena = agora));
      }
      if (parado) return void (antes = agora);
      const dt = Math.min(50, agora - antes) / 16.7;
      antes = agora;
      const { noite, dia, dourado } = this.cena.pesos;
      const velaAcesa = this.cena.sorteio.vela ? 1 : 0;
      const corMagia = UNIVERSOS[this.cena.sorteio.universo].magia ?? [255, 255, 255];
      ctx.clearRect(0, 0, L.w, L.h);
      for (const p of this.particulas) {
        p.f += 0.02 * dt;
        p.x += (p.vx + Math.sin(p.f) * 0.08) * dt;
        p.y += p.vy * dt;
        if (p.y < -10 || p.x < -10 || p.x > L.w + 10) {
          p.y = L.h * (0.35 + Math.random() * 0.65);
          p.x = Math.random() * L.w;
        }
        const luz = 0.35 + 0.35 * Math.sin(p.f * 1.7);
        // de dia a poeira brilha no sol; de noite, perto da vela (se acesa)
        const quente = p.quente ? velaAcesa * (0.4 + 0.6 * noite) : 0;
        const sol = (dia + dourado * 0.6) * 0.8;
        if (p.magia) ctx.fillStyle = `rgba(${corMagia.join(', ')}, ${0.3 + luz * 0.6})`;
        else if (quente > 0.1) ctx.fillStyle = `rgba(255, 196, 120, ${(0.25 + luz * 0.45) * quente})`;
        else ctx.fillStyle = `rgba(${sol > 0.3 ? '255, 244, 220' : '210, 205, 230'}, ${(0.08 + luz * 0.2) * (1 + sol)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // as mariposas: voltas irregulares em volta da chama (só de noite, com a vela acesa)
      const escuro = noite + dourado * 0.5;
      if (velaAcesa && escuro > 0.45 && !['chuva', 'tempestade'].includes(this.cena.sorteio.clima)) {
        const [cx, cy] = L.cena.chama;
        for (const m of this.mariposas) {
          m.f += m.v * dt;
          const raio = m.r * (0.75 + 0.35 * Math.sin(m.f * 0.7 + m.o));
          const x = cx + Math.cos(m.f * 1.9 + m.o) * raio * 1.15;
          const y = cy + 16 + Math.sin(m.f * 1.3 + m.o) * raio * 0.7;
          // as asas batem: o ponto alterna entre aberto (mais largo) e fechado
          const aberta = Math.sin(m.f * 40) > 0;
          ctx.fillStyle = `rgba(255, 238, 190, ${0.85 * escuro})`;
          ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
          if (aberta) ctx.fillRect(Math.round(x) - 2, Math.round(y), 6, 1);
          ctx.fillStyle = `rgba(255, 190, 110, ${0.14 * escuro})`;
          ctx.beginPath();
          ctx.arc(x + 1, y + 1, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    this.quadro = requestAnimationFrame(passo);
  }
}
