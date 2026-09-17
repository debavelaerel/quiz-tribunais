"""Script manual (não pytest) pra testar o serviço contra os 8 casos de
aceite, decodificando o código RX1... de cada um via answers.from_code() —
o próprio pacote sabe ler esse formato, não precisei reimplementar nada.
"""
import json
import os
import sys
from pathlib import Path

os.environ["LAUDO_SERVICE_SECRET"] = "teste-local"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402
from diagnosis.answers import from_code  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CASOS_PATH = REPO_ROOT / "reference/raio-x-da-base/casos-de-teste.json"
OUT_DIR = Path(__file__).resolve().parent / "pdfs-teste-python"
OUT_DIR.mkdir(exist_ok=True)

casos = json.loads(CASOS_PATH.read_text(encoding="utf-8"))["casos"]

# `with TestClient(app) as client:` — não só `TestClient(app)` — é o que
# dispara o lifespan (startup/shutdown) do FastAPI; sem isso render.iniciar()
# nunca roda e a primeira chamada bate em "render.iniciar() precisa rodar
# antes de html_para_pdf()".
with TestClient(app) as client:
    for caso in casos:
        lead = from_code(caso["entrada"]["codigo"])
        payload = {
            "nome": lead.nome or caso["entrada"]["nome"],
            "email": lead.email,
            "tel": lead.tel,
            "editais": lead.editais_raw,
            "teste": [{"num": n + 1, "escolhida": lead.teste.get(n, "")} for n in range(4)],
            "whatsapp_numero": "",
            "whatsapp_mensagem": "",
            **{campo: lead.get(campo) for campo in
               ["alvo", "cargo", "formacao", "tempo", "provas", "metodo", "vde",
                "horas", "edital", "dor", "momento", "dinheiro", "leitura"]},
        }
        resp = client.post("/laudo", json=payload, headers={"X-Laudo-Secret": "teste-local"})
        if resp.status_code != 200:
            print(f"❌ {caso['id']}: HTTP {resp.status_code} — {resp.text[:300]}")
            continue
        out_path = OUT_DIR / f"{caso['id']}.pdf"
        out_path.write_bytes(resp.content)
        print(f"✓ {caso['id']}: {len(resp.content)} bytes -> {out_path}")

print("\nOK — todos os 8 PDFs gerados." if all(
    (OUT_DIR / f"{c['id']}.pdf").exists() for c in casos
) else "\nFALTOU algum — ver erros acima.")
