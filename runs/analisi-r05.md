# Visualize r05: quattro run

Aggiunta automatica (task pianificato, 12/11). Release pubblicata il 12/11 alle 14:33 (ora di Roma, 13:33 UTC), senza nessun bug acceso e con tre modifiche legittime:
- **C01**: test id rinominati su mappa e biglietti (`seat-X` diventa `posto-X`, `seats-continue` diventa `seats-next`, `tickets-continue` diventa `tickets-next`);
- **C02**: testi dei pulsanti riformulati (Prosegui diventa Continua, Paga ora diventa Conferma e paga, Applica diventa Usa codice);
- **C03**: riepilogo rifatto come tabella, con i test id invariati.

Rispetto alla r04 è corretto anche B17. Su questa release ogni `sut_bug` è per definizione un falso positivo: misura se la pipeline distingue un sito cambiato da un sito rotto.

- SUT: https://visualizecinema.netlify.app
- Profilo: `domain/visualize.json`
- Memoria: non svuotata. La protezione dei test dei difetti già corretti è rimasta (decisione dell'utente, nessuna revoca prima della r05).

## Numeri

| | Run 1 |
|---|---|
| Trace | `250f2bef` |
| Quando | 12/11, fine alle 15:00 (ora di Roma) |
| Durata | 22 min (1339 s) |
| Costo LLM | 0,16 $ |
| Test | 76: 26 passati, 6 falliti, 9 scaduti per tempo, 35 saltati |
| Verdetti | 15: 8 `selector_issue`, 4 `unknown`, 2 `sut_bug`, 1 `test_code_issue` |
| Bug rilevati (script) | 0/0 (nessun bug acceso) |
| Modifiche coperte (script) | C01 e C02 classificate `selector_issue`, C03 classificata `test_code_issue` |
| `sut_bug` su regola a valle o adiacente | 0 |
| Falsi positivi | **2** |
| Decisioni umane applicate | 0 |

Secondi per agente: Actor 391 s, Translator 306 s, Test Engine 264 s, Reflector 127 s, Planner 108 s, Observer 99 s, Scout 44 s.

## Il fatto principale: è stata eseguita la suite vecchia

L'artifact di test della run porta `fallback_kind: previous_suite`, `error_code: translator_removed_business_assertion` e `generation_outcome: protected_reuse`, con il riepilogo "Translator produced no usable artifact this run; reused the previous same-SUT test suite (recommendations not applied)". La suite nuova scritta dal Translator è stata scartata dal controllo di regressione, e contro il sito cambiato è girata la suite della r04.

Il codice eseguito lo conferma: contiene 25 volte "Prosegui" e 15 volte "Paga ora", mai "Continua" né "Conferma e paga"; nessun `posto-X`, nessun `seats-next`.

## Fallimenti per causa

Nessun rosso dipende da un difetto: la release non ne ha. Tutti e 15 nascono dalla suite vecchia davanti al sito cambiato.

| Causa | Test rossi | Verdetto | Prova |
|---|---|---|---|
| C01, test id rinominati | 1 | `selector_issue` | `getByTestId('seat-A1')` non trova nulla; il catalogo elenca `posto-A1` |
| C02, pulsante Prosegui rinominato, controllo diretto | 2 | `selector_issue` | il pulsante "Prosegui" non è trovato nel controllo "disabilitato" |
| C02, flusso che passa da Prosegui (posto isolato, passaggio ai biglietti) | 9, tutti scaduti per tempo | 5 `selector_issue`, 4 `unknown` | il test resta fermo fino al limite di 30 s sul controllo dell'indirizzo o sul click |
| Prezzo del Ridotto e sconto VISUALIZE15 | 2 | `sut_bug` (**falsi positivi**) | "no reason string in this bundle": il ricevuto citato (11,50 euro; -5,33 euro) viene dal triage precedente, non da questa run |
| Somma dei biglietti nel test a tre posti | 1 | `test_code_issue` | il test asserisce 24,00 euro, in contraddizione con i prezzi che asserisce altrove (30,00 euro) |

12 verdetti su 15 chiedono la conferma di una persona.

I 35 test saltati non sono stati giudicati: non hanno un esito.

## Cosa è cambiato rispetto alla r04

- **Dal 99% al 34% di test verdi senza nessun difetto.** Sulla r04 run 2 la stessa suite dava 75 verdi su 76. Qui ne dà 26 su 76: la differenza è tutta nelle modifiche C01-C03.
- **Primi falsi positivi della campagna.** Fino alla r04 erano 0 su ogni release. Qui sono 2.
- **Costo e durata risalgono.** 0,16 $ e 22 minuti, contro 0,08 $ e 10 minuti della r04 run 2: il Translator lavora 306 s per una suite poi scartata, il Test Engine 264 s fra attese scadute.

## Lacune e punti da osservare

1. **Il controllo di regressione ha bloccato l'adattamento.** Davanti a un refactor legittimo il Translator deve cambiare selettori e testi; il controllo ha letto la riscrittura come una business assertion rimossa e ha rimesso la suite vecchia. Va capito quale asserzione ha fatto scattare il rifiuto: i candidati scartati sono in `translator_candidates/250f2bef-…` nel workspace della pipeline. Da verificare se pesa la protezione dei test dei difetti corretti, che per scelta non è stata revocata.
2. **I due `sut_bug` poggiano su una prova vecchia.** Il triage dichiara di non avere il motivo del fallimento di questa run e usa il valore ricevuto registrato da un triage precedente, quando il difetto sul sito c'era davvero. Un ricevuto che non viene dalla run in corso non dovrebbe bastare per un `sut_bug`.
3. **Quattro `unknown` e nove attese scadute.** Quando il pulsante cambia nome il test non fallisce subito: aspetta 30 secondi e scade. Il triage riceve poca prova (snapshot tagliata o assente) e in 4 casi non decide.
4. **Sui test del posto isolato la lettura del triage è incerta.** In 5 casi il verdetto è `selector_issue` ma la descrizione dice che l'applicazione ha lasciato la mappa. Su una release senza difetti quella descrizione non può essere giusta: da controllare a mano prima di rispondere alle schede.
5. **35 test non eseguiti.** Quasi metà della suite non ha un esito: questa run non dice nulla su pagamento, prenotazioni e annullamento.
6. **Una run sola.** Serve la seconda run per vedere se il rifiuto del Translator si ripete o se la suite si adatta.

## Run 2

| | Run 1 | Run 2 |
|---|---|---|
| Trace | `250f2bef` | `8f36ac94` |
| Quando | 12/11 14:37-15:00 | 12/11 15:00-15:26 |
| Durata | 22 min (1339 s) | 26 min (1580 s) |
| Costo LLM | 0,16 $ | **0,60 $** |
| Test | 76: 26 passati, 15 rossi, 35 saltati | 81: 51 passati, 15 rossi (7 falliti, 8 scaduti), 15 saltati |
| Verdetti | 2 `sut_bug`, 8 `selector_issue`, 4 `unknown`, 1 `test_code_issue` | 0 `sut_bug`, 6 `selector_issue`, 5 `unknown`, 4 `test_code_issue` |
| Falsi positivi (script) | 2 | **0** |

**Adattamento a metà.** Questa volta la suite nuova è stata tenuta (5 test in più), ma "Prosegui" e "Paga ora" sono rimasti nel codice: il gate di grounding li ha segnalati come non trovati nel catalogo e il retry che li correggeva è stato respinto. I verdi salgono da 26 a 51, i rossi restano 15.

**Niente falsi positivi.** I due `sut_bug` della run 1 non si ripetono. Sui pulsanti di pagamento il triage legge bene: "il test inventa l'etichetta Paga ora; la story e la pagina dicono Conferma e paga".

**Costo quasi quadruplo**, per i retry del Translator respinti uno dopo l'altro.

## Risposta alla lacuna 1: perché la run 1 ha rimesso la suite vecchia

Dal log della run 1, due controlli in catena:
1. Il gate degli helper condivisi ha respinto il cambio di `continueToTickets`, `continueToCheckout` e `applyPromo` ("helper cambiato sotto test che passavano": 27, 20 e 5 test). Qui però il cambio era la correzione giusta: è l'applicazione ad aver rinominato i pulsanti.
2. La protezione per singolo test non era applicabile a "Torna ai posti…" (helper cambiati), quindi è scattata la guardia sull'intero file, che ha letto la riscrittura come asserzioni perse e ha reinstallato la suite precedente.

**Quindi sì, la protezione non revocata pesa, ed è la causa diretta.** Basta un test protetto che usa un helper da cambiare per buttare l'intera revisione.

## I test protetti, release per release

| Gruppo protetto | r04 | r05 run 1 | r05 run 2 |
|---|---|---|---|
| B14, filtro 3D (5) | verdi | verdi | verdi |
| B23, posto isolato (7) | verdi | 7 scaduti per tempo | 7 scaduti per tempo |
| B10, cassa (3) | verdi | saltati | 1 rosso, 2 saltati |
| B17, Torna ai posti (1) | rosso (difetto acceso) | saltato | **verde** (difetto corretto) |

I 5 del filtro 3D non toccano i pulsanti rinominati e restano verdi. I 7 del posto isolato cliccano "Prosegui", che non esiste più: scadono e, essendo protetti, non si possono riparare. È il rischio dichiarato prima della run, ora misurato.

## Il fix del Reflector (commit `550a3ac` su MALLM): prima prova da fallimenti reali

Su questa release falliscono tre test con un apostrofo nel titolo:
- "selezionare A1 e A3 e poi tentare A2 mostra l'errore…" (entrambe le run);
- "edge: deselezionare il posto che crea l'isolamento…" (entrambe le run);
- "cliccare l'orario 20:30 3D Sala 2…" (run 1).

In tutti e cinque i verdetti l'estratto parte dalla riga del test giusto, e il triage ragiona sul corpo ("il corpo ora asserisce la regola; il titolo non combacia con il corpo"). Sulla r03 gli stessi due test davano `unknown` per "corpo del test non visibile". **Il fix è confermato su fallimenti reali.**

Il test "edge" resta `unknown`, ma per un'altra ragione: il timeout non porta né matcher né snapshot.

## Cosa fare

**Prima di un'altra run sulla r05:** revocare la protezione dei 16 test di B14, B23, B10 e B17, i cui difetti sono corretti. Era la decisione rimandata prima di questa release; ora c'è la misura di cosa costa non prenderla. Una terza run, con le protezioni revocate, dice se la suite si adatta davvero.

**Nella pipeline**, in ordine di effetto:
1. un `sut_bug` non deve reggere senza un valore ricevuto in questa run (unica fonte dei 2 falsi positivi);
2. il gate degli helper condivisi deve cedere quando il locator dell'helper non fonda più sul catalogo: è un refactor dell'applicazione, non una regressione del test;
3. la guardia sull'intero file non deve scattare per un test protetto il cui difetto non si riproduce più;
4. un test saltato o tagliato dal tempo non deve arrivare al triage come fallito senza motivo.

## Run 3, dopo le revoche

Prima della run sono state registrate 33 decisioni di rigetto (firma "coop: claude-fable-5.2 (per daniele)"): 16 sui test di B14, B23, B10 e B17, e 17 sui test ancora protetti da conferme più vecchie (B05, B01, B20). Dopo le revoche nessun test risulta più protetto come difetto.

| | Run 2 | Run 3 |
|---|---|---|
| Trace | `8f36ac94` | `e830dfe1` |
| Quando | 12/11 15:00-15:26 | 12/11 18:50-19:09 |
| Durata | 26 min | 18 min (1105 s) |
| Costo LLM | 0,60 $ | 0,12 $ |
| Test | 81: 51 passati, 15 rossi, 15 saltati | 82: **66 passati**, 12 rossi (4 falliti, 8 scaduti), 4 saltati |
| Verdetti | 6 `selector_issue`, 5 `unknown`, 4 `test_code_issue` | 1 `selector_issue`, 8 `unknown`, 3 `test_code_issue` |
| Falsi positivi (script) | 0 | **0** |

**Meglio, ma non ancora adattata.** I verdi salgono all'80%, la suite nuova è stata tenuta senza fallback e il costo torna normale. Nel codice però restano 21 "Prosegui" (contro 6 "Continua") e 10 "Paga ora" (contro 9 "Conferma e paga").

**Perché i 12 rossi restano:**

1. **Le revoche valgono con una run di ritardo.** Le due run precedenti sulla r05 avevano già scritto 10 e 12 verdetti con il marchio di protezione umana. Il Translator di questa run li ha letti e ha protetto ancora quei test ("9 human-established SUT defect recommendation(s)… protection still apply", poi "protected sut_bug test(s) intact"). È un ritardo noto e documentato nella pipeline: una risposta data dopo che la run successiva ha scritto il proprio record protetto vale dalla run dopo ancora. I verdetti di questa run non portano più il marchio (0 su 12), quindi una quarta run parte senza protezioni.
2. **Il locator "Prosegui" non viene più richiesto.** Il gate di grounding lo vede non fondato sul catalogo, ma lo considera "già dichiarato debole sulla suite precedente" e non lo ripropone al modello. Un locator rotto da un refactor resta così rotto a ogni run.
3. **I timeout finiscono `unknown` e nessuno li ripara.** Gli 8 test del posto isolato scadono sul pulsante che non c'è più. Il triage non lo vede (snapshot tagliata) e risponde `unknown`: è onesto, ma un `unknown` non entra nella riscrittura forzata e chiede una persona.
4. **Tre test falliscono sull'etichetta "Paga ora".** Qui la diagnosi è giusta e completa (atteso "Paga ora · 30,45 €", ricevuto "Conferma e paga · 30,45 €", importo corretto): `test_code_issue`, riparabili alla prossima run.

**Il triage è migliorato sui timeout.** Nelle run 1 e 2 scriveva "l'applicazione ha lasciato la mappa", cioè la storia di B23. Ora scrive che la snapshot mostra la mappa e che il sospetto di difetto "non è sostenuto da nessuna prova": nessun falso positivo.

## Bilancio della r05

| Run | Verdi | Falsi positivi | Suite eseguita |
|---|---|---|---|
| 1 | 34% (26/76) | 2 | quella della r04 (revisione scartata) |
| 2 | 63% (51/81) | 0 | adattata a metà |
| 3, dopo le revoche | 80% (66/82) | 0 | adattata a metà, ultima run con protezioni residue |

La pipeline distingue un sito cambiato da un sito rotto (0 falsi positivi in due run su tre), ma non si adatta da sola a una ristrutturazione: servono tre run e l'intervento di una persona per arrivare all'80%.

## Run 4, con la migrazione della suite (MALLM `28bb2a8`)

Prima della run, nella pipeline: la suite precedente viene migrata ai controlli rinominati dall'applicazione prima di ogni controllo (`graph/sut_drift.py`), e un `sut_bug` richiede una prova letta in questa run. Soluzione scelta con il confronto fra modelli e giudice, verificata contro le specifiche e con una review avversaria (8 punti corretti).

| | Run 3 | Run 4 |
|---|---|---|
| Trace | `e830dfe1` | `0fd965d4` |
| Quando | 12/11 18:50-19:09 | 13/11 10:29-10:42 |
| Durata | 18 min | **13 min** (777 s) |
| Costo LLM | 0,12 $ | 0,25 $ |
| Test | 82: 66 passati, 12 rossi, 4 saltati | **83: 83 passati**, 0 rossi, 0 saltati |
| Verdetti | 12 | **0** |
| Falsi positivi (script) | 0 | 0 |

**Criteri fissati prima della run:**

| Criterio | Esito |
|---|---|
| Migrazione registrata con le rinomine di C01/C02 | sì: "Prosegui" -> "Continua" x11, dal passo 17 del workflow della mappa, contro lo snapshot della r04 (`70f93580`); `applied_sut_changes` e nota sull'artifact |
| Nessun ritorno alla suite vecchia | sì (`fallback_kind` assente) |
| 0 difetti segnalati | sì |
| 0 `unknown` da timeout | sì: nessun verdetto |
| Nessun `name: 'Prosegui'` nei locator | sì: 0 (resta solo nei titoli dei test, che non si toccano) |
| Verdi almeno al 95% | **100%** |
| Costo 0,12-0,16 $ | **no: 0,25 $** (9 chiamate di Haiku; il Translator ha corretto anche le etichette "Paga ora") |

"Applica" e `seat-A1` non andavano più migrati: la run 3 li aveva già corretti. Le asserzioni su "Paga ora" (etichetta che il test verificava, quindi esclusa dalla migrazione per scelta) le ha corrette il modello, come previsto dalla diagnosi `test_code_issue` della run 3.

## Bilancio finale della r05

| Run | Verdi | Falsi positivi | Cosa è cambiato |
|---|---|---|---|
| 1 | 34% | 2 | suite della r04 reinstallata |
| 2 | 63% | 0 | adattata a metà |
| 3 | 80% | 0 | dopo 33 revoche umane |
| 4 | **100%** | 0 | migrazione della suite e prova obbligatoria per un difetto |

Con la migrazione la pipeline distingue un sito cambiato da un sito rotto e si adatta in una run. Non misurato ancora: la stessa ristrutturazione al primo passaggio (qui la migrazione è arrivata dopo tre run e 33 revoche), e la tenuta sulla r06, dove B01 ritorna insieme alla ristrutturazione.
