/**
 * As cenas de momento (17/10, o Felipe: "o Miguel leva a Cora até a cela do pai dela... eu coloco uma música, mostra a
 * cela escura, eu narro 'Passarinho?!' e vem a mão dele segurando a grade"): uma sequência de imagens que toma a tela de
 * todo mundo (o mestre, a mesa e os celulares), com música e uma fala só do mestre em cada quadro.
 */

export const CENA_MAX_QUADROS = 12;
export const CENA_MAX_CENAS = 60;

/** O que a câmera faz na imagem enquanto o quadro está na tela. */
export const MOVIMENTOS = ['zoom', 'afasta', 'esquerda', 'direita', 'cima', 'baixo', 'tremor', 'parado'] as const;
export type MovimentoCena = (typeof MOVIMENTOS)[number];
/** Como o quadro entra: dissolve, corte seco, clarão branco ou passando pelo preto. */
export const TRANSICOES = ['fade', 'corte', 'flash', 'preto'] as const;
export type TransicaoCena = (typeof TRANSICOES)[number];
export const CENA_MAX_DURACAO = 120;

/**
 * Um enquadramento da câmera na imagem: para onde ela olha (x e y, em % da imagem) e o zoom (1 = a imagem cobre a tela;
 * menos que 1 mostra uma imagem larga inteira, mais que 1 chega perto). A câmera vai de um enquadramento ao outro durante
 * o quadro: é assim que se passeia por uma ilustração grande, aproxima de um rosto e afasta no fim.
 */
export interface Foco {
  x: number;
  y: number;
  zoom: number;
}
export const FOCO_ZOOM_MIN = 0.3;
export const FOCO_ZOOM_MAX = 4;
/** Como uma camada entra por cima do fundo: surge, desliza de um lado, cresce ou aparece de um golpe. */
export const ENTRADAS = ['fade', 'esquerda', 'direita', 'cima', 'baixo', 'zoom', 'corte'] as const;
export type EntradaCamada = (typeof ENTRADAS)[number];
export const CENA_MAX_CAMADAS = 6;

/**
 * Uma peça da colagem (a mão, o rosto, a sombra): um PNG transparente do tamanho do fundo, já desenhado no lugar certo,
 * que entra por cima dele no seu tempo. É o que dá o ar de animação a uma imagem parada: a mão chega, o rosto aparece.
 */
export interface CamadaCena {
  imagem: string;
  /** como entra (padrão: surge) */
  entrada?: EntradaCamada;
  /** quantos segundos depois de o quadro entrar (0 a 60) */
  atraso?: number;
  /** quanto tempo a entrada leva, em segundos (padrão 1; 5 aparece bem devagar, como um rosto saindo do escuro) */
  duracao?: number;
  /** a profundidade, de 0 (cola no fundo) a 3 (bem na frente): a de cima desliza mais devagar com a câmera, dando volume */
  prof?: number;
}

export interface CenaQuadro {
  /** a imagem: /uploads/<hash>.png (enviada pelo mestre) ou /arte/... (da arte do jogo) */
  imagem: string;
  /** as peças da colagem que entram por cima da imagem (o fundo) */
  camadas?: CamadaCena[];
  /** o movimento pronto da câmera (padrão: zoom lento para dentro); o `camera` abaixo, quando existe, manda */
  movimento?: MovimentoCena;
  /** a câmera feita à mão: de um enquadramento a outro durante o quadro */
  camera?: { de: Foco; para: Foco };
  /** como o quadro entra (padrão: dissolve) */
  transicao?: TransicaoCena;
  /** quanto tempo fica na tela, em segundos; sem valor, espera o mestre avançar. Com valor, a cena passa sozinha (e fecha depois do último) */
  duracao?: number;
  /** um som que toca uma vez quando o quadro entra (a pancada na grade, a porta): /uploads/<hash>.mp3 */
  som?: string;
  /** o nome do arquivo do som, para o mestre reconhecer */
  somNome?: string;
  /** o texto que aparece embaixo da imagem, para todos (opcional) */
  legenda?: string;
  /** a fala ou a deixa do mestre neste quadro: só o mestre vê, nunca vai para a mesa nem para os celulares */
  nota?: string;
}

export interface CenaMomento {
  id: string;
  titulo: string;
  quadros: CenaQuadro[];
  /** a música ou o som que toca junto: /uploads/<hash>.mp3 (enviada pelo mestre) */
  musica?: string;
  /** o nome do arquivo de música, para o mestre reconhecer na lista */
  musicaNome?: string;
  /** faixas pretas em cima e embaixo, como no cinema (a legenda vai na faixa de baixo) */
  cinema?: boolean;
  /** as salas (cenas do tabuleiro, por id) onde esta cena é sugerida ao mestre quando ele entra: ele decide se solta */
  salas?: number[];
}

/** Uma cena que está na tela agora (só uma por vez, na memória do servidor). */
export interface CenaAoVivo {
  id: string;
  titulo: string;
  quadros: CenaQuadro[];
  musica?: string;
  cinema?: boolean;
  /** o quadro de agora (0 = o primeiro) */
  quadro: number;
  /** a passagem sozinha está parada (o mestre apertou pausa) */
  pausada?: boolean;
}

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, max) : '');

/** Só arquivos do próprio jogo: nada de endereço de fora (a mesa não pode ser mandada buscar coisa na internet). */
export const urlDeCena = (v: unknown, tipos: 'imagem' | 'audio'): string | null => {
  if (typeof v !== 'string' || v.length > 200) return null;
  const ext = tipos === 'imagem' ? '(png|jpe?g|webp)' : '(mp3|ogg|wav|m4a|webm)';
  return new RegExp(`^/(uploads|arte)/[A-Za-z0-9_./-]+\\.${ext}$`, 'i').test(v) && !v.includes('..') ? v : null;
};

const slug = (v: unknown) => texto(v, 40).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');

/** A cena que veio da tela do mestre, conferida (o que vier torto fica de fora). `null` = sem título ou sem quadro válido. */
export function lerCena(raw: unknown, novoId: () => string): CenaMomento | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const titulo = texto(o.titulo, 60);
  if (!titulo) return null;
  const quadros: CenaQuadro[] = [];
  for (const q of Array.isArray(o.quadros) ? o.quadros.slice(0, CENA_MAX_QUADROS) : []) {
    if (!q || typeof q !== 'object') continue;
    const r = q as Record<string, unknown>;
    const imagem = urlDeCena(r.imagem, 'imagem');
    if (!imagem) continue;
    const legenda = texto(r.legenda, 160);
    const nota = texto(r.nota, 300);
    const movimento = (MOVIMENTOS as readonly string[]).includes(r.movimento as string) && r.movimento !== 'zoom' ? (r.movimento as MovimentoCena) : undefined;
    const transicao = (TRANSICOES as readonly string[]).includes(r.transicao as string) && r.transicao !== 'fade' ? (r.transicao as TransicaoCena) : undefined;
    const duracao = typeof r.duracao === 'number' && Number.isFinite(r.duracao) && r.duracao >= 1 ? Math.min(CENA_MAX_DURACAO, Math.round(r.duracao * 10) / 10) : undefined;
    const som = urlDeCena(r.som, 'audio');
    const somNome = texto(r.somNome, 60);
    const foco = (v: unknown): Foco | null => {
      if (!v || typeof v !== 'object') return null;
      const f = v as Record<string, unknown>;
      if (typeof f.x !== 'number' || typeof f.y !== 'number' || typeof f.zoom !== 'number' || ![f.x, f.y, f.zoom].every(Number.isFinite)) return null;
      return { x: Math.round(Math.max(0, Math.min(100, f.x)) * 10) / 10, y: Math.round(Math.max(0, Math.min(100, f.y)) * 10) / 10, zoom: Math.round(Math.max(FOCO_ZOOM_MIN, Math.min(FOCO_ZOOM_MAX, f.zoom)) * 100) / 100 };
    };
    const cam = r.camera && typeof r.camera === 'object' ? (r.camera as Record<string, unknown>) : null;
    const de = cam ? foco(cam.de) : null;
    const para = cam ? foco(cam.para) : null;
    const camadas: CamadaCena[] = [];
    for (const k of Array.isArray(r.camadas) ? r.camadas.slice(0, CENA_MAX_CAMADAS) : []) {
      if (!k || typeof k !== 'object') continue;
      const kk = k as Record<string, unknown>;
      const img = urlDeCena(kk.imagem, 'imagem');
      if (!img) continue;
      const entrada = (ENTRADAS as readonly string[]).includes(kk.entrada as string) && kk.entrada !== 'fade' ? (kk.entrada as EntradaCamada) : undefined;
      const atraso = typeof kk.atraso === 'number' && Number.isFinite(kk.atraso) && kk.atraso > 0 ? Math.min(60, Math.round(kk.atraso * 10) / 10) : undefined;
      const dur = typeof kk.duracao === 'number' && Number.isFinite(kk.duracao) && kk.duracao > 0 && kk.duracao !== 1 ? Math.min(30, Math.round(kk.duracao * 10) / 10) : undefined;
      const prof = typeof kk.prof === 'number' && Number.isFinite(kk.prof) && kk.prof > 0 ? Math.min(3, Math.round(kk.prof * 10) / 10) : undefined;
      camadas.push({ imagem: img, ...(entrada ? { entrada } : {}), ...(atraso ? { atraso } : {}), ...(dur ? { duracao: dur } : {}), ...(prof ? { prof } : {}) });
    }
    quadros.push({
      imagem,
      ...(camadas.length ? { camadas } : {}),
      ...(de && para ? { camera: { de, para } } : {}),
      ...(movimento ? { movimento } : {}),
      ...(transicao ? { transicao } : {}),
      ...(duracao ? { duracao } : {}),
      ...(som ? { som, ...(somNome ? { somNome } : {}) } : {}),
      ...(legenda ? { legenda } : {}),
      ...(nota ? { nota } : {}),
    });
  }
  if (!quadros.length) return null;
  const salas = (Array.isArray(o.salas) ? o.salas : []).filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0).slice(0, 12);
  const musica = urlDeCena(o.musica, 'audio');
  const musicaNome = texto(o.musicaNome, 60);
  return { id: slug(o.id) || novoId(), titulo, quadros, ...(musica ? { musica, ...(musicaNome ? { musicaNome } : {}) } : {}), ...(o.cinema === true ? { cinema: true } : {}), ...(salas.length ? { salas } : {}) };
}

/** A cena como a mesa e os celulares recebem: sem as falas do mestre. */
export function semNotas(c: CenaAoVivo): CenaAoVivo {
  return { ...c, quadros: c.quadros.map(({ nota: _nota, ...resto }) => resto) };
}
