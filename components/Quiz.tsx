'use client'

import { useEffect, useRef, useState } from 'react'
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
      setTela('intro')
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

  if (tela === 'intro') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <p className="text-sm font-medium text-brand-navy">A janela é agora</p>
          <h1 className="mt-3 text-2xl font-semibold leading-tight text-brand-navy-ink">
            O segundo semestre de 2026 e o ano de 2027 vão ser dos concursos de tribunais.
          </h1>
          <p className="mt-4 text-brand-ink/70">
            TRT8 já com banca definida. TRF3, TRT4, TJ AM, TJ GO e a DPU na fila. <b>É a maior sequência de editais de tribunal dos últimos anos.</b>
          </p>
          <p className="mt-4 text-brand-ink/70">
            Não dá pra desperdiçar essas oportunidades. Quem chega despreparado não perde só uma prova: perde o ciclo inteiro, porque o próximo edital do mesmo tribunal demora anos.
          </p>
          <p className="mt-4 text-brand-ink/70">
            E o que separa quem aproveita essa janela de quem assiste ela passar é saber em que momento da preparação está. <b>Este diagnóstico revela o seu em menos de 3 minutos.</b>
          </p>
          <button
            onClick={() => setTela('perfil')}
            className="mt-8 w-full rounded-lg bg-brand-navy px-6 py-3 font-medium text-white transition-colors hover:bg-brand-navy-ink"
          >
            Quero descobrir meu momento →
          </button>
        </div>
      </main>
    )
  }

  if (tela === 'perfil') {
    const telaAtual = PERFIL_SCREENS[passoPerfil]
    const opts = valAplicado(telaAtual.opts, respostasPerfil)
    const hint = telaAtual.hint ? valAplicado(telaAtual.hint, respostasPerfil) : undefined
    return (
      <main className="flex min-h-screen justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <p className="text-sm text-brand-ink/60">Pergunta {passoPerfil + 1} de {PERFIL_SCREENS.length}</p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight text-brand-navy-ink">{telaAtual.title}</h1>
          {hint && <p className="mt-2 text-sm text-brand-ink/60">{hint}</p>}

          <div className="mt-6 flex flex-col gap-2.5">
            {opts.map(([valor, texto, sub]: Opcao) => {
              const selecionado = telaAtual.type === 'multi' ? selecaoMulti.includes(valor) : respostasPerfil[telaAtual.key] === valor
              return (
                <button
                  key={valor}
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
                  className={`rounded-lg border px-4 py-3 text-left text-brand-ink transition-colors ${
                    selecionado ? 'border-brand-navy bg-brand-navy/5' : 'border-brand-line bg-white hover:border-brand-navy'
                  }`}
                >
                  <span>{texto}</span>
                  {sub && <span className="mt-0.5 block text-sm text-brand-ink/60">{sub}</span>}
                </button>
              )
            })}
          </div>

          {telaAtual.type === 'multi' && (
            <button
              onClick={() => confirmarPerfilMulti(telaAtual.key)}
              disabled={selecaoMulti.length === 0}
              className="mt-6 w-full rounded-lg bg-brand-navy px-6 py-3 font-medium text-white transition-colors hover:bg-brand-navy-ink disabled:opacity-50"
            >
              Continuar
            </button>
          )}
        </div>
      </main>
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
      <main className="flex min-h-screen items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <p className="text-sm font-medium text-brand-navy">Obrigada por responder</p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight text-brand-navy-ink">Vou ser sincera com você: o seu caso pede outro caminho.</h2>
          {paragrafos.map((p, i) => (
            <p key={i} className="mt-4 text-brand-ink/70">{p}</p>
          ))}
          <p className="mt-4 text-brand-ink/70">Me acompanha no Instagram, que lá eu falo de concursos todo dia, de graça.</p>
          <a
            href={CONFIG.instagram}
            target="_blank"
            rel="noopener"
            className="mt-4 inline-block font-medium text-brand-navy underline"
          >
            @vdeconcursos →
          </a>
        </div>
      </main>
    )
  }

  if (tela === 'mirror') {
    const cargo = labelCargo(respostasPerfil)
    const alvoLongo = respostasPerfil.alvo ? L.alvoLongo[respostasPerfil.alvo] : ''
    const escolhidos = editaisEscolhidos(respostasPerfil)
    const edFrase = escolhidos[0] ? `O ${escolhidos[0].label} já está na fila (${escolhidos[0].sub}), então o seu tempo tem dono. ` : ''
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <p className="text-sm font-medium text-brand-navy">Ficha fechada</p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight text-brand-navy-ink">Anotei tudo. A sua ficha ficou assim:</h1>
          <div className="mt-6 flex flex-col gap-2">
            <div className="flex justify-between rounded-lg border border-brand-line bg-white px-4 py-3 text-sm">
              <span className="text-brand-ink/60">Seu alvo</span>
              <span className="font-medium text-right">{cargo} · {alvoLongo}</span>
            </div>
            <div className="flex justify-between rounded-lg border border-brand-line bg-white px-4 py-3 text-sm">
              <span className="text-brand-ink/60">Gargalo</span>
              <span className="font-medium text-right">{respostasPerfil.dor ? L.dorCurta[respostasPerfil.dor] : ''}</span>
            </div>
            <div className="flex justify-between rounded-lg border border-brand-line bg-white px-4 py-3 text-sm">
              <span className="text-brand-ink/60">Momento</span>
              <span className="font-medium text-right">{respostasPerfil.momento ? L.momento[respostasPerfil.momento] : ''}</span>
            </div>
            <div className="flex justify-between rounded-lg border border-brand-line bg-white px-4 py-3 text-sm">
              <span className="text-brand-ink/60">Tempo disponível</span>
              <span className="font-medium text-right">{respostasPerfil.horas ? L.horas[respostasPerfil.horas] : ''}</span>
            </div>
            {escolhidos[0] && (
              <div className="flex justify-between rounded-lg border border-brand-line bg-white px-4 py-3 text-sm">
                <span className="text-brand-ink/60">Prova na mira</span>
                <span className="font-medium text-right">{escolhidos[0].label}</span>
              </div>
            )}
          </div>
          <p className="mt-6 text-brand-ink/70">{edFrase}Se estiver errado, volta e corrige. Se estiver certo, eu consigo te dizer com precisão o que atacar primeiro.</p>
          <button
            onClick={() => setTela('video')}
            className="mt-6 w-full rounded-lg bg-brand-navy px-6 py-3 font-medium text-white transition-colors hover:bg-brand-navy-ink"
          >
            Está certo, pode seguir
          </button>
        </div>
      </main>
    )
  }

  if (tela === 'video') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <h2 className="text-xl font-semibold leading-tight text-brand-navy-ink">Para tudo. Isso aqui vale os seus próximos 40 segundos.</h2>
          <div className="mx-auto mt-6 flex aspect-[9/16] max-w-64 flex-col items-center justify-center gap-2 rounded-2xl bg-brand-navy-ink px-6 text-center text-white">
            <b>Vídeo da Ana Clara</b>
            <p className="text-sm text-white/80">Roteiro em roteiro-video.md. Troque CONFIG.videoSrc pelo link do arquivo.</p>
          </div>
          <button
            onClick={() => setTela('dinheiro')}
            className="mt-6 w-full rounded-lg bg-brand-navy px-6 py-3 font-medium text-white transition-colors hover:bg-brand-navy-ink"
          >
            Entendi, continuar →
          </button>
        </div>
      </main>
    )
  }

  if (tela === 'dinheiro') {
    const opts = valAplicado(TELA_DINHEIRO.opts, respostasPerfil)
    return (
      <main className="flex min-h-screen justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold leading-tight text-brand-navy-ink">{TELA_DINHEIRO.title}</h1>
          {TELA_DINHEIRO.hint && <p className="mt-2 text-sm text-brand-ink/60">{valAplicado(TELA_DINHEIRO.hint, respostasPerfil)}</p>}
          <div className="mt-6 flex flex-col gap-2.5">
            {opts.map(([valor, texto, sub]: Opcao) => (
              <button
                key={valor}
                onClick={() => responderDinheiro(valor)}
                className="rounded-lg border border-brand-line bg-white px-4 py-3 text-left text-brand-ink transition-colors hover:border-brand-navy"
              >
                <span>{texto}</span>
                {sub && <span className="mt-0.5 block text-sm text-brand-ink/60">{sub}</span>}
              </button>
            ))}
          </div>
        </div>
      </main>
    )
  }

  if (tela === 'conta') {
    const conta = calcularConta(respostasPerfil)
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold leading-tight text-brand-navy-ink">{conta.titulo}</h1>
          <p className="mt-4 text-brand-ink/70">{conta.paragrafo}</p>
          <p className="mt-4 text-brand-ink/70">
            Escrevi isso porque essa conta só para de correr quando a preparação deixa de ser improviso e vira base.
          </p>
          <p className="mt-4 text-brand-ink/70">
            <b>Agora eu preciso ver a sua base na prática.</b> Vêm 4 questões reais de FGV e FCC: Português, Constitucional, Processo Civil e Raciocínio Lógico. Pode errar à vontade: elas servem pra medir o seu nível de partida, e o resultado entra no seu diagnóstico.
          </p>
          <button
            onClick={() => setTela('quiz')}
            className="mt-6 w-full rounded-lg bg-brand-navy px-6 py-3 font-medium text-white transition-colors hover:bg-brand-navy-ink"
          >
            Quero encurtar esse caminho →
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

  if (tela === 'correcao') {
    const acertos = Object.entries(respostasTeste).filter(([num, letra]) => {
      const q = QUESTIONS.find((qq) => qq.num === Number(num))
      return q && q.correct === letra
    }).length
    return (
      <main className="flex min-h-screen justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <p className="text-sm font-medium text-brand-navy">Corrigido na hora</p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight text-brand-navy-ink">Você acertou {acertos} de {QUESTIONS.length}.</h1>
          <p className="mt-3 text-brand-ink/70">{MENSAGENS_CORRECAO[acertos]}</p>
          <div className="mt-6 flex flex-col gap-2.5">
            {QUESTIONS.map((q) => {
              const ok = respostasTeste[q.num] === q.correct
              return (
                <div key={q.num} className={`rounded-lg border px-4 py-3 ${ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <p className="text-sm font-medium text-brand-navy-ink">{ok ? '✓' : '✗'} {q.area} · gabarito {q.correct}</p>
                  <p className="mt-1 text-sm text-brand-ink/70">{q.comment.join(' ')}</p>
                </div>
              )
            })}
          </div>
          <p className="mt-6 text-brand-ink/70">
            Sozinho, esse número vale pouco. Cruzado com o seu tempo de estudo, o seu ritmo e o seu histórico de provas, ele fecha a leitura.
          </p>
          <button
            onClick={() => setTela('leitura')}
            className="mt-6 w-full rounded-lg bg-brand-navy px-6 py-3 font-medium text-white transition-colors hover:bg-brand-navy-ink"
          >
            Fechar meu raio-X →
          </button>
        </div>
      </main>
    )
  }

  if (tela === 'leitura') {
    const opts = valAplicado(TELA_LEITURA.opts, respostasPerfil)
    return (
      <main className="flex min-h-screen justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold leading-tight text-brand-navy-ink">{TELA_LEITURA.title}</h1>
          <div className="mt-6 flex flex-col gap-2.5">
            {opts.map(([valor, texto]: Opcao) => (
              <button
                key={valor}
                onClick={() => responderLeitura(valor)}
                className="rounded-lg border border-brand-line bg-white px-4 py-3 text-left text-brand-ink transition-colors hover:border-brand-navy"
              >
                {texto}
              </button>
            ))}
          </div>
        </div>
      </main>
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
    <main className="flex min-h-screen justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <p className="text-sm font-medium text-brand-navy">Raio-X da Base</p>
        <h2 className="mt-2 text-2xl font-semibold leading-tight text-brand-navy-ink">
          {primeiroNome ? `${primeiroNome}, o` : 'O'} que eu enxerguei no seu caso.
        </h2>

        {resultado && (
          <>
            <div className="mt-6 flex flex-col gap-2">
              <div className="flex justify-between rounded-lg border border-brand-line bg-white px-4 py-3 text-sm">
                <span className="text-brand-ink/60">Onde você está</span>
                <span className="font-medium text-right">{respostasPerfil.momento ? L.momento[respostasPerfil.momento] : ''}</span>
              </div>
              <div className="flex justify-between rounded-lg border border-brand-line bg-white px-4 py-3 text-sm">
                <span className="text-brand-ink/60">Alvo</span>
                <span className="font-medium text-right">{cargo} · {alvoLabel}</span>
              </div>
              <div className="flex justify-between rounded-lg border border-brand-line bg-white px-4 py-3 text-sm">
                <span className="text-brand-ink/60">Curso indicado</span>
                <span className="font-medium text-right">{perfilCalculado?.curso}</span>
              </div>
              <div className="flex justify-between rounded-lg border border-brand-line bg-white px-4 py-3 text-sm">
                <span className="text-brand-ink/60">Nível no teste</span>
                <span className="font-medium text-right">{nivel} · {resultado.acertos} de {resultado.total}</span>
              </div>
              <div className="flex justify-between rounded-lg border border-brand-line bg-white px-4 py-3 text-sm">
                <span className="text-brand-ink/60">Ritmo</span>
                <span className="font-medium text-right">{perfilCalculado?.ritmo}</span>
              </div>
            </div>

            <h3 className="mt-8 font-semibold text-brand-navy">O que eu li do seu caso</h3>
            {diagnostico && (
              <>
                <p className="mt-2"><b className="text-brand-navy-ink">{diagnostico.titulo}</b></p>
                {diagnostico.texto.map((t, i) => (
                  <p key={i} className="mt-2 text-brand-ink/70">{t}</p>
                ))}
                <div className="mt-3 rounded-lg border-l-4 border-l-brand-navy bg-white px-4 py-3">
                  <p><b>Começa por aqui:</b> {diagnostico.prescricao}</p>
                </div>
                {respostasPerfil.leitura === 'completa' && (
                  <>
                    <h3 className="mt-6 font-semibold text-brand-navy">A ordem que eu seguiria</h3>
                    <ol className="mt-2 list-decimal pl-5 text-brand-ink/70">
                      {diagnostico.ordem.map((item, i) => (
                        <li key={i} className="mt-1">{item}</li>
                      ))}
                    </ol>
                  </>
                )}
              </>
            )}

            {frases.map((f, i) => f && (
              <p key={i} className="mt-4 text-brand-ink/70">
                {f.negrito && <b className="text-brand-navy-ink">{f.negrito} </b>}
                {f.texto}
              </p>
            ))}

            <h3 className="mt-8 inline-block rounded bg-brand-lilac/25 px-2 py-1 font-semibold text-brand-navy">Onde isso vira um plano</h3>
            <p className="mt-4 text-brand-ink/70">
              Este raio-X leu o seu caso por cima, com o que dá pra ler em doze perguntas e quatro questões.
            </p>
            <p className="mt-4 text-brand-ink/70">
              O seu caso tem os requisitos pra ir mais fundo: uma <b>conversa de uns 20 minutos com um consultor do meu time</b>. É ele quem abre o seu caso em detalhe, cruza o que você respondeu com o edital de {alvoLongo} e monta o seu plano de ação: o que priorizar agora, o que vem depois e o que pode esperar.
            </p>
            <p className="mt-4 text-brand-ink/70">Não custa nada. Só que a agenda é curta: cada consultor abre poucos horários por semana.</p>
            <p className="mt-4 text-brand-ink/70">Clica aqui embaixo e vê o que sobrou pra esta semana.</p>

            <a
              href={link}
              target="_blank"
              rel="noopener"
              className="mt-6 block w-full rounded-lg bg-brand-navy px-6 py-3 text-center font-medium text-white transition-colors hover:bg-brand-navy-ink"
            >
              Falar com o time no WhatsApp
            </a>
            <p className="mt-2 text-center text-xs text-brand-ink/50">Abre o WhatsApp com a sua mensagem já escrita. É só enviar.</p>
          </>
        )}
      </div>
    </main>
  )
}
