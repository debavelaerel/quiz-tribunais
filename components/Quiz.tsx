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

  if (restaurando) {
    return (
      <div>
        <p>Retomando seu diagnóstico…</p>
      </div>
    )
  }

  if (tela === 'capa') {
    return (
      <div>
        <h1>Descubra seu nível para carreiras de Tribunais</h1>
        {erro && <p role="alert">{erro}</p>}
        <input placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input placeholder="(DDD) 00000-0000" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
        <input placeholder="Seu melhor e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button onClick={iniciar} disabled={enviando}>Iniciar diagnóstico</button>
      </div>
    )
  }

  if (tela === 'quiz') {
    const questao = QUESTIONS[atual]
    return (
      <div>
        <p>Questão {atual + 1} de {TOTAL}</p>
        {erro && <p role="alert">{erro}</p>}
        <p>{questao.statement}</p>
        {questao.options.map((o) => (
          <button key={o.letter} onClick={() => responder(o.letter)} disabled={enviando}>
            {o.letter}) {o.text}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div>
      <h2>Diagnóstico concluído</h2>
      {resultado && (
        <>
          <p>{resultado.score_geral_pct}% de aproveitamento</p>
          <p>{resultado.acertos} de {resultado.total} corretas</p>
          <p>Área prioritária: {resultado.area_prioritaria}</p>
        </>
      )}
    </div>
  )
}
