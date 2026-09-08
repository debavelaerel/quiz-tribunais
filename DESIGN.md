# DESIGN.md — Quiz Raio-X da Base (VDE Tribunais)

<!-- meta
source: código do projeto (não há Figma — o código é a fonte da verdade)
paleta extraída de: funil de referência "Raio-X da Base" (docs/superpowers/specs)
last-reviewed: 2026-09-08
-->

> Fonte da verdade do design system deste quiz. Toda tela/componente novo deve
> ser construído a partir dos tokens abaixo — 100% fiel, sem reinventar cor,
> radius ou sombra soltos. Tokens canônicos vivem em `app/globals.css` (Tailwind
> v4 `@theme`); a seção 8 replica os mesmos valores em JSON pra consumo por
> ferramentas/agentes.

## 1. Identity

Design system em **Poppins** (única fonte carregada — sem par de fontes).
Fundo bege quente (`#F7F5F0`), texto primário navy bem escuro (`#0B1A3F`),
accent de narrativa dourado (`#F9E08A`/`#C89B18`), accent de seleção roxo
(`#5421A1`), selo de sub-marca lilás (`#C3BEF9`). Linguagem de formas com 3
raios (pill, 18px, 14px), sem sistema de sombra em cards — sombra é reservada
pra elementos flutuantes/acionáveis (botões, o cartão de vídeo).

## 2. Color (canônico — `app/globals.css`)

| Token | Hex | Uso |
|---|---|---|
| `brand-bg` | `#F7F5F0` | Fundo de toda tela |
| `brand-card` | `#FFFFFF` | Cartões (opções, kv-rows, correção) |
| `brand-ink` | `#0B1A3F` | Texto primário, títulos |
| `brand-ink-soft` | `#4A5578` | Parágrafos de corpo |
| `brand-ink-dim` | `#7C86A6` | Metadados, legendas, placeholders |
| `brand-line` | `#E2DFF0` | Borda padrão de cartões/inputs |
| `brand-line-strong` | `#C9C4E8` | Borda em hover, inputs |
| `brand-lav` | `#C3BEF9` | Selo "Tribunais" no logo, chip sólido |
| `brand-lav-soft` | `#F1EFFC` | Fundo de opção selecionada |
| `brand-purple` | `#5421A1` | Estado selecionado (dot, borda), links |
| `brand-navy` | `#01123A` | Fundo de botão neutro, texto sobre dourado |
| `brand-navy-2` | `#022053` | Hover do botão neutro, gradiente do vídeo |
| `brand-gold` | `#F9E08A` | Ponta clara do gradiente dourado |
| `brand-gold-deep` | `#C89B18` | Ponta escura do gradiente dourado |
| `brand-gold-text` | `#8A6A0C` | Texto do selo eyebrow (sobre `#FBF3D6`) |
| `brand-green` | `#2FB367` | Badge de acerto na correção |
| `brand-red` | `#E03131` | Badge de erro, alerta de erro |

**Pendente de virar token** (achado na revisão de código — hoje hardcoded):
`#ECE9F5` (trilho da barra de progresso, `ProgressBar.tsx`) e `#FBF3D6`
(fundo do selo eyebrow, `Quiz.tsx`). Promover a `brand-track` e
`brand-gold-chip` na próxima passada.

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
- **botão navy**: `0 10px 24px rgba(1,18,58,.18)`, hover `0 14px 28px rgba(1,18,58,.22)` + `-translate-y-0.5`.
- **cartão flutuante** (vídeo): `0 10px 30px rgba(1,18,58,.25)`.
- **brilho de destaque** (só o CTA da abertura, uso único e deliberado):
  `0 0 0 1px rgba(255,255,255,.4) inset, 0 0 40px rgba(249,224,138,.6)` por cima da sombra de botão dourado.
- **Cards não têm sombra** — só borda (`brand-line`). Sombra é exclusiva de
  elementos acionáveis/flutuantes; usar sombra num card estático quebra essa
  regra e não deve acontecer sem motivo forte.

## 6. States

- **Hover** (botões): `-translate-y-0.5` + sombra mais funda (ver seção 5).
  `OptionButton` não selecionado: borda vai de `brand-line` pra `brand-line-strong`.
- **Selected** (`OptionButton`): borda `brand-purple`, fundo `brand-lav-soft`,
  dot preenchido de `brand-purple`.
- **Focus** (inputs): `focus:border-brand-purple focus:ring-4 focus:ring-brand-purple/10`.
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

**Don't:**
- Não introduzir elementos de gamificação (corredor/bandeira, streak, badge de
  conquista) sem aprovação explícita — já testamos uma trilha com bandeira de
  chegada na barra de progresso e foi revertida por soar jovem/lúdica demais
  pro público de concurso de tribunais. A barra é intencionalmente só um
  preenchimento contínuo, sem marcos nomeados.
- Não deixar texto de placeholder/instrução de dev em tela que o usuário
  final vê (aconteceu com a tela de vídeo — "Troque CONFIG.videoSrc..." foi
  parar em produção; virou comentário de código, não mais texto renderizado).
- Não inventar um raio, sombra ou cor fora das seções 2, 4 e 5 sem atualizar
  este arquivo primeiro.

## 8. Machine-readable tokens

```json design-tokens
{
  "$schema": "design-tokens.v1",
  "meta": { "source": "app/globals.css + components/*.tsx", "generated": "2026-09-08" },
  "color": {
    "brand-bg": "#F7F5F0",
    "brand-card": "#FFFFFF",
    "brand-ink": "#0B1A3F",
    "brand-ink-soft": "#4A5578",
    "brand-ink-dim": "#7C86A6",
    "brand-line": "#E2DFF0",
    "brand-line-strong": "#C9C4E8",
    "brand-lav": "#C3BEF9",
    "brand-lav-soft": "#F1EFFC",
    "brand-purple": "#5421A1",
    "brand-navy": "#01123A",
    "brand-navy-2": "#022053",
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
    "botao-navy": "0 10px 24px rgba(1,18,58,0.18)",
    "botao-navy-hover": "0 14px 28px rgba(1,18,58,0.22)",
    "cartao-video": "0 10px 30px rgba(1,18,58,0.25)",
    "brilho-cta-abertura": "0 0 0 1px rgba(255,255,255,0.4) inset, 0 0 40px rgba(249,224,138,0.6)"
  },
  "fonts": ["Poppins"]
}
```
