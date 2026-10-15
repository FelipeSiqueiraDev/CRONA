/**
 * Ícones em pixel desenhados por código (14/10): cada um é uma grade de letras, uma letra por pixel, e vira um SVG
 * nítido (shape-rendering crispEdges) do tamanho que o CSS pedir. Para mexer, edite a grade.
 */

const COR: Record<string, string> = {
  o: '#151210', // contorno
  b: '#c8d0da', // lâmina
  h: '#fafcff', // brilho da lâmina
  s: '#78808c', // sombra da lâmina
  g: '#e9a944', // ouro
  G: '#ffd27a', // ouro claro
  d: '#7a4a24', // cabo
  D: '#522e14', // cabo escuro
  m: '#464c58', // metal
  M: '#8c96a4', // brilho do metal
  k: '#282c34', // metal escuro
};

const GRADES = {
  /** espada na diagonal, a ponta para cima e para a direita (arma branca) */
  espada: `
...........ooo
..........ohbo
.........ohbso
........ohbso.
.......ohbso..
......ohbso...
..oo.ohbso....
.oGgohbso.....
..ogGbso......
...oGgo.......
..odogGo......
.odDo.oo......
odDo..........
ooo...........`,
  /** pistola de lado, o cano para a direita (arma de fogo) */
  pistola: `
..o.........o..
.oooooooooooooo
.oMMMMMMMMMMMMo
.ommmmmmmmmmmko
.ommmmmkkkkkkko
.okkkkkoooooooo
..oDdoko.o.....
..oDdo.oo......
.oDddo.........
.oDdDo.........
oDddDo.........
oddDDo.........
ooooo..........`,
};

export type IconePixel = keyof typeof GRADES;

const cache = new Map<IconePixel, string>();

/** O SVG da grade: uma faixa (<rect>) por sequência de pixels da mesma cor em cada linha. */
function svgDe(nome: IconePixel): string {
  const pronto = cache.get(nome);
  if (pronto) return pronto;
  const linhas = GRADES[nome].replace(/^\n/, '').split('\n');
  const w = Math.max(...linhas.map((l) => l.length));
  let rects = '';
  linhas.forEach((l, y) => {
    for (let x = 0; x < l.length; ) {
      const c = l[x];
      if (!COR[c]) {
        x++;
        continue;
      }
      const x0 = x;
      while (x < l.length && l[x] === c) x++;
      rects += `<rect x="${x0}" y="${y}" width="${x - x0}" height="1" fill="${COR[c]}"/>`;
    }
  });
  const svg = `<svg viewBox="0 0 ${w} ${linhas.length}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  cache.set(nome, svg);
  return svg;
}

/** O ícone num <span class="ic-px ...">; o tamanho vem do CSS (largura e altura do span). */
export function iconePixel(nome: IconePixel, cls = ''): HTMLElement {
  const el = document.createElement('span');
  el.className = `ic-px ic-px-${nome}${cls ? ` ${cls}` : ''}`;
  el.innerHTML = svgDe(nome);
  return el;
}
