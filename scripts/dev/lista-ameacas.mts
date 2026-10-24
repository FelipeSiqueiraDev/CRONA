/** A lista das ameaças do livro (id, nome, tamanho, VD, tipo), para a fila do Códex dos bonecos. Uso: npx tsx scripts/dev/lista-ameacas.mts <saida.json> */
import fs from 'node:fs';
import { AMEACAS_LIVRO } from '../../shared/src/combate/ameacasLivro';

const lista = AMEACAS_LIVRO.map((a) => ({ id: a.id, nome: a.nome, tamanho: a.tamanho, vd: a.vd, tipo: a.tipo, elemento: a.elemento ?? null }));
fs.writeFileSync(process.argv[2], JSON.stringify(lista, null, 1));
console.log(lista.length, 'ameaças');
