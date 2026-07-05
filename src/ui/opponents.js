// Nume gamer-tag random pentru adversari (mereu re-generate, nu identitati persistente)
const GAMER_TAG_PARTS = ['Shadow', 'Swag', 'Turbo', 'Ninja', 'Savage', 'Iron', 'Ghost', 'Rusty', 'Toxic', 'Silent', 'Rogue', 'Cosmic', 'Blaze', 'Frost', 'Viper', 'Rebel'];
const GAMER_TAG_SUFFIXES = ['Killer', 'Pro', 'King', 'One', 'X', 'Boom', 'Legend', 'TTV', 'Prime', 'Zero'];

function generateGamerTag() {
    const part = GAMER_TAG_PARTS[Math.floor(Math.random() * GAMER_TAG_PARTS.length)];
    const suffix = GAMER_TAG_SUFFIXES[Math.floor(Math.random() * GAMER_TAG_SUFFIXES.length)];
    const useNumber = Math.random() < 0.5;
    return useNumber ? `${part}${Math.floor(Math.random() * 900) + 10}` : `${part}${suffix}`;
}

// Genereaza un W/L cosmetic, usor corelat cu dificultatea ascunsa, dar tot random
function generateOpponentWL(aiMode) {
    const ranges = {
        easy:      { winsMin: 10, winsMax: 40,  lossesMin: 20, lossesMax: 45 },
        normal:    { winsMin: 25, winsMax: 60,  lossesMin: 15, lossesMax: 40 },
        hard:      { winsMin: 45, winsMax: 90,  lossesMin: 10, lossesMax: 30 },
        nightmare: { winsMin: 60, winsMax: 150, lossesMin: 5,  lossesMax: 25 },
    };
    const r = ranges[aiMode] || ranges.normal;
    const wins = r.winsMin + Math.floor(Math.random() * (r.winsMax - r.winsMin));
    const losses = r.lossesMin + Math.floor(Math.random() * (r.lossesMax - r.lossesMin));
    return { wins, losses };
}

function showOpponentSelect() {
            autoEquipDeck();
            let myPower = calculateDeckTier().current;

            // 4 brackets de dificultate ascunsa — influenteaza doar puterea/AI-ul real, niciodata afisate.
            // Puterea variaza intre ~95% si ~105% din puterea ta — pot fi si sub, si peste, nu doar sub.
            const brackets = [
                { label: 'EASY',      minPct: 0.95, maxPct: 1.00, aiMode: 'easy' },
                { label: 'NORMAL',    minPct: 0.98, maxPct: 1.02, aiMode: 'normal' },
                { label: 'HARD',      minPct: 1.00, maxPct: 1.03, aiMode: 'hard' },
                { label: 'NIGHTMARE', minPct: 1.02, maxPct: 1.05, aiMode: 'nightmare' },
            ];

            // Fiecare din cei 4 adversari primeste o dificultate trasa independent (nu 1 per bracket)
            window.currentOpponents = Array.from({ length: 4 }, () => {
                const b = brackets[Math.floor(Math.random() * brackets.length)];
                let oppPower = Math.floor(myPower * (b.minPct + Math.random() * (b.maxPct - b.minPct)));
                oppPower = Math.max(1, oppPower);
                const deck = createDeckForPower(oppPower);
                const avatarCard = deck[Math.floor(Math.random() * deck.length)];
                const actualPower = deck.reduce((s, c) => s + c.pow + c.tgh + c.spd + c.cha, 0);
                const tier = getTierForPower(actualPower);
                return {
                    deck,
                    power: oppPower,
                    aiMode: b.aiMode,
                    name: generateGamerTag(),
                    avatarImg: avatarCard.img,
                    wl: generateOpponentWL(b.aiMode),
                    tierName: tier.name,
                    tierColor: tier.color,
                };
            });

            let container = document.getElementById('opponents-container');
            container.innerHTML = '';

            window.currentOpponents.forEach((opp, idx) => {
                container.innerHTML += `
                    <div class="opponent-row" onclick="startMatchWithOpponent(${idx})">
                        <div class="opponent-avatar"><img src="${opp.avatarImg}" alt=""></div>
                        <div class="opponent-info">
                            <div class="opponent-name">${opp.name}</div>
                            <div class="opponent-tier" style="color:${opp.tierColor};">${opp.tierName}</div>
                            <div class="opponent-wl">WINS: ${opp.wl.wins} &nbsp; LOSSES: ${opp.wl.losses}</div>
                        </div>
                        <div class="opponent-fight-btn">▶</div>
                    </div>
                `;
            });

            const myWinsEl = document.getElementById('my-wins');
            const myLossesEl = document.getElementById('my-losses');
            if (myWinsEl) myWinsEl.innerText = player.wins || 0;
            if (myLossesEl) myLossesEl.innerText = player.losses || 0;

            showScreen('opp-select-screen');
        }

        // Given a target stat multiplier, find the level/upgrade combo that a real player
        // card could actually have (level 1-10 base, 11-15 Pro, or 0-10 Perfect Pro phase 2)
        // that produces that same multiplier via the real getStatMultiplier() formula.
        function multiplierToLevel(m) {
            const G = UPGRADE.GROWTH;
            const maxBase = 1 + 9 * G.base;
            if (m <= maxBase) {
                let lv = 1 + (m - 1) / G.base;
                lv = Math.max(1, Math.min(10, Math.round(lv)));
                return { level: lv, upgradeType: null, phase: 1 };
            }
            const maxNormal = maxBase + 5 * G.normal;
            if (m <= maxNormal) {
                let lv = 10 + (m - maxBase) / G.normal;
                lv = Math.max(11, Math.min(15, Math.round(lv)));
                return { level: lv, upgradeType: 'normal', phase: 1 };
            }
            let lv = (m - maxBase) / G.perfectP2;
            lv = Math.max(0, Math.min(10, Math.round(lv)));
            return { level: lv, upgradeType: 'perfect', phase: 2 };
        }

        // Same tier lookup as calculateDeckTier(), but for an arbitrary stat total instead of
// the player's own inventory — used to show each opponent's rank in the Exhibition list.
function getTierForPower(totalPower) {
    let cTier = TIERS[0];
    for (let i = 0; i < TIERS.length; i++) { if (totalPower >= TIERS[i].min) cTier = TIERS[i]; }
    return cTier;
}

const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'SuperRare', 'UltraRare', 'Epic', 'Legendary', 'Survivor'];

        // Draws a random 4M+2F+1S lineup for a given rarity and computes what level/upgrade
        // multiplier the M+F cards would need to hit targetPower.
        function draftAttempt(rarity, targetPower) {
            let poolM = DB.filter(c => c.gender === 'M' && c.rarity === rarity);
            let poolF = DB.filter(c => c.gender === 'F' && c.rarity === rarity);
            let poolS = DB.filter(c => c.gender === 'S' && c.rarity === rarity);
            if (!poolM.length) poolM = DB.filter(c => c.gender === 'M');
            if (!poolF.length) poolF = DB.filter(c => c.gender === 'F');
            if (!poolS.length) poolS = DB.filter(c => c.gender === 'S');

            const mCards = Array.from({ length: 4 }, () => poolM[Math.floor(Math.random() * poolM.length)]);
            const fCards = Array.from({ length: 2 }, () => poolF[Math.floor(Math.random() * poolF.length)]);
            const sCard = poolS[Math.floor(Math.random() * poolS.length)];

            let baseSum = 0;
            [...mCards, ...fCards].forEach(c => baseSum += (c.pow + c.tgh + c.spd + c.cha));
            baseSum = Math.max(1, baseSum);

            // Support cards don't level up (same as for the player), so their fixed stats
            // are subtracted from the target before solving for the M/F cards' level.
            const supportSum = sCard.pow + sCard.tgh + sCard.spd + sCard.cha;
            const multiplier = (targetPower - supportSum) / baseSum;

            return { mCards, fCards, sCard, multiplier };
        }

        // Builds an enemy team using real cards at a real, achievable level/upgrade state
        // (same stat formulas as the player's own cards) instead of arbitrarily rescaled
        // stats — so the whole deck looks like another buildable roster, just aimed at
        // roughly the target power, not a hand-tuned/impossible lineup.
        //
        // Rarity is searched from highest to lowest, picking the first one whose level-1
        // floor doesn't already overshoot the target power. Without this search, a fixed
        // "pick rarity from target power" lookup can land on a rarity whose weakest
        // possible (level 1, no upgrade) lineup is already stronger than the target — and
        // since level can't go below 1, that overshoots the intended power noticeably
        // (was landing ~125% instead of the intended ~100%).
        function createDeckForPower(targetPower) {
            let chosen = null;
            for (let i = RARITY_ORDER.length - 1; i >= 0; i--) {
                const attempt = draftAttempt(RARITY_ORDER[i], targetPower);
                if (attempt.multiplier >= 0.85) {
                    chosen = attempt;
                    break;
                }
            }
            if (!chosen) chosen = draftAttempt('Common', targetPower);

            const lvlInfo = multiplierToLevel(chosen.multiplier);
            const levelableCards = [...chosen.mCards, ...chosen.fCards];
            const built = levelableCards.map((c, i) => {
                const cardObj = { id: c.id, uid: 'o_'+i, level: lvlInfo.level, xp: 0, upgradeType: lvlInfo.upgradeType, phase: lvlInfo.phase, locked: false };
                return getStats(cardObj);
            });
            const supportBuilt = getStats({ id: chosen.sCard.id, uid: 'o_6', level: 1, xp: 0, upgradeType: null, phase: 1, locked: false });

            return [...built, supportBuilt];
        }
