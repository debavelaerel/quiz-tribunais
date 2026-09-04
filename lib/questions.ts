// Banco de perguntas do quiz. Conteúdo AMOSTRA — será substituído pelo
// conteúdo final (tarefa de copywriting separada, ver spec "Fora de escopo").
// O formato ({num, area, statement, options, correct, comment}) é definitivo.

export type Option = { letter: string; text: string }
export type Question = {
  num: number
  area: string
  statement: string
  options: Option[]
  correct: string
  comment: string[]
}

export const EVENTO = 'diagnostico-tribunais-comercial'

export const QUESTIONS: Question[] = [
  {
    num: 1,
    area: 'Direito Constitucional',
    statement: 'Segundo a Constituição Federal de 1988, o remédio constitucional cabível para proteger o acesso a informações pessoais constantes de bancos de dados públicos é:',
    options: [
      { letter: 'A', text: 'Mandado de segurança' },
      { letter: 'B', text: 'Habeas data' },
      { letter: 'C', text: 'Habeas corpus' },
      { letter: 'D', text: 'Ação popular' },
    ],
    correct: 'B',
    comment: [
      'A) Incorreto. O mandado de segurança protege direito líquido e certo não amparado por habeas corpus ou habeas data.',
      'B) Correto. O art. 5º, LXXII, da CF/88 prevê o habeas data para assegurar o conhecimento e a retificação de informações pessoais em bancos de dados públicos.',
      'C) Incorreto. O habeas corpus protege a liberdade de locomoção.',
      'D) Incorreto. A ação popular visa anular ato lesivo ao patrimônio público, não o acesso a dados pessoais.',
    ],
  },
  {
    num: 2,
    area: 'Direito Administrativo',
    statement: 'Um ato administrativo praticado por agente incompetente, quando a competência é delegável e foi exercida de forma discricionária, admite:',
    options: [
      { letter: 'A', text: 'Convalidação obrigatória' },
      { letter: 'B', text: 'Convalidação facultativa' },
      { letter: 'C', text: 'Nulidade insanável' },
      { letter: 'D', text: 'Anulação automática, sem análise da autoridade competente' },
    ],
    correct: 'B',
    comment: [
      'A) Incorreto. A convalidação de vício de competência discricionária não é obrigatória.',
      'B) Correto. Sendo a competência discricionária e delegável, a autoridade competente pode optar por convalidar ou anular o ato.',
      'C) Incorreto. Nem todo vício de competência é insanável — apenas os relativos à matéria, atribuídos com exclusividade por lei.',
      'D) Incorreto. A anulação não é automática; depende de análise da autoridade competente.',
    ],
  },
  {
    num: 3,
    area: 'Direito Civil',
    statement: 'No regime de separação convencional de bens, o cônjuge sobrevivente, em concorrência com os descendentes do falecido:',
    options: [
      { letter: 'A', text: 'Não é herdeiro, apenas meeiro' },
      { letter: 'B', text: 'É herdeiro necessário e concorre com os descendentes' },
      { letter: 'C', text: 'Só herda se provar esforço comum na aquisição dos bens' },
      { letter: 'D', text: 'Recebe a totalidade da herança, excluindo os descendentes' },
    ],
    correct: 'B',
    comment: [
      'A) Incorreto. No regime de separação de bens não há meação, mas o cônjuge é herdeiro.',
      'B) Correto. O art. 1.829, I, do Código Civil inclui o cônjuge como herdeiro necessário em concorrência com os descendentes, mesmo na separação convencional.',
      'C) Incorreto. Esse requisito não se aplica à condição de herdeiro necessário.',
      'D) Incorreto. O cônjuge concorre com os descendentes, não os exclui.',
    ],
  },
]
