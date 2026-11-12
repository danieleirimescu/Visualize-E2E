# Visualize r04: due run

Aggiunta automatica (task pianificato, 12/11). Release pubblicata il 12/11 alle 13:13 (ora di Roma, 12:13 UTC), con un solo bug acceso:
- **B17**: tornando dai biglietti alla mappa la selezione dei posti si perde (rimasto dalla r02, corretti B14, B10, B23 rispetto alla r03).

Release di correzione: resta solo B17. Mette alla prova il segnale "il difetto non si riproduce più" sui test protetti.

- SUT: https://visualizecinema.netlify.app
- Profilo: `domain/visualize.json`
- Memoria: non svuotata. Le 17 schede della r03 erano già giudicate; il test di B17 è quello giudicato `sut_bug` nelle schede della r03 (10/11).

## Numeri

| | Run 1 | Run 2 |
|---|---|---|
| Trace | `daa7b35c` | `70f93580` |
| Quando | 12/11, fine alle 13:33 (ora di Roma) | 12/11, fine alle 13:43 (ora di Roma) |
| Durata | 16 min (940 s) | 10 min (573 s) |
| Costo LLM | 0,13 $ | 0,08 $ |
| Test | 75: 74 passati, 1 fallito, 0 saltati | 76: 75 passati, 1 fallito, 0 saltati |
| Verdetti | 1 `sut_bug` | 1 `sut_bug` |
| Bug rilevati (script) | **1/1** | **1/1** |
| Bug attribuiti (script) | **1/1**, con la regola citata | **1/1**, con la regola citata |
| `sut_bug` su regola a valle o adiacente | 0 | 0 |
| Falsi positivi | 0 | 0 |

Secondi per agente:
- run 1: Actor 521 s, Translator 148 s, Test Engine 88 s, Observer 98 s, Reflector 27 s;
- run 2: Actor 214 s, Translator 121 s, Test Engine 72 s, Observer 76 s, Reflector 29 s.

## Fallimenti per causa

| Causa | Test rossi | Verdetto | Prova |
|---|---|---|---|
| B17 (selezione persa) | 1 per run | `sut_bug`, regola del ritorno alla mappa | tornando da /biglietti a /posti il contatore dice 0 invece di 3 |

Il test rosso è lo stesso nelle due run: "Torna ai posti mantiene la selezione e il ritorno ai biglietti mantiene tipologie e sconto". Il dato lo marca con `human`: true, cioè il verdetto passa per una persona. Nessun rosso dipende da un errore della pipeline.

## Cosa è cambiato rispetto alla r03

- **Un solo difetto acceso, rilevato due volte.** Nelle due run il test di B17 fallisce con la stessa prova e la stessa regola, senza altri rossi.
- **Tre difetti corretti, nessun rosso sui loro test.** B14, B10 e B23 non producono più fallimenti: i test che li coprivano passano.
- **Costo e tempi più bassi.** La run 1 costa 0,13 $ e dura 16 min; la run 2 costa 0,08 $ e dura 10 min. Con un solo difetto acceso la suite è più piccola da eseguire e il triage ha meno schede.
- **Un test in più.** La suite cresce da 72-73 test (r03) a 75-76 (r04): il Translator ha aggiunto test, nessuno dei quali è rosso.

## Lacune e punti da osservare

1. **La protezione di B17 regge, ma non prova la correzione.** Il test confermato come difetto è riprodotto identico e fallisce ancora: questo conferma che B17 è davvero presente. Non dice nulla su un sito corretto: per quello serve la release che rimuove il difetto.
2. **Schede da giudicare.** Ogni run chiede una conferma per il suo `sut_bug`: due schede in tutto, sullo stesso test. Il report mostra la conferma già data il 10/11 come riferimento.
3. **Il segnale di 'difetto non riprodotto' non è ancora misurato.** Su r04 nessun test protetto torna verde, quindi il controllo di revoca della protezione non entra in gioco.
4. **Due run sole, stesso ingresso.** Il risultato si ripete come su r03; la varianza delle due run è dentro il rumore osservato finora.
