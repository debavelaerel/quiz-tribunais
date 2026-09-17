import { readFileSync } from 'fs'
import { join } from 'path'
import chromium from '@sparticuz/chromium'
import { chromium as playwrightChromium } from 'playwright-core'
import type { QuizSession } from './types'
import type { RespostasPerfil } from '../perfil'
import { CONFIG, DIAG, L, PERFIL_SCREENS, TELA_DINHEIRO, labelCargo, editaisEscolhidos, waLink } from '../quizContent'
import { QUESTIONS } from '../questions'

// Poppins embutida como @font-face em base64: `page.setContent` não faz
// requisição de rede nenhuma, então sem isso o Chromium headless renderia
// com a fonte de sistema (fallback silencioso, sem erro). Mesma ideia do
// pacote de referência (`reference/raio-x-da-base/diagnosis/assets.py`,
// `fonts_css()`), só que em TS/Node e lendo os .woff2 uma vez no carregamento
// do módulo (não a cada PDF). Só o subset "latin" (sem "latin-ext") — cobre
// pt-BR, que é o único idioma do laudo.
const FONTS_DIR = join(process.cwd(), 'reference/raio-x-da-base/assets/fonts/Poppins')

function fontFace(weight: number): string {
  const b64 = readFileSync(join(FONTS_DIR, `Poppins-${weight}-latin.woff2`)).toString('base64')
  return `@font-face { font-family: 'Poppins'; font-style: normal; font-weight: ${weight}; ` +
    `font-display: swap; src: url(data:font/woff2;base64,${b64}) format('woff2'); }`
}

// 400 (texto corrido) + 600 (.eyebrow/.cab .r/ol li::before) + 700 (peso que
// o navegador usa por padrão em h1/h2/h3/<b>, já que o CSS abaixo não define
// font-weight pra eles).
const FONT_FACES = [400, 600, 700].map(fontFace).join('\n')

// Mesma marca (wordmark "vde" + selo "Tribunais") do cabeçalho do quiz
// (components/Header.tsx, /brand/versao01-color0.svg) — lida uma vez no
// carregamento do módulo, igual às fontes, e embutida inline (não como
// <img src>, que exigiria uma requisição de arquivo que `page.setContent`
// não faz).
const LOGO_SVG = readFileSync(join(process.cwd(), 'public/brand/versao01-color0.svg'), 'utf-8')

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function dataPorExtenso(d = new Date()): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

// Porta a estrutura completa de reference/raio-x-da-base/diagnosis/report.py
// (capa, índice, ficha de respostas, fechamento com CTA) — só a paleta muda
// (tokens do app, não lilás/roxo do pacote; ver app/globals.css). O motivo
// de portar a estrutura inteira, e não só o miolo (leitura + blocos +
// questões) como a primeira versão deste arquivo fazia, está registrado na
// revisão que pegou a divergência: o laudo é o produto que o lead recebe
// depois da conversa comercial, e a capa/ficha/CTA são o que dá contexto e
// prova de personalização pra esse documento — sem elas, vira só um resumo
// solto do que já apareceu na tela de resultado.
const CSS = `
  ${FONT_FACES}
  :root {
    --bg: #FFFFFF; --creme: #EEF1F8; --card: #FFFFFF;
    --ink: #203C7C; --ink-soft: #5B6478; --ink-dim: #7C86A6;
    --line: #E7E7EA; --line-strong: #C9C9CE;
    --navy: #16305F; --gold: #F9E08A; --gold-deep: #C89B18; --gold-soft: #FBF3D6; --gold-text: #8A6A0C;
    --green: #2FB367; --red: #E03131;
  }
  @page { size: A4; margin: 18mm 15mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--ink);
    font-family: 'Poppins', system-ui, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .eyebrow { display: inline-block; font-size: 10.5px; font-weight: 600; letter-spacing: .02em;
    color: var(--gold-text); background: var(--gold-soft); border-radius: 999px; padding: 5px 11px; margin: 0 0 10px; }
  h1 { font-size: 26px; line-height: 1.2; letter-spacing: -.02em; margin: 0 0 12px; }
  h2 { font-size: 18px; color: var(--ink); margin: 24px 0 10px; break-after: avoid; }
  h3 { font-size: 14px; color: var(--ink); margin: 0 0 6px; padding-left: 12px; border-left: 3px solid var(--ink); }
  p { font-size: 12.5px; line-height: 1.6; color: var(--ink-soft); margin: 0 0 9px; }
  p b { color: var(--ink); }
  .fonte { font-size: 10.5px; color: var(--ink-dim); margin: 0 0 4px; }

  /* ---- capa ---- */
  .capa { min-height: 250mm; display: flex; flex-direction: column; justify-content: space-between;
    break-after: page; }
  .marca svg { width: 130px; height: auto; }
  .painel { background: var(--creme); border-radius: 22px; padding: 28px 26px 24px; }
  .painel .abertura { font-size: 13.5px; line-height: 1.6; color: var(--ink-soft); margin: 0; }
  .rodape-capa { padding-top: 18px; border-top: 1.5px solid var(--line); margin-top: 20px;
    display: flex; justify-content: space-between; align-items: baseline; gap: 16px;
    font-size: 11px; color: var(--ink-dim); }
  .rodape-capa b { color: var(--ink); font-weight: 600; }

  /* ---- índice ---- */
  .indice { margin-top: 22px; padding-top: 16px; border-top: 1.5px solid var(--line); }
  .indice .lbl { font-size: 10px; font-weight: 600; letter-spacing: .09em; text-transform: uppercase;
    color: var(--ink-dim); margin: 0 0 10px; }
  .indice ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr;
    gap: 8px 18px; counter-reset: item; }
  .indice li { counter-increment: item; display: flex; align-items: center; gap: 9px;
    font-size: 11.5px; font-weight: 500; color: var(--ink); }
  .indice li::before { content: counter(item); flex: 0 0 auto; width: 18px; height: 18px; border-radius: 50%;
    background: var(--gold-soft); color: var(--gold-text); font-size: 10px; font-weight: 600;
    display: flex; align-items: center; justify-content: center; }

  /* ---- resumo (capa e ficha) ---- */
  .resumo { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 18px 0 0; }
  .resumo div { border: 1.5px solid var(--line); border-radius: 12px; padding: 10px 13px; font-size: 12px;
    background: var(--card); break-inside: avoid; }
  .resumo span:first-child { display: block; color: var(--ink-dim); font-size: 10.5px; }
  .resumo div.wide { grid-column: 1 / -1; }

  /* ---- seções ---- */
  .sec { margin-top: 24px; }
  .blk { background: var(--card); border: 1.5px solid var(--line); border-radius: 14px; padding: 13px 16px;
    margin: 0 0 9px; break-inside: avoid; }
  .box { background: var(--card); border: 1.5px solid var(--line); border-left: 4px solid var(--gold-deep);
    border-radius: 12px; padding: 12px 15px; margin: 12px 0; break-inside: avoid; }
  .box p:last-child { margin-bottom: 0; }
  .cab { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin: 0 0 4px; }
  .cab b { font-size: 13px; color: var(--ink); }
  .cab .r { font-size: 11px; font-weight: 600; white-space: nowrap; padding: 3px 9px; border-radius: 999px; }
  .cab .ok { color: var(--green); background: rgba(47,179,103,.12); }
  .cab .no { color: var(--red); background: rgba(224,49,49,.12); }
  ol { list-style: none; margin: 0; padding: 0; counter-reset: passo; }
  ol li { counter-increment: passo; position: relative; padding: 10px 14px 10px 42px; margin-bottom: 7px;
    background: var(--card); border: 1.5px solid var(--line); border-radius: 12px; font-size: 12.5px; color: var(--ink-soft);
    break-inside: avoid; }
  ol li::before { content: counter(passo); position: absolute; left: 13px; top: 9px; width: 20px; height: 20px;
    border-radius: 50%; background: var(--ink); color: #fff; font-size: 10.5px; font-weight: 600;
    display: flex; align-items: center; justify-content: center; }

  /* ---- ficha ---- */
  .ficha { display: grid; grid-template-columns: 1fr; gap: 6px; }
  .ficha div { display: flex; justify-content: space-between; gap: 14px; font-size: 11.8px;
    padding: 9px 15px; background: var(--card); border: 1.5px solid var(--line); border-radius: 12px;
    break-inside: avoid; }
  .ficha div span:first-child { color: var(--ink-dim); flex: 0 0 auto; }
  .ficha div span:last-child { font-weight: 600; text-align: right; color: var(--ink); }

  /* ---- fechamento ---- */
  .fim { background: var(--navy); color: #fff; border-radius: 18px; padding: 22px 24px; margin-top: 16px;
    break-inside: avoid; }
  .fim .eyebrow { background: rgba(249,224,138,.16); color: var(--gold); }
  .fim h2 { color: #fff; margin-bottom: 8px; }
  .fim p { color: #CBD3E8; }
  .fim p:last-of-type { margin-bottom: 0; }
  .fim b { color: var(--gold); }
  .selo { display: inline-block; margin-top: 14px; text-decoration: none;
    background: linear-gradient(135deg, var(--gold), var(--gold-deep));
    color: var(--navy); font-weight: 600; font-size: 13px; border-radius: 999px; padding: 11px 20px; }

  footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid var(--line);
    font-size: 9.5px; color: var(--ink-dim); line-height: 1.6; }
  footer code { display: block; margin-top: 3px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 8.5px; color: var(--ink-dim); overflow-wrap: anywhere; }
`

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Resolve o texto legível de uma resposta de perfil a partir da mesma
// definição de tela que o quiz usa pra renderizar os botões (`PERFIL_SCREENS`
// em lib/quizContent.ts) — uma única fonte pros rótulos, em vez de duplicar
// os textos das opções aqui.
function rotuloPerfil(perfil: RespostasPerfil, chave: keyof RespostasPerfil): string {
  const tela = PERFIL_SCREENS.find((t) => t.key === chave)
  const valor = perfil[chave]
  if (!tela || !valor || typeof valor !== 'string') return ''
  const opts = typeof tela.opts === 'function' ? tela.opts(perfil) : tela.opts
  return opts.find((o) => o[0] === valor)?.[1] ?? ''
}

function rotuloDinheiro(perfil: RespostasPerfil): string {
  const valor = perfil.dinheiro
  if (!valor) return ''
  const opts = TELA_DINHEIRO.opts
  const lista = typeof opts === 'function' ? opts(perfil) : opts
  return lista.find((o) => o[0] === valor)?.[1] ?? ''
}

// Ordem e rótulos das linhas da ficha — mesmos 13 campos e mesma ordem de
// FICHA em report.py, com "editais" e "dinheiro" resolvidos à parte (não
// vêm de PERFIL_SCREENS: o primeiro é multi-escolha, o segundo é
// TELA_DINHEIRO, uma tela separada).
const FICHA_CAMPOS: Array<[keyof RespostasPerfil, string]> = [
  ['alvo', 'Concurso alvo'], ['cargo', 'Cargo'], ['formacao', 'Formação'],
  ['tempo', 'Tempo de estudo'], ['provas', 'Provas de tribunal já feitas'],
  ['metodo', 'Como estudou até aqui'], ['vde', 'Conhece o Método VDE'],
  ['horas', 'Horas por dia'], ['edital', 'Edital na mira'],
  ['dor', 'Maior gargalo'], ['momento', 'Frase que te define'],
]

export function montarHtmlLaudo(sessao: QuizSession, nivel: string): string {
  const perfil = sessao.perfil
  const momento = perfil.momento ? DIAG[perfil.momento] : undefined
  const primeiroNome = sessao.nome.split(' ')[0]
  const saudacao = primeiroNome ? `Oi, ${primeiroNome}.` : 'Oi.'
  const blocos = sessao.blocos ?? []
  const mostrarPlano = perfil.leitura === 'completa' && momento
  const acertos = sessao.acertos ?? 0
  const total = sessao.total ?? 0

  const resumoCapa = [
    ['Onde você está', perfil.momento ? L.momento[perfil.momento] : ''],
    ['Alvo', `${labelCargo(perfil)} · ${perfil.alvo ? L.alvo[perfil.alvo] : ''}`],
    ['Nível no teste', `${nivel} · ${acertos} de ${total}`],
    ['Tempo disponível', perfil.horas ? L.horas[perfil.horas] : ''],
  ]
  let resumoHtml = resumoCapa
    .map(([k, v]) => `<div><span>${escapeHtml(k)}</span><span>${escapeHtml(v)}</span></div>`)
    .join('')
  resumoHtml += `<div class="wide"><span>Curso indicado</span><span>${escapeHtml(sessao.perfilCalculado?.curso ?? '')}</span></div>`
  if (sessao.perfilCalculado?.ritmo) {
    resumoHtml += `<div class="wide"><span>Ritmo no seu tempo de estudo</span><span>${escapeHtml(sessao.perfilCalculado.ritmo)}</span></div>`
  }

  // Índice, etiqueta (eyebrow) e título (h2) de cada seção usam textos
  // ligeiramente diferentes entre si — mesma variação de report.py (ex.:
  // índice "Ponto a ponto das suas respostas", etiqueta "Resposta por
  // resposta", título "Ponto a ponto do que você me contou"), não é
  // inconsistência.
  const secoesIndice = ['A leitura do seu caso']
  if (mostrarPlano) secoesIndice.push('A ordem que eu seguiria')
  secoesIndice.push('Ponto a ponto das suas respostas', 'As quatro questões, comentadas', 'A sua ficha completa', 'O próximo passo')
  const indiceHtml = secoesIndice.map((s) => `<li>${escapeHtml(s)}</li>`).join('')

  const fichaLinhas: Array<[string, string]> = []
  for (const [chave, rotulo] of FICHA_CAMPOS) {
    const valor = rotuloPerfil(perfil, chave)
    if (valor) fichaLinhas.push([rotulo, valor])
    if (chave === 'edital') {
      const editais = editaisEscolhidos(perfil).map((e) => e.label).join(', ')
      if (editais) fichaLinhas.push(['Concursos escolhidos', editais])
    }
  }
  const dinheiro = rotuloDinheiro(perfil)
  if (dinheiro) fichaLinhas.push(['Ganho a mais se aprovado', dinheiro])
  const fichaHtml = fichaLinhas
    .map(([k, v]) => `<div><span>${escapeHtml(k)}</span><span>${escapeHtml(v)}</span></div>`)
    .join('')

  const linkWhats = sessao.perfilCalculado
    ? waLink(sessao.nome, perfil, sessao.perfilCalculado.classe, sessao.perfilCalculado.cursoCod, nivel, acertos, total)
    : null
  // Mesmo fallback de report.py: enquanto CONFIG.whatsapp for o placeholder
  // ("5500000...", ainda não trocado pelo número real do time — ver o
  // comentário em lib/quizContent.ts), o botão aparece só como texto
  // estilizado, sem link, em vez de virar um <a href> morto.
  const numeroConfigurado = Boolean(CONFIG.whatsapp) && !CONFIG.whatsapp.startsWith('5500000')
  const convite = 'Responder no WhatsApp e marcar o meu horário'
  const seloHtml = linkWhats && numeroConfigurado
    ? `<a class="selo" href="${linkWhats}">${convite}</a>`
    : `<span class="selo">${convite}</span>`

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${CSS}</style></head><body>

    <section class="capa">
      <div class="marca">${LOGO_SVG}</div>

      <div class="painel">
        <span class="eyebrow">Diagnóstico da Base</span>
        <h1>${escapeHtml(saudacao)} Este é o seu raio-X completo.</h1>
        <p class="abertura">Ele sai das doze perguntas e das quatro questões que você respondeu.
        Eu leio o seu caso na mesma ordem em que eu leria pessoalmente: onde você está hoje, o
        que está te segurando, e o que eu faria primeiro se o problema fosse meu.</p>
        <div class="resumo">${resumoHtml}</div>
        <div class="indice">
          <p class="lbl">Neste raio-X</p>
          <ul>${indiceHtml}</ul>
        </div>
      </div>

      <div class="rodape-capa">
        <span>Diagnóstico de <b>${escapeHtml(sessao.nome)}</b></span>
        <span>${escapeHtml(dataPorExtenso())}</span>
      </div>
    </section>

    ${momento ? `
      <section class="sec">
        <span class="eyebrow">A leitura do seu caso</span>
        <h2>${escapeHtml(momento.titulo)}</h2>
        ${momento.texto.map((t) => `<p>${escapeHtml(t)}</p>`).join('')}
        <div class="box"><p><b>Começa por aqui:</b> ${escapeHtml(momento.prescricao)}</p></div>
      </section>
    ` : ''}

    ${mostrarPlano ? `
      <section class="sec">
        <span class="eyebrow">O que vem primeiro</span>
        <h2>A ordem que eu seguiria no seu lugar</h2>
        <ol>${momento!.ordem.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
      </section>
    ` : ''}

    ${blocos.length > 0 ? `
      <section class="sec">
        <span class="eyebrow">Resposta por resposta</span>
        <h2>Ponto a ponto do que você me contou</h2>
        ${blocos.map((b) => `
          <div class="blk">
            <h3>${escapeHtml(b.title)}</h3>
            ${b.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
          </div>
        `).join('')}
      </section>
    ` : ''}

    ${sessao.respostas.length > 0 ? `
      <section class="sec">
        <span class="eyebrow">O teste de nível</span>
        <h2>As quatro questões, comentadas</h2>
        ${sessao.respostas.map((r) => {
          const q = QUESTIONS.find((qq) => qq.num === r.num)
          const veredito = r.acertou
            ? 'acertou'
            : r.escolhida
              ? `errou · marcou ${r.escolhida}, gabarito ${r.gabarito}`
              : `errou · não respondeu, gabarito ${r.gabarito}`
          return `
            <div class="blk">
              <div class="cab">
                <b>${escapeHtml(r.area)}</b>
                <span class="r ${r.acertou ? 'ok' : 'no'}">${escapeHtml(veredito)}</span>
              </div>
              ${q ? `<p class="fonte">${escapeHtml(q.src)}</p>` : ''}
              ${q ? `<p>${escapeHtml(q.comment.join(' '))}</p>` : ''}
            </div>
          `
        }).join('')}
      </section>
    ` : ''}

    ${fichaLinhas.length > 0 ? `
      <section class="sec">
        <span class="eyebrow">Para conferir</span>
        <h2>Suas respostas</h2>
        <div class="ficha">${fichaHtml}</div>
      </section>
    ` : ''}

    <div class="fim">
      <span class="eyebrow">O próximo passo</span>
      <h2>Isto diz onde você está. Agora falta o plano.</h2>
      <p>Um raio-X aponta o problema e não resolve ele sozinho. O que a conversa com o meu time
      faz é pegar este diagnóstico e virar plano de ação dentro do VDE Tribunais: qual dos dois
      cursos atende o seu alvo, o cronograma que cabe no seu tempo real de estudo, quais
      disciplinas entram primeiro e em que ordem, e o que fica pra depois.</p>
      <p>Se ainda não marcou o seu horário, é só responder a mesma conversa do WhatsApp em que
      você recebeu este arquivo. <b>Não custa nada</b>, e cada consultor abre poucos horários por
      semana.</p>
      ${seloHtml}
    </div>

    <footer>
      Diagnóstico da Base · VDE Tribunais · diagnóstico de ${escapeHtml(sessao.nome)}
      <code>${escapeHtml(sessao.sessionToken)}</code>
    </footer>

  </body></html>`
}

export async function gerarPdfLaudo(sessao: QuizSession, nivel: string): Promise<Buffer> {
  const html = montarHtmlLaudo(sessao, nivel)
  const browser = await playwrightChromium.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle' })
    // Rodapé com numeração de página em toda página — mesmo comportamento do
    // PDF de referência (reference/raio-x-da-base/exemplos/*.pdf têm
    // "Raio-X da Base · VDE Tribunais" + número em todas as páginas). Não dá
    // pra fazer isso só com CSS: header/footer de PDF do Chromium são um
    // recurso à parte de page.pdf(), renderizado fora do documento — por
    // isso o template abaixo não herda a Poppins embutida no <style> do
    // corpo (usa a fonte de sistema, tamanho pequeno o bastante pra não
    // chamar atenção). O <footer> no corpo do HTML continua existindo à
    // parte — é o fechamento único, com o identificador da sessão.
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="width:100%;font-size:8.5px;font-family:system-ui,-apple-system,sans-serif;
          color:#7C86A6;padding:0 15mm;display:flex;justify-content:space-between;">
          <span>Diagnóstico da Base · VDE Tribunais</span>
          <span class="pageNumber"></span>
        </div>
      `,
      margin: { top: '18mm', bottom: '14mm', left: '15mm', right: '15mm' },
    })
    return pdf
  } finally {
    await browser.close()
  }
}
