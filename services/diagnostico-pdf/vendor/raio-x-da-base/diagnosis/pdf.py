"""HTML do laudo para PDF, via Playwright.

O Playwright vive em platform/node_modules e o node vem do nvm, então este
módulo procura os dois em vez de depender do PATH de quem chama.
"""
import pathlib
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCRIPT = pathlib.Path(__file__).resolve().parents[1] / '_build' / 'html2pdf.mjs'
PLATFORM = ROOT / 'platform'


class PDFIndisponivel(RuntimeError):
    pass


def _node():
    """Caminho do node: PATH primeiro, senão a versão mais nova do nvm."""
    from shutil import which
    achado = which('node')
    if achado:
        return achado
    versoes = sorted((pathlib.Path.home() / '.nvm/versions/node').glob('v*/bin/node'))
    if versoes:
        return str(versoes[-1])
    raise PDFIndisponivel(
        "node não encontrado. Instale o node ou gere só o HTML com --html.")


def disponivel():
    try:
        return bool(_node()) and (PLATFORM / 'node_modules/playwright').exists()
    except PDFIndisponivel:
        return False


def html_to_pdf(html, destino):
    """Grava `html` como PDF em `destino`. Levanta PDFIndisponivel se não der."""
    destino = pathlib.Path(destino).resolve()
    if not (PLATFORM / 'node_modules/playwright').exists():
        raise PDFIndisponivel(
            f"Playwright não instalado em {PLATFORM}. Rode `npm install` lá, "
            "ou gere só o HTML com --html.")
    with tempfile.NamedTemporaryFile('w', suffix='.html', encoding='utf-8', delete=False) as f:
        f.write(html)
        tmp = pathlib.Path(f.name)
    try:
        r = subprocess.run([_node(), str(SCRIPT), str(tmp), str(destino), str(PLATFORM)],
                           cwd=str(PLATFORM), capture_output=True, text=True)
        if r.returncode != 0:
            raise PDFIndisponivel(f"Playwright falhou:\n{r.stderr.strip()[:800]}")
    finally:
        tmp.unlink(missing_ok=True)
    return destino
