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

function renderOppSelectDeckStrip() {
    const strip = document.getElementById('opp-deck-strip');
    if (!strip) return;
    const uids = [...player.deck.M, ...player.deck.F, ...player.deck.S];
    strip.innerHTML = uids.map(uid => {
        const card = player.inventory.find(c => c.uid === uid);
        if (!card) return '';
        const base = getCardBase(card);
        return `<div class="opp-deck-thumb rarity-${base.rarity}"><img src="${base.img}" onload="fitCardImage(this)"></div>`;
    }).join('');
}

function showOpponentSelect() {
            autoEquipDeck();
            renderOppSelectDeckStrip();
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
        // card of this rarity could actually have (level 1-baseMax = no upgrade,
        // baseMax-proMax = Pro) that produces that same multiplier via the real
        // getStatMultiplier() formula (inverted).
        function multiplierToLevel(rarity, m) {
            const baseMax = LEVEL_CAPS[rarity] || UPGRADE.BASE_MAX;
            const proMax = PRO_LEVEL_CAPS[rarity] || (baseMax + 5);
            let lv = (m - 1) * baseMax / (UPGRADE.MAX_STAT_RATIO - 1);
            if (lv <= baseMax) {
                lv = Math.max(1, Math.min(baseMax, Math.round(lv)));
                return { level: lv, upgradeType: null, phase: 1 };
            }
            lv = Math.max(baseMax, Math.min(proMax, Math.round(lv)));
            return { level: lv, upgradeType: 'normal', phase: 1 };
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
        // multiplier the M+F cards would need to hit targetPower, plus what power actually
        // results once that multiplier is rounded to a real, achievable level (level can't
        // go below 1, so a rarity whose level-1 floor already exceeds the target will
        // overshoot — that overshoot is exactly what actualPower reports).
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
            const lvlInfo = multiplierToLevel(rarity, multiplier);
            const actualMultiplier = getStatMultiplier({ id: mCards[0].id, level: lvlInfo.level, upgradeType: lvlInfo.upgradeType, phase: lvlInfo.phase });
            const actualPower = baseSum * actualMultiplier + supportSum;

            return { mCards, fCards, sCard, lvlInfo, actualPower };
        }

        // Builds an enemy team using real cards at a real, achievable level/upgrade state
        // (same stat formulas as the player's own cards) instead of arbitrarily rescaled
        // stats — so the whole deck looks like another buildable roster, just aimed at
        // roughly the target power, not a hand-tuned/impossible lineup.
        //
        // Every rarity is tried, and whichever one's actually-achievable result (after
        // rounding to a real level) lands closest to the target power wins. A simpler
        // "first rarity above some tolerance" search was tried before, but any tolerance
        // loose enough to reliably find a match also let the result overshoot by as much
        // as the tolerance itself (e.g. an 0.85 tolerance could floor to level 1 and land
        // ~18% over target) — trying all 8 and picking the closest has no such gap.
        function createDeckForPower(targetPower) {
            let best = null;
            let bestDiff = Infinity;
            for (let i = 0; i < RARITY_ORDER.length; i++) {
                const attempt = draftAttempt(RARITY_ORDER[i], targetPower);
                const diff = Math.abs(attempt.actualPower - targetPower);
                if (diff < bestDiff) {
                    bestDiff = diff;
                    best = attempt;
                }
            }

            const levelableCards = [...best.mCards, ...best.fCards];
            const built = levelableCards.map((c, i) => {
                const cardObj = { id: c.id, uid: 'o_'+i, level: best.lvlInfo.level, xp: 0, upgradeType: best.lvlInfo.upgradeType, phase: best.lvlInfo.phase, locked: false };
                return getStats(cardObj);
            });
            const supportBuilt = getStats({ id: best.sCard.id, uid: 'o_6', level: 1, xp: 0, upgradeType: null, phase: 1, locked: false });

            return [...built, supportBuilt];
        }
