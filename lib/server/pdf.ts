import { readFileSync } from 'fs'
import { join } from 'path'
import chromium from '@sparticuz/chromium'
import { chromium as playwrightChromium } from 'playwright-core'
import type { QuizSession } from './types'
import { DIAG, L } from '../quizContent'
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

const CSS = `
  ${FONT_FACES}
  @page { size: A4; margin: 18mm 15mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Poppins', system-ui, sans-serif; color: #203C7C; }
  .eyebrow { display: inline-block; font-size: 10.5px; font-weight: 600; letter-spacing: .02em;
    color: #8A6A0C; background: #FBF3D6; border-radius: 999px; padding: 5px 11px; margin: 0 0 10px; }
  h1 { font-size: 26px; line-height: 1.2; letter-spacing: -.02em; margin: 0 0 12px; }
  h2 { font-size: 18px; color: #203C7C; margin: 24px 0 10px; }
  h3 { font-size: 14px; color: #203C7C; margin: 0 0 6px; padding-left: 12px; border-left: 3px solid #203C7C; }
  p { font-size: 12.5px; line-height: 1.6; color: #5B6478; margin: 0 0 9px; }
  .fonte { font-size: 10.5px; color: #7C86A6; margin: 0 0 4px; }
  .resumo { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 16px 0; }
  .resumo div { border: 1.5px solid #E7E7EA; border-radius: 12px; padding: 10px 13px; font-size: 12px; }
  .resumo span:first-child { display: block; color: #7C86A6; font-size: 10.5px; }
  .blk { background: #FFFFFF; border: 1.5px solid #E7E7EA; border-radius: 14px; padding: 13px 16px; margin: 0 0 9px; break-inside: avoid; }
  .box { background: #FFFFFF; border: 1.5px solid #E7E7EA; border-left: 4px solid #C89B18; border-radius: 12px; padding: 12px 15px; margin: 12px 0; }
  .cab { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin: 0 0 4px; }
  .cab b { font-size: 13px; }
  .cab .r { font-size: 11px; font-weight: 600; white-space: nowrap; padding: 3px 9px; border-radius: 999px; }
  .cab .ok { color: #2FB367; background: rgba(47,179,103,.12); }
  .cab .no { color: #E03131; background: rgba(224,49,49,.12); }
  ol { list-style: none; margin: 0; padding: 0; counter-reset: passo; }
  ol li { counter-increment: passo; position: relative; padding: 10px 14px 10px 42px; margin-bottom: 7px;
    background: #FFFFFF; border: 1.5px solid #E7E7EA; border-radius: 12px; font-size: 12.5px; color: #5B6478; }
  ol li::before { content: counter(passo); position: absolute; left: 13px; top: 9px; width: 20px; height: 20px;
    border-radius: 50%; background: #203C7C; color: #fff; font-size: 10.5px; font-weight: 600;
    display: flex; align-items: center; justify-content: center; }
`

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function montarHtmlLaudo(sessao: QuizSession, nivel: string): string {
  const momento = sessao.perfil.momento ? DIAG[sessao.perfil.momento] : undefined
  const primeiroNome = sessao.nome.split(' ')[0]
  const blocos = sessao.blocos ?? []
  const mostrarPlano = sessao.perfil.leitura === 'completa' && momento

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <span class="eyebrow">Diagnóstico da Base</span>
    <h1>${escapeHtml(primeiroNome)}, este é o seu raio-x completo.</h1>
    <div class="resumo">
      <div><span>Onde você está</span>${sessao.perfil.momento ? escapeHtml(L.momento[sessao.perfil.momento]) : ''}</div>
      <div><span>Curso indicado</span>${escapeHtml(sessao.perfilCalculado?.curso ?? '')}</div>
      <div><span>Ritmo</span>${escapeHtml(sessao.perfilCalculado?.ritmo ?? '')}</div>
      <div><span>Nível no teste</span>${escapeHtml(nivel)} · ${sessao.acertos ?? 0} de ${sessao.total ?? 0}</div>
    </div>

    ${momento ? `
      <h2>A leitura do seu caso</h2>
      ${momento.texto.map((t) => `<p>${escapeHtml(t)}</p>`).join('')}
      <div class="box"><p><b>Começa por aqui:</b> ${escapeHtml(momento.prescricao)}</p></div>
    ` : ''}

    ${mostrarPlano ? `
      <h2>A ordem que eu seguiria</h2>
      <ol>${momento!.ordem.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
    ` : ''}

    ${blocos.length > 0 ? `
      <h2>Ponto a ponto do que você me contou</h2>
      ${blocos.map((b) => `
        <div class="blk">
          <h3>${escapeHtml(b.title)}</h3>
          ${b.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
        </div>
      `).join('')}
    ` : ''}

    ${sessao.respostas.length > 0 ? `
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

      <h2>O próximo passo</h2>
      <p>Isto diz onde você está. Agora falta o plano. Um raio-x aponta o problema e não
      resolve ele sozinho — quem vira isso em plano de ação é uma conversa de uns 20 minutos
      com um consultor do meu time, que cruza o que você respondeu com o edital do seu alvo e
      monta o seu cronograma.</p>
      <div class="box"><p><b>Não custa nada.</b> Só que a agenda é curta — cada consultor abre
      poucos horários por semana. Se ainda não marcou o seu horário, é só responder a mesma
      conversa do WhatsApp em que você recebeu este PDF.</p></div>
    ` : ''}
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
    const pdf = await page.pdf({ format: 'A4', printBackground: true })
    return pdf
  } finally {
    await browser.close()
  }
}
