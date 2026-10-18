/**
 * As fichas do C.R.I.S no CRONA (18/10/2026).
 *
 * O Felipe pediu: copiar as fichas que estavam no C.R.I.S (banco `cris`, só leitura) para o CRONA e ligá-las aos
 * personagens equivalentes. Cada ficha abaixo já está convertida para o modelo do CRONA: só as ESCOLHAS (atributos
 * de criação, origem, classe, trilha, perícias, o que se escolheu em cada NEX, mochila); os números saem de
 * `regras.calcular`. As diferenças contra o C.R.I.S estão nas `notas` de cada ficha e em docs/fichas-cris/COMPARACAO-CRONA.md.
 * A ficha original de cada uma está em docs/fichas-cris/ (JSON cru e versão legível).
 *
 * `aplicarFichasCris(db)` roda na subida do servidor (upgradeDb) e só CRIA: nunca sobrescreve uma ficha que já existe
 * para o NPC, e o que o mestre apagar depois não volta (`db.fichasCris` guarda o que já foi feito). Os D.Tepes,
 * Catarina, Alosi e Cora já têm ficha no CRONA e não entram aqui.
 */
import { defaultLook, type FichaSalva, type Npc } from '@crona/shared';
import type { regras } from '@crona/shared';
import type { Database } from './db';

export interface FichaCris {
  /** chave do que já foi aplicado (`db.fichasCris`) */
  chave: string;
  /** o nome da ficha no C.R.I.S */
  nomeCris: string;
  /** o NPC do Elenco que ganha a ficha (`FichaSalva.npc`) */
  npc: string;
  /** a pasta da arte do NPC (arte/personagens/<arte>/): é por ela que a ficha liga ao personagem do tabuleiro */
  arte?: string;
  /** NPC que ainda não existe no Elenco (sem arte, sem peça): é criado junto */
  novo?: { nome: string; grupo: string; nota: string; cor: string };
  /** anotações da ficha: o que veio do C.R.I.S, o que difere e o que falta */
  notas: string;
  ficha: regras.Ficha;
}

export const FICHAS_CRIS: FichaCris[] = [
  {
    "chave": "miguel",
    "nomeCris": "Miguel Albuquerque",
    "npc": "miguel-albuquerque",
    "arte": "miguel-albuquerque",
    "notas": "Importada do C.R.I.S em 18/10/2026 (a ficha original está em docs/fichas-cris/). PV 53, PE 60, SAN 44, Defesa 19 e DT 23 batem com o C.R.I.S. O C.R.I.S estava incompleto: faltam as perícias da classe (só tinha Luta e Reflexos, da origem), as 2 do Perito, o aumento de atributo do NEX 50% e a escolha do poder de Expansão de Conhecimento e de Especialista Diletante (o C.R.I.S registra Ataque Especial e Escolhido pelo Outro Lado, que são habilidades de classe, e o CRONA só aceita poderes). Os 3 rituais do C.R.I.S (Amaldiçoar Arma, Perturbação, Terceiro Olho) vieram dessa habilidade e não cabem na ficha enquanto o poder não for escolhido: anote à mão. As duas Transcender (NEX 30% e 45%) são uma leitura da ordem: o C.R.I.S só diz que são duas, e a SAN 44 confere. A Soqueira tinha a maldição Ritualística, que o CRONA só aplica a armas: ficou no apelido. \"Kit de Tecnologia\" é o Kit de Eletrônica.",
    "ficha": {
      "versao": 1,
      "nome": "Miguel Albuquerque",
      "nex": 50,
      "comecouMundano": false,
      "classe": "especialista",
      "origem": "lutador",
      "atributos": {
        "agi": 2,
        "for": 1,
        "int": 3,
        "pre": 2,
        "vig": 1
      },
      "pericias": {
        "grupos": [],
        "livres": []
      },
      "trilha": "tecnico",
      "progressao": {
        "15": {
          "poder": {
            "id": "artista-marcial"
          }
        },
        "20": {
          "atributo": "pre"
        },
        "30": {
          "poder": {
            "id": "transcender",
            "escolha": {
              "poder": "sensitivo"
            }
          }
        },
        "45": {
          "poder": {
            "id": "transcender",
            "escolha": {
              "poder": "expansao-de-conhecimento"
            }
          }
        },
        "50": {
          "afinidade": "conhecimento",
          "versatilidade": {
            "poder": {
              "id": "especialista-diletante"
            }
          }
        }
      },
      "pp": 75,
      "inventario": [
        {
          "id": "soqueira",
          "tipo": "equipamento",
          "apelido": "Soqueira (Ritualística)"
        },
        {
          "id": "fuzil-de-assalto",
          "tipo": "arma",
          "modificacoes": [
            "alongada"
          ],
          "empunhado": true
        },
        {
          "id": "balas-longas",
          "tipo": "equipamento"
        },
        {
          "id": "protecao-leve",
          "tipo": "protecao",
          "modificacoes": [
            "reforcada"
          ]
        },
        {
          "id": "bandoleira",
          "tipo": "equipamento"
        },
        {
          "id": "mochila-militar",
          "tipo": "equipamento"
        },
        {
          "id": "componentes-ritualisticos-de-elemento",
          "tipo": "equipamento",
          "escolha": {
            "elemento": "conhecimento"
          }
        },
        {
          "id": "kit-de-eletronica",
          "tipo": "equipamento",
          "apelido": "Kit de Tecnologia"
        },
        {
          "id": "lanterna-tatica",
          "tipo": "equipamento"
        },
        {
          "id": "corda",
          "tipo": "equipamento"
        },
        {
          "id": "algemas",
          "tipo": "equipamento"
        }
      ],
      "regras": {
        "sah": true,
        "nexZero": true
      }
    }
  },
  {
    "chave": "agatha",
    "nomeCris": "Agatha Volkomenn",
    "npc": "agata",
    "arte": "agata",
    "notas": "Importada do C.R.I.S em 18/10/2026 (a ficha original está em docs/fichas-cris/). Ficha PARCIAL no C.R.I.S: tinha atributos, origem, classe, trilha e NEX 80%, mas sem rituais, sem poderes de classe, sem inventário e só 2 perícias (Reflexos e Vontade, da origem). PV 74, PE 112, SAN 111 e Defesa 11 batem com o C.R.I.S. O que falta ficou como pendência para o mestre: perícias, rituais, poderes, graus e os aumentos de atributo dos NEX 50% e 80% (o C.R.I.S só mostrava um). Ocultismo aparece treinado porque a classe dá (no C.R.I.S estava vazio). A DT dos rituais é 34 (C.R.I.S: 29): o C.R.I.S não somou Rituais Eficientes (+5).",
    "ficha": {
      "versao": 1,
      "nome": "Agatha Volkomenn",
      "nex": 80,
      "comecouMundano": false,
      "classe": "ocultista",
      "origem": "vitima",
      "atributos": {
        "agi": 1,
        "for": 1,
        "int": 3,
        "pre": 2,
        "vig": 2
      },
      "pericias": {
        "grupos": [],
        "livres": []
      },
      "trilha": "graduado",
      "progressao": {
        "20": {
          "atributo": "pre"
        }
      },
      "pp": 0,
      "inventario": [],
      "regras": {
        "sah": true,
        "nexZero": true
      }
    }
  },
  {
    "chave": "ivete",
    "nomeCris": "Ivete Beicur",
    "npc": "ivete",
    "arte": "ivete",
    "notas": "Importada do C.R.I.S em 18/10/2026 (a ficha original está em docs/fichas-cris/). No C.R.I.S era um modelo quase em branco (NEX 50%, Especialista, atributos todos 1, sem origem, trilha, perícias, poderes, inventário nem textos). PV 53, PE 40, SAN 52 e Defesa 11 batem com os números do modelo. Tudo o que falta ficou como pendência para o mestre.",
    "ficha": {
      "versao": 1,
      "nome": "Ivete Beicur",
      "nex": 50,
      "comecouMundano": false,
      "classe": "especialista",
      "origem": null,
      "atributos": {
        "agi": 1,
        "for": 1,
        "int": 1,
        "pre": 1,
        "vig": 1
      },
      "pericias": {
        "grupos": [],
        "livres": []
      },
      "trilha": null,
      "progressao": {},
      "pp": 0,
      "inventario": [],
      "regras": {
        "sah": true,
        "nexZero": true
      }
    }
  },
  {
    "chave": "marcela",
    "nomeCris": "Marcela Geleerd",
    "npc": "marcela-geleerd",
    "novo": {
      "nome": "Marcela Geleerd",
      "grupo": "Ordo Realitas",
      "nota": "a médica da Enfermaria da Sede; falta o personagem no tabuleiro",
      "cor": "#e8e4dc"
    },
    "notas": "Importada do C.R.I.S em 18/10/2026 (a ficha original está em docs/fichas-cris/). No C.R.I.S era um modelo quase em branco (NEX 50%, Especialista, atributos todos 1, sem origem, trilha, perícias, poderes, inventário nem textos). PV 53, PE 40, SAN 52 e Defesa 11 batem com os números do modelo. Tudo o que falta ficou como pendência para o mestre. Ainda não tem personagem no tabuleiro (falta arte e referência): a ficha está no Elenco, sem peça. É a médica da Enfermaria da Sede.",
    "ficha": {
      "versao": 1,
      "nome": "Marcela Geleerd",
      "nex": 50,
      "comecouMundano": false,
      "classe": "especialista",
      "origem": null,
      "atributos": {
        "agi": 1,
        "for": 1,
        "int": 1,
        "pre": 1,
        "vig": 1
      },
      "pericias": {
        "grupos": [],
        "livres": []
      },
      "trilha": null,
      "progressao": {},
      "pp": 0,
      "inventario": [],
      "regras": {
        "sah": true,
        "nexZero": true
      }
    }
  },
  {
    "chave": "nico",
    "nomeCris": "Nico Delagnore",
    "npc": "nico-delagnore",
    "novo": {
      "nome": "Nico Delagnore",
      "grupo": "Ordo Realitas",
      "nota": "ocultista, Lâmina Paranormal (ficha do C.R.I.S)",
      "cor": "#4a3a52"
    },
    "notas": "Importada do C.R.I.S em 18/10/2026 (a ficha original está em docs/fichas-cris/). PV 62, PE 117, Defesa 12 e DT 26 batem com o C.R.I.S. Diferenças: (1) SAN 68 (C.R.I.S: 63). O C.R.I.S tem 6 Transcender (Potencial Aprimorado 2x, Surto Temporal, Visão do Oculto, Escapar da Morte e Expansão de Conhecimento, com Ninja Urbano), e até NEX 65% o livro dá 5 escolhas (15, 30, 45, 60 e a versatilidade do 50): ficaram de fora a Expansão de Conhecimento e o Ninja Urbano, e cada Transcender tira a SAN do aumento (LR p. 26). (2) O C.R.I.S marca Ocultismo como expert, mas expert só vem a partir de NEX 70%: aqui é veterano. (3) O C.R.I.S marca 11 perícias além da origem e da classe, mais do que o livro dá (7): a ficha mostra o aviso. (4) Faltam 1 ritual (NEX 20%: o C.R.I.S tinha 14 além do Amaldiçoar Arma) e 3 aumentos de grau (NEX 35%). A ordem dos aumentos de atributo, dos poderes e dos rituais foi inferida.",
    "ficha": {
      "versao": 1,
      "nome": "Nico Delagnore",
      "nex": 65,
      "comecouMundano": false,
      "classe": "ocultista",
      "origem": "vitima",
      "atributos": {
        "agi": 1,
        "for": 1,
        "int": 3,
        "pre": 3,
        "vig": 1
      },
      "pericias": {
        "grupos": [],
        "livres": [
          "atualidades",
          "ciencias",
          "enganacao",
          "furtividade",
          "iniciativa",
          "intuicao",
          "investigacao",
          "luta",
          "medicina",
          "percepcao",
          "sobrevivencia"
        ]
      },
      "trilha": "lamina-paranormal",
      "progressao": {
        "5": {
          "parametros": {
            "escolhido-pelo-outro-lado": {
              "rituais": [
                "decadencia",
                "definhar",
                "cicatrizacao"
              ]
            }
          }
        },
        "10": {
          "rituais": [
            "compreensao-paranormal"
          ]
        },
        "15": {
          "poder": {
            "id": "transcender",
            "escolha": {
              "poder": "potencial-aprimorado"
            }
          },
          "rituais": [
            "terceiro-olho"
          ]
        },
        "20": {
          "atributo": "agi"
        },
        "25": {
          "rituais": [
            "desacelerar-impacto"
          ]
        },
        "30": {
          "poder": {
            "id": "transcender",
            "escolha": {
              "poder": "escapar-da-morte"
            }
          },
          "rituais": [
            "miasma-entropico"
          ]
        },
        "35": {
          "rituais": [
            "paradoxo"
          ],
          "grau": [
            "ocultismo",
            "reflexos",
            "vontade"
          ]
        },
        "40": {
          "rituais": [
            "localizacao"
          ]
        },
        "45": {
          "poder": {
            "id": "transcender",
            "escolha": {
              "poder": "surto-temporal"
            }
          },
          "rituais": [
            "deteccao-de-ameacas"
          ]
        },
        "50": {
          "atributo": "vig",
          "afinidade": "morte",
          "versatilidade": {
            "poder": {
              "id": "transcender",
              "escolha": {
                "poder": "visao-do-oculto"
              }
            }
          },
          "rituais": [
            "invadir-mente"
          ]
        },
        "55": {
          "rituais": [
            "poeira-da-podridao"
          ]
        },
        "60": {
          "poder": {
            "id": "transcender",
            "escolha": {
              "poder": "potencial-aprimorado"
            }
          },
          "rituais": [
            "videncia"
          ]
        },
        "65": {
          "rituais": [
            "mergulho-mental"
          ]
        }
      },
      "pp": 75,
      "inventario": [
        {
          "id": "espada",
          "tipo": "arma",
          "maldicoes": [
            "erosiva"
          ],
          "empunhado": true
        },
        {
          "id": "mascara-das-pessoas-nas-sombras",
          "tipo": "amaldicoado"
        },
        {
          "id": "vestimenta",
          "tipo": "equipamento",
          "modificacoes": [
            "aprimorado"
          ],
          "escolha": {
            "pericia": "reflexos"
          }
        }
      ],
      "regras": {
        "sah": true,
        "nexZero": true
      }
    }
  },
  {
    "chave": "verissimo",
    "nomeCris": "Sr. Veríssimo",
    "npc": "sr-verissimo",
    "novo": {
      "nome": "Veríssimo",
      "grupo": "Ordo Realitas",
      "nota": "o Sr. Veríssimo, comandante de campo (ficha do C.R.I.S)",
      "cor": "#2f3a2c"
    },
    "notas": "Importada do C.R.I.S em 18/10/2026 (a ficha original está em docs/fichas-cris/). (No C.R.I.S o nome é \"Sr. Veríssimo\".) PE 56, SAN 51, atributos e perícias batem com o C.R.I.S. Diferenças: (1) PV 128 (C.R.I.S: 100): o 100 do C.R.I.S não soma Calejado (+1 PV por 5% de NEX, da origem Desgarrado) nem Casca Grossa (+1 PV por 5% de NEX, pela versatilidade): 14 + 14. (2) Defesa 22 (C.R.I.S: 24): o C.R.I.S já soma o +2 do Tanque de Guerra, que no CRONA aparece como bônus condicional (vestindo proteção pesada). (3) Oficial Comandante (NEX 99%) estava na lista do C.R.I.S, mas ele tem NEX 70%: ficou de fora. (4) Falta a afinidade do NEX 50% (o C.R.I.S dizia nenhuma). (5) O C.R.I.S marca 8 perícias além da origem e da classe, mais do que o livro dá (3 livres), e mais graus do que a conta permite: a ficha mostra os avisos. A ordem dos aumentos de atributo e dos poderes foi inferida.",
    "ficha": {
      "versao": 1,
      "nome": "Veríssimo",
      "nex": 70,
      "comecouMundano": false,
      "classe": "combatente",
      "origem": "desgarrado",
      "atributos": {
        "agi": 2,
        "for": 2,
        "int": 2,
        "pre": 2,
        "vig": 1
      },
      "pericias": {
        "grupos": [
          "luta",
          "reflexos"
        ],
        "livres": [
          "diplomacia",
          "iniciativa",
          "investigacao",
          "medicina",
          "percepcao",
          "pilotagem",
          "tatica",
          "vontade"
        ]
      },
      "trilha": "comandante-de-campo",
      "progressao": {
        "15": {
          "poder": {
            "id": "golpe-pesado"
          }
        },
        "20": {
          "atributo": "for"
        },
        "30": {
          "poder": {
            "id": "protecao-pesada"
          }
        },
        "35": {
          "grau": [
            "fortitude",
            "luta",
            "vontade",
            "reflexos",
            "tatica"
          ]
        },
        "45": {
          "poder": {
            "id": "ataque-de-oportunidade"
          }
        },
        "50": {
          "atributo": "vig",
          "versatilidade": {
            "trilha": "tropa-de-choque"
          }
        },
        "60": {
          "poder": {
            "id": "tanque-de-guerra"
          }
        },
        "70": {
          "grau": [
            "fortitude",
            "luta",
            "vontade"
          ]
        }
      },
      "pp": 200,
      "inventario": [
        {
          "id": "protecao-pesada",
          "tipo": "protecao"
        }
      ],
      "regras": {
        "sah": true,
        "nexZero": true
      }
    }
  },
  {
    "chave": "omega",
    "nomeCris": "Ômega-99",
    "npc": "omega-99",
    "novo": {
      "nome": "Ômega-99",
      "grupo": "Lotus Branca",
      "nota": "ocultista de NEX 99% (ficha do C.R.I.S)",
      "cor": "#5a1f1f"
    },
    "notas": "Importada do C.R.I.S em 18/10/2026 (a ficha original está em docs/fichas-cris/). PV 110, PE 140, SAN 115, atributos e perícias batem com o C.R.I.S. Diferenças: (1) DT dos rituais 38 (C.R.I.S: 33): o C.R.I.S não somou Rituais Eficientes (+5). (2) O CRONA aprende também o ritual Conhecendo o Medo (Graduado, NEX 99%), que a lista do C.R.I.S não tinha (27 rituais, e não 26). (3) Faltam como pendência: os 5 rituais do Grimório Ritualístico (3 no NEX 40% e 1 em 55% e em 85%) e o poder de NEX 90% (o C.R.I.S só tinha 6 dos 7 poderes: Inventário Organizado entrou pela versatilidade). (4) A ordem dos aumentos de atributo, dos poderes e dos rituais foi inferida; o Anel Pujança (+1 Força) explica a Força 2. (5) Sobrecarregado pelas contas do livro (19 de 15 espaços): Defesa 25 e deslocamento 6 m; sem a sobrecarga seriam 30 e 9 m, como no C.R.I.S. Sem o poder Proteção Pesada (de combatente), a armadura pesada dá −2d20 em Força e Agilidade; ficou como o C.R.I.S tinha. (6) O C.R.I.S marca 17 perícias além da origem e da classe, mais do que o livro dá (7), e graus além da conta: a ficha mostra os avisos. (7) Itens: Bracelete e Anel amaldiçoados usam \"Chaves\" como base (o catálogo não tem acessório genérico); o Dedo Decepado (\"elemento varia\") entrou como o de Morte; os componentes ritualísticos são um item só (o kit completo do C.R.I.S); o Grimório e o Kit de Perícia (Ocultismo) são itens livres.",
    "ficha": {
      "versao": 1,
      "nome": "Ômega-99",
      "nex": 99,
      "comecouMundano": false,
      "classe": "ocultista",
      "origem": "religioso",
      "atributos": {
        "agi": 2,
        "for": 1,
        "int": 3,
        "pre": 2,
        "vig": 1
      },
      "pericias": {
        "grupos": [],
        "livres": [
          "artes",
          "atualidades",
          "ciencias",
          "diplomacia",
          "enganacao",
          "fortitude",
          "furtividade",
          "iniciativa",
          "intimidacao",
          "intuicao",
          "investigacao",
          "luta",
          "medicina",
          "percepcao",
          "reflexos",
          "tatica",
          "tecnologia"
        ]
      },
      "trilha": "graduado",
      "progressao": {
        "5": {
          "parametros": {
            "escolhido-pelo-outro-lado": {
              "rituais": [
                "amaldicoar-arma",
                "armadura-de-sangue",
                "corpo-adaptado"
              ]
            }
          }
        },
        "10": {
          "rituais": [
            "eletrocussao"
          ],
          "parametros": {
            "saber-ampliado": {
              "rituais": [
                "overclock"
              ]
            }
          }
        },
        "15": {
          "poder": {
            "id": "especialista-em-elemento",
            "escolha": {
              "elemento": "morte"
            }
          },
          "rituais": [
            "decadencia"
          ]
        },
        "20": {
          "atributo": "agi",
          "rituais": [
            "cicatrizacao"
          ]
        },
        "25": {
          "rituais": [
            "definhar"
          ],
          "parametros": {
            "saber-ampliado": {
              "rituais": [
                "aprimorar-fisico"
              ]
            }
          }
        },
        "30": {
          "poder": {
            "id": "ritual-potente"
          },
          "rituais": [
            "terceiro-olho"
          ]
        },
        "35": {
          "rituais": [
            "compreensao-paranormal"
          ],
          "grau": [
            "ciencias",
            "investigacao",
            "ocultismo",
            "vontade",
            "artes",
            "enganacao",
            "percepcao",
            "religiao",
            "tecnologia"
          ]
        },
        "40": {
          "rituais": [
            "forma-monstruosa"
          ]
        },
        "45": {
          "poder": {
            "id": "mestre-em-elemento",
            "escolha": {
              "elemento": "morte"
            }
          },
          "rituais": [
            "chamas-do-caos"
          ]
        },
        "50": {
          "atributo": "pre",
          "afinidade": "morte",
          "versatilidade": {
            "poder": {
              "id": "inventario-organizado"
            }
          },
          "rituais": [
            "miasma-entropico"
          ]
        },
        "55": {
          "rituais": [
            "paradoxo"
          ],
          "parametros": {
            "saber-ampliado": {
              "rituais": [
                "purgatorio"
              ]
            }
          }
        },
        "60": {
          "poder": {
            "id": "fluxo-de-poder"
          },
          "rituais": [
            "localizacao"
          ]
        },
        "65": {
          "rituais": [
            "invadir-mente"
          ]
        },
        "70": {
          "rituais": [
            "salto-fantasma"
          ],
          "grau": [
            "ciencias",
            "investigacao",
            "ocultismo",
            "vontade",
            "iniciativa",
            "intuicao"
          ]
        },
        "75": {
          "poder": {
            "id": "criar-selo"
          },
          "rituais": [
            "poeira-da-podridao"
          ]
        },
        "80": {
          "atributo": "vig",
          "rituais": [
            "videncia"
          ]
        },
        "85": {
          "rituais": [
            "martirio-de-sangue"
          ],
          "parametros": {
            "saber-ampliado": {
              "rituais": [
                "teletransporte"
              ]
            }
          }
        },
        "90": {
          "rituais": [
            "fim-inevitavel"
          ]
        },
        "95": {
          "atributo": "vig",
          "rituais": [
            "controle-mental"
          ]
        },
        "99": {
          "rituais": [
            "presenca-do-medo"
          ]
        }
      },
      "pp": 200,
      "inventario": [
        {
          "id": "espada",
          "tipo": "arma",
          "maldicoes": [
            "sanguinaria"
          ],
          "empunhado": true
        },
        {
          "id": "protecao-pesada",
          "tipo": "protecao",
          "maldicoes": [
            "cinetica"
          ]
        },
        {
          "id": "chaves",
          "tipo": "equipamento",
          "maldicoes": [
            "defesa"
          ],
          "apelido": "Bracelete amaldiçoado (Defesa)"
        },
        {
          "id": "chaves",
          "tipo": "equipamento",
          "maldicoes": [
            "pujanca"
          ],
          "apelido": "Anel amaldiçoado (Pujança)"
        },
        {
          "id": "coracao-pulsante",
          "tipo": "amaldicoado"
        },
        {
          "id": "talisma-da-sorte",
          "tipo": "amaldicoado"
        },
        {
          "id": "jaqueta-de-verissimo",
          "tipo": "amaldicoado"
        },
        {
          "id": "dedo-decepado-morte",
          "tipo": "amaldicoado"
        },
        {
          "id": "selos-paranormais-conhecimento",
          "tipo": "amaldicoado"
        },
        {
          "id": "selos-paranormais-morte",
          "tipo": "amaldicoado"
        },
        {
          "id": "componentes-ritualisticos-de-elemento",
          "tipo": "equipamento",
          "escolha": {
            "elemento": "sangue"
          },
          "apelido": "Componentes ritualísticos (todos os elementos)"
        },
        {
          "id": "Grimório Pessoal",
          "tipo": "cena",
          "nome": "Grimório Pessoal",
          "espacos": 1,
          "tipoCena": "document",
          "descricao": "Registra os rituais extras do Grimório Ritualístico."
        },
        {
          "id": "Kit de Perícia (Ocultismo)",
          "tipo": "cena",
          "nome": "Kit de Perícia (Ocultismo)",
          "espacos": 1,
          "tipoCena": "misc",
          "descricao": "Evita a penalidade de −5 em testes de Ocultismo (item do C.R.I.S)."
        },
        {
          "id": "cicatrizante",
          "tipo": "equipamento"
        },
        {
          "id": "cicatrizante",
          "tipo": "equipamento"
        },
        {
          "id": "mochila-militar",
          "tipo": "equipamento"
        }
      ],
      "regras": {
        "sah": true,
        "nexZero": true
      }
    }
  },
  {
    "chave": "interrogacao",
    "nomeCris": "???",
    "npc": "interrogacao",
    "novo": {
      "nome": "???",
      "grupo": "Lotus Branca",
      "nota": "combatente misterioso de NEX 65% (ficha do C.R.I.S)",
      "cor": "#2b2a30"
    },
    "notas": "Importada do C.R.I.S em 18/10/2026 (a ficha original está em docs/fichas-cris/). Ficha de nome \"???\" (personagem misterioso do mestre, da Lótus Branca). PV 107, PE 52, SAN 48 e DT 25 batem com o C.R.I.S. Diferenças: (1) Defesa 12 (C.R.I.S: 14): o C.R.I.S soma o bônus de Reflexos Defensivos, que no CRONA é condicional (+5 contra inimigos em alcance curto). (2) Fortitude e Reflexos são expert no C.R.I.S, mas expert só vem a partir de NEX 70% (ele tem 65%): ficaram veteranos. (3) Faltam: a arma do A Favorita (o C.R.I.S deixou em branco), a afinidade do NEX 50% e o poder de NEX 60% (o C.R.I.S tinha 3 poderes de classe mais a versatilidade). (4) 4 itens de categoria I para um limite de 3 da patente, como no C.R.I.S. Sem textos de aparência, personalidade, história e objetivo. A ordem dos aumentos de atributo e dos poderes foi inferida.",
    "ficha": {
      "versao": 1,
      "nome": "???",
      "nex": 65,
      "comecouMundano": false,
      "classe": "combatente",
      "origem": "atleta",
      "atributos": {
        "agi": 2,
        "for": 2,
        "int": 1,
        "pre": 2,
        "vig": 2
      },
      "pericias": {
        "grupos": [
          "luta",
          "fortitude"
        ],
        "livres": [
          "reflexos",
          "vontade"
        ]
      },
      "trilha": "guerreiro",
      "progressao": {
        "15": {
          "poder": {
            "id": "golpe-pesado"
          }
        },
        "20": {
          "atributo": "for"
        },
        "30": {
          "poder": {
            "id": "protecao-pesada"
          }
        },
        "35": {
          "grau": [
            "fortitude",
            "luta",
            "reflexos",
            "vontade"
          ]
        },
        "45": {
          "poder": {
            "id": "reflexos-defensivos"
          }
        },
        "50": {
          "atributo": "vig",
          "versatilidade": {
            "trilha": "aniquilador"
          }
        }
      },
      "pp": 200,
      "inventario": [
        {
          "id": "mochila-militar",
          "tipo": "equipamento"
        },
        {
          "id": "bandoleira",
          "tipo": "equipamento"
        },
        {
          "id": "vestimenta",
          "tipo": "equipamento",
          "escolha": {
            "pericia": "fortitude"
          }
        },
        {
          "id": "katana",
          "tipo": "arma",
          "empunhado": true
        }
      ],
      "regras": {
        "sah": true,
        "nexZero": true
      }
    }
  }
];

/** O que já foi aplicado: chave → id da ficha (guardado no banco, no config). */
type DbCris = Database & { fichasCris?: Record<string, number> };

/** O personagem do tabuleiro de uma pasta de arte (a folha entregue pelo Códex). */
function personagemDaArte(db: Database, arte: string | undefined): number | undefined {
  if (!arte) return undefined;
  return db.characters.find((c) => c.sheet.includes(`/personagens/${arte}/`))?.id;
}

/**
 * Cria as fichas do C.R.I.S que ainda faltam e liga cada uma ao personagem do tabuleiro. Devolve true se mudou o banco.
 * - NPC do Elenco que já tem ficha: não mexe na ficha, só marca como feito (e liga ao personagem se faltava o link).
 * - NPC avulso do C.R.I.S (Nico, Veríssimo, Ômega-99, ???, Marcela): entra no Elenco sem arte e sem peça.
 * - Banco novo (ainda sem a chave do mestre, `gmKey`, que o hotel dá na primeira subida) ou sem Elenco: não faz nada.
 *   As fichas são do jogo do Felipe; assim os testes e as instalações novas ficam como estavam.
 */
export function aplicarFichasCris(db: Database): boolean {
  if (!db.npcs || !db.gmKey) return false;
  const d = db as DbCris;
  const feitas = (d.fichasCris ??= {});
  const fichas = (db.fichas ??= []);
  let mudou = false;
  for (const e of FICHAS_CRIS) {
    if (feitas[e.chave] === undefined) {
      let existente = fichas.find((f) => f.npc === e.npc);
      if (!existente) {
        if (e.novo && !db.npcs.some((n) => n.id === e.npc)) {
          const look = { ...defaultLook(), top: e.novo.cor };
          const npc: Npc = { id: e.npc, nome: e.novo.nome, look, nota: e.novo.nota, grupo: e.novo.grupo };
          db.npcs.push(npc);
        }
        const agora = new Date().toISOString();
        const id = (db.nextFichaId = Math.max(db.nextFichaId ?? 1, ...fichas.map((f) => f.id + 1)));
        db.nextFichaId = id + 1;
        const nova: FichaSalva = {
          id,
          nome: e.ficha.nome,
          npc: e.npc,
          ficha: structuredClone(e.ficha),
          notas: { anotacoes: e.notas },
          criadaEm: agora,
          atualizadaEm: agora,
        };
        fichas.push(nova);
        existente = nova;
      }
      feitas[e.chave] = existente.id;
      mudou = true;
    }
    // o link com o personagem do tabuleiro (a folha pode ter chegado depois da ficha)
    const f = fichas.find((x) => x.id === feitas[e.chave]);
    if (f && !f.personagem) {
      const p = personagemDaArte(db, e.arte);
      // uma folha tem uma ficha só (as dos Marcados e a de outro NPC ficam como estão)
      if (p && !fichas.some((o) => o !== f && o.personagem === p)) {
        f.personagem = p;
        mudou = true;
      }
    }
  }
  return mudou;
}
