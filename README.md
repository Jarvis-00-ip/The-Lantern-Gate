# The Lantern Gate ⚓

**The Lantern Gate** è un simulatore gestionale ad alta fedeltà del porto di Genova. Il progetto mira a replicare le complesse operazioni logistiche di un terminal portuale moderno, dalla gestione dello yard fino all'intermodalità.

## 🚀 Visione
Creare un'esperienza simulativa profonda che permetta di gestire un terminal container reale, affrontando sfide di ottimizzazione, tempistiche e gestione delle risorse.

## ✨ Features (MVP)
- **Logica Yard Manager**: Sistema di coordinate realistico (Bay, Row, Tier).
- **Gestione Container**: Classi dedicate con attributi specifici (Standard, Reefer, IMO).
- **Algoritmo di Penalty**: Calcolo dei movimenti necessari per accedere a container impilati (`calculateDiggingPenalty`).

## 🗺️ Roadmap

### Fase 1: Yard Manager Core (Attuale) 🟢
- [x] Struttura del progetto
- [x] Classi base (Container, Yard)
- [x] Sistema di coordinate
- [x] Calcolo penalty scavi (Digging)

### Fase 2: Visualizzazione & UI 🟡
- [ ] Dashboard operatori
- [ ] Visualizzazione a griglia dello yard (Top-down)
- [ ] Drag & drop per spostamento container

### Fase 3: Operazioni di Banchina 🔴
- [ ] Gru di banchina (Quay Cranes)
- [ ] Cicli di carico/scarico navi
- [ ] Scheduling navi

### Fase 4: Intermodalità 🔴
- [ ] Gate camion
- [ ] Terminal ferroviario
- [ ] Movimentazione orizzontale (Straddle Carriers/Terminal Tractors)

## 🛠️ Tecnologie
- **Core Logic**: Vanilla JavaScript (ES6+)
- **UI**: HTML5, CSS3 (Custom Design)
- **Test**: Custom test scripts

## 📂 Struttura Cartelle
- `/src/core`: Logica di business (No UI dependencies)
- `/src/ui`: Interfaccia utente (Leaflet Map, Control Panels)
- `/assets`: Risorse grafiche
- `/docs`: Documentazione tecnica e di design

---

## 📅 Aggiornamento Stato (29/01/2026)
Il progetto è evoluto da semplice gestore testuale a **Simulatore Geospaziale Completo**.

### 🔥 Nuove Implementazioni
1.  **Maps & Navigation Engine**:
    *   Integrazione **Leaflet.js** con mappa satellitare/OSM.
    *   Importazione rete stradale reale (OpenStreetMap) filtrata per uso portuale.
    *   **Pathfinding A***: I veicoli (Ralle/Truck) navigano autonomamente sulla rete stradale.

2.  **TOS Core (Terminal Operating System)**:
    *   `VesselManager`: Gestione schedule navi, ETA/ETD e Manifesti di carico/scarico.
    *   `JobManager`: Il "cervello" che crea missioni (Job) e le assegna ai veicoli disponibili.
    *   `TruckManager`: Gestione truck esterni, flusso Gate (OCR Pre-Gate -> Gate -> Piazzale).

3.  **Interfaccia Utente (UI Revamp)**:
    *   **Unified Menu**: Nuovo Burger Menu per accesso rapido a tutte le funzioni.
    *   **TOS Dashboard**: Cruscotto per monitorare navi attive e code di lavoro.
    *   **Fleet Manager**: Pannello controllo Ralle/Semoventi con visualizzazione stato in tempo reale.
    *   **Visualizzazione**: I veicoli mostrano graficamente se sono "carichi" (box colorato).

4.  **Logica Operativa**:
    *   Simulation Loop globale.
    *   Gestione stati complessi per i Camion (Inbound, OCR Scan, Gate Queue, Yard).

### ✅ Roadmap Aggiornata
- [x] **Fase 1: Yard Core** (Coordinate, Stacking)
- [x] **Fase 2: Geospatial & UI** (Mappa, Veicoli, Navigation)
- [~] **Fase 3: Ship Ops** (Inziata: VesselManager pronto, manca simulazione STS)
- [~] **Fase 4: Gate & Truck** (Iniziata: Logica Gate e OCR implementata)

---
**Nota per lo sviluppatore**: Il codice è stabile. Avviare `index.html` (via Live Server) per vedere la simulazione. Usa il Menu Burger -> "Spawn Truck" per testare il flusso gate.
