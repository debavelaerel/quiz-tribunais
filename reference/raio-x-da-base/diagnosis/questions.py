"""Perguntas, opções e editais do quiz.

GERADO por _build/gen-questions.py a partir de _build/index.src.html.
Não editar à mão: rode o gerador depois de mexer nas perguntas.
"""

QUESTIONS = {
    "alvo": {
        "tipo": "single",
        "titulo": "Qual concurso é a sua prioridade hoje?",
        "opcoes": [
            [
                "tj",
                "Tribunal de Justiça (TJ)",
                "o tribunal estadual"
            ],
            [
                "trf",
                "Tribunal Regional Federal (TRF)"
            ],
            [
                "trt",
                "Tribunal Regional do Trabalho (TRT)"
            ],
            [
                "fe",
                "Defensoria, Ministério Público ou Procuradoria",
                "cargo de analista ou técnico, servidor de apoio"
            ],
            [
                "any",
                "Qualquer tribunal, o que abrir primeiro"
            ],
            [
                "juridica",
                "Carreira jurídica",
                "juiz, promotor, defensor ou procurador"
            ],
            [
                "outro",
                "Outro concurso, fora dos tribunais"
            ]
        ]
    },
    "cargo": {
        "tipo": "single",
        "titulo": "Qual cargo você mira?",
        "opcoes": [
            [
                "analista",
                "Analista judiciário"
            ],
            [
                "oficial",
                "Oficial de justiça"
            ],
            [
                "tecnico",
                "Técnico judiciário"
            ],
            [
                "escrevente",
                "Escrevente"
            ],
            [
                "any",
                "O que vier, quero entrar no tribunal"
            ],
            [
                "unsure",
                "Ainda não sei a diferença entre eles"
            ]
        ]
    },
    "cargo_fe": {
        "tipo": "single",
        "titulo": "Qual cargo você mira?",
        "opcoes": [
            [
                "analista",
                "Analista",
                "nível superior"
            ],
            [
                "tecnico",
                "Técnico",
                "nível médio"
            ],
            [
                "any",
                "O que vier, quero entrar no órgão"
            ],
            [
                "unsure",
                "Ainda não sei a diferença entre eles"
            ]
        ]
    },
    "formacao": {
        "tipo": "single",
        "titulo": "Qual é a sua formação hoje?",
        "opcoes": [
            [
                "direito",
                "Bacharel em Direito"
            ],
            [
                "cursando_direito",
                "Cursando Direito"
            ],
            [
                "outra",
                "Superior completo em outra área"
            ],
            [
                "cursando_outra",
                "Cursando outra área"
            ],
            [
                "medio",
                "Ensino médio completo"
            ]
        ]
    },
    "tempo": {
        "tipo": "single",
        "titulo": "Há quanto tempo você estuda pra concursos?",
        "opcoes": [
            [
                "t0",
                "Ainda não comecei"
            ],
            [
                "t1",
                "Menos de 6 meses"
            ],
            [
                "t2",
                "Entre 6 meses e 1 ano"
            ],
            [
                "t3",
                "Entre 1 e 2 anos"
            ],
            [
                "t4",
                "Entre 2 e 4 anos"
            ],
            [
                "t5",
                "Mais de 4 anos"
            ]
        ]
    },
    "provas": {
        "tipo": "single",
        "titulo": "Quantas provas de tribunal você já fez, e como foi?",
        "opcoes": [
            [
                "p0",
                "Nunca fiz uma prova de tribunal"
            ],
            [
                "p1",
                "Fiz uma ou duas e fiquei longe do corte"
            ],
            [
                "p2",
                "Fiz várias e continuo longe do corte"
            ],
            [
                "p3",
                "Fico perto do corte, mas não passo"
            ],
            [
                "p4",
                "Já fui aprovado(a) em algum tribunal e quero subir de cargo"
            ]
        ]
    },
    "metodo": {
        "tipo": "single",
        "titulo": "Como você estudou até aqui?",
        "opcoes": [
            [
                "nenhum",
                "Nunca estudei com método, vou no improviso"
            ],
            [
                "video",
                "Videoaulas de cursinho grande, muitas horas de vídeo"
            ],
            [
                "pdf",
                "PDF e questões, com cronograma"
            ],
            [
                "questoes",
                "Só questões"
            ],
            [
                "retafinal",
                "Só quando sai edital, com curso de reta final"
            ],
            [
                "mentoria",
                "Mentoria ou coaching"
            ]
        ]
    },
    "vde": {
        "tipo": "single",
        "titulo": "Você já conhece o Método VDE?",
        "opcoes": [
            [
                "nunca",
                "Nunca ouvi falar"
            ],
            [
                "insta",
                "Sigo no Instagram, mas nunca estudei com vocês"
            ],
            [
                "exaluno",
                "Já fui aluno(a) da OAB ou de outro curso do VDE"
            ],
            [
                "aluno",
                "Já sou aluno(a) do VDE Concursos"
            ]
        ]
    },
    "horas": {
        "tipo": "single",
        "titulo": "Quantas horas por dia você consegue estudar, sendo realista?",
        "opcoes": [
            [
                "h0",
                "Menos de 1 hora"
            ],
            [
                "h1",
                "Entre 1 e 2 horas"
            ],
            [
                "h2",
                "Entre 2 e 3 horas"
            ],
            [
                "h3",
                "Entre 3 e 4 horas"
            ],
            [
                "h4",
                "Mais de 4 horas"
            ]
        ]
    },
    "edital": {
        "tipo": "single",
        "titulo": "Você tem edital na mira?",
        "opcoes": [
            [
                "reta",
                "Já saiu, e a prova é em menos de 3 meses"
            ],
            [
                "previsto",
                "Tem edital previsto pros próximos meses"
            ],
            [
                "sem",
                "Não tenho um edital específico: quero estar pronto quando abrir"
            ],
            [
                "nao",
                "Não acompanho as previsões"
            ]
        ]
    },
    "editais": {
        "tipo": "multi",
        "titulo": "Estes são os concursos que estão na fila pra sair. Em qual deles você quer estar pronto?",
        "opcoes": [
            [
                "qualquer",
                "Qualquer um, quero estar pronto quando abrir"
            ]
        ]
    },
    "dor": {
        "tipo": "single",
        "titulo": "Qual é o seu maior gargalo hoje?",
        "opcoes": [
            [
                "base",
                "Não tenho base: sinto que começo do zero a cada edital"
            ],
            [
                "improviso",
                "Estudo no improviso, sem cronograma nem ordem"
            ],
            [
                "tempo",
                "Pouco tempo: concilio estudo com trabalho"
            ],
            [
                "naojur",
                "Medo das matérias não jurídicas: Português, RLM, Informática"
            ],
            [
                "fixar",
                "Leio muito e resolvo pouco: não fixo"
            ],
            [
                "banca",
                "Não sei o que a FGV e a FCC cobram de verdade"
            ],
            [
                "emocional",
                "O emocional sabota: ansiedade, comparação, sensação de atraso"
            ],
            [
                "todas",
                "Todas acima"
            ]
        ]
    },
    "momento": {
        "tipo": "single",
        "titulo": "Última: qual dessas frases você diria pra um amigo hoje?",
        "opcoes": [
            [
                "zero",
                "Estou começando do zero, ainda me organizando"
            ],
            [
                "sembase",
                "Estudo há um tempo, mas sem base sólida: fico perdido no meio das matérias"
            ],
            [
                "plato",
                "Chego perto do corte e não passo, prova atrás de prova"
            ],
            [
                "improviso",
                "Só estudo quando sai edital, e recomeço do zero toda vez"
            ],
            [
                "servidor",
                "Já sou servidor(a) e quero subir pra analista"
            ]
        ]
    },
    "dinheiro": {
        "tipo": "single",
        "titulo": "Quanto você receberia a mais por mês se fosse aprovado(a) hoje no cargo que você mira?",
        "opcoes": [
            [
                "60",
                "Uns R$ 5 mil a mais por mês",
                "R$ 60 mil por ano"
            ],
            [
                "96",
                "Uns R$ 8 mil a mais por mês",
                "R$ 96 mil por ano"
            ],
            [
                "120",
                "Uns R$ 10 mil a mais por mês",
                "R$ 120 mil por ano"
            ],
            [
                "156",
                "Uns R$ 13 mil a mais por mês",
                "R$ 156 mil por ano"
            ],
            [
                "192",
                "R$ 16 mil ou mais a mais por mês",
                "R$ 192 mil por ano"
            ]
        ]
    },
    "leitura": {
        "tipo": "single",
        "titulo": "Quer que eu inclua no seu resultado o que priorizar no seu momento?",
        "opcoes": [
            [
                "completa",
                "Inclui, por favor"
            ],
            [
                "basica",
                "Só o diagnóstico já basta"
            ]
        ]
    }
}

EDITAIS = {
    "tj": [
        {
            "id": "tjgo",
            "label": "TJ GO",
            "sub": "concurso autorizado para analista judiciário, área judiciária e de apoio"
        },
        {
            "id": "tjam",
            "label": "TJ AM",
            "sub": "cerca de 400 vagas anunciadas pelo tribunal"
        },
        {
            "id": "tjto",
            "label": "TJ TO",
            "sub": "banca em contratação; 331 cargos vagos, 117 de analista"
        },
        {
            "id": "tjal",
            "label": "TJ AL",
            "sub": "comissão formada para analista, oficial de justiça avaliador"
        },
        {
            "id": "tjrs",
            "label": "TJ RS",
            "sub": "comissão formada para analista do Poder Judiciário"
        },
        {
            "id": "tjpb",
            "label": "TJ PB",
            "sub": "comissão formada"
        },
        {
            "id": "tjsp",
            "label": "TJ SP",
            "sub": "em estudos para escrevente e oficial de justiça"
        }
    ],
    "trf": [
        {
            "id": "trf3",
            "label": "TRF3 (SP e MS)",
            "sub": "edital iminente para analista judiciário, área judiciária; banca prevista para 2026"
        }
    ],
    "trt": [
        {
            "id": "trt8",
            "label": "TRT8 (PA e AP)",
            "sub": "banca definida (FCC), edital iminente para técnico e analista"
        },
        {
            "id": "trt4",
            "label": "TRT4 (RS)",
            "sub": "autorizado, comissão formada, banca em contratação"
        },
        {
            "id": "trt23",
            "label": "TRT23 (MT)",
            "sub": "autorizado pelo Pleno, edital esperado ainda em 2026"
        },
        {
            "id": "trt3",
            "label": "TRT3 (MG)",
            "sub": "previsto para 2026, com até 444 vacâncias"
        },
        {
            "id": "trt22",
            "label": "TRT22 (PI)",
            "sub": "previsto após dezembro de 2026"
        }
    ],
    "fe": [
        {
            "id": "dpu",
            "label": "DPU",
            "sub": "810 vagas previstas na LOA 2026, analista e técnico"
        },
        {
            "id": "dpema",
            "label": "DPE MA",
            "sub": "primeiro concurso de servidores, previsto para 2026"
        },
        {
            "id": "pgeba",
            "label": "PGE BA",
            "sub": "banca definida, 115 vagas de analista e assistente"
        },
        {
            "id": "pgerj",
            "label": "PGE RJ",
            "sub": "autorizado para analista"
        }
    ]
}

TEST = [
    {
        "disc": "Língua Portuguesa",
        "fonte": "FGV · TJ RR 2024 · Analista Judiciário",
        "gabarito": "C",
        "comentario": "Só a C dá o nome certo à relação: \"quando\" marca tempo. A é condição, B é oposição, D e E são comparação."
    },
    {
        "disc": "Direito Constitucional",
        "fonte": "FGV · TJ RR 2024 · Analista Judiciário",
        "gabarito": "C",
        "comentario": "GLP é energia, e energia é competência privativa da União. A roupagem de defesa do consumidor não transfere a competência."
    },
    {
        "disc": "Direito Processual Civil",
        "fonte": "FGV · TJ RR 2024 · Analista Judiciário",
        "gabarito": "B",
        "comentario": "Averbada a execução no registro do imóvel, a alienação posterior presume-se em fraude. O carro de trabalho é impenhorável, o de lazer não, e o prazo para pagar é de 3 dias."
    },
    {
        "disc": "Raciocínio Lógico",
        "fonte": "FCC · TRF4 2019 · Oficial de Justiça Avaliador Federal",
        "gabarito": "A",
        "comentario": "A morena não é Ana nem Beatriz, então é Carla. Ana não é ruiva, logo é loira. E a loira não é de Jaime nem de Jairo: sobra José."
    }
]

CONFIG = {
    "quizName": "Raio-X da Base",
    "whatsapp": "5500000000000",
    "videoSrc": "",
    "leadEndpoint": "",
    "editaisAtualizadosEm": "3 de setembro de 2026",
    "instagram": "https://www.instagram.com/vdeconcursos/"
}
