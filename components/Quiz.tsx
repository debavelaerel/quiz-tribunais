'use client'

import { useEffect, useState } from 'react'
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

const TOTAL = QUESTIONS.length

export default function Quiz() {
  const [tela, setTela] = useState<Tela>('capa')
  const [atual, setAtual] = useState(0)
  const [estado, setEstado] = useState<EstadoQuiz | null>(null)
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  useEffect(() => {
    const salvo = carregarEstado()
    if (salvo) setEstado(salvo)
  }, [])

  async function iniciar() {
    setErro(null)
    const sessionToken = estado?.sessionToken ?? criarNovoSessionToken()
    const res = await fetch('/api/quiz/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, whatsapp, email, session_token: sessionToken }),
    })
    if (!res.ok) {
      setErro('Não foi possível iniciar. Confira seus dados.')
      return
    }
    const json = await res.json()
    const novoEstado: EstadoQuiz = { sessionToken: json.session_token, nome, whatsapp, email }
    salvarEstado(novoEstado)
    setEstado(novoEstado)
    setAtual(json.respostasSalvas?.length ?? 0)
    setTela('quiz')
  }

  async function responder(letra: string) {
    if (!estado) return
    const questao = QUESTIONS[atual]
    await fetch('/api/quiz/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: estado.sessionToken, num: questao.num, escolhida: letra }),
    })
    if (atual === TOTAL - 1) {
      await concluir()
    } else {
      setAtual((n) => n + 1)
    }
  }

  async function concluir() {
    if (!estado) return
    const res = await fetch('/api/quiz/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: estado.sessionToken }),
    })
    if (res.ok) {
      setResultado(await res.json())
      setTela('resultado')
    }
  }

  if (tela === 'capa') {
    return (
      <div>
        <h1>Descubra seu nível para carreiras de Tribunais</h1>
        {erro && <p role="alert">{erro}</p>}
        <input placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input placeholder="(DDD) 00000-0000" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
        <input placeholder="Seu melhor e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button onClick={iniciar}>Iniciar diagnóstico</button>
      </div>
    )
  }

  if (tela === 'quiz') {
    const questao = QUESTIONS[atual]
    return (
      <div>
        <p>Questão {atual + 1} de {TOTAL}</p>
        <p>{questao.statement}</p>
        {questao.options.map((o) => (
          <button key={o.letter} onClick={() => responder(o.letter)}>
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
