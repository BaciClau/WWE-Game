// CARD CATALOG — every card in the game DB, browsable by rarity. Cards the player already
// owns (at least one copy in inventory) show their real art; cards never pulled show a "?"
// placeholder instead, same rarity border, no name — a collection checklist, not a shop.

const CATALOG_RARITIES = ['Common', 'Uncommon', 'Rare', 'SuperRare', 'UltraRare', 'Epic', 'Legendary', 'Survivor'];
const CATALOG_RARITY_COLORS = {
    Common: '#888888', Uncommon: '#00aa00', Rare: '#8fdcff', SuperRare: '#2244ff',
    UltraRare: '#9900cc', Epic: '#cc7700', Legendary: '#ffcc00', Survivor: '#cc0000'
};

let catalogSelectedRarity = 'Common';

function enterCardCatalog() {
    catalogSelectedRarity = 'Common';
    renderCardCatalog();
}

function setCatalogRarity(rarity) {
    catalogSelectedRarity = rarity;
    renderCardCatalog();
}

function isCardIdOwned(id) {
    // Tracks lifetime discovery, not current possession — a card stays "found" in the
    // Catalog even after it's fed as fodder/combined away or deleted from the collection.
    return player.discoveredCardIds.includes(id);
}

function renderCatalogThumb(c) {
    const color = CATALOG_RARITY_COLORS[c.rarity] || '#888';
    const owned = isCardIdOwned(c.id);
    if (owned) {
        return `
            <div class="catalog-thumb" onmouseenter="showCatalogPreview(${c.id})" onmouseleave="hideCatalogPreview()">
                <div class="catalog-thumb-box" style="border-color:${color};">
                    <img src="${c.img}" onload="fitCardImage(this)">
                </div>
                <div class="catalog-thumb-name">${c.name}</div>
            </div>
        `;
    }
    return `
        <div class="catalog-thumb catalog-thumb-locked">
            <div class="catalog-thumb-box" style="border-color:${color};">
                <div class="catalog-thumb-question">?</div>
            </div>
            <div class="catalog-thumb-name">???</div>
        </div>
    `;
}

// Hover preview — shows the full card (art + stats + ability) enlarged, centered on screen.
// Only for discovered cards; locked "?" thumbs have no stats to reveal.
function showCatalogPreview(id) {
    const preview = document.getElementById('catalog-hover-preview');
    if (!preview) return;
    const s = getStats({ uid: 'catalog-preview', id, level: 1, maxLvl: UPGRADE.BASE_MAX, xp: 0, upgradeType: null, phase: 1 });
    preview.innerHTML = renderHTMLCard(s);
    preview.style.display = 'flex';
}

function hideCatalogPreview() {
    const preview = document.getElementById('catalog-hover-preview');
    if (preview) preview.style.display = 'none';
}

// Catalog order: Male wrestlers first (by OVR desc), then Diva/Female (by OVR desc), then
// Support cards last — single-use items (Steel Chair, Ladder, etc.) before Managers
// (permanent boost once activated in a match), each group also sorted by OVR desc.
function getCatalogOvr(c) {
    return (c.pow || 0) + (c.tgh || 0) + (c.spd || 0) + (c.cha || 0);
}

function catalogGroupRank(c) {
    if (c.gender === 'M') return 0;
    if (c.gender === 'F') return 1;
    return c.manager ? 3 : 2; // support: single-use before managers
}

function sortCatalogCards(cards) {
    return [...cards].sort((a, b) => {
        const rankDiff = catalogGroupRank(a) - catalogGroupRank(b);
        if (rankDiff !== 0) return rankDiff;
        return getCatalogOvr(b) - getCatalogOvr(a);
    });
}

function renderCardCatalog() {
    const label = document.getElementById('catalog-rarity-label');
    if (label) {
        label.innerText = PACK_RARITY_LABELS[catalogSelectedRarity] || catalogSelectedRarity.toUpperCase();
        label.style.color = CATALOG_RARITY_COLORS[catalogSelectedRarity];
    }

    const filterRow = document.getElementById('catalog-filter-row');
    if (filterRow) {
        filterRow.innerHTML = CATALOG_RARITIES.map(r => `
            <button class="catalog-filter-btn ${r === catalogSelectedRarity ? 'active' : ''}"
                style="border-color:${CATALOG_RARITY_COLORS[r]}; ${r === catalogSelectedRarity ? `color:${CATALOG_RARITY_COLORS[r]};` : ''}"
                onclick="setCatalogRarity('${r}')">${PACK_RARITY_LABELS[r]}</button>
        `).join('');
    }

    const grid = document.getElementById('catalog-grid');
    if (!grid) return;
    const cards = sortCatalogCards(DB.filter(c => c.rarity === catalogSelectedRarity));
    const ownedCount = cards.filter(c => isCardIdOwned(c.id)).length;
    const countEl = document.getElementById('catalog-count');
    if (countEl) countEl.innerText = `${ownedCount} / ${cards.length} COLLECTED`;

    grid.innerHTML = cards.map(renderCatalogThumb).join('');
}
