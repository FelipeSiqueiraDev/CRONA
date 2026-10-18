import type { ClientMsg } from '@crona/shared';
import { h } from './dom';

/**
 * O falso C.R.I.S (a brincadeira de 18/10): os jogadores do Felipe jogavam no C.R.I.S, o sistema dele de antes, e
 * não sabem que o CRONA existe. Quem abre o CRONA pelo link (de fora; não o computador do servidor nem a mesa) vê
 * a tela de entrada do C.R.I.S, igual à de lá (o cartão, o d20 dourado com a frase, o botão coral, as letras), e
 * entra com o usuário e a senha de sempre (as contas vieram do C.R.I.S: scripts/dev/importar-cris.mts).
 *
 * Com a senha certa, o sistema "dá pau": pisca, treme, as cores se separam, o texto embaralha, o d20 enlouquece, a
 * tela se rasga e apaga como TV velha, e por baixo aparece a entrada do CRONA (entrada.ts), que segue para a ficha.
 *
 * Quem decide se aparece: o servidor (/api/entrada: a opção do mestre e se quem pede é de fora); ?cris força,
 * ?crona pula. A resposta do login chega pela mensagem `conta`, e o main.ts chama `erro` ou `quebrar`.
 */

/** As frases do d20 (as do C.R.I.S), uma sorteada para o número que saiu. */
const FRASES: Record<number, string[]> = {
  1: ['Falha crítica. O goblin ri de você.', '1. Até o dado ficou com vergonha.', 'Falha crítica. O mestre já anotou seu obituário.'],
  2: ['O dado escorregou da mesa e ainda deu isso.', 'Dois. A esperança morreu jovem.', 'Rolou pro chão e voltou pior.'],
  3: ['Nem o mestre teve pena.', 'Três. Dá pra chorar, mas não resolve.', 'O destino cuspiu na sua ficha.'],
  4: ['Seu personagem tropeça na própria espada.', 'Quatro. Firme no plano de dar errado.', 'Quase nada. Mas com estilo.'],
  5: ['A sorte de hoje mora em outro plano de existência.', 'Cinco. Metade de um dez, o dobro de nada.', 'O bardo nem se deu ao trabalho de narrar.'],
  6: ['Podia ser pior. Ainda pode.', 'Seis. Sobrevivência no modo difícil.', 'Não é vergonha, mas também não é orgulho.'],
  7: ['Mediano. Como a maioria dos NPCs.', 'Sete. O número da mesa de taverna.', 'Nem lá, nem cá. Clássico sete.'],
  8: ['Nem herói, nem vilão. Só figurante.', 'Oito. O mestre deu de ombros.', 'Passável. Como sopa de estalagem.'],
  9: ['Dá pra sobreviver com isso.', 'Nove. Quase virou coisa boa.', 'Um passo antes do meio-termo.'],
  10: ['Meio a meio, igual moeda de taverna.', 'Dez. O equilíbrio perfeito da mediocridade.', 'Exatamente no meio. Nem bravo, nem feliz.'],
  11: ['Sorte na média. O mestre nem sorriu.', 'Onze. Começando a virar o jogo.', 'Um tico acima do comum.'],
  12: ['Decente. Guarda essa energia.', 'Doze. O plano começa a funcionar.', 'Nada mal pra quem começou torto.'],
  13: ['Treze não é maldição pra quem rola dado.', 'Treze. Azar é superstição de quem rola baixo.', 'O número temido rendeu um sorriso.'],
  14: ['Quase bom. Falta pouco.', 'Catorze. Cheirinho de vitória.', 'Tá esquentando, herói.'],
  15: ['Boa sorte hoje. Aproveita.', 'Quinze. O dado tá do seu lado.', 'Sólido. Pode confiar nessa.'],
  16: ['O destino tá do seu lado.', 'Dezesseis. A taverna ergue as canecas.', 'Boa rolagem. O grupo respira aliviado.'],
  17: ['Rolou liso. Bardo compõe música sobre isso.', 'Dezessete. Quase lenda.', 'O mestre levantou a sobrancelha, impressionado.'],
  18: ['Quase perfeito. Orgulhe-se.', 'Dezoito. Herói de verdade rola assim.', 'Faltou só um sopro pro topo.'],
  19: ['Tão perto do 20 que dói.', 'Dezenove. O crítico te olhou e passou reto.', 'A um fôlego da glória.'],
  20: ['CRÍTICO! Sorte máxima, vá com os deuses.', 'VINTE! A taverna inteira grita seu nome.', 'CRÍTICO! Até o mestre bateu palmas.'],
};

/** O que o sistema "diz" enquanto quebra. */
const PANES = [
  'ERRO 0x0413: PROTOCOLO ÔMEGA COMPROMETIDO',
  'c.r.i.s.exe parou de responder',
  'SINAL INTERCEPTADO',
  'rolando d20... rolando d20... rolando d̷2̸0̵',
  'a ficha não está mais aqui',
  'quem está do outro lado?',
  'FALHA DE SEGMENTAÇÃO',
  'NÃO DESLIGUE O COMPUTADOR',
];

/** As 10 faces visíveis do icosaedro e o dourado do d20 do C.R.I.S (escuro → claro). */
const FACES = [
  '100.0,188.4 176.6,144.2 147.3,127.3',
  '176.6,55.8 147.3,127.3 176.6,144.2',
  '52.7,127.3 23.4,55.8 23.4,144.2',
  '23.4,144.2 100.0,188.4 52.7,127.3',
  '100.0,45.4 176.6,55.8 100.0,11.6',
  '100.0,45.4 100.0,11.6 23.4,55.8',
  '147.3,127.3 52.7,127.3 100.0,188.4',
  '100.0,45.4 147.3,127.3 176.6,55.8',
  '100.0,45.4 23.4,55.8 52.7,127.3',
  '100.0,45.4 52.7,127.3 147.3,127.3',
];
const OURO = ['#8a5a1e', '#8a5a1e', '#c9974f', '#a06c26', '#e0b06a', '#ecc98c', '#b07f30', '#d9a752', '#f0d9ab', '#e8c98a'];

const TITULO_CRIS = 'C.R.I.S — Central de Reconhecimento de Irregularidades Sobrenaturais';
const GLIFOS = '█▓▒░#@$%&?!<>/\\|=+*ÆØ§¥¤╳╱╲';
const sorteio = <T>(l: readonly T[]) => l[Math.floor(Math.random() * l.length)];
/** o texto com parte das letras trocadas por lixo (forca = 0..1) */
const embaralhar = (t: string, forca: number) => [...t].map((c) => (c !== ' ' && Math.random() < forca ? sorteio([...GLIFOS]) : c)).join('');

export interface FalsoCrisOpcoes {
  /** manda a mensagem da conta para o servidor */
  enviar(m: ClientMsg): void;
}

export class FalsoCris {
  readonly el: HTMLElement;
  private cartao: HTMLElement;
  private form: HTMLFormElement;
  private titulo: HTMLElement;
  private usuario: HTMLInputElement;
  private senha: HTMLInputElement;
  private botao: HTMLButtonElement;
  private erroEl: HTMLElement;
  private sub: HTMLElement;
  private numero: HTMLElement;
  private frase: HTMLElement;
  private esperando = false;
  private quebrando = false;
  /** o título e os ícones da aba do CRONA, devolvidos quando a tela sai */
  private abaAntes: { titulo: string; icones: HTMLLinkElement[] } | null = null;

  constructor(private op: FalsoCrisOpcoes) {
    this.titulo = h('h1', { class: 'fcris-titulo' }, 'Entrar');
    this.usuario = h('input', { class: 'fcris-inp', type: 'text', name: 'username', required: true, autocomplete: 'username', placeholder: 'Seu usuário', spellcheck: false }) as HTMLInputElement;
    this.senha = h('input', { class: 'fcris-inp', type: 'password', name: 'password', required: true, autocomplete: 'current-password', placeholder: '••••••••' }) as HTMLInputElement;
    this.erroEl = h('p', { class: 'fcris-erro', role: 'alert', hidden: true });
    this.botao = h('button', { class: 'fcris-botao', type: 'submit' }, 'Entrar') as HTMLButtonElement;
    this.sub = h('p', { class: 'fcris-sub' }, 'Esqueceu a senha? Peça um link de redefinição ao Mestre da campanha.');
    this.form = h(
      'form',
      { class: 'fcris-form', novalidate: false },
      this.titulo,
      h('label', { class: 'fcris-label' }, h('span', null, 'Usuário'), this.usuario),
      h('label', { class: 'fcris-label' }, h('span', null, 'Senha'), this.senha),
      this.erroEl,
      this.botao,
      this.sub,
    ) as HTMLFormElement;
    this.form.addEventListener('submit', (e) => (e.preventDefault(), this.enviar()));

    const n = 1 + Math.floor(Math.random() * 20);
    this.numero = h('span', { class: 'fcris-numero' }, String(n));
    this.frase = h('span', { class: 'fcris-frase' }, sorteio(FRASES[n]));
    const svg = `<svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true">${FACES.map((p, i) => `<polygon points="${p}" fill="${OURO[i]}" stroke="#1a140c" stroke-width="2" stroke-linejoin="round"/>`).join('')}</svg>`;
    const dado = h('div', { class: 'fcris-d20' }, h('div', { class: 'fcris-d20-gira', role: 'img', 'aria-label': 'Um d20' }));
    dado.firstElementChild!.innerHTML = svg;
    dado.firstElementChild!.append(this.numero);

    this.cartao = h(
      'div',
      { class: 'fcris-cartao' },
      h('div', { class: 'fcris-esq' }, this.form),
      h('div', { class: 'fcris-dir' }, h('div', { class: 'fcris-anel', 'aria-hidden': 'true' }), dado, h('div', { class: 'fcris-rolagem' }, this.frase)),
    );
    this.el = h(
      'div',
      { class: 'falso-cris' },
      h('div', { class: 'fcris-palco' }, h('div', { class: 'fcris-pilha' }, this.cartao)),
      // o que aparece quando quebra: as linhas de TV, o chiado e a faixa do erro
      h('div', { class: 'fcris-linhas', 'aria-hidden': 'true' }),
      h('canvas', { class: 'fcris-chiado', 'aria-hidden': 'true' }),
      h('div', { class: 'fcris-pane', 'aria-hidden': 'true' }),
    );
  }

  mostrar() {
    if (!this.el.isConnected) document.body.append(this.el);
    // a aba do navegador também é a do C.R.I.S
    const icones = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')];
    this.abaAntes = { titulo: document.title, icones };
    for (const l of icones) l.remove();
    document.head.append(h('link', { rel: 'icon', type: 'image/svg+xml', href: '/cris/icon.svg', 'data-falso-cris': '' }));
    document.title = TITULO_CRIS;
    if (matchMedia('(pointer: fine)').matches) setTimeout(() => this.usuario.focus(), 50);
  }

  /** A conta respondeu com erro: a mensagem do C.R.I.S. */
  erro(texto: string) {
    this.esperar(false);
    this.erroEl.textContent = /não conferem/.test(texto) ? 'Usuário ou senha incorretos.' : texto;
    this.erroEl.hidden = false;
  }

  /**
   * A senha certa: o C.R.I.S quebra. `revelar` monta a tela do CRONA por baixo (antes de rasgar); `fim` vem com o
   * CRONA já à vista.
   */
  quebrar(revelar: () => void, fim: () => void) {
    if (this.quebrando) return;
    this.quebrando = true;
    this.erroEl.hidden = true;
    const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timers: number[] = [];
    const depois = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
    const pane = this.el.querySelector<HTMLElement>('.fcris-pane')!;
    const textos: [HTMLElement, string][] = [
      [this.titulo, 'Entrar'],
      [this.botao, 'Entrando…'],
      [this.sub, this.sub.textContent!],
      [this.frase, this.frase.textContent!],
      ...[...this.form.querySelectorAll<HTMLElement>('.fcris-label > span')].map((s) => [s, s.textContent!] as [HTMLElement, string]),
    ];
    let forca = 0;
    let fase = 0;
    // o texto embaralha cada vez mais; o d20 roda números
    const tique = window.setInterval(() => {
      for (const [el, t] of textos) el.textContent = forca > 0.85 && Math.random() < 0.25 ? 'C.R.O.N.A' : embaralhar(t, forca);
      this.numero.textContent = forca > 0.5 && Math.random() < 0.3 ? sorteio(['??', '00', 'ÆØ', '13', '0x']) : String(1 + Math.floor(Math.random() * 20));
      if (fase >= 2) pane.textContent = embaralhar(sorteio(PANES), forca * 0.3);
    }, 70);
    this.chiar(() => fase);
    const som = calmo ? null : new Ruido();

    // 1: um soluço (a tela pisca e volta, como se nada)
    depois(350, () => {
      fase = 1;
      forca = 0.08;
      this.el.classList.add('fcris-bug1');
      som?.estalo(0.12);
    });
    depois(700, () => (forca = 0.02));
    // 2: o pau de verdade: treme, as cores se separam, o d20 enlouquece, o aviso de erro
    depois(1150, () => {
      fase = 2;
      forca = 0.3;
      // as cores se separam: duas cópias do cartão, uma vermelha e uma ciano, fatiadas e fora do lugar
      for (const cor of ['fcris-rgb-r', 'fcris-rgb-c']) {
        const copia = this.cartao.cloneNode(true) as HTMLElement;
        copia.classList.add('fcris-rgb', cor);
        copia.setAttribute('aria-hidden', 'true');
        copia.inert = true;
        this.cartao.after(copia);
      }
      this.el.classList.add('fcris-bug2');
      pane.textContent = PANES[0];
      som?.chiado(2.4, 0.08);
    });
    depois(1900, () => (forca = 0.55));
    depois(2500, () => {
      forca = 0.9;
      this.el.classList.add('fcris-bug3');
      som?.estalo(0.25);
    });
    // 3: o CRONA por baixo, a tela rasga e apaga como TV velha
    depois(3100, () => {
      fase = 3;
      revelar();
      this.el.classList.add('fcris-apaga');
      som?.desligar();
    });
    depois(calmo ? 3500 : 3900, () => {
      clearInterval(tique);
      for (const t of timers) clearTimeout(t);
      this.sair();
      fim();
    });
  }

  private enviar() {
    if (this.esperando || this.quebrando) return;
    const usuario = this.usuario.value.trim();
    const senha = this.senha.value;
    if (!usuario || !senha) return this.erro('Preencha usuário e senha.');
    this.erroEl.hidden = true;
    this.esperar(true);
    // o usuário do C.R.I.S é o nome da conta (ou o e-mail): o servidor aceita os dois
    this.op.enviar({ t: 'contaEntrar', email: usuario, senha });
  }

  private esperar(sim: boolean) {
    this.esperando = sim;
    this.botao.disabled = sim;
    this.botao.textContent = sim ? 'Entrando…' : 'Entrar';
  }

  /** O chiado de TV no canvas (fica por cima, mais forte a cada fase). */
  private chiar(fase: () => number) {
    const cv = this.el.querySelector<HTMLCanvasElement>('.fcris-chiado')!;
    const w = 160;
    const hh = 90;
    cv.width = w;
    cv.height = hh;
    const g = cv.getContext('2d');
    if (!g) return;
    const img = g.createImageData(w, hh);
    const quadro = () => {
      if (!this.el.isConnected) return;
      if (fase() >= 1) {
        for (let i = 0; i < img.data.length; i += 4) {
          const v = Math.random() * 255;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = 255;
        }
        g.putImageData(img, 0, 0);
      }
      requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  }

  private sair() {
    this.el.remove();
    for (const l of document.querySelectorAll('link[data-falso-cris]')) l.remove();
    if (this.abaAntes) {
      document.title = this.abaAntes.titulo;
      document.head.append(...this.abaAntes.icones);
      this.abaAntes = null;
    }
  }
}

/** O som do pau (o clique em Entrar já liberou o áudio): estalos, o chiado e o "tum" da TV desligando. */
class Ruido {
  private ctx: AudioContext | null = null;
  private branco: AudioBuffer | null = null;
  constructor() {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const n = this.ctx.sampleRate * 3;
      this.branco = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = this.branco.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  private ruido(dur: number, vol: number, freq: number) {
    const c = this.ctx;
    if (!c || !this.branco) return;
    const src = c.createBufferSource();
    src.buffer = this.branco;
    const filtro = c.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = freq;
    filtro.Q.value = 0.7;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    // o chiado vai e volta, como sinal ruim
    for (let s = 0.1; s < dur; s += 0.09) g.gain.setValueAtTime(vol * (0.35 + Math.random() * 0.9), t + s);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(filtro).connect(g).connect(c.destination);
    src.start(t, Math.random(), dur);
  }

  estalo(vol: number) {
    this.ruido(0.09, vol, 3200);
  }

  chiado(dur: number, vol: number) {
    this.ruido(dur, vol, 1800);
  }

  /** o "tum" grave e o apito da TV apagando */
  desligar() {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.45);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.65);
    this.ruido(0.25, 0.1, 5000);
    setTimeout(() => void c.close().catch(() => {}), 1500);
  }
}
