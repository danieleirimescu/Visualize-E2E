# Visualize

Sito dimostrativo di prenotazione biglietti di un multisala, pensato come SUT per la pipeline LABBGEN. Ogni **release** del sito accende un insieme diverso di difetti seminati, scelti da un catalogo con livelli di difficoltà dichiarati. Confrontando i verdetti della pipeline con il manifest della release si misura quanto la pipeline trova i difetti e quanto li attribuisce bene (SC-005 dei deliverable).

Film, sale, prezzi e carte di pagamento sono inventati. Nessun pagamento è reale, e tutto lo stato (ordine, prenotazioni, saldo delle carte regalo) resta nel `localStorage` del browser.

## Il sito

| Pagina | Percorso |
|---|---|
| Programmazione (7 giorni, filtri per genere e formato) | `/`, `/?giorno=1&formato=3D` |
| Scheda film | `/film/<slug>` |
| Mappa dei posti (8 file × 10, fila H VIP) | `/posti?spettacolo=<film>.<AAAAMMGG>.<HHMM>` |
| Biglietti, tipologie, codice promo | `/biglietti?spettacolo=…` |
| Checkout: dati e pagamento (carta, carta regalo, cassa) | `/checkout` |
| Conferma | `/conferma?codice=VZ-…` |
| Le mie prenotazioni, annullamento | `/prenotazioni` |
| Prezzi e regole | `/prezzi` |

Il sito usa percorsi reali, non `#`: il gate per pagina del Translator riconosce la pagina dal path. L'id dello spettacolo sta nella query, e gli slug dei film non contengono cifre, perché un segmento di path con cifre la pipeline lo tratta come id di record e lì si astiene.

Ogni elemento interattivo ha un `data-testid`. I posti sono `<button>` con `aria-label` stabile ("Fila F, posto 7") e lo stato in una classe (`is-selected`, `is-occupied`): lo Scout non legge `aria-pressed`/`disabled` e segue gli stati solo come classi.

Pagamento simulato (anche nel box "carte di test" del checkout):

| Carta | Esito |
|---|---|
| 4242 4242 4242 4242 | approvata |
| 4000 0000 0000 0002 | "Pagamento rifiutato dalla banca." |
| 4000 0000 0000 9995 | "Fondi insufficienti." |
| 4000 0000 0000 3220 | 3D Secure, codice 123456 |
| 3782 822463 10005 | American Express, CVV di 4 cifre |
| GIFT-5000-0000-0001 / GIFT-1000-0000-0002 | carte regalo da 50,00 € / 10,00 € |
| GIFT-0000-0000-0003 | carta regalo scaduta |

## Bug seminati

- [bugs/catalog.json](bugs/catalog.json): 28 bug (L1 evidente → L5 corsa), una voce di timing (T01) e tre modifiche legittime (C01-C03) che **non** sono difetti e servono a misurare i falsi positivi. Ogni bug cita la frase del profilo che viola, copiata parola per parola: è la frase che il triage del Reflector deve citare perché un `sut_bug` regga.
- Ogni voce è una costante di build `__BUG_<ID>__`. Il minificatore elimina i rami spenti, quindi il JS pubblicato non contiene né il codice né i nomi dei bug inattivi, e il manifest non viene mai servito.
- [releases/](releases/): `r00` pulita, poi una sequenza pensata per mettere alla prova la memoria fra run: difetti che restano, correzioni (`r04`: il difetto non si riproduce più), refactor senza difetti (`r05`), regressione (`r06` reintroduce B01).

## Comandi

```bash
npm install
npm run dev                         # sviluppo
npm run check:catalog               # catalogo, release e profilo coerenti fra loro e con i limiti della pipeline
npm run check:scout                 # i passi dei workflow del profilo, eseguiti come lo Scout, su ogni release
npm run oracle                      # build r00 + suite di riferimento: deve passare tutta
node scripts/oracle.mjs --release r03
npm run mutants                     # ogni bug, acceso da solo, fa fallire i suoi test su un'asserzione
npm run mutants -- --full --write-collateral   # tutta la suite per ogni voce; registra i test collaterali
npm run release:new -- --seed 7 --keep 1 --reintroduce
npm run release:publish -- r03      # build + netlify deploy --prod sull'URL stabile
npm run profile:export -- --origin https://<sito>.netlify.app --out ../MALLM_Agent_ASK/domain/visualize.json
npm run score -- --trace <trace_id> --release r03
```

La suite di riferimento ([oracle-tests/](oracle-tests/)) gira con l'orologio fisso a martedì 3 novembre 2026, alle 9:00 di Roma, così i test che dipendono dall'ora (spettacolo iniziato, finestra di annullamento, scadenza della carta) sono deterministici.

## Netlify

1. Crea un repository privato e fai push di questa cartella.
2. Su Netlify: *Add new site → Import from Git*, poi scegli il repo. Build command e cartella sono già in [netlify.toml](netlify.toml).
3. La release online è quella in `CURRENT_RELEASE`. Ci sono due modi per cambiarla:
   - `node scripts/publish.mjs r03 --git`, poi commit e push: Netlify ricostruisce.
   - `node scripts/publish.mjs r03`, con la CLI (`npm i -g netlify-cli`, `netlify login`, `netlify link`): build locale e deploy diretto in produzione.

   Ogni pubblicazione aggiunge una riga a `runs/releases.log.jsonl`.
4. Usa sempre lo **stesso URL di produzione** come `TARGET_APP_URL`. La memoria di LABBGEN identifica il SUT dall'URL, quindi un URL per ogni release (branch deploy, permalink) farebbe partire ogni volta una Task History nuova. I permalink dei deploy servono solo per rieseguire a mano una release vecchia.
5. Esporta il profilo con l'origine esatta del sito: schema e host, senza redirect da `http` o `www`, altrimenti lo Scout rifiuta l'esplorazione.

## Una run della pipeline

```bash
# in MALLM_Agent_ASK
set TARGET_APP_URL=https://<sito>.netlify.app
set DOMAIN_CONTEXT_PATH=domain/visualize.json
set PLANNER_IMAGE_PATH=<screenshot della home di Visualize in graph/images>
python main.py
# poi, qui
npm run score -- --trace <trace_id>
```

`npm run score` legge i verdetti dall'API di LABBGEN (`/memory/items/query`, default `http://127.0.0.1:8000`, oppure `--api`) e per ogni bug attivo riporta:
- **copertura**: la suite generata tocca i suoi elementi;
- **rilevamento**: un test fallito gli è riconducibile;
- **attribuzione**: `sut_bug` con la regola giusta, oppure sospetto in coda per una persona;
- **falsi positivi**: i `sut_bug` senza un bug seminato dietro.

L'abbinamento verdetto → bug segue un ordine di affidabilità, e il report dichiara quale ha usato:
1. **Regola citata**: la citazione del triage è la frase del catalogo. È l'unico abbinamento che conta come "attribuito".
2. **Regola adiacente**: cita la regola di un altro bug i cui test falliscono anche con questo acceso (`collateral_tests`). Il bug conta come rilevato, non come attribuito.
3. **Test id nel ricevuto**: è solo indicativo. Un `sut_bug` che non cita la regola di un bug attivo è un falso positivo.

## Limiti noti

- **Ora della run.** La scheda "Oggi" cambia nel corso della giornata: gli spettacoli iniziati non sono prenotabili, e dopo le 22:50 non resta nulla. Una suite generata al mattino e rieseguita la sera può fallire senza nessun bug dietro. I passi del profilo usano "Domani" per questo motivo. Conviene lanciare le run in una fascia oraria fissa.
- **B24** (spettacolo appena iniziato ancora prenotabile) si vede solo nei 15 minuti dopo l'inizio di uno spettacolo di oggi. Senza controllo dell'orologio, in una run della pipeline è raro.
- **T01** rallenta la mappa fino a 6 secondi. Lo Scout aspetta al massimo 5 secondi per elemento, quindi con T01 attivo una parte delle esplorazioni si ferma e i workflow concatenati non partono: è voluto.
- **Bug collaterali.** Alcuni bug fanno fallire anche test di altre regole (B03 tocca anche i totali). `mutants --full --write-collateral` li registra nel catalogo, e la valutazione li conta come "regola adiacente".
- **Fughe residue.** Il CSS contiene in ogni release le classi di C03 e T01, e l'hash dei file cambia da una release all'altra. La pipeline non legge né l'uno né l'altro. I log di build su Netlify non stampano le voci attive.
