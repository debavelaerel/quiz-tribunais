"""Serviço de geração do laudo em PDF — FastAPI fino em volta de
reference/raio-x-da-base/diagnosis, o pacote entregue como referência de
conteúdo/estrutura do laudo. O pacote fica intocado; os overrides de marca
(paleta, logo, nome do produto, CTA de WhatsApp) estão em brand.py.

POST /laudo recebe os dados da sessão (perfil + respostas + editais) e
devolve o PDF pronto. Autenticado por segredo compartilhado (cabeçalho
X-Laudo-Secret) — sem ele configurado, recusa tudo (falha fechada, igual ao
ADMIN_SESSION_SECRET do app Next.js).
"""
import logging
import os
import secrets
import sys
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

SERVICE_DIR = Path(__file__).resolve().parent
PACOTE_DIR = SERVICE_DIR / "vendor/raio-x-da-base"
sys.path.insert(0, str(PACOTE_DIR))

import apresentacao  # noqa: E402
import brand  # noqa: E402  (depende do sys.path acima)
import render  # noqa: E402
import s3  # noqa: E402
from diagnosis import report as report_mod  # noqa: E402
from diagnosis.answers import CAMPOS, Lead, LeadInvalido  # noqa: E402

APRESENTACAO_HTML = SERVICE_DIR / "vendor/vde-tribunais-call/deck.html"
APRESENTACAO_SLIDES = ["capa"] + [str(n) for n in range(1, 22)]

logger = logging.getLogger("laudo-pdf")

# Overrides de marca, aplicados uma vez no carregamento do processo — ver
# brand.py pro porquê de cada um. logo_svg/fonts_css são funções (nomes
# importados em report.py via `from .assets import ...`, então sobrescrever
# o nome no módulo report já é suficiente); CSS é uma string de módulo,
# transformada uma vez aqui e reatribuída.
report_mod.logo_svg = brand.logo_svg_override
report_mod.fonts_css = brand.fonts_css_override
report_mod.CSS = brand.css_com_altura_da_capa_corrigida(brand.css_com_paleta_do_app(report_mod.CSS))

# fonts_css_override/logo_svg_override só leem arquivo de verdade na
# primeira chamada (cacheada depois, lru_cache em brand.py) — chama as duas
# aqui pra qualquer caminho errado (FONTS_DIR/LOGO_PATH, ver brand.py)
# derrubar o processo já no startup, não silenciosamente só no primeiro
# /laudo real horas depois do deploy.
report_mod.fonts_css()
report_mod.logo_svg(38)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await render.iniciar()
    yield
    await render.encerrar()


app = FastAPI(title="laudo-pdf", lifespan=lifespan)

SP_TZ = ZoneInfo("America/Sao_Paulo")


class RespostaTeste(BaseModel):
    # 1 a 4 — mesma convenção de QuizSession.respostas no app Next.js (as 4
    # questões do teste graduado) — convertido pro índice 0-3 que Lead.teste
    # espera antes de montar o dict. Fora desse intervalo não é erro de
    # Lead._check() (que só valida os 13 campos do perfil, não o teste) —
    # sem o limite aqui, num=0 vira o índice -1 e Lead aceita em silêncio.
    num: int = Field(ge=1, le=4)
    escolhida: str = ""


class LaudoRequest(BaseModel):
    nome: str
    email: str = ""
    tel: str = ""
    alvo: str
    cargo: str
    formacao: str
    tempo: str
    provas: str
    metodo: str
    vde: str
    horas: str
    edital: str
    dor: str
    momento: str
    dinheiro: str
    leitura: str
    editais: list[str] = Field(default_factory=list)
    teste: list[RespostaTeste] = Field(default_factory=list)
    # Número real (sem "wa.me/") e mensagem já pronta (a mesma que
    # lib/quizContent.ts::waLink monta pra tela pública) — ver
    # brand.cta_whatsapp_com_mensagem pro porquê disso não vir do
    # CONFIG.whatsapp do próprio pacote. Só dígitos: vai direto pra dentro de
    # um atributo href (brand.py monta `https://wa.me/{numero}?text=...`
    # sem escapar `numero`) — sem essa validação, um valor com aspas quebra
    # ou altera a marcação do link final.
    whatsapp_numero: str = Field(default="", pattern=r"^\d{0,15}$")
    whatsapp_mensagem: str = ""
    # session_token do quiz_sessions no Supabase — vira a chave do objeto no
    # S3 (ver s3.upload_pdf). Opcional: só quem quer o laudo salvo no S3
    # manda (ver lib/server/laudoPdfBackground.ts); o download avulso do
    # admin não precisa. Formato uuid (o que o Postgres usa pra
    # session_token) — nunca vira parte de um path sem validar o formato
    # antes, pra não deixar a chave do S3 escapar de "laudos/".
    session_token: str | None = Field(
        default=None,
        pattern=r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
    )


def verificar_segredo(x_laudo_secret: str | None = Header(default=None)) -> None:
    segredo = os.environ.get("LAUDO_SERVICE_SECRET")
    # secrets.compare_digest, não `!=`: comparação de string comum vaza
    # quanto do segredo bateu pelo tempo de resposta (compara byte a byte e
    # para no primeiro que diverge) — mesmo padrão de
    # lib/server/adminAuth.ts (timingSafeEqual) do lado Next.js.
    if not segredo or not x_laudo_secret or not secrets.compare_digest(x_laudo_secret, segredo):
        raise HTTPException(status_code=401, detail="não autenticado")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/laudo")
async def gerar_laudo(req: LaudoRequest, _auth: None = Depends(verificar_segredo)) -> Response:
    dados = {
        "nome": req.nome, "email": req.email, "tel": req.tel,
        "editais": req.editais,
        "teste": {r.num - 1: r.escolhida for r in req.teste if r.escolhida},
        **{campo: getattr(req, campo) for campo in CAMPOS},
    }

    try:
        lead = Lead(dados)
    except LeadInvalido as e:
        # 422, não 500: dado de entrada ruim (sessão com perfil incompleto ou
        # resposta fora das opções válidas), não bug do serviço. O Next.js já
        # deveria ter barrado isso antes de chamar aqui (ver
        # validarSessaoParaLaudo do lado dele) — isso é a segunda camada.
        raise HTTPException(status_code=422, detail=str(e)) from e

    # report.py::build_html usa date.today() se `hoje` não for passado — em
    # UTC (o container roda em UTC), isso data o laudo errado entre 21h e
    # meia-noite no horário de Brasília. Calcula explícito em SP_TZ.
    hoje = datetime.now(SP_TZ).date()

    try:
        html = report_mod.build_html(lead, hoje=hoje)
        html = brand.titulo_da_base(html)
        html = brand.raio_x_generico(html)
        html = brand.voz_do_time(html)
        html = brand.remover_marca_duplicada(html)
        html = brand.cta_whatsapp_com_mensagem(html, req.whatsapp_numero, req.whatsapp_mensagem)
        pdf_bytes = await render.html_para_pdf(html)
    except Exception:
        # Aqui dentro é sempre bug do serviço (dado do lead já validou acima) —
        # loga o traceback de verdade nos logs da plataforma, mas não devolve
        # detalhe nenhum pra quem chamou.
        logger.exception("falha ao gerar laudo para %s", req.nome)
        raise HTTPException(status_code=500, detail="falha ao gerar o PDF") from None

    headers = {"Content-Disposition": f'attachment; filename="laudo-{brand.nome_para_arquivo(req.nome)}.pdf"'}

    if req.session_token:
        if s3.configurado():
            try:
                headers["X-Laudo-S3-Key"] = await s3.upload_pdf(req.session_token, pdf_bytes)
            except Exception:
                # Diferente do except de cima: o PDF já está pronto, o
                # problema é só salvar no S3 — 502 (upstream), não 500, pra
                # quem chama (lib/server/laudoPdfBackground.ts) distinguir
                # "nosso bug" de "S3 fora do ar" se um dia precisar.
                logger.exception("falha ao subir laudo pro S3 (session_token=%s)", req.session_token)
                raise HTTPException(status_code=502, detail="falha ao salvar o PDF no S3") from None
        else:
            logger.info("S3_BUCKET não configurado — pulando upload (session_token=%s)", req.session_token)

    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


@app.post("/apresentacao")
async def gerar_apresentacao(req: LaudoRequest, _auth: None = Depends(verificar_segredo)) -> Response:
    # Mesmo corpo de POST /laudo (LaudoRequest) — o deck de call usa o mesmo
    # perfil do quiz, só não precisa de whatsapp_numero/whatsapp_mensagem
    # (não tem CTA de WhatsApp nas 22 telas).
    dados = {
        "nome": req.nome, "email": req.email, "tel": req.tel,
        "editais": req.editais,
        "teste": {r.num - 1: r.escolhida for r in req.teste if r.escolhida},
        **{campo: getattr(req, campo) for campo in CAMPOS},
    }

    try:
        variaveis = apresentacao.variaveis(dados)
    except LeadInvalido as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    try:
        pdf_bytes = await render.deck_para_pdf(APRESENTACAO_HTML, variaveis, APRESENTACAO_SLIDES)
    except Exception:
        logger.exception("falha ao gerar apresentação para %s", req.nome)
        raise HTTPException(status_code=500, detail="falha ao gerar o PDF") from None

    headers = {"Content-Disposition": f'attachment; filename="apresentacao-{brand.nome_para_arquivo(req.nome)}.pdf"'}

    if req.session_token:
        if s3.configurado():
            try:
                headers["X-Apresentacao-S3-Key"] = await s3.upload_pdf(req.session_token, pdf_bytes, prefixo="apresentacoes")
            except Exception:
                logger.exception("falha ao subir apresentação pro S3 (session_token=%s)", req.session_token)
                raise HTTPException(status_code=502, detail="falha ao salvar o PDF no S3") from None
        else:
            logger.info("S3_BUCKET não configurado — pulando upload (session_token=%s)", req.session_token)

    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
