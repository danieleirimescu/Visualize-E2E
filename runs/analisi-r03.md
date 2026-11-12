# Visualize r03: due run

Aggiunta automatica (task pianificato, 10/11). Release pubblicata il 10/11 alle 10:00 (ora di Roma), con quattro bug accesi:
- **B14**: il filtro 3D lascia passare gli spettacoli 2D (rimasto dalla r01);
- **B17**: tornando dai biglietti alla mappa la selezione dei posti si perde (rimasto dalla r02);
- **B10**: il pagamento in cassa mantiene la commissione di servizio (nuovo, L2);
- **B23**: il posto singolo isolato non è bloccato (nuovo, L4, caso limite).

**B01** (prezzo del Ridotto) e **B20** (data nelle prenotazioni) sono stati corretti rispetto alla r02.

- SUT: https://visualizecinema.netlify.app
- Profilo: `domain/visualize.json`
- Memoria: non svuotata. Prima della r03, il 10/11 alle 09:59, sono state registrate due decisioni sull'ultima run della r02 (`dcafdcf6`), firmate "claude-opus-5.5 (coop con daniele)":
  - "storico: la prenotazione Il faro sommerso B3…": confermato `sut_bug` (B20);
  - "flusso completo: rifiuto, fondi insufficienti, 3D Secure…": confermato `selector_issue`. Così la vecchia conferma di difetto del 3/11 non vale più, e il test esce dalla protezione.

  Le altre 14 schede della r02 erano già coperte da conferme precedenti, per eredità.
- Pipeline: sul ramo `automation_feature` ci sono due merge da `main` fra la run 4 della r02 (06/11) e questa (06/11 e 10/11).

## Numeri

| | Valore |
|---|---|
| Trace | `38b31bdd` |
| Quando | 10/11, dalle 10:05 alle 10:27 (ora di Roma) |
| Durata | 21 min (1289 s) |
| Costo LLM | 0,27 $ |
| Test | 72: 56 passati, 16 falliti, 0 saltati |
| Verdetti | 14 `sut_bug`, 2 `unknown` |
| Bug rilevati (script) | **4/4** |
| Bug attribuiti (script) | **4/4**, tutti con la regola citata |
| `sut_bug` su regola a valle o adiacente | 0 |
| Falsi positivi | 0 |

Tempi per nodo:
- Actor: 646 s;
- Test Engine: 191 s;
- Translator: 142 s;
- Observer: 140 s;
- Reflector: 82 s.

## Fallimenti per causa

| Causa | Test rossi | Verdetto | Prova |
|---|---|---|---|
| B14 (filtro 3D) | 5 | `sut_bug`, regola del filtro per formato | sotto Formato=3D compare "15:00 2D · Sala 2" |
| B23 (posto isolato) | 7 | 5 `sut_bug` con la regola del posto isolato; 2 `unknown` | con un posto libero fra due selezionati (A2-A4, C2-C4, A5-A7, A6-A8) Prosegui porta alla pagina Biglietti, senza messaggio d'errore |
| B10 (cassa con commissione) | 3 | `sut_bug`, regola della commissione in cassa | con "Paga in cassa" la commissione resta 0,80 € (1 biglietto), 1,60 € (2), 2,40 € (3) invece di 0,00 € |
| B17 (selezione persa) | 1 | `sut_bug`, regola del ritorno alla mappa | tornando a /posti il contatore dice 0 invece di 3 |

Totale: 5 + 7 + 3 + 1 = 16. **Tutti i 16 rossi dipendono da un difetto acceso; nessun rosso per un errore della pipeline.**

I 2 `unknown` ("selezionare A1 e A3 e poi tentare A2…" e "edge: deselezionare il posto che crea l'isolamento…") mostrano la stessa prova degli altri cinque di B23: la pagina Biglietti raggiunta con un buco in fila, nessun messaggio d'errore. Il triage però dichiara di non avere il corpo del test nell'estratto ("The test body is not in the excerpt") e non sa quale passo ha portato lì, quindi non si sbilancia. La regola del posto isolato è comunque citata.

Tutti i 16 verdetti chiedono una conferma umana.

## Cosa è cambiato rispetto alla r02

- **Due difetti nuovi, trovati alla prima run.** B10 e B23 sono rilevati e attribuiti con la loro regola già alla prima esecuzione su r03. B23 è il primo difetto di livello L4 (caso limite di una regola) della sperimentazione.
- **I difetti corretti non danno più rossi.** Nessun fallito riguarda il prezzo del Ridotto (B01) o la data delle prenotazioni (B20).
- **Nessun `sut_bug` su una regola a valle.** Su r02 fino a 7 verdetti di B01 citavano sconto o totale invece della regola violata. Qui ogni `sut_bug` cita la regola del proprio difetto. Con B01 spento era atteso: era quel difetto a propagarsi su sconto e totale.
- **Nessun rosso per un errore dei test.** Il locator ambiguo del 3D Secure e il messaggio nascosto del posto isolato, rossi su r02, non compaiono fra i falliti.
- **Nessun test saltato:** la run parte alle 10:05, prima della soglia della guardia oraria.
- **Costo quasi doppio:** 0,27 $ contro 0,12-0,16 $ delle run su r02, a durata simile (21 min). Il dato non dice quale nodo l'ha causato.

## Lacune nuove

1. **Il triage resta senza il codice del test su 2 fallimenti.** Sui due `unknown` la prova c'è (pagina sbagliata, regola citata), ma manca il corpo del test nell'estratto e il verdetto si ferma. Sono due schede in più da giudicare a mano per un difetto già attribuito altrove.
2. **Un difetto solo, sette schede.** B23 colpisce 7 test e B14 ne colpisce 5: 12 conferme per 2 difetti. È il caso per cui il report offre la selezione multipla.
3. **Costo in salita senza spiegazione nei dati.** Da tenere d'occhio sulla prossima run: se resta a 0,27 $ è un cambiamento della pipeline, non rumore.
4. **Una run sola.** Su r02 il triage ha oscillato fra 0 e 16 `sut_bug` a parità di ingresso: il 4/4 di questa run va confermato da una seconda. *Confermato dalla run 2, vedi sotto.*

## Run 2

| | Run 1 | Run 2 |
|---|---|---|
| Trace | `38b31bdd` | `1f862835` |
| Quando | 10/11 10:05-10:27 | 10/11 10:29-10:51 |
| Durata | 21 min (1289 s) | 22 min (1313 s) |
| Costo LLM | 0,27 $ | 0,16 $ |
| Test | 72: 56 passati, 16 falliti | 73: 56 passati, 17 falliti |
| Verdetti | 14 `sut_bug`, 2 `unknown` | 14 `sut_bug`, 2 `unknown`, 1 `test_code_issue` |
| Bug rilevati / attribuiti (script) | 4/4, 4/4 | **4/4, 4/4** |
| Su regola a valle o adiacente / falsi positivi | 0 / 0 | 0 / 0 |

**Il 4/4 è stabile.** Gli stessi 14 `sut_bug` sugli stessi test, tutti con la regola del proprio difetto. Su r02 il triage oscillava fra 0 e 16 `sut_bug`; qui due run consecutive danno lo stesso risultato.

**Il costo era rumore.** La run 2 torna a 0,16 $, in linea con la r02 (lacuna 3 chiusa).

**L'unico rosso in più è un difetto del test.** "flusso completo: rifiuto, fondi insufficienti, 3D Secure…":
- run 1: verde, con il locator riparato (alert al posto di getByText);
- run 2: rosso più avanti, perché il codice sconto risulta "già applicato" al primo tentativo.

Il triage lo chiama `test_code_issue`: stato lasciato nella sessione del browser, non un comportamento dell'applicazione. Verdetto corretto.

**I due `unknown` si ripetono identici, per la stessa causa:** il corpo del test manca nell'estratto. È deterministico, quindi un difetto della pipeline (l'estrazione del codice non trova questi due test) e non un'oscillazione del triage. Va indagato.

## Cosa dice sulla memoria (r02 → r03)

1. **La protezione regge nei due sensi.**
   - I test protetti dei bug ancora accesi (B14, B17) sono riprodotti identici e falliscono ancora.
   - I test protetti dei bug corretti sono riprodotti identici e ora **passano**: i 7 di B01 (tipologia, VISUALIZE15, codice non valido, SCONTO99, Paga ora 35,40 e 30,45) e i 2 di B20 (storico, Le mie prenotazioni).
   - Nessun falso difetto da una protezione rimasta accesa. Nel report quei test compaiono come "il difetto non si riproduce più", con il controllo di revoca. Per scelta la protezione non decade da sola.
2. **Una decisione umana sblocca un test congelato.** Il test del pagamento, uscito dalla protezione con la decisione del 10/11, è stato riparato alla prima run. Sulla seconda resta il problema di isolamento sopra.
3. **I bug nuovi si trovano con la suite ereditata.** B10 e B23 sono colpiti da test nati fra r00 e r02, e attribuiti alla regola giusta al primo colpo.
4. **La regola sugli importi (commit `b74ecc3` su MALLM) qui non si misura.** Nel codice non c'è ancora un test che isoli il prezzo del Ridotto (nessun "7,00"). Con B01 spento non serve, e il banco di prova è la r06, dove B01 ritorna.

## Prima della r04

Solo B17 resta acceso; B14, B10 e B23 sono corretti. Schede da giudicare:
- B10: 3 `sut_bug`, da confermare;
- B23: 6 `sut_bug`, da confermare;
- i 2 `unknown`, dopo averne letto il codice. Il primo ("tentare A2 mostra l'errore") sembra un test sbagliato: la regola mette l'errore sul "Prosegui", e selezionare A2 chiude il buco;
- il pagamento: da confermare `test_code_issue`.

## Decisioni registrate (10/11, in coop)

Le 17 schede della run 2 (`1f862835`) sono state giudicate con il confronto fra modelli (Opus 5.5, Sonnet 5.5, Haiku 5.5 e giudice: unanime), firmate "coop … (per daniele)":

| Gruppo | Schede | Decisione |
|---|---|---|
| B14, filtro 3D | 5 | confermato `sut_bug` |
| B23, posto isolato al Prosegui | 5 | confermato `sut_bug` |
| B23, i due `unknown` | 2 | riclassificati `sut_bug`: il corpo dei test segue la regola (errore al Prosegui) e fallisce perché l'errore non compare |
| B17, Torna ai posti | 1 | confermato `sut_bug` |
| B10, cassa con commissione | 3 | confermato `sut_bug` |
| flusso completo carta | 1 | confermato `test_code_issue` |

Due correzioni emerse dal confronto:
- **I due `unknown` non erano test sbagliati.** Solo il titolo del primo ("tentare A2 mostra l'errore") è rimasto vecchio; il corpo era già stato corretto. Il Reflector non vede il corpo perché i due titoli contengono un apostrofo.
- **La diagnosi del Reflector sul test della carta era sbagliata.** Non è stato condiviso fra test: dopo il rifiuto il test torna in home e ricostruisce l'ordine, l'ordine in corso resta nel browser e la seconda applicazione del codice riceve, correttamente, "già applicato". La story (step 6 e 7) dice di restare sul checkout e cambiare solo il numero di carta. La nota umana però non arriva al Translator: da osservare sulla r04 se la riparazione avviene.
