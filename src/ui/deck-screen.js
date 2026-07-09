// Ordinea fixă a sloturilor din Active Deck, mereu de la stânga la dreapta:
// 4x SUPERSTAR (M), 2x DIVA (F), 1x SUPPORT (S) — indiferent dacă slotul e ocupat sau nu.
const DECK_SLOT_LAYOUT = [
    { type: 'M', label: 'SUPERSTAR', icon: '🤼' },
    { type: 'M', label: 'SUPERSTAR', icon: '🤼' },
    { type: 'M', label: 'SUPERSTAR', icon: '🤼' },
    { type: 'M', label: 'SUPERSTAR', icon: '🤼' },
    { type: 'F', label: 'DIVA', icon: '👑' },
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
            let mSeen = 0, fSeen = 0;
            DECK_SLOT_LAYOUT.forEach(def => {
                const posInType = def.type === 'M' ? mSeen++ : def.type === 'F' ? fSeen++ : 0;
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
                        wrapper.innerHTML = renderHTMLCard(s, true, '');
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
                    const limit = slot === 'M' ? 4 : slot === 'F' ? 2 : 1;
                    const slotFull = deckEditDraft[slot].length >= limit;
                    if (slotFull && g !== 'S') extra += ' deck-edit-full'; // lock doar M/F dacă slot plin

                    let wrapper = document.createElement('div');
                    wrapper.style.position = 'relative';
                    wrapper.innerHTML = renderHTMLCard(s, false, '', extra);
                    wrapper.onclick = () => toggleDeckCard(c.uid);
                    wrapper.style.cursor = 'pointer';
                    document.getElementById('collection-grid').appendChild(wrapper);
                } else {
                    let wrapper = document.createElement('div');
                    wrapper.innerHTML = renderHTMLCard(s, true, '');
                    document.getElementById('collection-grid').appendChild(wrapper);
                }
            });
        }

        // --- CARD LIST (MY CARDS) — browse-one-at-a-time viewer, no deck editing here.
        // Deck editing lives only in deck-edit-screen, opened from the Exhibition button. ---
        let cardListIndex = 0;
        let cardListFilter = null; // null = "NONE", else a rarity name, or 'Support'
        const CARD_LIST_FILTERS = [null, 'Common', 'Uncommon', 'Rare', 'SuperRare', 'UltraRare', 'Epic', 'Legendary', 'Survivor', 'Support'];
        const CARD_LIST_RARITY_SWATCHES = [
            ['Survivor', 'SURVIVOR', '#000000'],
            ['Legendary', 'LEGENDARY', '#ffcc00'],
            ['Epic', 'EPIC', '#9b59b6'],
            ['UltraRare', 'ULTRA RARE', '#7d3cff'],
            ['SuperRare', 'SUPER RARE', '#3498db'],
            ['Rare', 'RARE', '#00bcd4'],
            ['Uncommon', 'UNCOMMON', '#2ecc71'],
            ['Common', 'COMMON', '#ffffff'],
            ['Support', 'SUPPORT', '#e74c3c'],
        ];

        function getCardListCards() {
            let cards = [...player.inventory];
            if (cardListFilter === 'Support') cards = cards.filter(c => getCardBase(c).gender === 'S');
            else if (cardListFilter) cards = cards.filter(c => getCardBase(c).rarity === cardListFilter && getCardBase(c).gender !== 'S');
            return sortCollectionCards(cards);
        }

        function getCurrentCardListCard() {
            return getCardListCards()[cardListIndex] || null;
        }

        function cycleCardListSort() {
            const fields = ['ovr', 'rarity', 'level'];
            const i = fields.indexOf(collectionSort.field);
            collectionSort.field = fields[(i + 1) % fields.length];
            collectionSort.dir = 'desc';
            cardListIndex = 0;
            renderCardList();
        }

        function cycleCardListFilter() {
            const i = CARD_LIST_FILTERS.indexOf(cardListFilter);
            cardListFilter = CARD_LIST_FILTERS[(i + 1) % CARD_LIST_FILTERS.length];
            cardListIndex = 0;
            renderCardList();
        }

        function cardListNav(dir) {
            const cards = getCardListCards();
            cardListIndex = Math.max(0, Math.min(cards.length - 1, cardListIndex + dir));
            renderCardList();
        }

        function renderCardList() {
            const cards = getCardListCards();
            if (cardListIndex >= cards.length) cardListIndex = Math.max(0, cards.length - 1);

            const focusWrap = document.getElementById('cl-focus-wrap');
            focusWrap.innerHTML = cards.length
                ? renderHTMLCard(getStats(cards[cardListIndex]))
                : '<div style="color:#aaa; font-family:Arial; padding:40px; text-align:center;">No cards match this filter.</div>';

            const sortBtn = document.getElementById('cl-sort-btn');
            if (sortBtn) sortBtn.innerText = `SORT BY ${collectionSort.field === 'ovr' ? 'RATING' : collectionSort.field.toUpperCase()}`;
            const filterBtn = document.getElementById('cl-filter-btn');
            if (filterBtn) filterBtn.innerText = `FILTER BY ${cardListFilter ? cardListFilter.toUpperCase() : 'NONE'}`;

            const upBtn = document.getElementById('cl-nav-up');
            const downBtn = document.getElementById('cl-nav-down');
            if (upBtn) upBtn.disabled = cardListIndex <= 0;
            if (downBtn) downBtn.disabled = cardListIndex >= cards.length - 1;

            const counts = {};
            player.inventory.forEach(c => {
                const base = getCardBase(c);
                const key = base.gender === 'S' ? 'Support' : base.rarity;
                counts[key] = (counts[key] || 0) + 1;
            });
            const totalsEl = document.getElementById('cl-totals');
            if (totalsEl) {
                totalsEl.innerHTML = `
                    <div class="cl-totals-head">CARD TOTALS: ${player.inventory.length}/${DB.length}</div>
                    ${CARD_LIST_RARITY_SWATCHES.map(([key, label, color]) => `
                        <div class="cl-totals-row">
                            <span class="cl-totals-dot" style="background:${color};"></span>${label}: ${counts[key] || 0}
                        </div>
                    `).join('')}
                `;
            }
        }

        function cardListTrain() {
            const c = getCurrentCardListCard();
            if (!c) return;
            openCardFocus(c.uid);
            focusStartTrain();
        }

        // Combine merges an exact duplicate (same DB id — same wrestler print, same rarity)
        // into the current card as XP fodder, via the same training panel as TRAIN but with
        // the fodder grid restricted to just that duplicate (see focusMode in training.js).
        function cardListCombine() {
            const c = getCurrentCardListCard();
            if (!c) return;
            const hasDuplicate = player.inventory.some(x => x.uid !== c.uid && x.id === c.id && !x.locked && !isCardEquipped(x.uid));
            if (!hasDuplicate) {
                showNotification(`🔀 No duplicate ${getCardBase(c).name} card available to combine.`, 1800);
                return;
            }
            openCardFocus(c.uid);
            focusMode = 'combine';
            focusStartTrain();
        }

        function cardListSetChamp() {
            const c = getCurrentCardListCard();
            if (!c) return;
            player.favoriteUid = (player.favoriteUid === c.uid) ? null : c.uid;
            save(false);
            updateUI();
            showNotification(player.favoriteUid === c.uid
                ? `👑 ${getCardBase(c).name} set as your Champ!`
                : `${getCardBase(c).name} is no longer your Champ.`, 1400);
        }

        function cardListDelete() {
            const c = getCurrentCardListCard();
            if (!c) return;
            if (c.locked) return showNotification('🔒 Unlock this card before deleting it.', 1500);
            const inDeck = player.deck.M.includes(c.uid) || player.deck.F.includes(c.uid) || player.deck.S.includes(c.uid);
            if (inDeck) return showNotification('⚠️ Remove this card from your deck (Exhibition → Change Cards) before deleting it.', 2000);
            showConfirmModal(`Delete ${getCardBase(c).name} permanently?\nThis cannot be undone.`, () => {
                player.inventory = player.inventory.filter(x => x.uid !== c.uid);
                if (player.favoriteUid === c.uid) { player.favoriteUid = null; updateUI(); }
                save();
                renderCardList();
                showNotification('🗑️ Card deleted.', 1200);
            }, 'DELETE');
        }

        // --- MATCHMAKING: 4 opponents with varied difficulty ---
