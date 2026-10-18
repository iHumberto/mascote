# mascote

Marvin, o andróide paranóide, em pixel art no painel lateral do Claude Code,
no estilo de uma ficha de RPG: ele mostra quanto ainda resta da sua cota e faz
cara de emoji enquanto o Claude trabalha.

![Marvin revira os olhos, pisca, arregala enquanto uma ferramenta roda, fecha os olhos ao entregar a resposta e apaga quando a cota acaba](assets/marvin.gif)

Os cinco humores, no mesmo ritmo do painel: 420 ms por quadro.

```
     (a cara do Marvin,
       20x20 pixels)

        ● LIVRE
   ocioso. que maravilha.


 HP ██████████████████░░░░  82%
    recarrega em 0h07

 MP ████████████████░░░░░░  72%
    recarrega em 3D 09H15m

 ST █████████████░░░░░░░░░  61%
    122k tokens de sobra, por enquanto.

 Esta sessão
 XP 2.0k tokens
    in 1.2k · out 340 · cache 500
 $  US$ 0.42
    1 tarefa, 0 obrigados. que novidade.

 Geral
 XP 1.4M tokens
    in 901k · out 90k · cache 411k
 $  US$ 12.76
    348 tarefas. ninguém agradeceu.
```

| Linha | O que é |
| --- | --- |
| **HP** | a janela de cota de 5 horas (`five_hour`), e quando ela recarrega |
| **MP** | a janela semanal (`seven_day`), com a espera em dias, horas e minutos |
| **ST** | o contexto desta conversa: quanto ainda cabe antes de uma compactação |
| **XP** | os tokens contados, separados em entrada, saída e cache. `in` é só o que não veio do cache — com o cache ligado, quase tudo cai em `cache`, e um `in` de três dígitos ao lado de um `cache` de milhões é o normal |
| **$** | o custo e quantos turnos foram concluídos (ele não comemora) |

A janela de 5 horas nasce na primeira chamada do dia, não quando o Claude Code
abre: enquanto nada foi gasto, a legenda diz `a janela nem começou` em vez de um
prazo — um painel aberto e parado não desconta um tempo que ainda não corre. Da
primeira resposta em diante a recarga é a que o servidor informou.

ST não tem prazo: ao contrário de HP e MP, o contexto não recarrega num
horário marcado, só esvazia a cada resposta e volta a subir numa compactação.
Abaixo de 15% de sobra a legenda vira alerta: `só 20k tokens de sobra. vai
esquecer tudo.` em vez do `122k tokens de sobra, por enquanto.` de sempre.

As barras de HP, MP e ST ocupam 75% da largura do painel — o resto da linha é
a sigla e o percentual. O placar aparece duas vezes: **Esta sessão**, o que a
sessão em curso gastou, e **Geral**, a soma de todas as sessões desta máquina,
guardada entre elas.

O humor vem dos eventos da sessão, e quem o conta são as pupilas:

| Cara | Quando | O que os olhos fazem |
| --- | --- | --- |
| 🙄 | ocioso | ficam no alto da lente e varrem de um lado ao outro |
| 🤔 | do início do turno até a primeira ferramenta | procuram a resposta num canto do teto |
| 🫨 | enquanto uma ferramenta roda | arregalam, e a cabeça treme junto |
| 😵 | menos de 12% da janela de 5 horas | apagam, e desce uma gota |
| 😌 | os segundos seguintes a uma resposta entregue | fecham em dois arcos |

Abaixo da cara, uma linha diz o estado em cor — `LIVRE` em verde, `OCUPADO` em
âmbar, `EXAUSTO` em vermelho — e sob ela a legenda conta o que ele está fazendo.

## O que ele diz

A legenda segue o evento da sessão, e ele nunca se anima:

| Fala | Quando |
| --- | --- |
| `ocioso. que maravilha.` | entre turnos, sem nada para fazer |
| `pensando. não que adiante.` | do início do turno até a primeira ferramenta — e de volta a cada ferramenta que termina |
| `que alegria. que felicidade.` | os seis quadros (≈2,5 s) seguintes a uma resposta entregue, antes de voltar ao tédio |
| `a cota acabou. eu avisei.` | fim de turno com 12% ou menos da janela de 5 horas |

Enquanto uma ferramenta roda, a legenda é o que ele acha dela:

| Fala | Ferramenta |
| --- | --- |
| `lendo código. que tédio.` | `Read` |
| `procurando. como sempre.` | `Glob`, `Grep` |
| `escrevendo. vai dar errado.` | `Edit`, `Write`, `NotebookEdit` |
| `rodando comandos. de novo.` | `Bash`, `BashOutput` |
| `na web. sem esperança.` | `WebFetch`, `WebSearch` |
| `delegando. não vai ajudar.` | `Agent`, `Task` |
| `lendo o manual. que vida.` | `Skill` |
| `fazendo listas. que vida.` | `TodoWrite` |
| `trabalhando. como sempre.` | qualquer outra que ele não conheça pelo nome |

E a última linha de cada placar conta tarefas e ingratidão:

| Fala | Placar | Quando |
| --- | --- | --- |
| `nenhuma tarefa. nem um obrigado.` | Esta sessão | nada concluído ainda |
| `1 tarefa, 0 obrigados. que novidade.` | Esta sessão | da primeira em diante |
| `nada feito ainda. que alívio.` | Geral | nenhuma sessão anterior contada |
| `348 tarefas. ninguém agradeceu.` | Geral | da primeira em diante |

## Instalando

O repositório é o próprio marketplace. Uma vez, em qualquer sessão:

```sh
claude plugin marketplace add iHumberto/mascote
```

e então, no prompt do Claude Code:

```
/plugin install mascote --marketplace mods-do-humberto
```

Instalado no escopo `user`, ele carrega sozinho em toda sessão nova.

Para mexer no mod, aponte o marketplace para o seu clone em vez do repositório:

```sh
git clone https://github.com/iHumberto/mascote.git
claude plugin marketplace add ./mascote
```

Como o marketplace aponta para a própria pasta (`"source": "./"`), o Claude Code
lê o mod dali mesmo: editou um arquivo, `/reload-plugins` recarrega sem
reinstalar.

## Usando

O painel abre sozinho quando o terminal é largo o bastante; em qualquer
largura, `/mascote` abre na hora.

## Como foi feito

- `hooks/sprite.ts` — a cara do Marvin numa grade de 20×20 pixels e o empacotamento para o
  elemento `Raster` do terminal: cada célula guarda dois pixels verticais (`▀`
  com a cor de baixo no fundo), então 20 linhas de pixel cabem em 10 linhas do
  terminal. A cabeça é um círculo com um visor atravessado, e tudo que muda são
  as duas pupilas dentro das lentes — em vinte pixels de largura, uma forma
  grande e simples lê; um bonequinho inteiro não.
- `hooks/register.tsx` — os hooks (`session.measure` para as cotas, `turn.*` e
  `tool.call` para o humor) e o desenho do painel. `pensando` e `trabalhando`
  são duas caras do mesmo estado: para quem lê a linha abaixo do desenho, as
  duas são `OCUPADO`.
- `types/index.d.ts` — o contrato do estado guardado em `$.state`, que sobrevive
  a um hot reload.
- `tools/` — o GIF lá de cima sai do **mesmo** `buildGrid` que o painel chama, e
  não de um desenho à parte: `frames.mjs` despeja os quadros em JSON e `gif.py`
  (Pillow) os monta. Mexeu no sprite, regenera e a imagem acompanha:

  ```sh
  node tools/frames.mjs | python3 tools/gif.py assets/marvin.gif
  ```
- o placar **geral** é o que atravessa sessões: fica no `$.store` do mod (um
  JSON na configuração do Claude Code) sob a chave `totals`, relido no
  `session.start`. Ao fim de cada turno o mod manda para lá só o que esta
  sessão ainda não mandou — a diferença entre o placar dela e o `synced`, que
  guarda o quanto já foi. Então nada é contado duas vezes. O custo que a conta
  ganha depois do último turno é pego no `session.end`.
- na primeira carga do mod numa sessão que já estava em curso, `synced` ainda
  não existe (`$.state.get` devolve versão 0): parte do que a sessão gastou
  pode já estar no geral e parte não está em lugar nenhum, então o geral vira o
  maior dos dois — nunca abaixo da sessão, nunca contando nada duas vezes. De
  um hot reload em diante o `synced` manda.
- a cota (HP/MP) é da conta, não da sessão, e vem sempre do engine, por dois
  caminhos: `session.measure` a empurra depois de cada turno, e um relógio de 5
  minutos relê `$.session.usage()` — senão as barras ficam paradas enquanto a
  sessão espera, e a janela de 5h recarrega sem ninguém digitar nada. A chamada
  sem argumentos não vai à rede: devolve os números que a linha de status já
  mediu, então nenhuma conferida dessas conta para o limite.
- ST vem dos mesmos dois caminhos, mas do campo `context` em vez de
  `rateLimits`: é da sessão, não da conta, e some `tokens`/`percent` até a
  primeira resposta da janela viva — até lá a barra fica em `--` e a legenda
  diz `sem leitura ainda`.

```sh
claude plugin validate .  # o que o motor vê
claude plugin test .      # os testes em tests/
tsc -p .                  # tipos
```

`.claude-plugin/types/` é a declaração da API que o Claude Code escreve ao
carregar um mod em desenvolvimento; a cópia guardada aqui serve ao editor e ao
`tsc`, e vale atualizá-la quando o Claude Code for atualizado.

## Licença

GPLv3 ou posterior — veja [LICENSE](LICENSE). O mod é feito para o Claude Code,
mas não é da Anthropic nem endossado por ela; "Marvin, o andróide paranóide" é
de *O Guia do Mochileiro das Galáxias*, de Douglas Adams, citado aqui como
homenagem.
