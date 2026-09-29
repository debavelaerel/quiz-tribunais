"""Monta o laudo em HTML: o arquivo que o time manda pro lead no WhatsApp.

O HTML sai autocontido (fonte e logo embutidos) e já formatado para A4, então
serve tanto pra abrir no navegador quanto pra virar PDF em diagnosis.pdf.
"""
import datetime
import html

from .assets import fonts_css, logo_svg
from .blocks import BLOCKS
from .diagnoses import DIAGNOSES
from .profile import profile
from .questions import CONFIG, QUESTIONS, TEST
from .rules import selected_blocks

MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
         "agosto", "setembro", "outubro", "novembro", "dezembro"]

FICHA = [("alvo", "Concurso alvo"), ("cargo", "Cargo"), ("formacao", "Formação"),
         ("tempo", "Tempo de estudo"), ("provas", "Provas de tribunal já feitas"),
         ("metodo", "Como estudou até aqui"), ("vde", "Conhece o Método VDE"),
         ("horas", "Horas por dia"), ("edital", "Edital na mira"),
         ("editais", "Concursos escolhidos"), ("dor", "Maior gargalo"),
         ("momento", "Frase que te define"), ("dinheiro", "Ganho a mais se aprovado")]

CSS = """
/* Mesmos tokens do quiz (system/themes/vde-tribunais, variante clara), para o
   laudo chegar no WhatsApp parecendo a continuação da página, não outro produto. */
:root{
  --bg:#FFFFFF; --creme:#F7F5F0; --card:#FBF9F5; --ink:#0B1A3F; --ink-soft:#3D4767; --ink-dim:#7C86A6;
  --line:#E2DFF0; --line-strong:#C9C4E8; --lav:#C3BEF9; --lav-soft:#F1EFFC;
  --purple:#5421A1; --navy:#01123A; --gold:#F9E08A; --gold-deep:#C89B18;
  --gold-soft:#FBF3D6; --gold-text:#8A6A0C; --green:#1F9457; --red:#C92A2A;
}
/* As margens ficam com o gerador de PDF, não aqui: margem no CSS ganha da API e
   o conteúdo passa por cima do rodapé. Por isso o papel é branco, que é a cor
   que a faixa de margem tem de qualquer jeito; o creme do quiz entra nos
   cartões e na capa. */
@page{size:A4}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);
  font-family:'Poppins',system-ui,-apple-system,sans-serif;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
.folha{max-width:210mm;margin:0 auto;background:var(--bg);padding:0 15mm}
@media screen{ .folha{padding:16mm 15mm 20mm} }

/* ---- pílula dourada, igual à do quiz ---- */
.eyebrow{display:inline-block;font-size:10.5px;font-weight:600;letter-spacing:.02em;
  color:var(--gold-text);background:var(--gold-soft);border-radius:999px;padding:5px 11px;
  margin:0 0 10px}

/* ---- capa ---- */
.capa{min-height:266mm;display:flex;flex-direction:column;justify-content:space-between;
  break-after:page}
.marca{display:flex;align-items:center;gap:10px;color:var(--navy)}
.marca svg{width:38px;height:38px}
.marca b{font-size:17px;letter-spacing:-.01em}
.marca b span{display:inline-block;margin-left:7px;padding:3px 9px;border-radius:999px;
  background:var(--lav);color:var(--navy);font-size:11px;font-weight:600;vertical-align:middle}
.capa .painel{background:var(--creme);border-radius:26px;padding:34px 32px 30px}
.capa .painel .resumo div{background:#fff}   /* cartão branco sobre o creme, como no quiz */
.capa h1{font-size:31px;line-height:1.18;letter-spacing:-.025em;margin:0 0 12px}
.capa .abertura{font-size:14px;line-height:1.6;color:var(--ink-soft);margin:0;max-width:150mm}
.capa .rodape-capa{padding-top:22px;border-top:1.5px solid var(--line);
  display:flex;justify-content:space-between;align-items:baseline;gap:16px;
  font-size:11px;color:var(--ink-dim)}
.capa .rodape-capa b{color:var(--ink);font-weight:600}

/* ---- cartões do resumo ---- */
.resumo{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:26px 0 0}
.resumo div{display:flex;justify-content:space-between;gap:10px;background:var(--card);
  border:1.5px solid var(--line);border-radius:14px;padding:12px 15px;font-size:12px;
  break-inside:avoid}
.resumo div span:first-child{color:var(--ink-dim);font-weight:500}
.resumo div span:last-child{font-weight:600;text-align:right;color:var(--ink)}
.resumo div.wide{grid-column:1 / -1;border-color:var(--line-strong);background:var(--lav-soft)}

/* ---- índice da capa ---- */
.indice{margin-top:30px;padding-top:20px;border-top:1.5px solid var(--line)}
.indice .lbl{font-size:10px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;
  color:var(--ink-dim);margin:0 0 12px}
.indice ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;
  gap:9px 22px;counter-reset:item}
.indice li{counter-increment:item;display:flex;align-items:center;gap:10px;
  font-size:12px;font-weight:500;color:var(--ink)}
.indice li::before{content:counter(item);flex:0 0 auto;width:20px;height:20px;border-radius:50%;
  background:var(--lav-soft);border:1.5px solid var(--lav);color:var(--purple);
  font-size:10.5px;font-weight:600;display:flex;align-items:center;justify-content:center}

/* ---- seções ---- */
.sec{margin-top:26px;break-inside:auto}
.sec + .sec{margin-top:30px}
h1{font-size:25px;line-height:1.2;letter-spacing:-.02em;margin:0 0 8px}
h2{font-size:20px;line-height:1.3;letter-spacing:-.015em;margin:0 0 14px;color:var(--navy);
  break-after:avoid}
h3{font-size:14.5px;margin:0 0 7px;color:var(--navy);line-height:1.35}
p{font-size:12.6px;line-height:1.62;color:var(--ink-soft);margin:0 0 9px}
p b,li b{color:var(--ink)}
.leitura p{font-size:13.2px}

/* ---- blocos do ponto a ponto ---- */
.blk{background:var(--card);border:1.5px solid var(--line);border-radius:16px;
  padding:15px 18px;margin:0 0 10px;break-inside:avoid}
.blk h3{padding-left:13px;border-left:3px solid var(--lav)}
.blk p:last-child{margin-bottom:0}
.box{background:var(--card);border:1.5px solid var(--line);border-left:5px solid var(--gold-deep);
  border-radius:14px;padding:14px 17px;margin:14px 0;break-inside:avoid}
.box p{margin:0}
ol{margin:0;padding:0;list-style:none;counter-reset:passo}
ol li{counter-increment:passo;position:relative;padding:11px 15px 11px 46px;margin-bottom:8px;
  background:var(--card);border:1.5px solid var(--line);border-radius:14px;
  font-size:12.6px;line-height:1.55;color:var(--ink-soft);break-inside:avoid}
ol li::before{content:counter(passo);position:absolute;left:14px;top:10px;width:21px;height:21px;
  border-radius:50%;background:var(--navy);color:#fff;font-size:11px;font-weight:600;
  display:flex;align-items:center;justify-content:center}

/* ---- questões ---- */
.q{background:var(--card);border:1.5px solid var(--line);border-radius:16px;padding:13px 17px;
  margin-bottom:9px;break-inside:avoid}
.q .cab{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:4px}
.q .cab b{font-size:13px}
.q .cab .r{font-size:11px;font-weight:600;white-space:nowrap;padding:3px 9px;border-radius:999px}
.q .ok{color:var(--green);background:#E9F7EF}
.q .no{color:var(--red);background:#FDECEC}
.q .fonte{font-size:10.5px;color:var(--ink-dim);margin:0 0 7px}
.q p{margin:0;font-size:12.2px}

/* ---- ficha ---- */
.ficha{display:grid;grid-template-columns:1fr;gap:6px}
.ficha div{display:flex;justify-content:space-between;gap:14px;font-size:11.8px;
  padding:9px 15px;background:var(--card);border:1.5px solid var(--line);border-radius:12px;
  break-inside:avoid}
.ficha div span:first-child{color:var(--ink-dim);flex:0 0 auto}
.ficha div span:last-child{font-weight:600;text-align:right;color:var(--ink)}

/* ---- fechamento ---- */
.fim{background:var(--navy);color:#fff;border-radius:20px;padding:24px 26px;margin-top:18px;
  break-inside:avoid}
.fim .eyebrow{background:rgba(249,224,138,.16);color:var(--gold)}
.fim h2{color:#fff;margin-bottom:10px}
.fim p{color:#CBD3E8;font-size:12.8px}
.fim p:last-child{margin-bottom:0}
.fim b{color:var(--gold)}
.fim .selo{display:inline-block;margin-top:14px;text-decoration:none;
  background:linear-gradient(135deg,var(--gold),var(--gold-deep));
  color:var(--navy);font-weight:600;font-size:13px;border-radius:999px;padding:12px 22px}

footer{margin-top:20px;padding-top:11px;border-top:1px solid var(--line);
  font-size:9.5px;color:var(--ink-dim);line-height:1.6}
footer code{display:block;margin-top:3px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:8.5px;color:#9AA2BC;overflow-wrap:anywhere}
"""


def _esc(t):
    return html.escape(t, quote=False)


def _data(dt=None):
    d = dt or datetime.date.today()
    return f"{d.day} de {MESES[d.month - 1]} de {d.year}"


def build_html(lead, hoje=None):
    p = profile(lead)
    diag = DIAGNOSES[lead.get("momento")]
    blocos = selected_blocks(BLOCKS, lead)
    primeiro = (lead.nome or "").split(" ")[0]
    saudacao = f"Oi, {_esc(primeiro)}." if primeiro else "Oi."

    resumo = [("Onde você está", p["momento"]),
              ("Alvo", f"{p['cargo']} · {p['alvo']}"),
              ("Nível no teste", f"{p['nivel']} · {p['acertos']} de {len(TEST)}"),
              ("Tempo disponível", lead.label("horas").lower())]
    resumo_html = "".join(
        f'<div><span>{_esc(k)}</span><span>{_esc(v)}</span></div>' for k, v in resumo)
    resumo_html += (f'<div class="wide"><span>Curso indicado</span>'
                    f'<span>{_esc(p["curso"])}</span></div>')
    if p["ritmo"]:
        resumo_html += (f'<div class="wide"><span>Ritmo no seu tempo de estudo</span>'
                        f'<span>{_esc(p["ritmo"])}</span></div>')

    blocos_html = "".join(
        '<div class="blk"><h3>{}</h3>{}</div>'.format(
            _esc(b["title"]),
            "".join(f"<p>{_esc(t)}</p>" for t in b["paragraphs"]))
        for b in blocos)

    questoes = []
    for i, q in enumerate(TEST):
        acertou = lead.correct(i)
        marcou = lead.teste.get(i, "não respondeu")
        veredito = ("acertou" if acertou
                    else f"errou · marcou {marcou}, gabarito {q['gabarito']}")
        questoes.append(
            f'<div class="q"><div class="cab"><b>{_esc(q["disc"])}</b>'
            f'<span class="r {"ok" if acertou else "no"}">{_esc(veredito)}</span></div>'
            f'<p class="fonte">{_esc(q["fonte"])}</p>'
            f'<p>{_esc(q["comentario"])}</p></div>')

    ficha = []
    for campo, rot in FICHA:
        valor = lead.label(campo)
        if valor:
            ficha.append(f'<div><span>{_esc(rot)}</span><span>{_esc(valor)}</span></div>')

    secoes = ["A leitura do seu caso"]
    if lead.get("leitura") == "completa":
        secoes.append("A ordem que eu seguiria")
    secoes += ["Ponto a ponto das suas respostas", "As quatro questões, comentadas",
               "A sua ficha completa", "O próximo passo"]
    indice = "".join(f"<li>{_esc(x)}</li>" for x in secoes)

    ordem_html = ""
    if lead.get("leitura") == "completa":
        itens = "".join(f"<li>{_esc(x)}</li>" for x in diag["ordem"])
        ordem_html = f'''
  <section class="sec">
    <span class="eyebrow">O que vem primeiro</span>
    <h2>A ordem que eu seguiria no seu lugar</h2>
    <ol>{itens}</ol>
  </section>'''

    numero = CONFIG.get("whatsapp", "")
    convite = "Responder no WhatsApp e marcar o meu horário"
    selo = (f'<a class="selo" href="https://wa.me/{numero}">{convite}</a>'
            if numero and not numero.startswith("5500000") else f'<span class="selo">{convite}</span>')

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Raio-X da Base · {_esc(lead.nome or 'diagnóstico')}</title>
<style>
{fonts_css()}
{CSS}
</style>
</head>
<body>
<div class="folha">

  <section class="capa">
    <div class="marca">{logo_svg(38)}<b>VDE<span>Tribunais</span></b></div>

    <div class="painel">
      <span class="eyebrow">Raio-X da Base</span>
      <h1>{saudacao} Este é o seu raio-X completo.</h1>
      <p class="abertura">Ele sai das doze perguntas e das quatro questões que você
      respondeu. Eu leio o seu caso na mesma ordem em que eu leria pessoalmente: onde
      você está hoje, o que está te segurando, e o que eu faria primeiro se o problema
      fosse meu.</p>
      <div class="resumo">{resumo_html}</div>

      <div class="indice">
        <p class="lbl">Neste raio-X</p>
        <ul>{indice}</ul>
      </div>
    </div>

    <div class="rodape-capa">
      <span>Diagnóstico de <b>{_esc(lead.nome or 'lead sem nome')}</b></span>
      <span>{_esc(_data(hoje))}</span>
    </div>
  </section>

  <section class="sec leitura">
    <span class="eyebrow">A leitura do seu caso</span>
    <h2>{_esc(diag["titulo"])}</h2>
    {"".join(f"<p>{_esc(t)}</p>" for t in diag["texto"])}
    <div class="box"><p><b>Começa por aqui:</b> {_esc(diag["prescricao"])}</p></div>
  </section>
{ordem_html}

  <section class="sec">
    <span class="eyebrow">Resposta por resposta</span>
    <h2>Ponto a ponto do que você me contou</h2>
    {blocos_html}
  </section>

  <section class="sec">
    <span class="eyebrow">O teste de nível</span>
    <h2>As quatro questões, comentadas</h2>
    {"".join(questoes)}
  </section>

  <section class="sec">
    <span class="eyebrow">Para conferir</span>
    <h2>Suas respostas</h2>
    <div class="ficha">{"".join(ficha)}</div>
  </section>

  <div class="fim">
    <span class="eyebrow">O próximo passo</span>
    <h2>Isto diz onde você está. Agora falta o plano.</h2>
    <p>Um raio-X aponta o problema e não resolve ele sozinho. O que a conversa com o meu
    time faz é pegar este diagnóstico e virar plano de ação dentro do VDE Tribunais:
    qual dos dois cursos atende o seu alvo, o cronograma que cabe no seu tempo real de
    estudo, quais disciplinas entram primeiro e em que ordem, e o que fica pra depois.</p>
    <p>Se ainda não marcou o seu horário, é só responder a mesma conversa do WhatsApp em
    que você recebeu este arquivo. <b>Não custa nada</b>, e cada consultor abre poucos
    horários por semana.</p>
    {selo}
  </div>

  <footer>
    Raio-X da Base · VDE Tribunais · diagnóstico de {_esc(lead.nome or 'lead sem nome')}
    <code>{_esc(lead.code())}</code>
  </footer>

</div>
</body>
</html>
"""
