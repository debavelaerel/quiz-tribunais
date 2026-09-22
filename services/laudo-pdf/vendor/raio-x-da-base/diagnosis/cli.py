"""Linha de comando do laudo.

Uso mais comum: o consultor copia a mensagem que o lead mandou no WhatsApp,
cola aqui e recebe o PDF pra devolver na mesma conversa.

    python3 -m diagnosis "RX1.trt.analista...." --nome "Maria Clara"

Quando o leadEndpoint estiver ligado, o mesmo laudo sai do JSON:

    python3 -m diagnosis --json leads-do-dia.json -o laudos/
"""
import argparse
import datetime
import pathlib
import re
import sys
import unicodedata

from . import pdf as pdf_mod
from .answers import Lead, LeadInvalido, from_code, from_payload
from .profile import one_line
from .report import build_html

EXEMPLO = {
    "alvo": "trt", "cargo": "analista", "formacao": "direito", "tempo": "t4",
    "provas": "p1", "metodo": "video", "vde": "insta", "horas": "h1",
    "edital": "previsto", "editais": ["trt8"], "dor": "base", "momento": "sembase",
    "dinheiro": "156", "leitura": "completa",
    "teste": {0: "A", 1: "A", 2: "A", 3: "B"},
    "nome": "Maria Clara", "email": "maria@exemplo.com", "tel": "(85) 99999-0000",
}


def slug(texto):
    t = unicodedata.normalize('NFKD', texto or '').encode('ascii', 'ignore').decode()
    t = re.sub(r'[^a-zA-Z0-9]+', '-', t).strip('-').lower()
    return t or 'lead'


def nome_arquivo(lead, ext):
    hoje = datetime.date.today().isoformat()
    return f"raio-x-{slug(lead.nome)}-{hoje}.{ext}"


def gerar(lead, destino, html_only, quieto=False):
    html = build_html(lead)
    destino = pathlib.Path(destino)
    if destino.is_dir() or destino.suffix == "":
        destino.mkdir(parents=True, exist_ok=True)
        destino = destino / nome_arquivo(lead, "html" if html_only else "pdf")
    if html_only or destino.suffix.lower() == ".html":
        destino.write_text(html, encoding="utf-8")
    else:
        pdf_mod.html_to_pdf(html, destino)
    if not quieto:
        print(f"{destino}  ·  {one_line(lead)}")
    return destino


def main(argv=None):
    ap = argparse.ArgumentParser(
        prog="python3 -m diagnosis",
        description="Gera o laudo do Raio-X da Base a partir das respostas do lead.")
    ap.add_argument("codigo", nargs="?",
                    help="o código RX1 da mensagem do WhatsApp (pode colar a mensagem inteira)")
    ap.add_argument("--json", metavar="ARQUIVO",
                    help="lê um lead, ou uma lista deles, do JSON que o quiz envia")
    ap.add_argument("--nome", help="nome do lead, quando vier do código")
    ap.add_argument("-o", "--saida", default=".",
                    help="arquivo ou pasta de destino (padrão: pasta atual)")
    ap.add_argument("--html", action="store_true", help="gera HTML em vez de PDF")
    ap.add_argument("--resumo", action="store_true",
                    help="só imprime a classificação do lead, sem gerar arquivo")
    ap.add_argument("--exemplo", action="store_true",
                    help="usa um lead de exemplo, pra revisar a copy do laudo")
    args = ap.parse_args(argv)

    try:
        if args.exemplo:
            leads = [Lead(EXEMPLO)]
        elif args.json:
            leads = from_payload(args.json)
        else:
            codigo = args.codigo or sys.stdin.read()
            if not codigo.strip():
                ap.error("passe o código RX1, o --json ou o --exemplo")
            leads = [from_code(codigo)]
            if args.nome:
                leads[0].nome = args.nome
    except LeadInvalido as e:
        print(f"erro: {e}", file=sys.stderr)
        return 2
    except FileNotFoundError as e:
        print(f"erro: arquivo não encontrado: {e.filename}", file=sys.stderr)
        return 2

    if args.resumo:
        for lead in leads:
            print(f"{lead.nome or '(sem nome)'}: {one_line(lead)}")
        return 0

    try:
        for lead in leads:
            gerar(lead, args.saida, args.html)
    except pdf_mod.PDFIndisponivel as e:
        print(f"erro: {e}", file=sys.stderr)
        return 3
    return 0
