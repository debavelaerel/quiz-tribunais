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

type Tela =
  | 'capa' | 'restaurando'
  | 'intro' | 'perfil' | 'desqualificado'
  | 'mirror' | 'video' | 'dinheiro' | 'conta'
  | 'quiz' | 'correcao' | 'leitura'
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
// para desenhar a barra de progresso do Header (mesma regra visual do funil
// de referência: escondida em idx===0 e nas telas terminais).
const PASSOS_POS_INTRO = PERFIL_SCREENS.length + 4 /* mirror, video, dinheiro, conta */ + TOTAL + 2 /* correcao, leitura */

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
    setTela('resultado')
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

  if (tela === 'intro') {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-start justify-center px-6 py-10">
          <div className="w-full max-w-md text-center">
            <Eyebrow>A janela é agora</Eyebrow>
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
            {/* Sem sessão em cache: precisa se identificar antes do perfilamento.
                Retomando (F5 no meio do funil): `estado` já existe, pula a capa. */}
            <Button variant="gold" onClick={() => setTela(estado ? 'perfil' : 'capa')} className="mt-8">
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
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
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
      <Header />
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
