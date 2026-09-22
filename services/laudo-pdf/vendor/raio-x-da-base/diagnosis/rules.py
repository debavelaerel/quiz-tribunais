"""Avaliação das regras que ligam cada bloco do laudo.

O vocabulário das regras está documentado em blocks.py. Este módulo é a única
implementação delas, então bloco novo não precisa de código novo.
"""


def matches(cond, lead):
    """True se a regra `cond` bate com as respostas de `lead`."""
    if not cond:
        return True
    for chave, valor in cond.items():
        if chave == "eq":
            if not all(lead.get(campo) in vals for campo, vals in valor.items()):
                return False
        elif chave == "ne":
            if any(lead.get(campo) in vals for campo, vals in valor.items()):
                return False
        elif chave == "wrong":
            if not all(not lead.correct(n) for n in valor):
                return False
        elif chave == "right":
            if not all(lead.correct(n) for n in valor):
                return False
        elif chave == "score_min":
            if lead.score < valor:
                return False
        elif chave == "score_max":
            if lead.score > valor:
                return False
        elif chave == "editais_min":
            if len(lead.editais) < valor:
                return False
        elif chave == "any":
            if not any(matches(c, lead) for c in valor):
                return False
        elif chave == "not":
            if matches(valor, lead):
                return False
        else:
            raise ValueError(f"regra desconhecida: {chave}")
    return True


def resolve(paragrafo, lead):
    """Texto final de um parágrafo, que pode ser condicional."""
    if isinstance(paragrafo, str):
        return paragrafo
    escolhido = paragrafo["then"] if matches(paragrafo["if"], lead) else paragrafo.get("else", "")
    return escolhido


def selected_blocks(blocks, lead):
    """Um bloco por grupo: o primeiro cuja regra bater."""
    escolhidos = []
    for grupo in blocks:
        for item in grupo["items"]:
            if not matches(item["when"], lead):
                continue
            paras = [resolve(p, lead) for p in item["paragraphs"]]
            escolhidos.append({
                "id": item["id"],
                "group": grupo["group"],
                "title": item["title"].format(**lead.placeholders()),
                "paragraphs": [p.format(**lead.placeholders()) for p in paras if p],
            })
            break
    return escolhidos
