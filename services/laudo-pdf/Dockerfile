# Build a partir deste diretório (services/laudo-pdf/), não da raiz do repo —
# o serviço é auto-contido: vendor/raio-x-da-base e vendor/brand são cópias
# de reference/raio-x-da-base e public/brand na raiz do repo (ver o
# cabeçalho de brand.py), porque o Root Directory do projeto na Vercel é
# este diretório e o contexto do build de container não alcança nada fora
# dele.
# bookworm (Debian 12) explícito, não "slim" puro: "slim" já aponta pro
# Debian 13 (trixie), recente demais pra lista de pacotes que
# `playwright install --with-deps` conhece pra essa versão do Playwright
# (1.49.1) — ele tenta instalar ttf-ubuntu-font-family/ttf-unifont, que não
# existem mais em trixie, e o build quebra.
FROM python:3.12-slim-bookworm

WORKDIR /app

COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# --with-deps instala as bibliotecas de sistema que o Chromium headless
# precisa (fontconfig, libnss3, etc.) — precisa rodar como root, por isso
# Dockerfile em vez do builder automático (Railpack/Nixpacks não dão esse
# controle e não rodam esse passo).
RUN playwright install --with-deps chromium

COPY . .

EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
