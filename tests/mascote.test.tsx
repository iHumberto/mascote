import { expect, mock, test } from 'claude-code/testing'

import { SPRITE_COLUMNS, SPRITE_ROWS, buildGrid, encodeCells } from '../hooks/sprite'

const PANE = {
  component: 'Pane' as const,
  requestId: 'mascote',
  props: {
    title: 'Mascote',
    isFocused: false,
    bodyColumns: 30,
    placement: 'dock' as const,
    scroll: { offset: 0, bodyRows: 24 },
    view: {},
  },
}

test('o sprite cabe no Raster e muda com o humor', async () => {
  const quadro = buildGrid('livre', 0)
  expect(quadro.length).toBe(SPRITE_ROWS * 2)
  expect(quadro[0]!.length).toBe(SPRITE_COLUMNS)

  const cells = encodeCells(quadro)
  // Um triplo u32 por célula: 12 bytes viram 16 caracteres de base64.
  expect(cells.length).toBe((SPRITE_COLUMNS * SPRITE_ROWS * 12 * 4) / 3)
  expect(cells).not.toContain('=')

  // Cada humor tem a sua cara: nenhuma se repete.
  const caras = (['livre', 'pensando', 'trabalhando', 'exausto', 'feliz'] as const).map(humor =>
    encodeCells(buildGrid(humor, 0)),
  )
  expect(new Set(caras).size).toBe(caras.length)

  // Enquanto trabalha a cabeça treme a cada quadro.
  expect(encodeCells(buildGrid('trabalhando', 1))).not.toBe(
    encodeCells(buildGrid('trabalhando', 0)),
  )
})

test('as cotas viram HP e MP no painel', async ($, on) => {
  // Nada fica abaixo dos plugins num teste: o fundo de cada evento é daqui.
  const relogio = mock.clock(on, { now: Date.parse('2026-10-15T12:00:00Z') })
  on('session.measure', ($, e) => ({ changed: e.changed }))

  const daqui = new Date(relogio.now() + 7 * 60_000).toISOString()
  const semanaQueVem = new Date(relogio.now() + ((3 * 24 + 9) * 60 + 15) * 60_000).toISOString()
  await $.session.measure({
    context: { tokens: 0, window: 200_000 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 18, resetsAt: daqui },
      { kind: 'seven_day', percentUsed: 28, resetsAt: semanaQueVem },
    ],
    changed: ['rateLimits'],
  })

  const ui = await $.ui.mount({ plugin: 'mascote', surface: 'terminal', ...PANE })
  expect(await ui.find({ type: 'Text', text: /82%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /72%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /recarrega em 0h0[67]/ })).toBeDefined()
  // A espera da janela semanal vem em dias, horas e minutos.
  expect(await ui.find({ type: 'Text', text: /recarrega em 3D 09H1[45]m/ })).toBeDefined()
  // 75% das 30 colunas do painel, menos as 8 da sigla e do percentual: 22.
  expect(await ui.find({ type: 'Text', text: '█'.repeat(18) })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '█'.repeat(4) })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /LIVRE/ })).toBeDefined()
  await ui.unmount()
})

test('o bichinho fica ocupado no turno e conta a missão no fim', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-15T12:00:00Z') })
  mock.store(on)
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  await $.turn.start({ text: 'oi', turnId: 't1' })

  const trabalhando = await $.ui.mount({ plugin: 'mascote', surface: 'terminal', ...PANE })
  expect(await trabalhando.find({ type: 'Text', text: /OCUPADO/ })).toBeDefined()
  expect(await trabalhando.find({ type: 'Text', text: /pensando/ })).toBeDefined()
  await trabalhando.unmount()

  await $.turn.complete({
    answer: 'pronto',
    durationMs: 1200,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
    usage: {
      model: 'claude-opus-5',
      input_tokens: 1200,
      output_tokens: 340,
      cache_read_input_tokens: 500,
      cache_creation_input_tokens: 0,
    },
  })

  const descansando = await $.ui.mount({ plugin: 'mascote', surface: 'terminal', ...PANE })
  expect(await descansando.find({ type: 'Text', text: /que alegria. que felicidade./ })).toBeDefined()
  expect(await descansando.find({ type: 'Text', text: /1 tarefa. ninguém agradeceu./ })).toBeDefined()
  expect(await descansando.find({ type: 'Text', text: /2.0k tokens/ })).toBeDefined()
  expect(await descansando.find({ type: 'Text', text: /in 1.2k · out 340 · cache 500/ })).toBeDefined()
  await descansando.unmount()
})

test('o placar geral soma as sessões anteriores e volta pro store', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-15T12:00:00Z') })
  let gravado: Record<string, unknown> = {}
  let gravacoes = 0
  on('store.set', { key: 'totals' }, ($, e, next) => {
    gravado = e.value as Record<string, unknown>
    gravacoes += 1

    return next(e)
  })
  // O que as sessões anteriores deixaram guardado.
  mock.store(on, {
    totals: { input: 900_000, output: 90_000, cache: 410_000, usd: 12.34, missions: 347 },
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  // As chamadas em `$` que o `session.start` do mod faz, respondidas daqui.
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.panes', () => ({ value: [] }))
  on('session.usage', () => ({
    value: {
      startedAt: Date.parse('2026-10-15T11:00:00Z'),
      context: { tokens: 0, window: 200_000 },
      rateLimits: [],
    },
  }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  await $.session.start({
    cwd: '/tmp/mascote',
    surface: 'terminal',
    isInteractive: true,
  })

  // Sem nenhum turno, o geral já é o guardado e a sessão está zerada.
  const antes = await $.ui.mount({ plugin: 'mascote', surface: 'terminal', ...PANE })
  expect(await antes.find({ type: 'Text', text: /1.4M tokens/ })).toBeDefined()
  expect(await antes.find({ type: 'Text', text: /347 tarefas. ninguém agradeceu./ })).toBeDefined()
  expect(await antes.find({ type: 'Text', text: /nenhuma tarefa. nem um obrigado./ })).toBeDefined()
  expect(await antes.find({ type: 'Text', text: 'Esta sessão' })).toBeDefined()
  expect(await antes.find({ type: 'Text', text: 'Geral' })).toBeDefined()
  await antes.unmount()

  await $.session.measure({
    context: { tokens: 0, window: 200_000 },
    rateLimits: [],
    cost: { usd: 0.05 },
    changed: ['cost'],
  })
  await $.turn.start({ text: 'oi', turnId: 't1' })
  await $.turn.complete({
    answer: 'pronto',
    durationMs: 10,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
    usage: {
      model: 'claude-opus-5',
      input_tokens: 1200,
      output_tokens: 340,
      cache_read_input_tokens: 500,
      cache_creation_input_tokens: 0,
    },
  })

  // O turno conta nos dois placares: 1 tarefa aqui, 348 no geral.
  const depois = await $.ui.mount({ plugin: 'mascote', surface: 'terminal', ...PANE })
  expect(
    await depois.find({ type: 'Text', text: /1 tarefa, 0 obrigados. que novidade./ }),
  ).toBeDefined()
  expect(await depois.find({ type: 'Text', text: /348 tarefas. ninguém agradeceu./ })).toBeDefined()
  expect(await depois.find({ type: 'Text', text: /in 1.2k · out 340 · cache 500/ })).toBeDefined()
  expect(await depois.find({ type: 'Text', text: /in 901k · out 90k · cache 411k/ })).toBeDefined()
  await depois.unmount()

  // Um segundo turno soma só o que ele trouxe: o que já foi para o geral não
  // volta a ser contado.
  await $.turn.start({ text: 'de novo', turnId: 't2' })
  await $.turn.complete({
    answer: 'pronto',
    durationMs: 10,
    isAborted: false,
    turnId: 't2',
    reason: 'answer',
    usage: {
      model: 'claude-opus-5',
      input_tokens: 1200,
      output_tokens: 340,
      cache_read_input_tokens: 500,
      cache_creation_input_tokens: 0,
    },
  })
  expect(gravado.missions).toBe(349)
  expect(gravado.input).toBe(902_400)
  expect(Number(gravado.usd).toFixed(2)).toBe('12.39')

  // E o geral volta pro store, para a próxima sessão achar.
  expect(gravado.missions).toBe(349)
  expect(gravado.input).toBe(902_400)
  expect(gravado.cache).toBe(411_000)
  // O custo da sessão entra no geral uma vez só.
  expect(Number(gravado.usd).toFixed(2)).toBe('12.39')

  // Um hot reload refaz o `session.start`, e ele não mexe no que já foi
  // sincronizado: nada é contado de novo.
  const antesDoReload = gravacoes
  await $.session.start({
    cwd: '/tmp/mascote',
    surface: 'terminal',
    isInteractive: true,
  })
  expect(gravacoes).toBe(antesDoReload)
  expect(gravado.missions).toBe(349)

  // O que a conta cresceu depois do último turno entra no fim da sessão.
  await $.session.measure({
    context: { tokens: 0, window: 200_000 },
    rateLimits: [],
    cost: { usd: 0.09 },
    changed: ['cost'],
  })
  await $.session.end({
    reason: 'prompt_input_exit',
    sessionId: 's1',
    resume: { id: 's1' },
  })
  expect(Number(gravado.usd).toFixed(2)).toBe('12.43')
})

test('a cota se atualiza sozinha a cada cinco minutos', async ($, on) => {
  const relogio = mock.clock(on, { now: Date.parse('2026-10-15T12:00:00Z') })
  mock.store(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.panes', () => ({ value: [] }))
  on('session.measure', ($, e) => ({ changed: e.changed }))

  // O que a linha de status tem agora; muda sem que ninguém digite nada.
  let usado = 10
  on('session.usage', () => ({
    value: {
      startedAt: relogio.now(),
      context: { tokens: 0, window: 200_000 },
      rateLimits: [
        {
          kind: 'five_hour',
          percentUsed: usado,
          resetsAt: new Date(relogio.now() + 60 * 60_000).toISOString(),
        },
      ],
    },
  }))

  await $.session.start({
    cwd: '/tmp/mascote',
    surface: 'terminal',
    isInteractive: true,
  })

  const antes = await $.ui.mount({ plugin: 'mascote', surface: 'terminal', ...PANE })
  expect(await antes.find({ type: 'Text', text: /90%/ })).toBeDefined()
  await antes.unmount()

  // Cinco minutos depois, sem nenhum turno, o painel já sabe da janela nova.
  usado = 35
  await relogio.advance(5 * 60_000)

  const depois = await $.ui.mount({ plugin: 'mascote', surface: 'terminal', ...PANE })
  expect(await depois.find({ type: 'Text', text: /65%/ })).toBeDefined()
  await depois.unmount()
})
