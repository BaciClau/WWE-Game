function renderDeck() {
            if (!deckEditMode) autoEquipDeck();
            document.getElementById('active-deck-grid').innerHTML = "";
            document.getElementById('collection-grid').innerHTML = "";

            const activeDeckUIDs = deckEditMode
                ? [...deckEditDraft.M, ...deckEditDraft.F, ...deckEditDraft.S]
                : [...player.deck.M, ...player.deck.F, ...player.deck.S];

            if (deckEditMode) updateDeckSlotsInfo();

            player.inventory.forEach(c => {
                let s = getStats(c);
                const inDeck = activeDeckUIDs.includes(c.uid);

                if (deckEditMode) {
                    // În edit mode, toate cărțile sunt în colecție dar marcăm ce e în deck
                    let extra = inDeck ? 'deck-edit-in' : 'deck-edit-out';
                    const g = getCardBase(c).gender;
                    const slot = g === 'M' ? 'M' : g === 'F' ? 'F' : 'S';
                    const limit = slot === 'M' ? 4 : 1;
                    const slotFull = deckEditDraft[slot].length >= limit && !inDeck;
                    if (slotFull && g !== 'S') extra += ' deck-edit-full'; // lock doar M/F dacă slot plin

                    // Adaugă eticheta de slot
                    let slotLabel = inDeck ? `IN DECK (${slot})` : '';

                    let wrapper = document.createElement('div');
                    wrapper.style.position = 'relative';
                    wrapper.innerHTML = renderHTMLCard(s, false, '', extra);
                    if (slotLabel) wrapper.innerHTML += `<div class="card-slot-label">${slotLabel}</div>`;
                    wrapper.onclick = () => toggleDeckCard(c.uid);
                    wrapper.style.cursor = 'pointer';

                    if (inDeck) {
                        document.getElementById('active-deck-grid').appendChild(wrapper);
                    } else {
                        document.getElementById('collection-grid').appendChild(wrapper);
                    }
                } else {
                    // Modul normal — trade
                    if (inDeck) {
                        let extra = tradeTarget === c.uid ? 'trade-target' : '';
                        document.getElementById('active-deck-grid').innerHTML += renderHTMLCard(s, true, '', extra);
                    } else {
                        let extra = '';
                        if (tradeTarget === c.uid) extra = 'trade-target';
                        else if (tradeSacrifices.includes(c.uid)) extra = 'trade-sacrifice';
                        let wrapper = document.createElement('div');
                        wrapper.innerHTML = renderHTMLCard(s, true, '', extra);
                        document.getElementById('collection-grid').appendChild(wrapper);
                    }
                }
            });
            if (!deckEditMode) updateTradeUI();
        }

        // --- MATCHMAKING: 4 opponents with varied difficulty ---
