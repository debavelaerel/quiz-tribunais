// Rótulos legíveis pros códigos de resposta do perfilamento, só pro painel
// administrativo (detalhe de lead + analytics). `lib/quizContent.ts` guarda
// a maior parte desse texto inline nas opções de cada tela (`PERFIL_SCREENS`)
// em vez de num dicionário plano — o `L` de lá cobre só o que as telas do
// próprio quiz precisam reexibir (mirror, resultado). Duplicamos aqui o
// necessário pro admin porque extrair um dicionário único reaproveitável
// pelas duas pontas seria um refactor maior do motor de telas, fora do
// escopo desta mudança. Se `PERFIL_SCREENS` mudar um rótulo, mudar aqui
// também.
import { L, EDITAIS } from './quizContent'

const EDITAIS_POR_ID: Record<string, string> = Object.fromEntries(
  Object.values(EDITAIS).flat().map((e) => [e.id, e.label]),
)

const FORMACAO: Record<string, string> = {
  direito: 'Bacharel em Direito',
  cursando_direito: 'Cursando Direito',
  outra: 'Superior completo em outra área',
  cursando_outra: 'Cursando outra área',
  medio: 'Ensino médio completo',
}

const TEMPO: Record<string, string> = {
  t0: 'Ainda não comecei', t1: 'Menos de 6 meses', t2: 'Entre 6 meses e 1 ano',
  t3: 'Entre 1 e 2 anos', t4: 'Entre 2 e 4 anos', t5: 'Mais de 4 anos',
}

const PROVAS: Record<string, string> = {
  p0: 'Nunca fez uma prova de tribunal',
  p1: 'Fez 1-2, ficou longe do corte',
  p2: 'Fez várias, continua longe do corte',
  p3: 'Fica perto do corte, não passa',
  p4: 'Já aprovado(a), quer subir de cargo',
}

const METODO: Record<string, string> = {
  nenhum: 'Sem método, no improviso', video: 'Videoaulas de cursinho grande',
  pdf: 'PDF e questões, com cronograma', questoes: 'Só questões',
  retafinal: 'Só reta final, quando sai edital', mentoria: 'Mentoria ou coaching',
}

const VDE: Record<string, string> = {
  nunca: 'Nunca ouviu falar', insta: 'Segue no Instagram',
  exaluno: 'Ex-aluno(a) (OAB ou outro curso)', aluno: 'Já é aluno(a) VDE Concursos',
}

const EDITAL_STATUS: Record<string, string> = {
  reta: 'Prova em < 3 meses', previsto: 'Edital previsto', sem: 'Sem edital específico', nao: 'Não acompanha',
}

const DOR: Record<string, string> = {
  base: 'Não tem base', improviso: 'Estuda no improviso', tempo: 'Pouco tempo (trabalho)',
  naojur: 'Medo das não-jurídicas', fixar: 'Lê muito, fixa pouco', banca: 'Não sabe o que a banca cobra',
  emocional: 'Emocional sabota', todas: 'Todas acima',
}

const DINHEIRO: Record<string, string> = {
  '60': 'R$ 5 mil/mês a mais', '96': 'R$ 8 mil/mês a mais', '120': 'R$ 10 mil/mês a mais',
  '156': 'R$ 13 mil/mês a mais', '192': 'R$ 16 mil/mês ou mais',
}

const LEITURA: Record<string, string> = { completa: 'Quis a leitura completa', basica: 'Só o diagnóstico básico' }

// Só existe pro fluxo padrão (marcação silenciosa — ver lib/perfil.ts). O
// motivo 'juridica' nunca aparece aqui: tem CTA próprio, gravado em
// leads_desqualificados, não em quiz_sessions.perfil.
const DESQUALIFICADO_MOTIVO: Record<string, string> = {
  outro: 'Concurso fora de tribunais', cargo_baixo: 'Mira cargo abaixo do nível (escrevente/técnico)',
}

// Um dicionário por chave de RespostasPerfil — usado tanto pro detalhe do
// lead quanto pra passar como prop `rotulos` do PieChart.
export const ROTULOS_PERFIL: Record<string, Record<string, string>> = {
  alvo: L.alvo,
  cargo: L.cargo,
  formacao: FORMACAO,
  tempo: TEMPO,
  provas: PROVAS,
  metodo: METODO,
  vde: VDE,
  horas: L.horas,
  edital: EDITAL_STATUS,
  editais: EDITAIS_POR_ID,
  dor: DOR,
  momento: L.momento,
  dinheiro: DINHEIRO,
  leitura: LEITURA,
  desqualificadoMotivo: DESQUALIFICADO_MOTIVO,
}

export function rotuloPerfil(chave: string, valor: string | undefined | null): string {
  if (!valor) return '—'
  return ROTULOS_PERFIL[chave]?.[valor] ?? valor
}
