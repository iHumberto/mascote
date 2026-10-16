#!/usr/bin/env python3
"""
Monta o GIF do README com os quadros que o `tools/frames.mjs` despeja.

    node tools/frames.mjs | python3 tools/gif.py assets/marvin.gif

Precisa de Pillow. O fundo é escuro de propósito: o casco do Marvin é quase
branco, e sobre o tema claro do GitHub ele desapareceria.
"""

import json
import sys

from PIL import Image

ESCALA = 10
MARGEM = 2  # em pixels de sprite, antes da escala
FUNDO = (0x16, 0x16, 0x1A)


def rgb(cor: str) -> tuple[int, int, int]:
    return tuple(int(cor[i : i + 2], 16) for i in (1, 3, 5))  # type: ignore[return-value]


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2

    dados = json.load(sys.stdin)
    paleta = {tinta: rgb(cor) for tinta, cor in dados["palette"].items()}
    vazio = dados["vazio"]

    quadros = []
    for frame in dados["frames"]:
        grade = frame["grid"]
        altura, largura = len(grade), len(grade[0])
        img = Image.new("RGB", (largura + MARGEM * 2, altura + MARGEM * 2), FUNDO)
        pixels = img.load()
        assert pixels is not None
        for y, linha in enumerate(grade):
            for x, tinta in enumerate(linha):
                if tinta != vazio:
                    pixels[x + MARGEM, y + MARGEM] = paleta[tinta]
        quadros.append(
            img.resize((img.width * ESCALA, img.height * ESCALA), Image.Resampling.NEAREST)
        )

    saida = sys.argv[1]
    quadros[0].save(
        saida,
        save_all=True,
        append_images=quadros[1:],
        duration=dados["frame_ms"],
        loop=0,
        optimize=True,
    )
    print(
        f"{saida}: {len(quadros)} quadros, "
        f"{quadros[0].width}x{quadros[0].height}, "
        f"{dados['frame_ms']} ms cada",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
