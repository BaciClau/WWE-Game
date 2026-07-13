function generateBoard() {
    player.board = new Array(25).fill(false);
    player.resetIdx = Math.floor(Math.random() * 25);
    save();
}

// Cards pulled since the player last entered the draft board — shown as a summary (same
// grid + COLLECT ALL used by the pack shop) once they run out of picks.
let _draftSessionPulls = [];

// Where leaving the Draft Board (out of picks, or the header back button) sends the
// player back to. Opened straight from the main menu → back to the main menu (the
// default, reset every time enterDraftBoard() runs). Opened as a match's reward screen
// (see match.js) → back to the Opponent Select list instead, so a play session flows
// match → picks → next opponent without detouring through the menu every time.
let _draftBoardReturnScreen = 'main-menu';
function _goToDraftBoardReturn() {
    if (_draftBoardReturnScreen === 'opp-select-screen') showOpponentSelect();
    else showScreen('main-menu');
}

function enterDraftBoard() {
    _draftSessionPulls = [];
    _draftBoardReturnScreen = 'main-menu';
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

        // Normal (non-reset) tile odds, keyed by current deck base tier. Matches the real
        // Season 1 board: every tile except the one reset tile is guaranteed filler
        // (Common/Uncommon only) — you "whittle away" junk until you hit the reset tile,
        // which is the ONLY one that can ever drop Rare or better. Higher tier just improves
        // the Common/Uncommon ratio of that filler, it never unlocks bigger drops here.
        const DRAFT_NORMAL_ODDS = {
            Rare:      [['Common', 75], ['Uncommon', 25]],
            SuperRare: [['Common', 65], ['Uncommon', 35]],
            UltraRare: [['Common', 55], ['Uncommon', 45]],
            Epic:      [['Common', 45], ['Uncommon', 55]],
            Legendary: [['Common', 35], ['Uncommon', 65]],
            Survivor:  [['Common', 25], ['Uncommon', 75]]
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

            // A tier rank-up guarantees SOME upcoming pick (any tile) is a card from the new
            // tier's rarity — but not deterministically the very next one. A random delay
            // (0-4 picks) is rolled when the guarantee is granted; it only fires once that
            // countdown reaches 0, so it can land on the first pull (lucky) or several pulls
            // later, same as the original board's rank-up reward feel. Never more than one
            // guarantee pending at a time (a fresh tier-up overwrites, doesn't stack).
            let guaranteedRarity = null;
            if (player.guaranteedPickRarity) {
                if (player.guaranteedPickDelay > 0) {
                    player.guaranteedPickDelay--;
                } else {
                    guaranteedRarity = player.guaranteedPickRarity;
                }
            }

            let tInfo = calculateDeckTier();
            let pBase = tInfo.base;
            let bIdx = DRAFT_BASE_RARITIES.indexOf(pBase);

            if (guaranteedRarity) {
                player.guaranteedPickRarity = null;
                player.guaranteedPickDelay = 0;
                let pool = DB.filter(c => c.rarity === guaranteedRarity && !c.ladderReward);
                if (pool.length === 0) pool = DB.filter(c => c.rarity === 'Rare' && !c.ladderReward);
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

                let pool = DB.filter(c => c.rarity === dropRarity && !c.ladderReward);
                if (pool.length === 0) pool = DB.filter(c => c.rarity === 'Rare' && !c.ladderReward); // Fallback
                pulledId = pool[Math.floor(Math.random() * pool.length)].id;

            } else {
                // Normal (non-reset) tile — full rarity table scaled by current deck tier.
                let odds = DRAFT_NORMAL_ODDS[pBase] || DRAFT_NORMAL_ODDS.Rare;
                let pRarity = draftWeightedPick(odds);

                let pool = DB.filter(c => c.rarity === pRarity && !c.ladderReward);
                pulledId = pool[Math.floor(Math.random() * pool.length)].id;
            }

            // save() -> updateUI() (below) is what actually detects a tier-up and grants the
            // rank-up guarantee (see common.js) — any change to that granting logic belongs
            // there, not here, so there's a single source of truth for it.
            addCard(pulledId); save(); renderDraftBoard();
            _draftSessionPulls.push(pulledId);
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
                    showCardSummaryModal(pulls, 'DRAFT SUMMARY', _goToDraftBoardReturn);
                }, 500);
            }
        }

        // buyPack() now lives in src/ui/store-screen.js (WWE SuperCard-style pack shop).
        // This one stays here: the win-streak reward (STREAK_REWARDS.freePackEvery, granted
        // from match.js) hands out one free card from a fixed rarity pool — no coins, no
        // shop UI — so it keeps its own small helper instead of going through the paid packs.
        function grantBonusPack(rarityArray) {
            // !ladderReward, same as every other pool in the game — ladder exclusives must
            // only ever come from the ladder, not leak out through the streak reward.
            let pool = DB.filter(c => rarityArray.includes(c.rarity) && !c.ladderReward);
            let cardId = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)].id : 1;
            addCard(cardId); save();
            let s = getStats({uid:'preview', id: cardId, level: 1, maxLvl: UPGRADE.BASE_MAX, xp: 0, upgradeType: null, phase: 1});
            document.getElementById('pull-card-container').innerHTML = renderHTMLCard(s);
            document.getElementById('pull-title').innerText = "FREE PACK!";
            document.getElementById('pull-modal').style.display = "flex";
        }
