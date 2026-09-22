"""As respostas de um lead: onde entram, como são lidas e como viram código.

O quiz não tem servidor, então o caminho normal é o código compacto que sai
junto na mensagem do WhatsApp. Quando o `leadEndpoint` estiver ligado, o mesmo
laudo sai do JSON que o quiz envia, sem mudar nada aqui.
"""
import json
import pathlib

from .questions import QUESTIONS, EDITAIS, TEST

PREFIXO = "RX1"
# Ordem dos campos dentro do código. Só dá pra acrescentar no fim; mexer na
# ordem invalida os códigos já enviados, e aí o prefixo precisa virar RX2.
CAMPOS = ["alvo", "cargo", "formacao", "tempo", "provas", "metodo", "vde",
          "horas", "edital", "dor", "momento", "dinheiro", "leitura"]


class LeadInvalido(ValueError):
    pass


def _validos(campo, alvo=None):
    chave = "cargo_fe" if (campo == "cargo" and alvo == "fe") else campo
    return [o[0] for o in QUESTIONS[chave]["opcoes"]]


class Lead:
    """Respostas de uma pessoa, com os atalhos que as regras e o laudo usam."""

    def __init__(self, dados):
        self.raw = dict(dados)
        self.nome = (dados.get("nome") or "").strip()
        self.email = (dados.get("email") or "").strip()
        self.tel = (dados.get("tel") or "").strip()
        self.ts = dados.get("ts") or ""
        editais = dados.get("editais") or []
        if isinstance(editais, str):
            editais = [x for x in editais.split(",") if x]
        self.editais_raw = editais
        teste = dados.get("teste") or {}
        if isinstance(teste, str):
            teste = json.loads(teste) if teste.strip().startswith("{") else dict(enumerate(teste))
        self.teste = {int(k): v for k, v in teste.items() if v}
        self._check()

    # ---- leitura ----------------------------------------------------
    def _check(self):
        for campo in CAMPOS:
            valor = self.raw.get(campo)
            if valor is None:
                raise LeadInvalido(f"falta a resposta de '{campo}'")
            if valor not in _validos(campo, self.raw.get("alvo")):
                raise LeadInvalido(f"'{valor}' não é uma resposta válida de '{campo}'")

    def get(self, campo):
        return self.raw.get(campo)

    def correct(self, n):
        return self.teste.get(n) == TEST[n]["gabarito"]

    @property
    def score(self):
        return sum(1 for n in range(len(TEST)) if self.correct(n))

    @property
    def editais(self):
        """Só os editais de verdade: 'qualquer' não é um deles."""
        lista = EDITAIS.get(self.get("alvo")) or EDITAIS.get("trt", [])
        por_id = {e["id"]: e for e in lista}
        return [por_id[i] for i in self.editais_raw if i in por_id]

    def label(self, campo):
        """Rótulo que o lead viu na tela, para a ficha de respostas."""
        if campo == "editais":
            return ", ".join(e["label"] for e in self.editais) or (
                "Qualquer um, quero estar pronto quando abrir"
                if "qualquer" in self.editais_raw else "")
        chave = "cargo_fe" if (campo == "cargo" and self.get("alvo") == "fe") else campo
        for opt in QUESTIONS[chave]["opcoes"]:
            if opt[0] == self.get(campo):
                return opt[1]
        return ""

    def placeholders(self):
        ed = self.editais
        return {
            "edital_label": ed[0]["label"] if ed else "",
            "edital_sub": ed[0]["sub"] if ed else "",
            "disciplinas": ("as 12 disciplinas do TRT" if self.get("alvo") == "trt"
                            else "as 16 disciplinas de TJ e TRF"),
        }

    # ---- código compacto --------------------------------------------
    def code(self):
        partes = [PREFIXO] + [self.get(c) for c in CAMPOS]
        partes.append("".join(self.teste.get(n, "-") for n in range(len(TEST))))
        partes.append("-".join(self.editais_raw))
        return ".".join(partes)


def from_code(code):
    """Lê o código que veio na mensagem do WhatsApp."""
    code = code.strip().strip("()").strip()
    if "RX1." in code:
        code = code[code.index("RX1."):]
    partes = code.split(".")
    if partes[0] != PREFIXO:
        raise LeadInvalido(f"código não começa com {PREFIXO}")
    esperado = 1 + len(CAMPOS) + 2
    if len(partes) != esperado:
        raise LeadInvalido(f"código com {len(partes)} campos, esperava {esperado}")
    dados = dict(zip(CAMPOS, partes[1:1 + len(CAMPOS)]))
    dados["teste"] = {i: c for i, c in enumerate(partes[-2]) if c != "-"}
    dados["editais"] = [x for x in partes[-1].split("-") if x]
    return Lead(dados)


def from_payload(caminho):
    """Lê o JSON que o quiz manda pro leadEndpoint (um lead ou uma lista)."""
    dados = json.loads(pathlib.Path(caminho).read_text(encoding="utf-8"))
    return [Lead(d) for d in (dados if isinstance(dados, list) else [dados])]
