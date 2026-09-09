export type MotivoDesqualificacao = 'outro' | 'juridica' | 'cargo_baixo'
export type CarreiraJuridica = 'juiz' | 'promotor' | 'defensor' | 'procurador' | 'outra'

export type LeadDesqualificado = {
  id: number
  evento: string
  fluxo: 'padrao' | 'final'
  motivo: MotivoDesqualificacao
  // Preenchido só quando motivo === 'juridica' (ver check da migration).
  carreiraJuridica: CarreiraJuridica | null
  nome: string
  whatsapp: string
  whatsappNormalizado: string
  email: string
  emailNormalizado: string
  criadoEm: string
}

export type CriarLeadDesqualificadoInput = Omit<LeadDesqualificado, 'id' | 'criadoEm'>

// Interface deliberadamente mínima (só `criar`): ao contrário de
// quiz_sessions, não existe retomada, dedupe nem update aqui — é captura de
// uma vez só (ver comentário da migration).
export interface LeadsDesqualificadosRepo {
  criar(lead: CriarLeadDesqualificadoInput): Promise<LeadDesqualificado>
}
