/**
 * mascote — um bichinho pixel-art no painel lateral que mostra o quanto da
 * cota ainda resta e muda de cara enquanto o Claude trabalha.
 *
 * HP é a janela de 5 horas, MP a semanal, XP os tokens da sessão.
 */

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { MascoteContexto, MascoteGauge, MascoteMood, MascoteTally } from '../types'
import { SPRITE_COLUMNS, SPRITE_ROWS, buildCells } from './sprite'

const PANE = 'mascote'

/** Onde o placar de todas as sessões fica guardado, entre sessões. */
const CHAVE_GERAL = 'totals'

/** A chave da primeira versão, de quando só as tarefas eram guardadas. */
const CHAVE_ANTIGA = 'missionsTotal'

/** Um placar zerado, usado como ponto de partida. */
const ZERO: MascoteTally = { input: 0, output: 0, cache: 0, usd: 0, missions: 0 }

/** Quanto tempo entre um quadro da animação e o próximo. */
const QUADRO_MS = 420

/**
 * Quanto tempo entre uma conferida na cota e a próxima. `session.measure` só
 * fala depois de um turno, então sem isto as barras ficam paradas enquanto a
 * sessão espera — e a janela de 5h recarrega sem ninguém digitar nada.
 */
const COTA_MS = 5 * 60_000

/** Abaixo disso na janela de 5h o visor dele quase apaga. */
const EXAUSTO_ABAIXO_DE = 12

/** Abaixo disso de contexto livre, a legenda do ST vira alerta. */
const CONTEXTO_BAIXO_ABAIXO_DE = 15

/** As falas, no tom de quem tem um cérebro do tamanho de um planeta. */
const PENSANDO = 'pensando. não que adiante.'
const PARADO = 'ocioso. que maravilha.'
const ALEGRIA = 'que alegria. que felicidade.'
const ESGOTADO = 'a cota acabou. eu avisei.'
const QUALQUER = 'trabalhando. como sempre.'

/** Quando a janela de cota ainda não nasceu: não há recarga a contar. */
const INTACTA = 'a janela nem começou'

const mood = atom({ plugin: 'mascote', key: 'mood' } as const, 'livre' as MascoteMood)
const label = atom({ plugin: 'mascote', key: 'label' } as const, PARADO)
const frame = atom({ plugin: 'mascote', key: 'frame' } as const, 0)
const hp = atom({ plugin: 'mascote', key: 'hp' } as const, null as MascoteGauge)
const mp = atom({ plugin: 'mascote', key: 'mp' } as const, null as MascoteGauge)
const st = atom({ plugin: 'mascote', key: 'st' } as const, null as MascoteContexto)
const career = atom({ plugin: 'mascote', key: 'totals' } as const, ZERO)
const tally = atom({ plugin: 'mascote', key: 'tally' } as const, ZERO)
const synced = atom({ plugin: 'mascote', key: 'synced' } as const, ZERO)
const lido = atom({ plugin: 'mascote', key: 'lido' } as const, false)

/** O que o Marvin anda fazendo, por ferramenta, no humor dele. */
const AFAZERES: Record<string, string> = {
  Read: 'lendo código. que tédio.',
  Glob: 'procurando. como sempre.',
  Grep: 'procurando. como sempre.',
  Edit: 'escrevendo. vai dar errado.',
  Write: 'escrevendo. vai dar errado.',
  NotebookEdit: 'escrevendo. vai dar errado.',
  Bash: 'rodando comandos. de novo.',
  BashOutput: 'rodando comandos. de novo.',
  WebFetch: 'na web. sem esperança.',
  WebSearch: 'na web. sem esperança.',
  Agent: 'delegando. não vai ajudar.',
  Task: 'delegando. não vai ajudar.',
  Skill: 'lendo o manual. que vida.',
  TodoWrite: 'fazendo listas. que vida.',
}


/** "nenhuma tarefa", "1 tarefa", "12 tarefas". */
function contarTarefas(n: number): string {
  if (n === 0) return 'nenhuma tarefa'
  if (n === 1) return '1 tarefa'

  return `${formatarNumero(n)} tarefas`
}

/** O placar da sessão: o que foi feito, e o que ninguém disse por isso. */
function contarSessao(n: number): string {
  if (n === 0) return 'nenhuma tarefa. nem um obrigado.'

  return `${contarTarefas(n)}, 0 obrigados. que novidade.`
}

/** O placar de sempre, dito sem nenhum entusiasmo. */
function contarCarreira(n: number): string {
  if (n === 0) return 'nada feito ainda. que alívio.'

  return `${contarTarefas(n)}. ninguém agradeceu.`
}

/** Um número que veio do store: só serve se for finito e não-negativo. */
function saneado(valor: unknown): number {
  const n = Number(valor)

  return Number.isFinite(n) && n > 0 ? n : 0
}

/** O placar geral guardado no store. */
async function lerGeral($: EngineInterface): Promise<MascoteTally> {
  const guardado = (await $.store.get(CHAVE_GERAL)) as Partial<MascoteTally> | undefined
  if (guardado === undefined) return ZERO

  return {
    input: saneado(guardado.input),
    output: saneado(guardado.output),
    cache: saneado(guardado.cache),
    usd: saneado(guardado.usd),
    missions: saneado(guardado.missions),
  }
}

/** Dois placares somados, campo por campo. */
function somar(a: MascoteTally, b: MascoteTally): MascoteTally {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cache: a.cache + b.cache,
    usd: a.usd + b.usd,
    missions: a.missions + b.missions,
  }
}

/** O maior de dois placares, campo por campo. */
function oMaior(a: MascoteTally, b: MascoteTally): MascoteTally {
  return {
    input: Math.max(a.input, b.input),
    output: Math.max(a.output, b.output),
    cache: Math.max(a.cache, b.cache),
    usd: Math.max(saneado(a.usd), saneado(b.usd)),
    missions: Math.max(a.missions, b.missions),
  }
}

/** O que `a` tem de mais que `b`, nunca negativo. */
function diferenca(a: MascoteTally, b: MascoteTally): MascoteTally {
  return {
    input: Math.max(0, a.input - b.input),
    output: Math.max(0, a.output - b.output),
    cache: Math.max(0, a.cache - b.cache),
    usd: Math.max(0, saneado(a.usd) - saneado(b.usd)),
    missions: Math.max(0, a.missions - b.missions),
  }
}

/** Se há algo a somar. */
function temAlgo(placar: MascoteTally): boolean {
  return (
    placar.input > 0 ||
    placar.output > 0 ||
    placar.cache > 0 ||
    placar.usd > 0 ||
    placar.missions > 0
  )
}

function formatarNumero(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

/** "0h07" para hoje à tarde, "3d9h" para semana que vem. */
function formatarEspera(resetsAt: number | null, agora: number): string | null {
  if (resetsAt === null) return null
  const faltam = resetsAt - agora
  if (faltam <= 0) return 'a qualquer momento'
  const minutos = Math.floor(faltam / 60_000)
  const horas = Math.floor(minutos / 60)
  const dias = Math.floor(horas / 24)
  if (dias > 0) return `${dias}d${horas % 24}h`
  return `${horas}h${String(minutos % 60).padStart(2, '0')}`
}

/** A espera longa da janela semanal: "3D 09H15m", ou "09H15m" no último dia. */
function formatarEsperaLonga(resetsAt: number | null, agora: number): string | null {
  if (resetsAt === null) return null
  const faltam = resetsAt - agora
  if (faltam <= 0) return 'a qualquer momento'
  const minutos = Math.floor(faltam / 60_000)
  const horas = Math.floor(minutos / 60)
  const dias = Math.floor(horas / 24)
  const relogio = `${String(horas % 24).padStart(2, '0')}H${String(minutos % 60).padStart(2, '0')}m`
  return dias > 0 ? `${dias}D ${relogio}` : relogio
}

/**
 * Lê uma das janelas de cota.
 *
 * `medida` é se esta sessão já ouviu uma resposta de verdade. A janela de 5h
 * nasce na primeira chamada, não quando o Claude Code abre — e o `resetsAt`
 * que o engine tem antes disso é de uma janela que ainda não existe, um prazo
 * que correria enquanto ninguém digitou nada. Então a recarga só vale quando a
 * janela está em curso: alguma cota gasta, ou uma leitura desta sessão.
 */
function lerJanela(
  limites: readonly { kind: string; percentUsed: number; resetsAt?: string }[],
  tipo: string,
  medida: boolean,
): MascoteGauge {
  const janela = limites.find(uma => uma.kind === tipo)
  if (janela === undefined) return null
  const quando = janela.resetsAt === undefined ? NaN : Date.parse(janela.resetsAt)
  return {
    percentLeft: Math.max(0, Math.min(100, Math.round(100 - janela.percentUsed))),
    resetsAt: Number.isNaN(quando) ? null : quando,
    emCurso: janela.percentUsed > 0 || medida,
  }
}

/** A janela de contexto que `$.session.usage()` e `session.measure` dão, virando ST. */
function lerContexto(contexto: { tokens?: number; window: number; percent?: number }): MascoteContexto {
  if (contexto.tokens === undefined || contexto.percent === undefined) return null

  return {
    percentLeft: Math.max(0, Math.min(100, Math.round(100 - contexto.percent))),
    tokens: contexto.tokens,
    window: contexto.window,
  }
}

/** O que ele diz da própria memória, conforme o que ainda cabe nela. */
function contarContexto(ctx: MascoteContexto): string {
  if (ctx === null) return 'sem leitura ainda'
  const livres = formatarNumero(Math.max(0, Math.round((ctx.percentLeft / 100) * ctx.window)))
  if (ctx.percentLeft <= CONTEXTO_BAIXO_ABAIXO_DE) return `só ${livres} tokens de sobra. vai esquecer tudo.`

  return `${livres} tokens de sobra, por enquanto.`
}

/**
 * Leva para o placar geral o que esta sessão ainda não mandou: o `$.store` é
 * relido na hora, porque outra sessão pode ter escrito a dela no meio.
 *
 * `synced` é o quanto desta sessão já foi somado — então o que falta é a
 * diferença, e uma sessão que já corria quando o mod carregou entra inteira na
 * primeira vez.
 */
async function sincronizar($: EngineInterface): Promise<void> {
  const sessao = await read($, tally)
  const falta = diferenca(sessao, await read($, synced))
  if (!temAlgo(falta)) return

  const somado = somar(await lerGeral($), falta)
  await $.store.set(CHAVE_GERAL, somado)
  await update($, career, () => somado)
  await update($, synced, () => sessao)
}

/**
 * Lê a cota e o custo que o engine já tem e leva para as barras.
 *
 * `$.session.usage()` sem argumentos devolve os números da linha de status, já
 * medidos: não vai à rede, não gasta cota, e por isso pode ser chamado de
 * tempos em tempos sem medo.
 */
async function medirCota($: EngineInterface): Promise<void> {
  const uso = await $.session.usage()
  const medida = await read($, lido)
  await update($, hp, () => lerJanela(uso.rateLimits, 'five_hour', medida))
  await update($, mp, () => lerJanela(uso.rateLimits, 'seven_day', medida))
  await update($, st, () => lerContexto(uso.context))
  if (uso.cost !== undefined) {
    await update($, tally, placar => ({ ...placar, usd: uso.cost?.usd ?? placar.usd }))
  }
}

export const register: Register = on => {
  // Uma vez aberto o painel, o timer fica desenhando; fechado, ele descansa.
  let desenhando = false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'mascote',
      description: 'Abre o painel do mascote (cota, tokens e humor)',
    })

    const aberto = await $.ui.open({ id: PANE, title: 'Mascote' })
    desenhando = aberto.isPlaced

    // Semeia as barras com o que a sessão já sabe: `session.measure` só fala
    // quando algo muda, e numa sessão retomada isso pode demorar.
    // O placar geral é de todas as sessões: mora no `$.store`, que sobrevive
    // ao fim da sessão e a um hot reload.
    const guardado = await lerGeral($)
    await update($, career, () => guardado)

    // A primeira vez que o mod carrega: `synced` nunca foi escrito (versão 0).
    // Numa sessão que já estava em curso, parte do que ela gastou pode já ter
    // ido para o geral e parte não está em lugar nenhum — então o geral vira o
    // maior dos dois, que não fica abaixo da sessão nem conta nada duas vezes.
    // De um hot reload em diante `synced` existe e manda.
    const marca = await $.state.get({ plugin: 'mascote', key: 'synced' } as const)
    if (marca.version === 0) {
      const sessao = await read($, tally)
      if (temAlgo(sessao)) {
        const adotado = oMaior(guardado, sessao)
        await $.store.set(CHAVE_GERAL, adotado)
        await update($, career, () => adotado)
      }
      await update($, synced, () => sessao)
    }

    // A chave da primeira versão não serve mais.
    if ((await $.store.get(CHAVE_ANTIGA)) !== undefined) {
      await $.store.delete(CHAVE_ANTIGA)
    }

    await medirCota($)
    $.clock.every(COTA_MS, () => {
      void medirCota($)
    })

    let pulsos = 0
    $.clock.every(QUADRO_MS, () => {
      // De vez em quando confere se o painel coube na tela: num terminal
      // estreito ele fica esperando, e só volta a desenhar quando alarga.
      if (pulsos++ % 12 === 0) {
        void (async () => {
          const abertos = await $.ui.panes()
          desenhando = abertos.some(painel => painel.id === PANE && painel.isPlaced)
        })()
      }
      if (!desenhando) return
      void update($, frame, n => (n + 1) % 1024)
    })

    return next(e)
  })

  on('command.run', { command: 'mascote' }, async $ => {
    const aberto = await $.ui.open({ id: PANE, title: 'Mascote' })
    desenhando = aberto.isPlaced

    return {
      text: aberto.isPlaced
        ? 'Painel do mascote aberto.'
        : `O mascote está esperando espaço na tela: ${aberto.reason}`,
    }
  })

  // Só observa: se este hook falhar, o painel fecha do mesmo jeito.
  on('ui.close', { id: PANE }, ($, e, next) => {
    desenhando = false

    return next(e)
  }).catch(($, e, next) => next(e))

  // As cotas: a janela de 5h vira HP, a semanal vira MP.
  on('session.measure', async ($, e, next) => {
    // Só chega aqui depois de uma resposta: daqui em diante a janela existe.
    await update($, lido, () => true)
    await update($, hp, () => lerJanela(e.rateLimits, 'five_hour', true))
    await update($, mp, () => lerJanela(e.rateLimits, 'seven_day', true))
    await update($, st, () => lerContexto(e.context))
    if (e.cost !== undefined) {
      const usd = e.cost.usd
      await update($, tally, placar => ({ ...placar, usd }))
    }

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    await update($, mood, () => 'pensando')
    await update($, label, () => PENSANDO)

    return next(e)
  })

  // Observador: o que ele falhe em anotar nunca segura a ferramenta.
  on('tool.call', async ($, e, next) => {
    const afazer = AFAZERES[String(e.tool)] ?? QUALQUER
    await update($, mood, atual => (atual === 'pensando' ? 'trabalhando' : atual))
    await update($, label, () => afazer)
    const feito = await next(e)
    await update($, mood, atual => (atual === 'trabalhando' ? 'pensando' : atual))
    await update($, label, atual => (atual === afazer ? PENSANDO : atual))

    return feito
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)

    const uso = e.usage
    const vitoria = e.reason === 'answer'
    await update($, tally, placar => ({
      input: placar.input + (uso?.input_tokens ?? 0),
      output: placar.output + (uso?.output_tokens ?? 0),
      cache:
        placar.cache +
        (uso?.cache_read_input_tokens ?? 0) +
        (uso?.cache_creation_input_tokens ?? 0),
      usd: placar.usd,
      missions: placar.missions + (vitoria ? 1 : 0),
    }))
    await sincronizar($)

    const restante = (await read($, hp))?.percentLeft ?? 100
    const humor: MascoteMood =
      restante <= EXAUSTO_ABAIXO_DE ? 'exausto' : vitoria ? 'feliz' : 'livre'
    await update($, mood, () => humor)
    await update($, label, () =>
      humor === 'exausto' ? ESGOTADO : vitoria ? ALEGRIA : PARADO,
    )

    // A "alegria" dura alguns quadros e então ele volta ao tédio de sempre.
    if (humor === 'feliz') {
      $.clock.after(QUADRO_MS * 6, () => {
        void (async () => {
          await update($, mood, atual => (atual === 'feliz' ? 'livre' : atual))
          await update($, label, atual => (atual === ALEGRIA ? PARADO : atual))
        })()
      })
    }

    return next(e)
  })

  // O custo medido depois do último turno ainda não foi para o geral: esta é a
  // última chance. Observador: se falhar, a sessão fecha do mesmo jeito.
  on('session.end', async ($, e, next) => {
    await sincronizar($)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    // O sprite é um `Raster`, que só o terminal desenha.
    const Raster = e.surface === 'terminal' ? $.ui.resolve(e).Raster : null

    const [humor, legenda, quadro, vida, magia, folego, placar, carreira, agora] = await Promise.all([
      read($, mood),
      read($, label),
      read($, frame),
      read($, hp),
      read($, mp),
      read($, st),
      read($, tally),
      read($, career),
      $.clock.now(),
    ])

    // 75% da largura do painel; `HP ` e ` 100%` ocupam as 8 colunas restantes.
    const largura = e.props.bodyColumns
    const barra = Math.max(4, Math.min(largura - 8, Math.round(largura * 0.75)))
    // Pensando e trabalhando são a mesma coisa para quem olha de fora: as
    // duas caras dele estão ocupadas.
    const ocupado = humor === 'pensando' || humor === 'trabalhando'
    const cor = ocupado ? '#f5c451' : humor === 'exausto' ? '#e8705f' : '#7ddc8f'
    const estado = ocupado ? 'OCUPADO' : humor === 'exausto' ? 'EXAUSTO' : 'LIVRE'

    /** Uma barra de cota com a legenda da recarga embaixo. */
    const medidor = (
      sigla: string,
      janela: MascoteGauge,
      cheia: string,
      vazia: string,
      formatar: (resetsAt: number | null, agora: number) => string | null = formatarEspera,
    ) => {
      const sobra = janela?.percentLeft ?? null
      const cheio = sobra === null ? 0 : Math.round((sobra / 100) * barra)
      const espera =
        janela !== null && !janela.emCurso ? INTACTA : formatar(janela?.resetsAt ?? null, agora)

      return (
        <Box flexDirection="column">
          <Box>
            <Text bold color={cheia}>{sigla} </Text>
            <Text color={cheia}>{'█'.repeat(cheio)}</Text>
            <Text color={vazia}>{'█'.repeat(barra - cheio)}</Text>
            <Text>{sobra === null ? '   --' : ` ${String(sobra).padStart(3)}%`}</Text>
          </Box>
          <Text dimColor>
            {'   '}
            {espera === null
              ? 'sem janela de cota'
              : espera === INTACTA
                ? INTACTA
                : `recarrega em ${espera}`}
          </Text>
        </Box>
      )
    }

    /** A barra do contexto, com o que ainda cabe na memória embaixo — sem prazo de recarga. */
    const medidorContexto = (ctx: MascoteContexto) => {
      const sobra = ctx?.percentLeft ?? null
      const cheio = sobra === null ? 0 : Math.round((sobra / 100) * barra)

      return (
        <Box flexDirection="column">
          <Box>
            <Text bold color="#d9a521">ST </Text>
            <Text color="#d9a521">{'█'.repeat(cheio)}</Text>
            <Text color="#473a12">{'█'.repeat(barra - cheio)}</Text>
            <Text>{sobra === null ? '   --' : ` ${String(sobra).padStart(3)}%`}</Text>
          </Box>
          <Text dimColor>
            {'   '}
            {contarContexto(ctx)}
          </Text>
        </Box>
      )
    }

    /** O placar de tokens e custo de uma coluna do tempo, sob o seu título. */
    const bloco = (titulo: string, dados: MascoteTally, frase: string) => (
      <Box flexDirection="column">
        <Text bold dimColor>{titulo}</Text>
        <Box>
          <Text bold color="#b9a0ff">XP </Text>
          <Text color="#b9a0ff">
            {formatarNumero(dados.input + dados.output + dados.cache)} tokens
          </Text>
        </Box>
        <Text dimColor>
          {'   '}in {formatarNumero(dados.input)} · out {formatarNumero(dados.output)} · cache{' '}
          {formatarNumero(dados.cache)}
        </Text>
        <Box>
          <Text bold color="#7ddc8f">$  </Text>
          <Text color="#7ddc8f">US$ {dados.usd.toFixed(2)}</Text>
        </Box>
        <Text dimColor>
          {'   '}
          {frase}
        </Text>
      </Box>
    )

    return (
      <Box flexDirection="column">
        <Box justifyContent="center">
          {Raster === null ? (
            <Text color="#d97757">{ocupado ? '(o_o)' : '(-_-)'}</Text>
          ) : (
            <Raster
              key="bichinho"
              columns={SPRITE_COLUMNS}
              rows={SPRITE_ROWS}
              cells={buildCells(humor, quadro)}
            />
          )}
        </Box>
        <Box justifyContent="center">
          <Text color={cor}>{ocupado ? '◐' : '●'} </Text>
          <Text bold color={cor}>{estado}</Text>
        </Box>
        <Box justifyContent="center">
          <Text dimColor wrap="truncate-end">{legenda}</Text>
        </Box>
        <Box height={2} />
        {medidor('HP', vida, '#ef5f5f', '#4a1f1f')}
        <Box height={1} />
        {medidor('MP', magia, '#4da6ff', '#1b3550', formatarEsperaLonga)}
        <Box height={1} />
        {medidorContexto(folego)}
        <Box height={1} />
        {bloco('Esta sessão', placar, contarSessao(placar.missions))}
        <Box height={1} />
        {bloco('Geral', carreira, contarCarreira(carreira.missions))}
      </Box>
    )
  })
}
