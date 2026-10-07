// Auditoria de contraste (cole na página): acha texto visível com contraste baixo contra o fundo
// efetivo (o primeiro ancestral com cor de fundo sólida). Devolve os seletores agrupados.
window.__contraste = () => {
  const lum = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(',').map((x) => parseFloat(x));
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return { L: 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b), a };
  };
  const fundo = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const l = lum(cs.backgroundColor);
      if (l && l.a > 0.6) return l.L;
      if (cs.backgroundImage !== 'none' && /gradient/.test(cs.backgroundImage)) {
        const m = cs.backgroundImage.match(/rgba?\([^)]+\)/);
        const g = m && lum(m[0]);
        if (g && g.a > 0.6) return g.L;
      }
    }
    return 0.005;
  };
  const out = new Map();
  for (const el of document.querySelectorAll('body *')) {
    if (!el.childNodes.length) continue;
    const temTexto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!temTexto) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const c = lum(cs.color);
    if (!c) continue;
    const bg = fundo(el);
    const hi = Math.max(c.L, bg), lo = Math.min(c.L, bg);
    const ratio = (hi + 0.05) / (lo + 0.05);
    if (ratio >= 3) continue;
    const sel = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') + ' < ' + (el.parentElement?.className || el.parentElement?.tagName);
    const k = sel.slice(0, 120);
    const v = out.get(k) || { n: 0, cor: cs.color, ratio: ratio.toFixed(2), ex: el.textContent.trim().slice(0, 30) };
    v.n++;
    out.set(k, v);
  }
  return [...out].map(([k, v]) => `${v.ratio} ${v.cor} ${k} «${v.ex}»`).slice(0, 80);
};
window.__contraste();
