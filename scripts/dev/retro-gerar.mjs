// Gera client/src/ui/retro-auto.css: a "tinta" das telas do mestre passada para o visual retrô.
// Lê as folhas das telas (papel claro, tinta escura) e, para cada regra que pinta texto escuro
// ou fundo claro de papel, escreve a mesma regra com html:not(.modo-ficha) na frente, trocando a
// cor pela equivalente na janela azul-noite. O retro.css (escrito à mão) vem depois e decide o resto.
// Uso: node scripts/dev/retro-gerar.mjs
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const raiz = path.resolve(import.meta.dirname, '../..');
const FOLHAS = ['shell', 'kit', 'mapa', 'fichas', 'combate', 'itens', 'requisicao', 'teclado'];
const PULA = /modo-ficha|\.jg|\.fc-|entrada|login|:root|^html|^body|\.mesa-doc|\.doc-papel/;

const NOMES = { white: '#ffffff', black: '#000000' };
function parse(c) {
  c = NOMES[c] ?? c;
  let m = c.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((x) => x + x).join('');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  m = c.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4] };
  return null;
}
function hsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}
const lum = ({ r, g, b }) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

// tinta escura -> tinta clara da janela
function tinta(c) {
  const p = parse(c);
  if (!p || p.a < 0.25) return null;
  const L = lum(p);
  if (L > 0.16) return null; // já é clara o bastante para o azul-noite
  const { h, s, l } = hsl(p);
  if (s > 0.3 && l > 0.12) {
    if (h < 22 || h >= 330) return '#ff8a73';
    if (h < 65) return '#ffd27a';
    if (h < 170) return '#79d98f';
    if (h < 260) return '#8fc1ff';
    return '#d9a6ff';
  }
  if (p.a < 0.7) return '#a3978a';
  if (l < 0.17) return '#f3e9d8';
  if (l < 0.3) return '#cdbfa9';
  return '#a3978a';
}
// fundo de papel claro -> azul-noite
function fundo(c) {
  const p = parse(c);
  if (!p || p.a < 0.2) return null;
  const { l } = hsl(p);
  const croma = (Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b)) / 255;
  if (l < 0.62 || croma > 0.3) return null;
  const a = Math.min(0.94, Math.max(0.35, p.a));
  return l > 0.85 ? `rgba(20, 36, 64, ${a.toFixed(2)})` : `rgba(11, 21, 38, ${a.toFixed(2)})`;
}
// borda escura de tinta -> a linha bege da janela
function borda(c) {
  const p = parse(c);
  if (!p) return null;
  const { s, l } = hsl(p);
  if (l > 0.42 || s > 0.45) return null;
  return `rgba(161, 136, 115, ${Math.max(0.3, Math.min(0.75, p.a)).toFixed(2)})`;
}

const COR = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b/gi;
function trocar(valor, fn) {
  let mudou = false;
  const novo = valor.replace(COR, (c) => {
    const t = fn(c.toLowerCase());
    if (t) mudou = true;
    return t ?? c;
  });
  return mudou ? novo : null;
}

const saida = postcss.root();
let n = 0;
for (const nome of FOLHAS) {
  const arq = path.join(raiz, 'client/src/ui', `${nome}.css`);
  const root = postcss.parse(fs.readFileSync(arq, 'utf8'), { from: arq });
  saida.append(postcss.comment({ text: ` ${nome}.css ` }));
  root.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes/i.test(rule.parent.name)) return;
    const sels = rule.selectors.filter((s) => !PULA.test(s));
    if (!sels.length) return;
    const decls = [];
    rule.walkDecls((d) => {
      if (d.parent !== rule) return;
      let v = null;
      if (d.prop === 'color' || d.prop === '-webkit-text-fill-color') v = trocar(d.value, tinta);
      else if (d.prop === 'background-color') v = trocar(d.value, fundo);
      else if (d.prop === 'background' && !/url\(|var\(--tex/.test(d.value)) v = trocar(d.value, fundo);
      else if (/^border(-(top|bottom|left|right))?(-color)?$/.test(d.prop) || d.prop === 'outline' || d.prop === 'outline-color') v = trocar(d.value, borda);
      else if (d.prop === 'fill' || d.prop === 'stroke' || d.prop === 'caret-color') v = trocar(d.value, tinta);
      if (v) decls.push(postcss.decl({ prop: d.prop, value: v, important: d.important }));
    });
    if (!decls.length) return;
    const nova = postcss.rule({ selectors: sels.map((s) => `html:not(.modo-ficha) ${s}`) });
    nova.append(decls);
    // as regras dentro de @media continuam dentro do @media
    let alvo = nova;
    for (let p = rule.parent; p && p.type === 'atrule'; p = p.parent) {
      const at = postcss.atRule({ name: p.name, params: p.params });
      at.append(alvo);
      alvo = at;
    }
    saida.append(alvo);
    n++;
  });
}
const cab = '/* GERADO por scripts/dev/retro-gerar.mjs: não editar à mão (os acertos vão no retro.css) */\n';
fs.writeFileSync(path.join(raiz, 'client/src/ui/retro-auto.css'), cab + saida.toString() + '\n');
console.log(`retro-auto.css: ${n} regras`);
