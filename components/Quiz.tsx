'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Check, Play, X } from 'lucide-react'
import { QUESTIONS } from '@/lib/questions'
import { carregarEstado, salvarEstado, criarNovoSessionToken, type EstadoQuiz } from '@/lib/storage'
import {
  CONFIG,
  PERFIL_SCREENS,
  TELA_DINHEIRO,
  TELA_LEITURA,
  DIAG,
  L,
  MENSAGENS_CORRECAO,
  labelCargo,
  editaisEscolhidos,
  fraseEdital,
  fraseRetaFinal,
  fraseExtraCargo,
  fraseVde,
  waLink,
  type TelaPerfil,
  type Opcao,
  type FraseComNegrito,
} from '@/lib/quizContent'
import { calcularPerfil, calcularConta, nivelTeste, type RespostasPerfil } from '@/lib/perfil'
import Header from './Header'
import OptionButton from './OptionButton'
import Button from './Button'
import ProgressBar from './ProgressBar'

type Tela =
  | 'capa' | 'nome' | 'restaurando'
  | 'intro' | 'perfil' | 'desqualificado'
  | 'mirror' | 'video' | 'dinheiro' | 'conta'
  | 'quiz' | 'correcao' | 'leitura' | 'contato'
  | 'resultado'

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
// Passos do funil depois da capa/intro, na ordem em que acontecem — usado só
// para desenhar a barra de progresso do Header. O "+1" cobre a tela de
// contato (só existe no fluxo ?fluxo=final); no fluxo padrão essa etapa
// nunca é exibida, então o denominador fica levemente conservador — efeito
// puramente cosmético na barra, sem impacto funcional.
const PASSOS_POS_INTRO = PERFIL_SCREENS.length + 4 /* mirror, video, dinheiro, conta */ + TOTAL + 2 /* correcao, leitura */ + 1 /* contato */

function tokenDaResposta(json: RespostaStart): string | null {
  return typeof json.session_token === 'string' && json.session_token !== '' ? json.session_token : null
}

// Retoma na primeira pergunta ainda não respondida. Quando a sessão foi resetada
// (`retomando: false`), o servidor devolve `respostas_salvas: []` e o índice é 0.
function indiceDeRetomada(json: RespostaStart): number {
  const salvas = Array.isArray(json.respostas_salvas) ? json.respostas_salvas.length : 0
  return Math.min(salvas, TOTAL - 1)
}

function valAplicado<T>(x: T | ((r: RespostasPerfil) => T), r: RespostasPerfil): T {
  return typeof x === 'function' ? (x as (r: RespostasPerfil) => T)(r) : x
}

// Selo "eyebrow" dourado usado antes dos títulos de várias telas — mesmo
// padrão do `.eyebrow` do funil de referência.
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-[#FBF3D6] px-3 py-1 text-[12px] font-semibold text-brand-gold-text">
      {children}
    </span>
  )
}

function AlertaErro({ mensagem }: { mensagem: string }) {
  return (
    <p role="alert" className="mt-6 rounded-2xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
      {mensagem}
    </p>
  )
}

export default function Quiz() {
  const [tela, setTela] = useState<Tela>('intro')
  const [atual, setAtual] = useState(0)
  const [estado, setEstado] = useState<EstadoQuiz | null>(null)
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [restaurando, setRestaurando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  // Duas versões do funil, escolhidas por query string (ex.: ?fluxo=final),
  // pra comparar lado a lado sem duplicar o app: 'inicio' (padrão) pede nome
  // + WhatsApp + e-mail juntos na capa, antes do perfilamento; 'final' pede
  // só o nome no começo e WhatsApp + e-mail depois da leitura, antes do
  // resultado — o quiz inteiro roda em memória no navegador até esse ponto
  // (sem sessão no servidor), e só então chama /start, /answer e /finish em
  // sequência, exatamente como o fluxo padrão já faz — nenhuma rota nova.
  const [fluxoFinal, setFluxoFinal] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    setFluxoFinal(new URLSearchParams(window.location.search).get('fluxo') === 'final')
  }, [])

  const [passoPerfil, setPassoPerfil] = useState(0)
  const [respostasPerfil, setRespostasPerfil] = useState<RespostasPerfil>({})
  const [selecaoMulti, setSelecaoMulti] = useState<string[]>([])
  const [respostasTeste, setRespostasTeste] = useState<Record<number, string>>({})
  const [motivoDesqualificacao, setMotivoDesqualificacao] = useState<'outro' | 'juridica' | 'cargo_baixo' | null>(null)

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
          setTela('capa')
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
        // Retomada de perfil/teste no meio do funil não é reconstruída aqui (o
        // servidor guarda o progresso, mas a UI sempre volta pro início do
        // funil de perfilamento após um F5 no meio dele — só a identificação
        // e as respostas GRADUADAS já registradas são preservadas).
        setAtual(indiceDeRetomada(json))
        setTela('intro')
      } catch {
        if (cancelado) return
        setNome(salvo.nome)
        setWhatsapp(salvo.whatsapp)
        setEmail(salvo.email)
        setErro('Não foi possível retomar seu diagnóstico. Verifique sua conexão.')
        setTela('capa')
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
      setTela('perfil')
    } catch {
      setErro('Não foi possível iniciar. Verifique sua conexão.')
    } finally {
      emVooRef.current = false
      setEnviando(false)
    }
  }

  // Perfilamento (não graduado): grava no servidor sem travar a navegação —
  // perda de uma resposta de perfil não compromete a sessão, ao contrário de
  // uma resposta graduada.
  function persistirPerfil(chave: string, valor: string | string[]) {
    if (!estado) return
    void fetch('/api/quiz/perfil', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: estado.sessionToken, chave, valor }),
    }).catch(() => {})
  }

  function avancarPerfil(proximasRespostas: RespostasPerfil) {
    const telaAtual = PERFIL_SCREENS[passoPerfil]
    if (telaAtual.type === 'single' && telaAtual.after) {
      const motivo = telaAtual.after(proximasRespostas)
      if (motivo === 'desqualificado') {
        const chave = telaAtual.key
        setMotivoDesqualificacao(chave === 'alvo' ? (proximasRespostas.alvo === 'outro' ? 'outro' : 'juridica') : 'cargo_baixo')
        setTela('desqualificado')
        return
      }
    }
    const proximoPasso = passoPerfil + 1
    if (proximoPasso >= PERFIL_SCREENS.length) {
      setTela('mirror')
      return
    }
    setPassoPerfil(proximoPasso)
    setSelecaoMulti([])
  }

  function responderPerfilSingle(chave: string, valor: string) {
    const proximasRespostas: RespostasPerfil = { ...respostasPerfil, [chave]: valor }
    setRespostasPerfil(proximasRespostas)
    persistirPerfil(chave, valor)
    avancarPerfil(proximasRespostas)
  }

  function confirmarPerfilMulti(chave: string) {
    const proximasRespostas: RespostasPerfil = { ...respostasPerfil, [chave]: selecaoMulti }
    setRespostasPerfil(proximasRespostas)
    persistirPerfil(chave, selecaoMulti)
    const proximoPasso = passoPerfil + 1
    if (proximoPasso >= PERFIL_SCREENS.length) {
      setTela('mirror')
      return
    }
    setPassoPerfil(proximoPasso)
    setSelecaoMulti([])
  }

  function responderDinheiro(valor: string) {
    const proximasRespostas: RespostasPerfil = { ...respostasPerfil, dinheiro: valor }
    setRespostasPerfil(proximasRespostas)
    persistirPerfil('dinheiro', valor)
    setTela('conta')
  }

  function responderLeitura(valor: string) {
    const proximasRespostas: RespostasPerfil = { ...respostasPerfil, leitura: valor }
    setRespostasPerfil(proximasRespostas)
    persistirPerfil('leitura', valor)
    // Sem sessão ainda (fluxo com contato no final): pede WhatsApp/e-mail
    // antes de revelar o resultado. Com sessão (fluxo padrão): já tem tudo.
    setTela(estado ? 'resultado' : 'contato')
  }

  async function responder(letra: string) {
    if (emVooRef.current) return
    const questao = QUESTIONS[atual]
    if (!questao) return

    if (!estado) {
      // Fluxo com contato no final: ainda não existe sessão no servidor —
      // guarda a resposta localmente e segue. O /api/quiz/answer de verdade
      // só é chamado em enviarContato(), depois que a sessão é criada.
      setRespostasTeste((r) => ({ ...r, [questao.num]: letra }))
      if (atual === TOTAL - 1) {
        setTela('correcao')
      } else {
        setAtual((n) => n + 1)
      }
      return
    }

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
      setRespostasTeste((r) => ({ ...r, [questao.num]: letra }))
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
    setTela('correcao')
  }

  // Fluxo com contato no final: só agora a sessão é criada. Reaproveita as
  // mesmas rotas do fluxo padrão (start → answer × N → finish), em sequência
  // — nenhuma rota nova, nenhum dado de dedupe/schema muda.
  async function enviarContato() {
    if (emVooRef.current) return
    emVooRef.current = true
    setEnviando(true)
    setErro(null)
    try {
      const token = criarNovoSessionToken()
      const resStart = await fetch('/api/quiz/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, whatsapp, email, session_token: token }),
      })
      if (!resStart.ok) {
        setErro('Não foi possível concluir. Confira seus dados.')
        return
      }
      const jsonStart: RespostaStart = await resStart.json()
      const sessionToken = tokenDaResposta(jsonStart)
      if (!sessionToken) {
        setErro('Resposta inesperada do servidor. Tente novamente.')
        return
      }

      for (const questao of QUESTIONS) {
        const escolhida = respostasTeste[questao.num]
        if (!escolhida) continue
        const resAnswer = await fetch('/api/quiz/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_token: sessionToken, num: questao.num, escolhida }),
        })
        if (!resAnswer.ok) {
          setErro('Não foi possível registrar suas respostas. Tente novamente.')
          return
        }
      }

      const resFinish = await fetch('/api/quiz/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: sessionToken }),
      })
      if (!resFinish.ok) {
        setErro('Não foi possível concluir o diagnóstico. Tente novamente.')
        return
      }

      const novoEstado: EstadoQuiz = { sessionToken, nome, whatsapp, email }
      salvarEstado(novoEstado)
      setEstado(novoEstado)
      setResultado(await resFinish.json())
      setTela('resultado')
    } catch {
      setErro('Não foi possível concluir. Verifique sua conexão.')
    } finally {
      emVooRef.current = false
      setEnviando(false)
    }
  }

  if (restaurando) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center px-6">
          <p className="text-brand-ink-dim">Retomando seu diagnóstico…</p>
        </main>
      </div>
    )
  }

  if (tela === 'capa') {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-start justify-center px-6 py-10">
          <div className="w-full max-w-md">
            <h1 className="text-[26px] font-bold leading-tight tracking-[-0.01em] text-brand-ink">
              Descubra seu nível para carreiras de Tribunais
            </h1>
            <p className="mt-3 text-brand-ink-soft">
              Responda a um diagnóstico rápido e veja onde focar seus estudos.
            </p>

            {erro && <AlertaErro mensagem={erro} />}

            <div className="mt-8 flex flex-col gap-3.5">
              <div className="text-left">
                <label htmlFor="nome" className="mb-1.5 block text-[14.5px] font-medium text-brand-ink-soft">Nome</label>
                <input
                  id="nome"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full rounded-[14px] border-[1.5px] border-brand-line-strong bg-brand-card px-4 py-4 text-brand-ink placeholder:italic placeholder:text-brand-ink-dim/70 focus:border-brand-purple focus:outline-none focus:ring-4 focus:ring-brand-purple/10"
                />
              </div>
              <div className="text-left">
                <label htmlFor="whatsapp" className="mb-1.5 block text-[14.5px] font-medium text-brand-ink-soft">WhatsApp</label>
                <input
                  id="whatsapp"
                  placeholder="(DDD) 00000-0000"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full rounded-[14px] border-[1.5px] border-brand-line-strong bg-brand-card px-4 py-4 text-brand-ink placeholder:italic placeholder:text-brand-ink-dim/70 focus:border-brand-purple focus:outline-none focus:ring-4 focus:ring-brand-purple/10"
                />
              </div>
              <div className="text-left">
                <label htmlFor="email" className="mb-1.5 block text-[14.5px] font-medium text-brand-ink-soft">E-mail</label>
                <input
                  id="email"
                  placeholder="Seu melhor e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-[14px] border-[1.5px] border-brand-line-strong bg-brand-card px-4 py-4 text-brand-ink placeholder:italic placeholder:text-brand-ink-dim/70 focus:border-brand-purple focus:outline-none focus:ring-4 focus:ring-brand-purple/10"
                />
              </div>
            </div>

            <Button variant="gold" onClick={iniciar} disabled={enviando} className="mt-6">
              Iniciar diagnóstico <ArrowRight size={17} strokeWidth={2.25} />
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // Fluxo com contato no final (?fluxo=final): só o nome, sem chamar o
  // servidor ainda — WhatsApp e e-mail só são pedidos na tela 'contato'.
  if (tela === 'nome') {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-start justify-center px-6 py-10">
          <div className="w-full max-w-md">
            <h1 className="text-[26px] font-bold leading-tight tracking-[-0.01em] text-brand-ink">
              Como podemos te chamar?
            </h1>
            <p className="mt-3 text-brand-ink-soft">
              Só isso — o resto a gente pergunta ao longo do caminho.
            </p>

            <div className="mt-8 text-left">
              <label htmlFor="nome-completo" className="mb-1.5 block text-[14.5px] font-medium text-brand-ink-soft">Nome completo</label>
              <input
                id="nome-completo"
                placeholder="Seu nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-[14px] border-[1.5px] border-brand-line-strong bg-brand-card px-4 py-4 text-brand-ink placeholder:italic placeholder:text-brand-ink-dim/70 focus:border-brand-purple focus:outline-none focus:ring-4 focus:ring-brand-purple/10"
              />
            </div>

            <Button
              variant="gold"
              onClick={() => setTela('perfil')}
              disabled={!nome.trim()}
              className="mt-6"
            >
              Iniciar diagnóstico <ArrowRight size={17} strokeWidth={2.25} />
            </Button>
          </div>
        </main>
      </div>
    )
  }

  if (tela === 'intro') {
    return (
      <div className="relative flex min-h-screen flex-col overflow-hidden bg-brand-bg">
        {/* Ícone da marca (o "olho") como marca-d'água decorativa, atrás do conteúdo. */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 -top-10 opacity-[0.06]"
          width="420"
          height="420"
          viewBox="-15 -15 320 420"
          style={{ transform: 'rotate(-8deg)' }}
        >
          <path d="M114.005 1.24982e-05C114.474 -0.000487502 114.943 0.0140133 115.412 0.0437633C137.646 1.46326 146.237 27.1058 130.492 42.1793C126.404 46.0933 117.094 48.0828 111.65 50.4063C99.8631 55.3205 88.9161 62.0448 79.2043 70.3365C74.3256 74.5065 73.3038 76.061 69.5171 80.8105C59.4943 93.3808 55.9448 106.396 54.9756 122.235C54.9218 123.114 54.6976 124.202 55.2436 124.838C55.9328 124.608 60.8981 119.723 61.7871 118.899C109.12 75.0638 178.935 62.2893 230.575 106.661C238.21 113.222 246.515 121.322 252.843 129.604C269.155 151.335 281.083 177.351 283.938 204.518C288.758 250.383 266.705 293.208 230.02 319.973C216.05 330.166 187.892 346.583 170.859 347.973C163.359 348.096 154.893 344.011 150.554 337.881C146.776 332.463 145.269 325.781 146.358 319.268C146.941 316.021 148.162 312.926 149.952 310.156C156.176 300.316 164.592 301.236 174.6 296.776C182.66 293.146 190.357 288.758 197.59 283.676C212.95 272.918 224.85 256.031 228.47 237.426C229.335 232.986 228.818 227.041 229.595 222.903L229.655 222.598C224.675 226.843 220.513 231.226 215.108 235.473C198.754 248.506 180.002 258.201 159.915 264.008C98.2291 281.513 41.2703 245.531 14.8048 190.474C13.1063 186.94 11.1481 183.516 9.6896 179.85C4.90635 167.72 1.82335 154.986 0.528097 142.011C-1.98615 115.196 4.52559 88.3088 19.0298 65.6155C35.7723 38.8815 60.6931 19.395 89.7094 7.45701C97.5359 4.23676 105.501 0.828262 114.005 1.24982e-05ZM171.273 334.023C175.267 333.598 181.792 330.838 185.559 329.338C201.433 323.013 216.353 313.831 229.155 302.528C230.255 301.558 232.335 300.311 233.308 299.341C237.403 295.261 241.74 290.913 245.393 286.438C256.785 272.561 264.688 256.511 268.628 238.981C269.448 235.326 269.463 231.621 270.055 228.093C271.675 218.461 270.488 209.998 269.503 200.394C268.705 192.62 266.68 186.258 264.08 178.921C255.535 154.073 240.19 132.121 219.788 115.56C200.728 100.25 179.511 92.4373 154.934 92.479C151.534 92.4848 147.78 93.048 144.419 93.375C120.241 95.7268 96.9198 108.243 78.1868 123.246C73.6671 126.866 68.5343 130.783 64.4268 134.925C58.2111 141.193 52.2328 148.184 46.4786 154.914C45.3341 151.622 44.6193 147.726 43.8613 144.31C39.5706 124.971 40.8393 105.343 49.2881 87.2828C60.5843 63.137 83.6041 46.9403 107.692 37.1428C113.482 34.788 120.972 34.3995 123.87 28.1648C127.354 21.1495 121.455 12.502 113.678 13.2158C107.751 14.4423 102.181 16.801 96.6156 19.1228C69.5176 30.1833 46.3711 49.135 30.1808 73.5173C27.6233 77.4183 25.8033 81.154 23.8436 85.35C13.7813 106.938 11.0986 131.235 16.2093 154.498C18.2218 164.054 21.7271 174.334 26.0081 183.08C27.1146 185.341 28.7843 187.706 30.0173 189.954C41.1538 210.263 56.6346 227.998 76.1544 240.626C79.8161 242.996 85.3241 245.231 89.2836 247.018C108.707 255.791 130.744 257.196 151.429 252.441C156.313 251.248 161.204 249.843 165.885 247.931C170.391 246.086 175.387 244.461 179.72 242.133C195.501 233.661 210.052 222.303 222.833 209.803C225.233 207.458 236.338 193.79 237.92 193.016C239.428 195.063 241.89 208.751 242.215 212.041C242.945 220.946 243.108 230.086 242.01 238.948C241.278 244.863 239.255 249.783 237.248 255.158C227.133 282.231 203.61 299.333 177.778 309.998C173.213 311.881 168.006 312.716 163.748 315.238C159.087 318.128 158.294 325.658 161.572 329.863C164.363 333.443 167.015 333.966 171.273 334.023Z" fill="#01123A" />
          <path d="M144.018 120C153.402 119.614 164.115 121.248 172.959 124.226C196.708 132.419 216.275 149.633 227.428 172.145C224.14 179.163 221.075 183.178 215.558 188.574C213.538 190.625 211.713 192.988 209.68 195.008C191.406 213.173 166.843 227.623 140.624 228.143C107.004 228.481 83.1954 211.873 63.4524 186.458C61.9186 184.484 56.9411 179 57.1734 176.564C57.5826 172.268 64.6131 164.492 67.2324 160.781C84.1484 140.525 106.241 125.424 132.566 120.967C135.386 120.472 140.956 120.255 144.018 120ZM72.7099 176.4C76.7726 182.307 83.3016 188.821 88.5999 193.778C98.7486 203.272 112.278 210.603 126.025 213.151C130.601 214.013 135.251 214.426 139.907 214.376C158.71 213.276 172.732 207.191 187.513 195.796C197.372 188.194 204.332 181.85 211.948 172.003C197.974 153.461 182.879 138.674 158.974 134.168C155.733 133.557 148.454 132.713 145.281 132.998C140.801 133.348 134.985 133.8 130.677 134.828C106.329 140.637 87.6831 157.152 72.7099 176.4Z" fill="#01123A" />
          <path d="M121.7 141.505C122.743 141.798 126.239 146.408 127.567 147.592C138.533 157.372 153.49 159.425 167.41 155.905C170.66 155.083 173.491 153.872 176.693 152.967C174.867 154.848 173.368 156.043 171.515 158.217C161.315 169.631 156.693 183.069 160.691 198.17C161.08 199.64 163.626 205.306 163.453 206.226C161.675 205.078 159.416 202.243 157.62 200.747C142.596 188.23 126.78 185.845 109.389 195.307C110.592 193.132 111.986 191.849 113.647 190.04C117.225 186.143 119.962 182.772 122.1 177.889C127.563 165.407 126.855 153.985 121.7 141.505Z" fill="#01123A" />
        </svg>

        <main className="relative flex flex-1 items-start justify-center px-6 py-10">
          <div className="w-full max-w-md text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático da marca, sem necessidade do pipeline de otimização de imagem */}
            <img src="/brand/versao01-color0.svg" alt="VDE Concursos — Tribunais" width={1163} height={393} className="mx-auto h-16 w-auto" />
            <ProgressBar progresso={0} />
            <div className="mt-7">
              <Eyebrow>A janela é agora</Eyebrow>
            </div>
            <h1 className="mt-3 text-[26px] font-bold leading-tight tracking-[-0.015em] text-brand-ink">
              O segundo semestre de 2026 e o ano de 2027 vão ser dos concursos de tribunais.
            </h1>
            <p className="mt-4 text-[17px] leading-relaxed text-brand-ink-soft">
              TRT8 já com banca definida. TRF3, TRT4, TJ AM, TJ GO e a DPU na fila.{' '}
              <b className="text-brand-ink">É a maior sequência de editais de tribunal dos últimos anos.</b>
            </p>
            <p className="mt-4 text-[17px] leading-relaxed text-brand-ink-soft">
              Não dá pra desperdiçar essas oportunidades. Quem chega despreparado não perde só uma prova: perde o ciclo inteiro, porque o próximo edital do mesmo tribunal demora anos.
            </p>
            <p className="mt-4 text-[17px] leading-relaxed text-brand-ink-soft">
              E o que separa quem aproveita essa janela de quem assiste ela passar é saber em que momento da preparação está. <b className="text-brand-ink">Este diagnóstico revela o seu em menos de 3 minutos.</b>
            </p>
            {/* Retomando (F5 no meio do funil): `estado` já existe, pula direto pro
                perfilamento. Sem sessão em cache: fluxo 'final' pede só o nome
                agora (capa vem no fim); fluxo padrão pede tudo na capa já.
                Brilho na borda (anel claro + halo dourado) por cima da sombra padrão do Button. */}
            <Button
              variant="gold"
              onClick={() => setTela(estado ? 'perfil' : fluxoFinal ? 'nome' : 'capa')}
              className="mt-8"
              style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.4) inset, 0 0 40px rgba(249,224,138,0.6), 0 10px 24px rgba(200,155,24,0.28)' }}
            >
              Quero descobrir meu momento <ArrowRight size={17} strokeWidth={2.25} />
            </Button>
          </div>
        </main>
      </div>
    )
  }

  if (tela === 'perfil') {
    const telaAtual = PERFIL_SCREENS[passoPerfil]
    const opts = valAplicado(telaAtual.opts, respostasPerfil)
    const hint = telaAtual.hint ? valAplicado(telaAtual.hint, respostasPerfil) : undefined
    const progresso = Math.round((passoPerfil / PASSOS_POS_INTRO) * 100)
    return (
      <div className="flex min-h-screen flex-col">
        <Header progresso={progresso} />
        <main className="flex flex-1 items-start justify-center px-6 py-8">
          <div className="w-full max-w-md">
            <p className="text-sm text-brand-ink-dim">Pergunta {passoPerfil + 1} de {PERFIL_SCREENS.length}</p>
            <h1 className="mt-2 text-2xl font-bold leading-tight tracking-[-0.01em] text-brand-ink">{telaAtual.title}</h1>
            {hint && <p className="mt-2 text-[15px] text-brand-ink-dim">{hint}</p>}

            <div className="mt-6 flex flex-col gap-2.5">
              {opts.map(([valor, texto, sub]: Opcao) => {
                const selecionado = telaAtual.type === 'multi' ? selecaoMulti.includes(valor) : respostasPerfil[telaAtual.key] === valor
                return (
                  <OptionButton
                    key={valor}
                    multi={telaAtual.type === 'multi'}
                    selected={selecionado}
                    sub={sub}
                    onClick={() => {
                      if (telaAtual.type === 'multi') {
                        if (valor === 'qualquer') {
                          setSelecaoMulti(['qualquer'])
                          return
                        }
                        setSelecaoMulti((sel) => {
                          const semQualquer = sel.filter((v) => v !== 'qualquer')
                          return semQualquer.includes(valor) ? semQualquer.filter((v) => v !== valor) : [...semQualquer, valor]
                        })
                        return
                      }
                      responderPerfilSingle(telaAtual.key, valor)
                    }}
                  >
                    {texto}
                  </OptionButton>
                )
              })}
            </div>

            {telaAtual.type === 'multi' && (
              <Button
                variant="navy"
                onClick={() => confirmarPerfilMulti(telaAtual.key)}
                disabled={selecaoMulti.length === 0}
                className="mt-6"
              >
                Continuar
              </Button>
            )}
          </div>
        </main>
      </div>
    )
  }

  if (tela === 'desqualificado') {
    let paragrafos: string[]
    if (motivoDesqualificacao === 'outro') {
      paragrafos = [
        'Pelo que você me contou, o seu foco hoje não é um concurso de tribunal. E o VDE Tribunais foi feito sob medida pra tribunal: TJ, TRF, TRT e os órgãos das funções essenciais.',
        'Prefiro te dizer isso agora e você chegar no seu concurso pelo caminho certo.',
      ]
    } else if (motivoDesqualificacao === 'juridica') {
      paragrafos = [
        'Juiz, promotor, defensor e procurador são carreiras jurídicas, e a preparação é outra: mais profundidade, mais fases, outro tipo de prova. O VDE Tribunais foi feito pra servidor de tribunal, então não é o curso certo pro seu objetivo.',
        'Pra carreiras jurídicas o VDE tem outra formação de base, o VDE Carreiras Jurídicas. Se fizer sentido, me chama no Instagram que eu te aponto o caminho.',
      ]
    } else {
      const alvoTxt = respostasPerfil.cargo === 'escrevente' ? 'escrevente' : 'técnico de nível médio'
      paragrafos = [
        `O VDE Tribunais é calibrado pro nível de analista e oficial de justiça, então ele aprofunda as matérias jurídicas mais do que a prova de ${alvoTxt} pede.`,
        'Prefiro te dizer isso agora. Se em algum momento o seu alvo virar analista, o raio-X continua aqui.',
      ]
    }
    const progressoDesqualificado = Math.round((passoPerfil / PASSOS_POS_INTRO) * 100)
    return (
      <div className="flex min-h-screen flex-col">
        <Header progresso={progressoDesqualificado} />
        <main className="flex flex-1 items-start justify-center px-6 py-10">
          <div className="w-full max-w-md text-center">
            <Eyebrow>Obrigada por responder</Eyebrow>
            <h2 className="mt-3 text-2xl font-bold leading-tight tracking-[-0.01em] text-brand-ink">Vou ser sincera com você: o seu caso pede outro caminho.</h2>
            {paragrafos.map((p, i) => (
              <p key={i} className="mt-4 text-[16.5px] leading-relaxed text-brand-ink-soft">{p}</p>
            ))}
            <p className="mt-4 text-[16.5px] leading-relaxed text-brand-ink-soft">Me acompanha no Instagram, que lá eu falo de concursos todo dia, de graça.</p>
            <a
              href={CONFIG.instagram}
              target="_blank"
              rel="noopener"
              className="mt-3 inline-flex items-center gap-1.5 font-semibold text-brand-purple"
            >
              @vdeconcursos <ArrowRight size={16} strokeWidth={2.5} />
            </a>
          </div>
        </main>
      </div>
    )
  }

  if (tela === 'mirror') {
    const cargo = labelCargo(respostasPerfil)
    const alvoLongo = respostasPerfil.alvo ? L.alvoLongo[respostasPerfil.alvo] : ''
    const escolhidos = editaisEscolhidos(respostasPerfil)
    const edFrase = escolhidos[0] ? `O ${escolhidos[0].label} já está na fila (${escolhidos[0].sub}), então o seu tempo tem dono. ` : ''
    const progresso = Math.round((PERFIL_SCREENS.length / PASSOS_POS_INTRO) * 100)
    return (
      <div className="flex min-h-screen flex-col">
        <Header progresso={progresso} />
        <main className="flex flex-1 items-start justify-center px-6 py-8">
          <div className="w-full max-w-md">
            <Eyebrow>Ficha fechada</Eyebrow>
            <h1 className="mt-3 text-2xl font-bold leading-tight tracking-[-0.01em] text-brand-ink">Anotei tudo. A sua ficha ficou assim:</h1>
            <div className="mt-6 flex flex-col gap-2">
              <LinhaFicha label="Seu alvo" valor={`${cargo} · ${alvoLongo}`} />
              <LinhaFicha label="Gargalo" valor={respostasPerfil.dor ? L.dorCurta[respostasPerfil.dor] : ''} />
              <LinhaFicha label="Momento" valor={respostasPerfil.momento ? L.momento[respostasPerfil.momento] : ''} />
              <LinhaFicha label="Tempo disponível" valor={respostasPerfil.horas ? L.horas[respostasPerfil.horas] : ''} />
              {escolhidos[0] && <LinhaFicha label="Prova na mira" valor={escolhidos[0].label} />}
            </div>
            <p className="mt-6 text-brand-ink-soft">{edFrase}Se estiver errado, volta e corrige. Se estiver certo, eu consigo te dizer com precisão o que atacar primeiro.</p>
            <Button variant="gold" onClick={() => setTela('video')} className="mt-6">
              Está certo, pode seguir
            </Button>
          </div>
        </main>
      </div>
    )
  }

  if (tela === 'video') {
    const progresso = Math.round(((PERFIL_SCREENS.length + 1) / PASSOS_POS_INTRO) * 100)
    return (
      <div className="flex min-h-screen flex-col">
        <Header progresso={progresso} />
        <main className="flex flex-1 items-start justify-center px-6 py-8">
          <div className="w-full max-w-md text-center">
            <h2 className="text-xl font-bold leading-tight tracking-[-0.01em] text-brand-ink">Para tudo. Isso aqui vale os seus próximos 40 segundos.</h2>
            <div className="mx-auto mt-6 flex aspect-[9/16] max-w-64 flex-col items-center justify-center gap-3.5 rounded-[22px] bg-gradient-to-b from-brand-navy-2 to-brand-navy px-7 text-center shadow-[0_10px_30px_rgba(1,18,58,0.25)]">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border-[1.5px] border-white/35 bg-white/10">
                <Play size={22} strokeWidth={2} className="ml-0.5 fill-brand-gold text-brand-gold" />
              </span>
              <p className="text-[14px] font-semibold text-brand-gold">Vídeo da Ana Clara</p>
              <p className="text-[13px] leading-relaxed text-white/80">
                Roteiro em roteiro-video.md. Troque CONFIG.videoSrc pelo link do arquivo.
              </p>
            </div>
            <Button variant="gold" onClick={() => setTela('dinheiro')} className="mt-6">
              Entendi, continuar <ArrowRight size={17} strokeWidth={2.25} />
            </Button>
          </div>
        </main>
      </div>
    )
  }

  if (tela === 'dinheiro') {
    const opts = valAplicado(TELA_DINHEIRO.opts, respostasPerfil)
    const progresso = Math.round(((PERFIL_SCREENS.length + 2) / PASSOS_POS_INTRO) * 100)
    return (
      <div className="flex min-h-screen flex-col">
        <Header progresso={progresso} />
        <main className="flex flex-1 items-start justify-center px-6 py-8">
          <div className="w-full max-w-md">
            <h1 className="text-2xl font-bold leading-tight tracking-[-0.01em] text-brand-ink">{TELA_DINHEIRO.title}</h1>
            {TELA_DINHEIRO.hint && <p className="mt-2 text-[15px] text-brand-ink-dim">{valAplicado(TELA_DINHEIRO.hint, respostasPerfil)}</p>}
            <div className="mt-6 flex flex-col gap-2.5">
              {opts.map(([valor, texto, sub]: Opcao) => (
                <OptionButton key={valor} selected={false} sub={sub} onClick={() => responderDinheiro(valor)}>
                  {texto}
                </OptionButton>
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (tela === 'conta') {
    const conta = calcularConta(respostasPerfil)
    const progresso = Math.round(((PERFIL_SCREENS.length + 3) / PASSOS_POS_INTRO) * 100)
    return (
      <div className="flex min-h-screen flex-col">
        <Header progresso={progresso} />
        <main className="flex flex-1 items-start justify-center px-6 py-8">
          <div className="w-full max-w-md">
            <h1 className="text-2xl font-bold leading-tight tracking-[-0.01em] text-brand-ink">{conta.titulo}</h1>
            <p className="mt-4 text-brand-ink-soft">{conta.paragrafo}</p>
            <p className="mt-4 text-brand-ink-soft">
              Escrevi isso porque essa conta só para de correr quando a preparação deixa de ser improviso e vira base.
            </p>
            <p className="mt-4 text-brand-ink-soft">
              <b className="text-brand-ink">Agora eu preciso ver a sua base na prática.</b> Vêm 4 questões reais de FGV e FCC: Português, Constitucional, Processo Civil e Raciocínio Lógico. Pode errar à vontade: elas servem pra medir o seu nível de partida, e o resultado entra no seu diagnóstico.
            </p>
            <Button variant="gold" onClick={() => setTela('quiz')} className="mt-6">
              Quero encurtar esse caminho <ArrowRight size={17} strokeWidth={2.25} />
            </Button>
          </div>
        </main>
      </div>
    )
  }

  if (tela === 'quiz') {
    const questao = QUESTIONS[atual]
    const progresso = Math.round(((PERFIL_SCREENS.length + 4 + atual) / PASSOS_POS_INTRO) * 100)
    return (
      <div className="flex min-h-screen flex-col">
        <Header progresso={progresso} />
        <main className="flex flex-1 items-start justify-center px-6 py-8">
          <div className="w-full max-w-md">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[18px] font-bold text-brand-ink">Questão {atual + 1} de {TOTAL}</span>
              <span className="text-right text-[12.5px] text-brand-ink-dim">{questao.area}</span>
            </div>

            {erro && <AlertaErro mensagem={erro} />}

            <p className="mt-5 text-[16px] leading-relaxed text-brand-ink">{questao.statement}</p>

            <div className="mt-6 flex flex-col gap-2.5">
              {questao.options.map((o) => (
                <OptionButton
                  key={o.letter}
                  selected={respostasTeste[questao.num] === o.letter}
                  disabled={enviando}
                  onClick={() => responder(o.letter)}
                >
                  <span className="font-semibold text-brand-navy">{o.letter}</span> <span>{o.text}</span>
                </OptionButton>
              ))}
            </div>
            <p className="mt-5 text-center text-[13.5px] text-brand-ink-dim">Questão que já caiu, sem adaptação. Sem pressa e sem chute automático.</p>
          </div>
        </main>
      </div>
    )
  }

  if (tela === 'correcao') {
    const acertos = Object.entries(respostasTeste).filter(([num, letra]) => {
      const q = QUESTIONS.find((qq) => qq.num === Number(num))
      return q && q.correct === letra
    }).length
    const progresso = Math.round(((PERFIL_SCREENS.length + 4 + TOTAL) / PASSOS_POS_INTRO) * 100)
    return (
      <div className="flex min-h-screen flex-col">
        <Header progresso={progresso} />
        <main className="flex flex-1 items-start justify-center px-6 py-8">
          <div className="w-full max-w-md">
            <Eyebrow>Corrigido na hora</Eyebrow>
            <h1 className="mt-3 text-2xl font-bold leading-tight tracking-[-0.01em] text-brand-ink">Você acertou {acertos} de {QUESTIONS.length}.</h1>
            <p className="mt-3 text-brand-ink-soft">{MENSAGENS_CORRECAO[acertos]}</p>
            <div className="mt-6 flex flex-col gap-2.5">
              {QUESTIONS.map((q) => {
                const ok = respostasTeste[q.num] === q.correct
                return (
                  <div key={q.num} className="flex items-start gap-3 rounded-[14px] border-[1.5px] border-brand-line bg-brand-card px-4 py-3.5">
                    <span
                      className={`mt-0.5 flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-white ${ok ? 'bg-brand-green' : 'bg-brand-red'}`}
                    >
                      {ok ? <Check size={15} strokeWidth={3} /> : <X size={15} strokeWidth={3} />}
                    </span>
                    <div className="flex-1">
                      <p className="text-[14px] font-semibold text-brand-ink">{q.area} · gabarito {q.correct}</p>
                      <p className="mt-1 text-[14px] leading-relaxed text-brand-ink-soft">{q.comment.join(' ')}</p>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-6 text-brand-ink-soft">
              Sozinho, esse número vale pouco. Cruzado com o seu tempo de estudo, o seu ritmo e o seu histórico de provas, ele fecha a leitura.
            </p>
            <Button variant="gold" onClick={() => setTela('leitura')} className="mt-6">
              Fechar meu raio-X <ArrowRight size={17} strokeWidth={2.25} />
            </Button>
          </div>
        </main>
      </div>
    )
  }

  if (tela === 'leitura') {
    const opts = valAplicado(TELA_LEITURA.opts, respostasPerfil)
    const progresso = Math.round(((PERFIL_SCREENS.length + 4 + TOTAL + 1) / PASSOS_POS_INTRO) * 100)
    return (
      <div className="flex min-h-screen flex-col">
        <Header progresso={progresso} />
        <main className="flex flex-1 items-start justify-center px-6 py-8">
          <div className="w-full max-w-md">
            <h1 className="text-2xl font-bold leading-tight tracking-[-0.01em] text-brand-ink">{TELA_LEITURA.title}</h1>
            <div className="mt-6 flex flex-col gap-2.5">
              {opts.map(([valor, texto]: Opcao) => (
                <OptionButton key={valor} selected={false} onClick={() => responderLeitura(valor)}>
                  {texto}
                </OptionButton>
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Fluxo com contato no final: pede WhatsApp/e-mail depois da leitura, cria
  // a sessão só agora e submete tudo de uma vez (start → answer × N → finish).
  if (tela === 'contato') {
    const progresso = Math.round(((PERFIL_SCREENS.length + 4 + TOTAL + 2) / PASSOS_POS_INTRO) * 100)
    return (
      <div className="flex min-h-screen flex-col">
        <Header progresso={progresso} />
        <main className="flex flex-1 items-start justify-center px-6 py-8">
          <div className="w-full max-w-md">
            <h1 className="text-2xl font-bold leading-tight tracking-[-0.01em] text-brand-ink">Terminei a sua leitura. Pra onde eu mando o seu raio-X?</h1>

            {erro && <AlertaErro mensagem={erro} />}

            <div className="mt-6 flex flex-col gap-3.5">
              <div className="text-left">
                <label htmlFor="contato-whatsapp" className="mb-1.5 block text-[14.5px] font-medium text-brand-ink-soft">WhatsApp</label>
                <input
                  id="contato-whatsapp"
                  placeholder="(DDD) 00000-0000"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full rounded-[14px] border-[1.5px] border-brand-line-strong bg-brand-card px-4 py-4 text-brand-ink placeholder:italic placeholder:text-brand-ink-dim/70 focus:border-brand-purple focus:outline-none focus:ring-4 focus:ring-brand-purple/10"
                />
              </div>
              <div className="text-left">
                <label htmlFor="contato-email" className="mb-1.5 block text-[14.5px] font-medium text-brand-ink-soft">E-mail</label>
                <input
                  id="contato-email"
                  placeholder="Seu melhor e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-[14px] border-[1.5px] border-brand-line-strong bg-brand-card px-4 py-4 text-brand-ink placeholder:italic placeholder:text-brand-ink-dim/70 focus:border-brand-purple focus:outline-none focus:ring-4 focus:ring-brand-purple/10"
                />
              </div>
            </div>

            <Button variant="gold" onClick={enviarContato} disabled={enviando} className="mt-6">
              Ver meu diagnóstico <ArrowRight size={17} strokeWidth={2.25} />
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // resultado
  const diagnostico = respostasPerfil.momento ? DIAG[respostasPerfil.momento] : undefined
  const perfilCalculado = resultado ? calcularPerfil(respostasPerfil, resultado.acertos) : null
  const nivel = resultado ? nivelTeste(resultado.acertos) : ''
  const primeiroNome = (nome || estado?.nome || '').split(' ')[0]
  const cargo = labelCargo(respostasPerfil)
  const alvoLabel = respostasPerfil.alvo ? L.alvo[respostasPerfil.alvo] : ''
  const alvoLongo = respostasPerfil.alvo ? L.alvoLongo[respostasPerfil.alvo] : ''
  const link = resultado
    ? waLink(nome || estado?.nome || '', respostasPerfil, perfilCalculado?.classe ?? 'B', perfilCalculado?.cursoCod ?? 'C2-TJTRF', nivel, resultado.acertos, resultado.total)
    : '#'

  const frases: (FraseComNegrito | null)[] = [
    fraseEdital(respostasPerfil),
    fraseRetaFinal(respostasPerfil),
    fraseExtraCargo(respostasPerfil),
    fraseVde(respostasPerfil),
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <Header progresso={100} />
      <main className="flex flex-1 items-start justify-center px-6 py-8">
        <div className="w-full max-w-md">
          <Eyebrow>Raio-X da Base</Eyebrow>
          <h2 className="mt-3 text-2xl font-bold leading-tight tracking-[-0.01em] text-brand-ink">
            {primeiroNome ? `${primeiroNome}, o` : 'O'} que eu enxerguei no seu caso.
          </h2>

          {resultado && (
            <>
              <div className="mt-6 flex flex-col gap-2">
                <LinhaFicha label="Onde você está" valor={respostasPerfil.momento ? L.momento[respostasPerfil.momento] : ''} />
                <LinhaFicha label="Alvo" valor={`${cargo} · ${alvoLabel}`} />
                <LinhaFicha label="Curso indicado" valor={perfilCalculado?.curso ?? ''} />
                <LinhaFicha label="Nível no teste" valor={`${nivel} · ${resultado.acertos} de ${resultado.total}`} />
                <LinhaFicha label="Ritmo" valor={perfilCalculado?.ritmo ?? ''} />
              </div>

              <h3 className="mt-8 font-bold text-brand-navy">O que eu li do seu caso</h3>
              {diagnostico && (
                <>
                  <p className="mt-2"><b className="text-brand-ink">{diagnostico.titulo}</b></p>
                  {diagnostico.texto.map((t, i) => (
                    <p key={i} className="mt-2 text-brand-ink-soft">{t}</p>
                  ))}
                  <div className="mt-3 rounded-[14px] border-[1.5px] border-brand-line border-l-4 border-l-brand-gold-deep bg-brand-card px-4 py-3.5">
                    <p><b>Começa por aqui:</b> {diagnostico.prescricao}</p>
                  </div>
                  {respostasPerfil.leitura === 'completa' && (
                    <>
                      <h3 className="mt-6 font-bold text-brand-navy">A ordem que eu seguiria</h3>
                      <ol className="mt-2 list-decimal pl-5 text-brand-ink-soft">
                        {diagnostico.ordem.map((item, i) => (
                          <li key={i} className="mt-1">{item}</li>
                        ))}
                      </ol>
                    </>
                  )}
                </>
              )}

              {frases.map((f, i) => f && (
                <p key={i} className="mt-4 text-brand-ink-soft">
                  {f.negrito && <b className="text-brand-ink">{f.negrito} </b>}
                  {f.texto}
                </p>
              ))}

              <h3 className="mt-8 inline-block rounded-lg bg-brand-lav px-2.5 py-1 font-bold text-brand-navy">Onde isso vira um plano</h3>
              <p className="mt-4 text-brand-ink-soft">
                Este raio-X leu o seu caso por cima, com o que dá pra ler em doze perguntas e quatro questões.
              </p>
              <p className="mt-4 text-brand-ink-soft">
                O seu caso tem os requisitos pra ir mais fundo: uma <b className="text-brand-ink">conversa de uns 20 minutos com um consultor do meu time</b>. É ele quem abre o seu caso em detalhe, cruza o que você respondeu com o edital de {alvoLongo} e monta o seu plano de ação: o que priorizar agora, o que vem depois e o que pode esperar.
              </p>
              <p className="mt-4 text-brand-ink-soft">Não custa nada. Só que a agenda é curta: cada consultor abre poucos horários por semana.</p>
              <p className="mt-4 text-brand-ink-soft">Clica aqui embaixo e vê o que sobrou pra esta semana.</p>

              <a
                href={link}
                target="_blank"
                rel="noopener"
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-brand-gold to-brand-gold-deep px-6 py-4 text-[15.5px] font-semibold text-brand-navy shadow-[0_10px_24px_rgba(200,155,24,0.28)] transition-transform hover:-translate-y-0.5"
              >
                {/* Ícone de marca (WhatsApp) — fora do set genérico do lucide, mantido como SVG inline. */}
                <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden="true">
                  <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6c.2-.2.2-.4.3-.6.1-.2 0-.4 0-.6l-.9-2.1c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.4c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3C4 15 3.7 13.5 3.7 12c0-4.6 3.7-8.3 8.3-8.3s8.3 3.7 8.3 8.3-3.7 8.2-8.3 8.2z" />
                </svg>
                Falar com o time no WhatsApp
              </a>
              <p className="mt-2 text-center text-[12.5px] text-brand-ink-dim">Abre o WhatsApp com a sua mensagem já escrita. É só enviar.</p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

// Linha "rótulo à esquerda, valor à direita" reaproveitada nas telas
// ficha/mirror e resultado — mesmo padrão do `.kv` do funil de referência.
function LinhaFicha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3 rounded-[14px] border-[1.5px] border-brand-line bg-brand-card px-4 py-3 text-[15px]">
      <span className="text-brand-ink-dim">{label}</span>
      <span className="text-right font-semibold text-brand-ink">{valor}</span>
    </div>
  )
}
