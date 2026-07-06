// CARD CATALOG — every card in the game DB, browsable by rarity. Cards the player already
// owns (at least one copy in inventory) show their real art; cards never pulled show a "?"
// placeholder instead, same rarity border, no name — a collection checklist, not a shop.

const CATALOG_RARITIES = ['Common', 'Uncommon', 'Rare', 'SuperRare', 'UltraRare', 'Epic', 'Legendary', 'Survivor'];
const CATALOG_RARITY_COLORS = {
    Common: '#888888', Uncommon: '#00aa00', Rare: '#0088ff', SuperRare: '#2244ff',
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
    return player.inventory.some(c => c.id === id);
}

function renderCatalogThumb(c) {
    const color = CATALOG_RARITY_COLORS[c.rarity] || '#888';
    const owned = isCardIdOwned(c.id);
    if (owned) {
        return `
            <div class="catalog-thumb">
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
    const cards = DB.filter(c => c.rarity === catalogSelectedRarity);
    const ownedCount = cards.filter(c => isCardIdOwned(c.id)).length;
    const countEl = document.getElementById('catalog-count');
    if (countEl) countEl.innerText = `${ownedCount} / ${cards.length} COLLECTED`;

    grid.innerHTML = cards.map(renderCatalogThumb).join('');
}
