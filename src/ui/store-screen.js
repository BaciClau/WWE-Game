// WWE SuperCard-style pack shop. All prices/contents are fixed in code (below) —
// the only thing read from the DB is player.coins itself, never a hardcoded price there.

const PACK_RARITY_LABELS = {
    Common: 'COMMON', Uncommon: 'UNCOMMON', Rare: 'RARE', SuperRare: 'SUPER RARE',
    UltraRare: 'ULTRA RARE', Epic: 'EPIC', Legendary: 'LEGENDARY', Survivor: 'SURVIVOR'
};

const DAILY_PACK_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// WWE SuperCard 2014 (Survivor era) shop philosophy: coins buy a CHANCE, never a guaranteed
// endgame card. Nothing above Ultra Rare is sold — Epic/Legendary/Survivor only come from
// playing (draft board resets, match rewards, future modes), so the shop can never feel like
// buying your way to the top. "Minimum Rarity" is the honest framing: it's a floor on the
// roll, not a promise of what you'll actually get. BOARD PICKS sells the currency that fuels
// the real progression path (the draft board) instead of selling cards directly.
const PACKS = [
    {
        id: 'basic', name: 'BASIC PACK', cost: 100, count: 5, border: '#888888', icon: '📦',
        chances: { Common: 70, Uncommon: 24, Rare: 5, SuperRare: 1 }
    },
    {
        id: 'rare', name: 'RARE PACK', cost: 300, count: 5, border: '#8fdcff', icon: '📗',
        minRarity: 'Rare',
        chances: { Rare: 75, SuperRare: 18, UltraRare: 6, Epic: 1 }
    },
    {
        id: 'superrare', name: 'SUPER RARE PACK', cost: 700, count: 5, border: '#2244ff', icon: '💎',
        minRarity: 'SuperRare',
        chances: { SuperRare: 75, UltraRare: 18, Epic: 6, Legendary: 1 }
    },
    {
        id: 'ultrarare', name: 'ULTRA RARE PACK', cost: 1500, count: 3, border: '#9900cc', icon: '⚡',
        minRarity: 'UltraRare',
        chances: { UltraRare: 78, Epic: 16, Legendary: 5, Survivor: 1 }
    },
    {
        id: 'boardpicks', name: 'BOARD PICKS', cost: 150, border: '#f1c40f', icon: '🎫',
        picks: 5
    },
    {
        id: 'daily', name: 'DAILY FREE PACK', cost: 0, count: 1, border: '#2ecc71', icon: '🎁',
        free: true,
        chances: { Common: 60, Uncommon: 27, Rare: 10, SuperRare: 2.5, UltraRare: 0.4, Epic: 0.08, Legendary: 0.015, Survivor: 0.005 }
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
    const pool = DB.filter(c => c.rarity === rarity && !c.ladderReward);
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

    // BOARD PICKS sells a currency, not cards — its own compact line, no rarity odds.
    const contentLine = p.picks
        ? `<div class="pack-count">🎫 +${p.picks} Draft Picks</div>`
        : `<div class="pack-count">${p.count} CARD${p.count === 1 ? '' : 'S'}</div>`;
    const minRarityLine = p.minRarity
        ? `<div class="pack-min-rarity">MINIMUM RARITY: ${PACK_RARITY_LABELS[p.minRarity]}</div>`
        : '';
    const chancesLine = p.chances ? `<div class="pack-chances">${renderPackChanceText(p.chances)}</div>` : '';

    return `
        <div class="pack-row" style="border-color:${p.border};">
            <div class="pack-icon">${p.icon}</div>
            <div class="pack-info">
                <div class="pack-name">${p.name}</div>
                ${contentLine}
                ${minRarityLine}
                ${chancesLine}
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
        // BOARD PICKS sells Draft Picks directly — no cards to roll or reveal, so it just
        // credits the currency and confirms with a notification instead of the card modal.
        if (pack.picks) {
            if (pack.free) player.lastFreePackClaim = Date.now();
            else player.coins -= pack.cost;
            player.picks += pack.picks;
            save();
            renderStoreScreen();
            updateUI();
            showNotification(`🎫 +${pack.picks} Draft Picks!`, 1800);
            return;
        }

        // Roll the full pack FIRST, pay after: if anything in here throws, the player must
        // not end up having paid (or burned the daily claim) for cards they never received.
        const pulledIds = [];
        for (let i = 0; i < pack.count; i++) {
            const rarity = rollPackRarity(pack.chances);
            const card = pickRandomCardOfRarity(rarity);
            pulledIds.push(card.id);
        }
        if (pack.free) player.lastFreePackClaim = Date.now();
        else player.coins -= pack.cost;
        pulledIds.forEach(id => addCard(id));
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
