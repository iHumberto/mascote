/**
 * O bichinho: a cara do Marvin, o andróide paranóide, numa grade de 20x20
 * pixels empacotada no formato que o elemento `Raster` do terminal lê.
 *
 * Cada célula do terminal guarda dois pixels verticais — meio bloco em cima
 * (`▀` com a cor de baixo no fundo), então 20 linhas de pixel cabem em 10
 * linhas do terminal.
 *
 * É um emoji, não um bonequinho: a cabeça ocupa o quadro inteiro e toda a
 * expressão mora nas pupilas, que sobem, varrem e arregalam. Em vinte pixels
 * de largura, uma forma grande e simples lê; um corpo inteiro não.
 */

import type { MascoteMood } from '../types'

export const SPRITE_COLUMNS = 20
export const SPRITE_ROWS = 10

const W = 20
const H = 20

/** Pixel sem cor: o `Raster` pinta o fundo padrão do terminal ali. */
const VAZIO = '.'

export const PALETA: Record<string, number> = {
  l: 0xf2f2ee, // brilho do casco
  w: 0xdcdcd7, // casco
  s: 0xa5a5a0, // sombra do casco
  d: 0x4f4f4d, // o visor
  k: 0x1d1d1c, // a lente, onde a pupila mora
  g: 0x72c23a, // pupila acesa
  G: 0x33601d, // pupila apagada
  y: 0xf5c451, // os riscos de quem treme de trabalhar
  c: 0x8fd3f4, // gota de cansaço
}

/**
 * A cabeça: um círculo de 18 pixels, o brilho em cima à esquerda, a sombra
 * embaixo à direita e o visor atravessado no meio. Nada mais — o resto é
 * expressão.
 */
const CABECA = [
  '.......llll.......',
  '....llllllwwww....',
  '...llllllwwwwww...',
  '..llllllwwwwwwww..',
  '.lllllwwwwwwwwwws.',
  '.llllwwwwwwwwwwss.',
  '.lllwwwwwwwwwwwss.',
  'dddddddddddddddddd',
  'dddddddddddddddddd',
  'dddddddddddddddddd',
  'dddddddddddddddddd',
  '.dddddddddddddddd.',
  '.dddddddddddddddd.',
  '.dddddddddddddddd.',
  '..wwwwwwwwwwwwss..',
  '...wwwwwwwwwsss...',
  '....wwwwwwssss....',
  '.......ssss.......',
]
const CABECA_X = 1
const CABECA_Y = 1

/** A lente de 5x5 onde a pupila se move, nas duas metades do visor. */
const LENTE = ['kkkkk', 'kkkkk', 'kkkkk', 'kkkkk', 'kkkkk']
const LENTE_Y = 8
const LENTE_ESQUERDA_X = 2
const LENTE_DIREITA_X = 11

/** As pupilas. A posição dentro da lente é metade da expressão. */
const PUPILA = ['ggg', 'ggg', 'ggg']
const PUPILA_ALTA = ['ggg', 'ggg']
const PUPILA_CHEIA = ['.ggg.', 'ggggg', 'ggggg', 'ggggg', '.ggg.']
const PUPILA_FECHADA = ['ggg']
const PUPILA_MORTA = ['GGG']
const PUPILA_FELIZ = ['..g..', '.g.g.', 'g...g']

/** O que vai dentro da lente neste quadro, e em que canto dela. */
function pupila(
  mood: MascoteMood,
  frame: number,
): { desenho: readonly string[]; x: number; y: number } {
  // Pisca de vez em quando, mas não com os olhos arregalados nem fechados.
  if (frame % 17 === 11 && (mood === 'livre' || mood === 'pensando')) {
    return { desenho: PUPILA_FECHADA, x: 1, y: 2 }
  }

  switch (mood) {
    case 'livre': {
      // Revira os olhos: eles moram no alto da lente e de vez em quando
      // varrem de um lado ao outro, como quem não acredita.
      const varredura = [0, 0, 0, 0, 0, -1, 0, 1][frame % 8]!

      return { desenho: PUPILA_ALTA, x: 1 + varredura, y: 0 }
    }
    case 'pensando': {
      // Procurando a resposta em algum canto do teto.
      const olhar = [-1, -1, 0, 1, 1, 0][frame % 6]!

      return { desenho: PUPILA, x: 1 + olhar, y: 1 }
    }
    case 'trabalhando':
      // Arregalado, e a cabeça tremendo junto.
      return { desenho: PUPILA_CHEIA, x: 0, y: 0 }
    case 'exausto':
      return { desenho: PUPILA_MORTA, x: 1, y: 2 }
    case 'feliz':
      return { desenho: PUPILA_FELIZ, x: 0, y: 1 }
  }
}

function grade(): string[][] {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => VAZIO))
}

/** Carimba `linhas` em (x, y); um ponto no desenho deixa passar o que já estava lá. */
function carimba(alvo: string[][], x: number, y: number, linhas: readonly string[]): void {
  for (let dy = 0; dy < linhas.length; dy++) {
    const linha = linhas[dy]!
    const destino = alvo[y + dy]
    if (destino === undefined) continue
    for (let dx = 0; dx < linha.length; dx++) {
      const tinta = linha[dx]!
      if (tinta === VAZIO || x + dx < 0 || x + dx >= W) continue
      destino[x + dx] = tinta
    }
  }
}

/** Como `carimba`, mas só onde ainda não há tinta: nada cai sobre o Marvin. */
function polvilha(alvo: string[][], x: number, y: number, linhas: readonly string[]): void {
  for (let dy = 0; dy < linhas.length; dy++) {
    const linha = linhas[dy]!
    const destino = alvo[y + dy]
    if (destino === undefined) continue
    for (let dx = 0; dx < linha.length; dx++) {
      const tinta = linha[dx]!
      if (tinta === VAZIO || x + dx < 0 || x + dx >= W) continue
      if (destino[x + dx] === VAZIO) destino[x + dx] = tinta
    }
  }
}

/**
 * Monta a grade de um quadro: a cabeça (que respira, ou treme quando ele
 * trabalha), as duas lentes e a pupila que o humor escolheu.
 */
export function buildGrid(mood: MascoteMood, frame: number): string[][] {
  const alvo = grade()
  const tremendo = mood === 'trabalhando'
  // Trabalhando ele treme de um lado para o outro; parado, só respira.
  const tremor = tremendo ? (frame % 2 === 0 ? -1 : 1) : 0
  const ar = tremendo ? 0 : Math.floor(frame / 2) % 2

  const x = CABECA_X + tremor
  const y = CABECA_Y + ar
  carimba(alvo, x, y, CABECA)

  const dentro = pupila(mood, frame)
  for (const lente of [LENTE_ESQUERDA_X, LENTE_DIREITA_X]) {
    carimba(alvo, x + lente, y + LENTE_Y, LENTE)
    carimba(alvo, x + lente + dentro.x, y + LENTE_Y + dentro.y, dentro.desenho)
  }

  // Os riscos do tremor aparecem do lado para onde a cabeça não foi.
  if (tremendo) {
    polvilha(alvo, 0, 9, ['y', 'y', 'y'])
    polvilha(alvo, W - 1, 9, ['y', 'y', 'y'])
  }
  if (mood === 'exausto') polvilha(alvo, 17, 15 + ar, ['c', 'c'])

  return alvo
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64(bytes: Uint8Array): string {
  let saida = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    saida += B64[a >> 2]
    saida += B64[((a & 0b11) << 4) | ((b ?? 0) >> 4)]
    saida += b === undefined ? '=' : B64[((b & 0b1111) << 2) | ((c ?? 0) >> 6)]
    saida += c === undefined ? '=' : B64[c & 0b111111]
  }
  return saida
}

/** A cor que o `Raster` lê como "o fundo padrão do terminal". */
const PADRAO = 0x01000000
const BLOCO_ALTO = 0x2580 // ▀
const BLOCO_BAIXO = 0x2584 // ▄
const BRANCO = 0x20 // espaço

/**
 * Empacota a grade em `cells`: base64 de triplos u32 little-endian
 * `[codePoint, frente, fundo]`, uma célula por par de linhas.
 */
export function encodeCells(alvo: readonly (readonly string[])[]): string {
  const bytes = new Uint8Array(SPRITE_COLUMNS * SPRITE_ROWS * 3 * 4)
  let i = 0
  const grava = (valor: number): void => {
    bytes[i++] = valor & 0xff
    bytes[i++] = (valor >>> 8) & 0xff
    bytes[i++] = (valor >>> 16) & 0xff
    bytes[i++] = (valor >>> 24) & 0xff
  }

  for (let linha = 0; linha < SPRITE_ROWS; linha++) {
    for (let coluna = 0; coluna < SPRITE_COLUMNS; coluna++) {
      const cima = PALETA[alvo[linha * 2]?.[coluna] ?? VAZIO]
      const baixo = PALETA[alvo[linha * 2 + 1]?.[coluna] ?? VAZIO]
      if (cima === undefined && baixo === undefined) {
        grava(BRANCO), grava(PADRAO), grava(PADRAO)
      } else if (cima === undefined) {
        grava(BLOCO_BAIXO), grava(baixo!), grava(PADRAO)
      } else {
        grava(BLOCO_ALTO), grava(cima), grava(baixo ?? PADRAO)
      }
    }
  }

  return base64(bytes)
}

/** Os `cells` de um quadro, prontos para o elemento `Raster`. */
export function buildCells(mood: MascoteMood, frame: number): string {
  return encodeCells(buildGrid(mood, frame))
}
