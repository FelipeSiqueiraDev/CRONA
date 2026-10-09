/**
 * A marca de ouro das abas desliza da aba de antes até a nova, em vez de pular.
 *
 * Vale para toda barra de abas da lista, sem mexer em quem as desenha: um observador do documento
 * percebe quando o `.on` troca de aba (ou a barra é refeita) e leva a marca até lá. A barra refeita
 * do zero (um painel que se redesenha) lembra a posição da marca pelo seletor, então ela desliza
 * também nesse caso. Os estilos ficam em `hud.css` ("a marca de ouro que desliza").
 */
import { reduced } from './motion';

type Tipo = 'pilula' | 'linha';
/** as barras: o seletor, o tipo da marca e, na linha, quanto ela fica abaixo da aba (rem) */
const BARRAS: [string, Tipo, number][] = [
  ['.tb2-abas', 'linha', 0.34],
  ['.rpg-tabs', 'pilula', 0],
  ['.plan-tabs', 'pilula', 0],
  ['.itabs', 'pilula', 0],
  ['.cb-gav-abas', 'linha', -0.3],
];
const SELETOR = BARRAS.map((b) => b[0]).join(',');
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

type Caixa = { x: number; y: number; w: number; h: number };
const ultima = new WeakMap<HTMLElement, Caixa>();
const porSeletor = new Map<string, Caixa>();
const pendentes = new Set<HTMLElement>();
let quadro = 0;

const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;

function caixaDa(on: HTMLElement, tipo: Tipo, dy: number): Caixa {
  const x = on.offsetLeft;
  const w = on.offsetWidth;
  if (tipo === 'pilula') return { x, y: on.offsetTop, w, h: on.offsetHeight };
  // a linha: 64% da largura, no meio, logo abaixo da aba
  return { x: x + w * 0.18, y: on.offsetTop + on.offsetHeight + dy * rem(), w: w * 0.64, h: 0 };
}

function acertar(barra: HTMLElement, deslizar = true) {
  const def = BARRAS.find((b) => barra.matches(b[0]));
  if (!def) return;
  const [sel, tipo, dy] = def;
  const on = [...barra.children].find((c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains('on') && !c.classList.contains('marca-ouro'));
  let marca = barra.querySelector<HTMLElement>(':scope > .marca-ouro');
  if (!on || !on.offsetWidth) {
    marca?.remove();
    return;
  }
  if (getComputedStyle(barra).position === 'static') barra.style.position = 'relative';
  if (!barra.classList.contains('com-marca')) barra.classList.add('com-marca', `marca-${tipo}`);
  if (!marca) {
    marca = document.createElement('i');
    marca.className = `marca-ouro ${tipo}`;
    marca.setAttribute('aria-hidden', 'true');
    barra.prepend(marca);
  }
  const agora = caixaDa(on, tipo, dy);
  // a barra refeita do zero acha a de antes pelo seletor e pelo lugar dela (a classe do pai)
  const chave = `${sel}|${barra.parentElement?.className ?? ''}`;
  const antes = deslizar ? (ultima.get(barra) ?? porSeletor.get(chave)) : undefined;
  ultima.set(barra, agora);
  porSeletor.set(chave, agora);
  const por = (c: Caixa) => ({ transform: `translate(${c.x}px, ${c.y}px)`, width: `${c.w}px`, ...(tipo === 'pilula' ? { height: `${c.h}px` } : {}) });
  Object.assign(marca.style, por(agora));
  if (!antes || reduced() || (Math.abs(antes.x - agora.x) < 1 && Math.abs(antes.w - agora.w) < 1)) return;
  marca.animate([por(antes), por(agora)], { duration: 380, easing: EASE });
}

function agendar(el: Element | null) {
  const barra = el?.closest<HTMLElement>(SELETOR);
  if (!barra) return;
  pendentes.add(barra);
  if (quadro) return;
  quadro = requestAnimationFrame(() => {
    quadro = 0;
    const lista = [...pendentes];
    pendentes.clear();
    for (const b of lista) if (b.isConnected) acertar(b);
  });
}

let ligado = false;
/** Liga a marca deslizante em todas as barras de abas (uma vez, no começo). */
export function ligarMarcaOuro() {
  if (ligado) return;
  ligado = true;
  new MutationObserver((ms) => {
    for (const m of ms) {
      const alvo = m.target as Element;
      if (m.type === 'attributes') {
        if (!alvo.classList?.contains('marca-ouro') && !alvo.matches?.(SELETOR)) agendar(alvo);
        continue;
      }
      agendar(alvo);
      // uma barra inteira que acabou de entrar na tela
      for (const n of m.addedNodes) if (n instanceof HTMLElement) (n.matches(SELETOR) ? [n] : [...n.querySelectorAll<HTMLElement>(SELETOR)]).forEach((b) => agendar(b));
    }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  // a tela mudou de tamanho (ou a fonte chegou): a marca vai junto, sem deslizar
  const tudo = () => document.querySelectorAll<HTMLElement>(SELETOR).forEach((b) => acertar(b, false));
  addEventListener('resize', tudo);
  void document.fonts?.ready.then(tudo);
}
