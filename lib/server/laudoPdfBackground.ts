// Dispara em background (via `after()`, ver app/api/quiz/finish/route.ts) na
// conclusão do quiz: gera o laudo E a apresentação comercial (as duas, em
// paralelo — ver Promise.all no chamador) e sobe os dois pro S3, sem atrasar
// a resposta pra quem acabou de terminar. Fire-and-forget de verdade —
// chamadas de dentro de `after()`, sem ninguém do outro lado pra tratar uma
// exceção, então nenhuma das duas funções abaixo nunca deixa uma escapar; só
// grava o problema em laudo_pdf_erro/apresentacao_pdf_erro pro admin ver.
import type { SessionRepo } from './sessionRepo'
import type { QuizSession } from './types'
import { gerarLaudoPdf, gerarApresentacaoPdf, validarSessaoParaLaudo, LaudoIndisponivel } from './laudoService'
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

// Mesma ideia de gerarEArmazenarLaudo, pro deck de apresentação comercial —
// desde que a apresentação também virou um material automático (antes só o
// admin gerava, sob demanda). app/api/apresentacao/[token]/route.ts continua
// gerando na hora como rede de segurança pro caso raro dessa chamada aqui
// ainda estar em andamento (ou ter falhado) quando o CRM acessar o link —
// mesmo laudoToken das duas rotas, então o material sempre volta pra sessão
// certa.
export async function gerarEArmazenarApresentacao(repo: SessionRepo, sessao: QuizSession): Promise<void> {
  const problemas = validarSessaoParaLaudo(sessao)
  if (problemas.length > 0) {
    console.error('[laudoPdfBackground] sessão concluída mas incompleta pra gerar apresentação', {
      sessionToken: sessao.sessionToken, problemas,
    })
    return
  }

  const nivel = sessao.acertos !== null ? nivelTeste(sessao.acertos) : ''

  try {
    const { s3Key } = await gerarApresentacaoPdf(sessao, nivel, { salvarS3: true })
    // s3Key null = mesmo caso "sem link ainda" documentado em gerarEArmazenarLaudo.
    if (!s3Key) return
    await repo.atualizar(sessao.id, { apresentacaoPdfS3Key: s3Key, apresentacaoPdfErro: null })
  } catch (e) {
    const mensagem = e instanceof LaudoIndisponivel ? e.message : String(e)
    console.error('[laudoPdfBackground] falha ao gerar/salvar apresentação', { sessionToken: sessao.sessionToken, erro: mensagem })
    await repo.atualizar(sessao.id, { apresentacaoPdfErro: mensagem }).catch((e2) => {
      console.error('[laudoPdfBackground] falha ao gravar apresentacao_pdf_erro', e2)
    })
  }
}
