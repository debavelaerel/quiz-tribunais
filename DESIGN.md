# DESIGN.md — Quiz Raio-X da Base (VDE Tribunais)

<!-- meta
source: código do projeto (não há Figma — o código é a fonte da verdade)
paleta: guia oficial "Guia Visual — VDE Tribunais" (TRIBUNAIS.pdf) + public/brand/*.svg
last-reviewed: 2026-09-08
-->

> Fonte da verdade do design system deste quiz. Toda tela/componente novo deve
> ser construído a partir dos tokens abaixo — 100% fiel, sem reinventar cor,
> radius ou sombra soltos. Tokens canônicos vivem em `app/globals.css` (Tailwind
> v4 `@theme`); a seção 8 replica os mesmos valores em JSON pra consumo por
> ferramentas/agentes.

## 1. Identity

Design system em **Poppins** (única fonte carregada — confirmada como fonte
oficial da marca no guia; "Degular" também consta no guia pro texto, mas sem
licença de uso confirmada, então fica de fora por ora).

**Só 3 cores, de propósito** — decisão explícita do cliente depois de testar
(e rejeitar) versões com roxo profundo, lilás como accent e múltiplos tons de
navy: branco, azul da logo e dourado. Nada além disso é "cor" no sentido de
marca; cinzas são neutro puro (hierarquia de texto/borda) e verde/vermelho são
função (certo/errado na correção), nunca decoração. A única exceção é o
próprio logotipo: a assinatura "Tribunais" vem com um selo lilás de fábrica
(`public/brand/versao01-color0.svg`) — isso **não muda**, é regra do guia
oficial nunca alterar as cores do logotipo.

Formas com 3 raios (pill, 18px, 14px), sem sistema de sombra em cards — sombra
é reservada pra elementos flutuantes/acionáveis (botões, o cartão de vídeo).

## 2. Color (canônico — `app/globals.css`)

| Token | Hex | Uso |
|---|---|---|
| `brand-bg` | `#FFFFFF` | Fundo de toda tela |
| `brand-card` | `#FFFFFF` | Cartões (opções, kv-rows, correção) — mesma cor do fundo, separados só por borda |
| `brand-ink` | `#203C7C` | **O azul da logo.** Texto primário, títulos, estado selecionado, links |
| `brand-ink-soft` | `#5B6478` | Parágrafos de corpo (cinza neutro, não é "cor") |
| `brand-ink-dim` | `#7C86A6` | Metadados, legendas, placeholders (cinza neutro) |
| `brand-line` | `#E7E7EA` | Borda padrão de cartões/inputs (cinza neutro) |
| `brand-line-strong` | `#C9C9CE` | Borda em hover (cinza neutro) |
| `brand-tint` | `#EEF1F8` | Tinta clara do próprio azul — fundo de opção selecionada, chip, hover do botão voltar |
| `brand-navy` | `#203C7C` | Fundo de botão neutro (mesmo azul de `brand-ink`) |
| `brand-navy-2` | `#16305F` | Hover do botão neutro / gradiente do cartão de vídeo — sombra do mesmo azul |
| `brand-gold` | `#F9E08A` | Ponta clara do gradiente dourado |
| `brand-gold-deep` | `#C89B18` | Ponta escura do gradiente dourado |
| `brand-gold-text` | `#8A6A0C` | Texto do selo eyebrow (sobre `#FBF3D6`) |
| `brand-green` | `#2FB367` | Badge de acerto na correção (função, não decoração) |
| `brand-red` | `#E03131` | Badge de erro, alerta de erro (função, não decoração) |

**Pendente de virar token** (hoje hardcoded): `#ECE9F5` (trilho da barra de
progresso, `ProgressBar.tsx`) e `#FBF3D6` (fundo do selo eyebrow, `Quiz.tsx`).

## 3. Typography (Poppins, pesos 400/500/600/700)

| Papel | Tamanho | Peso | Onde |
|---|---|---|---|
| h1 abertura | 26px | 700 | Abertura, capa, tela de nome |
| h1 tela | 24px (`text-2xl`) | 700 | Todas as outras telas com título |
| h2 | 20px (`text-xl`) | 700 | Vídeo, desqualificação |
| body | 17px | 400 | Parágrafos da abertura |
| body-sm | 15.5–16px | 400 | Parágrafos das demais telas, enunciado |
| label | 14.5px | 500 | Rótulo de campo de formulário |
| caption | 12.5–13.5px | 400/600 | Metadados, legendas, rodapés |
| eyebrow | 12px | 600 | Selo dourado antes do título |

`letter-spacing: -0.01em` a `-0.015em` nos h1/h2 (aperta o título sem afetar o corpo).

## 4. Radius

- **`rounded-full`** (pill) — todo botão de ação, chips/badges, dot de opção.
- **`18px`** — cartão de opção (`OptionButton`).
- **`14px`** — cartão de informação (kv-row, item de correção, box de
  prescrição), input de formulário.
- **`22px`** — o cartão do vídeo (único elemento maior, ganha um raio maior de propósito).
- **`16px`** (`rounded-2xl`) — alerta de erro.
- Nunca usar um raio fora dessa escala; se precisar de algo entre 14 e 18,
  é sinal de que deveria ser um dos dois, não um valor novo.

## 5. Shadow (sem elevation numerada — só 3 papéis)

- **botão dourado**: `0 10px 24px rgba(200,155,24,.28)`, hover `0 14px 28px rgba(200,155,24,.32)` + `-translate-y-0.5`.
- **botão navy**: `0 10px 24px rgba(32,60,124,.18)`, hover `0 14px 28px rgba(32,60,124,.22)` + `-translate-y-0.5`.
- **cartão flutuante** (vídeo): `0 10px 30px rgba(32,60,124,.25)`.
- Nenhum botão leva sombra além da sua própria (`shadow-[...]` do variant) —
  um halo/glow extra no CTA da abertura foi testado e removido por criar uma
  "sobra" visível ao redor do botão sobre fundo branco.
- **Cards não têm sombra** — só borda (`brand-line`). Sombra é exclusiva de
  elementos acionáveis/flutuantes; usar sombra num card estático quebra essa
  regra e não deve acontecer sem motivo forte.
- Todas as sombras de UI usam o mesmo azul (`rgba(32,60,124,...)`) — nunca um
  cinza puro (`rgba(0,0,0,...)`): sombra tingida da própria cor de marca lê
  como escolhida, não padrão do navegador.

## 6. States

- **Hover** (botões): `-translate-y-0.5` + sombra mais funda (ver seção 5).
  `OptionButton` não selecionado: borda vai de `brand-line` pra `brand-line-strong`.
- **Selected** (`OptionButton`): borda `brand-ink`, fundo `brand-tint`,
  dot preenchido de `brand-ink`. (Antes disso já foram testadas e descartadas
  versões com roxo/lilás — ver seção 7, Don't.)
- **Focus** (inputs): `focus:border-brand-ink focus:ring-4 focus:ring-brand-ink/10`.
  **Gap conhecido**: `Button`/`OptionButton` não têm `focus-visible` customizado
  hoje (dependem do outline padrão do navegador) — corrigir antes de expor o
  quiz pra navegação por teclado como requisito.
- **Disabled**: `opacity-45` a `50`, sem `-translate-y-0.5`, sem sombra extra.
- **Erro**: `AlertaErro` — `border-brand-red/30 bg-brand-red/10 text-brand-red`, `role="alert"`.

## 7. Rules

**Do:**
- Reusar `Header`, `Button`, `OptionButton`, `ProgressBar`, `Eyebrow` — nunca
  duplicar o markup de botão/opção/card inline numa tela nova.
- Puxar cor só dos tokens `brand-*` de `app/globals.css`. Hex novo só entra
  ali, nunca direto num componente.
- Manter só Poppins. Se um dia precisar de uma 2ª fonte, é decisão de marca,
  não do código.
- Texto visível ao usuário final é sempre copy de produto — nunca nome de
  arquivo, variável de config ou instrução de desenvolvedor (ver Don't).
- Manter a paleta em 3 cores (branco, dourado, azul da logo) + neutro +
  função. Antes de adicionar qualquer cor nova, checar se não dá pra resolver
  com uma tinta/sombra do próprio azul ou dourado.
- Personalizar com o primeiro nome só nos toques pontuais já aprovados: 1ª
  pergunta do perfil, ficha (mirror), calculadora de custo (conta), correção,
  leitura e resultado (`comNome()` em `lib/quizContent.ts`). O nome já está
  disponível antes de qualquer tela de perfilamento nos dois fluxos (capa ou
  tela `nome`), então dá pra usar em qualquer uma dessas telas sem pedir de
  novo.

**Don't:**
- Não introduzir uma 4ª cor (a versão com roxo profundo + lilás como accent
  foi testada e rejeitada explicitamente — "mistureba de cores"). Variações
  de tinta do azul (`brand-tint`) ou do dourado não contam como cor nova;
  roxo, lilás (fora do logo) ou qualquer hue novo, conta.
- Não introduzir elementos de gamificação (corredor/bandeira, streak, badge de
  conquista) sem aprovação explícita — já testamos uma trilha com bandeira de
  chegada na barra de progresso e foi revertida por soar jovem/lúdica demais
  pro público de concurso de tribunais. A barra é intencionalmente só um
  preenchimento contínuo, sem marcos nomeados.
- Não deixar texto de placeholder/instrução de dev em tela que o usuário
  final vê (aconteceu com a tela de vídeo — "Troque CONFIG.videoSrc..." foi
  parar em produção; virou comentário de código, não mais texto renderizado).
- Não alterar as cores/proporções do logotipo — regra do guia oficial, vale
  inclusive pro selo lilás da assinatura "Tribunais".
- Não inventar um raio, sombra ou cor fora das seções 2, 4 e 5 sem atualizar
  este arquivo primeiro.
- Não repetir o nome em todas as 12 perguntas de perfil — testado e descartado
  por soar mala-direta; o efeito de "conversa" vem de usar em poucos
  momentos-chave, não em todo lugar.

## 8. Machine-readable tokens

```json design-tokens
{
  "$schema": "design-tokens.v1",
  "meta": { "source": "app/globals.css + components/*.tsx", "generated": "2026-09-08" },
  "color": {
    "brand-bg": "#FFFFFF",
    "brand-card": "#FFFFFF",
    "brand-ink": "#203C7C",
    "brand-ink-soft": "#5B6478",
    "brand-ink-dim": "#7C86A6",
    "brand-line": "#E7E7EA",
    "brand-line-strong": "#C9C9CE",
    "brand-tint": "#EEF1F8",
    "brand-navy": "#203C7C",
    "brand-navy-2": "#16305F",
    "brand-gold": "#F9E08A",
    "brand-gold-deep": "#C89B18",
    "brand-gold-text": "#8A6A0C",
    "brand-green": "#2FB367",
    "brand-red": "#E03131"
  },
  "typography": {
    "h1-abertura": { "fontFamily": "Poppins", "fontSize": 26, "fontWeight": 700, "letterSpacing": "-0.015em" },
    "h1-tela": { "fontFamily": "Poppins", "fontSize": 24, "fontWeight": 700, "letterSpacing": "-0.01em" },
    "h2": { "fontFamily": "Poppins", "fontSize": 20, "fontWeight": 700, "letterSpacing": "-0.01em" },
    "body": { "fontFamily": "Poppins", "fontSize": 17, "fontWeight": 400, "lineHeight": "1.6" },
    "body-sm": { "fontFamily": "Poppins", "fontSize": 15.5, "fontWeight": 400, "lineHeight": "1.5" },
    "label": { "fontFamily": "Poppins", "fontSize": 14.5, "fontWeight": 500 },
    "caption": { "fontFamily": "Poppins", "fontSize": 12.5, "fontWeight": 400 },
    "eyebrow": { "fontFamily": "Poppins", "fontSize": 12, "fontWeight": 600 }
  },
  "radius": { "pill": 999, "opcao": 18, "cartao": 14, "video": 22, "alerta": 16 },
  "shadow": {
    "botao-dourado": "0 10px 24px rgba(200,155,24,0.28)",
    "botao-dourado-hover": "0 14px 28px rgba(200,155,24,0.32)",
    "botao-navy": "0 10px 24px rgba(32,60,124,0.18)",
    "botao-navy-hover": "0 14px 28px rgba(32,60,124,0.22)",
    "cartao-video": "0 10px 30px rgba(32,60,124,0.25)"
  },
  "fonts": ["Poppins"]
}
```
