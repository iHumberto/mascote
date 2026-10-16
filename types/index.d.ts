/**
 * Contrato de estado do mod `mascote`.
 *
 * Tudo que o painel desenha mora em `$.state`, porque um hot reload apaga as
 * variáveis do módulo mas não o estado da sessão.
 */

/**
 * Humor do bichinho, que decide a carinha desenhada no sprite. `pensando` e
 * `trabalhando` são as duas caras de quem está ocupado: a primeira do início
 * do turno, a segunda enquanto uma ferramenta roda.
 */
export type MascoteMood = 'livre' | 'pensando' | 'trabalhando' | 'exausto' | 'feliz'

/** Uma janela de cota: quanto ainda resta e quando ela recarrega. */
export type MascoteGauge = {
  /** Quanto sobrou da janela, 0 a 100. */
  percentLeft: number
  /** Quando a janela zera, em milissegundos de `$.clock.now()`; null se o servidor não disse. */
  resetsAt: number | null
} | null

/** Um placar: tokens, custo e turnos concluídos. */
export type MascoteTally = {
  input: number
  output: number
  cache: number
  usd: number
  missions: number
}

declare module 'claude-code' {
  interface PluginState {
    mascote: {
      /** Humor atual. */
      mood: MascoteMood
      /** A legenda em português abaixo do status. */
      label: string
      /** Contador da animação, avançado pelo timer. */
      frame: number
      /** Cota de 5 horas (`five_hour`), desenhada como HP. */
      hp: MascoteGauge
      /** Cota semanal (`seven_day`), desenhada como MP. */
      mp: MascoteGauge
      /** O placar de todas as sessões, espelho do `$.store`. */
      totals: MascoteTally
      /** Placar da sessão. */
      tally: MascoteTally
      /** Quanto do placar desta sessão já foi somado ao geral. */
      synced: MascoteTally
    }
  }
}
