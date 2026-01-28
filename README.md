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
- `/src/ui`: Interfaccia utente
- `/assets`: Risorse grafiche
- `/docs`: Documentazione tecnica e di design
