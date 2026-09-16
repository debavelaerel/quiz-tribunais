# Os resultados do Raio-X da Base

Gerado de `diagnosis/diagnoses.py` por `python3 _build/build-diagnosticos.py`.
Editar sempre lá, nunca aqui: este arquivo é sobrescrito.

O quiz tem 12 perguntas, 4 questões de prova e uma pergunta final de preferência. O resultado que o lead recebe é montado em três camadas: a leitura do caso (um dos cinco cenários abaixo), o plano de ação, e o ponto a ponto das respostas.

## Como o resultado é montado

- **A leitura do caso.** Vem inteira da última pergunta do quiz, **Última: qual dessas frases você diria pra um amigo hoje?**. Cada uma das cinco respostas abre um cenário, e o cenário traz título, texto e ação imediata prontos. Nenhuma outra resposta muda esse texto.
- **O plano de ação.** São os passos numerados do mesmo cenário. Só entram no laudo se, na pergunta **Quer que eu inclua no seu resultado o que priorizar no seu momento?**, o lead marcar **Inclui, por favor**. Quem marca **Só o diagnóstico já basta** recebe o cenário sem os passos.
- **O curso indicado.** Sai só da primeira pergunta, o concurso alvo. TRT abre o Curso 1 (Analista de TRT, 168 temas); TJ, TRF, Defensoria/MP/Procuradoria e "qualquer tribunal" abrem o Curso 2 (Analista de TJ e TRF, 231 temas).
- **O ritmo.** Sai só das horas por dia: **Menos de 1 hora** = abaixo do cronograma mínimo; com 2h por dia, base em 12 meses; **Entre 1 e 2 horas** = base em 12 meses, no ritmo de 2h por dia; **Entre 2 e 3 horas** = base entre 8 e 12 meses; **Entre 3 e 4 horas** = base entre 6 e 8 meses; **Mais de 4 horas** = base em 6 meses.
- **O nível.** Sai só dos acertos nas quatro questões: **0 de 4** = inicial; **1 de 4** = inicial; **2 de 4** = intermediário; **3 de 4** = avançado; **4 de 4** = avançado.
- **O ponto a ponto.** São 46 textos condicionais, um por grupo de pergunta, com regras próprias. Estão documentados em `respostas-diagnostico.md`, gerado de `diagnosis/blocks.py`.

---

## Cenário 1 · Começo do zero

`#zero`

**Dispara quando:** na pergunta *“Última: qual dessas frases você diria pra um amigo hoje?”* o lead marca **“Estou começando do zero, ainda me organizando”**. É a única resposta que escolhe este resultado.

### Título

Você está no melhor momento pra fazer a coisa certa desde o início.

### Texto do diagnóstico

Quem começa sem base pula de videoaula em videoaula e, daqui a dois anos, responde este mesmo quiz marcando “estudo há um tempo e fico perdido”. Eu vejo isso todo dia.

O que decide o seu caso é ordem. Uma base comum bem construída, Português, Constitucional e Administrativo, vem antes de qualquer matéria específica, porque é essa base que cai em todo tribunal do país.

### Ação imediata

**Começa por aqui:** escolher um ritmo de cronograma que caiba no seu dia real, começar por Língua Portuguesa e Direito Constitucional, e resolver questões de FGV e FCC desde a primeira semana, mesmo errando.

### Plano de ação

Sai no laudo sob o título *“A ordem que eu seguiria no seu lugar”*, e só quando o lead pede na última tela.

1. Base comum: Português, Constitucional e Administrativo, nessa ordem.
2. Questões da banca desde a primeira semana, com caderno de erros.
3. Só depois as específicas do seu tribunal.
4. Revisão programada, não revisão quando der.

**Exemplo gerado:** `exemplos/01-iniciante-do-zero.pdf` · Camila Nogueira, começando agora, sem método e sem prova feita.

**Exemplo gerado:** `exemplos/07-medo-das-nao-juridicas.pdf` · Thiago Correia, começou há pouco e tem medo de Português, RLM e Informática.

---

## Cenário 2 · Estudo sem base

`#sembase`

**Dispara quando:** na pergunta *“Última: qual dessas frases você diria pra um amigo hoje?”* o lead marca **“Estudo há um tempo, mas sem base sólida: fico perdido no meio das matérias”**. É a única resposta que escolhe este resultado.

### Título

Você já pagou o preço de estudar sem estrutura.

### Texto do diagnóstico

Horas investidas e a sensação de que nada fixa. Falta sequência, e esforço sozinho não compra sequência. A cada edital você recomeça, porque nenhum alicerce sobreviveu do concurso anterior.

Fonte nova só adia. O que resolve é fechar um único caminho e medir o seu avanço por questão resolvida em cada matéria, com número na mão.

### Ação imediata

**Começa por aqui:** parar de acumular fontes, fechar um único cronograma de formação de base e medir o progresso por questões acertadas por matéria, semana a semana.

### Plano de ação

Sai no laudo sob o título *“A ordem que eu seguiria no seu lugar”*, e só quando o lead pede na última tela.

1. Escolher uma fonte por matéria e abandonar as outras.
2. Fechar a base comum em sequência, sem pular.
3. Questões comentadas da FGV e da FCC como termômetro semanal.
4. Específicas do seu tribunal só com a base fechada.

**Exemplo gerado:** `exemplos/05-qualquer-tribunal.pdf` · Letícia Barros, quer o que abrir primeiro, formada em outra área, muito tempo por dia.

**Exemplo gerado:** `exemplos/06-funcoes-essenciais.pdf` · Bianca Sales, defensoria na mira, nunca fez prova, não sabe a diferença entre os cargos.

**Exemplo gerado:** `exemplos/08-todas-as-dores.pdf` · Patrícia Menezes, cinco anos de estudo, várias provas longe do corte, marcou todas as dores.

---

## Cenário 3 · Veterano travado no corte

`#plato`

**Dispara quando:** na pergunta *“Última: qual dessas frases você diria pra um amigo hoje?”* o lead marca **“Chego perto do corte e não passo, prova atrás de prova”**. É a única resposta que escolhe este resultado.

### Título

O seu ponto vaza sempre no mesmo lugar.

### Texto do diagnóstico

Quem para a três questões do corte não sabe menos que o aprovado. Erra em lugares específicos e repete os mesmos lugares em toda prova. Enquanto esses lugares não têm nome, a nota fica parada.

Mais horas costumam ir justamente pro que você já domina, e por isso a nota fica onde está. Abrir as suas provas e tratar o vazamento onde ele acontece é o que destrava.

### Ação imediata

**Começa por aqui:** abrir o espelho da sua última prova e separar o que você errou por não saber o conteúdo do que errou por ler o enunciado errado. São dois problemas diferentes, e tratar os dois do mesmo jeito é o que sustenta o platô.

### Plano de ação

Sai no laudo sob o título *“A ordem que eu seguiria no seu lugar”*, e só quando o lead pede na última tela.

1. Separar erro de conteúdo de erro de leitura de enunciado.
2. Erro de conteúdo: teoria curta e questão da mesma banca, no assunto exato.
3. Erro de leitura: treino cronometrado, não mais teoria.
4. Matéria forte entra só em revisão, nunca em reestudo.

**Exemplo gerado:** `exemplos/02-veterano-no-corte.pdf` · Rafael Andrade, para perto do corte prova atrás de prova, e marcou três editais.

---

## Cenário 4 · Ciclo do improviso

`#improviso`

**Dispara quando:** na pergunta *“Última: qual dessas frases você diria pra um amigo hoje?”* o lead marca **“Só estudo quando sai edital, e recomeço do zero toda vez”**. É a única resposta que escolhe este resultado.

### Título

Você estuda no modo edital.

### Texto do diagnóstico

Sai o concurso, corre, faz a prova, para. O curso de reta final é ótimo pra quem já tem base, e péssimo pra quem ainda está construindo. Enquanto o ciclo não quebrar, cada edital vai te encontrar no mesmo lugar.

A boa notícia: tribunal abre o ano inteiro. São 27 TJs, 6 TRFs e 24 TRTs em rodízio, e a base de matérias é a mesma. Quem constrói essa base uma vez aproveita em todos.

### Ação imediata

**Começa por aqui:** estudar agora, sem edital publicado, a base comum que cai em todo tribunal, pra que o próximo edital te encontre revisando, e não começando.

### Plano de ação

Sai no laudo sob o título *“A ordem que eu seguiria no seu lugar”*, e só quando o lead pede na última tela.

1. Cronograma de base independente de edital, com data de fim.
2. Base comum primeiro: Português, Constitucional, Administrativo.
3. Questões da banca como rotina, não como véspera.
4. Quando o edital sair, só ajustar as específicas e revisar.

**Exemplo gerado:** `exemplos/03-reta-final-tecnico.pdf` · Juliana Peixoto, prova em menos de 3 meses, mira técnico tendo curso superior.

---

## Cenário 5 · Servidor em ascensão

`#servidor`

**Dispara quando:** na pergunta *“Última: qual dessas frases você diria pra um amigo hoje?”* o lead marca **“Já sou servidor(a) e quero subir pra analista”**. É a única resposta que escolhe este resultado.

### Título

Você já provou que sabe passar.

### Texto do diagnóstico

O salto de técnico pra analista é de profundidade jurídica. A prova cobra Civil, Processo Civil, Penal e Processo Penal num nível que a prova de técnico não cobrava, e a FGV e a FCC gostam de caso concreto.

Recomeçar do zero seria desperdício. O seu caso pede um cronograma que aproveite o que já está de pé e concentre o esforço nas específicas de analista.

### Ação imediata

**Começa por aqui:** manter as matérias que já sustentam a sua nota com revisão leve e montar um cronograma focado nas específicas de analista, resolvendo questões de analista desde a primeira semana.

### Plano de ação

Sai no laudo sob o título *“A ordem que eu seguiria no seu lugar”*, e só quando o lead pede na última tela.

1. Diagnóstico do que já está sólido da base comum.
2. Específicas de analista em sequência: Civil, Processo Civil, Penal, Processo Penal.
3. Questões de analista da banca, não de técnico.
4. Revisão leve das matérias já dominadas.

**Exemplo gerado:** `exemplos/04-servidor-em-ascensao.pdf` · Marcos Vinícius Leal, já é servidor e quer subir para oficial de justiça.

---
