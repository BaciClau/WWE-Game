// Ordinea fixă a sloturilor din Active Deck, mereu de la stânga la dreapta:
// 4x SUPERSTAR (M), 1x DIVA (F), 1x SUPPORT (S) — indiferent dacă slotul e ocupat sau nu.
const DECK_SLOT_LAYOUT = [
    { type: 'M', label: 'SUPERSTAR', icon: '🤼' },
    { type: 'M', label: 'SUPERSTAR', icon: '🤼' },
    { type: 'M', label: 'SUPERSTAR', icon: '🤼' },
    { type: 'M', label: 'SUPERSTAR', icon: '🤼' },
    { type: 'F', label: 'DIVA', icon: '👑' },
    { type: 'S', label: 'SUPPORT', icon: '🛠️' }
];

function renderDeck() {
            if (!deckEditMode) autoEquipDeck();
            document.getElementById('active-deck-grid').innerHTML = "";
            document.getElementById('collection-grid').innerHTML = "";

            const deckSource = deckEditMode ? deckEditDraft : player.deck;
            const activeDeckUIDs = [...deckSource.M, ...deckSource.F, ...deckSource.S];

            if (deckEditMode) updateDeckSlotsInfo();

            // --- ACTIVE DECK: sloturi fixe, mereu în aceeași ordine ---
            const deckGrid = document.getElementById('active-deck-grid');
            let mSeen = 0;
            DECK_SLOT_LAYOUT.forEach(def => {
                const posInType = def.type === 'M' ? mSeen++ : 0;
                const uid = deckSource[def.type][posInType];
                const card = uid ? player.inventory.find(c => c.uid === uid) : null;

                if (card) {
                    let s = getStats(card);
                    let wrapper = document.createElement('div');
                    wrapper.className = 'deck-slot deck-slot-filled';
                    if (deckEditMode) {
                        wrapper.innerHTML = renderHTMLCard(s, false, '', 'deck-edit-in') + `<div class="card-slot-label">IN DECK (${def.type})</div>`;
                        wrapper.onclick = () => toggleDeckCard(card.uid);
                        wrapper.style.cursor = 'pointer';
                    } else {
                        let extra = tradeTarget === card.uid ? 'trade-target' : '';
                        wrapper.innerHTML = renderHTMLCard(s, true, '', extra);
                    }
                    deckGrid.appendChild(wrapper);
                } else {
                    let empty = document.createElement('div');
                    empty.className = 'deck-slot deck-slot-empty';
                    empty.innerHTML = `
                        <span class="deck-slot-icon">${def.icon}</span>
                        <span class="deck-slot-text">${def.label}</span>
                        <span class="deck-slot-sub">Empty slot</span>
                    `;
                    deckGrid.appendChild(empty);
                }
            });

            // --- COLECȚIE: restul cărților care nu sunt echipate în deck ---
            player.inventory.forEach(c => {
                const inDeck = activeDeckUIDs.includes(c.uid);
                if (inDeck) return;
                let s = getStats(c);

                if (deckEditMode) {
                    let extra = 'deck-edit-out';
                    const g = getCardBase(c).gender;
                    const slot = g === 'M' ? 'M' : g === 'F' ? 'F' : 'S';
                    const limit = slot === 'M' ? 4 : 1;
                    const slotFull = deckEditDraft[slot].length >= limit;
                    if (slotFull && g !== 'S') extra += ' deck-edit-full'; // lock doar M/F dacă slot plin

                    let wrapper = document.createElement('div');
                    wrapper.style.position = 'relative';
                    wrapper.innerHTML = renderHTMLCard(s, false, '', extra);
                    wrapper.onclick = () => toggleDeckCard(c.uid);
                    wrapper.style.cursor = 'pointer';
                    document.getElementById('collection-grid').appendChild(wrapper);
                } else {
                    let extra = '';
                    if (tradeTarget === c.uid) extra = 'trade-target';
                    else if (tradeSacrifices.includes(c.uid)) extra = 'trade-sacrifice';
                    let wrapper = document.createElement('div');
                    wrapper.innerHTML = renderHTMLCard(s, true, '', extra);
                    document.getElementById('collection-grid').appendChild(wrapper);
                }
            });
            if (!deckEditMode) updateTradeUI();
        }

        // --- MATCHMAKING: 4 opponents with varied difficulty ---
