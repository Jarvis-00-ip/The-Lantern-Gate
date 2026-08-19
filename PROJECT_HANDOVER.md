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
5. **Id generati in serie**: MAI generare un id solo da `Date.now()` — due chiamate nello stesso millisecondo (due click rapidi, un loop di test stretto) collidono. Sempre un contatore di modulo in coda (`jobCounter`, `vesselCounter`...).
6. **Verifica E2E**: build `index_local.html` (Leaflet/Geoman da `node_modules`, non da CDN), Playwright headless, teleport dei veicoli sulla loro `currentZone` per bypassare l'animazione e isolare la logica, controllo `console.error`/`pageerror`, poi cleanup totale dei file temporanei.

## Come funziona tutto, in dettaglio

Questa sezione spiega la meccanica interna di ogni sottosistema, passo per passo — non solo "cosa c'è" ma "come si comporta a runtime". Utile per chi deve modificare o estendere la logica senza rileggere tutto il codice sorgente.

### 1. Il sistema di zone (`GeoManager.js`)

Ogni area del terminal è un oggetto `{ id, type, vertices, description? }` in un array statico `this.zones` nel costruttore — niente database, niente fetch, sono coordinate lat/lng tracciate a mano sulla mappa reale (poligoni con 4-10 vertici). `type` è usato da `FleetManager._isZoneAllowedForVehicle` per sapere quali mezzi possono entrare dove (es. i Reach Stacker non entrano in zone `GATE`).

Funzioni chiave, tutte pure (nessuno stato oltre `this.zones`):
- `getZoneCenter(zoneId)` — media aritmetica di tutti i vertici. Va bene come "punto di riferimento" ma NON come test di arrivo per zone lunghe (vedi sotto).
- `isInsideZone(point, zoneId)` → `_isPointInPolygon` — ray casting classico (conta quante volte una semiretta dal punto incrocia i bordi del poligono; dispari = dentro).
- `hasArrived(pos, zoneId, radius=20)` — **l'unica funzione che va usata per "il veicolo X è arrivato alla zona Y?"**. Prima controlla `isInsideZone` (vero test geometrico), e SOLO se fallisce ripiega su "a meno di `radius` metri dal centro" (utile per zone quasi puntiformi tipo i gate). Introdotta per consolidare due implementazioni quasi identiche che si erano diversificate silenziosamente (vedi il bug in fondo a questa sezione).
- `getParkingSlot(zoneId, slotIndex, slotCount)` — trova la coppia di vertici più lontana tra loro (l'asse lungo della zona), poi interpola un punto lungo quel segmento in base a `slotIndex/slotCount`, con un margine del 18% da ogni estremo (`INSET`) così i mezzi non si fermano sul bordo. Se il punto interpolato cade fuori dal poligono (capita con forme concave/oblique), lo tira verso il centro fino a 8 volte finché non rientra. Usato per: parcheggio camion/mezzi che condividono una zona, posizione fissa delle unità Transtainer lungo i corridoi gru, moli delle navi lungo la banchina `QUAY`.
- `getParkingGrid(zoneId, wanted, exitToward)` — griglia di punti (non un singolo asse) per zone che devono contenere DECINE di mezzi contemporaneamente (il deposito `DEPOT_RALLE`); sovracampiona una griglia lat/lng e tiene solo i punti dentro il poligono, poi li ordina per distanza da `exitToward` così i mezzi più vicini all'uscita vengono dispacciati per primi.
- `bearing(from, to)` — rotta bussola (gradi orari da nord) tra due punti, formula standard great-circle. Serve a orientare le navi (che non usano Leaflet per la rotazione, muovendosi in acqua aperta senza rete stradale). Esiste una copia quasi identica in `src/ui/vehicleIcons.js` per la UI (rotazione delle icone mezzi/camion) — duplicazione voluta: `core/` non deve importare da `ui/`, ed è una formula matematica stabile che non rischia di divergere.
- `_distanceMeters(p1, p2)` — haversine, usata ovunque per "quanto è lontano X da Y" (non prefissata volutamente come privata in senso stretto: è chiamata direttamente da `FleetManager`, `TranstainerManager`, `VesselOpsManager`).

**Il bug più insidioso della sessione**: `JobManager` aveva una propria copia del test di arrivo che confrontava SOLO la distanza dal centro geometrico. Finché tutti i mezzi convergevano sullo stesso punto andava bene; appena si è introdotto il parcheggio "a slot" (per evitare sovrapposizioni), un mezzo regolarmente parcheggiato a 40-60m dal centro di una zona lunga 127m (`WAITING_CAMION`) veniva letto come "non ancora arrivato" per sempre → job bloccato in `ASSIGNED`/`Servicing` a vita, invisibile leggendo il codice, evidentissimo facendo girare 3 camion nel browser (si vedevano fermi, il job no). Fix: consolidato in `GeoManager.hasArrived()`, sia `TruckManager._hasArrived` che `JobManager._hasArrivedAtZone` ora delegano lì.

### 2. Modello veicolo e flotta (`FleetManager.js`)

`Vehicle` è un oggetto semplice: `id, type (Ralla|Reach Stacker|Straddle Carrier), status, currentZone, deployedZone (casa), position {lat,lng,rotation}, depotSlot, homeSpot, carriedContainer, currentJobId`. Non c'è una macchina a stati sul veicolo stesso — lo stato "cosa sto facendo" vive nel `status` (stringa libera: `'Idle'`, `'Job Assigned'`, `'Operating (Pick)'`, `'Transporting'`, `'Active'`...) e nel manager che lo sta usando (JobManager o TranstainerManager), MAI in FleetManager stesso, che fa solo da anagrafica + query.

`findNearestVehicle(type, targetPos, geoManager)` — filtra i mezzi `Idle` o `Active`-senza-job del tipo richiesto, poi sceglie il più vicino a `targetPos` per distanza haversine, con una piccola penalità (`depotSlot * 3` metri) per chi è parcheggiato più indietro nel deposito, così a parità di distanza reale vince chi è più vicino all'uscita (evita che un mezzo "in fondo" debba infilarsi tra gli altri).

`seedInitialPositions(geoManager)` — chiamata una volta all'avvio, piazza tutta la flotta in una griglia ordinata dentro `DEPOT_RALLE` (via `getParkingGrid`), assegnando `depotSlot` in ordine di vicinanza all'uscita. Senza questo tutti i veicoli nascono a `{x:0,y:0}` e il renderer li salta (mappa vuota all'avvio).

`recallVehicle(id)` — riporta un mezzo al proprio `homeSpot` nel deposito (non un punto casuale: lo stesso posto sempre, così il deposito resta ordinato dopo cicli ripetuti di deploy/recall).

### 3. Ciclo di vita di un camion (`TruckManager.js`)

Il percorso è fisso, definito una volta in `TRUCK_LEGS` (array ordinato di `{from, to, label}`, usato anche dall'editor percorsi per disegnare manualmente ogni tratta):

```
SPAWN (Casello Genova Ovest)
  → CUSTOMS_IN (GATE_IN)
  → OCR_GATE                          [oppure GATE_OOG se fuori sagoma]
  → TRUCK_LANES_IN (3 corsie)
  → WAITING_CAMION (piazzale — qui avviene carico/scarico)
  → TRUCK_LANES_OUT (2 corsie)
  → CUSTOMS_OUT (GATE_OUT)
  → DESPAWN (Uscita Genova Ovest)
```

Stati (`TruckStatus`): `Inbound → Customs In → OCR Scan → Gate Queue → Gate Check → To Yard → Servicing → Exiting → Customs Out → Departing → Departed`.

Il punto cruciale è **quando nasce il job di piazzale**: `handleOCRArrival(truck)` scatta appena il camion passa l'OCR (non quando arriva fisicamente al piazzale) — dentro un `setTimeout` che simula il tempo di scansione, chiama `_dispatchYardJob(truck)`, che crea subito un `JobManager.createJob('TRUCK_EXPORT'|'TRUCK_IMPORT', containerId, 'WAITING_CAMION', 'YARD')` e lo assegna al mezzo più vicino. Questo fa partire il semovente/ralla MOLTO prima che il camion sia effettivamente parcheggiato — da cui la guardia `_sourceReady` in JobManager (vedi sezione 4) per evitare che il mezzo "prelevi" un container ancora fisicamente sul camion in coda.

`handleGateArrival(truck)` gestisce solo la transizione fisica del camion stesso (arrivo alle corsie, poi `_setTarget(truck, 'WAITING_CAMION')`), non tocca più il job (spostato a monte in `handleOCRArrival`).

Ogni camion condivide con gli altri sulla stessa tratta la STESSA linea disegnata (`DefaultTruckRoutes`/route editor) — per questo il rendering (in `app.js`, non in TruckManager) assegna ad ognuno un posto proprio (`getParkingSlot`) dentro la zona finale invece di farli convergere tutti sullo stesso punto: la tratta disegnata li porta vicino, l'ultimo tratto (fino al proprio slot) si percorre solo se il punto disegnato non è già a meno di 15m dal proprio posto assegnato.

### 4. `JobManager` — job a un solo veicolo

Usato per i job dei camion (`TRUCK_EXPORT`/`TRUCK_IMPORT`). Un `Job` ha `status`: `PENDING → ASSIGNED → 'PICKING_UP' → IN_PROGRESS → 'DROPPING_OFF' → COMPLETED` (le due fasi intermedie sono stringhe libere non nell'enum `JobStatus`, usate solo per marcare "sto eseguendo il timer di 5s", non serve altro).

`update(dt)` ad ogni frame:
1. `assignPendingJobs()` — per ogni job `PENDING`, cerca il Reach Stacker libero più vicino alla `sourceZone` (se `sourceZone`/`targetZone` è la stringa astratta `'YARD'`, la risolve ora in un blocco reale a caso tra `BLOCK_A..D`). Se lo trova, `status = ASSIGNED`, il veicolo riceve `currentJobId` e `currentZone = sourceZone` (il renderer lo farà muovere lì da solo).
2. Per ogni job `ASSIGNED`: appena `_hasArrivedAtZone(vehicle.position, sourceZone)` **E** `_sourceReady(job)` sono veri, scatta `_performPickup` dopo un timer fisso di 5s (`status='PICKING_UP'` nel frattempo). `_sourceReady` è `true` sempre TRANNE per `TRUCK_EXPORT`, dove richiede che il camion con quel `containerId` sia effettivamente `status==='Servicing'` (fisicamente parcheggiato) — la guardia anti-corsa-critica descritta sopra.
3. `_performPickup` sposta il container dalla fonte (camion o yard astrattamente) al veicolo (`vehicle.carriedContainer`), poi `status = IN_PROGRESS`, `vehicle.currentZone = targetZone`.
4. Per ogni job `IN_PROGRESS`: appena arrivato al target, `_performDropoff` dopo altri 5s deposita il container (nello yard reale via `yardManager.addContainer`, o sul camion in attesa se `TRUCK_IMPORT`), poi chiama `completeJob`.
5. `completeJob` libera il veicolo (`carriedContainer=null`, `currentJobId=null`) e lo rimanda alla sua `deployedZone` se diversa dalla zona corrente.

### 5. `TranstainerManager` — job a due veicoli (RTG di piazzale)

Introdotto perché `JobManager` presume un solo veicolo dall'inizio alla fine; qui servono un Reach Stacker E una Ralla in sequenza, con un vero e proprio hand-off fisico del container tra i due. `TranstainerJob` ha una `phase` (enum `TranstainerPhase`, non un semplice status a 4 valori) che avanza per switch dentro `_updateExport`/`_updateImport`, chiamate da `update(dt)` per ogni job non `COMPLETED`.

**EXPORT** (container dal piazzale verso il transtainer, pronto per un futuro carico su nave):
```
PENDING            → trova un Reach Stacker libero vicino al blocco sorgente, lo aggancia
RS_TO_SOURCE       → aspetta hasArrived(rs, sourceBlock); poi timer pickTimeMs (default 5s):
                     rimuove il container dallo yard (yardManager.removeContainer con bay/row
                     salvati SUL JOB, non sull'istanza del manager — vedi bug sotto), lo mette
                     "in mano" al RS (rs.carriedContainer)
RS_PICKING         → (solo attesa del timer sopra)
AWAIT_RALLA        → trova una Ralla libera vicino al blocco sorgente, la aggancia
RALLA_TO_SOURCE    → aspetta hasArrived(ralla, sourceBlock); poi timer transferTimeMs (3s):
                     il RS rilascia il container (torna al deposito), la Ralla lo prende
                     (ralla.carriedContainer), currentZone → dockZone dell'unità assegnata
TRANSFER_TO_RALLA  → (solo attesa)
RALLA_TO_DOCK      → aspetta hasArrived(ralla, unit.dockZone); poi timer dockTimeMs (5s):
                     la Ralla rilascia il container, unit.exportedCount++
DOCKING            → (solo attesa)
COMPLETED
```

**IMPORT** (il transtainer consegna un container al piazzale, es. sbarcato da nave):
```
PENDING                    → trova una Ralla libera vicino al dockZone dell'unità, la aggancia
RALLA_TO_DOCK              → aspetta hasArrived(ralla, dockZone); poi timer dockTimeMs:
                             la Ralla "carica" (ralla.carriedContainer), unit.importedCount++,
                             currentZone → targetBlock
LOADING_FROM_TRANSTAINER   → (solo attesa)
RALLA_TO_TARGET            → aspetta hasArrived(ralla, targetBlock); poi trova un Reach
                             Stacker libero vicino al blocco, lo aggancia
RS_TO_TARGET               → aspetta hasArrived(rs, targetBlock); poi timer transferTimeMs:
                             la Ralla rilascia (torna al deposito), il RS prende il container
TRANSFER_TO_RS             → poi timer stackTimeMs (3s): yardManager.addContainer in una
                             bay/row casuale del blocco, il RS rilascia (torna al deposito)
RS_STACKING                → (solo attesa)
COMPLETED
```

**Le 4 unità Transtainer**: la geometria reale tracciata ha solo 2 corridoi gru (`LOADING_BC_CRANES`/`BLOCK_BC_CRANES` e `LOADING_AC_CRANES`/`BLOCK_AC_CRANES`), quindi 2 unità condividono ciascun corridoio a punti fissi distinti (`slot`/`slotCount` risolti in `position` reale via `getParkingSlot` nel costruttore). `_nearestUnit(zoneId)` sceglie prima il corridoio (`dockZone`) più vicino alla zona data, poi fa **round-robin** (contatore `this._roundRobin[dockZone]`) fra le unità che condividono quel corridoio — senza questo, a parità di distanza dal centro dello stesso `dockZone`, una delle due unità gemelle non verrebbe MAI scelta (il confronto `<` nel `reduce` non fa mai vincere il secondo a parità).

**Bug auto-scoperti durante l'implementazione** (prima di qualunque test, per revisione del codice): (1) bay/row del container scelto per l'export erano salvati sull'ISTANZA del manager invece che sul job — un secondo `requestExport()` prima che scattasse il timer del primo ne sovrascriveva silenziosamente il bersaglio; spostati su `job.sourceBay/sourceRow`. (2) Un container resta fisicamente nello yard finché il timer di prelievo non scatta, quindi due `requestExport()` sullo stesso blocco potevano scegliere lo stesso container prima che il primo lo rimuovesse davvero — `_pickExportContainer` ora esclude gli id già presi da job export non ancora `COMPLETED`.

### 6. `VesselOpsManager` — arrivo/partenza nave e collegamento al Transtainer

A differenza di tutti gli altri veicoli, le navi NON usano `currentZone` + il renderer stradale: navigano in acqua aperta, quindi `VesselOpsManager` calcola da sé `vessel.position` ad ogni tick (interpolazione lineare in `_moveToward`, non Leaflet/pathfinding). `renderVessels()` in app.js si limita a rispecchiare quella posizione su un marker — nessuna animazione propria lato renderer.

Geometria: 4 moli fissi lungo la banchina (`getParkingSlot('QUAY', i, 4)`), un singolo punto "al largo" condiviso (`seaAnchor`) calcolato estendendo il segmento che va dal centro del deposito (`DEPOT_RALLE`, come proxy del "lato piazzale") al centro della banchina, per altri 350m OLTRE la banchina stessa (`_extendPoint`) — un modo robusto per puntare "verso il mare aperto" senza dover indovinare quale dei 4 vertici della banchina è il lato acqua.

Ciclo per nave (stato salvato in `VesselCall.status` + stato di runtime privato in `this._state` per-nave, keyed by `vessel.id`):
```
INBOUND      → in attesa che new Date() >= vessel.eta E che un molo sia libero (this.berths).
               Appena entrambi veri: molo assegnato, vessel.position = seaAnchor, → APPROACHING
APPROACHING  → _moveToward(vessel, berth.position, dt) ogni tick (velocità this.speedMps, ~4 m/s
               = 7.8 nodi). Appena arrivata: vesselManager.berthVessel() (status=BERTHED,
               diventa activeVessel), state.berthedAt = now
BERTHED      → _work(vessel, state, dt): lavora il manifest UNA voce alla volta, discharge
               prima di load (vedi sotto)
DEPARTING    → _moveToward(vessel, seaAnchor, dt); arrivata: status=DEPARTED, molo liberato,
               stato di runtime cancellato da this._state
```

`_work` — il cuore del collegamento col Transtainer. Una sola "gru banchina" astratta per nave: `state.craneBusyUntil` blocca QUALSIASI progresso (sia discharge che load) finché non scade, così i sollevamenti non si sovrappongono mai per la stessa nave:
- **Discharge** (item `state.dischargeIndex`): appena non c'è un job in corso, chiama `transtainerManager.requestImport(containerId, targetBlock)` (blocco a rotazione tra `YARD_BLOCKS`) e ARMA SUBITO `craneBusyUntil = now + craneCycleMs` — la gru "solleva" il container dalla nave in un tempo fisso, indipendentemente da quanto ci metterà poi la Ralla/RS a portarlo davvero a destinazione (quel lavoro prosegue per conto suo, pilotato da `rtg.update()`). Allo scadere del timer, `dischargeIndex++`.
- **Load** (item `state.loadIndex`): chiama `transtainerManager.requestExport(null)` (qualunque blocco con scorte) e stavolta ASPETTA che quel job raggiunga `phase === 'COMPLETED'` (il container deve essere fisicamente arrivato al molo RTG) PRIMA di armare `craneBusyUntil` — non si può caricare a bordo qualcosa che non è ancora arrivato in banchina. Se `requestExport` restituisce `null` (yard vuoto), salta quella voce (`loadIndex++`) invece di bloccarsi in eterno.
- Manifest esaurito: appena `now - state.berthedAt > minBerthMs`, `status = DEPARTING`.

Nota bene: `vessel.manifest.discharge`/`.load` sono gli array ORIGINALI passati a `requestArrival` e NON vengono mai accorciati — il progresso reale vive solo in `state.dischargeIndex`/`loadIndex` (privato del manager). Chi vuole sapere "quanto manca" deve leggere lo stato del manager, non la lunghezza del manifest (errore fatto — e corretto — proprio in uno script di verifica E2E di questa sessione, vedi sezione test).

`requestArrival(name)` — punto d'ingresso pubblico (usato dal menu "🚢 Nave: Arrivo"): crea la nave via `vesselManager.scheduleVessel` (eta=1s, così non è istantanea), genera un manifest finto (2-4 discharge + 2-4 load, id tipo `${vessel.id}-D0`, `${vessel.id}-L0`).

**Bug auto-scoperto durante i test**: `VesselManager.scheduleVessel` generava l'id nave da solo `Date.now()` — due navi create nello stesso millisecondo (successo reale nei test, dove i tick sono rapidi) collidevano sullo stesso id string; siccome `VesselOpsManager._state` è una Map indicizzata per `vessel.id`, due navi con lo stesso id condividevano LO STESSO oggetto di stato runtime (stesso molo, stesso indice manifest, caos totale). Fix: contatore monotono `vesselCounter` in coda all'id (stesso pattern di `TranstainerManager.jobCounter`).

### 7. Rendering / game loop (`src/ui/app.js`)

Un solo `requestAnimationFrame` loop (`gameLoop`) chiama, in ordine, `update(dt)` di ogni manager e poi le funzioni di rendering:
```js
truckManager.update(dt); jobManager.update(dt);
transtainerManager.update(dt); vesselOpsManager.update(dt);
renderTrucks(); renderVehicles(); renderVessels();
```
I manager NON toccano mai Leaflet direttamente — cambiano solo dati (`position`, `currentZone`, `status`, `carriedContainer`); il rendering legge quei dati ogni frame e li traduce in marker.

- **`renderVehicles()`** (usata da flotta Ralla/Reach Stacker, generica — non serve toccarla per nuovi tipi di job): per ogni veicolo con `currentZone`, calcola un obiettivo (`homeSpot` se nel deposito, `getParkingSlot` se condivide la zona con altri mezzi nello stesso frame — mappa `zoneOccupants` ricalcolata ogni frame —, altrimenti il centro zona), e se il marker non è già "in cammino" (`marker.isFollowingPath`) verso quell'obiettivo, chiama `executeMove`. `executeMove` prova il pathfinding stradale (`pathFinder.findPath`); se trova un percorso usa `animatePath` (una sequenza di tratte, ciascuna animata con `animateMarker`); altrimenti riga diretta rossa tratteggiata come fallback visivo + `animateMarker` diretto. **Importante**: `fleetManager.updateVehiclePosition` (che aggiorna `vehicle.position`, il dato che i manager leggono per `hasArrived`) viene chiamato SOLO al termine dell'INTERO percorso (`animatePath`'s onComplete sull'ultimo tratto) — durante l'animazione il marker si muove visivamente ma `vehicle.position` resta fermo al punto di partenza. Questo è per design (evita scritture continue), ma significa che un job può restare "in attesa di arrivo" per l'intera durata reale del tragitto stradale (anche 30-90s su percorsi lunghi) — normale, non un bug, ma va tenuto a mente quando si verificano tempi in un test E2E reale (vedi sezione test).
- **`renderTrucks()`** — stessa idea ma per i camion, con l'aggiunta della logica "salta l'ultimo tratto se la linea disegnata finisce già entro 15m dal MIO slot".
- **`renderVessels()`** — molto più semplice: nessun pathfinding, nessuna animazione propria. `VesselOpsManager` ha già scritto `vessel.position` (con `rotation` calcolata via `geoManager.bearing`) per intero ad ogni tick — il renderer si limita a `marker.setLatLng(...)` e a rigenerare l'icona quando cambia fase/heading.
- **`renderTranstainerUnits()`** — chiamata UNA SOLA VOLTA all'avvio (le gru sono ferme): disegna 4 marker 🏗️ a `unit.position`, con un tooltip aggiornato ogni 2s (non ad ogni frame — non serve, e risparmia lavoro) con `exportedCount`/`importedCount` correnti.
- **Icone** (`vehicleIcons.js`): SVG generati a runtime come stringa HTML dentro `L.divIcon`, non file immagine. `wrap(svg, width, heading, height)` avvolge l'SVG in un `<div class="veh-rot">` con `transform: rotate(...)`, così ruotare un'icona è un cambio di stile CSS (`setMarkerHeading`), non una ricreazione del DOM. Ogni tipo di mezzo ha la propria funzione (`truckIcon`, `rallaIcon`, `reachStackerIcon`, `vesselIcon`); `fleetIcon(type, opts)` sceglie quella giusta in base a `vehicle.type`.

### 8. Come si verifica tutto (tecnica dei test)

Due livelli, sempre entrambi prima di dichiarare una feature finita:

**A. `npm test` (Node, zero dipendenze, veloce)** — ogni file in `test/*.test.js` istanzia i manager direttamente (niente Leaflet, niente DOM: `globalThis.window = globalThis` in `test/run.js` per gli stub browser-globals che alcuni manager si aspettano). Per far avanzare un job/nave senza aspettare il vero tempo di viaggio su strada, si **teleporta** il veicolo: ad ogni tick del test si scrive direttamente `vehicle.position = geoManager.getZoneCenter(vehicle.currentZone)` per ogni mezzo agganciato a un job, POI si chiama `manager.update(dt)`. Questo isola la macchina a stati dal renderer/pathfinding — esattamente il tipo di bug (vedi sezione 6) che si scopre SOLO se non si teleporta e si aspetta il tempo reale.
  - Attenzione se un test coinvolge PIÙ manager collegati (es. `VesselOpsManager` che dipende da `TranstainerManager`): vanno chiamati `update(dt)` di ENTRAMBI ad ogni tick, esattamente come fa il game loop reale — dimenticare `rtg.update()` e chiamare solo `ops.update()` fa sembrare tutto bloccato per sempre (successo reale in questa sessione, corretto prima di committare).
  - I timer interni (`pickTimeMs`, `craneCycleMs`, `minBerthMs`...) sono proprietà pubbliche pensate per essere accorciate nei test (`rtg.pickTimeMs = 5`), non hardcoded.

**B. Playwright headless (Chromium), contro l'app vera** — installato temporaneamente (`npm install playwright leaflet @geoman-io/leaflet-geoman-free --no-save`), con un `index_local.html` di comodo che punta a Leaflet/Geoman in `node_modules` invece che alla CDN (bloccata dalla policy di rete di questo sandbox — errori `ERR_TUNNEL_CONNECTION_FAILED`/`arcgisonline` nei log sono attesi e vanno filtrati, non sono bug del codice). Serve `npx serve -l 8899 .` in background, poi uno script `.mjs` con `chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })`.
  - Per provare la CORRETTEZZA end-to-end (l'intero ciclo arriva davvero a completamento, i contatori tornano giusti), si usa la STESSA tecnica di teleport di sopra ma dentro `page.evaluate()` — non ha senso aspettare minuti di pathfinding reale per verificare la logica, che i 122 test Node già coprono a fondo.
  - Per provare che il RENDERING vero funzioni (marker creati, icone che ruotano, nessun errore console) si fa una passata SEPARATA e BREVE (pochi secondi) sotto `requestAnimationFrame` reale, senza teleport, senza aspettarsi che finisca — solo per controllare che non esploda nulla e che i marker appaiano nel DOM.
  - Sempre, alla fine: `pkill -f "serve -l 8899"`, `rm -rf node_modules index_local.html *.tmp.mjs` — mai lasciare questi file/processi nella repo o in background.

*(Il bug dell'arrivo-solo-al-centro-zona, il più insidioso della sessione, è descritto per esteso nella sezione 1 qui sopra.)*

## Stato attuale (2026-08-19)

### Fatto e mergiato in `main`
- Camion: niente più sovrapposizioni in piazzale/gate d'uscita (parcheggio a slot).
- Semoventi dispacciati appena il camion passa l'OCR (non più all'arrivo fisico), con guardia anti-corsa-critica.
- `GeoManager.hasArrived()` come unica fonte di verità per "sono arrivato a questa zona".
- **TranstainerManager**: logica completa di EXPORT (RS preleva da blocco piazzale → passa a Ralla → Ralla porta al transtainer) e IMPORT (transtainer carica Ralla → Ralla porta al blocco target → RS preleva e impila), cablata nell'UI (`window.transtainer`, due voci di menu, `update(dt)` nel game loop). Ora **4 unità** (`RTG-BC-1/2`, `RTG-AC-1/2`), 2 per ciascuno dei 2 corridoi gru reali (`LOADING_BC_CRANES`/`LOADING_AC_CRANES`), posizionate a punti fissi distinti lungo il corridoio via `GeoManager.getParkingSlot`; `_nearestUnit()` sceglie il corridoio più vicino e fa round-robin fra le due unità che lo condividono, così vengono usate entrambe invece che una sola vincere sempre il pareggio di distanza. Renderizzate come icone 🏗️ statiche (`renderTranstainerUnits()` in app.js, disegnate una sola volta) con tooltip che mostra i contatori export/import, aggiornato ogni 2s.
- **VesselOpsManager** (nuovo, `src/core/VesselOpsManager.js`): arrivo/partenza fisica delle navi e collegamento del manifest al Transtainer. 4 moli (`getParkingSlot('QUAY', i, 4)`), un punto "al largo" condiviso calcolato estendendo il segmento centro-yard→centro-banchina oltre la banchina (`_extendPoint`). Ciclo: `INBOUND` (in attesa di orario/molo libero) → `APPROACHING` (naviga verso il molo, movimento a interpolazione lineare gestito DAL manager stesso, non dal renderer — le navi non usano la rete stradale) → `BERTHED` (lavora il manifest: ogni discharge genera un job IMPORT sul Transtainer, ogni load un job EXPORT; una sola "gru banchina" astratta per nave, un timer `craneCycleMs` per sollevamento — nessun mezzo/animazione dedicata, come richiesto) → `DEPARTING` → `DEPARTED`. Icona nave (`vesselIcon()` in vehicleIcons.js) con colore del contorno che riflette la fase. Wired: `window.vesselOps`, `vesselOpsManager.update(dt)` nel game loop, `renderVessels()`, voce di menu "🚢 Nave: Arrivo".
- I **carriponte (quay crane) come mezzo animato** restano fuori scope come richiesto — il loro lavoro è astratto con un timer, non c'è nessun veicolo/icona dedicata per loro.
- Bug trovato e corretto durante l'implementazione: `VesselManager.scheduleVessel` generava l'id nave da solo `Date.now()` — due navi schedulate nello stesso millisecondo (due click rapidi sul menu, o un loop di test stretto) collidevano sullo stesso id, con stato condiviso e caos (stesso molo assegnato a entrambe). Fix: contatore monotono in coda all'id, stesso pattern già usato da `TranstainerManager.jobCounter`.
- 13 nuovi test (`test/vesselOps.test.js`, 122 totali): schedulazione, ormeggio, moli distinti per navi concorrenti, scarico verso il blocco giusto, carico di un container reale prelevato dallo yard, nessun blocco se non c'è nulla da caricare.

### Prossimi passi possibili
- Interfaccia/lista multi-nave nel TOS Dashboard (oggi mostra solo `vesselManager.activeVessel`, l'ultima nave attraccata — con più moli occupati contemporaneamente si perde visibilità sulle altre).
- Persistenza dei nuovi manager in `StorageManager` (oggi solo strade/percorsi camion sono salvati).
- Quay crane come mezzo animato vero e proprio, quando si deciderà di affrontarlo.

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
