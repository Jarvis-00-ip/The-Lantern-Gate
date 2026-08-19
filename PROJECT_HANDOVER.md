# The Lantern Gate — Documento di contesto per IA

> Questo file esiste per far ripartire qualunque assistente IA (Claude, GPT, ecc.) senza dover rileggere l'intera cronologia. Aggiornalo quando finisci una fetta di lavoro importante — non lasciarlo invecchiare come `HANDOVER.txt` (quello è uno storico di gennaio 2026, ormai superato da questo file).

## Cos'è il progetto

Simulatore del terminal portuale PSA SECH (Genova), in vanilla JS + Leaflet.js, **nessun build step**, deploy come sito statico su GitHub Pages: `jarvis-00-ip.github.io/The-Lantern-Gate/`. Le coordinate delle zone (piazzali, banchina, gate, strade) sono tracciate a mano sulla mappa reale, non inventate — è una regola di progetto: quando serve una nuova zona/geometria, si traccia sul terreno vero, non si stimano coordinate a caso.

Repo: `Jarvis-00-ip/The-Lantern-Gate`. Si lavora sempre sul branch `claude/analisi-progetto-bloccato-mc1a9a`, mergiato in `main` tramite PR (draft, in italiano, che l'utente/il suo processo merge quasi subito dopo l'apertura).

## Stack tecnico

- Vanilla JS ES modules (nessun bundler), Leaflet.js per la mappa, Leaflet-Geoman per il disegno di zone/strade.
- Test: harness leggero fatto in casa (`test/harness.js`: describe/it/assert/equal/deepEqual/closeTo/run), zero dipendenze npm. `npm test` → `node test/run.js`. Attualmente **116+ test**, tutti verdi.
- Verifica end-to-end: Playwright + Chromium locale (`/opt/pw-browsers/...`), installato temporaneamente per ogni verifica e **sempre ripulito** dopo (node_modules, index_local.html, script temporanei). La CDN (unpkg.com) è bloccata dalla policy di rete del sandbox → per i test E2E si crea un `index_local.html` temporaneo che punta a Leaflet/Geoman installati in `node_modules` invece che alla CDN.
- Nessun `.gitignore` per `node_modules` — installarlo solo temporaneamente e rimuoverlo sempre a fine verifica, altrimenti finisce in `git status`.

## Filosofia di lavoro (importante)

- **Verificare, non assumere.** Ogni fix/feature viene provato con test automatici e/o uno script Node/Playwright prima di dichiararlo funzionante. Più volte in questa sessione un bug era invisibile leggendo il codice ma evidente facendolo girare (esempio sotto).
- **Niente geometria inventata.** Le zone (`GeoManager.js`) sono poligoni reali tracciati sulla mappa. Se serve una nuova area (es. un nuovo molo), va tracciata, non stimata.
- **Niente feature non richieste.** Non si aggiungono astrazioni, fallback o validazioni per casi che non possono succedere.
- Commit in inglese tecnico, corpo PR in italiano, entrambi con firma `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` e link sessione. Versione (`src/core/version.js` + `package.json`) bumpata ad ogni PR.

## Architettura: mappa dei file principali

```
src/core/
  GeoManager.js       — poligoni delle zone (piazzali, banchina, gate...), utility geospaziali:
                        isInsideZone, getZoneCenter, hasArrived (arrivo poligono-aware, UNICA fonte
                        di verità — vedi bug sotto), getParkingSlot/getParkingGrid (evitano che i
                        mezzi si sovrappongano), _distanceMeters.
  FleetManager.js     — flotta di Ralle (terminal tractor) e Reach Stacker (semoventi). Vehicle ha
                        position/currentZone/status/carriedContainer. findNearestVehicle() assegna
                        il mezzo libero più vicino a un job.
  yardManager.js      — Yard/Container: stacks per bay/row/tier dentro ogni zona.
  TruckManager.js     — ciclo di vita camion: spawn → OCR → gate → parcheggio piazzale → job → uscita.
  JobManager.js       — job a UN veicolo (i job dei camion: Ralla/RS che carica/scarica un camion).
  TranstainerManager.js — NUOVO (questa sessione). Job a DUE veicoli in sequenza (RS + Ralla) per il
                        flusso RTG (gru a cavalletto di piazzale). Vedi sezione dedicata sotto.
  VesselManager.js    — anagrafica nave (schedule, manifest discharge/load, ETA/ETD, penalità
                        ritardo). Finora SOLO dati, nessuna posizione/grafica/logica di movimento
                        (questo è il lavoro appena iniziato — vedi "Stato attuale").
  RouteBook.js / PathFinder.js — grafo stradale per i percorsi disegnati a mano.
  StorageManager.js   — persistenza localStorage (namespace "lanterngate").
  version.js          — VERSION/BUILD_DATE mostrati in header, bump obbligatorio ad ogni PR.

src/ui/
  app.js              — entry point: istanzia tutti i manager, espone su window (window.truckManager,
                        window.jobManager, window.transtainer, window.fleet, window.yard, window.geo,
                        window.vesselManager...), game loop (`gameLoop`: chiama update(dt) di ogni
                        manager poi renderTrucks()/renderVehicles()). renderVehicles() è GENERICA:
                        muove qualsiasi veicolo verso v.currentZone leggendo v.carriedContainer per
                        l'icona — non serve toccarla per aggiungere nuovi tipi di job, basta impostare
                        currentZone/carriedContainer sul veicolo.
  MainMenu.js         — menu 🍔 in alto a sinistra, voci per spawnare camion e (da poco) trigger
                        manuali del Transtainer (Export/Import).
  vehicleIcons.js      — icone SVG per camion/mezzi flotta (truckIcon, fleetIcon, bearing()).
  TOSDashboard.js      — pannello che mostra vesselManager.activeVessel (nome, ETA/ETD, manifest) —
                        oggi puramente testuale, nessuna grafica sulla mappa.

test/
  run.js               — importa in sequenza tutti i *.test.js ed esegue.
  dispatch.test.js, transtainer.test.js, ... — un file per area funzionale.
```

## Pattern chiave da riusare

1. **Sistema di zone poligonali**: ogni area del terminal è un poligono con `id`/`type`/`vertices` in `GeoManager.js`. I veicoli non hanno una destinazione (x,y) diretta ma un `currentZone`; il renderer calcola lui il punto di parcheggio (`getParkingSlot`/`getParkingGrid`) e la distanza di arrivo (`hasArrived`, poligono-aware — MAI confrontare solo col centro geometrico di una zona lunga, è la causa del bug più insidioso di questa sessione, vedi sotto).
2. **Job a un veicolo vs job a più veicoli**: `JobManager` presume un solo veicolo dall'inizio alla fine (adatto ai camion). Per flussi con DUE veicoli in sequenza (RS che passa il container a una Ralla) serve un manager dedicato con una macchina a stati esplicita per fase — pattern usato in `TranstainerManager` (enum `TranstainerPhase`, switch per fase, ogni fase di attesa ha un `setTimeout` che avanza la fase successiva).
3. **Corse critiche da temporizzazione**: quando un job scatta "in anticipo" (es. il semovente parte appena il camion passa l'OCR, non quando è fisicamente parcheggiato), va SEMPRE aggiunta una guardia esplicita (`_sourceReady` in JobManager) prima di permettere il prelievo, altrimenti un veicolo può "prelevare" qualcosa che non è ancora lì.
4. **Selezione container concorrente**: se due job possono scegliere lo stesso container prima che uno dei due lo rimuova fisicamente dallo yard, serve escludere esplicitamente gli id già "prenotati" da job non ancora completati (vedi `_pickExportContainer` in TranstainerManager).
5. **Verifica E2E**: build `index_local.html` (Leaflet/Geoman da `node_modules`, non da CDN), Playwright headless, teleport dei veicoli sulla loro `currentZone` per bypassare l'animazione e isolare la logica, controllo `console.error`/`pageerror`, poi cleanup totale dei file temporanei.

## Bug più importante trovato questa sessione (da tenere a mente)

`JobManager` confrontava l'arrivo di un veicolo SOLO con il centro geometrico della zona. Finché tutti i mezzi convergevano sullo stesso punto andava bene; appena si è introdotto il parcheggio "a slot" (per evitare sovrapposizioni), un mezzo regolarmente parcheggiato a 40-60m dal centro di una zona lunga 127m (`WAITING_CAMION`) veniva letto come "non ancora arrivato" per sempre → camion bloccati in `Servicing` a vita. Scoperto SOLO facendo girare il test nel browser, non dalla lettura del codice. Fix: `GeoManager.hasArrived()` unico, poligono-aware, usato sia da `TruckManager` che da `JobManager` (prima duplicato in due posti leggermente diversi).

## Stato attuale (2026-08-19)

### Fatto e mergiato in `main`
- Camion: niente più sovrapposizioni in piazzale/gate d'uscita (parcheggio a slot).
- Semoventi dispacciati appena il camion passa l'OCR (non più all'arrivo fisico), con guardia anti-corsa-critica.
- `GeoManager.hasArrived()` come unica fonte di verità per "sono arrivato a questa zona".
- **TranstainerManager**: logica completa di EXPORT (RS preleva da blocco piazzale → passa a Ralla → Ralla porta al transtainer) e IMPORT (transtainer carica Ralla → Ralla porta al blocco target → RS preleva e impila), cablata nell'UI (`window.transtainer`, due voci di menu, `update(dt)` nel game loop). Riusa le zone reali già esistenti (`LOADING_BC_CRANES`/`LOADING_AC_CRANES` come "moli" delle 2 gru di piazzale attualmente modellate). 9 test dedicati, tutti verdi.
- I **carriponte (quay crane, la gru che scarica/carica direttamente dalla nave)** sono stati esplicitamente rimandati su richiesta dell'utente — non ancora implementati, non c'è ancora nessun collegamento fisico/logico tra la banchina (`QUAY`) e il resto del terminal.

### In corso ORA (appena iniziato, non ancora committato)

Richiesta dell'utente: *"inizia a creare la logica di carico scarico nave, metti su mappa 4 trustainer, implementa la grafica per l'arrivo e partenza nave, con arrivo e partenza di contenitori da parco o che vanno a parco."*

Cioè:
1. Portare a **4** le unità Transtainer visibili sulla mappa (oggi la geometria reale tracciata supporta solo 2 corridoi gru — `LOADING_BC_CRANES` e `LOADING_AC_CRANES` — quindi il piano è renderizzare 4 icone posizionate lungo questi 2 corridoi reali, 2 per corridoio, senza inventare nuova geometria).
2. Logica di arrivo/partenza nave: `VesselManager` oggi ha solo dati (schedule, manifest, ETA/ETD) e nessuna posizione né movimento. Va aggiunta una posizione fisica sulla banchina (zona `QUAY`, un'unica striscia poligonale — servono punti di ormeggio interpolati lungo il suo bordo) e un ciclo di arrivo (da un punto "al largo") → ormeggio → lavorazione → partenza.
3. Collegare il manifest della nave (discharge/load) al `TranstainerManager` esistente: ogni container in `discharge` genera un job IMPORT (nave → piazzale), ogni container in `load` genera un job EXPORT (piazzale → nave) il cui completamento (arrivo alla banchina lato RTG) sblocca il "carico a bordo".
4. La gru di banchina (carroponte) resta NON animata come veicolo a sé — il suo lavoro va astratto con un timer (stesso pattern già usato per `RS_PICKING`/`DOCKING` in TranstainerManager), così si rispetta la richiesta di rimandare i carriponte come mezzo/animazione dedicati, pur avendo la logica di carico/scarico nave.

Non ancora scritto nessun file per questa parte: né `VesselOpsManager` (o estensione di `VesselManager`), né icona nave, né estensione a 4 unità in `TranstainerManager`. Il prossimo passo concreto è iniziare da lì.

## Comandi utili

```bash
npm test                    # suite completa, zero dipendenze
npm install playwright leaflet @geoman-io/leaflet-geoman-free --no-save   # SOLO per E2E temporaneo
npx serve -l 8899 .         # server statico locale per E2E
# poi SEMPRE: rm -rf node_modules index_local.html <script-e2e-temporanei>
```

## Convenzioni Git/PR

- `git fetch origin main -q && git checkout -q -B claude/analisi-progetto-bloccato-mc1a9a origin/main` prima di iniziare (le PR precedenti vengono mergiate quasi subito).
- Commit: messaggio tecnico in inglese, corpo esplicativo (perché, non solo cosa), termina con `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` + `Claude-Session: ...`.
- PR: draft, titolo e corpo in **italiano**, dettagliato, con sezione di verifica (cosa è stato provato e come), termina con `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Dopo l'apertura/aggiornamento di una PR: iscriversi agli eventi (`subscribe_pr_activity`) e programmare un check-in a ~60 minuti; alla notifica di merge, cancellare il check-in e risincronizzare il branch locale con `main`.
