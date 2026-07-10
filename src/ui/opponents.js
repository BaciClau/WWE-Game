// Nume gamer-tag random pentru adversari (mereu re-generate, nu identitati persistente)
const GAMER_TAG_PARTS = ['Shadow', 'Swag', 'Turbo', 'Ninja', 'Savage', 'Iron', 'Ghost', 'Rusty', 'Toxic', 'Silent', 'Rogue', 'Cosmic', 'Blaze', 'Frost', 'Viper', 'Rebel'];
const GAMER_TAG_SUFFIXES = ['Killer', 'Pro', 'King', 'One', 'X', 'Boom', 'Legend', 'TTV', 'Prime', 'Zero'];

function generateGamerTag() {
    const part = GAMER_TAG_PARTS[Math.floor(Math.random() * GAMER_TAG_PARTS.length)];
    const suffix = GAMER_TAG_SUFFIXES[Math.floor(Math.random() * GAMER_TAG_SUFFIXES.length)];
    const useNumber = Math.random() < 0.5;
    return useNumber ? `${part}${Math.floor(Math.random() * 900) + 10}` : `${part}${suffix}`;
}

// Genereaza un W/L cosmetic corelat cu TIER-UL AFISAT (nu cu dificultatea AI ascunsa — un
// Survivor trebuie sa arate ca un Survivor). Scalare exponentiala pe cele 18 trepte din TIERS,
// ca varianta sa fie mare intre adversari (nu doar zeci de meciuri peste tot) si un tier mare
// sa insemne mii de meciuri jucate, nu 20/40. Win rate-ul creste cu tier-ul dar cu variatie
// reala, ca sa nu fie o corelatie perfecta/robotica.
function generateOpponentWL(tierName) {
    const idx = Math.max(0, TIERS.findIndex(t => t.name === tierName));
    const p = idx / (TIERS.length - 1); // 0 (Rare) .. 1 (Survivor++)

    // "Whale" — bought/rushed their way to a high tier instead of grinding for it, so their
    // match count looks like a total beginner's regardless of how strong their deck/tier is.
    // Small, flat chance at ANY tier (rank alone shouldn't guarantee a veteran-sized W/L).
    const isWhale = Math.random() < 0.06;

    let totalGames;
    if (isWhale) {
        totalGames = 15 + Math.floor(Math.random() * 120);
    } else {
        const minGames = Math.round(15 + Math.pow(p, 1.8) * 4500);
        const maxGames = Math.round(minGames * (1.8 + Math.random() * 1.5));
        totalGames = minGames + Math.floor(Math.random() * (maxGames - minGames));

        // Rare "grinder" outlier — the sky's the limit for how much someone's played, in
        // either direction relative to their tier.
        if (Math.random() < 0.08) totalGames = Math.round(totalGames * (1.5 + Math.random() * 3));
    }

    // Whales bought their power, not necessarily the skill to use it — a so-so win rate
    // instead of the usual tier-scaled one.
    const baseRate = isWhale ? 0.4 : 0.32 + p * 0.45;
    const winRate = Math.min(0.93, Math.max(0.15, baseRate + (Math.random() * 0.3 - 0.15)));

    const wins = Math.round(totalGames * winRate);
    const losses = Math.max(0, totalGames - wins);
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
                    wl: generateOpponentWL(tier.name),
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

        // Chooses a per-card upgrade tier (none / Pro / Perfect Pro) with odds that grow with
        // how strong the opponent's overall tier is — real grinders show up more often at
        // higher ranks, instead of every opponent card sharing one flat, un-upgraded level.
        function rollUpgradeTier(p) {
            const perfectChance = 0.03 + p * 0.27;
            const proChance = 0.15 + p * 0.35;
            const roll = Math.random();
            if (roll < perfectChance) return 'perfect';
            if (roll < perfectChance + proChance) return 'pro';
            return 'none';
        }

        // Builds one card's level/upgrade state for a rolled tier. 'none' aims for roughly
        // avgMultiplier (whatever the deck's baseline solve arrived at); Pro/Perfect Pro pick
        // a random level within their own real range instead, so a card flagged as trained
        // actually LOOKS trained (random progress through that tier) rather than just being
        // power-scaled to hit an exact target.
        function cardUpgradeInfo(rarity, tier, avgMultiplier) {
            const baseMax = LEVEL_CAPS[rarity] || UPGRADE.BASE_MAX;
            const proMax = PRO_LEVEL_CAPS[rarity] || (baseMax + 5);

            if (tier === 'perfect') {
                // Perfect Pro requires both source cards fully trained before combining, so a
                // real one always banks close to MAX_STAT_RATIO — matches that baseline.
                const banked = UPGRADE.MAX_STAT_RATIO + UPGRADE.COMBINE_BASE_BONUS;
                const stretchMax = Math.max(1, proMax - baseMax);
                const level = Math.floor(Math.random() * (stretchMax + 1));
                return { level, upgradeType: 'perfect', phase: 2, comboMultiplier: banked };
            }
            if (tier === 'pro') {
                const level = Math.min(proMax, baseMax + Math.floor(Math.random() * (proMax - baseMax + 1)));
                return { level, upgradeType: 'normal', phase: 1, comboMultiplier: 1 };
            }
            let lv = Math.round((avgMultiplier - 1) * baseMax / (UPGRADE.MAX_STAT_RATIO - 1));
            lv = Math.max(1, Math.min(baseMax, lv || 1));
            return { level: lv, upgradeType: null, phase: 1, comboMultiplier: 1 };
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
            let poolM = DB.filter(c => c.gender === 'M' && c.rarity === rarity && !c.ladderReward);
            let poolF = DB.filter(c => c.gender === 'F' && c.rarity === rarity && !c.ladderReward);
            let poolS = DB.filter(c => c.gender === 'S' && c.rarity === rarity && !c.ladderReward);
            if (!poolM.length) poolM = DB.filter(c => c.gender === 'M' && !c.ladderReward);
            if (!poolF.length) poolF = DB.filter(c => c.gender === 'F' && !c.ladderReward);
            if (!poolS.length) poolS = DB.filter(c => c.gender === 'S' && !c.ladderReward);

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

            return { mCards, fCards, sCard, lvlInfo, actualPower, rarity, rawMultiplier: multiplier };
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

            // Real players don't have every card in their roster at the exact same
            // level/upgrade — roll each card's tier independently (odds scale with the
            // opponent's overall power) instead of applying one shared lvlInfo to all 6,
            // so a deck can plausibly show a mix of plain, Pro (◆), and Perfect Pro (★) cards.
            const tierIdx = TIERS.findIndex(t => t.name === getTierForPower(targetPower).name);
            const p = Math.max(0, tierIdx) / (TIERS.length - 1);

            const levelableCards = [...best.mCards, ...best.fCards];
            const built = levelableCards.map((c, i) => {
                const tier = rollUpgradeTier(p);
                const info = cardUpgradeInfo(best.rarity, tier, best.rawMultiplier);
                const cardObj = { id: c.id, uid: 'o_'+i, level: info.level, xp: 0, upgradeType: info.upgradeType, phase: info.phase, comboMultiplier: info.comboMultiplier, locked: false };
                return getStats(cardObj);
            });
            const supportBuilt = getStats({ id: best.sCard.id, uid: 'o_6', level: 1, xp: 0, upgradeType: null, phase: 1, locked: false });

            return [...built, supportBuilt];
        }
