/**
 * A arte dos joguinhos do bar (o fliperama, os dardos e a sinuca), quando o Códex entregar.
 *
 * Tudo fica em `client/public/arte/bar/`, com os nomes do pedido (PEDIDO-UNICO-CODEX, seções 0B e 0C).
 * Até a arte chegar, cada jogo continua desenhado em código: nada aqui é obrigatório. Peça que chegou
 * entra sozinha, uma por uma.
 */
import { existeArte } from './icons';

const PASTA = '/arte/bar/';

/** null: não existe (ou ainda carregando); a imagem pronta, quando existe */
const imagens = new Map<string, HTMLImageElement | null>();

/**
 * A imagem pronta para desenhar no canvas, ou null (ainda não chegou ou não existe).
 * Chamada a cada quadro: a primeira vez só pergunta se existe e começa a carregar.
 */
export function imagemDoBar(nome: string): HTMLImageElement | null {
  const url = `${PASTA}${nome}.png`;
  if (!imagens.has(url)) {
    imagens.set(url, null);
    void existeArte(url).then((ok) => {
      if (!ok) return;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => imagens.set(url, img);
      img.src = url;
    });
  }
  return imagens.get(url) ?? null;
}

/**
 * Veste uma tela com as peças que chegaram: cada grupo cujos arquivos existem todos vira a classe
 * `tem-<grupo>` na tela, e cada arquivo a variável `--a-<nome>` (a url), para o CSS usar.
 */
export async function vestirComArte(el: HTMLElement, grupos: Record<string, string[]>) {
  for (const [grupo, nomes] of Object.entries(grupos)) {
    const urls = nomes.map((n) => `${PASTA}${n}.png`);
    const tem = await Promise.all(urls.map((u) => existeArte(u)));
    if (!tem.every(Boolean)) continue;
    // carrega antes de trocar, para a peça não aparecer pela metade
    await Promise.all(
      urls.map(
        (u) =>
          new Promise<void>((ok) => {
            const img = new Image();
            img.onload = img.onerror = () => ok();
            img.src = u;
          }),
      ),
    );
    nomes.forEach((n, i) => el.style.setProperty(`--a-${n}`, `url('${urls[i]}')`));
    el.classList.add(`tem-${grupo}`);
  }
}
