// Dispara em background (via `after()`, ver app/api/quiz/finish/route.ts) na
// conclusão do quiz: gera o laudo e salva no S3, sem atrasar a resposta pra
// quem acabou de terminar. Fire-and-forget de verdade — chamado de dentro de
// `after()`, sem ninguém do outro lado pra tratar uma exceção, então nunca
// deixa uma escapar; só grava o problema em laudo_pdf_erro pro admin ver.
import type { SessionRepo } from './sessionRepo'
import type { QuizSession } from './types'
import { gerarLaudoPdf, validarSessaoParaLaudo, LaudoIndisponivel } from './laudoService'
import { nivelTeste } from '../perfil'

export async function gerarEArmazenarLaudo(repo: SessionRepo, sessao: QuizSession): Promise<void> {
  // Sessão concluída pela UI normal do quiz sempre passa aqui (mesma
  // checagem que app/api/admin/leads/[token]/pdf/route.ts usa) — não custa
  // conferir de novo antes de gastar a chamada pro serviço Python.
  const problemas = validarSessaoParaLaudo(sessao)
  if (problemas.length > 0) {
    console.error('[laudoPdfBackground] sessão concluída mas incompleta pra gerar laudo', {
      sessionToken: sessao.sessionToken, problemas,
    })
    return
  }

  const nivel = sessao.acertos !== null ? nivelTeste(sessao.acertos) : ''

  try {
    const { s3Key } = await gerarLaudoPdf(sessao, nivel, { salvarS3: true })
    // s3Key null = S3_BUCKET ainda não configurado no serviço Python (não é
    // erro, é o estado normal até o devops mandar as credenciais) — nada
    // pra gravar ainda.
    if (!s3Key) return
    await repo.atualizar(sessao.id, { laudoPdfS3Key: s3Key, laudoPdfErro: null })
  } catch (e) {
    const mensagem = e instanceof LaudoIndisponivel ? e.message : String(e)
    console.error('[laudoPdfBackground] falha ao gerar/salvar laudo', { sessionToken: sessao.sessionToken, erro: mensagem })
    await repo.atualizar(sessao.id, { laudoPdfErro: mensagem }).catch((e2) => {
      console.error('[laudoPdfBackground] falha ao gravar laudo_pdf_erro', e2)
    })
  }
}
