# Build a partir da raiz do repo (não de services/laudo-pdf/) — o serviço
# depende de reference/raio-x-da-base/ (o pacote vendorizado) e de
# public/brand/ (o logo do app), fora do próprio diretório do serviço. Ver
# services/laudo-pdf/brand.py: REPO_ROOT = SERVICE_DIR.parent.parent — a
# estrutura de diretório dentro da imagem precisa espelhar a do repo pra
# essas contas baterem.
# bookworm (Debian 12) explícito, não "slim" puro: "slim" já aponta pro
# Debian 13 (trixie), recente demais pra lista de pacotes que
# `playwright install --with-deps` conhece pra essa versão do Playwright
# (1.49.1) — ele tenta instalar ttf-ubuntu-font-family/ttf-unifont, que não
# existem mais em trixie, e o build quebra.
FROM python:3.12-slim-bookworm

WORKDIR /app

COPY services/laudo-pdf/requirements.txt services/laudo-pdf/requirements.txt
RUN pip install --no-cache-dir -r services/laudo-pdf/requirements.txt

# --with-deps instala as bibliotecas de sistema que o Chromium headless
# precisa (fontconfig, libnss3, etc.) — precisa rodar como root, por isso
# Dockerfile em vez do builder automático (Railpack/Nixpacks não dão esse
# controle e não rodam esse passo).
RUN playwright install --with-deps chromium

COPY reference/raio-x-da-base reference/raio-x-da-base
COPY public/brand public/brand
COPY services/laudo-pdf services/laudo-pdf

WORKDIR /app/services/laudo-pdf

EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
