"""Os textos condicionais do laudo, com a regra que faz cada um aparecer.

Esta é a fonte de verdade da copy do diagnóstico. Cada grupo é um trecho do
laudo e entrega **um** bloco: o primeiro cuja regra bater, na ordem de baixo.

A regra é um dicionário lido por diagnosis.rules:
    {"eq": {"campo": [valores]}}   campo é um dos valores
    {"ne": {"campo": [valores]}}   campo não é nenhum deles
    {"wrong": [n]} / {"right": [n]}  errou / acertou a questão n (0 a 3)
    {"score_min": n} / {"score_max": n}   total de acertos no teste
    {"editais_min": n}             marcou pelo menos n editais
    {"any": [regra, regra]}        basta uma bater
    {"not": regra}                 nenhuma pode bater
Chaves no mesmo dicionário são somadas (E).

Um parágrafo pode ser texto ou {"if": regra, "then": texto, "else": texto}.
Marcadores disponíveis no texto: {edital_label}, {edital_sub}, {disciplinas}.
"""

BLOCKS = [
    {
        "group": "A prova que ele marcou",
        "items": [
            {
                "id": "mira",
                "when": {
                    "editais_min": 1
                },
                "title": "Sobre o {edital_label}",
                "paragraphs": [
                    "Ele está com {edital_sub}, e não vai esperar a sua base ficar pronta. Isso não muda o que você tem que estudar, muda a ordem: começar pelo que tem mais peso e mais chance de cair, e deixar o resto pra depois do edital."
                ]
            }
        ]
    },
    {
        "group": "A estrada até aqui",
        "items": [
            {
                "id": "iniciante",
                "when": {
                    "any": [
                        {
                            "eq": {
                                "tempo": [
                                    "t0",
                                    "t1"
                                ]
                            }
                        },
                        {
                            "eq": {
                                "provas": [
                                    "p0"
                                ],
                                "tempo": [
                                    "t2"
                                ]
                            }
                        }
                    ]
                },
                "title": "Começando agora, o maior risco é estudar pro primeiro edital que sair",
                "paragraphs": [
                    "É a armadilha clássica. Sai um concurso, você corre pra ele, estuda a lista daquele órgão em três meses, faz a prova, não passa, e no edital seguinte descobre que quase nada ficou de pé.",
                    "Formar base é o caminho oposto. É estudar as disciplinas que se repetem em todo tribunal, na ordem certa e com profundidade pra resolver questão difícil: primeiro a teoria sistematizada do tema, depois a lei e a jurisprudência daquele mesmo tema, depois questões comentadas dele, e simulado todo mês pra medir o que ficou. Feito uma vez, isso serve pro TRT, pro TJ e pro TRF, porque a base é a mesma.",
                    "Quem tem base entra em qualquer edital revisando. Quem não tem entra estudando do zero, com o relógio correndo."
                ]
            },
            {
                "id": "servidor",
                "when": {
                    "eq": {
                        "provas": [
                            "p4"
                        ]
                    }
                },
                "title": "Você já é servidor, e isso muda a conta",
                "paragraphs": [
                    "Subir de técnico pra analista é o salto com melhor relação entre esforço e retorno que existe em tribunal. A base comum você já venceu, e a diferença está na profundidade das jurídicas.",
                    "E nada do que você já sabe é jogado fora: no VDE, quem estuda pra analista estuda também o que cai pra técnico. Como você já tem parte do caminho andado, o cronograma personalizado deixa marcar só as disciplinas que precisa aprofundar."
                ]
            },
            {
                "id": "perto",
                "when": {
                    "eq": {
                        "provas": [
                            "p3"
                        ]
                    }
                },
                "title": "Você já fez prova e para perto do corte, então o ajuste é fino e continua sendo de base",
                "paragraphs": [
                    "Chegar perto significa que existe alicerce. Ele só não está nivelado: duas ou três disciplinas seguram a sua nota, e você provavelmente sabe quais são, porque são as que você menos abre.",
                    "A tentação nesse ponto é comprar mais reta final e mais simulado. Isso te mantém no mesmo lugar, porque reta final revisa o que já está pronto e não constrói o que falta.",
                    "No VDE dá pra fazer as duas coisas ao mesmo tempo. O cronograma personalizado deixa você marcar só as disciplinas que estão te derrubando e tratar cada uma até o fim, com teoria sistematizada, caderno de leis por incidência em provas e questão comentada do mesmo tema, enquanto o simulado mensal segura o resto.",
                    {
                        "if": {
                            "eq": {
                                "tempo": [
                                    "t4",
                                    "t5"
                                ]
                            }
                        },
                        "then": "E como você já está nisso há mais de dois anos, eu não somaria mais uma hora ao seu dia antes de revisar a sequência inteira do que já foi estudado. É isso que a conversa com o consultor faz: pega o que você já viu e monta a ordem do que falta."
                    }
                ]
            },
            {
                "id": "longe",
                "when": {
                    "eq": {
                        "provas": [
                            "p1",
                            "p2"
                        ]
                    }
                },
                "title": "Você já fez prova de tribunal, então dá pra ser direta com você",
                "paragraphs": [
                    "Quem faz prova e fica longe do corte quase nunca estuda pouco. Estuda sem base. O que a folha de respostas mostra é uma preparação montada em pedaços: um tanto de videoaula, um PDF achado na internet, questão solta, e nenhuma disciplina fechada do começo ao fim.",
                    "Na prova isso cobra o preço na hora. Você reconhece todos os assuntos e não domina nenhum a ponto de separar duas alternativas parecidas. Como o corte de tribunal é alto, reconhecer não pontua.",
                    "Formação de base é exatamente o que está faltando aí, e é o que o VDE Tribunais faz: um cronograma que fecha {disciplinas} na ordem certa, teoria sistematizada por tema, caderno de leis e informativos com a incidência de cada artigo nas provas anteriores, questões comentadas do mesmo tema logo em seguida e simulado mensal pra medir o avanço. Construída uma vez, ela serve pra todos os editais que vierem.",
                    {
                        "if": {
                            "eq": {
                                "tempo": [
                                    "t4",
                                    "t5"
                                ]
                            }
                        },
                        "then": "E como você já está nisso há mais de dois anos, eu não somaria mais uma hora ao seu dia antes de revisar a sequência inteira do que já foi estudado. É isso que a conversa com o consultor faz: pega o que você já viu e monta a ordem do que falta."
                    }
                ]
            },
            {
                "id": "nuncaprova",
                "when": {
                    "eq": {
                        "provas": [
                            "p0"
                        ]
                    }
                },
                "title": "Você ainda não fez prova de tribunal, e isso é um dado que falta no seu diagnóstico",
                "paragraphs": [
                    "Estudar sem nunca ter sentado numa prova real é estudar sem termômetro. A sala, o relógio e o jeito da banca escrever mudam o seu desempenho, e só a prova mostra o tamanho dessa diferença.",
                    "Inscreva-se na próxima que aparecer, mesmo sem se sentir pronto, e trate aquilo como medição. Enquanto isso, o que constrói nota é a base: as disciplinas que se repetem em todo tribunal, na ordem certa, com questão comentada desde a primeira semana."
                ]
            }
        ]
    },
    {
        "group": "O tempo disponível por dia",
        "items": [
            {
                "id": "h0",
                "when": {
                    "eq": {
                        "horas": [
                            "h0"
                        ]
                    }
                },
                "title": "Menos de 1 hora por dia é o único ponto que eu mexeria já",
                "paragraphs": [
                    "Constância vale mais que velocidade, e eu repito isso todo dia. Só que abaixo de uma hora o intervalo entre uma sessão e outra fica tão grande que você gasta metade do tempo relembrando onde parou.",
                    "Não estou te pedindo o dia inteiro. Com 2 horas por dia a base completa fecha em 12 meses, e essas 2 horas podem ser partidas: 1 hora de manhã e 1 hora à noite valem igual. Comece com o que dá hoje e suba pra 2 assim que der, gerando o cronograma de novo com o tempo novo."
                ]
            },
            {
                "id": "h1",
                "when": {
                    "eq": {
                        "horas": [
                            "h1"
                        ]
                    }
                },
                "title": "1 a 2 horas por dia é suficiente, e eu falo isso com número",
                "paragraphs": [
                    "Você não precisa de velocidade, precisa de constância. Quem estuda 6 horas no domingo e nada durante a semana rende menos que quem faz 2 horas todo dia, porque o esquecimento trabalha justamente nos intervalos.",
                    "No VDE Tribunais, 2 horas por dia formam a base completa em 12 meses. Esse é o cronograma padrão e ele foi desenhado pra quem trabalha. Se um dia sobrar tempo, ótimo, mas o plano não depende disso."
                ]
            },
            {
                "id": "h2",
                "when": {
                    "eq": {
                        "horas": [
                            "h2"
                        ]
                    }
                },
                "title": "Com 3 horas você entra no ritmo recomendado, e a base fecha em 8 meses",
                "paragraphs": [
                    "2 horas por dia fecham a base em 12 meses e 3 horas fecham em 8. Essa hora a mais é a que mais rende no plano inteiro, então, se der pra chegar nas 3 em alguns dias da semana, é ali que eu colocaria.",
                    "Um detalhe que atrapalha muita gente: as horas do cronograma já incluem a resolução de questões. Se você contar só o tempo de leitura, o plano atrasa sem você perceber."
                ]
            },
            {
                "id": "h3",
                "when": {
                    "eq": {
                        "horas": [
                            "h3"
                        ]
                    }
                },
                "title": "No seu ritmo, a base fecha entre 6 e 8 meses",
                "paragraphs": [
                    "3 horas por dia fecham em 8 meses e 4 horas fecham em 6. Você está na faixa em que o resultado depende menos de tempo e mais de ordem: estudar a matéria certa na hora certa, e não gastar as melhores horas do dia no que já domina.",
                    "É pra isso que o cronograma vem pronto por tema. Você abre e executa, sem decidir todo dia o que estudar. Decidir cansa, e é esse cansaço que faz gente com tempo render pouco."
                ]
            },
            {
                "id": "h4",
                "when": {
                    "eq": {
                        "horas": [
                            "h4"
                        ]
                    }
                },
                "title": "Mais de 4 horas por dia: o seu risco é dispersão, não falta de tempo",
                "paragraphs": [
                    "Com 4 horas a base fecha em 6 meses. Quem tem esse tempo costuma preencher com material demais: dois cursos, três canais, PDF de todo mundo. No fim, muitas horas e pouca profundidade.",
                    "Eu faria o contrário. Uma fonte por matéria, o cronograma de 6 meses, e o tempo que sobrar indo pro banco de questões comentadas. Questão resolvida e entendida é o que transforma hora de estudo em nota."
                ]
            }
        ]
    },
    {
        "group": "Como estudou até aqui",
        "items": [
            {
                "id": "retafinal",
                "when": {
                    "eq": {
                        "metodo": [
                            "retafinal"
                        ]
                    }
                },
                "title": "Estudar só quando sai edital pode ser a explicação que está faltando",
                "paragraphs": [
                    "Reta final é revisão. Funciona muito bem pra quem chega com a base pronta e precisa afiar, e não entrega o que promete pra quem chega do zero, porque em 90 dias não existe primeira leitura de 12 disciplinas.",
                    "Pular de edital em edital te obriga a recomeçar sempre no pior momento, com o relógio correndo. O caminho que eu defendo é o inverso: formar a base completa e aprofundada das disciplinas que se repetem em todo tribunal e, só depois disso, entrar em reta final pra revisar o que você já sabe. Aí sim o curso de reta final vira vantagem."
                ]
            },
            {
                "id": "video",
                "when": {
                    "eq": {
                        "metodo": [
                            "video"
                        ]
                    }
                },
                "title": "Videoaula em excesso dá sensação de avanço",
                "paragraphs": [
                    "Assistir é confortável. A matéria parece fácil enquanto o professor explica, e a conta só chega na prova, quando você precisa lembrar sozinho e ninguém está conduzindo o raciocínio.",
                    "No VDE Tribunais eu inverti isso de propósito. A teoria vem em PDF sistematizado, de 30 a 50 páginas por tema, que você lê no seu ritmo e revisita em minutos. Videoaula existe nas não jurídicas, Português, Raciocínio Lógico e Informática, que é onde ver alguém resolvendo na sua frente realmente destrava."
                ]
            },
            {
                "id": "pdf",
                "when": {
                    "eq": {
                        "metodo": [
                            "pdf"
                        ]
                    }
                },
                "title": "Você já estuda no formato certo, então o ajuste é de conteúdo",
                "paragraphs": [
                    "PDF com questões e cronograma é exatamente o método que eu defendo, então metade do caminho está feita. O que costuma faltar nesse cenário é calibragem: material genérico de concurso público, escrito pra qualquer carreira, sem a profundidade que tribunal cobra em Processo Civil e sem dizer o que cada banca realmente pega.",
                    "Esse é o recorte do VDE Tribunais: material feito pra tribunal, com o caderno de leis e informativos mostrando a incidência de cada artigo nas provas dos últimos anos."
                ]
            },
            {
                "id": "questoes",
                "when": {
                    "eq": {
                        "metodo": [
                            "questoes"
                        ]
                    }
                },
                "title": "Só questões trava num teto",
                "paragraphs": [
                    "Questão é o melhor termômetro que existe e o pior professor. Ela mostra onde você erra e ensina só o pedaço daquele item, então o aprendizado fica cheio de buracos, com assuntos inteiros que nunca apareceram nas questões que você fez.",
                    "O desenho que funciona é ler o tema, ler a lei daquele tema e só então resolver questão comentada do mesmo tema, tudo na mesma semana. Os três passos no mesmo assunto, um atrás do outro."
                ]
            },
            {
                "id": "nenhum",
                "when": {
                    "eq": {
                        "metodo": [
                            "nenhum"
                        ]
                    }
                },
                "title": "Sem método, o esforço não acumula",
                "paragraphs": [
                    "Estudar no improviso custa duas vezes: uma no tempo gasto decidindo o que fazer, outra no conteúdo que evapora porque nunca teve segunda passada.",
                    "A parte boa é que isso se resolve numa tarde. Você gera o cronograma, ele te diz o tema do dia, e a sua energia inteira vai pro estudo. O passo zero do VDE é literalmente esse: abrir e ver o que estudar hoje."
                ]
            },
            {
                "id": "mentoria",
                "when": {
                    "eq": {
                        "metodo": [
                            "mentoria"
                        ]
                    }
                },
                "title": "Mentoria organiza a rotina, e alguém ainda precisa entregar o conteúdo",
                "paragraphs": [
                    "Mentoria e coaching resolvem rotina, cobrança e cabeça, e isso tem valor real. O que eles não fazem é te ensinar Processo Civil no nível que a FGV cobra: a maioria te orienta a buscar o conteúdo por fora, e você acaba montando a preparação com pedaços de fontes diferentes.",
                    "O VDE Tribunais entrega as duas pontas na mesma plataforma: o cronograma que organiza e o material que ensina, com a Vic.IA, treinada só nos nossos materiais, pra tirar dúvida na hora em que ela aparece."
                ]
            }
        ]
    },
    {
        "group": "O maior gargalo declarado",
        "items": [
            {
                "id": "d_base",
                "when": {
                    "eq": {
                        "dor": [
                            "base"
                        ]
                    }
                },
                "title": "Sentir que começa do zero a cada edital tem causa técnica",
                "paragraphs": [
                    "Isso acontece quando o estudo nunca teve segunda passada. O conteúdo entra, fica algumas semanas e sai, porque a volta ao assunto só acontece quando ele reaparece num edital.",
                    "No VDE o retorno ao conteúdo é forçado por dois pontos do método: o caderno de leis e informativos, que você revisita por tema, e o simulado mensal, com data já marcada no cronograma, que mostra em número o que ficou de pé e o que evaporou."
                ]
            },
            {
                "id": "d_improviso",
                "when": {
                    "eq": {
                        "dor": [
                            "improviso"
                        ]
                    }
                },
                "title": "Improviso é o gargalo mais fácil de resolver da sua lista",
                "paragraphs": [
                    "Estudar sem cronograma quer dizer que toda sessão começa com uma decisão, e decisão gasta a energia que devia ir pro conteúdo. É também o motivo de matéria chata ficar sempre pra depois.",
                    "O passo zero do VDE Tribunais é gerar o cronograma: você diz quantas horas tem por dia, ele distribui os temas, e você abre a plataforma sabendo exatamente o que fazer. Se sair edital no meio do caminho, é só gerar um personalizado com as disciplinas daquele edital."
                ]
            },
            {
                "id": "d_tempo",
                "when": {
                    "eq": {
                        "dor": [
                            "tempo"
                        ]
                    }
                },
                "title": "Conciliar trabalho e estudo é questão de desenho",
                "paragraphs": [
                    "Quem trabalha não perde por estudar menos horas. Perde por estudar horas irregulares: três dias intensos, quatro em branco, e o conteúdo escorrendo no meio.",
                    "O desenho que funciona é bloco curto e fixo, todo dia, no mesmo horário, com o tema já definido antes de você sentar. 2 horas por dia formam a base completa em 12 meses. É pouco por dia e vira muito no ano."
                ]
            },
            {
                "id": "d_naojur",
                "when": {
                    "eq": {
                        "dor": [
                            "naojur"
                        ]
                    },
                    "not": {
                        "wrong": [
                            0,
                            3
                        ]
                    }
                },
                "title": "As não jurídicas decidem mais provas do que parece",
                "paragraphs": [
                    "Português, Raciocínio Lógico e Informática têm peso alto na prova de tribunal e são justamente onde o bacharel relaxa, achando que garante a nota nas jurídicas. Aí a vaga vai embora por questão de vírgula e de conjunto numérico.",
                    "São essas três que têm videoaula no VDE Tribunais, do zero, além do PDF e das questões comentadas. Foi escolha de método: nas jurídicas, ler e resolver rende mais; nessas, ver alguém resolvendo na sua frente destrava mais rápido."
                ]
            },
            {
                "id": "d_fixar",
                "when": {
                    "eq": {
                        "dor": [
                            "fixar"
                        ]
                    }
                },
                "title": "Ler muito e fixar pouco é sintoma de estudo sem saída",
                "paragraphs": [
                    "Leitura sozinha dá sensação de entendimento e não cria memória de prova. O conteúdo só fixa quando você tenta recuperá-lo sem olhar, e questão é a forma mais barata de fazer isso.",
                    "A regra que eu daria pro seu caso: nenhum tema termina no PDF. Leu a teoria, lê a lei daquele tema e resolve questão comentada dele no mesmo dia. Errar ali é ótimo, porque o comentário te devolve o motivo na hora, enquanto o assunto ainda está quente."
                ]
            },
            {
                "id": "d_banca",
                "when": {
                    "eq": {
                        "dor": [
                            "banca"
                        ]
                    }
                },
                "title": "Saber o que FGV e FCC cobram é conteúdo, e dá pra estudar isso",
                "paragraphs": [
                    "As duas bancas têm assinatura. A FGV gosta de caso concreto, com você aplicando a regra numa situação; a FCC cobra mais a letra da lei e a literalidade do artigo. Estudar sem olhar pra isso é estudar no escuro.",
                    "O caderno de leis e informativos do VDE traz a análise de incidência: quais artigos apareceram nas últimas provas e com que frequência. E o banco tem mais de 75 mil questões comentadas, o que te deixa treinar no formato exato da banca do seu edital."
                ]
            },
            {
                "id": "d_emocional",
                "when": {
                    "eq": {
                        "dor": [
                            "emocional"
                        ]
                    }
                },
                "title": "O emocional melhora quando o plano fica visível",
                "paragraphs": [
                    "Ansiedade e sensação de atraso crescem no escuro. Sem saber quanto falta, todo dia parece pouco, e a comparação com os outros ocupa o espaço que a informação deveria ocupar.",
                    "Ter data de fim muda isso. Saber que a sua base fecha em 8 ou em 12 meses transforma uma angústia sem tamanho numa fila de tarefas com prazo. E o simulado mensal te dá o número real do seu avanço, que quase sempre é melhor que a sua sensação."
                ]
            },
            {
                "id": "d_todas",
                "when": {
                    "eq": {
                        "dor": [
                            "todas"
                        ]
                    }
                },
                "title": "Marcar todas as opções também é um diagnóstico",
                "paragraphs": [
                    "Quando tudo dói ao mesmo tempo, o conteúdo raramente é o culpado. Falta uma estrutura sustentando o estudo, e sem estrutura cada dificuldade puxa a seguinte: sem cronograma você não revisa, sem revisar não fixa, sem fixar a prova assusta, e o medo faz trocar de material outra vez.",
                    "Por isso eu não começaria pela matéria mais difícil. Começaria pelo cronograma e por uma fonte única, e metade dessa lista some sozinha nas primeiras semanas."
                ]
            }
        ]
    },
    {
        "group": "Nível geral no teste",
        "items": [
            {
                "id": "n01",
                "when": {
                    "score_max": 1
                },
                "title": "Sobre as quatro questões: o teste fez o trabalho dele",
                "paragraphs": [
                    "Elas são reais, de FGV e de FCC, e escolhidas entre as difíceis. Errar aqui não diz nada sobre a sua capacidade e diz tudo sobre o tamanho do salto entre estudar o assunto e resolver o item.",
                    "Repara no que elas cobraram: relação lógica entre orações, competência legislativa, fraude à execução com prazos, e lógica pura. É esse o nível que a sua base precisa alcançar, e é ele que eu uso como régua ao montar o material."
                ]
            },
            {
                "id": "n2",
                "when": {
                    "score_min": 2,
                    "score_max": 2
                },
                "title": "Sobre as quatro questões: duas de quatro é um começo real",
                "paragraphs": [
                    "Metade em questões difíceis significa que existe alicerce em pé. Ele ainda não sustenta a régua de tribunal, onde o corte alto obriga a praticamente fechar a prova, mas sustenta uma preparação séria.",
                    "O que costuma faltar nesse ponto é constância e profundidade nas duas ou três disciplinas de maior peso. É pouco ajuste pra bastante ganho."
                ]
            },
            {
                "id": "n34",
                "when": {
                    "score_min": 3
                },
                "title": "Sobre as quatro questões: você não precisa recomeçar nada",
                "paragraphs": [
                    "Nesse nível, refazer teoria do zero seria desperdício do seu tempo. O seu ganho está em profundidade nos pontos específicos que ainda vazam e em volume de questão da sua banca, com tempo cronometrado.",
                    "Se você entrar no curso, o caminho é o cronograma personalizado: marca as disciplinas que precisa e deixa de fora o que já está de pé."
                ]
            }
        ]
    },
    {
        "group": "Sinal das não jurídicas",
        "items": [
            {
                "id": "naojur2",
                "when": {
                    "wrong": [
                        0,
                        3
                    ]
                },
                "title": "Você errou Português e Raciocínio Lógico, e essas duas decidem prova de tribunal",
                "paragraphs": [
                    "Elas não são acessório. Português, Raciocínio Lógico e Informática somam peso alto no total de questões, e são as que mais gente deixa pro final, achando que garante a vaga nas jurídicas. É por ali que a nota vaza.",
                    "Você precisa atacar as duas desde agora, não na véspera. A boa notícia é que são as matérias mais treináveis que existem: regra clara, padrão repetido, questão parecida prova após prova.",
                    "E são exatamente essas que têm videoaula no VDE Tribunais, do zero, além do PDF sistematizado e do banco de questões comentadas. Se você nunca entendeu Português ou congela em lógica, é por essas aulas que eu começaria."
                ]
            },
            {
                "id": "port",
                "when": {
                    "wrong": [
                        0
                    ],
                    "right": [
                        3
                    ]
                },
                "title": "Você errou a de Português, e Português cai em toda prova de tribunal",
                "paragraphs": [
                    "A questão pedia nomear a relação lógica entre duas orações, que é interpretação com nome técnico, o tipo de item que a FGV adora. Português tem peso alto em qualquer tribunal e é a matéria que mais aparece, então cada ponto perdido ali sai caro.",
                    "No VDE Tribunais, Português é uma das disciplinas com videoaula do zero, além do PDF e do banco de questões. Se essa for uma dívida antiga sua, dá pra zerar nos primeiros meses do cronograma."
                ]
            },
            {
                "id": "rlm",
                "when": {
                    "wrong": [
                        3
                    ],
                    "right": [
                        0
                    ]
                },
                "title": "Você errou a de Raciocínio Lógico, e RLM é ponto barato que muita gente entrega",
                "paragraphs": [
                    "Aquela questão era lógica pura, sem nada pra decorar: só combinação de informações. Ela é difícil na primeira vez e vira mecânica depois de umas trinta parecidas, porque FGV e FCC repetem os mesmos formatos.",
                    "É a matéria com a melhor relação entre tempo investido e ponto ganho da prova inteira. No VDE Tribunais ela tem videoaula do zero, além do PDF e das questões comentadas, e eu colocaria ela no cronograma desde a primeira semana."
                ]
            }
        ]
    },
    {
        "group": "Sinal das processuais",
        "items": [
            {
                "id": "proc",
                "when": {
                    "wrong": [
                        2
                    ]
                },
                "title": "Você errou a de Processo Civil, e isso costuma se repetir nos outros processos",
                "paragraphs": [
                    "Processo Civil é o modelo de raciocínio de todas as processuais. Quem tropeça em prazo, ato e efeito ali costuma tropeçar igual em Processo Penal e em Processo do Trabalho, porque a engrenagem é a mesma: quem pode fazer, em que prazo, e o que acontece se não fizer.",
                    {
                        "if": {
                            "eq": {
                                "alvo": [
                                    "trt"
                                ]
                            }
                        },
                        "then": "Isso joga a favor do seu plano: arrumar Processo Civil bem feito arruma as outras junto. E no TRT, Processo Civil e Processo do Trabalho andam colados, então esse é o bloco que eu trataria primeiro.",
                        "else": "Isso joga a favor do seu plano: arrumar Processo Civil bem feito arruma as outras junto. E em TJ e TRF, Processo Civil e Processo Penal somados costumam formar o maior bloco de questões jurídicas da prova."
                    },
                    "No VDE essas matérias vêm com a teoria sistematizada do tema, o caderno de leis com a incidência em provas e a questão comentada logo em seguida. É assim que prazo e ato processual param de escorregar."
                ]
            }
        ]
    },
    {
        "group": "Sinal do direito público",
        "items": [
            {
                "id": "pub",
                "when": {
                    "wrong": [
                        1
                    ]
                },
                "title": "Você errou a de Constitucional, e Constitucional é a porta do direito público",
                "paragraphs": [
                    "A questão era de competência legislativa, um dos assuntos mais cobrados da Constituição e o que sustenta o resto do direito público. Quem não tem esse eixo firme costuma sentir a mesma dificuldade em Administrativo e em Tributário, porque as três repetem a mesma pergunta: quem pode legislar, quem pode agir, e até onde vai esse poder.",
                    "Constitucional e Administrativo estão na base comum de todo tribunal, TRT, TJ e TRF, e caem em toda prova. Se eu fosse escolher por onde você começa, começaria por aí, porque o ganho aparece nas três de uma vez."
                ]
            }
        ]
    },
    {
        "group": "Alvo e calendário",
        "items": [
            {
                "id": "reta",
                "when": {
                    "eq": {
                        "edital": [
                            "reta"
                        ]
                    }
                },
                "title": "Sobre a sua prova em menos de 3 meses",
                "paragraphs": [
                    "Com esse prazo, começar formação de base agora não te ajuda nessa prova. O que rende nas próximas semanas é revisão das disciplinas de maior peso, lei seca e questão da banca. É isso que eu faria no seu lugar.",
                    "Depois dessa prova o cenário muda. São 27 TJs, 6 TRFs e 24 TRTs em rodízio, e o próximo edital vai te encontrar revisando ou começando de novo. Vale conversar com o consultor já pensando nele."
                ]
            },
            {
                "id": "multi",
                "when": {
                    "editais_min": 3
                },
                "title": "Você marcou vários editais, e essa é uma decisão adiada",
                "paragraphs": [
                    "Quem quer tudo acaba não estudando de verdade pra nada. Cada edital tem as suas específicas, e correr atrás de todos ao mesmo tempo deixa você raso em todos.",
                    "A saída não é desistir dos outros: é escolher um foco pra base e deixar que os demais venham junto, porque a base comum se repete. Um atalho pra escolher: se você tem afinidade com Trabalho e Processo do Trabalho, vá de TRT; se prefere Penal e Processo Penal, vá de TJ ou TRF."
                ]
            },
            {
                "id": "alvo_fe",
                "when": {
                    "eq": {
                        "alvo": [
                            "fe"
                        ]
                    }
                },
                "title": "Defensoria, MP e Procuradoria puxam a mesma base",
                "paragraphs": [
                    "O quadro de apoio desses órgãos tem prova muito próxima da de tribunal: mesma base de matérias e as mesmas bancas. Por isso o curso de TJ e TRF atende bem esse alvo.",
                    "A diferença fica nas específicas, e isso se resolve no cronograma personalizado quando o edital sair."
                ]
            },
            {
                "id": "alvo_any",
                "when": {
                    "eq": {
                        "alvo": [
                            "any"
                        ]
                    }
                },
                "title": "Você quer o que abrir primeiro, então a base pesa ainda mais",
                "paragraphs": [
                    "Sem alvo fechado, o que te serve é justamente o que se repete em todos: Português, Raciocínio Lógico, Informática, Ética, Constitucional, Administrativo, Civil e Processo Civil aparecem em TRT, TJ e TRF.",
                    "Ainda assim eu escolheria um curso pra guiar o cronograma, porque as específicas divergem: no TRT são 12 disciplinas, com Trabalho e Processo do Trabalho; em TJ e TRF são 16, com Penal e Processo Penal no meio."
                ]
            }
        ]
    },
    {
        "group": "Cargo e formação",
        "items": [
            {
                "id": "tec_sup",
                "when": {
                    "eq": {
                        "cargo": [
                            "tecnico"
                        ],
                        "formacao": [
                            "direito",
                            "outra"
                        ]
                    },
                    "ne": {
                        "alvo": [
                            "fe"
                        ]
                    }
                },
                "title": "Com curso superior, analista deveria estar no seu radar",
                "paragraphs": [
                    "Analista paga quase o dobro do técnico e cai sobre a mesma base de matérias, com mais profundidade nas jurídicas. E tem um detalhe que economiza tempo: quem estuda pra analista estuda também o que cai pra técnico, então dá pra manter as duas portas abertas com um material só.",
                    "Se você ainda não fez essa conta, vale fazer antes de fechar o seu plano."
                ]
            },
            {
                "id": "unsure",
                "when": {
                    "eq": {
                        "cargo": [
                            "unsure"
                        ]
                    }
                },
                "title": "Você ainda não escolheu o cargo, e isso dá pra resolver hoje",
                "paragraphs": [
                    "Resumo rápido. Técnico é nível médio, faz o trabalho de apoio do processo e tem prova mais rasa nas jurídicas. Analista é nível superior, salário bem maior e prova mais profunda: a área judiciária costuma exigir bacharel em Direito e as outras áreas aceitam formações diversas. Oficial de justiça, na maioria dos tribunais, é uma especialidade de analista, com o mesmo patamar de salário e mais Processo Civil na prova.",
                    "Como a base de matérias é a mesma, dá pra começar hoje e fechar a escolha quando o edital sair."
                ]
            },
            {
                "id": "oficial",
                "when": {
                    "eq": {
                        "cargo": [
                            "oficial"
                        ]
                    }
                },
                "title": "Oficial de justiça é prova de analista com peso extra em Processo Civil",
                "paragraphs": [
                    "Na maior parte dos tribunais, oficial de justiça é uma especialidade dentro do cargo de analista: mesma exigência de nível superior, mesmo patamar de salário, e prova puxando mais em Processo Civil, porque é ali que estão citação, intimação, penhora e mandado.",
                    "Ou seja, a sua base é a de analista. Estudar como analista te deixa com as duas portas abertas."
                ]
            },
            {
                "id": "cursando_dir",
                "when": {
                    "eq": {
                        "formacao": [
                            "cursando_direito"
                        ]
                    }
                },
                "title": "Cursando Direito, você está no melhor momento possível",
                "paragraphs": [
                    "As matérias da faculdade e as do concurso se sobrepõem bastante, então o que você estuda serve pra dupla função. A diferença é o recorte: a faculdade cobra teoria e a banca cobra aplicação, e é a questão de concurso que ajusta essa mira.",
                    "Um ponto prático: o diploma costuma ser exigido só na posse, e a regra sai em cada edital. Dá pra construir a base antes de colar grau e chegar pronto."
                ]
            },
            {
                "id": "outra_area",
                "when": {
                    "eq": {
                        "formacao": [
                            "outra",
                            "cursando_outra"
                        ]
                    }
                },
                "title": "Sem ser da área do Direito, o caminho existe e tem nome",
                "paragraphs": [
                    "Você não precisa ser bacharel pra entrar num tribunal. As áreas administrativa e de apoio especializado do cargo de analista costumam aceitar qualquer curso superior, e a área judiciária é a que pede Direito.",
                    "Na prática isso muda as específicas, não a base: Português, Raciocínio Lógico, Informática, Constitucional e Administrativo continuam sendo o coração da prova. Vale confirmar isso com o consultor antes de escolher o curso, pra você não estudar específica que não vai precisar."
                ]
            }
        ]
    },
    {
        "group": "Relação com o VDE",
        "items": [
            {
                "id": "v_aluno",
                "when": {
                    "eq": {
                        "vde": [
                            "aluno"
                        ]
                    }
                },
                "title": "Você já é aluno do VDE Concursos",
                "paragraphs": [
                    "Então metade do caminho está resolvida: você conhece o formato e sabe que ele funciona pra você. O que a conversa com o consultor resolve é o encaixe entre o que você já tem e o VDE Tribunais, pra você não pagar duas vezes pelo mesmo conteúdo nem deixar buraco no meio."
                ]
            },
            {
                "id": "v_ex",
                "when": {
                    "eq": {
                        "vde": [
                            "exaluno"
                        ]
                    }
                },
                "title": "Você já estudou com a gente antes",
                "paragraphs": [
                    "Então já sabe como é: PDF direto ao ponto, lei e questão, sem enrolação. O VDE Tribunais é essa mesma lógica calibrada pro nível de tribunal, que é mais profundo nas jurídicas. Menciona que você é ex-aluno na conversa com o consultor."
                ]
            },
            {
                "id": "v_insta",
                "when": {
                    "eq": {
                        "vde": [
                            "insta"
                        ]
                    }
                },
                "title": "Você me acompanha no Instagram",
                "paragraphs": [
                    "Então já viu o método pela janela. A diferença entre o que eu posto e o curso é ordem e profundidade: no Instagram cabe o tema solto, no curso cabe a sequência inteira, com cronograma, lei, questão comentada e simulado mensal."
                ]
            },
            {
                "id": "v_nunca",
                "when": {
                    "eq": {
                        "vde": [
                            "nunca"
                        ]
                    }
                },
                "title": "Você chegou aqui sem me conhecer, então deixa eu me apresentar rápido",
                "paragraphs": [
                    "VDE é Vício de uma Estudante, e o método tem cinco passos. Você abre o cronograma e vê o tema do dia, lê a teoria sistematizada em PDF, lê o caderno de leis e informativos daquele tema, resolve questões comentadas do mesmo tema e, nas não jurídicas, assiste a videoaula se precisar. Todo mês tem simulado com análise de desempenho, e a Vic.IA, treinada só com os nossos materiais, responde dúvida na hora.",
                    "É isso. Sem maratona de videoaula e sem material genérico de concurso."
                ]
            }
        ]
    }
]
