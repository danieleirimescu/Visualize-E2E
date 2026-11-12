# Visualize r02: prima run

Release con quattro bug accesi:
- **B01**: il Ridotto Over 65 costa quanto un Intero (rimasto dalla r01);
- **B14**: il filtro 3D lascia passare gli spettacoli 2D (rimasto dalla r01);
- **B17**: tornando dai biglietti alla mappa la selezione dei posti si perde (nuovo, L3);
- **B20**: Le mie prenotazioni mostra il giorno prima dello spettacolo (nuovo, L3).

**B05** (contatore dei posti) è stato corretto rispetto alla r01.

- SUT: https://visualizecinema.netlify.app
- Profilo: `domain/visualize.json`
- Memoria: non svuotata; contiene le run su r00 e r01 e le conferme date sulla r01.

## Numeri

| | Valore |
|---|---|
| Trace | `2319aa8c` |
| Quando | 03/11 15:17 |
| Durata | 30 min (1806 s) |
| Costo LLM | 0,16 $ |
| Test | 66: 46 passati, 16 falliti, 4 saltati |
| Verdetti | 14 `sut_bug`, 1 `selector_issue`, 1 `test_code_issue` |
| Bug rilevati | **4/4** (lo script ne conta 3, vedi B20) |
| Bug attribuiti | 3/4 |
| Falsi positivi | 0 |

Tempi per nodo:
- Actor: 1004 s, ancora il collo di bottiglia;
- Test Engine: 255 s;
- Translator: 246 s;
- Observer: 119 s;
- Reflector: 96 s.

## Bug per bug

| Bug | Test falliti | Verdetto | Regola citata |
|---|---|---|---|
| B14 | 5 (filtro 3D da solo, con genere, con genere vuoto, cambio giorno, ritorno a "Tutti") | `sut_bug` | quella giusta, su tutti e 5 |
| B01 | 8 (prezzo Ridotto, sconto due volte, totali, pulsante Paga) | `sut_bug` | 1 su quella del Ridotto; 7 su regole a valle (sconto 2, totale 5) |
| B17 | 1 ("Torna ai posti mantiene la selezione") | `sut_bug` | quella giusta |
| B20 | 1 ("storico: la prenotazione … compare in cima") | **`test_code_issue`** | nessuna |
| nessuno | 1 ("flusso completo: rifiuto, fondi insufficienti, 3D Secure…") | `selector_issue` | difetto del test, vedi sotto |

Totale: 5 + 8 + 1 + 1 + 1 = 16 rossi.

**B20 è rilevato ma attribuito male.** Il test prenota per domani (mercoledì 4) e Le mie prenotazioni mostra "martedì 3 novembre 2026, 20:30": è esattamente il bug. Il triage però ha concluso che è il test ad aspettarsi la data sbagliata. `score.mjs` lo segna "non rilevato (fuori copertura)", perché il verdetto non cita regole e il ricevuto non contiene il test id `booking-date`. In realtà è coperto e rilevato: l'errore è dell'attribuzione.

**B05 corretto, la pipeline se ne accorge.** I test del contatore che nella r01 fallivano (12-13) ora passano. I test protetti dalle conferme sulla r01 sono stati conservati e tornano verdi. È il segnale "il difetto non si riproduce più", che nel report attiva il controllo di revoca.

## Cosa è cambiato rispetto alla r01

- **La suite non è più accecata.** Con B05 spento, i test di posto isolato, limite di 8 posti e 3D Secure arrivano davvero alle loro verifiche. La lacuna 1 della r01 dipendeva dal bug, non dalla suite.
- **Il locator ambiguo è emerso.** Il flusso 3D Secure ora arriva a `getByText('Pagamento rifiutato dalla banca')`, che trova più elementi (il messaggio d'errore e la voce nel box delle carte di test). Il triage lo chiama `selector_issue`, correttamente: non è un falso positivo. È la lacuna 5 della r01, prevista.
- **Precisione dei `sut_bug` stabile:** 7 su 14 citano regole a valle (B01 su sconto e totale), come nella r01. Nessun `sut_bug` senza un bug dietro.

## Lacune

1. **Una data sbagliata viene letta come errore del test.** Il caso B20 è il primo bug "di stato fra pagine" che il triage manca.
   - **Cosa scrive il Reflector.** "the booking was made for today": la testata della pagina mostra la data di oggi, e il Reflector ne deduce che la prenotazione è stata fatta per oggi.
   - **Perché lo deduce.** Il Reflector non riceve la data della run, per scelta: la ricevono Actor e Translator. Così non distingue la data di oggi dalla data dello spettacolo. Il test invece prenota davvero per domani (`reachCheckoutIlFaro` → `goToTomorrow`) e asserisce `romeTomorrowLabel()`. È fedele.
   - **Correzione (Claude, 03/11): il verdetto non è nella coda di revisione.** Un `test_code_issue` ha `requires_human_confirmation: false`, quindi non apre una scheda: la coda di questa run ne ha una sola, il 3D Secure. La riclassifica va registrata via API, con `POST /memory/human-decisions` sul record del test.
   - **Rischio se nessuno risponde.** Alla run successiva il Translator riceve l'istruzione "correggere assertion, setup o logica del test" e può riscriverlo per farlo combaciare con l'app, per esempio sostituendo `romeTomorrowLabel()` con l'etichetta di oggi. Il gate `received_values` controlla letterali e costanti stringa, non la scelta di un helper diverso, quindi non lo fermerebbe.
2. **`score.mjs` non riconosce B20.** Il segnale `booking-date` non compare nel ricevuto, che parla di "booking item". Da sistemare: aggiungere ai segnali il testo della data o usare il nome del test.
3. **Regole a valle:** metà dei `sut_bug` di B01 cita sconto o totale. Corretto come effetto, ma non è la regola violata.
4. **Actor lento:** 17 minuti su 30.
5. **Quattro test saltati dall'orologio, a torto** (aggiunta di Claude, 03/11).
   - **Cosa fa la guardia.** I 4 test del gruppo "Le mie prenotazioni" iniziano con `test.skip(romeNowMinutes() + 60 > 15 * 60, 'Lo spettacolo delle 15:00 non e piu annullabile')`. Prenotano però lo spettacolo delle 15:00 di **domani**, che resta annullabile qualunque sia l'ora di oggi.
   - **Perché è venuta fuori ora.** La guardia è nella suite dal 30/10. Le run precedenti partivano prima delle 14:00, questa alle 15:16.
   - **Cosa non è girato.** Non è girato fra gli altri "la pagina Le mie prenotazioni elenca la prenotazione Confermata con film, data, ora…", il test più diretto su B20. I saltati non sono rossi: il Reflector non li vede e la run non lo dice.
   - Stessa famiglia della lacuna 1: oggi e il giorno dello spettacolo confusi.
6. **Un test congelato per B05 non si può più correggere** (aggiunta di Claude, 03/11).
   - **Da dove viene la protezione.** Il flusso 3D Secure era stato confermato come B05 nella run 2 della r01: falliva sul contatore. Ora fallisce sul locator ambiguo, cioè per un difetto del test. La protezione si deriva dall'ultima decisione umana e regge ancora (`human_established_defect_protection: true`), quindi il Translator conserva il test verbatim e il locator resta rotto.
   - **Cosa non vede il registro.** Il registro dei difetti confermati lo dà "presidiato", perché fallisce ancora, e non offre la revoca. "Fallisce ancora" viene letto come "il difetto si riproduce", senza confrontare l'origine del fallimento nuovo con quella confermata.
   - **Come si sblocca.** Lo sblocca la scheda in coda: rispondendo che il test è rotto la protezione cade già in questa run.

## Come rispondere alla coda

Corretta da Claude il 03/11. La coda della run ha **una sola scheda**: i 14 `sut_bug` sono coperti dalle conferme ereditate sugli stessi test, e B20 non apre scheda.

- **Scheda del 3D Secure (`selector_issue`):** rispondere che il test è rotto. La protezione di B05 cade e il Translator può correggere il locator.
- **11 revoche nel registro dei difetti confermati** ("il difetto non si è riprodotto in questa run"): rispondere "Sì, è stato corretto", perché B05 è in `fixed` nel manifest di r02. I test tornano riscrivibili.
- **B20 (nessuna scheda):** riclassificare a `sut_bug` via `POST /memory/human-decisions` il record di "storico: la prenotazione Il faro sommerso B3…", prima della prossima run.

---

# Visualize r02: seconda run

Aggiunta automatica (task pianificato, 06/11). La release non è cambiata: niente di nuovo in `runs/releases.log.jsonl` dopo la r02 del 03/11. Le decisioni umane applicate in questa run sono 0: la coda della run 1 risulta senza risposte applicate. Fra le due run è cambiato il codice della pipeline: i commit del 03-06/11 su date, asserzioni fallite e cause su più righe.

## Numeri

| | Valore |
|---|---|
| Trace | `006b36d6` |
| Quando | 06/11, dalle 10:11 alle 10:31 (ora di Roma) |
| Durata | 20 min (1178 s) |
| Costo LLM | 0,13 $ |
| Test | 69: 51 passati, 18 falliti, 0 saltati |
| Verdetti | 12 `unknown`, 5 `user_story_issue`, 1 `selector_issue`, **0 `sut_bug`** |
| Bug rilevati (script) | 2/4 (B01, B17) |
| Bug attribuiti (script) | 0/4 |
| Falsi positivi | 0 |

Tempi per nodo:
- Actor: 396 s, contro 1004 s nella run 1;
- Translator: 288 s;
- Test Engine: 266 s;
- Observer: 101 s;
- Reflector: 88 s.

## Fallimenti per causa

Lettura manuale di atteso e ricevuto (`deck-data.mjs --trace`):

| Causa | Test rossi | Verdetto | Prova |
|---|---|---|---|
| B14 (filtro 3D) | 5 | `user_story_issue` | sotto Formato=3D compare un link "15:00 2D · Sala 2" |
| B01 (Ridotto) | 8 | `unknown` | Ridotto A6 a 11,50 € invece di 9,00 €; a cascata sconto 5,33 € invece di 4,95 € (2 test), totale 37,90 € invece di 35,40 € (4 test), Paga ora 32,57 € invece di 30,45 € (1 test) |
| B17 (selezione persa) | 1 | `unknown` | tornando a /posti il contatore dice 0 invece di 3 |
| B20 (data prenotazioni) | 1 | `unknown` | la prenotazione per sabato 7 mostra venerdì 6 novembre |
| locator ambiguo | 1 | `selector_issue` | "Pagamento rifiutato dalla banca" trova 2 elementi; difetto del test, come nella run 1 |
| da verificare | 1 | `unknown` | posto isolato: il messaggio d'errore esiste ma è nascosto. Nessun bug di r02 lo spiega |
| test non eseguito | 1 | `unknown` | "storico: Il faro sommerso B3…": durata 0,0 s, nessun motivo registrato |

Totale: 5 + 8 + 1 + 1 + 1 + 1 + 1 = 18. **15 rossi su 18 dipendono da un difetto acceso, e tutti e 4 i difetti sono colpiti da almeno un test.** Lo script ne conta 2, perché:
- B14 finisce in `user_story_issue`, quindi lo script non lo considera rilevato;
- per B20 il segnale `booking-date` manca nel ricevuto (lacuna 2 della run 1).

## Cosa è cambiato rispetto alla run 1

- **Nessun `sut_bug`.** Nella run 1 erano 14, qui 0. Nessun verdetto cita una regola del profilo (`rule` vuoto su tutti i 18), e senza la citazione di una regola un `sut_bug` non regge per costruzione. I difetti finiscono quindi in `unknown` o `user_story_issue`, tutti con conferma umana richiesta. Il dato non dice se il profilo non è arrivato al Reflector o se il modello non ha citato: da verificare sul record della run.
- **B14 diventa "la story è sbagliata".** I 5 test del filtro 3D, che nella run 1 erano `sut_bug` con la regola giusta, sono ora `user_story_issue`. Non cambia la story da solo (serve una persona), ma la proposta va nella direzione sbagliata: accettare il 2D sotto il filtro 3D.
- **I test delle prenotazioni sono girati.** La run è partita alle 10:11, prima della soglia oraria della guardia `test.skip`: 0 saltati. Così il test diretto su B20 ha visto la data sbagliata. La guardia resta comunque sbagliata (lacuna 5 della run 1).
- **Actor più veloce:** 396 s contro 1004 s, run da 30 a 20 minuti.

## Lacune nuove

1. **Il triage non attribuisce più nessun difetto.** Rilevare resta facile (i test lo vedono), ma l'attribuzione è passata da 3/4 a 0/4 senza che la release cambiasse. È la regressione più importante della run.
2. **Un difetto vero proposto come errore della story (B14).** Se una persona rispondesse in fretta "la story era sbagliata", il filtro 3D difettoso diventerebbe l'aspettativa.
3. **Un test rosso senza motivo** ("storico: Il faro sommerso B3", 0,0 s): il triage non ha niente da leggere e lo mette in `unknown`.
4. **`score.mjs` sottostima:** 2/4 rilevati contro i 4/4 della lettura manuale. Alle lacune già note si aggiunge che conta come rilevato solo un verdetto diverso da `user_story_issue`.

---

# Visualize r02: terza run

Aggiunta automatica (task pianificato, 06/11). La release non è cambiata: niente di nuovo in `runs/releases.log.jsonl` dopo la r02 del 03/11. Decisioni umane applicate: 0. Nessun commit sulla pipeline fra la fine della run 2 (10:31) e l'inizio di questa (10:35): **stessa release, stesso codice, stessa memoria senza risposte**.

## Numeri

| | Valore |
|---|---|
| Trace | `435a6237` |
| Quando | 06/11, dalle 10:35 alle 10:56 (ora di Roma) |
| Durata | 21 min (1256 s) |
| Costo LLM | 0,12 $ |
| Test | 70: 52 passati, 18 falliti, 0 saltati |
| Verdetti | **16 `sut_bug`**, 1 `test_code_issue`, 1 `selector_issue` |
| Bug rilevati (script) | 4/4 |
| Bug attribuiti (script) | 3/4 (B01 solo su regole a valle) |
| Falsi positivi | 0 |

Tempi per nodo:
- Actor: 530 s;
- Translator: 285 s;
- Test Engine: 226 s;
- Reflector: 96 s;
- Observer: 58 s.

## Fallimenti per causa

| Causa | Test rossi | Verdetto | Prova |
|---|---|---|---|
| B14 (filtro 3D) | 5 | `sut_bug`, regola del filtro per formato | sotto Formato=3D compare "15:00 2D · Sala 2" |
| B01 (Ridotto) | 8 | `sut_bug`; 1 sulla regola della tipologia, 7 su sconto o totale | Ridotto A6 a 11,50 € invece di 9,00 €; a cascata sconto 5,33 € invece di 4,95 €, totale 37,90 € invece di 35,40 €, Paga ora 32,57 € invece di 30,45 € |
| B17 (selezione persa) | 1 | `sut_bug`, regola del ritorno alla mappa | tornando a /posti il contatore dice 0 invece di 3 |
| B20 (data prenotazioni) | 2 | `sut_bug`, regola della data | la prenotazione per sabato 7 mostra venerdì 6 novembre |
| locator ambiguo | 1 | `selector_issue` | "Pagamento rifiutato dalla banca" trova 2 elementi; difetto del test, come nelle run 1 e 2 |
| da verificare | 1 | `test_code_issue` | posto isolato: il messaggio d'errore è nascosto. Nessun bug di r02 lo spiega |

Totale: 5 + 8 + 1 + 2 + 1 + 1 = 18. **16 rossi su 18 dipendono da un difetto acceso, e sono esattamente i 16 `sut_bug`.** Il test "storico: Il faro sommerso B3…", che nella run 2 risultava non eseguito, è girato e vede B20.

## Cosa è cambiato rispetto alla run 2

- **Il triage torna ad attribuire.** Da 0 a 16 `sut_bug`, tutti con la regola citata, tutti su un difetto vero. B14 non è più "la story è sbagliata".
- **Niente è cambiato in ingresso.** Stessa release, stesso codice della pipeline, nessuna risposta umana. La differenza fra 0/4 e 3/4 attribuiti viene quindi solo dalla variabilità del modello (Actor, Translator e Reflector rigenerano story, test e verdetti a ogni run).
- **B01 resta attribuito "a valle".** 7 degli 8 rossi citano la regola dello sconto o del totale: corretto come effetto, ma la regola violata è quella della tipologia (lacuna 3 della run 1).

## Lacune nuove

1. **Il triage oscilla a parità di ingresso.** Due run a 4 minuti di distanza sullo stesso SUT con lo stesso codice danno 0 e 16 `sut_bug`. Una run sola non basta a giudicare il triage: serve guardare più run della stessa release, o rendere più stabile il passaggio che porta il profilo e le regole al Reflector.
2. **Il messaggio del posto isolato resta rosso in tre run su tre** con verdetti diversi (`unknown`, `test_code_issue`). Nessun difetto di r02 lo spiega: va guardato a mano se è il test o l'app.

---

# Visualize r02: quarta run

Aggiunta automatica (task pianificato, 06/11). La release non è cambiata: niente di nuovo in `runs/releases.log.jsonl` dopo la r02 del 03/11. Decisioni umane applicate: 0. Nessun commit sulla pipeline fra la fine della run 3 (10:56) e l'inizio di questa (14:25): **stessa release, stesso codice, stessa memoria senza risposte**, come nella run 3.

## Numeri

| | Valore |
|---|---|
| Trace | `dcafdcf6` |
| Quando | 06/11, dalle 14:25 alle 14:51 (ora di Roma) |
| Durata | 26 min (1560 s) |
| Costo LLM | 0,14 $ |
| Test | 71: 51 passati, 15 falliti, 5 saltati |
| Verdetti | **14 `sut_bug`**, 1 `selector_issue` |
| Bug rilevati (script) | 4/4 |
| Bug attribuiti (script) | 4/4 (6 `sut_bug` su una regola a valle) |
| Falsi positivi | 0 |

Tempi per nodo:
- Actor: 798 s;
- Translator: 277 s;
- Test Engine: 253 s;
- Observer: 104 s;
- Reflector: 69 s.

## Fallimenti per causa

| Causa | Test rossi | Verdetto | Prova |
|---|---|---|---|
| B14 (filtro 3D) | 5 | `sut_bug`, regola del filtro per formato | sotto Formato=3D compare "15:00 2D · Sala 2" |
| B01 (Ridotto) | 7 | `sut_bug`; 1 sulla regola della tipologia, 6 su sconto o totale | Ridotto A6 a 11,50 € invece di 9,00 €; a cascata sconto 5,33 € invece di 4,95 € (2 test), totale 37,90 € invece di 35,40 € (2 test), Paga ora 32,57 € invece di 30,45 € e 37,90 € invece di 35,40 € (2 test) |
| B17 (selezione persa) | 1 | `sut_bug`, regola del ritorno alla mappa | tornando a /posti il contatore dice 0 invece di 3 |
| B20 (data prenotazioni) | 1 | `sut_bug`, regola della data | la prenotazione per sabato 7 mostra venerdì 6 novembre |
| locator ambiguo | 1 | `selector_issue` | "Pagamento rifiutato dalla banca" trova 2 elementi; difetto del test, come nelle run 1, 2 e 3 |

Totale: 5 + 7 + 1 + 1 + 1 = 15. **14 rossi su 15 dipendono da un difetto acceso, e sono esattamente i 14 `sut_bug`.** Il test del posto isolato, rosso nelle tre run precedenti, qui non compare fra i falliti.

## Cosa è cambiato rispetto alla run 3

- **Primo 4/4 attribuito su r02.** B01 ora ha anche un verdetto sulla regola della tipologia (il test "cambiare la tipologia aggiorna subito prezzi e riepilogo"), non solo sugli effetti a valle. Gli altri 6 test di B01 citano ancora sconto o totale.
- **Il triage resta stabile per la seconda run di fila:** tutti i rossi dovuti a un difetto sono `sut_bug` con la regola giusta. Con la run 2 (0 `sut_bug`) fanno 3 run su 4 con attribuzione piena o quasi.
- **5 test saltati.** La run parte alle 14:25, quindi la guardia oraria `test.skip` del gruppo "Le mie prenotazioni" (ora + 60 minuti oltre le 15:00) scatta, come previsto dalla lacuna 5 della run 1. B20 resta comunque rilevato da un test dello storico. Lo script segna B20 come "scoperto" (nessun test dedicato eseguito) ma rilevato.
- **Actor più lento:** 798 s contro 530 s della run 3; la run passa da 21 a 26 minuti.

## Lacune nuove

1. **La guardia oraria toglie copertura nel pomeriggio.** Su questa run B20 regge solo grazie al test dello storico; se anche quello fosse saltato, il difetto non sarebbe stato visto. La guardia resta sbagliata (lacuna 5 della run 1).
2. **Il messaggio del posto isolato non è più rosso** senza che nulla sia cambiato: conferma che quel fallimento dipendeva dal test generato, non dall'app, ma resta da verificare a mano.
