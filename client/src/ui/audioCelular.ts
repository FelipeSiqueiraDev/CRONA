/**
 * O som no celular (08/10, a música da entrada não tocava no celular do Felipe).
 *
 * - O navegador só libera o som depois de um gesto "de verdade". No celular, encostar o dedo
 *   (`pointerdown`, `touchstart`) NÃO conta: conta quando o dedo solta (`pointerup`, `touchend`,
 *   `click`) ou uma tecla. Quem quer tocar ouve esses (`aoLiberar`).
 * - No iPhone, o Web Audio obedece a chave do silencioso (fica mudo com ela ligada, mesmo com o
 *   volume alto). Pedimos o modo "reprodução" (`navigator.audioSession`, iOS 17) e, nos mais antigos,
 *   tocamos um áudio mudo em laço no primeiro gesto, o que põe a página no modo de música.
 */

const GESTOS = ['pointerup', 'touchend', 'click', 'keydown'] as const;

// iOS 17+: o som da página como música (não como "som do sistema", que o silencioso cala)
try {
  const sessao = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (sessao) sessao.type = 'playback';
} catch {
  /* navegador sem audioSession */
}

/** Um WAV mudo de meio segundo (para o truque do iPhone antigo). */
function wavMudo(): string {
  const taxa = 8000;
  const n = taxa / 2;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const txt = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  txt(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  txt(8, 'WAVE');
  txt(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  txt(36, 'data');
  v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

let mudo: HTMLAudioElement | null = null;
const ehIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** No primeiro gesto do iPhone: o áudio mudo em laço tira a página do modo "silencioso". */
function destravarIos() {
  if (mudo || !ehIos()) return;
  try {
    mudo = new Audio(wavMudo());
    mudo.loop = true;
    mudo.setAttribute('playsinline', '');
    mudo.volume = 0.01;
    void mudo.play().catch(() => (mudo = null));
  } catch {
    mudo = null;
  }
}

/**
 * Chama `fazer` em cada gesto que libera o som (até ele devolver true, "já tocando"). Devolve a
 * função que para de ouvir.
 */
export function aoLiberar(fazer: () => boolean | void): () => void {
  const f = () => {
    destravarIos();
    if (fazer() === true) parar();
  };
  const parar = () => {
    for (const g of GESTOS) window.removeEventListener(g, f, true);
  };
  for (const g of GESTOS) window.addEventListener(g, f, { capture: true, passive: true });
  return parar;
}
