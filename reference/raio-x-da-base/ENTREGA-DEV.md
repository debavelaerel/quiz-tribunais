# Raio-X da Base — o que o desenvolvedor precisa

Este documento é o contrato. Com ele, o `diagnosis.json` e o
`casos-de-teste.json`, dá pra implementar o laudo em qualquer linguagem sem
abrir o Python.

## O que o funil faz

1. **O quiz** (`index.html`) é uma página só, autocontida. Faz 12 perguntas, 4
   questões de prova e uma pergunta final de preferência, e manda a pessoa pro
   WhatsApp. Ele **não** mostra o diagnóstico: o diagnóstico é o motivo da
   mensagem.
2. A mensagem do WhatsApp termina com um código, `RX1.trt.analista...`, que
   carrega todas as respostas.
3. **O laudo** é um PDF de cinco páginas, gerado a partir desse código, que o
   consultor devolve na mesma conversa.

O que o dev implementa é o passo 3: código entra, laudo sai.

## O que vem na entrega

| Arquivo | O que é |
|---|---|
| `diagnosis.json` | tudo: perguntas, diagnósticos, os 46 textos com as regras, pontuação, estrutura e CSS do laudo |
| `casos-de-teste.json` | 8 leads de exemplo com o resultado esperado de cada um |
| `exemplos/*.pdf` | os mesmos 8 laudos já gerados, para comparar o resultado visual |
| `diagnosis/` | a implementação de referência em Python, que já roda |

A fonte de verdade é o Python. O JSON é gerado dele por
`python3 _build/build-json.py`, então **não edite o JSON à mão**: na próxima
geração ele é sobrescrito. Texto novo ou regra nova entra em
`diagnosis/blocks.py` ou `diagnosis/diagnoses.py`, e o JSON sai de novo.

## O código RX1

```
RX1.<13 respostas na ordem>.<4 letras do teste>.<ids dos editais separados por ->
```

Exemplo:

```
RX1.trt.analista.direito.t4.p1.video.insta.h1.previsto.base.sembase.156.completa.AAAB.trt8
```

A ordem dos 13 campos está em `codigo.campos`, e é a mesma coisa que
`alvo, cargo, formacao, tempo, provas, metodo, vde, horas, edital, dor,
momento, dinheiro, leitura`.

Três coisas que quebram se forem ignoradas:

- **A ordem dos campos não muda.** Só dá pra acrescentar campo no fim. Mexer na
  ordem invalida todo código já enviado, e nesse caso o prefixo tem que virar
  `RX2`.
- **O teste tem uma letra por questão**, na ordem de `teste[]`. Quem não
  respondeu vira `-`.
- **Quando `alvo` é `fe`**, as opções válidas de `cargo` são as de
  `perguntas.cargo_fe`, não as de `perguntas.cargo`.

## Como o laudo é montado

O resultado tem três camadas, e elas são independentes:

**1. A leitura do caso.** Vem inteira de uma pergunta só, `momento`, a última do
quiz. `diagnosticos[momento]` traz `titulo`, `texto[]` e `prescricao`, que sai
na caixa "Começa por aqui:". Nenhuma outra resposta muda esse texto.

**2. O plano de ação.** É o `ordem[]` do mesmo diagnóstico, numerado. Só entra
no laudo se `leitura == "completa"`. Quem responde `basica` recebe o laudo sem
essa seção, e sem a linha dela no índice da capa.

**3. O ponto a ponto.** São os 46 textos de `blocos`. Cada grupo entrega **um**
texto: o primeiro item do array cuja regra `when` bater. Grupo sem nenhum item
batendo simplesmente não aparece. Um lead recebe de 8 a 11 textos.

Além disso, o cabeçalho da capa mostra curso indicado, ritmo, nível e momento,
todos derivados em `perfil`. A ordem das seções, o texto fixo de cada uma e o
CSS estão em `laudo`.

## Como avaliar uma regra

Toda regra do arquivo, seja o `when` de um bloco, o `if` de um parágrafo, o
`so_quando` de uma seção ou o `se` da pontuação, usa o mesmo vocabulário, que
está em `regras.operadores`. Um avaliador só resolve o arquivo inteiro:

```
bate(regra, lead):
  regra vazia            -> verdadeiro
  eq         -> para todo campo: resposta do lead está na lista
  ne         -> para todo campo: resposta do lead NÃO está na lista
  wrong / right -> errou / acertou a questão n (0 a 3)
  score_min / score_max -> total de acertos no teste
  editais_min -> quantidade de editais de verdade marcados
  any        -> basta uma das regras da lista bater
  not        -> a regra de dentro não pode bater
  chaves no mesmo dicionário são somadas (E)
```

Dois detalhes que já morderam:

- **`editais_min` conta só edital de verdade.** O id `qualquer` aparece no
  código, e não conta. A lista válida é `editais[alvo]`; se `alvo` não tiver
  lista própria, cai na do `trt`.
- **Um parágrafo pode ser condicional:** `{"if": regra, "then": texto,
  "else": texto}`. Sem `else`, o parágrafo some quando a regra não bate.

Os textos aceitam três marcadores, descritos em `regras.marcadores`:
`{edital_label}`, `{edital_sub}` e `{disciplinas}`.

## Como conferir que está certo

`casos-de-teste.json` tem os 8 leads de exemplo. Para cada um: leia o `codigo`,
rode o seu motor, compare com o `esperado`. Ele traz o diagnóstico escolhido, se
o plano de ação entra, curso, ritmo, acertos, nível, pontos, classe e **a lista
de ids dos blocos, na ordem**.

Os oito juntos acionam os 46 textos, os 5 diagnósticos e as duas respostas da
última tela. Se os 8 passarem, a implementação está coberta.

Para o resultado visual, os PDFs em `exemplos/` são os mesmos 8 casos já
gerados pela implementação de referência.

## O que ainda está em aberto

Cinco coisas que ainda não têm valor final. Elas não impedem a implementação,
mas vão para o ar erradas se ninguém trocar.

| O que | Onde | Situação |
|---|---|---|
| Número do WhatsApp | `config.whatsapp` | é `5500000000000`, um placeholder. O botão do quiz e o do laudo não levam a lugar nenhum até trocar |
| Vídeo da tela de autoridade | `config.videoSrc` | vazio |
| Recebimento dos leads | `config.leadEndpoint` | vazio. Enquanto estiver assim, o laudo só sai do código `RX1` colado à mão pelo consultor |
| Contagem de temas | `perfil.cursos` | o laudo diz 168 temas no TRT e 231 em TJ e TRF. Os decks de venda dizem 179 e 257. **Confirmar qual está certo antes de ir pro ar**, porque o número aparece na capa do laudo |
| Lista de editais | `config.editaisAtualizadosEm` | o retrato é de 3 de setembro de 2026. A lista muda rápido e precisa de revisão periódica, com a data atualizada junto |

## O que não pode mudar

- **Os textos.** A copy é aprovada e revisada em `respostas-diagnostico.md` e
  `diagnosticos.md`. Nada de reescrever, encurtar ou "melhorar" no caminho.
- **A ordem dos campos do código RX1**, pelo motivo acima.
- **Os ids dos blocos e dos diagnósticos.** São o que liga o teste, a revisão de
  copy e o CRM.

## Rodando fora do repositório

O pacote `diagnosis/` normalmente vive dentro do repositório dos slides, e o
`assets.py` busca a fonte e o logo lá. Os arquivos que ele precisa vêm em
`assets/` nesta entrega. Para rodar solto, troque as duas linhas do topo do
`diagnosis/assets.py`:

```python
FONTS = pathlib.Path(__file__).resolve().parent.parent / 'assets/fonts/Poppins'
LOGO = pathlib.Path(__file__).resolve().parent.parent / 'assets/img/logo-olho-navy.svg'
```

São a Poppins em 400, 500, 600 e 700, nos subsets latin e latin-ext, e o logo do
olho em SVG. Quem for reimplementar em outra linguagem usa os mesmos arquivos:
eles entram no HTML em base64, pra o laudo chegar autocontido no WhatsApp.

## Rodando a implementação de referência

```bash
cd quiz-tribunais
python3 -m diagnosis "RX1.trt.analista.direito.t4.p1.video.insta.h1.previsto.base.sembase.156.completa.AAAB.trt8" --nome "Maria Clara" -o laudos/
```

Sai o PDF e uma linha de resumo pro CRM. O PDF precisa do Playwright, que o
pacote procura no `platform/node_modules` do repositório dos slides. Fora dali,
rode com `--html`: sai o mesmo laudo em HTML autocontido, que é exatamente o
que vira PDF.

Quando o `CONFIG.leadEndpoint` for ligado, o quiz passa a mandar o JSON das
respostas direto, e o código RX1 deixa de ser necessário. O formato do JSON é o
mesmo dicionário de respostas: uma chave por campo, mais `nome`, `email`, `tel`,
`editais` e `teste`.
