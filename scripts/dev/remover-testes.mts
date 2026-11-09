// Tira os personagens de teste (teste1 e teste2): contas, fichas, personagens do tabuleiro, peças e a vaga na campanha.
// Com o servidor PARADO.  npx tsx scripts/dev/remover-testes.mts
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const REPO = 'F:/Dhellow/CRONA/projeto';
const env = fs.readFileSync(path.join(REPO, 'server', '.env'), 'utf8');
process.env.CRONA_DB_URL = /^CRONA_DB_URL=(.*)$/m.exec(env)![1].trim();
const { abrirBanco } = await import(pathToFileURL(path.join(REPO, 'server/src/banco/index.ts')).href);
const b = await abrirBanco(); const db: any = await b.carregar();
const NOMES = ['teste1', 'teste2'];
const contas = (db.contas ?? []).filter((c: any) => NOMES.includes(c.nome));
const ids = new Set(contas.map((c: any) => c.id));
const fichas = (db.fichas ?? []).filter((f: any) => NOMES.includes(f.nome));
const chars = new Set(fichas.map((f: any) => f.personagem));
console.log('contas', contas.length, 'fichas', fichas.length, 'personagens', chars.size);
db.contas = db.contas.filter((c: any) => !ids.has(c.id));
db.fichas = db.fichas.filter((f: any) => !NOMES.includes(f.nome));
db.characters = db.characters.filter((c: any) => !(chars.has(c.id) && NOMES.includes(c.name)));
let pecas = 0;
for (const r of db.rooms) { const n = (r.tokens ?? []).length; r.tokens = (r.tokens ?? []).filter((t: any) => !NOMES.includes(t.name)); pecas += n - r.tokens.length; }
for (const c of db.campanhasJogo ?? []) c.membros = c.membros.filter((m: any) => !ids.has(m.contaId));
for (const n of NOMES) delete db.users?.[n];
console.log('peças removidas', pecas);
await b.salvar(db); await b.fechar();
