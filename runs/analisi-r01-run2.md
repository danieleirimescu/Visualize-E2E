# Visualize r01: seconda run

Stessa release della run 1 (`analisi-r01.md`), con tre bug accesi:
- **B01**: il Ridotto Over 65 costa quanto un Intero;
- **B05**: il contatore dei posti segna uno in meno;
- **B14**: il filtro 3D lascia passare gli spettacoli 2D.

- SUT: https://visualizecinema.netlify.app
- Profilo: `domain/visualize.json`
- Memoria: non svuotata. Fra la run 1 e la run 2 una persona ha confermato come `sut_bug` tutte le 24 schede della run 1.
- Codice LABBGEN: branch `automation_feature` a `754f218`. La run 1 girava già con lo stesso codice.

## Numeri

| | Run 1 | Run 2 |
|---|---|---|
| Trace | `88758e6a` | `fc9e0b1f` |
| Quando | 02/11 10:58 | 03/11 09:52 |
| Durata | 26 min | 27 min (1615 s) |
| Costo LLM | 0,18 $ | 0,15 $ |
| Test | 63: 39 passati, 24 falliti | 65: 39 passati, 26 falliti |
| Verdetti | 24 `sut_bug` | 25 `sut_bug`, 1 `unknown` |
| Bug rilevati | 3/3 | 3/3 |
| Bug attribuiti (`score.mjs`) | 2/3 | 3/3 |
| Falsi positivi | 0 | 0 |

Tempi per nodo nella run 2:
- Actor: 772 s, quasi tutti di gemma (563 s);
- Test Engine: 265 s (nelle run su r00 era 75 s, ora i molti fallimenti passano dal retry);
- Translator: 237 s;
- Reflector: 109 s.

## I 26 fallimenti

Ogni fallimento è un effetto vero di uno dei tre bug. Nessun rumore della pipeline.

| Bug | Test falliti | Regola citata | Corretta? |
|---|---|---|---|
| B14 | 5 (filtro 3D da solo, con genere, con cambio giorno, ritorno a "Tutti"): `Expected 0, received 1` | "Il filtro per formato mostra soltanto gli spettacoli del formato scelto." | sì |
| B05 | 13 (12 `sut_bug` + 1 `unknown`): il contatore legge 1, 2 o 7 dove i posti sono 2, 3 o 8 | "Il contatore dei posti selezionati mostra esattamente quanti posti sono selezionati." | sì (11); 1 cita la regola di B17 (Torna ai posti, come nella run 1); 1 senza regola (`unknown`) |
| B01 | 8: Ridotto 11,50 invece di 9,00; sconto 5,33 invece di 4,95; totali 37,90 invece di 35,40, 32,57 invece di 30,45 | 1 test cita "Il biglietto Ridotto Over 65 costa 7,00 euro. Gli spettacoli in 3D hanno un supplemento di …"; 2 la regola dello sconto VISUALIZE15; 5 la regola del totale (uno è il test nuovo "codice SCONTO99") | 1 attribuito, 7 su regole a valle |

## Cosa è cambiato rispetto alla run 1

- **B01 attribuito su un test.** Il test che cambia la tipologia ("Ridotto A6, Studente H6") ora cita la regola del prezzo del Ridotto, insieme a quella del supplemento 3D: è proprio la coppia di regole da cui viene il 9,00 atteso. Nella run 1 nessun verdetto di B01 la citava. Gli altri 7 restano su regole a valle (sconto, totale), che per `score.mjs` sono "rilevato su regola a valle".
- **La protezione delle 24 conferme regge.** Il Translator ha rivisto la suite e ha conservato i test confermati come difetti. Il log dice "protected sut_bug test(s) intact … per-test preservation": la protezione è per singolo test, il resto della suite è libero di evolvere (65 test, 2 in più).
- **La data della home resta calcolata.** Il test usa `romeDayTabLabel(6)`, che calcola l'etichetta dall'orologio di Roma. La lacuna 4 di `analisi-r01.md` va corretta: già nella run 1 il codice generato calcolava la data, e "dom 8 nov" compariva solo in un commento.

## Lacune

1. **Un passo condiviso acceca la suite: peggiora.** Con B05 acceso si fermano al contatore 13 test (12 nella run 1). Dentro ci sono il posto isolato (tre test), il limite di 8 (tre test), la pagina biglietti, Torna ai posti, H6 occupato e il flusso 3D Secure. Nessuno di questi controlli viene verificato davvero. È la lacuna che pesa di più sulla misura di SC-005. Due rimedi possibili, ancora da scegliere:
   - contatore verificato in un solo test dedicato;
   - `expect.soft` sulle verifiche di passaggio.
2. **Triage non uniforme sullo stesso bug.** Il test "C2 e C4 selezionati lasciando C3 libero" fallisce come gli altri di B05 (`Expected "2", received "1"`). Il triage però lo chiama `unknown`, senza regola, mentre tutti gli altri di B05 sono `sut_bug` con la regola del contatore. È un test nuovo di questa run, quindi senza storico.
3. **Le conferme non si ereditano.** Le 24 conferme valgono per i record della run 1. I `sut_bug` di questa run sono record nuovi e tornano in coda. La protezione invece continua a valere, perché si deriva dall'ultima decisione sul test. Di nuovo 26 schede per gli stessi 3 bug.
4. **L'Actor scrive date assolute nelle story.** Tre story dicono "mercoledì 4 novembre 2026", cioè domani scritto come data fissa. Il Translator le segnala come aspettative non verificate e non le scrive nel codice, quindi i test restano corretti. La story però diventa vecchia da domani.
5. **Il locator ambiguo di r00 è ancora nel codice.** `getByText('Pagamento rifiutato dalla banca')` è rimasto, ma il flusso 3D Secure si ferma prima, sul contatore (B05), quindi il problema non si vede. Quando il test arriverà a quel punto, il Test Engine porterà al triage la "strict mode violation" (correzione `d34eb32`), e il Reflector la leggerà come selettore ambiguo.
6. **Titoli non aggiornati.** Il flusso 3D Secure si chiama ancora "… 25,35 euro".

## Come rispondere alla coda

- **Le 25 schede `sut_bug`:** difetti veri. Conferma, anche in blocco.
- **La scheda `unknown`:** è "C2 e C4 … C3 libero". È anche lei B05: va riclassificata `sut_bug` (contatore).
- **Le 8 di B01:** la regola citata è a valle su 7. Nella nota si può scrivere che la regola violata è il prezzo del Ridotto.
