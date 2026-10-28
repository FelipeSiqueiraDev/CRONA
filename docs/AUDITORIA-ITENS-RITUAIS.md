# Auditoria: itens e rituais contra os livros (28/10/2026)

Só leitura, entrada por entrada, contra o livro de regras (LR) e o *Sobrevivendo ao Horror* (SaH). Quatro frentes: armas e proteções, equipamentos, modificações e amaldiçoados, rituais. O que já estava em `docs/verissimo/ABERTOS.md` ou em `docs/AUDITORIA-REGRAS.md` ficou de fora (só citado).

**Resumo:** os catálogos estão certos. Nomes, números e páginas batem em 370 entradas (59 armas/proteções/munições, 96 equipamentos, 118 modificações/maldições/amaldiçoados, 97 rituais), e não falta nem sobra item dos livros. Um único erro de número (a Cinética). O resto é **comportamento**: o motor não faz o que a entrada diz, e a regra fica só no texto.

## A mochila que os jogadores não acharam (sessão de 27/10)

A **Mochila militar** está no catálogo (LR p. 66: categoria I, não ocupa espaço, +2 na carga) e o motor soma os 2 espaços. O que travou:

1. **Itens da Ordem só se pedem na Sede** (`naBase`, `hotel.ts`). Hoje a Alosi e a Catarina estão na Mansão Albuquerque: no celular aparece "Itens da Ordem só se pedem na base".
2. **A janela da ficha do celular (`fichaCelular.ts`) mostra o "Pedir itens à Ordem" fora da Sede**: o jogador pede, fecha, o servidor recusa e o item some sem explicação.
3. **Patente:** a Cora já tem 3 de 3 itens de categoria I; a mochila aparece com cadeado ("Fale com o mestre").
4. O nome no livro é "Mochila militar"; a mochila comum é o "Recipiente simples" (não ocupa espaço e não dá carga).

## Armas, munição e proteções

1. Arremesso de arma de corpo a corpo: dados a mais (faca com Agi 3 e For 1 rola 5d20, e não 3d20) e sem as penalidades da arma (−2d20 sem proficiência, −1d20 improvisada). `client/src/ui/combate.ts:1202-1205`; LR p. 54-57.
2. Automáticas sem rajada (−1d20, +1 dado de dano; na contagem de munição, 10 balas e +2 dados). LR p. 59, 174.
3. Espingarda: a metade do dano em alcance médio ou maior não é aplicada; o tiro dos dois canos (−1d20, 6d6) não existe. LR p. 58; SaH p. 37.
4. Revólver compacto: não deveria ocupar espaço para quem é treinado em Crime. SaH p. 37.
5. Pregador pneumático: não conta como arma de fogo para os poderes. SaH p. 37.
6. Só no texto, sem efeito nem aviso no ataque: moto-serra, fuzil de precisão, bazuca, lança-chamas, shuriken, faca tática, bastão policial, baioneta, gancho de carne.
7. O ataque não confere se há o pacote de munição na mochila. LR p. 59.

## Equipamentos

1. **Utensílio guardado na mochila continua dando +2 na perícia**; o livro pede empunhado. `shared/src/regras/calcular.ts:507`; LR p. 63.
2. Kits de perícia e de profissão: o −5 de quem testa sem o kit não é aplicado nem avisado. LR p. 40, 63; SaH p. 94.
3. Kit de profissão não pede qual profissão.
4. Componentes ritualísticos: conjurar não confere se o personagem os tem. LR p. 66, 119.
5. Catalisadores (ampliador, perturbador, potencializador, prolongador): o efeito não entra no ritual. SaH p. 44.
6. Braçadeira reforçada: o +2 na RD do bloqueio não entra. SaH p. 42.
7. Manual operacional: tira Luta e Pontaria da escolha (o SaH p. 39 tem um para cada perícia); o manual aprimorado não acha a perícia.
8. Cargas de taser, spray de pimenta e pistola de dardos não são gastas ao usar; na munição, "usos" quer dizer cenas, e a tela não explica.
9. Pé de cabra, pá, pistola sinalizadora e pistola de dardos não viram arma no ataque.
10. Textos incompletos: amarras (Laçar repete a Vontade), mina antipessoal (direção do cone), equipamento de escuta (falha no Crime), antiemético.
11. Dúvida para o mestre: amarras e scanner aceitam Medo? O livro só tira o Medo dos componentes.

## Modificações, maldições e itens amaldiçoados

1. **ERRO: Cinética dá RD só contra dano físico**; no livro é RD sem tipo, contra qualquer dano. `calcular.ts:280`; LR p. 147, 313.
2. Proteção Elemental: variantes de elemento diferentes se acumulam no mesmo item; contam como a mesma maldição. LR p. 144.
3. Selos paranormais: categoria sempre I; no livro, a do círculo do ritual. LR p. 151.
4. Bateria Potente não entra no taser nem na lanterna tática; Lente de Revelação não entra na câmera de aura (não se aplica a nada).
5. Compensador recusado em arma com Ferrolho Automático. LR p. 60.
6. Só no texto, sem efeito no ataque: Mira Telescópica, Visão de Calor, Predadora, o +1d8 da Lancinante e da Erosiva, o +2 da Função Adicional.
7. Tática: sacar devia ser ação livre; no combate gasta movimento.
8. Antielemento e Energética sem nota no ataque; Consumidora e Erosiva sem a parte dos 2 PE.
9. Carregador Rápido, Bateria Potente e Lente de Revelação sem descrição.

## Rituais

1. Amaldiçoar Arma: o elemento escolhido não é guardado; tudo sai como Conhecimento (já conhecido, item 12 da AUDITORIA-REGRAS).
2. O limite de PE só avisa, não trava a forma verdadeira acima dele. LR p. 121.
3. Mão livre e componentes não são conferidos. LR p. 119.
4. A perda permanente (SAN no Custo do Paranormal e nos rituais de Medo, PE da Convocação Instantânea) nunca chega à ficha. LR p. 121, 128.
5. Alquebrado não soma +1 PE no custo. LR p. 309.
6. Concentração: falta o teste por dano sofrido durante a execução. LR p. 119.
7. Sustentado: conjurar outro troca o anterior sem registrar. LR p. 120.
8. Efeito diferente para quem passa e quem falha (Lâmina do Medo, Conhecendo o Medo, Inexistir, Descarnar, Eletrocussão): a tela aplica o mesmo dano a todos.
9. Poeira da Podridão: quem passa na Fortitude não sofre metade. LR p. 138.
10. Convocar o Algoz: só o primeiro dos dois testes. LR p. 128.
11. Textos: "O que é isso?" do ritual errado nos de Medo e nas ameaças; a ficha mostra a execução com o código interno ("padrao") e esconde a afinidade nas discentes que a pedem.
12. Fedor Pútrido e Tremeluzir (1d4 por rodada de quem sustenta); Cinerária, Rejeitar Névoa e Dissonância Acústica (mudam outros rituais) não entram na conta.
