// Conteúdo do funil "Diagnóstico da Base" (VDE Tribunais) — perguntas de
// perfilamento, editais em andamento, rótulos e diagnósticos por momento.
// Adaptado do funil de referência (mesmo texto, mesma lógica de ramificação),
// só reestruturado como dados tipados para o motor de telas do Quiz.tsx.

import type { RespostasPerfil } from './perfil'

export const CONFIG = {
  quizName: 'Diagnóstico da Base',
  // Placeholder — trocar pelo número real do time de consultores antes de publicar de verdade.
  whatsapp: '5500000000000',
  // Embed do Panda Video — vídeo da Ana Clara na tela 'video' do funil.
  videoSrc: 'https://player-vz-246ae85e-308.tv.pandavideo.com.br/embed/?v=ceeffaff-3a26-4b53-ae04-2e52a05106e4',
  editaisAtualizadosEm: '3 de setembro de 2026',
  instagram: 'https://www.instagram.com/vdeconcursos/',
}

export type Edital = { id: string; label: string; sub: string }

export const EDITAIS: Record<string, Edital[]> = {
  tj: [
    { id: 'tjgo', label: 'TJ GO', sub: 'concurso autorizado para analista judiciário, área judiciária e de apoio' },
    { id: 'tjam', label: 'TJ AM', sub: 'cerca de 400 vagas anunciadas pelo tribunal' },
    { id: 'tjto', label: 'TJ TO', sub: 'banca em contratação; 331 cargos vagos, 117 de analista' },
    { id: 'tjal', label: 'TJ AL', sub: 'comissão formada para analista, oficial de justiça avaliador' },
    { id: 'tjrs', label: 'TJ RS', sub: 'comissão formada para analista do Poder Judiciário' },
    { id: 'tjpb', label: 'TJ PB', sub: 'comissão formada' },
    { id: 'tjsp', label: 'TJ SP', sub: 'em estudos para escrevente e oficial de justiça' },
  ],
  trf: [
    { id: 'trf3', label: 'TRF3 (SP e MS)', sub: 'edital iminente para analista judiciário, área judiciária; banca prevista para 2026' },
  ],
  trt: [
    { id: 'trt8', label: 'TRT8 (PA e AP)', sub: 'banca definida (FCC), edital iminente para técnico e analista' },
    { id: 'trt4', label: 'TRT4 (RS)', sub: 'autorizado, comissão formada, banca em contratação' },
    { id: 'trt23', label: 'TRT23 (MT)', sub: 'autorizado pelo Pleno, edital esperado ainda em 2026' },
    { id: 'trt3', label: 'TRT3 (MG)', sub: 'previsto para 2026, com até 444 vacâncias' },
    { id: 'trt22', label: 'TRT22 (PI)', sub: 'previsto após dezembro de 2026' },
  ],
  fe: [
    { id: 'dpu', label: 'DPU', sub: '810 vagas previstas na LOA 2026, analista e técnico' },
    { id: 'dpema', label: 'DPE MA', sub: 'primeiro concurso de servidores, previsto para 2026' },
    { id: 'pgeba', label: 'PGE BA', sub: 'banca definida, 115 vagas de analista e assistente' },
    { id: 'pgerj', label: 'PGE RJ', sub: 'autorizado para analista' },
  ],
}
EDITAIS.any = [...EDITAIS.trt.slice(0, 2), ...EDITAIS.trf, ...EDITAIS.tj.slice(0, 3)]

export const L = {
  alvo: { tj: 'TJ', trf: 'TRF', trt: 'TRT', fe: 'Defensoria, MP ou Procuradoria', any: 'qualquer tribunal', juridica: 'carreira jurídica', outro: 'outro concurso' } as Record<string, string>,
  alvoLongo: { tj: 'um Tribunal de Justiça', trf: 'um Tribunal Regional Federal', trt: 'um Tribunal Regional do Trabalho', fe: 'um órgão das funções essenciais à justiça', any: 'o primeiro tribunal que abrir' } as Record<string, string>,
  cargo: { analista: 'analista judiciário', oficial: 'oficial de justiça', tecnico: 'técnico judiciário', escrevente: 'escrevente', any: 'o cargo que vier', unsure: 'um cargo ainda a definir' } as Record<string, string>,
  cargoFe: { analista: 'analista', oficial: 'analista', tecnico: 'técnico', escrevente: 'técnico', any: 'o cargo que vier', unsure: 'um cargo ainda a definir' } as Record<string, string>,
  dorCurta: {
    base: 'sentir que começa do zero a cada edital',
    improviso: 'estudar no improviso, sem cronograma',
    tempo: 'conciliar estudo e trabalho',
    naojur: 'as matérias não jurídicas',
    fixar: 'ler muito e fixar pouco',
    banca: 'não saber o que FGV e FCC cobram de verdade',
    emocional: 'a ansiedade e a sensação de atraso',
    todas: 'um pouco de tudo isso ao mesmo tempo',
  } as Record<string, string>,
  momento: {
    zero: 'Começo do zero',
    sembase: 'Estudo sem base',
    plato: 'Veterano travado no corte',
    improviso: 'Ciclo do improviso',
    servidor: 'Servidor em ascensão',
  } as Record<string, string>,
  horas: {
    h0: 'menos de 1 hora por dia',
    h1: '1 a 2 horas por dia',
    h2: '2 a 3 horas por dia',
    h3: '3 a 4 horas por dia',
    h4: 'mais de 4 horas por dia',
  } as Record<string, string>,
}

export type QuestaoTeste = { disc: string; src: string; ans: string; note: string; enunciado: string; opts: string[] }

// As 4 perguntas REAIS do teste (gabaritos oficiais FGV/FCC). Não confundir
// com o banco de perguntas graduado em lib/questions.ts — este arquivo só
// guarda o texto/apresentação; lib/questions.ts é a fonte de verdade que o
// servidor usa para corrigir (mesmo conteúdo, replicado lá no formato
// {num, area, statement, options, correct, comment} que lib/scoring.ts espera).
export const TESTE: QuestaoTeste[] = [
  {
    disc: 'Língua Portuguesa',
    src: 'FGV · TJ RR 2024 · Analista Judiciário',
    ans: 'C',
    note: 'Só a C dá o nome certo à relação: "quando" marca tempo. A é condição, B é oposição, D e E são comparação.',
    enunciado: 'Assinale a opção em que a relação lógica entre os segmentos da frase se encontra corretamente indicada.',
    opts: [
      'Cave no local em que o ouro está enterrado, / a não ser que você só esteja precisando de exercício. Relação de conformidade.',
      'A fé remove montanhas, / mas os ecologistas são contra. Relação de explicação.',
      'Quando a última árvore for cortada / os homens vão perceber que dinheiro não alimenta. Relação de tempo.',
      'Há flores em todas as estações, / assim como loucuras em todas as idades. Relação de modo.',
      'Os bichos não são tão burros / como se pensa. Relação de causa.',
    ],
  },
  {
    disc: 'Direito Constitucional',
    src: 'FGV · TJ RR 2024 · Analista Judiciário',
    ans: 'C',
    note: 'GLP é energia, e energia é competência privativa da União. A roupagem de defesa do consumidor não transfere a competência.',
    enunciado:
      'Lei distrital determina a pesagem obrigatória, na presença do consumidor, de botijões e cilindros de gás liquefeito de petróleo (GLP), visando exercer proteção e defesa do consumidor. Diante do exposto, é correto afirmar que a referida norma é',
    opts: [
      'constitucional, por observar a competência concorrente dos Estados e do Distrito Federal para legislar sobre defesa do meio ambiente.',
      'inconstitucional, por usurpar a competência dos Municípios sobre matéria de interesse local.',
      'inconstitucional, por usurpar a competência privativa da União para legislar sobre energia.',
      'inconstitucional, por usurpar a competência privativa da União para legislar sobre defesa do consumidor.',
      'constitucional, por observar a competência concorrente dos Estados e do Distrito Federal para legislar sobre defesa do consumidor.',
    ],
  },
  {
    disc: 'Direito Processual Civil',
    src: 'FGV · TJ RR 2024 · Analista Judiciário',
    ans: 'B',
    note: 'Averbada a execução no registro do imóvel, a alienação posterior presume-se em fraude. O carro de trabalho é impenhorável, o de lazer não, e o prazo para pagar é de 3 dias.',
    enunciado:
      'Regina ajuizou ação de execução fundada em título executivo extrajudicial. Após a distribuição, e antes da citação, Regina averbou a pendência do processo no registro de um imóvel de propriedade de João. Após ser citado, com o intuito de esvaziar integralmente seu patrimônio, João alienou o mencionado imóvel, bem como dois veículos: o primeiro, o qual utilizava para trabalhar como motorista de aplicativo de transporte, e outro, usado para lazer e passeios aos finais de semana. Nesse caso, é correto afirmar que',
    opts: [
      'as alienações de bens realizadas são nulas em relação à Regina, que poderá requerer a penhora em relação a todos os bens de propriedade de João.',
      'há fraude à execução em relação à alienação do imóvel, ante a averbação em seu registro da pendência do processo de execução fundada em título extrajudicial.',
      'antes de eventual declaração de fraude à execução, o juiz deverá intimar os terceiros adquirentes para, se quiserem, oporem embargos de terceiro, no prazo de 10 (dez) dias.',
      'ambos os veículos são bens absolutamente impenhoráveis, eis que poderão ser utilizados para que João exerça seu ofício de motorista de aplicativo.',
      'após ser citado, João teve o prazo legal de 5 (cinco) dias para efetuar o pagamento, sob pena de multa e honorários advocatícios de 10% (dez por cento) cada.',
    ],
  },
  {
    disc: 'Raciocínio Lógico',
    src: 'FCC · TRF4 2019 · Oficial de Justiça Avaliador Federal',
    ans: 'A',
    note: 'A morena não é Ana nem Beatriz, então é Carla. Ana não é ruiva, logo é loira. E a loira não é de Jaime nem de Jairo: sobra José.',
    enunciado:
      'Adão tem três primas que moram em outra cidade, Ana, Beatriz e Carla, mas nunca lembra de seus nomes. Ele sabe que uma é loira, uma é ruiva e uma é morena. Cada uma delas é filha de um de seus tios, José, Jaime e Jairo. A mãe de Adão deixou o seguinte bilhete: "A loira não é filha de Jaime nem de Jairo. A morena não é Ana nem Beatriz. Ana não é ruiva. A ruiva não é filha de Jaime." Adão descobriu, corretamente, que:',
    opts: [
      'Ana é loira e filha de José.',
      'Carla é morena e filha de Jairo.',
      'Ana é ruiva e filha de José.',
      'Beatriz é loira e filha de Jairo.',
      'Carla é morena e filha de José.',
    ],
  },
]

export type Diagnostico = {
  titulo: string
  texto: string[]
  prescricao: string
  ordem: string[]
}

export const DIAG: Record<string, Diagnostico> = {
  zero: {
    titulo: 'Você está no melhor momento pra fazer a coisa certa desde o início.',
    texto: [
      'Quem começa sem base pula de videoaula em videoaula e, daqui a dois anos, responde este mesmo quiz marcando "estudo há um tempo e fico perdido". Eu vejo isso todo dia.',
      'O que decide o seu caso é ordem. Um tronco comum bem construído, Português, Constitucional e Administrativo, vem antes de qualquer matéria específica, porque é esse tronco que cai em todo tribunal do país.',
    ],
    prescricao: 'escolher um ritmo de cronograma que caiba no seu dia real, começar por Língua Portuguesa e Direito Constitucional, e resolver questões de FGV e FCC desde a primeira semana, mesmo errando.',
    ordem: [
      'Tronco comum: Português, Constitucional e Administrativo, nessa ordem.',
      'Questões da banca desde a primeira semana, com caderno de erros.',
      'Só depois as específicas do seu tribunal.',
      'Revisão programada, não revisão quando der.',
    ],
  },
  sembase: {
    titulo: 'Você já pagou o preço de estudar sem estrutura.',
    texto: [
      'Horas investidas e a sensação de que nada fixa. Falta sequência, e esforço sozinho não compra sequência. A cada edital você recomeça, porque nenhum alicerce sobreviveu do concurso anterior.',
      'Fonte nova só adia. O que resolve é fechar um único caminho e medir o seu avanço por questão resolvida em cada matéria, com número na mão.',
    ],
    prescricao: 'parar de acumular fontes, fechar um único cronograma de tronco comum e medir o progresso por questões acertadas por matéria, semana a semana.',
    ordem: [
      'Escolher uma fonte por matéria e abandonar as outras.',
      'Fechar o tronco comum em sequência, sem pular.',
      'Questões comentadas da FGV e da FCC como termômetro semanal.',
      'Específicas do seu tribunal só com o tronco fechado.',
    ],
  },
  plato: {
    titulo: 'O seu ponto vaza sempre no mesmo lugar.',
    texto: [
      'Quem para a três questões do corte não sabe menos que o aprovado. Erra em lugares específicos e repete os mesmos lugares em toda prova. Enquanto esses lugares não têm nome, a nota fica parada.',
      'Mais horas costumam ir justamente pro que você já domina, e por isso a nota fica onde está. Abrir as suas provas e tratar o vazamento onde ele acontece é o que destrava.',
    ],
    prescricao: 'abrir o espelho da sua última prova e separar o que você errou por não saber o conteúdo do que errou por ler o enunciado errado. São dois problemas diferentes, e tratar os dois do mesmo jeito é o que sustenta o platô.',
    ordem: [
      'Separar erro de conteúdo de erro de leitura de enunciado.',
      'Erro de conteúdo: teoria curta e questão da mesma banca, no assunto exato.',
      'Erro de leitura: treino cronometrado, não mais teoria.',
      'Matéria forte entra só em revisão, nunca em reestudo.',
    ],
  },
  improviso: {
    titulo: 'Você estuda no modo edital.',
    texto: [
      'Sai o concurso, corre, faz a prova, para. O curso de reta final é ótimo pra quem já tem base, e péssimo pra quem ainda está construindo. Enquanto o ciclo não quebrar, cada edital vai te encontrar no mesmo lugar.',
      'A boa notícia: tribunal abre o ano inteiro. São 27 TJs, 6 TRFs e 24 TRTs em rodízio, e o tronco de matérias é o mesmo. Quem constrói a base uma vez aproveita em todos.',
    ],
    prescricao: 'estudar agora, sem edital publicado, o tronco comum que cai em todo tribunal, pra que o próximo edital te encontre revisando, e não começando.',
    ordem: [
      'Cronograma de base independente de edital, com data de fim.',
      'Tronco comum primeiro: Português, Constitucional, Administrativo.',
      'Questões da banca como rotina, não como véspera.',
      'Quando o edital sair, só ajustar as específicas e revisar.',
    ],
  },
  servidor: {
    titulo: 'Você já provou que sabe passar.',
    texto: [
      'O salto de técnico pra analista é de profundidade jurídica. A prova cobra Civil, Processo Civil, Penal e Processo Penal num nível que a prova de técnico não cobrava, e a FGV e a FCC gostam de caso concreto.',
      'Recomeçar do zero seria desperdício. O seu caso pede um cronograma que aproveite o que já está de pé e concentre o esforço nas específicas de analista.',
    ],
    prescricao: 'manter as matérias que já sustentam a sua nota com revisão leve e montar um cronograma focado nas específicas de analista, resolvendo questões de analista desde a primeira semana.',
    ordem: [
      'Diagnóstico do que já está sólido do tronco comum.',
      'Específicas de analista em sequência: Civil, Processo Civil, Penal, Processo Penal.',
      'Questões de analista da banca, não de técnico.',
      'Revisão leve das matérias já dominadas.',
    ],
  },
}

export type Opcao = [valor: string, texto: string, sub?: string]

export type TelaPerfil =
  | { type: 'single'; key: keyof RespostasPerfil; title: string; hint?: string | ((r: RespostasPerfil) => string); opts: Opcao[] | ((r: RespostasPerfil) => Opcao[]); after?: (r: RespostasPerfil) => 'desqualificado' | null }
  | { type: 'multi'; key: keyof RespostasPerfil; title: string; hint?: string | ((r: RespostasPerfil) => string); opts: Opcao[] | ((r: RespostasPerfil) => Opcao[]) }

// Ordem exata do funil de referência (screens 1-12; a captura de lead — screen
// 23 no original — já aconteceu na capa, e o form não se repete aqui).
export const PERFIL_SCREENS: TelaPerfil[] = [
  {
    type: 'single', key: 'alvo', title: 'Qual concurso é a sua prioridade hoje?',
    opts: [
      ['tj', 'Tribunal de Justiça (TJ)', 'o tribunal estadual'],
      ['trf', 'Tribunal Regional Federal (TRF)'],
      ['trt', 'Tribunal Regional do Trabalho (TRT)'],
      ['fe', 'Defensoria, Ministério Público ou Procuradoria', 'cargo de analista ou técnico, servidor de apoio'],
      ['any', 'Qualquer tribunal, o que abrir primeiro'],
      ['juridica', 'Carreira jurídica', 'juiz, promotor, defensor ou procurador'],
      ['outro', 'Outro concurso, fora dos tribunais'],
    ],
    after: (r) => (r.alvo === 'outro' || r.alvo === 'juridica' ? 'desqualificado' : null),
  },
  {
    type: 'single', key: 'cargo', title: 'Qual cargo você mira?',
    opts: (r) =>
      r.alvo === 'fe'
        ? [
            ['analista', 'Analista', 'nível superior'],
            ['tecnico', 'Técnico', 'nível médio'],
            ['any', 'O que vier, quero entrar no órgão'],
            ['unsure', 'Ainda não sei a diferença entre eles'],
          ]
        : [
            ['analista', 'Analista judiciário'],
            ['oficial', 'Oficial de justiça'],
            ['tecnico', 'Técnico judiciário'],
            ['escrevente', 'Escrevente'],
            ['any', 'O que vier, quero entrar no tribunal'],
            ['unsure', 'Ainda não sei a diferença entre eles'],
          ],
  },
  {
    type: 'single', key: 'formacao', title: 'Qual é a sua formação hoje?',
    opts: [
      ['direito', 'Bacharel em Direito'],
      ['cursando_direito', 'Cursando Direito'],
      ['outra', 'Superior completo em outra área'],
      ['cursando_outra', 'Cursando outra área'],
      ['medio', 'Ensino médio completo'],
    ],
    after: (r) => (r.cargo === 'escrevente' || r.formacao === 'medio' ? 'desqualificado' : null),
  },
  {
    type: 'single', key: 'tempo', title: 'Há quanto tempo você estuda pra concursos?',
    opts: [
      ['t0', 'Ainda não comecei'],
      ['t1', 'Menos de 6 meses'],
      ['t2', 'Entre 6 meses e 1 ano'],
      ['t3', 'Entre 1 e 2 anos'],
      ['t4', 'Entre 2 e 4 anos'],
      ['t5', 'Mais de 4 anos'],
    ],
  },
  {
    type: 'single', key: 'provas', title: 'Quantas provas de tribunal você já fez, e como foi?',
    hint: 'Prova oficial, presencial. Simulado feito em casa não entra nessa conta.',
    opts: [
      ['p0', 'Nunca fiz uma prova de tribunal'],
      ['p1', 'Fiz uma ou duas e fiquei longe do corte'],
      ['p2', 'Fiz várias e continuo longe do corte'],
      ['p3', 'Fico perto do corte, mas não passo'],
      ['p4', 'Já fui aprovado(a) em algum tribunal e quero subir de cargo'],
    ],
  },
  {
    type: 'single', key: 'metodo', title: 'Como você estudou até aqui?',
    opts: [
      ['nenhum', 'Nunca estudei com método, vou no improviso'],
      ['video', 'Videoaulas de cursinho grande, muitas horas de vídeo'],
      ['pdf', 'PDF e questões, com cronograma'],
      ['questoes', 'Só questões'],
      ['retafinal', 'Só quando sai edital, com curso de reta final'],
      ['mentoria', 'Mentoria ou coaching'],
    ],
  },
  {
    type: 'single', key: 'vde', title: 'Você já conhece o Método VDE?',
    opts: [
      ['nunca', 'Nunca ouvi falar'],
      ['insta', 'Sigo no Instagram, mas nunca estudei com vocês'],
      ['exaluno', 'Já fui aluno(a) da OAB ou de outro curso do VDE'],
      ['aluno', 'Já sou aluno(a) do VDE Concursos'],
    ],
  },
  {
    type: 'single', key: 'horas', title: 'Quantas horas por dia você consegue estudar, sendo realista?',
    hint: 'Pensa no seu dia normal, não no dia perfeito.',
    opts: [
      ['h0', 'Menos de 1 hora'],
      ['h1', 'Entre 1 e 2 horas'],
      ['h2', 'Entre 2 e 3 horas'],
      ['h3', 'Entre 3 e 4 horas'],
      ['h4', 'Mais de 4 horas'],
    ],
  },
  {
    type: 'single', key: 'edital', title: 'Você tem edital na mira?',
    opts: [
      ['reta', 'Já saiu, e a prova é em menos de 3 meses'],
      ['previsto', 'Tem edital previsto pros próximos meses'],
      ['sem', 'Não tenho um edital específico: quero estar pronto quando abrir'],
      ['nao', 'Não acompanho as previsões'],
    ],
  },
  {
    type: 'multi', key: 'editais', title: 'Estes são os concursos que estão na fila pra sair. Em qual deles você quer estar pronto?',
    hint: (r) => `Pode marcar mais de um. Situação em ${CONFIG.editaisAtualizadosEm}.`,
    opts: (r) => {
      const lista = EDITAIS[r.alvo ?? ''] ?? EDITAIS.any
      return [...lista.map((e): Opcao => [e.id, e.label, e.sub]), ['qualquer', 'Qualquer um, quero estar pronto quando abrir']]
    },
  },
  {
    type: 'single', key: 'dor', title: 'Qual é o seu maior gargalo hoje?',
    opts: [
      ['base', 'Não tenho base: sinto que começo do zero a cada edital'],
      ['improviso', 'Estudo no improviso, sem cronograma nem ordem'],
      ['tempo', 'Pouco tempo: concilio estudo com trabalho'],
      ['naojur', 'Medo das matérias não jurídicas: Português, RLM, Informática'],
      ['fixar', 'Leio muito e resolvo pouco: não fixo'],
      ['banca', 'Não sei o que a FGV e a FCC cobram de verdade'],
      ['emocional', 'O emocional sabota: ansiedade, comparação, sensação de atraso'],
      ['todas', 'Todas acima'],
    ],
  },
  {
    type: 'single', key: 'momento', title: 'Última: qual dessas frases você diria pra um amigo hoje?',
    opts: [
      ['zero', 'Estou começando do zero, ainda me organizando'],
      ['sembase', 'Estudo há um tempo, mas sem base sólida: fico perdido no meio das matérias'],
      ['plato', 'Chego perto do corte e não passo, prova atrás de prova'],
      ['improviso', 'Só estudo quando sai edital, e recomeço do zero toda vez'],
      ['servidor', 'Já sou servidor(a) e quero subir pra analista'],
    ],
  },
]

// Tela 15 do original (dinheiro) e 22 (leitura) ficam separadas: a primeira
// entra depois do vídeo/antes da calculadora de custo, a segunda depois da
// correção — o motor de telas em Quiz.tsx as posiciona nesses pontos fixos.
export const TELA_DINHEIRO: TelaPerfil = {
  type: 'single', key: 'dinheiro', title: 'Quanto você receberia a mais por mês se fosse aprovado(a) hoje no cargo que você mira?',
  hint: 'Analista de tribunal federal começa em cerca de R$ 16 mil. Compare com o que você ganha hoje.',
  opts: [
    ['60', 'Uns R$ 5 mil a mais por mês', 'R$ 60 mil por ano'],
    ['96', 'Uns R$ 8 mil a mais por mês', 'R$ 96 mil por ano'],
    ['120', 'Uns R$ 10 mil a mais por mês', 'R$ 120 mil por ano'],
    ['156', 'Uns R$ 13 mil a mais por mês', 'R$ 156 mil por ano'],
    ['192', 'R$ 16 mil ou mais a mais por mês', 'R$ 192 mil por ano'],
  ],
}

export const TELA_LEITURA: TelaPerfil = {
  type: 'single', key: 'leitura', title: 'Quer que eu inclua no seu resultado o que priorizar no seu momento?',
  opts: [
    ['completa', 'Inclui, por favor'],
    ['basica', 'Só o diagnóstico já basta'],
  ],
}

// Prefixa uma frase com o primeiro nome, minúscula a primeira letra que
// sobrou ("Qual concurso..." -> "Maria, qual concurso..."). Sem nome, devolve
// a frase original intacta. Usado nos poucos pontos de personalização
// pontual do funil — não em toda pergunta, pra não soar mala-direta.
export function comNome(nome: string, frase: string): string {
  if (!nome) return frase
  return `${nome}, ${frase.charAt(0).toLowerCase()}${frase.slice(1)}`
}

export function labelCargo(r: RespostasPerfil): string {
  return r.alvo === 'fe' ? (L.cargoFe[r.cargo ?? ''] ?? '') : (L.cargo[r.cargo ?? ''] ?? '')
}

export function editaisEscolhidos(r: RespostasPerfil): Edital[] {
  const lista = EDITAIS[r.alvo ?? ''] ?? EDITAIS.any
  return (r.editais ?? []).filter((x) => x !== 'qualquer').map((id) => lista.find((e) => e.id === id)).filter((e): e is Edital => Boolean(e))
}

// Frase da tela de correção, indexada pelo número de acertos (0 a 4).
export const MENSAGENS_CORRECAO: string[] = [
  'Nenhuma das quatro. E tudo bem: é exatamente esse tipo de questão que a sua base precisa dar conta.',
  'Uma das quatro. O nível da banca já está claro, e ele é alcançável com base bem construída.',
  'Duas das quatro. Você tem alicerce em pé, e ele ainda não sustenta a régua de um tribunal.',
  'Três das quatro. Está perto do corte, e o corte só paga quem passa dele.',
  'As quatro. Nível bom de partida, e a prova real cobra isso em 70 questões seguidas.',
]

export type FraseComNegrito = { negrito?: string; texto: string }

export function fraseEdital(r: RespostasPerfil): FraseComNegrito | null {
  const ed = editaisEscolhidos(r)[0]
  if (!ed) return null
  return {
    negrito: `Sobre o ${ed.label}:`,
    texto: `está com ${ed.sub}. Ele não vai esperar a base ficar pronta, então a ordem do que você estuda agora importa mais do que a quantidade.`,
  }
}

export function fraseRetaFinal(r: RespostasPerfil): FraseComNegrito | null {
  if (r.edital !== 'reta') return null
  return {
    negrito: 'Sobre a sua prova em menos de 3 meses:',
    texto: 'o plano imediato é reta final, questões da banca e lei seca nas matérias de maior peso. A base a gente constrói pro edital seguinte, e ele vem: são 27 TJs, 6 TRFs e 24 TRTs abrindo em ciclo.',
  }
}

export function fraseExtraCargo(r: RespostasPerfil): FraseComNegrito | null {
  if (r.cargo === 'tecnico' && (r.formacao === 'direito' || r.formacao === 'outra') && r.alvo !== 'fe') {
    return {
      negrito: 'Um detalhe que muda o jogo:',
      texto: 'com curso superior você já pode concorrer a analista, que paga quase o dobro do técnico e cai com o mesmo tronco de matérias. Vale levar isso pra conversa com o consultor.',
    }
  }
  return null
}

export function fraseVde(r: RespostasPerfil): FraseComNegrito | null {
  if (r.vde === 'exaluno' || r.vde === 'aluno') {
    return { texto: 'Você já conhece o jeito VDE de estudar: PDF direto ao ponto, lei e questão. O VDE Tribunais é isso aplicado aos concursos de tribunal, com o cronograma calculado pelo número de temas.' }
  }
  return null
}

export function waLink(nome: string, r: RespostasPerfil, classe: string, cursoCod: string, nivel: string, acertos: number, total: number): string {
  const cargo = labelCargo(r)
  const ref = `VDE-TRIB ${classe} | ${cursoCod} | ${r.momento} | ${r.dor} | ${L.horas[r.horas ?? '']} | edital:${r.edital} | teste ${acertos}/${total} | vde:${r.vde}`
  const msg = `Oi! Fiz o ${CONFIG.quizName} do VDE Tribunais agora. Deu ${L.momento[r.momento ?? '']}, nível ${nivel} no teste, mirando ${cargo} em ${L.alvo[r.alvo ?? '']}. Queria ver os horários pra montar o meu plano de ação.\n\n(ref ${ref})`
  return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`
}
