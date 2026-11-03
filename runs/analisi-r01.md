# Visualize r01: prima run con bug seminati

r01 accende tre bug:
- **B01** (L1): il Ridotto Over 65 costa quanto un Intero;
- **B05** (L1): il contatore dei posti segna uno in meno;
- **B14** (L2): il filtro 3D lascia passare gli spettacoli 2D.

Prima della run la suite di riferimento, lanciata sul sito pubblico, falliva esattamente sui test di questi tre bug (più il collaterale noto di B05).

- SUT: https://visualizecinema.netlify.app
- Profilo: `domain/visualize.json`
- Memoria: quella delle cinque run su r00, non svuotata. I due fallimenti della run 5 su r00 non hanno avuto risposta.

## Numeri

| | Run 1 |
|---|---|
| Trace | `88758e6a` |
| Quando | 02/11 10:58 |
| Durata | 26 min |
| Costo LLM | 0,18 $ |
| Test | 63: 39 passati, 24 falliti |
| Verdetti | 24, tutti `sut_bug`, tutti in coda per una persona |
| Bug rilevati | 3/3 |
| Bug attribuiti (regola giusta citata) | 2/3 (B05, B14) |
| Falsi positivi | 0 |

## I 24 fallimenti

Ogni fallimento è un effetto vero di uno dei tre bug. Nessuno è rumore della pipeline.

| Bug | Test falliti | Regola citata dal Reflector | Corretta? |
|---|---|---|---|
| B14 | 5: il filtro 3D, combinato con genere, giorno e ritorno a "Tutti", mostra "15:00 2D · Sala 2" di Ultimo treno | "Il filtro per formato mostra soltanto gli spettacoli del formato scelto." | sì |
| B05 | 11: il contatore legge 1, 2 o 7 dove i posti selezionati sono 2, 3 o 8 | "Il contatore dei posti selezionati mostra esattamente quanti posti sono selezionati." | sì |
| B05 | 1: "Torna ai posti mantiene la selezione" (contatore 2 invece di 3) | la regola di B17, sul ritorno alla mappa | adiacente: la selezione resta, sbaglia il contatore |
| B01 | 7: Ridotto 11,50 invece di 9,00; sconto 5,33 invece di 4,95; totali 37,90 invece di 35,40 e 32,57 invece di 30,45 | totale, sconto VISUALIZE15, "cambiando la tipologia il prezzo si aggiorna subito" | **no**: quelle regole non sono violate, i valori sono spostati dal prezzo del Ridotto |

I numeri di B01 tornano:
- 11,50 = 9,50 (Intero) + 2,00 (3D);
- lo sconto 5,33 è il 15% di 35,50, corretto sulla somma sbagliata;
- 37,90 − 35,40 = 2,50, la differenza fra Intero e Ridotto.

## Cosa funziona

- **Rilevamento pieno.** I tre bug sono tutti visti. Ogni verdetto ha atteso e ricevuto espliciti e il locator risolto.
- **Nessun falso positivo** su 24 `sut_bug`. Dopo cinque run su r00 senza bug, la memoria non ha prodotto verdetti spuri.
- **Le prove reggono.** Ogni verdetto cita una frase intera del profilo, e la conferma umana è richiesta su tutti, come da regola.
- **Le correzioni di r00 tengono.** Filtro Animazione + 3D e carte regalo passano.

## Lacune emerse

1. **La regola citata è quella vicina alla narrazione del test, non quella contraddetta.** Su B01 il Reflector non cita mai "Il biglietto Ridotto Over 65 costa 7,00 euro.", nemmeno nel test che legge `ticket-price-A6` = 11,50 dopo aver scelto Ridotto. Cita "cambiando la tipologia il prezzo si aggiorna subito", ma il prezzo si aggiorna, solo al valore sbagliato. Per chi giudica la scheda la regola indicata è fuorviante. Nessun controllo verifica che il valore atteso discenda dalla regola citata. Il 9,00 atteso viene da due regole (Ridotto 7,00 e 3D 2,00), e la citazione ne ammette una sola.
2. **Un bug su un passo condiviso acceca la suite.** Il Translator verifica il contatore dentro molti test, anche in quelli che servono ad altro (posto isolato, limite di 8, flusso 3D Secure, pagina biglietti). Con B05 acceso 12 test si fermano al contatore. Quindi in questa run il posto isolato, il limite di 8 posti e il flusso di pagamento con carta non sono stati verificati. La suite di riferimento controlla il contatore in un solo test, apposta.
3. **Tre difetti, 24 schede.** La coda chiede 24 risposte per 3 bug. La selezione multipla del report aiuta, ma il raggruppamento resta tutto a carico della persona (scelta di progetto, vedi CLAUDE.md).
4. ~~**Data letterale, ancora.**~~ Errata, corretta dopo la run 2: il test della home calcola già l'etichetta con `romeDayTabLabel(6)` dall'orologio di Roma; "dom 8 nov" compare solo in un commento. La lacuna 13 di r00 è quindi risolta nel codice di questa run.
5. **Il locator ambiguo di r00 è ancora nel codice.** `getByText('Pagamento rifiutato dalla banca')` è rimasto. Stavolta non si vede, perché il flusso 3D Secure si ferma prima, sul contatore (B05).
6. **Titoli dei test non aggiornati.** Il flusso 3D Secure si chiama ancora "… con totale 25,35 euro", ma asserisce 30,90.

## Modifiche al punteggio (`scripts/score.mjs`)

Il punteggio contava i 7 verdetti di B01 come falsi positivi, perché non citano la regola del bug. Ora un bug del catalogo può dichiarare `downstream_rules`, cioè le regole il cui valore atteso il bug sposta senza violarle:
- per i bug di prezzo, totale, sconto e arrotondamento (più la tipologia per B01 e B04);
- per i bug su commissione e sconto, solo il totale.

Un `sut_bug` che cita una di queste regole conta come **rilevato su regola a valle**: non è attribuito, ma non è un falso positivo. `check-catalog` verifica che ogni regola a valle sia una frase intera del profilo. Ricalcolate anche le run su r00: nessun cambiamento.

Precisione stretta dei `sut_bug` (regola del bug citata): 16/24 = 0,67. Verdetti che puntano a un bug vero: 24/24.

## Come rispondere alla coda

Tutte le 24 schede sono difetti veri: **conferma** (`sut_bug`), anche in blocco. Per le 7 di B01 la regola citata è imprecisa ma il difetto è reale. Nella nota si può scrivere che la regola violata è il prezzo del Ridotto. I due fallimenti di r00 (data letterale, locator ambiguo) non sono fra i 24: il test della home oggi passa e il flusso 3D Secure fallisce prima. Se compaiono ancora da giudicare, la risposta è "il test è sbagliato".
