// Cria dois personagens de teste (teste1 = cópia da Cora, teste2 = cópia da Alosi), a conta de cada um
// (senha = o nome) e as peças na Sala de Jogos da Mansão Albuquerque. Com o servidor PARADO.
//   npx tsx scripts/dev/criar-testes.mts
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { pathToFileURL } from 'node:url';
const REPO = 'F:/Dhellow/CRONA/projeto';
const env = fs.readFileSync(path.join(REPO, 'server', '.env'), 'utf8');
process.env.CRONA_DB_URL = /^CRONA_DB_URL=(.*)$/m.exec(env)![1].trim();
const mod = (p: string) => import(pathToFileURL(path.join(REPO, p)).href);
const { abrirBanco } = await mod('server/src/banco/index.ts');
const { hashSenha } = await mod('server/src/contas.ts');
const b = await abrirBanco(); const db: any = await b.carregar();
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const sala = db.rooms.find((r: any) => r.name === 'Mansão Albuquerque · Sala de Jogos');
if (!sala) throw new Error('sala não achada');
const livre = (x0: number) => { for (let x = x0; x < 30; x++) for (let y = 3; y < 7; y++) if (!sala.tokens?.some((t: any) => t.x === x && t.y === y)) return { x, y }; return { x: x0, y: 5 }; };
const modelos = [{ nome: 'teste1', de: 'Cora Falcão', cor: '#4fd88a', x0: 18 }, { nome: 'teste2', de: 'Alosi Walker', cor: '#d84f9c', x0: 20 }];
for (const m of modelos) {
  if (db.fichas.some((f: any) => f.nome === m.nome)) { console.log(m.nome, 'já existe'); continue; }
  const fo = db.fichas.find((f: any) => f.nome === m.de && !f.npc);
  const co = db.characters.find((c: any) => c.id === fo.personagem);
  const po = db.rooms.flatMap((r: any) => r.tokens ?? []).find((t: any) => t.name === m.de);
  const cid = db.nextCharId++;
  db.characters.push({ ...clone(co), id: cid, name: m.nome });
  const fid = (db.nextFichaId ??= 1); db.nextFichaId = fid + 1;
  const f = clone(fo);
  f.id = fid; f.nome = m.nome; f.ficha.nome = m.nome; f.personagem = cid; f.chave = crypto.randomBytes(9).toString('base64url');
  for (const i of f.ficha.inventario) i.uid = db.nextItemId++;
  delete f.atual; // cheio
  db.fichas.push(f);
  const p = livre(m.x0);
  const t = { ...clone(po), id: db.nextItemId++, name: m.nome, x: p.x, y: p.y, color: m.cor, look: { ...clone(po.look), charId: cid } };
  (sala.tokens ??= []).push(t);
  db.nextContaId ??= 1;
  db.contas ??= [];
  db.contas = db.contas.filter((c: any) => c.nome !== m.nome);
  db.contas.push({ id: db.nextContaId++, nome: m.nome, email: `${m.nome}@crona.local`, senha: await hashSenha(m.nome), papel: 'jogador', fichaId: fid, sessoes: [], criadaEm: Date.now() });
  console.log('ok', m.nome, 'ficha', fid, 'char', cid, 'peça', t.id, 'em', p);
}
await b.salvar(db); await b.fechar();
