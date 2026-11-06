/**
 * INVASORES (15/10, o Felipe: "um space invaders, com musiquinha, o A atirando, várias fases e boss"): o Feliperama
 * ganha o quarto jogo. A nave embaixo anda para os lados e o A atira (segurar atira sem parar); a frota desce, acelera
 * quando sobra pouca gente e responde a tiros; quatro barreiras se desfazem aos poucos. Cada fase é mais difícil
 * (mais fileiras, mais rápido, mais tiros) e toda terceira é um CHEFE: uma nave enorme com barra de vida e três
 * ataques. A nave de bônus que cruza o alto solta o TIRO DUPLO. Três vidas. Tudo em código, como os outros jogos.
 *
 * Em DUPLA (04/11, o Felipe: "Invasores tem que dar de dupla, quanto mais player mais difícil"): as duas naves jogam juntas
 * contra a mesma frota. O celular de quem convidou ('dono') faz todas as contas (frota, tiros, chefe, as duas naves) e
 * manda o quadro ao outro ('convidado') a cada dois passos; o convidado mexe a própria nave na hora e manda onde ela
 * está e se atira. Com mais gente a frota é maior, mais rápida e atira mais, e o chefe tem mais vida.
 */
import { sfx } from './sfx';
import { COR, fx, H, texto, W, type Dupla, type Entrada, type Jogo, type Nivel } from './fliperamaJogos';

// ---------------------------------------------------------------- as imagens (cada '#' é um pixel)

const NAVE = ['....#....', '...###...', '.#######.', '#########', '#########'];
const ALIEN_A = [
  ['..####..', '.######.', '##.##.##', '########', '.#.##.#.', '#.#..#.#'],
  ['..####..', '.######.', '##.##.##', '########', '..#..#..', '.#.##.#.'],
];
const ALIEN_B = [
  ['#..##..#', '.######.', '##.##.##', '########', '#.####.#', '#.#..#.#'],
  ['..#..#..', '.######.', '##.##.##', '########', '.#.##.#.', '#......#'],
];
const ALIEN_C = [
  ['...##...', '..####..', '.######.', '##.##.##', '########', '.#.##.#.'],
  ['...##...', '..####..', '.######.', '##.##.##', '########', '#.#..#.#'],
];
const ALIENS = [ALIEN_A, ALIEN_B, ALIEN_C];
const COR_ALIEN = [COR.azulClaro, COR.verdeClaro, COR.rosa];
const PONTOS_ALIEN = [10, 20, 30];
const DISCO = ['..######..', '.########.', '##.##.##.#', '##########', '..#....#..'];
const CHEFE = [
  '.........########.........',
  '......############........',
  '....################......',
  '..####.##########.####....',
  '.#####..########..#####...',
  '##########################',
  '##.####.##########.####.##',
  '##########################',
  '.####..############..####.',
  '..##....##......##....##..',
  '.#........#....#........#.',
];

function sprite(g: CanvasRenderingContext2D, linhas: string[], x: number, y: number, cor: string) {
  g.fillStyle = cor;
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  for (let r = 0; r < linhas.length; r++) for (let c = 0; c < linhas[r].length; c++) if (linhas[r][c] === '#') g.fillRect(x0 + c, y0 + r, 1, 1);
}

interface Alien {
  /** coluna e fileira na formação */
  c: number;
  r: number;
  tipo: number;
  vivo: boolean;
}
interface Tiro {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** tiro do chefe: maior */
  grande?: boolean;
}
interface Barreira {
  x: number;
  /** 8 colunas × 5 fileiras de células de 2 × 2 px */
  celulas: boolean[];
}

const BARREIRA_C = 8;
const BARREIRA_R = 5;
const Y_NAVE = 176;
const Y_BARREIRA = 152;
const COLUNAS = 8;
const PASSO_X = 15;
const PASSO_Y = 11;
const FATOR_NIVEL = [0.8, 1, 1.3];
/** fases de chefe: a cada três */
const ehChefe = (fase: number) => fase % 3 === 0;

/** Uma nave: a de quem convidou (0) ou a do convidado (1). */
interface Nave {
  x: number;
  frio: number;
  duplo: number;
  imune: number;
  vidas: number;
  viva: boolean;
}
const novaNave = (x: number): Nave => ({ x, frio: 0, duplo: 0, imune: 90, vidas: 3, viva: true });
const COR_NAVE = [COR.verdeClaro, COR.azulClaro];
/** o quanto cada jogador a mais aperta o jogo (a frota, os tiros dela, a vida do chefe e as fileiras) */
const MAIS_JOGADORES = { frota: 0.18, tiros: 0.55, chefe: 0.9, fileira: 1 };

export class Invasores implements Jogo {
  pontos = 0;
  fim = false;
  private fase = 1;
  private naves: Nave[];
  private tiros: Tiro[] = [];
  private tirosInimigos: Tiro[] = [];
  private aliens: Alien[] = [];
  private gx = 14;
  private gy = 24;
  private dir = 1;
  private disco: { x: number; dir: number } | null = null;
  private proxDisco = 600;
  private barreiras: Barreira[] = [];
  private estrelas = Array.from({ length: 28 }, () => ({ x: Math.floor(Math.random() * W), y: Math.random() * H, v: 0.15 + Math.random() * 0.4 }));
  /** a faixa de "FASE n" que abre cada fase (quadros restantes) */
  private anuncio = 120;
  private q = 0;
  private chefe: { x: number; y: number; vida: number; max: number; dir: number; frio: number; golpe: number } | null = null;
  private totalFase = 0;
  /** em dupla: quem faz as contas ('dono'), quem só mexe a nave e desenha ('convidado'), ou sozinho */
  private papel: 'sozinho' | 'dono' | 'convidado';
  /** o dono: o que o convidado mandou (onde está a nave dele e se atira) */
  remoto: { x: number; a: number } = { x: W / 2 + 20, a: 0 };
  /** a nave deste celular na lista (o dono é a 0; o convidado, a 1) */
  private eu: number;
  private jogadores: number;
  private atirouAgora = false;

  constructor(
    dupla?: Dupla,
    private nivel: Nivel = 1,
  ) {
    this.papel = !dupla ? 'sozinho' : dupla.lado === 0 ? 'dono' : 'convidado';
    this.jogadores = dupla ? 2 : 1;
    this.eu = this.papel === 'convidado' ? 1 : 0;
    this.naves = dupla ? [novaNave(W / 2 - 30), novaNave(W / 2 + 22)] : [novaNave(W / 2 - 4)];
    this.montarFase();
  }

  /** A música: a do jogo, e a do chefe quando ele está na tela. */
  musica(): string {
    return this.chefe ? 'invasoresChefe' : 'invasores';
  }

  resumo() {
    return this.jogadores > 1 ? `FASE ${this.fase} ${this.pontos} PONTOS` : `FASE ${this.fase}`;
  }

  /** A fase em que o jogo parou (para dizer se a dupla foi longe). */
  get faseAtual() {
    return this.fase;
  }

  // ---------------------------------------------------------------- as fases

  private fatorFase() {
    return (1 + (this.fase - 1) * 0.12) * FATOR_NIVEL[this.nivel] * (1 + (this.jogadores - 1) * MAIS_JOGADORES.frota);
  }

  /** Quanto os tiros inimigos aumentam com os jogadores. */
  private fatorTiros() {
    return 1 + (this.jogadores - 1) * MAIS_JOGADORES.tiros;
  }

  private montarFase() {
    this.tiros = [];
    this.tirosInimigos = [];
    this.disco = null;
    this.proxDisco = 500 + Math.random() * 400;
    this.anuncio = 120;
    for (const n of this.naves) n.imune = 90;
    this.aliens = [];
    this.chefe = null;
    if (ehChefe(this.fase)) {
      const base = 26 + this.fase * 6 + this.nivel * 8;
      const max = Math.round(base * (1 + (this.jogadores - 1) * MAIS_JOGADORES.chefe));
      this.chefe = { x: W / 2 - 13, y: 26, vida: max, max, dir: 1, frio: 90, golpe: 0 };
    } else {
      const extra = (this.jogadores - 1) * MAIS_JOGADORES.fileira;
      const fileiras = Math.min(5 + extra, 3 + Math.floor((this.fase - 1) / 2) + extra);
      for (let r = 0; r < fileiras; r++) for (let c = 0; c < COLUNAS; c++) this.aliens.push({ c, r, tipo: r === 0 ? 2 : r < 3 ? 1 : 0, vivo: true });
      this.gx = 10;
      this.gy = 24 + Math.min(3, Math.floor(this.fase / 3)) * 4;
      this.dir = 1;
    }
    this.totalFase = this.aliens.length;
    // as barreiras: refeitas no começo de cada fase
    this.barreiras = [0, 1, 2, 3].map((i) => ({ x: 14 + i * 37, celulas: Array.from({ length: BARREIRA_C * BARREIRA_R }, (_, k) => !(k < BARREIRA_C - 2 && k % BARREIRA_C < 1) && !(k >= BARREIRA_C * (BARREIRA_R - 2) + 2 && k < BARREIRA_C * (BARREIRA_R - 1) - 2)) }));
  }

  private vivos() {
    return this.aliens.filter((a) => a.vivo);
  }

  private posAlien(a: Alien) {
    return { x: this.gx + a.c * PASSO_X, y: this.gy + a.r * PASSO_Y };
  }

  /** As naves que ainda jogam. */
  private vivas() {
    return this.naves.filter((n) => n.viva);
  }

  // ---------------------------------------------------------------- o passo

  passo(e: Entrada) {
    if (this.fim) return;
    this.q++;
    for (const s of this.estrelas) {
      s.y += s.v;
      if (s.y > H) (s.y = 0), (s.x = Math.floor(Math.random() * W));
    }
    if (this.papel === 'convidado') return this.passoConvidado(e);
    // a nave de quem joga aqui: as setas (ou a alavanca) andam; o dedo leva a nave até ele
    const minha = this.naves[0];
    if (minha.viva) {
      if (e.dedo) minha.x += Math.max(-4.2, Math.min(4.2, e.dedo.x - 4 - minha.x));
      else minha.x += 2.4 * e.eixo.x;
      minha.x = Math.max(2, Math.min(W - 11, minha.x));
    }
    // a do convidado: onde ele diz que está
    if (this.papel === 'dono' && this.naves[1].viva) this.naves[1].x = Math.max(2, Math.min(W - 11, this.remoto.x));
    for (const n of this.naves) {
      if (n.frio > 0) n.frio--;
      if (n.imune > 0) n.imune--;
      if (n.duplo > 0) n.duplo--;
    }
    if (this.anuncio > 0) {
      this.anuncio--;
      this.passoTiros();
      return;
    }
    // o A (e o dedo na tela) atira sem parar
    this.atirar(0, !!(e.segura.has('a') || e.dedo || e.apertou.has('a')));
    if (this.papel === 'dono') this.atirar(1, this.remoto.a === 1);
    if (this.chefe) this.passoChefe();
    else this.passoFrota();
    this.passoDisco();
    this.passoTiros();
    // a fase acabou?
    if (!this.chefe && this.vivos().length === 0) this.proximaFase();
  }

  private atirar(i: number, quer: boolean) {
    const n = this.naves[i];
    if (!n || !n.viva || !quer || n.frio > 0) return;
    n.frio = n.duplo > 0 ? 11 : 15;
    const cx = n.x + 4;
    if (n.duplo > 0) this.tiros.push({ x: cx - 3, y: Y_NAVE - 2, vx: 0, vy: -4.4 }, { x: cx + 3, y: Y_NAVE - 2, vx: 0, vy: -4.4 });
    else this.tiros.push({ x: cx, y: Y_NAVE - 2, vx: 0, vy: -4.4 });
    sfx.chip(880, 330, 0.06, 0.05);
  }

  private passoFrota() {
    const vivos = this.vivos();
    if (!vivos.length) return;
    // a frota acelera quando sobra pouca gente (como no original)
    const resto = vivos.length / this.totalFase;
    const vel = (0.22 + (1 - resto) * 0.9) * this.fatorFase();
    this.gx += vel * this.dir;
    const xs = vivos.map((a) => this.posAlien(a).x);
    const min = Math.min(...xs);
    const max = Math.max(...xs) + 8;
    if ((this.dir > 0 && max >= W - 3) || (this.dir < 0 && min <= 3)) {
      this.dir = -this.dir;
      this.gy += 6;
    }
    // chegaram na altura da nave: cada nave perde uma vida e a frota volta para cima
    const baixo = Math.max(...vivos.map((a) => this.posAlien(a).y)) + 6;
    if (baixo >= Y_BARREIRA + 6) {
      this.naves.forEach((n, i) => n.viva && n.imune === 0 && this.perderVida(i));
      this.gy = 24;
      this.tirosInimigos = [];
    }
    // eles atiram (a coluna de baixo, de vez em quando)
    const chance = (0.008 + this.fase * 0.0016) * FATOR_NIVEL[this.nivel] * (1 + (1 - resto) * 1.2) * this.fatorTiros();
    if (Math.random() < chance) {
      const colunas = new Map<number, Alien>();
      for (const a of vivos) if (!colunas.has(a.c) || a.r > colunas.get(a.c)!.r) colunas.set(a.c, a);
      const lista = [...colunas.values()];
      const a = lista[Math.floor(Math.random() * lista.length)];
      const p = this.posAlien(a);
      this.tirosInimigos.push({ x: p.x + 4, y: p.y + 6, vx: 0, vy: (1.5 + this.fase * 0.1 + this.nivel * 0.25) * (1 + (this.jogadores - 1) * 0.1) });
    }
  }

  private passoChefe() {
    const c = this.chefe!;
    const f = this.fatorFase();
    const furioso = c.vida < c.max / 2;
    c.x += c.dir * (0.6 + (furioso ? 0.5 : 0)) * f;
    if (c.x < 4 || c.x > W - 30) (c.dir = -c.dir), (c.x = Math.max(4, Math.min(W - 30, c.x)));
    c.y = 26 + Math.sin(this.q * 0.04) * 6;
    if (c.golpe > 0) c.golpe--;
    if (--c.frio <= 0) {
      const golpe = Math.floor(Math.random() * 3);
      const cx = c.x + 13;
      const vy = 1.7 + this.fase * 0.06 + this.nivel * 0.2;
      if (golpe === 0) {
        // o leque: três tiros abertos (cinco com mais gente)
        const leque = this.jogadores > 1 ? [-1.6, -0.8, 0, 0.8, 1.6] : [-0.8, 0, 0.8];
        for (const vx of leque) this.tirosInimigos.push({ x: cx, y: c.y + 14, vx, vy, grande: true });
      } else if (golpe === 1) {
        // a mira: um tiro na direção de cada nave viva
        for (const n of this.vivas()) {
          const dx = n.x + 4 - cx;
          const dy = Y_NAVE - (c.y + 14);
          const m = Math.hypot(dx, dy) || 1;
          this.tirosInimigos.push({ x: cx, y: c.y + 14, vx: (dx / m) * (vy + 0.6), vy: (dy / m) * (vy + 0.6), grande: true });
        }
      } else {
        // a chuva: uma fileira de tiros pela tela (mais tiros com mais gente)
        const n = this.jogadores > 1 ? 8 : 6;
        for (let i = 0; i < n; i++) this.tirosInimigos.push({ x: 12 + i * ((W - 24) / n) + Math.random() * 8, y: c.y + 14, vx: 0, vy: vy * 0.85 });
      }
      sfx.chip(180, 90, 0.18, 0.09);
      c.frio = Math.round((furioso ? 50 : 78) / Math.max(0.8, f * 0.9) / (1 + (this.jogadores - 1) * 0.15));
    }
  }

  private passoDisco() {
    if (this.chefe) return;
    if (this.disco) {
      this.disco.x += this.disco.dir * 0.9;
      if (this.disco.x < -14 || this.disco.x > W + 4) this.disco = null;
      else if (this.q % 8 === 0) sfx.chip(this.q % 16 === 0 ? 520 : 440, 440, 0.04, 0.03);
    } else if (--this.proxDisco <= 0) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.disco = { x: dir > 0 ? -12 : W + 2, dir };
      this.proxDisco = 700 + Math.random() * 500;
    }
  }

  private passoTiros() {
    // os tiros das naves
    for (const t of this.tiros) {
      t.x += t.vx;
      t.y += t.vy;
    }
    this.tiros = this.tiros.filter((t) => t.y > 8);
    for (const t of this.tiros) {
      if (this.bateBarreira(t.x, t.y, 2)) {
        t.y = -10;
        continue;
      }
      if (this.chefe) {
        const c = this.chefe;
        if (t.x >= c.x && t.x <= c.x + 26 && t.y >= c.y && t.y <= c.y + 11) {
          t.y = -10;
          c.vida--;
          c.golpe = 4;
          this.pontos += 5;
          sfx.chip(220, 160, 0.05, 0.07);
          fx.faiscas(t.x, t.y, [COR.amarelo, COR.laranja], 4, 1.1, 0.03, 14);
          if (c.vida <= 0) {
            this.derrubarChefe();
            break;
          }
          continue;
        }
      } else {
        for (const a of this.aliens) {
          if (!a.vivo) continue;
          const p = this.posAlien(a);
          if (t.x >= p.x && t.x <= p.x + 8 && t.y >= p.y && t.y <= p.y + 6) {
            a.vivo = false;
            t.y = -10;
            this.pontos += PONTOS_ALIEN[a.tipo];
            sfx.chip(520, 90, 0.1, 0.08);
            fx.faiscas(p.x + 4, p.y + 3, COR_ALIEN[a.tipo], 7, 1.3, 0.04, 18);
            break;
          }
        }
        const d = this.disco;
        if (d && t.y > 0 && t.x >= d.x && t.x <= d.x + 10 && t.y >= 10 && t.y <= 15) {
          t.y = -10;
          this.disco = null;
          const bonus = [50, 100, 150, 300][Math.floor(Math.random() * 4)];
          this.pontos += bonus;
          // o tiro duplo vai para a nave que estiver mais perto do disco
          const perto = this.vivas().sort((a, b) => Math.abs(a.x - d.x) - Math.abs(b.x - d.x))[0];
          if (perto) perto.duplo = 900;
          sfx.arpejo([660, 880, 1175], 0.05, 0.07);
          fx.texto(d.x + 5, 8, `${bonus} DUPLO`, COR.amarelo);
          fx.faiscas(d.x + 5, 12, [COR.vermelho, COR.amarelo, COR.branco], 14, 1.6, 0.03, 26);
        }
      }
    }
    // os tiros deles
    for (const t of this.tirosInimigos) {
      t.x += t.vx;
      t.y += t.vy;
    }
    this.tirosInimigos = this.tirosInimigos.filter((t) => t.y < H && t.x > -4 && t.x < W + 4);
    for (const t of this.tirosInimigos) {
      if (this.bateBarreira(t.x, t.y + 3, t.grande ? 3 : 2)) {
        t.y = H + 10;
        continue;
      }
      if (t.y < Y_NAVE - 2 || t.y > Y_NAVE + 5) continue;
      for (let i = 0; i < this.naves.length; i++) {
        const n = this.naves[i];
        if (n.viva && n.imune === 0 && t.x >= n.x && t.x <= n.x + 9) {
          t.y = H + 10;
          this.perderVida(i);
          break;
        }
      }
    }
  }

  /** O tiro apagou uma célula da barreira? (raio: quantas células em volta) */
  private bateBarreira(x: number, y: number, raio: number): boolean {
    for (const b of this.barreiras) {
      if (x < b.x - 1 || x > b.x + BARREIRA_C * 2 + 1 || y < Y_BARREIRA - 1 || y > Y_BARREIRA + BARREIRA_R * 2 + 1) continue;
      const cx = Math.floor((x - b.x) / 2);
      const cy = Math.floor((y - Y_BARREIRA) / 2);
      if (cx < 0 || cx >= BARREIRA_C || cy < 0 || cy >= BARREIRA_R) continue;
      const k = cy * BARREIRA_C + cx;
      if (!b.celulas[k]) continue;
      b.celulas[k] = false;
      if (raio >= 3) for (const d of [-1, 1]) if (cx + d >= 0 && cx + d < BARREIRA_C) b.celulas[cy * BARREIRA_C + cx + d] = false;
      return true;
    }
    return false;
  }

  private perderVida(i: number) {
    const n = this.naves[i];
    n.vidas--;
    fx.tremer(6);
    fx.faiscas(n.x + 4, Y_NAVE, [COR_NAVE[i], COR.branco, COR.amarelo], 18, 2, 0.05, 30);
    sfx.chip(300, 40, 0.5, 0.12);
    sfx.ruido(0.3, 800, 0.15, 150);
    n.duplo = 0;
    n.imune = 110;
    if (n.vidas <= 0) n.viva = false;
    if (!this.naves.some((x) => x.viva)) this.fim = true;
  }

  private derrubarChefe() {
    const c = this.chefe!;
    this.pontos += 500 + this.fase * 100;
    fx.tremer(10);
    fx.piscar(COR.branco, 8);
    fx.faiscas(c.x + 13, c.y + 6, [COR.amarelo, COR.laranja, COR.vermelho, COR.branco], 40, 3, 0.04, 50);
    fx.texto(c.x + 13, c.y, 'CHEFE!', COR.amarelo);
    sfx.arpejo([392, 523, 659, 784, 1046, 1319], 0.07, 0.09);
    sfx.ruido(0.5, 400, 0.2, 80);
    this.chefe = null;
    this.tirosInimigos = [];
    this.proximaFase();
  }

  private proximaFase() {
    this.pontos += 100 * this.fase;
    this.fase++;
    sfx.arpejo([523, 659, 784, 1046], 0.08, 0.08);
    // uma vida de bônus a cada fase de chefe vencida (e quem tinha caído volta com uma)
    if (ehChefe(this.fase - 1))
      for (const n of this.naves) {
        if (n.vidas < 5) n.vidas++;
        n.viva = true;
      }
    this.montarFase();
  }

  // ---------------------------------------------------------------- a dupla

  /** O convidado: mexe a própria nave e segue o que o dono manda; as contas não são dele. */
  private passoConvidado(e: Entrada) {
    const n = this.naves[this.eu];
    if (n.viva) {
      if (e.dedo) n.x += Math.max(-4.2, Math.min(4.2, e.dedo.x - 4 - n.x));
      else n.x += 2.4 * e.eixo.x;
      n.x = Math.max(2, Math.min(W - 11, n.x));
    }
    if (n.frio > 0) n.frio--;
    this.atirouAgora = !!(n.viva && this.anuncio === 0 && (e.segura.has('a') || e.dedo || e.apertou.has('a')));
    if (this.atirouAgora && n.frio === 0) {
      n.frio = n.duplo > 0 ? 11 : 15;
      sfx.chip(880, 330, 0.06, 0.05);
    }
    if (this.anuncio > 0) this.anuncio--;
    // entre um quadro e outro do dono, tudo segue na direção em que ia
    for (const t of this.tiros) (t.x += t.vx), (t.y += t.vy);
    for (const t of this.tirosInimigos) (t.x += t.vx), (t.y += t.vy);
    this.tiros = this.tiros.filter((t) => t.y > 8);
    this.tirosInimigos = this.tirosInimigos.filter((t) => t.y < H + 8);
  }

  /** O que o convidado manda ao dono: onde está a nave e se atira. */
  posicao() {
    return { x: Math.round(this.naves[this.eu].x * 10) / 10, a: this.atirouAgora ? 1 : 0 };
  }

  /** O quadro do jogo que o dono manda ao convidado (a cada dois passos): tudo o que se desenha. */
  estado(): Record<string, unknown> {
    const r = (n: number) => Math.round(n * 10) / 10;
    const bits = (l: boolean[]) => {
      const out: number[] = [];
      for (let i = 0; i < l.length; i += 20) {
        let v = 0;
        for (let k = 0; k < 20 && i + k < l.length; k++) if (l[i + k]) v |= 1 << k;
        out.push(v);
      }
      return out;
    };
    const c = this.chefe;
    return {
      f: this.fase,
      p: this.pontos,
      an: this.anuncio,
      fm: this.fim ? 1 : 0,
      g: [r(this.gx), r(this.gy)],
      n: this.naves.map((n) => [r(n.x), n.vidas, n.duplo, n.imune, n.viva ? 1 : 0]),
      av: bits(this.aliens.map((a) => a.vivo)),
      di: this.disco ? [r(this.disco.x), this.disco.dir] : 0,
      ba: this.barreiras.flatMap((b) => bits(b.celulas)),
      ch: c ? [r(c.x), r(c.y), c.vida, c.max, c.golpe] : 0,
      t: this.tiros.flatMap((t) => [r(t.x), r(t.y)]),
      ti: this.tirosInimigos.flatMap((t) => [r(t.x), r(t.y), r(t.vx), r(t.vy), t.grande ? 1 : 0]),
    };
  }

  /** O convidado recebe o quadro do dono (confere o formato; o que vem torto é ignorado). */
  aplicar(s: unknown) {
    if (!s || typeof s !== 'object') return;
    const d = s as Record<string, unknown>;
    const nums = (v: unknown, max: number): number[] | null => (Array.isArray(v) && v.length <= max && v.every((x) => typeof x === 'number' && Number.isFinite(x)) ? (v as number[]) : null);
    if (typeof d.f !== 'number' || typeof d.p !== 'number' || !Array.isArray(d.n) || d.n.length !== this.naves.length) return;
    const g = nums(d.g, 2);
    const av = nums(d.av, 4);
    const ba = nums(d.ba, 16);
    const t = nums(d.t, 200);
    const ti = nums(d.ti, 400);
    if (!g || g.length !== 2 || !av || !ba || !t || !ti) return;
    if (d.f !== this.fase) {
      this.fase = d.f;
      this.montarFase();
    }
    if (this.pontos < d.p) sfx.chip(520, 90, 0.05, 0.05);
    this.pontos = d.p;
    this.anuncio = typeof d.an === 'number' ? d.an : 0;
    [this.gx, this.gy] = g;
    this.aliens.forEach((a, i) => (a.vivo = (((av[Math.floor(i / 20)] ?? 0) >> i % 20) & 1) === 1));
    this.barreiras.forEach((b, bi) => b.celulas.forEach((_, k) => (b.celulas[k] = (((ba[bi * 2 + Math.floor(k / 20)] ?? 0) >> k % 20) & 1) === 1)));
    d.n.forEach((v, i) => {
      const x = nums(v, 5);
      if (!x || x.length < 5) return;
      const n = this.naves[i];
      // a nave deste celular anda na hora (o dono só confere as vidas e o resto)
      if (i !== this.eu) n.x = x[0];
      if (n.vidas > x[1]) {
        fx.tremer(6);
        sfx.chip(300, 40, 0.5, 0.12);
        fx.faiscas(n.x + 4, Y_NAVE, [COR_NAVE[i], COR.branco, COR.amarelo], 18, 2, 0.05, 30);
      }
      n.vidas = x[1];
      n.duplo = x[2];
      n.imune = x[3];
      n.viva = x[4] === 1;
    });
    const di = nums(d.di, 2);
    this.disco = di && di.length === 2 ? { x: di[0], dir: di[1] } : null;
    const ch = nums(d.ch, 5);
    this.chefe = ch && ch.length === 5 ? { x: ch[0], y: ch[1], vida: ch[2], max: ch[3], dir: 1, frio: 0, golpe: ch[4] } : null;
    this.tiros = [];
    for (let i = 0; i + 1 < t.length; i += 2) this.tiros.push({ x: t[i], y: t[i + 1], vx: 0, vy: -4.4 });
    this.tirosInimigos = [];
    for (let i = 0; i + 4 < ti.length; i += 5) this.tirosInimigos.push({ x: ti[i], y: ti[i + 1], vx: ti[i + 2], vy: ti[i + 3], grande: ti[i + 4] === 1 });
    if (d.fm === 1) this.fim = true;
  }

  // ---------------------------------------------------------------- o desenho

  desenhar(g: CanvasRenderingContext2D, q: number) {
    g.fillStyle = '#02020c';
    g.fillRect(0, 0, W, H);
    for (const s of this.estrelas) {
      g.fillStyle = s.v > 0.4 ? COR.claro : COR.medio;
      g.fillRect(Math.floor(s.x), Math.floor(s.y), 1, 1);
    }
    // o alto: pontos, a fase e as vidas (de cada nave, em dupla)
    texto(g, String(this.pontos).padStart(5, '0'), 4, 3, COR.branco, 1);
    texto(g, `FASE ${this.fase}`, W / 2, 3, this.chefe ? COR.vermelho : COR.ouro, 1, 'meio');
    if (this.naves.length === 1) for (let i = 0; i < Math.max(0, this.naves[0].vidas); i++) sprite(g, ['..#..', '.###.', '#####'], W - 8 - i * 8, 3, COR.verdeClaro);
    else
      this.naves.forEach((n, i) => {
        const x = W - 4 - (this.naves.length - i) * 26;
        sprite(g, ['..#..', '.###.', '#####'], x, 3, n.viva ? COR_NAVE[i] : COR.escuro);
        texto(g, `X${Math.max(0, n.vidas)}`, x + 7, 3, n.viva ? COR.claro : COR.escuro, 1);
      });
    g.fillStyle = COR.escuro;
    g.fillRect(0, 10, W, 1);
    // o chão
    g.fillStyle = COR.verde;
    g.fillRect(0, Y_NAVE + 8, W, 1);
    // as barreiras
    for (const b of this.barreiras) {
      g.fillStyle = COR.verde;
      for (let k = 0; k < b.celulas.length; k++) if (b.celulas[k]) g.fillRect(b.x + (k % BARREIRA_C) * 2, Y_BARREIRA + Math.floor(k / BARREIRA_C) * 2, 2, 2);
    }
    // a frota
    const quadro = Math.floor(q / 22) % 2;
    for (const a of this.aliens) {
      if (!a.vivo) continue;
      const p = this.posAlien(a);
      sprite(g, ALIENS[a.tipo][quadro], p.x, p.y, COR_ALIEN[a.tipo]);
    }
    if (this.disco) sprite(g, DISCO, this.disco.x, 11, COR.vermelho);
    // o chefe, com a barra de vida
    if (this.chefe) {
      const c = this.chefe;
      const furioso = c.vida < c.max / 2;
      sprite(g, CHEFE, c.x + (c.golpe > 0 ? (q % 2 ? 1 : -1) : 0), c.y, c.golpe > 0 ? COR.branco : furioso ? COR.vermelho : COR.roxo);
      g.fillStyle = COR.preto;
      g.fillRect(c.x + 8, c.y + 4, 3, 2);
      g.fillRect(c.x + 15, c.y + 4, 3, 2);
      g.fillStyle = furioso ? COR.amarelo : COR.azulClaro;
      g.fillRect(c.x + 9, c.y + 4, 1, 2);
      g.fillRect(c.x + 16, c.y + 4, 1, 2);
      g.fillStyle = COR.escuro;
      g.fillRect(20, 13, W - 40, 3);
      g.fillStyle = furioso ? COR.vermelho : COR.verde;
      g.fillRect(20, 13, Math.round(((W - 40) * Math.max(0, c.vida)) / c.max), 3);
    }
    // os tiros
    g.fillStyle = COR.verdeClaro;
    for (const t of this.tiros) g.fillRect(Math.round(t.x), Math.round(t.y), 1, 4);
    for (const t of this.tirosInimigos) {
      g.fillStyle = t.grande ? COR.laranja : COR.vermelho;
      g.fillRect(Math.round(t.x) - (t.grande ? 1 : 0), Math.round(t.y), t.grande ? 3 : 2, 4);
      if (q % 6 < 3) (g.fillStyle = COR.amarelo), g.fillRect(Math.round(t.x), Math.round(t.y) + 1, 1, 2);
    }
    // as naves (piscam enquanto estão imunes; a que caiu some)
    this.naves.forEach((n, i) => {
      if (!n.viva) return;
      if (n.imune === 0 || q % 6 < 3) sprite(g, NAVE, n.x, Y_NAVE - 1, n.duplo > 0 ? COR.amarelo : COR_NAVE[i]);
    });
    if (this.naves[this.eu].duplo > 0) texto(g, 'DUPLO', 4, H - 9, COR.amarelo, 1);
    // o anúncio da fase
    if (this.anuncio > 0) {
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(0, 84, W, 26);
      texto(g, this.chefe ? 'CUIDADO!' : `FASE ${this.fase}`, W / 2, 88, this.chefe ? COR.vermelho : COR.ouro, 2, 'meio');
      texto(g, this.chefe ? 'UM CHEFE CHEGOU' : this.fase === 1 ? (this.jogadores > 1 ? 'JUNTOS CONTRA A FROTA' : 'A ATIRA') : 'MAIS RAPIDO', W / 2, 102, COR.claro, 1, 'meio');
    }
  }
}
