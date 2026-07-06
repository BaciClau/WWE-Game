// WWE SuperCard-style pack shop. All prices/contents are fixed in code (below) —
// the only thing read from the DB is player.coins itself, never a hardcoded price there.

const PACK_RARITY_LABELS = {
    Common: 'COMMON', Uncommon: 'UNCOMMON', Rare: 'RARE', SuperRare: 'SUPER RARE',
    UltraRare: 'ULTRA RARE', Epic: 'EPIC', Legendary: 'LEGENDARY', Survivor: 'SURVIVOR'
};

const DAILY_PACK_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const PACKS = [
    {
        id: 'basic', name: 'BASIC PACK', cost: 100, count: 5, border: '#bdc3c7', icon: '📦',
        desc: '5 Common & Uncommon Cards',
        chances: { Common: 68, Uncommon: 25, Rare: 6, SuperRare: 1 }
    },
    {
        id: 'rare', name: 'RARE PACK', cost: 500, count: 5, border: '#00FFFF', icon: '📗',
        desc: '5 Guaranteed Rare Cards',
        chances: { Rare: 55, SuperRare: 30, UltraRare: 12, Epic: 3 }
    },
    {
        id: 'superrare', name: 'SUPER RARE PACK', cost: 1500, count: 5, border: '#4444FF', icon: '💎',
        desc: '5 Guaranteed Super Rare Cards',
        chances: { SuperRare: 55, UltraRare: 30, Epic: 12, Legendary: 3 }
    },
    {
        id: 'ultrarare', name: 'ULTRA RARE PACK', cost: 5000, count: 3, border: '#8800FF', icon: '⚡',
        desc: '3 Guaranteed Ultra Rare Cards',
        chances: { UltraRare: 55, Epic: 30, Legendary: 12, Survivor: 3 }
    },
    {
        id: 'epic', name: 'EPIC PACK', cost: 15000, count: 2, border: '#CC00CC', icon: '🔮',
        desc: '2 Guaranteed Epic Cards',
        chances: { Epic: 70, Legendary: 23, Survivor: 7 }
    },
    {
        id: 'legendary', name: 'LEGENDARY PACK', cost: 50000, count: 1, border: '#FFD700', icon: '👑',
        desc: '1 Guaranteed Legendary Card',
        chances: { Legendary: 82, Survivor: 18 }
    },
    {
        id: 'survivor', name: 'SURVIVOR PACK', cost: 150000, count: 1, border: '#e74c3c', icon: '🏆',
        desc: '1 Guaranteed Survivor Card - The Ultimate Rarity',
        chances: { Legendary: 25, Survivor: 75 }, special: true
    },
    {
        id: 'daily', name: 'DAILY FREE PACK', cost: 0, count: 1, border: '#2ecc71', icon: '🎁',
        desc: '1 Free Card Every 24 Hours', free: true,
        chances: { Common: 50, Uncommon: 25, Rare: 15, SuperRare: 7, UltraRare: 2, Epic: 0.8, Legendary: 0.18, Survivor: 0.02 }
    }
];

// Weighted random rarity pick from a pack's chance table (percentages don't need to add to
// exactly 100 — they're normalized against their own total).
function rollPackRarity(chances) {
    const entries = Object.entries(chances);
    const total = entries.reduce((s, [, pct]) => s + pct, 0);
    let r = Math.random() * total;
    for (const [rarity, pct] of entries) {
        if (r < pct) return rarity;
        r -= pct;
    }
    return entries[entries.length - 1][0];
}

function pickRandomCardOfRarity(rarity) {
    const pool = DB.filter(c => c.rarity === rarity);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : DB[0];
}

function getDailyPackRemainingMs() {
    if (!player.lastFreePackClaim) return 0;
    return Math.max(0, DAILY_PACK_COOLDOWN_MS - (Date.now() - player.lastFreePackClaim));
}

function formatCountdown(ms) {
    const totalSec = Math.ceil(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function renderPackChanceText(chances) {
    return Object.entries(chances).map(([r, pct]) => `${PACK_RARITY_LABELS[r]} ${pct}%`).join(' | ');
}

function renderPackRowHTML(p) {
    const priceCol = p.free
        ? `<div id="pack-daily-status"></div>`
        : `
            <div class="pack-price">💰 ${p.cost.toLocaleString()}</div>
            <button class="pack-buy-btn" data-pack="${p.id}" onclick="buyPack('${p.id}')">BUY</button>
        `;
    return `
        <div class="pack-row ${p.special ? 'pack-special-glow' : ''}" style="border-color:${p.border};">
            <div class="pack-icon">${p.icon}</div>
            <div class="pack-info">
                <div class="pack-name" style="${p.special ? 'color:#ffcc00;' : ''}">${p.name}</div>
                <div class="pack-desc">${p.desc}</div>
                <div class="pack-chances">${renderPackChanceText(p.chances)}</div>
            </div>
            <div class="pack-price-col">${priceCol}</div>
        </div>
    `;
}

let _storeCountdownTimer = null;

function renderStoreScreen() {
    const coinsEl = document.getElementById('store-coins-display');
    if (coinsEl) coinsEl.innerText = player.coins;

    const list = document.getElementById('store-pack-list');
    if (list) list.innerHTML = PACKS.map(renderPackRowHTML).join('');

    if (_storeCountdownTimer) clearInterval(_storeCountdownTimer);
    updateDailyPackCountdown();
    _storeCountdownTimer = setInterval(updateDailyPackCountdown, 1000);
}

function updateDailyPackCountdown() {
    const screen = document.getElementById('store-screen');
    const el = document.getElementById('pack-daily-status');
    if (!screen || !screen.classList.contains('active') || !el) {
        if (_storeCountdownTimer) { clearInterval(_storeCountdownTimer); _storeCountdownTimer = null; }
        return;
    }
    const remaining = getDailyPackRemainingMs();
    el.innerHTML = remaining <= 0
        ? `<button class="pack-buy-btn pack-claim-btn" onclick="buyPack('daily')">CLAIM</button>`
        : `<div class="pack-cooldown">${formatCountdown(remaining)}</div>`;
}

function setPackBuyButtonLoading(packId, isLoading) {
    document.querySelectorAll(`.pack-buy-btn[data-pack="${packId}"]`).forEach(btn => {
        btn.disabled = isLoading;
        btn.innerText = isLoading ? '...' : 'BUY';
    });
}

function buyPack(packId) {
    const pack = PACKS.find(p => p.id === packId);
    if (!pack) return;

    if (pack.free) {
        if (getDailyPackRemainingMs() > 0) return;
    } else if (player.coins < pack.cost) {
        return showNotification('❌ Insufficient Coins', 1800);
    }

    setPackBuyButtonLoading(packId, true);
    try {
        if (pack.free) player.lastFreePackClaim = Date.now();
        else player.coins -= pack.cost;

        const pulledIds = [];
        for (let i = 0; i < pack.count; i++) {
            const rarity = rollPackRarity(pack.chances);
            const card = pickRandomCardOfRarity(rarity);
            pulledIds.push(card.id);
            addCard(card.id);
        }
        save();
        renderStoreScreen();
        updateUI();
        openPackRevealModal(pulledIds);
    } catch (e) {
        showNotification('❌ Something went wrong opening this pack.', 2000);
    } finally {
        setPackBuyButtonLoading(packId, false);
    }
}

// --- Pack reveal modal: one card at a time, player taps NEXT to reveal each,
// then a full summary of everything received before it's collected. The same
// summary step is reused for draft-board picks (see draft-shop.js) — same modal,
// same grid, same "COLLECT ALL" button. ---
let _packRevealQueue = [];
let _packRevealIndex = 0;

function openPackRevealModal(cardIds) {
    const modal = document.getElementById('pack-reveal-modal');
    if (!modal || !document.getElementById('pack-reveal-container')) return;

    const titleEl = modal.querySelector('.pull-title');
    if (titleEl) titleEl.innerText = 'PACK OPENED!';

    _packRevealQueue = cardIds;
    _packRevealIndex = 0;
    modal.style.display = 'flex';
    showPackRevealCard();
}

function showPackRevealCard() {
    const container = document.getElementById('pack-reveal-container');
    const collectBtn = document.getElementById('pack-reveal-collect-btn');
    const nextBtn = document.getElementById('pack-reveal-next-btn');
    const counter = document.getElementById('pack-reveal-counter');

    container.className = 'pack-reveal-container';
    const id = _packRevealQueue[_packRevealIndex];
    const s = getStats({ uid: 'preview' + _packRevealIndex, id, level: 1, xp: 0, upgradeType: null, phase: 1 });
    container.innerHTML = `
        <div class="pack-reveal-card-flip">
            <div class="pack-reveal-card-inner">
                <div class="pack-reveal-card-back">?</div>
                <div class="pack-reveal-card-front">${renderHTMLCard(s)}</div>
            </div>
        </div>
    `;
    const flipEl = container.querySelector('.pack-reveal-card-flip');
    requestAnimationFrame(() => requestAnimationFrame(() => flipEl.classList.add('flipped')));

    if (counter) counter.innerText = `CARD ${_packRevealIndex + 1} / ${_packRevealQueue.length}`;
    const isLast = _packRevealIndex >= _packRevealQueue.length - 1;
    if (nextBtn) nextBtn.style.display = isLast ? 'none' : 'inline-flex';
    if (collectBtn) {
        collectBtn.style.display = isLast ? 'inline-flex' : 'none';
        collectBtn.innerText = 'SEE SUMMARY';
        collectBtn.onclick = () => showCardSummaryModal(_packRevealQueue, 'PACK SUMMARY', null);
    }
}

function packRevealNext() {
    if (_packRevealIndex >= _packRevealQueue.length - 1) return;
    _packRevealIndex++;
    showPackRevealCard();
}

// Generic "here's everything you got" grid — used both at the end of a pack and at the
// end of a draft-board session. onCollect (optional) runs after the player dismisses it.
function showCardSummaryModal(cardIds, title, onCollect) {
    const modal = document.getElementById('pack-reveal-modal');
    const container = document.getElementById('pack-reveal-container');
    const nextBtn = document.getElementById('pack-reveal-next-btn');
    const collectBtn = document.getElementById('pack-reveal-collect-btn');
    const counter = document.getElementById('pack-reveal-counter');
    const titleEl = modal.querySelector('.pull-title');
    if (!modal || !container || !collectBtn) return;

    if (titleEl) titleEl.innerText = title;
    if (counter) counter.innerText = `${cardIds.length} CARD${cardIds.length === 1 ? '' : 'S'} RECEIVED`;
    if (nextBtn) nextBtn.style.display = 'none';

    container.className = 'pack-reveal-summary-grid';
    container.innerHTML = cardIds.map((id, i) =>
        renderHTMLCard(getStats({ uid: 'summary' + i, id, level: 1, xp: 0, upgradeType: null, phase: 1 }))
    ).join('');

    collectBtn.style.display = 'inline-flex';
    collectBtn.innerText = 'COLLECT ALL';
    collectBtn.onclick = () => {
        modal.style.display = 'none';
        if (onCollect) onCollect();
    };
    modal.style.display = 'flex';
}

function closePackRevealModal() {
    const modal = document.getElementById('pack-reveal-modal');
    if (modal) modal.style.display = 'none';
}
