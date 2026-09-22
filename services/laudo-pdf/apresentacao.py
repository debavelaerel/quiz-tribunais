"""Personalização da apresentação comercial (deck de call 1:1, 22 telas) —
vendor/vde-tribunais-call/deck.html.

O deck é HTML fixo (design aprovado, não mexer) com ~30 pontos marcados
`data-var="chave"` — cada um já vem preenchido com o valor de um lead de
exemplo (Rafael). Este módulo calcula o valor de cada `data-var` a partir dos
dados brutos do quiz, reaproveitando o MESMO pacote de diagnóstico do laudo
(diagnosis/) — o deck e o laudo descrevem o mesmo lead, então usam a mesma
fonte de verdade (profile.py, blocks.py), não duas.

Onde o deck precisa de uma frase que não é so o rótulo cru da pergunta (ex.:
"Fico perto do corte, mas não passo" na tela do quiz vira "Fica perto do
corte e não passa" na boca do consultor, falando dela na 3ª pessoa), a
transformação está numa tabela pequena e explícita por valor — nunca um
regex genérico de conjugação (não existe isso de forma confiável em
português) — pra ficar fácil de auditar e corrigir uma frase por vez.
"""
from html import escape as _esc

from diagnosis.answers import Lead
from diagnosis.blocks import BLOCKS
from diagnosis.profile import ALVOS, MOMENTOS, profile

# ---- grade do curso (tela 6) ------------------------------------------
# Números "179"/"257" são os que o deck de vendas já usa hoje — a mesma
# divergência contra os 168/231 do diagnosis/profile.py que o próprio
# ENTREGA-DEV.md do pacote já registra como pendente de confirmação. Fica
# como constante isolada aqui de propósito: trocar depois é uma linha só.
GRADE_TRT = {
    "temas": 179,
    "disciplinas": [
        "Língua Portuguesa.", "Raciocínio Lógico.", "Informática.",
        "Ética no Serviço Público.", "Constitucional.", "Administrativo.",
        "Civil.", "Processo Civil.", "Previdenciário.", "Direitos Humanos.",
    ],
    "destaque": ["Trabalho.", "Processo do Trabalho."],
}
GRADE_TJTRF = {
    "temas": 257,
    "disciplinas": [
        "Língua Portuguesa.", "Raciocínio Lógico.", "Informática.",
        "Ética no Serviço Público.", "Constitucional.", "Administrativo.",
        "Civil.", "Processo Civil.", "Tributário e Financeiro (TRF).",
        "Direitos Humanos (TRF).", "Previdenciário (TRF).",
        "Difusos e Coletivos (TRF).", "ECA (TRF).",
        "Ambiental e Urbanístico (TRF).",
    ],
    "destaque": ["Penal.", "Processo Penal."],
}

# ---- gargalo declarado (tela 3) ----------------------------------------
# Título: eco em 3ª pessoa da opção que o lead marcou no quiz (mesmo padrão
# do único exemplo que o deck já trazia, "banca"). Corpo: os dois parágrafos
# de blocks.py (grupo "O maior gargalo declarado") — a MESMA copy que já vai
# pro laudo de todo lead, só reaproveitada aqui, não reescrita.
_DOR_TITULO = {
    "base": 'Você disse que não tem base: sente que começa do zero a cada edital.',
    "improviso": 'Você disse que estuda no improviso, sem cronograma nem ordem.',
    "tempo": 'Você disse que tem pouco tempo: concilia estudo com trabalho.',
    "naojur": 'Você disse que tem medo das matérias não jurídicas: Português, RLM e Informática.',
    "fixar": 'Você disse que lê muito e resolve pouco: não fixa.',
    "banca": 'Você disse que não sabe o que a <span class="ul">FGV e a FCC cobram</span> de verdade.',
    "emocional": 'Você disse que o emocional sabota: ansiedade, comparação, sensação de atraso.',
    "todas": 'Você disse que sente um pouco de tudo isso ao mesmo tempo.',
}
# Frase de efeito final da tela 3 — só existia pronta pra "banca" no deck
# original. Não inventei uma pra cada uma das outras 7 (é a única peça de
# copy nova, não reaproveitada de blocks.py) — fica em branco (o elemento
# some, ver render._SET_VARS_JS) até alguém escrever as demais.
_DOR_NOTA = {
    "banca": (
        '<span class="gn-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
        '<path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8Z"/></svg></span>'
        '<span><b>É assim que a banca deixa de ser adivinhação:</b> você estuda pelo que ela já cobrou.</span>'
    ),
}


def _paragrafos_dor():
    grupo = next(g for g in BLOCKS if g["group"] == "O maior gargalo declarado")
    return {item["when"]["eq"]["dor"][0]: item["paragraphs"] for item in grupo["items"]}


_DOR_PARAGRAFOS = _paragrafos_dor()

# ---- transforms 1ª -> 3ª pessoa (tela 1) --------------------------------
# Só os campos cujo rótulo cru é uma frase em 1ª pessoa (o resto — cargo,
# formação, horas — já é substantivo/frase neutra e não precisa de nada).
_TEMPO_TELA1 = {
    "t0": "ainda não começou", "t1": "menos de 6 meses",
    "t2": "6 meses a 1 ano", "t3": "1 a 2 anos",
    "t4": "2 a 4 anos", "t5": "mais de 4 anos",
}
_PROVAS_TELA1 = {
    "p0": "Nunca fez uma prova de tribunal",
    "p1": "Fez uma ou duas e ficou longe do corte",
    "p2": "Fez várias e continua longe do corte",
    "p3": "Fica perto do corte e não passa",
    "p4": "Já foi aprovado(a) em algum tribunal e quer subir de cargo",
}
_EDITAL_TELA1 = {
    "reta": "Já saiu, prova em menos de 3 meses",
    "previsto": "Previsto pros próximos meses",
    "sem": "Sem edital específico, quer estar pronta quando abrir",
    "nao": "Não acompanha as previsões",
}
_EDITAL_CAPA = {
    "reta": "edital já saiu, prova em menos de 3 meses",
    "previsto": "edital previsto pros próximos meses",
    "sem": "sem edital específico no momento",
    "nao": "não acompanha previsões de edital",
}
# Forma curta de "horas" usada só na frase da tela 4 (prazo_titulo) — a
# própria tela 1 mantém "Entre 2 e 3 horas" (o rótulo cru) no seu data-var
# "horas"; é só aqui, dentro da frase, que o deck já trazia "2 a 3 horas".
_HORAS_CURTO = {
    "h0": "menos de 1 hora", "h1": "1 a 2 horas", "h2": "2 a 3 horas",
    "h3": "3 a 4 horas", "h4": "mais de 4 horas",
}


def _reais(valor: float) -> str:
    return f"R$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _grade(alvo: str) -> dict:
    return GRADE_TRT if alvo == "trt" else GRADE_TJTRF


def _html_lista_disciplinas(grade: dict) -> str:
    itens = [f"<li>{_esc(d)}</li>" for d in grade["disciplinas"]]
    itens += [f'<li class="hl">{_esc(d)}</li>' for d in grade["destaque"]]
    return "".join(itens)


def _curso_titulo_html(alvo: str) -> str:
    if alvo == "trt":
        return 'Você quer <span class="ul">TRT</span>, então o seu é o curso de TRT.'
    rotulo = ALVOS.get(alvo, "tribunais")
    return f'Você quer <span class="ul">{_esc(rotulo)}</span>, então o seu é o curso de TJ e TRF.'


def _curso_grade_html(alvo: str) -> str:
    grade = _grade(alvo)
    nome_curso = "TRT" if alvo == "trt" else "TJ / TRF"
    n_disc = len(grade["disciplinas"]) + len(grade["destaque"])
    return (
        f'<div class="comp-head" style="padding:26px 44px 20px;">'
        f'<span class="ct" style="font-size:40px;">Curso <span class="u">{_esc(nome_curso)}</span></span>'
        f'<span class="cc" style="font-size:26px;">{n_disc} disciplinas · {grade["temas"]} temas</span>'
        f"</div>"
        f'<ul class="comp-list" style="display:grid;grid-template-columns:repeat(3,1fr);'
        f'column-gap:44px;row-gap:2px;padding:26px 40px 30px;">{_html_lista_disciplinas(grade)}</ul>'
    )


def _dor_texto_html(dor: str) -> str:
    paragrafos = _DOR_PARAGRAFOS[dor]
    return "".join(f'<div class="icard" style="font-size:34px;">{_esc(p)}</div>' for p in paragrafos)


def variaveis(dados: dict) -> dict[str, str]:
    """Todo `data-var` do deck.html, calculado a partir dos campos brutos do
    quiz (o mesmo formato que LaudoRequest já valida em main.py)."""
    lead = Lead(dados)
    perfil = profile(lead)
    primeiro_nome = lead.nome.split(" ")[0] if lead.nome else ""
    alvo = lead.get("alvo")
    horas = lead.get("horas")
    dor = lead.get("dor")
    edital = lead.get("edital")

    # "base entre 8 e 12 meses" -> "Entre 8 e 12 meses" (mesma frase,
    # maiúscula, sem o "base" que só faz sentido dentro do laudo).
    ritmo = perfil["ritmo"]
    prazo = ritmo[len("base "):] if ritmo.startswith("base ") else ritmo
    prazo = prazo[:1].upper() + prazo[1:]

    dinheiro = int(lead.get("dinheiro"))  # anual, em milhares — ver TELA_DINHEIRO
    mensal = dinheiro // 12

    condicao_old = 1997.00
    condicao_new = round(condicao_old * 0.95, 2)
    parcela = round(condicao_new / 12, 2)

    return {
        # capa
        "nome": _esc(primeiro_nome),
        "cargo": _esc(lead.label("cargo")),
        "alvo": _esc(ALVOS.get(alvo, "")),
        "edital": _esc(_EDITAL_CAPA.get(edital, lead.label("edital"))),
        # tela 1
        "alvo_full": _esc(_alvo_full(alvo)),
        "formacao": _esc(lead.label("formacao")),
        "tempo": _esc(_TEMPO_TELA1.get(lead.get("tempo"), lead.label("tempo"))),
        "provas": _esc(_PROVAS_TELA1.get(lead.get("provas"), lead.label("provas"))),
        "horas": _esc(lead.label("horas")),
        "edital_curto": _esc(_EDITAL_TELA1.get(edital, lead.label("edital"))),
        "dor": _esc(lead.label("dor")),
        # tela 2
        "diagnostico": 'O que está entre você e a posse é a <span class="em-gold">formação de base</span>.',
        "momento": _esc(MOMENTOS.get(lead.get("momento"), "")),
        "nivel": _esc(f'{perfil["acertos"]} de 4 acertos, nível {perfil["nivel"]}'),
        "curso": _esc("Curso TRT" if alvo == "trt" else "Curso TJ e TRF"),
        "prazo": _esc(prazo),
        # tela 3
        "dor_titulo": _DOR_TITULO.get(dor, _esc(f'Você disse que "{lead.label("dor")}".')),
        "dor_texto": _dor_texto_html(dor),
        "dor_nota": _DOR_NOTA.get(dor, ""),
        # tela 4
        "prazo_titulo": (
            f'Com <span class="ul">{_esc(_HORAS_CURTO.get(horas, lead.label("horas").lower()))}</span> por dia, '
            f'a sua base fecha {_esc(prazo.lower())}.'
        ),
        "curso_painel": _curso_painel_html(alvo, horas),
        # tela 6
        "curso_titulo": _curso_titulo_html(alvo),
        "curso_grade": _curso_grade_html(alvo),
        # tela 19 — condição fixa (5%), não vem mais de preenchimento manual
        "condicao_k": "+ 5% de desconto",
        "condicao_old": _reais(condicao_old),
        "condicao_new": _reais(condicao_new),
        "condicao_sub": f"à vista, ou 12x de {_reais(parcela)}",
        # tela 20
        "roi_titulo": f'Você me disse que passaria a ganhar <span class="em-gold">R$ {mensal} mil a mais por mês</span>.',
        "roi_investimento": f"R$ {round(condicao_new):,}".replace(",", "."),
        "roi_retorno": f"R$ {dinheiro} mil",
    }


def _alvo_full(alvo: str) -> str:
    # ALVOS/label da pergunta trazem o nome comprido já pronto — só o "alvo"
    # (o rótulo curto do profile.py) tem o parêntese "(TRT)" no fim, que a
    # tela 1 não usa (o parêntese é redundante com o campo "alvo" da capa).
    completos = {
        "tj": "Tribunal de Justiça",
        "trf": "Tribunal Regional Federal",
        "trt": "Tribunal Regional do Trabalho",
        "fe": "Defensoria, Ministério Público ou Procuradoria",
        "any": "qualquer tribunal",
    }
    return completos.get(alvo, ALVOS.get(alvo, ""))


def _curso_painel_html(alvo: str, horas: str) -> str:
    nome_curso = "TRT" if alvo == "trt" else "TJ e TRF"
    linhas = [("2h", 12, "h2"), ("3h", 8, "h3"), ("4h", 6, "h4")]
    corpo = []
    for label_h, meses, codigo in linhas:
        extra = ""
        classe = "trow"
        if codigo == horas:
            classe += " you"
            extra = '<span class="you-badge">o seu hoje</span>'
        elif codigo == "h3":
            classe += " rec"
            extra = '<span class="rec-badge">recomendado</span>'
        corpo.append(
            f'<div class="{classe}"><span class="hrs"><b>{label_h}</b> por dia{extra}</span>'
            f'<span class="mo"><span class="n">{meses}</span><span class="u">meses</span></span></div>'
        )
    return (
        '<div class="course-head">'
        '<span class="ch-ico"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" '
        'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/>'
        '<path d="M12 7v5l3.5 2"/></svg></span>'
        f'<span class="cn">Curso {_esc(nome_curso)}</span></div>'
        f'<div class="course-body">{"".join(corpo)}</div>'
    )
