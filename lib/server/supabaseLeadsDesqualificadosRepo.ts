import type { SupabaseClient } from '@supabase/supabase-js'
import type { LeadsDesqualificadosRepo, LeadDesqualificado } from './leadsDesqualificadosRepo'

type LinhaBanco = {
  id: number
  evento: string
  fluxo: LeadDesqualificado['fluxo']
  motivo: LeadDesqualificado['motivo']
  carreira_juridica: LeadDesqualificado['carreiraJuridica']
  nome: string
  whatsapp: string
  whatsapp_normalizado: string
  email: string
  email_normalizado: string
  criado_em: string
}

function paraLead(linha: LinhaBanco): LeadDesqualificado {
  return {
    id: linha.id,
    evento: linha.evento,
    fluxo: linha.fluxo,
    motivo: linha.motivo,
    carreiraJuridica: linha.carreira_juridica,
    nome: linha.nome,
    whatsapp: linha.whatsapp,
    whatsappNormalizado: linha.whatsapp_normalizado,
    email: linha.email,
    emailNormalizado: linha.email_normalizado,
    criadoEm: linha.criado_em,
  }
}

export function criarSupabaseLeadsDesqualificadosRepo(client: SupabaseClient): LeadsDesqualificadosRepo {
  return {
    async criar(lead) {
      const { data, error } = await client.from('leads_desqualificados').insert({
        evento: lead.evento,
        fluxo: lead.fluxo,
        motivo: lead.motivo,
        carreira_juridica: lead.carreiraJuridica,
        nome: lead.nome,
        whatsapp: lead.whatsapp,
        whatsapp_normalizado: lead.whatsappNormalizado,
        email: lead.email,
        email_normalizado: lead.emailNormalizado,
      }).select('*').single()
      if (error) throw error
      return paraLead(data as LinhaBanco)
    },
  }
}
