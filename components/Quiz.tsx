'use client'

import { useEffect, useRef, useState } from 'react'
import { QUESTIONS } from '@/lib/questions'
import { carregarEstado, salvarEstado, criarNovoSessionToken, type EstadoQuiz } from '@/lib/storage'

type Tela = 'capa' | 'quiz' | 'resultado'
type Resultado = {
  score_geral_pct: number
  acertos: number
  total: number
  area_prioritaria: string
  areas: Record<string, { acertos: number; total: number; pct: number }>
}
// Fronteira JSON de POST /api/quiz/start (snake_case, igual a /finish e /result).
type RespostaStart = {
  session_token?: unknown
  retomando?: unknown
  respostas_salvas?: unknown
}

const TOTAL = QUESTIONS.length

function tokenDaResposta(json: RespostaStart): string | null {
  return typeof json.session_token === 'string' && json.session_token !== '' ? json.session_token : null
}

// Retoma na primeira pergunta ainda não respondida. Quando a sessão foi resetada
// (`retomando: false`), o servidor devolve `respostas_salvas: []` e o índice é 0.
function indiceDeRetomada(json: RespostaStart): number {
  const salvas = Array.isArray(json.respostas_salvas) ? json.respostas_salvas.length : 0
  return Math.min(salvas, TOTAL - 1)
}

export default function Quiz() {
  const [tela, setTela] = useState<Tela>('capa')
  const [atual, setAtual] = useState(0)
  const [estado, setEstado] = useState<EstadoQuiz | null>(null)
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [restaurando, setRestaurando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  // Trava síncrona: `enviando` só vale a partir do próximo render, então um duplo
  // clique no mesmo tick passaria pelo `disabled` e chamaria setAtual duas vezes.
  const emVooRef = useRef(false)

  // Ao montar: se há sessão em cache, decide entre reexibir o resultado (F5 na tela
  // de resultado) e retomar o quiz de onde parou — sem pedir os dados de novo.
  useEffect(() => {
    const salvo = carregarEstado()
    if (!salvo) return

    let cancelado = false
    setRestaurando(true)
    emVooRef.current = true
    setEnviando(true)

    void (async () => {
      try {
        const resResultado = await fetch(
          `/api/quiz/result?session_token=${encodeURIComponent(salvo.sessionToken)}`,
        )
        if (cancelado) return

        // 200 = sessão já concluída: reexibe o diagnóstico.
        if (resResultado.ok) {
          setEstado(salvo)
          setResultado(await resResultado.json())
          setTela('resultado')
          return
        }

        // 404 = não concluída (em andamento ou inexistente): reenvia os dados em
        // cache para /start, que é idempotente e reencontra a linha pelo email.
        const resStart = await fetch('/api/quiz/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: salvo.nome,
            whatsapp: salvo.whatsapp,
            email: salvo.email,
            session_token: salvo.sessionToken,
          }),
        })
        if (cancelado) return

        const json: RespostaStart = resStart.ok ? await resStart.json() : {}
        const token = resStart.ok ? tokenDaResposta(json) : null
        if (!token) {
          // Não deu para retomar: cai na capa com os dados preenchidos.
          setNome(salvo.nome)
          setWhatsapp(salvo.whatsapp)
          setEmail(salvo.email)
          setErro('Não foi possível retomar seu diagnóstico. Confira seus dados e comece de novo.')
          return
        }

        const novoEstado: EstadoQuiz = {
          sessionToken: token,
          nome: salvo.nome,
          whatsapp: salvo.whatsapp,
          email: salvo.email,
        }
        salvarEstado(novoEstado)
        setEstado(novoEstado)
        setAtual(indiceDeRetomada(json))
        setTela('quiz')
      } catch {
        if (cancelado) return
        setNome(salvo.nome)
        setWhatsapp(salvo.whatsapp)
        setEmail(salvo.email)
        setErro('Não foi possível retomar seu diagnóstico. Verifique sua conexão.')
      } finally {
        // Em StrictMode o efeito roda duas vezes; a execução cancelada não pode
        // soltar a trava da execução que ainda está no ar.
        if (!cancelado) {
          setRestaurando(false)
          setEnviando(false)
          emVooRef.current = false
        }
      }
    })()

    return () => {
      cancelado = true
    }
  }, [])

  // Só é alcançável quando NÃO há sessão em cache (ver efeito acima), então sempre
  // gera um token novo: reaproveitar o token de outra pessoa no mesmo navegador
  // colidiria com a unique constraint de `session_token`.
  async function iniciar() {
    if (emVooRef.current) return
    emVooRef.current = true
    setEnviando(true)
    setErro(null)
    try {
      const res = await fetch('/api/quiz/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, whatsapp, email, session_token: criarNovoSessionToken() }),
      })
      if (!res.ok) {
        setErro('Não foi possível iniciar. Confira seus dados.')
        return
      }
      const json: RespostaStart = await res.json()
      const token = tokenDaResposta(json)
      if (!token) {
        setErro('Resposta inesperada do servidor. Tente novamente.')
        return
      }
      const novoEstado: EstadoQuiz = { sessionToken: token, nome, whatsapp, email }
      salvarEstado(novoEstado)
      setEstado(novoEstado)
      setAtual(indiceDeRetomada(json))
      setTela('quiz')
    } catch {
      setErro('Não foi possível iniciar. Verifique sua conexão.')
    } finally {
      emVooRef.current = false
      setEnviando(false)
    }
  }

  async function responder(letra: string) {
    if (!estado || emVooRef.current) return
    const questao = QUESTIONS[atual]
    if (!questao) return
    emVooRef.current = true
    setEnviando(true)
    setErro(null)
    try {
      const res = await fetch('/api/quiz/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: estado.sessionToken, num: questao.num, escolhida: letra }),
      })
      if (!res.ok) {
        setErro('Não foi possível registrar sua resposta. Tente novamente.')
        return
      }
      if (atual === TOTAL - 1) {
        await concluir(estado.sessionToken)
      } else {
        setAtual((n) => n + 1)
      }
    } catch {
      setErro('Não foi possível registrar sua resposta. Verifique sua conexão.')
    } finally {
      emVooRef.current = false
      setEnviando(false)
    }
  }

  // Chamada só a partir de `responder`, que já segura a trava de envio.
  async function concluir(sessionToken: string) {
    const res = await fetch('/api/quiz/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: sessionToken }),
    })
    if (!res.ok) {
      setErro('Não foi possível concluir o diagnóstico. Tente novamente.')
      return
    }
    setResultado(await res.json())
    setTela('resultado')
  }

  const marca = (
    // eslint-disable-next-line @next/next/no-img-element -- SVG estático, sem
    // necessidade do pipeline de otimização de imagem do Next.
    <img src="/brand/versao02-color0.svg" alt="VDE Tribunais" width={116} height={58} />
  )

  if (restaurando) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-brand-ink/60">Retomando seu diagnóstico…</p>
      </main>
    )
  }

  if (tela === 'capa') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          {marca}
          <h1 className="mt-8 text-3xl font-semibold leading-tight text-brand-navy-ink">
            Descubra seu nível para carreiras de Tribunais
          </h1>
          <p className="mt-3 text-brand-ink/70">
            Responda a um diagnóstico rápido e veja onde focar seus estudos.
          </p>

          {erro && (
            <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {erro}
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3">
            <input
              placeholder="Seu nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="rounded-lg border border-brand-line bg-white px-4 py-3 text-brand-ink placeholder:text-brand-ink/40 focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-lilac/50"
            />
            <input
              placeholder="(DDD) 00000-0000"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="rounded-lg border border-brand-line bg-white px-4 py-3 text-brand-ink placeholder:text-brand-ink/40 focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-lilac/50"
            />
            <input
              placeholder="Seu melhor e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-brand-line bg-white px-4 py-3 text-brand-ink placeholder:text-brand-ink/40 focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-lilac/50"
            />
          </div>

          <button
            onClick={iniciar}
            disabled={enviando}
            className="mt-6 w-full rounded-lg bg-brand-navy px-6 py-3 font-medium text-white transition-colors hover:bg-brand-navy-ink disabled:opacity-50"
          >
            Iniciar diagnóstico
          </button>
        </div>
      </main>
    )
  }

  if (tela === 'quiz') {
    const questao = QUESTIONS[atual]
    const progresso = Math.round((atual / TOTAL) * 100)
    return (
      <main className="flex min-h-screen justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between text-sm text-brand-ink/60">
            <span>Questão {atual + 1} de {TOTAL}</span>
            <span>{questao.area}</span>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-brand-lilac/25">
            <div
              className="h-1.5 rounded-full bg-brand-navy transition-[width]"
              style={{ width: `${progresso}%` }}
            />
          </div>

          {erro && (
            <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {erro}
            </p>
          )}

          <p className="mt-8 text-lg leading-relaxed text-brand-navy-ink">{questao.statement}</p>

          <div className="mt-6 flex flex-col gap-2.5">
            {questao.options.map((o) => (
              <button
                key={o.letter}
                onClick={() => responder(o.letter)}
                disabled={enviando}
                className="flex gap-3 rounded-lg border border-brand-line bg-white px-4 py-3 text-left text-brand-ink transition-colors hover:border-brand-navy hover:bg-brand-navy/5 disabled:opacity-50"
              >
                <span className="font-medium text-brand-navy">{o.letter}</span>{' '}
                <span>{o.text}</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    )
  }

  const areaPrioritaria = resultado?.area_prioritaria

  return (
    <main className="flex min-h-screen justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <p className="text-sm text-brand-ink/60">Diagnóstico concluído</p>
        {resultado && (
          <>
            <p className="mt-2 text-6xl font-semibold text-brand-navy-ink">{resultado.score_geral_pct}%</p>
            <p className="mt-1 text-brand-ink/70">
              {resultado.acertos} de {resultado.total} respostas corretas
            </p>

            <div className="mt-10 flex flex-col gap-4">
              {Object.entries(resultado.areas).map(([area, dados]) => (
                <div key={area}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className={area === areaPrioritaria ? 'font-medium text-brand-navy-ink' : 'text-brand-ink/80'}>
                      {area}
                    </span>
                    <span className="text-brand-ink/60">{dados.pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-brand-lilac/25">
                    <div
                      className={`h-1.5 rounded-full ${area === areaPrioritaria ? 'bg-brand-lilac' : 'bg-brand-navy'}`}
                      style={{ width: `${dados.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {areaPrioritaria && (
              <p className="mt-8 rounded-lg bg-brand-lilac/15 px-4 py-3 text-sm text-brand-navy-ink">
                Foco sugerido: <span className="font-medium">{areaPrioritaria}</span>
              </p>
            )}
          </>
        )}
      </div>
    </main>
  )
}
