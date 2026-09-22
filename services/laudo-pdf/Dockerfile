# Build a partir deste diretório (services/laudo-pdf/), não da raiz do repo —
# o serviço é auto-contido: vendor/raio-x-da-base e vendor/brand são cópias
# de reference/raio-x-da-base e public/brand na raiz do repo (ver o
# cabeçalho de brand.py), porque o contexto do build de container não
# alcança nada fora deste diretório. Pra isso funcionar em deploy disparado
# por git (não só `vercel deploy` manual daqui de dentro), o projeto na
# Vercel precisa ter Root Directory = services/laudo-pdf configurado em
# Settings → Build and Deployment — sem isso o build lido a partir da raiz
# do repo não encontra vercel.json e falha com "Project framework is set to
# services, but no services are declared".
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

# Confirmado em produção (Vercel + Railway, ambos sem PORT nas env vars do
# projeto): a plataforma roteia pra porta declarada em EXPOSE, não injeta
# PORT — o fallback ${PORT:-8000} só entra em jogo rodando local/Docker puro.
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
