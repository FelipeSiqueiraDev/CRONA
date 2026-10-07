// Ajudas para conferir o tabuleiro no painel do navegador (cole na página ou carregue por /@fs/):
//   __ir('Enfermaria')            abre a cena pelo nome (Configurações > Todas as cenas)
//   __zoomBoard(fx, fy, fw, fh)   cobre a tela com um recorte ampliado do tabuleiro (frações do canvas)
window.__ir = async (nome) => {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 3; i++) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await espera(150);
  }
  document.querySelector('.tb2-bt[title="Configurações"]').click();
  await espera(500);
  [...document.querySelectorAll('.cfg-carta')].find((b) => b.textContent.includes('Todas as cenas')).click();
  await espera(800);
  [...document.querySelectorAll('.room-row')].find((r) => r.textContent.includes(nome)).click();
  await espera(2500);
  return 'ok';
};
window.__zoomBoard = (fx, fy, fw, fh, ms = 8000) => {
  const c = [...document.querySelectorAll('canvas')].filter((x) => x.offsetWidth > 600).sort((a, b) => b.width * b.height - a.width * a.height)[0];
  document.getElementById('__z')?.remove();
  const o = document.createElement('canvas');
  o.id = '__z';
  o.width = innerWidth;
  o.height = innerHeight;
  Object.assign(o.style, { position: 'fixed', inset: 0, zIndex: 99999, background: '#000' });
  const g = o.getContext('2d');
  g.imageSmoothingEnabled = false;
  const sx = c.width * fx, sy = c.height * fy, sw = c.width * fw, sh = c.height * fh;
  const k = Math.min(innerWidth / sw, innerHeight / sh);
  g.drawImage(c, sx, sy, sw, sh, 0, 0, sw * k, sh * k);
  document.body.append(o);
  setTimeout(() => o.remove(), ms);
  return 1;
};
