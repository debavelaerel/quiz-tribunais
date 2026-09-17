"""HTML -> PDF via Playwright, direto em Python — sem Node.

O `pdf.py` original do pacote (reference/raio-x-da-base/diagnosis/pdf.py)
delega pra um script Node (`_build/html2pdf.mjs`) que não veio no zip
entregue. Em vez de recriar esse script em Node só pra manter uma etapa
intermediária, geramos o PDF direto daqui — mesmo motor (Chromium headless),
sem precisar de um segundo runtime no serviço.

API assíncrona do Playwright, não a síncrona: a síncrona é presa à thread
do SO em que foi iniciada (usa greenlets por baixo) — funciona em um script
simples de ponta a ponta numa única thread, mas quebra num servidor web,
onde cada requisição pode cair numa thread diferente do pool (e a thread
original pode até já ter sido reciclada). É exatamente esse erro
(`greenlet.error: cannot switch to a different thread`) que apareceu na
primeira tentativa deste arquivo com a API síncrona, testada só com uma
requisição de cada vez. A API assíncrona roda inteira no event loop único
do FastAPI, sem esse problema de afinidade de thread.
"""
import asyncio

from playwright.async_api import async_playwright

# Rodapé com numeração de página em toda página — o mesmo comportamento dos
# PDFs de exemplo do pacote (reference/raio-x-da-base/exemplos/*.pdf têm
# "Raio-X da Base · VDE Tribunais  N" em toda página). Não dá pra fazer isso
# só com CSS: header/footer de PDF do Chromium são um recurso à parte da
# própria chamada de impressão, renderizado fora do documento — por isso não
# herda a Poppins embutida no <style> do corpo (fonte de sistema, tamanho
# pequeno o bastante pra não chamar atenção).
FOOTER_TEMPLATE = """
<div style="width:100%;font-size:8.5px;font-family:system-ui,-apple-system,sans-serif;
  color:#7C86A6;padding:0 15mm;display:flex;justify-content:space-between;">
  <span>Diagnóstico da Base · VDE Tribunais</span>
  <span class="pageNumber"></span>
</div>
"""

# Um Chromium por processo, não um por requisição: abrir um browser novo a
# cada chamada sobe um driver + um Chromium inteiro por requisição — sob
# qualquer rajada de tráfego isso derruba uma instância pequena por memória.
# Um único browser vive pelo processo inteiro (aberto em `iniciar()`, no
# startup do FastAPI — ver main.py); páginas concorrentes sobre o mesmo
# browser são seguras na API assíncrona (diferente da síncrona). O
# semáforo não é sobre correção, é sobre não deixar 40 requisições
# simultâneas abrirem 40 páginas/renders ao mesmo tempo num contêiner
# pequeno — a geração do laudo é um clique manual de admin, não um caminho
# de alto tráfego, então um teto pequeno (2) é sobra, não gargalo real.
_playwright = None
_browser = None
_semaforo = asyncio.Semaphore(2)


async def iniciar() -> None:
    global _playwright, _browser
    if _browser is not None:
        return
    _playwright = await async_playwright().start()
    _browser = await _playwright.chromium.launch(headless=True)


async def encerrar() -> None:
    global _playwright, _browser
    if _browser is not None:
        await _browser.close()
        _browser = None
    if _playwright is not None:
        await _playwright.stop()
        _playwright = None


async def html_para_pdf(html: str) -> bytes:
    if _browser is None:
        raise RuntimeError("render.iniciar() precisa rodar antes de html_para_pdf() — chamado fora do lifespan do FastAPI?")
    async with _semaforo:
        page = await _browser.new_page()
        try:
            await page.set_content(html, wait_until="networkidle")
            return await page.pdf(
                format="A4",
                print_background=True,
                display_header_footer=True,
                header_template="<span></span>",
                footer_template=FOOTER_TEMPLATE,
                margin={"top": "18mm", "bottom": "14mm", "left": "15mm", "right": "15mm"},
            )
        finally:
            await page.close()
