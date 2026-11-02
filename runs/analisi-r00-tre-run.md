# Visualize r00: cinque run della pipeline LABBGEN

r00 è la release pulita: nessun bug seminato è attivo, quindi ogni fallimento è rumore della pipeline e ogni `sut_bug` è un falso positivo.

- SUT: https://visualizecinema.netlify.app
- Profilo: `domain/visualize.json`
- Database: svuotato prima della run 1, con backup in `labbgen-backups/`

## Numeri

| | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 |
|---|---|---|---|---|---|
| Trace | `b899bf8b` | `4817f0d0` | `a37c1bd0` | `a3df37ee` | `94540ceb` |
| Quando | 29/10 16:24 | 30/10 09:54 | 30/10 10:28 | 30/10 ~12:35 | 02/11 09:11 |
| Revisione umana prima della run | (database vuoto) | nessuna | 4 × "nessuno dei due" (`test_code_issue`) | 3 × "l'applicazione ha ragione" (`user_story_issue`) con testo | 2 × conferma `user_story_issue` con testo |
| Durata | 24 min | 19 min | 19 min | (non misurata) | 15 min |
| Test generati | 35 | 38 | 44 | 49 | 59 |
| Passati / falliti / saltati | 28 / 4 / 3 | 34 / 4 / 0 | 41 / 3 / 0 | 47 / 2 / 0 | 57 / 2 / 0 |
| Tasso di successo | 80% | 89% | 93% | 96% | 97% |
| `sut_bug` (tutti falsi positivi) | 1 | 1 | 1 | **0** | **0** |
| Costo LLM | — | 0,14 $ | — | — | 0,11 $ |

I 3 test saltati nella run 1 dipendono dall'orario: verificano l'annullamento dello spettacolo delle 15:00, che alle 16:40 non era più possibile.

## I fallimenti, test per test

Il sito si è comportato correttamente in ogni caso.

| Test | Causa vera | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 |
|---|---|---|---|---|---|---|
| Home e card dei film | run 1: il test legge il titolo come orario. Run 5: **data letterale congelata**, il test si aspetta "gio 5 nov" (oggi+6 al 30/10), il sito mostra "dom 8 nov" (oggi+6 al 02/11) | `test_code_issue` | corretto | passa | passa | `test_code_issue` |
| Flusso 3D Secure | posti A5, A6, H6 su uno spettacolo in cui H6 è occupato, poi totale vecchio, poi locator ambiguo | `unknown` | `unknown` | `test_code_issue`, test identico | posti corretti, **totale atteso vecchio** (25,35 invece di 30,90): `user_story_issue` | totale corretto (30,90). Nuovo: `getByText('Pagamento rifiutato dalla banca')` trova anche la voce nascosta dell'elenco "carte di test", quindi **strict mode violation**: `unknown` |
| Carta che scade nel mese corrente | `toBeHidden()` su un paragrafo d'errore sempre visibile ma vuoto | **`sut_bug`** | **`sut_bug`**, test conservato | **`sut_bug`**, test identico | **riscritto con `toHaveText('')`, passa** | passa |
| Saldo della carta regalo | posti scelti senza guardare l'occupazione | `test_code_issue` | `unknown` | `test_code_issue`, test identico | **riscritto, passa** | passa |
| Le mie prenotazioni | `toBeHidden()` su un errore del checkout vuoto ma visibile | (assente) | `unknown` | riscritto, passa | passa | passa |
| Filtro Animazione + 3D | la story inventa una combinazione che non esiste: Piccoli giganti è solo 2D, e il sito mostra correttamente "Nessuno spettacolo" | — | — | — | `user_story_issue` | **riscritto sul messaggio vuoto, passa** |

## I due canali di revisione umana a confronto

**Run 3: "nessuno dei due, il test non verifica ciò che dichiara".**
- Le decisioni sono arrivate e sono state applicate anche ai record precedenti.
- Il gate di riscrittura forzata ha chiesto due volte di riscrivere 3 test, e il modello li ha riprodotti identici. Solo 1 test su 4 è stato riscritto.
- Il Reflector ha rifatto il triage da zero e ha richiamato `sut_bug` il test della carta.
- `applied_human_decision_ids: []` nell'artifact.

**Run 4: "l'applicazione ha ragione", con il comportamento corretto descritto.**
- Il testo è finito negli `assumptions` delle story 5 e 6. Nessuna aspettativa è rimasta non registrata.
- Il Translator ha ricevuto i 3 test in `human_expectation_realignment_requested`, e l'artifact registra le 3 decisioni applicate.
- **Tutti e 3 i test sono stati riscritti.** 2 su 3 ora passano. Il terzo ha i posti corretti, ma tiene il totale calcolato sui posti vecchi.
- Nessun `sut_bug`: per la prima volta, precisione piena su r00.

Il secondo canale funziona, il primo no. Il secondo però ha un costo: le story si legano a fatti specifici (posti occupati, struttura del DOM) scritti da una persona.

## Lacune emerse

1. **La riscrittura forzata non forza.** Con "il test non verifica ciò che dichiara" la decisione arriva al Translator, ma se il modello ripropone lo stesso codice il gate si limita ad annotare. Nella run 3, 3 test su 4 sono rimasti identici. Per ottenere davvero una riscrittura bisogna passare dal canale "l'applicazione ha ragione", che riscrive la story, anche quando la story era giusta e sbagliava solo il test.
2. **Il riallineamento non ricalcola i valori che dipendono dal fatto corretto.** Nella story 5 l'Actor ha cambiato i posti (H6 → A7) ma ha lasciato il totale di 25,35 €, calcolato con una poltrona VIP. L'Observer l'ha approvata. Il test ha anche perso i passi di tipologia e codice promo, quindi il totale vero è 30,90 €. Story e test sono incoerenti al loro interno, e nessun gate se ne accorge.
3. **Il Reflector non tiene conto delle decisioni sul triage.** Lo stesso fallimento torna `sut_bug` alla run successiva a una riclassificazione umana opposta (run 3).
4. **Un `sut_bug` non confermato congela il test.** Nella run 2, senza revisione, il Translator ha conservato verbatim un test sbagliato: un falso positivo fisso a ogni run.
5. **"Ricevuto in contraddizione" lo decide solo il modello.** Un elemento visibile ma vuoto passa come contraddizione dell'atteso "nessun errore", anche quando il Reflector scrive che il paragrafo è senza testo.
6. **Il Translator ignora informazioni che ha già.**
   - Lo Scout registra i paragrafi d'errore vuoti come visibili, ma il Translator usa `toBeHidden()`.
   - Il profilo dice che le file A e B sono sempre libere, ma il Translator usa posti di altri spettacoli o posti a caso.
   - Ci sono voluti una persona e una story riscritta per correggerlo.
7. **L'Actor inventa combinazioni che i dati non prevedono** (Animazione + 3D). Il catalogo dello Scout mostra quali formati ha ogni film.
8. **Il ritentativo di qualità viene scartato anche quando migliora.** Nelle run 1 e 2: `weak assertions 3 -> 0`, nessun test perso, ritentativo rifiutato. Nella run 3 accettato. Probabile bug del gate, da verificare.
9. **Il triage è instabile sullo stesso test:** carta regalo `test_code_issue` → `unknown` → `test_code_issue`. Nella run 2 cita una regola non violata.
10. **Un suggerimento del report va nella direzione sbagliata.** Su un fallimento ripetuto il report scrive che "indica più spesso un difetto reale". Qui si ripete perché il test non viene riscritto.
11. **Le aspettative della story non verificate oscillano:** 3, 1, 11 valori citati dalla story che il codice non controlla. È solo un avviso.
12. **La `reason` perde la strict mode violation.** Nella run 5 Playwright scrive "strict mode violation: … resolved to 2 elements", ma il testo che arriva al Reflector è solo `expect(locator).toBeVisible() failed`. Il Reflector lo nota ("with no match count") e resta `unknown`, invece di un `selector_issue` di tipo `strict_mode` instradato al Translator. Il gate di grounding del Translator non ha segnalato l'ambiguità del `getByText` (non verificato se la voce nascosta dell'elenco carte di test sia nel catalogo dello Scout).
13. **Date relative scritte come letterali.** Un test generato il 30/10 si aspetta l'etichetta della settima scheda ("gio 5 nov"), il 02/11 fallisce. La regola di prompt sulle date relative (calcolarle a runtime) non basta: nessun gate rileva un letterale di data nel codice, e il test è stato conservato da una run all'altra.
14. **Note operative.**
    - Nella run 1 una risposta del Translator è stata tagliata a 65536 token, perché `LLM_MAX_OUTPUT_TOKENS` non è impostato.
    - I candidati del Translator vengono salvati in `MALLM-Agent\workspace`, che è un altro repo.
    - L'orario della run cambia i test eseguiti.

## Cosa funziona

- **Scout stabile:** circa 550 elementi a ogni run. Nella run 1 ha completato tutti i 52 passi dei workflow.
- **Planner:** copre sempre tutti e 7 i workflow.
- **Suite in crescita** a ogni run: 35, 38, 44, 49, 59 test, e tasso di successo 80%, 89%, 93%, 96%, 97%.
- **Le 2 correzioni date dopo la run 4** (filtro Animazione + 3D, totale del flusso 3D Secure) sono arrivate entrambe nel codice nella run 5. L'artifact registra le 2 decisioni applicate.
- **Canale "l'applicazione ha ragione"**: funziona da capo a fondo. Il testo umano arriva alla story, il test viene riallineato e la decisione viene tracciata nell'artifact.
- **Protezione per singolo test** e propagazione delle decisioni ai record precedenti dello stesso test: come progettato.
- **Costo:** circa 0,14 $ per run (misurato nella run 2).
