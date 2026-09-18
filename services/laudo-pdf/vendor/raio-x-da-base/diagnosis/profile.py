"""Classificação do lead: pontuação, curso indicado, ritmo e nível.

Antes isso rodava no navegador. Agora roda só aqui, então o time tem uma
resposta só, calculada no mesmo lugar que escreve o laudo.
"""
from .questions import TEST

# Cronograma oficial do VDE, igual nos dois cursos: 2h/dia = 12 meses,
# 3h/dia = 8 meses (recomendado), 4h/dia = 6 meses.
RITMOS = {
    "h0": "abaixo do cronograma mínimo; com 2h por dia, base em 12 meses",
    "h1": "base em 12 meses, no ritmo de 2h por dia",
    "h2": "base entre 8 e 12 meses",
    "h3": "base entre 6 e 8 meses",
    "h4": "base em 6 meses",
}
NIVEIS = {0: "inicial", 1: "inicial", 2: "intermediário", 3: "avançado", 4: "avançado"}

ALVOS = {"tj": "TJ", "trf": "TRF", "trt": "TRT",
         "fe": "Defensoria, MP ou Procuradoria", "any": "qualquer tribunal"}
MOMENTOS = {"zero": "Começo do zero", "sembase": "Estudo sem base",
            "plato": "Veterano travado no corte", "improviso": "Ciclo do improviso",
            "servidor": "Servidor em ascensão"}


def points(lead):
    pts = 0
    cargo, alvo = lead.get("cargo"), lead.get("alvo")
    if cargo in ("analista", "oficial"):
        pts += 2
    elif cargo in ("any", "unsure"):
        pts += 1
    elif cargo == "tecnico" and alvo != "tj":
        pts += 1
    pts += 2 if lead.get("formacao") == "direito" else 1
    horas = lead.get("horas")
    if horas == "h1":
        pts += 1
    elif horas in ("h2", "h3", "h4"):
        pts += 2
    edital = lead.get("edital")
    if edital in ("previsto", "sem"):
        pts += 2
    elif edital == "nao":
        pts += 1
    if lead.get("dor") in ("base", "improviso", "banca", "todas"):
        pts += 1
    return pts


def profile(lead):
    """Tudo o que o consultor precisa ver em uma linha, e o laudo no cabeçalho."""
    pts = points(lead)
    trt = lead.get("alvo") == "trt"
    return {
        "pontos": pts,
        "classe": "A" if pts >= 7 else "B",
        "curso_cod": "C1-TRT" if trt else "C2-TJTRF",
        "curso": ("Curso 1 · Analista de TRT (168 temas)" if trt
                  else "Curso 2 · Analista de TJ e TRF (231 temas)"),
        "ritmo": RITMOS.get(lead.get("horas"), ""),
        "acertos": lead.score,
        "nivel": NIVEIS[lead.score],
        "momento": MOMENTOS[lead.get("momento")],
        "alvo": ALVOS.get(lead.get("alvo"), ""),
        "cargo": lead.label("cargo").lower(),
    }


def one_line(lead):
    """Resumo de uma linha, pro consultor colar no CRM."""
    p = profile(lead)
    return (f"perfil {p['classe']} ({p['pontos']} pts) · {p['curso_cod']} · "
            f"{p['momento'].lower()} · {lead.get('dor')} · {lead.label('horas').lower()} · "
            f"edital:{lead.get('edital')} · teste {p['acertos']}/{len(TEST)} · "
            f"vde:{lead.get('vde')}")
