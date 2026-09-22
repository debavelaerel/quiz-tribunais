"""Upload do PDF pro S3 — feature opcional: sem as 4 env vars configuradas,
`configurado()` devolve False e quem chama (main.py) pula o upload sem
tratar como erro (ainda não recebemos as credenciais do devops). Uma vez
configurado, uma falha real de upload é erro de verdade — vira 502 em
main.py, não é engolida aqui.

Nomes de env var próprios (LAUDO_S3_*), não os padrão do boto3
(AWS_ACCESS_KEY_ID/AWS_DEFAULT_REGION/etc.) e passados explícito pro
client, de propósito: a Vercel expõe as suas PRÓPRIAS AWS_* ambiente (região
e identidade da function, não credencial de bucket nenhum) pra dentro de
toda function — se o client lesse as env vars padrão via detecção
automática, um dia em que alguém esquecesse de configurar uma das nossas
LAUDO_S3_* faria o boto3 silenciosamente cair pra essa credencial ambiente
sem permissão nenhuma no nosso bucket, em vez de simplesmente não subir
nada. Além disso, o boto3 só lê AWS_DEFAULT_REGION (não AWS_REGION) por
padrão — nome fácil de confundir com o do SDK do Node (lib/server/s3.ts),
que lê AWS_REGION; usar um nome nosso, igual nos dois lados, evita essa
armadilha de propósito.
"""
import os
from functools import lru_cache

_VARS = ("LAUDO_S3_BUCKET", "LAUDO_S3_REGION", "LAUDO_S3_ACCESS_KEY_ID", "LAUDO_S3_SECRET_ACCESS_KEY")


def configurado() -> bool:
    return all(os.environ.get(v) for v in _VARS)


@lru_cache(maxsize=1)
def _cliente():
    import boto3
    from botocore.config import Config

    # Timeouts curtos e poucas tentativas (defaults do boto3: 60s de
    # connect+read, retry legado até 5x) — sem isso, um S3/endpoint que
    # trava deixa a put_object presa por minutos. Já roda em thread separada
    # (ver upload_pdf), então "só" atrasa aquele upload, mas não faz sentido
    # deixar mais longo que o timeout de 55s que o lado Next.js já usa pra
    # desistir dessa chamada (ver lib/server/laudoService.ts).
    return boto3.client(
        "s3",
        region_name=os.environ["LAUDO_S3_REGION"],
        aws_access_key_id=os.environ["LAUDO_S3_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["LAUDO_S3_SECRET_ACCESS_KEY"],
        config=Config(connect_timeout=5, read_timeout=20, retries={"max_attempts": 2}),
    )


async def upload_pdf(session_token: str, pdf_bytes: bytes, prefixo: str = "laudos") -> str:
    """Sobe o PDF pro S3 sob uma chave estável (session_token) — reenviar o
    laudo (ou a apresentação, ver `prefixo`) do mesmo lead sobrescreve o
    objeto em vez de acumular versões soltas. Deixa a exceção do boto3 subir
    pra quem chamou decidir o que fazer com a falha; só chame depois de
    conferir `configurado()`.

    boto3 é síncrono — chamado direto dentro do `async def` de main.py,
    put_object bloquearia o event loop inteiro do uvicorn (um processo só)
    até terminar ou dar timeout, travando toda outra requisição em voo
    (outros laudos, /health) junto. `asyncio.to_thread` tira a chamada de
    rede do loop principal.
    """
    import asyncio

    bucket = os.environ["LAUDO_S3_BUCKET"]
    key = f"{prefixo}/{session_token}.pdf"
    cliente = _cliente()
    await asyncio.to_thread(cliente.put_object, Bucket=bucket, Key=key, Body=pdf_bytes, ContentType="application/pdf")
    return key
