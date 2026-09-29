"""Fontes e logo em base64, para o quiz e o laudo saírem autocontidos."""
import base64
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
FONTS = ROOT / 'decks/vde-tribunais-lancamento/assets/fonts/Poppins'
LOGO = ROOT / 'system/themes/vde-tribunais/assets/img/logo-olho-navy.svg'

LATIN_EXT = ("U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, "
             "U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, "
             "U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF")
LATIN = ("U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, "
         "U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, "
         "U+FEFF, U+FFFD")


def fonts_css(weights=(400, 500, 600, 700)):
    regras = []
    for w in weights:
        for sub, rng in (('latin-ext', LATIN_EXT), ('latin', LATIN)):
            b = base64.b64encode((FONTS / f'Poppins-{w}-{sub}.woff2').read_bytes()).decode()
            regras.append(
                f"@font-face{{font-family:'Poppins';font-style:normal;font-weight:{w};"
                f"font-display:swap;src:url(data:font/woff2;base64,{b}) format('woff2');"
                f"unicode-range:{rng};}}")
    return '\n'.join(regras)


def logo_svg(size=None):
    svg = LOGO.read_text(encoding='utf-8').strip()
    if size is None:
        return svg.replace('width="40" height="40"', 'aria-hidden="true"')
    return svg.replace('width="40" height="40"', f'width="{size}" height="{size}" aria-hidden="true"')
