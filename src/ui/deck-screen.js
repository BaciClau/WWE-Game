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

// --- SORTARE & PAGINARE COLECȚIE ---
// Implicit: cele mai tari carduri (OVR) primele, mereu la pornirea jocului (nepersistat, resetat la reload).
let collectionSort = { field: 'ovr', dir: 'desc' };
let collectionPage = 0;
const COLLECTION_PAGE_SIZE = 24;

function getCardOvr(c) {
    const s = getStats(c);
    return (s.pow || 0) + (s.tgh || 0) + (s.spd || 0) + (s.cha || 0);
}

function setCollectionSort(field) {
    if (collectionSort.field === field) {
        collectionSort.dir = collectionSort.dir === 'desc' ? 'asc' : 'desc';
    } else {
        collectionSort.field = field;
        collectionSort.dir = 'desc'; // implicit: cele mai tari/rare/nivel mare primele
    }
    collectionPage = 0;
    renderDeck();
}

function sortCollectionCards(cards) {
    const dirMul = collectionSort.dir === 'asc' ? 1 : -1;
    return [...cards].sort((a, b) => {
        let av, bv;
        if (collectionSort.field === 'rarity') {
            av = RARITIES.indexOf(getCardBase(a).rarity);
            bv = RARITIES.indexOf(getCardBase(b).rarity);
        } else if (collectionSort.field === 'level') {
            av = a.level || 0;
            bv = b.level || 0;
        } else {
            av = getCardOvr(a);
            bv = getCardOvr(b);
        }
        if (av !== bv) return (av - bv) * dirMul;
        // egalitate → departajare stabilă: OVR desc, apoi nume alfabetic
        const ovrA = getCardOvr(a), ovrB = getCardOvr(b);
        if (ovrA !== ovrB) return ovrB - ovrA;
        return getCardBase(a).name.localeCompare(getCardBase(b).name);
    });
}

function updateSortBarUI() {
    document.querySelectorAll('#collection-sort-bar .sort-btn').forEach(btn => {
        const isActive = btn.dataset.sort === collectionSort.field;
        btn.classList.toggle('active', isActive);
        const baseLabel = btn.dataset.sort.toUpperCase();
        btn.innerText = isActive ? `${baseLabel} ${collectionSort.dir === 'desc' ? '▼' : '▲'}` : baseLabel;
    });
}

function goCollectionPage(p) {
    collectionPage = p;
    renderDeck();
}

function renderPaginationControls(totalItems) {
    const bar = document.getElementById('collection-pagination');
    if (!bar) return;
    const totalPages = Math.max(1, Math.ceil(totalItems / COLLECTION_PAGE_SIZE));
    if (collectionPage >= totalPages) collectionPage = totalPages - 1;
    if (collectionPage < 0) collectionPage = 0;

    if (totalPages <= 1) { bar.innerHTML = ''; return; }
    bar.innerHTML = `
        <button class="page-btn" ${collectionPage === 0 ? 'disabled' : ''} onclick="goCollectionPage(${collectionPage - 1})">‹ PREV</button>
        <span class="page-indicator">PAGE ${collectionPage + 1} / ${totalPages}</span>
        <button class="page-btn" ${collectionPage === totalPages - 1 ? 'disabled' : ''} onclick="goCollectionPage(${collectionPage + 1})">NEXT ›</button>
    `;
}

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

            // --- COLECȚIE: restul cărților care nu sunt echipate în deck, sortate + paginate ---
            let collectionCards = player.inventory.filter(c => !activeDeckUIDs.includes(c.uid));
            collectionCards = sortCollectionCards(collectionCards);
            renderPaginationControls(collectionCards.length);
            updateSortBarUI();

            const pageStart = collectionPage * COLLECTION_PAGE_SIZE;
            const pageCards = collectionCards.slice(pageStart, pageStart + COLLECTION_PAGE_SIZE);

            pageCards.forEach(c => {
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
