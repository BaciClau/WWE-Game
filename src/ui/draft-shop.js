function generateBoard() {
    player.board = new Array(25).fill(false);
    player.resetIdx = Math.floor(Math.random() * 25);
    save();
}

// Cards pulled since the player last entered the draft board — shown as a summary (same
// grid + COLLECT ALL used by the pack shop) once they run out of picks.
let _draftSessionPulls = [];

function enterDraftBoard() {
    _draftSessionPulls = [];
    renderDraftBoard();
}

function renderDraftBoard() {
    updateUI();
    let g = document.getElementById('draft-board-grid');
    g.innerHTML = "";

    player.board.forEach((r, i) => {
        let d = document.createElement('div');
        d.className = `draft-card ${r ? 'revealed' : ''}`;
        if (!r) d.onclick = () => pullDraft(i);
        g.appendChild(d);
    });
}

        // Season 1 (2014) draft board tuning — see pullDraft() below.
        const DRAFT_BASE_RARITIES = ['Common', 'Uncommon', 'Rare', 'SuperRare', 'UltraRare', 'Epic', 'Legendary', 'Survivor'];

        // Reset-tile pity: a reset that whiffs on the player's current base tier (and isn't
        // itself the pity-guaranteed pull) increments player.resetCounter. Once it reaches
        // the threshold for the current base tier, the NEXT reset is guaranteed that tier.
        const DRAFT_PITY_THRESHOLD = { Rare: 5, SuperRare: 7, UltraRare: 9, Epic: 12, Legendary: 15, Survivor: 18 };

        // Base chance a reset tile drops the player's current tier, by +/++ subtier — same
        // 15/25/40 progression at every base rarity.
        const DRAFT_RESET_CHANCE = { '': 15, '+': 25, '++': 40 };

        // Normal (non-reset) tile odds, keyed by current deck base tier.
        const DRAFT_NORMAL_ODDS = {
            Rare:      [['Common', 70], ['Uncommon', 25], ['Rare', 5]],
            SuperRare: [['Common', 55], ['Uncommon', 25], ['Rare', 15], ['SuperRare', 5]],
            UltraRare: [['Common', 40], ['Uncommon', 20], ['Rare', 20], ['SuperRare', 15], ['UltraRare', 5]],
            Epic:      [['Common', 30], ['Uncommon', 15], ['Rare', 20], ['SuperRare', 20], ['UltraRare', 10], ['Epic', 5]],
            Legendary: [['Common', 20], ['Uncommon', 10], ['Rare', 15], ['SuperRare', 20], ['UltraRare', 15], ['Epic', 10], ['Legendary', 10]],
            Survivor:  [['Common', 15], ['Uncommon', 10], ['Rare', 10], ['SuperRare', 15], ['UltraRare', 15], ['Epic', 15], ['Legendary', 15], ['Survivor', 5]]
        };

        function draftWeightedPick(pairs) {
            const total = pairs.reduce((sum, [, w]) => sum + w, 0);
            let roll = Math.random() * total;
            for (const [rarity, w] of pairs) {
                if (roll < w) return rarity;
                roll -= w;
            }
            return pairs[pairs.length - 1][0];
        }

        function draftTierSuffix(tierName) {
            if (tierName.endsWith('++')) return '++';
            if (tierName.endsWith('+')) return '+';
            return '';
        }

        function pullDraft(i) {
            if(player.picks <= 0) return showNotification("No more picks! Play Exhibition to earn more.", 1500);
            player.picks--; player.board[i] = true;
            incrementMission('draft_picks');

            let isReset = (i === player.resetIdx);
            let pulledId = 1;

            // A tier rank-up guarantees the very next pick is a card from the new tier's
            // rarity, regardless of which tile is clicked — consumed after this one pull.
            let guaranteedRarity = player.guaranteedPickRarity;

            let tInfo = calculateDeckTier();
            let pBase = tInfo.base;
            let bIdx = DRAFT_BASE_RARITIES.indexOf(pBase);

            if (guaranteedRarity) {
                player.guaranteedPickRarity = null;
                let pool = DB.filter(c => c.rarity === guaranteedRarity);
                if (pool.length === 0) pool = DB.filter(c => c.rarity === 'Rare');
                pulledId = pool[Math.floor(Math.random() * pool.length)].id;
            } else if (isReset) {
                let dropRarity;
                let pityThreshold = DRAFT_PITY_THRESHOLD[pBase] || DRAFT_PITY_THRESHOLD.Rare;
                let pityPaidOut = player.resetCounter >= pityThreshold;

                if (pityPaidOut) {
                    // Pity paid out — guaranteed current base tier.
                    dropRarity = pBase;
                } else {
                    let suffix = draftTierSuffix(tInfo.name);
                    let currentChance = DRAFT_RESET_CHANCE[suffix];

                    if (Math.random() * 100 < currentChance) {
                        dropRarity = pBase;
                    } else {
                        // Whiffed the current tier — drop something below it (never lower
                        // than Rare, the reset floor), weighted toward the tier directly
                        // beneath the current one. Higher tiers lean on that "one below"
                        // tier even harder — the nearest-tier share grows with bIdx.
                        let lowerIdxs = [];
                        for (let idx = 2; idx < bIdx; idx++) lowerIdxs.push(idx); // 2 = Rare

                        if (lowerIdxs.length === 0) {
                            dropRarity = 'Rare';
                        } else {
                            let nearestShare = Math.min(0.9, 0.55 + 0.05 * (bIdx - 2));
                            let weights = new Array(lowerIdxs.length);
                            weights[lowerIdxs.length - 1] = nearestShare;
                            let remaining = 1 - nearestShare;
                            for (let k = lowerIdxs.length - 2; k >= 0; k--) {
                                let w = remaining / 2;
                                weights[k] = w;
                                remaining -= w;
                            }
                            if (lowerIdxs.length > 1) weights[0] += remaining;
                            let pairs = lowerIdxs.map((idx, k) => [DRAFT_BASE_RARITIES[idx], weights[k] * 100]);
                            dropRarity = draftWeightedPick(pairs);
                        }
                    }
                }

                // Pity tracks whether the player actually walked away with their current
                // base tier — not which branch was taken. At the Rare tier there's nothing
                // below it, so even a "miss" resolves to Rare and correctly doesn't count
                // as a whiff.
                player.resetCounter = (dropRarity === pBase) ? 0 : player.resetCounter + 1;

                let pool = DB.filter(c => c.rarity === dropRarity);
                if (pool.length === 0) pool = DB.filter(c => c.rarity === 'Rare'); // Fallback
                pulledId = pool[Math.floor(Math.random() * pool.length)].id;

            } else {
                // Normal (non-reset) tile — full rarity table scaled by current deck tier.
                let odds = DRAFT_NORMAL_ODDS[pBase] || DRAFT_NORMAL_ODDS.Rare;
                let pRarity = draftWeightedPick(odds);

                let pool = DB.filter(c => c.rarity === pRarity);
                pulledId = pool[Math.floor(Math.random() * pool.length)].id;
            }

            addCard(pulledId); save(); renderDraftBoard();
            _draftSessionPulls.push(pulledId);

            // Tier-up guarantee: if this pull pushed the deck into a new BASE tier, the very
            // next pull (any tile) is guaranteed a card from that new tier.
            let newTierInfo = calculateDeckTier();
            let newBIdx = DRAFT_BASE_RARITIES.indexOf(newTierInfo.base);
            if (newBIdx > bIdx) {
                player.guaranteedPickRarity = newTierInfo.base;
            }
            checkTierMissions();

            let s = getStats({uid:'preview', id: pulledId, level: 1, maxLvl: UPGRADE.BASE_MAX, xp: 0, upgradeType: null, phase: 1});
            document.getElementById('pull-card-container').innerHTML = renderHTMLCard(s);
            document.getElementById('pull-title').innerText = guaranteedRarity ? "RANK-UP GUARANTEE! " + s.rarity.toUpperCase() + " CARD!" : (isReset ? "BOARD RESET! " + s.rarity.toUpperCase() + " CARD!" : "YOU PULLED A CARD!");
            document.getElementById('pull-title').style.color = guaranteedRarity ? "#2ecc71" : (isReset ? "#f1c40f" : "#fff");
            document.getElementById('pull-modal').style.display = "flex";
            if(isReset) generateBoard();
        }

        function closePullModal() {
            document.getElementById('pull-modal').style.display = "none";
            renderDraftBoard();
            if (player.picks === 0 && _draftSessionPulls.length > 0) {
                const pulls = [..._draftSessionPulls];
                _draftSessionPulls = [];
                setTimeout(() => {
                    showCardSummaryModal(pulls, 'DRAFT SUMMARY', () => showScreen('main-menu'));
                }, 500);
            }
        }

        // buyPack() now lives in src/ui/store-screen.js (WWE SuperCard-style pack shop).
        // This one stays here: the win-streak reward (STREAK_REWARDS.freePackEvery, granted
        // from match.js) hands out one free card from a fixed rarity pool — no coins, no
        // shop UI — so it keeps its own small helper instead of going through the paid packs.
        function grantBonusPack(rarityArray) {
            let pool = DB.filter(c => rarityArray.includes(c.rarity));
            let cardId = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)].id : 1;
            addCard(cardId); save();
            let s = getStats({uid:'preview', id: cardId, level: 1, maxLvl: UPGRADE.BASE_MAX, xp: 0, upgradeType: null, phase: 1});
            document.getElementById('pull-card-container').innerHTML = renderHTMLCard(s);
            document.getElementById('pull-title').innerText = "FREE PACK!";
            document.getElementById('pull-modal').style.display = "flex";
        }
