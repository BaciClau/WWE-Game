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
                    // The AVATAR CARD's own rarity (Common..Survivor) — deliberately NOT the
                    // opponent's overall deck tier (Rare+/Ultra Rare++/etc.), a different scale
                    // entirely. Drives the same per-rarity card background the avatar photo
                    // sits in, same as any other card in the game.
                    avatarRarity: avatarCard.rarity,
                    wl: generateOpponentWL(tier.name),
                    tierName: tier.name,
                    tierColor: tier.color,
                };
            });

            let container = document.getElementById('opponents-container');

            // One innerHTML write for all rows — assigning `innerHTML +=` inside the loop
            // re-parsed and re-built the whole list on every iteration (needless layout work,
            // and phones feel it).
            container.innerHTML = window.currentOpponents.map((opp, idx) => `
                    <div class="opponent-row" onclick="startMatchWithOpponent(${idx})">
                        <div class="opponent-avatar card rarity-${opp.avatarRarity}">${
                            _bgRemovedCache[opp.avatarImg]
                                ? `<img src="${_bgRemovedCache[opp.avatarImg]}" data-card-fitted="1" alt="">`
                                : `<img src="${opp.avatarImg}" onload="fitCardImage(this)" alt="">`
                        }</div>
                        <div class="opponent-info">
                            <div class="opponent-name">${opp.name}</div>
                            <div class="opponent-tier" style="color:${opp.tierColor};">${opp.tierName}</div>
                            <div class="opponent-wl">WINS: ${opp.wl.wins} &nbsp; LOSSES: ${opp.wl.losses}</div>
                        </div>
                        <div class="opponent-fight-btn">▶</div>
                    </div>
                `).join('');

            const myWinsEl = document.getElementById('my-wins');
            const myLossesEl = document.getElementById('my-losses');
            if (myWinsEl) myWinsEl.innerText = player.wins || 0;
            if (myLossesEl) myLossesEl.innerText = player.losses || 0;

            showScreen('opp-select-screen');
        }

        // Given a target stat multiplier, find the plain (no upgrade) level that a real
        // player card of this rarity could actually have that produces that same
        // multiplier via the real getStatMultiplier() formula (inverted). Always plain: a
        // card with NO combine bank (comboMultiplier 1) can't exceed MAX_STAT_RATIO no
        // matter its level — Pro/Perfect need an actual bank, which is cardUpgradeInfo's
        // job, called separately wherever an upgrade tier is deliberately rolled.
        function multiplierToLevel(rarity, m) {
            const baseMax = LEVEL_CAPS[rarity] || UPGRADE.BASE_MAX;
            let lv = 1 + (m - 1) * (baseMax - 1) / (UPGRADE.MAX_STAT_RATIO - 1);
            lv = Math.max(1, Math.min(baseMax, Math.round(lv)));
            return { level: lv, upgradeType: null, phase: 1 };
        }

        // Chooses a per-card upgrade tier (none / Pro / Perfect Pro) with odds that grow with
        // how strong the opponent's overall tier is — real grinders show up more often at
        // higher ranks, instead of every opponent card sharing one flat, un-upgraded level.
        function rollUpgradeTier(p) {
            // Both chances start at ZERO for a Rare-tier (p=0) matchup — a just-started
            // player must never face Pro/Perfect Pro cards (the old flat +3%/+15% base gave
            // ~2 out of 3 beginner opponents at least one), and phase in with tier from there.
            const perfectChance = p * 0.30;
            const proChance = p * 0.50;
            const roll = Math.random();
            if (roll < perfectChance) return 'perfect';
            if (roll < perfectChance + proChance) return 'pro';
            return 'none';
        }

        // Builds one card's level/upgrade state for a rolled tier, SOLVING for whatever level
        // within that tier's real range gets closest to avgMultiplier — instead of a fully
        // random level, which is what let a level-1-power matchup roll a maxed Perfect Pro
        // card (~2.95x) with nothing to hold it back. Clamping to each tier's own range means
        // Pro/Perfect can still only overshoot by AT MOST that tier's own floor above target
        // (bounded), never by the tier's full ceiling (unbounded).
        // `p` is the opponent's own tier percentile (0 at Rare .. 1 at Survivor++) — reused
        // here to size a PLAUSIBLE combine bank for a 'pro' roll: a higher-ranked opponent
        // more plausibly combined two well-trained duplicates, not two fresh level-1s.
        function cardUpgradeInfo(rarity, tier, avgMultiplier, p) {
            const baseMax = LEVEL_CAPS[rarity] || UPGRADE.BASE_MAX;
            const proMax = PRO_LEVEL_CAPS[rarity] || (baseMax + 5);

            if (tier === 'perfect') {
                // Perfect Pro requires both source cards fully trained before combining, so a
                // real one always banks close to MAX_STAT_RATIO — matches that baseline. Same
                // 1..proMax ladder as Pro (see getStatMultiplier in cards.js) — only the ratio
                // differs.
                const banked = UPGRADE.MAX_STAT_RATIO + UPGRADE.COMBINE_BASE_BONUS;
                let lvl = Math.round(1 + (avgMultiplier - banked) * (proMax - 1) / (UPGRADE.PERFECT_STAT_RATIO - 1));
                lvl = Math.max(1, Math.min(proMax, lvl));
                return { level: lvl, upgradeType: 'perfect', phase: 2, comboMultiplier: banked };
            }
            if (tier === 'pro') {
                // Same "climb from level 1 across the full 1..proMax Pro ladder" shape as the
                // player's own getStatMultiplier() (cards.js) — a Pro card with NO bank can
                // only ever reach MAX_STAT_RATIO at proMax, same ceiling as a maxed plain
                // card, so it needs a real bank to be worth its badge. Ranges from a bare
                // COMBINE_BASE_BONUS (two barely-trained dupes) up toward Perfect Pro's own
                // baseline (two well-trained dupes, just not maxed) as p grows.
                const banked = 1 + UPGRADE.COMBINE_BASE_BONUS + (UPGRADE.MAX_STAT_RATIO - 1) * Math.min(1, p * 1.3);
                let lvl = Math.round(1 + (avgMultiplier - banked) * (proMax - 1) / (UPGRADE.MAX_STAT_RATIO - 1));
                lvl = Math.max(1, Math.min(proMax, lvl));
                return { level: lvl, upgradeType: 'normal', phase: 1, comboMultiplier: banked };
            }
            let lv = 1 + (avgMultiplier - 1) * (baseMax - 1) / (UPGRADE.MAX_STAT_RATIO - 1);
            lv = Math.max(1, Math.min(baseMax, Math.round(lv) || 1));
            return { level: lv, upgradeType: null, phase: 1, comboMultiplier: 1 };
        }

        // How far the ACTUAL built deck is allowed to drift from targetPower, as a fraction —
        // tight at low tiers (a level-1 player's very first matches must stay genuinely close,
        // ±10% at Rare) and looser at high tiers (±25% at Survivor++, where players have more
        // varied builds/training to account for). Requested directly: "la rare sa fie -10/+10,
        // faci tu calculele pentru celelalte tiere sa fie fair" — linear interpolation between
        // those two anchors across all 18 TIERS steps.
        function maxPowerDeviation(p) {
            return 0.10 + p * 0.15;
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
        // N random DISTINCT cards from a pool — a real player's deck never holds the same
        // wrestler twice (the old with-replacement draw could give an opponent duplicate
        // cards). Only if the pool itself is smaller than n do repeats become unavoidable.
        function sampleDistinctCards(pool, n) {
            if (pool.length <= n) return Array.from({ length: n }, (_, i) => pool[i % pool.length]);
            const copy = [...pool];
            const out = [];
            for (let i = 0; i < n; i++) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
            return out;
        }

        function draftAttempt(rarity, targetPower) {
            let poolM = DB.filter(c => c.gender === 'M' && c.rarity === rarity && !c.ladderReward);
            let poolF = DB.filter(c => c.gender === 'F' && c.rarity === rarity && !c.ladderReward);
            let poolS = DB.filter(c => c.gender === 'S' && c.rarity === rarity && !c.ladderReward);
            if (!poolM.length) poolM = DB.filter(c => c.gender === 'M' && !c.ladderReward);
            if (!poolF.length) poolF = DB.filter(c => c.gender === 'F' && !c.ladderReward);
            if (!poolS.length) poolS = DB.filter(c => c.gender === 'S' && !c.ladderReward);

            const mCards = sampleDistinctCards(poolM, 4);
            const fCards = sampleDistinctCards(poolF, 2);
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

            const supportBuilt = getStats({ id: best.sCard.id, uid: 'o_6', level: 1, xp: 0, upgradeType: null, phase: 1, locked: false });
            const supportTotal = supportBuilt.pow + supportBuilt.tgh + supportBuilt.spd + supportBuilt.cha;
            const levelableCards = [...best.mCards, ...best.fCards];

            const tierIdx = TIERS.findIndex(t => t.name === getTierForPower(targetPower).name);
            const p = Math.max(0, tierIdx) / (TIERS.length - 1);

            // Real players don't have every card in their roster at the exact same
            // level/upgrade — roll each card's tier independently (odds scale with the
            // opponent's overall power) instead of applying one shared lvlInfo to all 6, so a
            // deck can plausibly show a mix of plain, Pro (◆), and Perfect Pro (★) cards.
            //
            // BALANCE (the "their Perfect Pro towers over my whole deck" bug): a Pro card's
            // multiplier can never go below MAX_STAT_RATIO (its level clamps at baseMax) and
            // a Perfect Pro's never below its banked combine bonus — so against a target
            // multiplier of ~1.0-1.3 an upgraded card lands FAR above the deck's solve, and
            // the old build left every other card at full target level anyway (one monster
            // card, zero compensation; the total-only guard couldn't see it). Now the PLAIN
            // cards are re-solved to absorb exactly the upgrades' excess, so the deck total
            // still lands on targetPower — a deck with a standout card pays for it with a
            // visibly weaker rest of the roster. If even level-1 plain cards can't absorb it,
            // upgrades are downgraded (perfect→pro→none) until the math genuinely works.
            const rolls = levelableCards.map(() => rollUpgradeTier(p));
            let flavored = null;
            for (let attempt = 0; attempt < 16 && !flavored; attempt++) {
                const upgradedStats = [];
                let upgradedTotal = 0, plainBaseSum = 0;
                levelableCards.forEach((c, i) => {
                    if (rolls[i] === 'none') { plainBaseSum += c.pow + c.tgh + c.spd + c.cha; return; }
                    const info = cardUpgradeInfo(best.rarity, rolls[i], best.rawMultiplier, p);
                    const st = getStats({ id: c.id, uid: 'o_'+i, level: info.level, xp: 0, upgradeType: info.upgradeType, phase: info.phase, comboMultiplier: info.comboMultiplier, locked: false });
                    upgradedStats[i] = st;
                    upgradedTotal += st.pow + st.tgh + st.spd + st.cha;
                });

                // What the remaining plain cards must average so the WHOLE deck still hits
                // targetPower despite the upgrades' floor-clamped excess.
                const plainMult = plainBaseSum > 0 ? (targetPower - supportTotal - upgradedTotal) / plainBaseSum : 0;
                if (plainMult < 0.999 && rolls.some(r => r !== 'none')) {
                    // Even level-1 plain cards can't absorb the excess — soften the highest
                    // upgrade one step (perfect→pro, pro→none) and re-solve.
                    const di = rolls.indexOf('perfect') !== -1 ? rolls.indexOf('perfect') : rolls.findIndex(r => r === 'pro');
                    rolls[di] = rolls[di] === 'perfect' ? 'pro' : 'none';
                    continue;
                }

                const plainInfo = multiplierToLevel(best.rarity, Math.max(1, plainMult));
                flavored = levelableCards.map((c, i) => {
                    if (upgradedStats[i]) return upgradedStats[i];
                    return getStats({ id: c.id, uid: 'o_'+i, level: plainInfo.level, xp: 0, upgradeType: plainInfo.upgradeType, phase: plainInfo.phase, locked: false });
                });
            }

            // Fairness guard (final net): if the compensated build still drifts outside this
            // tier's allowed band (e.g. so many upgrade rolls that plain cards bottomed out),
            // fall back to the plain, uniformly-leveled build (same lvlInfo for every card)
            // that hits targetPower precisely — reliability over flavor when the two conflict.
            const flavoredTotal = flavored ? flavored.reduce((s, c) => s + c.pow + c.tgh + c.spd + c.cha, 0) + supportTotal : Infinity;
            const maxDev = maxPowerDeviation(p);
            if (flavored && Math.abs(flavoredTotal - targetPower) <= targetPower * maxDev) {
                return [...flavored, supportBuilt];
            }

            const built = levelableCards.map((c, i) => {
                const cardObj = { id: c.id, uid: 'o_'+i, level: best.lvlInfo.level, xp: 0, upgradeType: best.lvlInfo.upgradeType, phase: best.lvlInfo.phase, locked: false };
                return getStats(cardObj);
            });
            return [...built, supportBuilt];
        }
