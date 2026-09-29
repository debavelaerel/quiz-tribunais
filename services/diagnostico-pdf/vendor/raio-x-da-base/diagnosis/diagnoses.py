"""O diagnóstico principal, escolhido pela última pergunta do quiz.

`ordem` só entra no laudo se o lead pediu na tela 22.
"""

DIAGNOSES = {
    "zero": {
        "titulo": "Você está no melhor momento pra fazer a coisa certa desde o início.",
        "texto": [
            "Quem começa sem base pula de videoaula em videoaula e, daqui a dois anos, responde este mesmo quiz marcando “estudo há um tempo e fico perdido”. Eu vejo isso todo dia.",
            "O que decide o seu caso é ordem. Uma base comum bem construída, Português, Constitucional e Administrativo, vem antes de qualquer matéria específica, porque é essa base que cai em todo tribunal do país."
        ],
        "prescricao": "escolher um ritmo de cronograma que caiba no seu dia real, começar por Língua Portuguesa e Direito Constitucional, e resolver questões de FGV e FCC desde a primeira semana, mesmo errando.",
        "ordem": [
            "Base comum: Português, Constitucional e Administrativo, nessa ordem.",
            "Questões da banca desde a primeira semana, com caderno de erros.",
            "Só depois as específicas do seu tribunal.",
            "Revisão programada, não revisão quando der."
        ]
    },
    "sembase": {
        "titulo": "Você já pagou o preço de estudar sem estrutura.",
        "texto": [
            "Horas investidas e a sensação de que nada fixa. Falta sequência, e esforço sozinho não compra sequência. A cada edital você recomeça, porque nenhum alicerce sobreviveu do concurso anterior.",
            "Fonte nova só adia. O que resolve é fechar um único caminho e medir o seu avanço por questão resolvida em cada matéria, com número na mão."
        ],
        "prescricao": "parar de acumular fontes, fechar um único cronograma de formação de base e medir o progresso por questões acertadas por matéria, semana a semana.",
        "ordem": [
            "Escolher uma fonte por matéria e abandonar as outras.",
            "Fechar a base comum em sequência, sem pular.",
            "Questões comentadas da FGV e da FCC como termômetro semanal.",
            "Específicas do seu tribunal só com a base fechada."
        ]
    },
    "plato": {
        "titulo": "O seu ponto vaza sempre no mesmo lugar.",
        "texto": [
            "Quem para a três questões do corte não sabe menos que o aprovado. Erra em lugares específicos e repete os mesmos lugares em toda prova. Enquanto esses lugares não têm nome, a nota fica parada.",
            "Mais horas costumam ir justamente pro que você já domina, e por isso a nota fica onde está. Abrir as suas provas e tratar o vazamento onde ele acontece é o que destrava."
        ],
        "prescricao": "abrir o espelho da sua última prova e separar o que você errou por não saber o conteúdo do que errou por ler o enunciado errado. São dois problemas diferentes, e tratar os dois do mesmo jeito é o que sustenta o platô.",
        "ordem": [
            "Separar erro de conteúdo de erro de leitura de enunciado.",
            "Erro de conteúdo: teoria curta e questão da mesma banca, no assunto exato.",
            "Erro de leitura: treino cronometrado, não mais teoria.",
            "Matéria forte entra só em revisão, nunca em reestudo."
        ]
    },
    "improviso": {
        "titulo": "Você estuda no modo edital.",
        "texto": [
            "Sai o concurso, corre, faz a prova, para. O curso de reta final é ótimo pra quem já tem base, e péssimo pra quem ainda está construindo. Enquanto o ciclo não quebrar, cada edital vai te encontrar no mesmo lugar.",
            "A boa notícia: tribunal abre o ano inteiro. São 27 TJs, 6 TRFs e 24 TRTs em rodízio, e a base de matérias é a mesma. Quem constrói essa base uma vez aproveita em todos."
        ],
        "prescricao": "estudar agora, sem edital publicado, a base comum que cai em todo tribunal, pra que o próximo edital te encontre revisando, e não começando.",
        "ordem": [
            "Cronograma de base independente de edital, com data de fim.",
            "Base comum primeiro: Português, Constitucional, Administrativo.",
            "Questões da banca como rotina, não como véspera.",
            "Quando o edital sair, só ajustar as específicas e revisar."
        ]
    },
    "servidor": {
        "titulo": "Você já provou que sabe passar.",
        "texto": [
            "O salto de técnico pra analista é de profundidade jurídica. A prova cobra Civil, Processo Civil, Penal e Processo Penal num nível que a prova de técnico não cobrava, e a FGV e a FCC gostam de caso concreto.",
            "Recomeçar do zero seria desperdício. O seu caso pede um cronograma que aproveite o que já está de pé e concentre o esforço nas específicas de analista."
        ],
        "prescricao": "manter as matérias que já sustentam a sua nota com revisão leve e montar um cronograma focado nas específicas de analista, resolvendo questões de analista desde a primeira semana.",
        "ordem": [
            "Diagnóstico do que já está sólido da base comum.",
            "Específicas de analista em sequência: Civil, Processo Civil, Penal, Processo Penal.",
            "Questões de analista da banca, não de técnico.",
            "Revisão leve das matérias já dominadas."
        ]
    }
}
