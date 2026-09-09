import type { LeadsDesqualificadosRepo, MotivoDesqualificacao, CarreiraJuridica } from './leadsDesqualificadosRepo'
import { normalizeEmail, normalizeWhatsapp } from '../normalize'

export type RegistrarLeadDesqualificadoInput = {
  evento: string
  fluxo: 'padrao' | 'final'
  motivo: MotivoDesqualificacao
  carreiraJuridica: CarreiraJuridica | null
  nome: string
  whatsapp: string
  email: string
}

// Captura de contato de quem foi desqualificado no perfilamento (ver
// components/Quiz.tsx, tela 'desqualificado') — tabela própria
// (leads_desqualificados), independente de quiz_sessions: é interesse em
// outro produto, não deve contaminar o funil/analytics do Tribunais. Sempre
// grava uma linha nova, sem dedupe nem resumo — é captura de uma vez só.
export async function registrarLeadDesqualificado(
  repo: LeadsDesqualificadosRepo,
  input: RegistrarLeadDesqualificadoInput,
): Promise<void> {
  await repo.criar({
    evento: input.evento,
    fluxo: input.fluxo,
    motivo: input.motivo,
    // Espelha o check da migration (carreira_juridica só existe com
    // motivo='juridica') aqui também, em vez de confiar cegamente no que o
    // cliente mandou.
    carreiraJuridica: input.motivo === 'juridica' ? input.carreiraJuridica : null,
    nome: input.nome,
    whatsapp: input.whatsapp,
    whatsappNormalizado: normalizeWhatsapp(input.whatsapp),
    email: input.email,
    emailNormalizado: normalizeEmail(input.email),
  })
}
