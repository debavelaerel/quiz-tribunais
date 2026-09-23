"""Overrides de marca aplicados por cima de reference/raio-x-da-base/diagnosis,
sem editar o pacote vendorizado (fica intocado, como veio na entrega).

As 4 trocas decididas em 2026-09-17, todas já validadas antes (cores
testadas e rejeitadas pelo cliente; "Diagnóstico" é o rebrand já aprovado
de "Raio-X"; link de WhatsApp com mensagem pré-preenchida é o que a tela
pública de resultado já usa):
  1. Paleta: tokens do app (brand-ink/brand-gold/...), não lilás/roxo do pacote.
  2. Logo: wordmark do app (public/brand/versao01-color0.svg), não o ícone do pacote.
  3. Nome do produto: "Diagnóstico da Base", não "Raio-X da Base".
  4. CTA final: link de WhatsApp com mensagem pré-preenchida (a mesma que a
     tela de resultado usa, via lib/quizContent.ts::waLink), não o link vazio
     que report.py gera sozinho.

Troca adicional em 2026-09-23: "meu time" virou "nosso time" no parágrafo
final (`voz_do_time`), pra ficar consistente com a mesma frase já trocada em
components/Quiz.tsx (cartão do CTA de WhatsApp na tela de resultado).

`vendor/raio-x-da-base` e `vendor/brand` são cópias de `reference/raio-x-da-base`
e `public/brand` na raiz do repo — o build de container (Vercel/Docker) usa
`services/laudo-pdf` isolado como contexto, sem acesso ao resto do repo, então
o serviço carrega uma cópia própria em vez de referenciar os originais fora
do seu diretório. Atualizações no pacote original precisam ser copiadas de
novo pra cá.

Cada override é aplicado via monkeypatch nos nomes que
`diagnosis.report.build_html` referencia no próprio módulo — nunca editando
os arquivos de `reference/raio-x-da-base/diagnosis/` em si. `assets.py`
original aponta pra caminhos (`ROOT/decks/...`, `ROOT/system/...`) que só
existem no monorepo de onde o pacote veio, não no zip entregue — por isso
`fonts_css`/`logo_svg` também precisam de override aqui, não só por causa
da marca: sem isso, `assets.py` original nem consegue ler os arquivos.

Todo override que troca string num HTML/CSS já pronto (`titulo_da_base`,
`remover_marca_duplicada`, `cta_whatsapp_com_mensagem`, a parte de
`.marca svg` em `css_com_paleta_do_app`) confere quantas vezes o alvo
aparece antes de mexer, e estoura erro se o número mudar — sem isso, se o
pacote for atualizado um dia com um texto ligeiramente diferente, o
override vira um no-op silencioso (a troca simplesmente não acontece, sem
nenhum aviso) em vez de falhar de um jeito que alguém note.
"""
import base64
import re
import unicodedata
from functools import lru_cache
from pathlib import Path
from urllib.parse import quote

SERVICE_DIR = Path(__file__).resolve().parent
FONTS_DIR = SERVICE_DIR / "vendor/raio-x-da-base/assets/fonts/Poppins"
LOGO_PATH = SERVICE_DIR / "vendor/brand/versao01-color0.svg"


class PacoteMudou(RuntimeError):
    """reference/raio-x-da-base foi atualizado de um jeito que quebra um dos
    overrides de marca — nunca deve ser silenciado."""


def _confirmar(condicao: bool, mensagem: str) -> None:
    # `raise`, não `assert`: estas são travas de invariante de runtime (o
    # pacote vendorizado ainda tem a forma que os overrides esperam), não
    # sanity checks de debug — `assert` some inteiro se o processo rodar com
    # `-O`/PYTHONOPTIMIZE, o que desligaria essa proteção sem nenhum aviso.
    if not condicao:
        raise PacoteMudou(mensagem)

# Mesmos unicode-range de assets.py::fonts_css() — perdidos numa primeira
# versão deste override (LATIN_EXT e LATIN viravam duas regras @font-face
# idênticas, sem range, e o Chromium só usava a última: título/fonte cobrindo
# só Latin-1, glifos fora disso caindo pro fallback do sistema).
LATIN_EXT = ("U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, "
             "U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, "
             "U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF")
LATIN = ("U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, "
         "U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, "
         "U+FEFF, U+FFFD")

# Mesmos tokens de app/globals.css — ver components/AreaRadar.tsx e
# lib/server/pdf.ts (o port em TS que este serviço substitui) pra
# consistência: mesma paleta em todo lugar que esse laudo já foi renderizado.
# --lav/--lav-soft/--purple não têm equivalente direto no app (não existe
# lavanda na paleta) — mapeados pra dourado, o mesmo acento que o port em TS
# usa pros números do índice. Precisam ficar diferentes de --creme: são
# fundo/borda de elementos (bullet do índice, cartão "wide" do resumo) que
# ficam literalmente em cima do fundo --creme — mesma cor em cima da mesma
# cor come a borda inteira.
PALETTE = {
    "--bg": "#FFFFFF", "--creme": "#EEF1F8", "--card": "#FFFFFF",
    "--ink": "#203C7C", "--ink-soft": "#5B6478", "--ink-dim": "#7C86A6",
    "--line": "#E7E7EA", "--line-strong": "#C9C9CE",
    "--lav": "#C89B18", "--lav-soft": "#FBF3D6", "--purple": "#8A6A0C",
    "--navy": "#16305F", "--gold": "#F9E08A", "--gold-deep": "#C89B18",
    "--gold-soft": "#FBF3D6", "--gold-text": "#8A6A0C",
    "--green": "#2FB367", "--red": "#C92A2A",
}


# lru_cache(maxsize=1): os overrides são chamados de novo a cada PDF gerado
# (build_html() chama fonts_css()/logo_svg(38) toda vez), mas o conteúdo
# nunca muda dentro do tempo de vida do processo — sem cache, cada
# requisição relia e rebase64 os 8 arquivos de fonte à toa. Efeito colateral
# bom: se FONTS_DIR/LOGO_PATH estiverem errados (deploy com layout de
# arquivo diferente do esperado), isso preenche o cache — e portanto falha —
# já no startup (ver main.py, que chama as duas uma vez antes de subir o
# servidor), em vez de só estourar no primeiro /laudo real.
@lru_cache(maxsize=1)
def fonts_css_override(weights=(400, 500, 600, 700)) -> str:
    """Mesma lógica de assets.py::fonts_css(), só com o caminho corrigido
    pros arquivos que de fato vieram no zip (reference/raio-x-da-base/assets/,
    não ROOT/decks/... do monorepo original)."""
    regras = []
    for peso in weights:
        for subset, faixa in (("latin-ext", LATIN_EXT), ("latin", LATIN)):
            caminho = FONTS_DIR / f"Poppins-{peso}-{subset}.woff2"
            b64 = base64.b64encode(caminho.read_bytes()).decode()
            regras.append(
                f"@font-face{{font-family:'Poppins';font-style:normal;font-weight:{peso};"
                f"font-display:swap;src:url(data:font/woff2;base64,{b64}) format('woff2');"
                f"unicode-range:{faixa};}}"
            )
    return "\n".join(regras)


@lru_cache(maxsize=1)
def logo_svg_override(size=None) -> str:
    """Wordmark do app (mesma marca do cabeçalho do quiz, components/Header.tsx)
    em vez do ícone isolado do pacote — já vem com "Tribunais" embutido na
    própria arte, então não precisa do `<b>VDE<span>Tribunais</span></b>`
    que report.py monta ao lado do logo original (removido à parte, ver
    `remover_marca_duplicada` — é literal no HTML, não dá pra sobrescrever
    aqui)."""
    svg = LOGO_PATH.read_text(encoding="utf-8").strip()
    largura = size or 130
    # Redimensiona width/height do SVG (a arte é uma wordmark larga, não um
    # ícone quadrado — troca só os atributos de tamanho, mantém o viewBox.
    svg = re.sub(r'width="[\d.]+"', f'width="{largura}"', svg, count=1)
    svg = re.sub(r'height="[\d.]+"', 'height="auto"', svg, count=1)
    return svg


_HEX_RE = re.compile(r"#[0-9A-Fa-f]{3,6}")
_MARCA_SVG_38PX = ".marca svg{width:38px;height:38px}"


def css_com_paleta_do_app(css_original: str) -> str:
    """Troca os valores hexadecimais do bloco `:root{...}` do CSS original
    do laudo pelos tokens do app, e o tamanho fixo de `.marca svg` — mantém
    o resto de 100% da estrutura/seletores/regras do pacote. `css_original`
    é `diagnosis.report.CSS` (a constante de módulo), lido em runtime antes
    de qualquer override."""
    root_match = re.search(r":root\{[^}]*\}", css_original)
    _confirmar(bool(root_match), "CSS de report.py mudou: bloco :root{...} não encontrado — override de paleta não tem onde aplicar")

    def trocar_root(match: re.Match) -> str:
        bloco = match.group(0)
        for var, valor in PALETTE.items():
            bloco, n = re.subn(rf"{re.escape(var)}\s*:\s*{_HEX_RE.pattern}", f"{var}:{valor}", bloco)
            _confirmar(n == 1, f"CSS de report.py mudou: variável {var} não encontrada (ou duplicada) em :root{{...}} — override de paleta ficaria incompleto")
        return bloco

    css = re.sub(r":root\{[^}]*\}", trocar_root, css_original, count=1)

    # `.marca svg{width:38px;height:38px}` do pacote é dimensionado pro
    # ícone quadrado original (logo_svg(38)) — CSS sempre ganha dos atributos
    # width/height do próprio <svg>, então sem isso a wordmark larga do app
    # (logo_svg_override) sai espremida num quadrado de 38px, cortada.
    _confirmar(css.count(_MARCA_SVG_38PX) == 1, "CSS de report.py mudou: regra .marca svg não encontrada — logo sairia do tamanho errado")
    css = css.replace(_MARCA_SVG_38PX, ".marca svg{width:130px;height:auto}")

    return css


_CAPA_MIN_HEIGHT_ORIGINAL = ".capa{min-height:266mm;"


def css_com_altura_da_capa_corrigida(css: str) -> str:
    """A capa tem `min-height:266mm`, mas a área útil da página impressa
    (render.py: A4 = 297mm, margem top 18mm + bottom 14mm) é só 265mm — 1mm
    menor que o mínimo pedido. Esse estouro de 1mm empurra o fim da capa pra
    uma segunda página quase inteira em branco (só header/footer do PDF),
    antes do `break-after:page` que já força a próxima seção a começar numa
    página nova — o bug real por trás da "página em branco" do laudo.
    Reduz com folga (não só pro exato 265mm) pra sobrar margem de erro de
    arredondamento entre mm e px no motor de PDF."""
    _confirmar(css.count(_CAPA_MIN_HEIGHT_ORIGINAL) == 1, "CSS de report.py mudou: regra .capa min-height não encontrada (ou já mudou) — correção da página em branco ficaria obsoleta ou reaplicada errado")
    return css.replace(_CAPA_MIN_HEIGHT_ORIGINAL, ".capa{min-height:262mm;")


CTA_SEM_LINK = '<span class="selo">Responder no WhatsApp e marcar o meu horário</span>'


def cta_whatsapp_com_mensagem(html: str, numero: str, mensagem: str) -> str:
    """report.py decide, dentro de build_html(), entre link real ou <span>
    sem link — a partir de CONFIG['whatsapp'] (`questions.py`, ainda o
    placeholder "5500000000000" no pacote vendorizado, igual ao
    lib/quizContent.ts do app hoje). Como o serviço atende requisições
    concorrentes, mutar esse dict global por request pra injetar o número
    de cada chamada seria uma condição de corrida (uma requisição podia ler
    o número de outra no meio do caminho). Em vez disso, deixa o pacote
    sempre gerar o <span> sem link (comportamento correto enquanto o
    WhatsApp não está configurado — mesmo fallback de report.py) e troca
    por string, na resposta já pronta, pelo link de verdade quando o
    Next.js manda `numero`+`mensagem` — pura leitura/escrita da variável
    local `html`, sem estado compartilhado. A mensagem (texto + ref de
    rastreio) é montada no Next.js por lib/quizContent.ts::waLink, a mesma
    função que a tela pública de resultado usa — o link do PDF nunca
    diverge do que o lead já viu lá.
    """
    if not numero or numero.startswith("5500000"):
        return html
    _confirmar(html.count(CTA_SEM_LINK) == 1, "CSS/HTML de report.py mudou: botão final não encontrado no formato esperado — CTA de WhatsApp ficaria sem link")
    link = f'https://wa.me/{numero}?text={quote(mensagem)}'
    cta_com_link = f'<a class="selo" href="{link}">Responder no WhatsApp e marcar o meu horário</a>'
    return html.replace(CTA_SEM_LINK, cta_com_link)


MARCA_TEXTO_DUPLICADO = "<b>VDE<span>Tribunais</span></b>"


def remover_marca_duplicada(html: str) -> str:
    """report.py escreve `<div class="marca">{logo_svg(38)}<b>VDE<span>
    Tribunais</span></b></div>` — o texto "VDE"/"Tribunais" ao lado do logo
    é hardcoded no HTML (não dá pra sobrescrever via monkeypatch, é literal
    dentro do f-string de build_html()), pensado pro logo original (só um
    ícone). O logo do app (logo_svg_override) já é uma wordmark com "vde" e
    "Tribunais" desenhados na própria arte — sem tirar esse texto, a marca
    sai duplicada (nome escrito duas vezes, lado a lado)."""
    _confirmar(html.count(MARCA_TEXTO_DUPLICADO) == 1, "HTML de report.py mudou: marcação da marca não encontrada — logo do app sairia duplicado com o texto do pacote")
    return html.replace(MARCA_TEXTO_DUPLICADO, "")


RAIO_X_DA_BASE = "Raio-X da Base"


def titulo_da_base(html: str) -> str:
    """report.py escreve "Raio-X da Base" em 3 lugares fixos no HTML (eyebrow
    da capa, <title>, rodapé) — não dá pra sobrescrever via monkeypatch
    porque são literais dentro do f-string de build_html(), não uma
    constante de módulo. Troca de string no HTML já pronto, então: "Raio-X
    da Base" é específico o bastante (não aparece em nenhum outro texto do
    pacote) pra não ter falso positivo.
    """
    ocorrencias = html.count(RAIO_X_DA_BASE)
    _confirmar(ocorrencias == 3, f"HTML de report.py mudou: esperava 3 ocorrências de \"{RAIO_X_DA_BASE}\" (eyebrow, título, rodapé), achou {ocorrencias} — rebrand ficaria incompleto")
    return html.replace(RAIO_X_DA_BASE, "Diagnóstico da Base")


# Além de "Raio-X da Base" (nome do produto, tratado acima), report.py usa
# "raio-X" solto, como substantivo comum, em mais 3 pontos do corpo do
# laudo — titulo_da_base() não pega esses (string diferente). Mesmo rebrand
# aprovado (ver docstring do módulo), só que aplicado às frases inteiras
# (não dá pra trocar só a palavra: "seu raio-X completo" -> "seu
# diagnóstico completo" muda a frase toda ao redor pra soar natural).
_RAIO_X_GENERICO = {
    "Este é o seu raio-X completo.": "Este é o seu diagnóstico completo.",
    "Neste raio-X": "Neste diagnóstico",
    "Um raio-X aponta o problema e não resolve ele sozinho.": "Um diagnóstico aponta o problema e não resolve ele sozinho.",
}


def raio_x_generico(html: str) -> str:
    for frase, trocada in _RAIO_X_GENERICO.items():
        _confirmar(html.count(frase) == 1, f"HTML de report.py mudou: não achei (ou achei mais de uma vez) \"{frase}\" — rebrand ficaria incompleto")
        html = html.replace(frase, trocada)
    return html


# Troca decidida em 2026-09-23, pra ficar consistente com a mesma frase na
# tela web (components/Quiz.tsx, cartão do CTA de WhatsApp): "meu time" virou
# "nosso time" lá primeiro, esse laudo ainda dizia "meu".
_VOZ_DO_TIME = {
    "O que a conversa com o meu\n    time faz": "O que a conversa com o nosso\n    time faz",
}


def voz_do_time(html: str) -> str:
    for frase, trocada in _VOZ_DO_TIME.items():
        _confirmar(html.count(frase) == 1, f"HTML de report.py mudou: não achei (ou achei mais de uma vez) \"{frase}\" — troca de voz ficaria incompleta")
        html = html.replace(frase, trocada)
    return html


def nome_para_arquivo(nome: str) -> str:
    """Mesma regra de nomeParaArquivo em
    app/api/admin/leads/[token]/pdf/route.ts (o lado Next.js que ainda serve
    o PDF pra quem baixa): reduz pra [a-z0-9-], sem acento — precisa ser
    ASCII puro porque vira valor de um cabeçalho HTTP
    (Content-Disposition), que quebra com Unicode não normalizado (accents
    passam no `str.isalnum()` do Python, que é Unicode-aware — não basta
    filtrar por isalnum() sem tirar o acento antes)."""
    sem_acento = unicodedata.normalize("NFD", nome or "")
    sem_acento = "".join(c for c in sem_acento if unicodedata.category(c) != "Mn")
    limpo = re.sub(r"[^a-z0-9]+", "-", sem_acento.lower()).strip("-")
    return limpo or "lead"
