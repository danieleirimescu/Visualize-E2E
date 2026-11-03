# Aggiornare la presentazione dopo una run

La presentazione "Visualize × LABBGEN" è un'Artifact di tipo Slides:
https://claude.ai/artifact/2EnDVjscR7ogCkoJwb67qj

Le sorgenti stanno in questa cartella, in `project/` (`deck.json` più una `slides/<id>.html` per slide). Questa è la copia di riferimento: si modifica qui e si pubblica da una copia.

Tutti i comandi vanno lanciati da `C:\Users\daniele.irimescu\Documents\GitHub\visualize`.

## 1. C'è una run nuova?

```
node scripts/deck-data.mjs --new
```

Il comando stampa le run concluse su Visualize che la presentazione non ha ancora. Se stampa `[]` non c'è niente da fare: ci si ferma qui.

Se esce con codice 3, MongoDB non risponde (Docker spento): ci si ferma qui, senza errori.

## 2. Per ogni run nuova, dalla più vecchia

**a. I fatti.** Lancia `node scripts/deck-data.mjs --trace <trace>`. Il comando restituisce:
- la release (`release`) e il numero della run in quella release (`run_in_release`);
- test, verdi, rossi, saltati;
- durata e costo;
- i secondi per agente;
- le decisioni umane applicate;
- per ogni test rosso: il verdetto, atteso e ricevuto, e la regola citata.

**b. Il punteggio.** Serve l'API della memoria su http://127.0.0.1:8000. Se non risponde, avviala in background da `C:\Users\daniele.irimescu\Documents\GitHub\MALLM_Agent_ASK` con `.venv/Scripts/python.exe -m uvicorn api.memory_api:app --port 8000`. Poi lancia:

```
node scripts/score.mjs --trace <trace> --release <release>
```

Il punteggio dice quali difetti sono stati rilevati e attribuiti, e quali verdetti sono falsi positivi.

**c. Capire la run.** Per farlo servono:
- i difetti accesi nella release, in `releases/<release>.json`, con titolo e regola in `bugs/catalog.json`;
- ciò che è cambiato dalla run precedente: una nuova release pubblicata (`runs/releases.log.jsonl`) o decisioni umane applicate.

Per ogni test rosso stabilisci se dipende da un difetto acceso o da un errore della pipeline. L'analisi va aggiunta in fondo a `runs/analisi-<release>.md`, creandolo se manca, nello stile delle analisi esistenti:
- una tabella con i numeri;
- i fallimenti raggruppati per causa;
- le lacune nuove.

**d. La slide della run.** Crea `project/slides/run-<release>-<n>.html`, con `<n>` = `run_in_release`, copiando ESATTAMENTE la struttura di `project/slides/run-r01-1.html`. Cambiano soltanto i testi e i numeri:
- **eyebrow:** `Run per run · <release> · run <n> · <giorno mese>`;
- **titolo:** una frase semplice che dica il fatto principale della run;
- **"Prima della run":** cosa è cambiato rispetto alla run precedente;
- **"Cosa è successo":** cosa hanno fatto i test e il triage;
- **"Cosa impariamo":** la lezione, o la lacuna nuova;
- **i sei numeri:** test, rossi, falsi positivi, durata in minuti, costo in $, più "verdi" in % se la release non ha difetti oppure "difetti trovati" (rilevati/attivi) se ne ha;
- **la riga in basso:** il trace abbreviato;
- **l'`<aside>`:** due o tre frasi di spiegazione per chi presenta.

Il testo va scritto in italiano semplice, senza gergo. Ogni blocco resta entro circa 200 caratteri, altrimenti non entra nella slide.

**e. Lo stato delle release.** In `project/slides/stato.html` aggiorna la riga della release: run fatte, % verdi dell'ultima run, rilevati (— se la release non ha difetti), falsi positivi e stato. Nella riga in basso scrivi la data e il trace abbreviato. Se cambia, aggiorna anche la frase sotto la tabella.

**f. La copertina.** In `project/slides/cover.html` aggiorna la data in "aggiornato al …".

**g. L'ordine.** Nel campo `order` di `project/deck.json` inserisci l'id della nuova slide subito dopo l'ultima slide `run-…`, prima di `lacune`. Non toccare gli altri campi.

**h. La pubblicazione.** Copia la cartella `project` nella tua scratchpad, in `<scratchpad>/deck/project`. Poi pubblica con il tool Artifact:
- `url` = https://claude.ai/artifact/2EnDVjscR7ogCkoJwb67qj;
- `root` = `<scratchpad>/deck`;
- `file_path` = il percorso assoluto di `deck.json` nella copia;
- `files` = le sole slide cambiate, come `{"project/slides/<id>.html": "project/slides/<id>.html"}`.

Serve il percorso lungo, `C:/Users/daniele.irimescu/...`, non quello abbreviato `DANIEL~1.IRI`. Se la pubblicazione viene rifiutata, segui quello che dice il rifiuto.

**i. Segna la run.** Lancia `node scripts/deck-data.mjs --mark <trace>`.

## Regole delle slide

Ogni file contiene una sola `<section id="<id>">`, con tutti gli stili inline. Il sottoinsieme ammesso è quello del tipo Slides: px, colori in hex, flex e grid, niente classi né margin. Si copiano gli stili delle slide esistenti:

| | Valore |
|---|---|
| Fondo scuro | `#15171F` |
| Fondo chiaro | `#F5F1E8` |
| Accento | `#E3A33B` |
| Blu | `#8FB0FF` sul fondo scuro, `#2D5BBF` sul chiaro |
| Testo secondario | `#C9C4B8` |
| Font | Oswald per titoli e numeri, Public Sans per il testo |

Nessun testo sotto i 24px.

## Cosa non fare

- Non lanciare la pipeline.
- Non rispondere alle schede di revisione.
- Non modificare codice, test o catalogo.
- Non fare commit o push.
- Non cambiare le altre slide, a parte stato, copertina e la slide nuova.
