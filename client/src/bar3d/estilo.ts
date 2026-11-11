/**
 * O estilo visual do protótipo: `?estilo=lowpoly` liga o LOW-POLY FACETADO (modelos de `public/prototipo3d/lowpoly/`, cor
 * chapada, flat shading, luz suave, poucas luzes e sombra barata). Sem o parâmetro, vale o estilo anterior (texturas e pós-processo).
 */
export const LOWPOLY = new URLSearchParams(location.search).get('estilo') === 'lowpoly';
