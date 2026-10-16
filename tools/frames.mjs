/**
 * Despeja os quadros do Marvin como JSON, direto do mesmo `buildGrid` que o
 * painel usa — o GIF do README não redesenha nada à mão, então nunca sai de
 * sincronia com o sprite.
 *
 *   node tools/frames.mjs | python3 tools/gif.py assets/marvin.gif
 */

import { PALETA, buildGrid } from '../hooks/sprite.ts'

/** A cena: cada humor pelo tempo que leva para mostrar o que faz. */
const CENA = [
  // Revira os olhos de um lado ao outro e pisca no quadro 11.
  { mood: 'livre', quadros: 12 },
  // Procura a resposta num canto do teto.
  { mood: 'pensando', quadros: 6 },
  // Arregala e treme junto com a cabeça.
  { mood: 'trabalhando', quadros: 6 },
  // Fecha em dois arcos.
  { mood: 'feliz', quadros: 4 },
  // Apaga, e desce a gota.
  { mood: 'exausto', quadros: 4 },
]

/** O mesmo intervalo entre quadros que o mod usa (`QUADRO_MS`). */
const QUADRO_MS = 420

const frames = []
for (const { mood, quadros } of CENA) {
  for (let frame = 0; frame < quadros; frame++) {
    frames.push({ mood, grid: buildGrid(mood, frame).map(linha => linha.join('')) })
  }
}

process.stdout.write(
  JSON.stringify({
    frame_ms: QUADRO_MS,
    vazio: '.',
    palette: Object.fromEntries(
      Object.entries(PALETA).map(([tinta, cor]) => [tinta, `#${cor.toString(16).padStart(6, '0')}`]),
    ),
    frames,
  }),
)
