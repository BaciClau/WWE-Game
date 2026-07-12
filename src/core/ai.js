function getAiAbilityChance(aiMode) {
    if (aiMode === 'easy') return 0.15;
    if (aiMode === 'normal') return 0.33;
    if (aiMode === 'hard') return 0.42;
    return 0.50;
}

function getCardTotal(card) {
    return card.pow + card.tgh + card.spd + card.cha;
}

// A card's value THIS round — two-stat rounds sum both required stats, so the AI
// weighs cards (and support) exactly the way the resolver will score them.
function roundStatValue(card, statKeys) {
    return statKeys.reduce((s, k) => s + (card[k] || 0), 0);
}

function sortByRoundValue(cards, statKeys) {
    return [...cards].sort((a, b) => roundStatValue(b, statKeys) - roundStatValue(a, statKeys));
}

function shuffleCards(cards) {
    return [...cards].sort(() => Math.random() - 0.5);
}

// The real match format (see match.js nextRound): the original 2014 rules — exactly 3
// falls, all played out, tied falls scoring a point for BOTH sides, plus one optional
// Overtime round on a tied final score.
const AI_TOTAL_ROUNDS = 3;

function chooseAiPlay(match) {
    const aiMode = match.aiMode || 'normal';
    const statKeys = [match.rule.stat, match.rule.stat2].filter(Boolean);
    const cardsNeeded = match.rule.r;
    const roundsLeft = Math.max(1, AI_TOTAL_ROUNDS - match.round + 1);
    const aiAhead = match.oScore > match.pScore;
    const aiBehind = match.oScore < match.pScore;
    // A round the AI can't afford to coast through: the final fall or Overtime. (With all
    // 3 falls always played, score-based urgency reduces to just "is this the last one".)
    const decisive = match.round >= AI_TOTAL_ROUNDS || !!match.overtimePlayed;

    const availableCards = match.oppHand.filter(c => c.gender === match.rule.g && !match.used.includes(c.uid));
    const availableSupport = match.oppHand.filter(c => c.gender === 'S' && !match.used.includes(c.uid));

    const result = {
        cards: [],
        support: null,
        supportBonus: 0,
        abilityChance: getAiAbilityChance(aiMode),
    };

    if (aiMode === 'easy') {
        result.cards = shuffleCards(availableCards).slice(0, cardsNeeded);
        result.support = chooseEasySupport(availableSupport);
    } else if (aiMode === 'normal') {
        result.cards = sortByRoundValue(availableCards, statKeys).slice(0, cardsNeeded);
        result.support = chooseBestSupportForStat(availableSupport, statKeys);
    } else if (aiMode === 'hard') {
        result.cards = chooseHardCards(availableCards, statKeys, cardsNeeded, aiAhead, aiBehind, roundsLeft, decisive);
        result.support = chooseHardSupport(availableSupport, statKeys, aiBehind, decisive);
    } else {
        result.cards = chooseNightmareCards(availableCards, statKeys, cardsNeeded, aiAhead, aiBehind, roundsLeft, match);
        result.support = chooseNightmareSupport(availableSupport, statKeys);
    }

    if (result.support) {
        result.supportBonus = roundStatValue(result.support, statKeys);
        // Never burn a support card for a +0 — it gets marked as used for the whole match
        // (resolveRound pushes it into match.used) with literally nothing in return. This
        // also covers easy AI's random pick landing on a support with 0 on the active stat.
        if (result.supportBonus <= 0) {
            result.support = null;
            result.supportBonus = 0;
        }
    }

    return result;
}

function chooseEasySupport(availableSupport) {
    if (availableSupport.length === 0 || Math.random() >= 0.25) return null;
    return shuffleCards(availableSupport)[0];
}

function chooseBestSupportForStat(availableSupport, statKeys) {
    const usefulSupport = sortByRoundValue(availableSupport, statKeys).find(card => roundStatValue(card, statKeys) > 0);
    return usefulSupport || null;
}

function chooseHardCards(availableCards, statKeys, cardsNeeded, aiAhead, aiBehind, roundsLeft, decisive) {
    const sortedByActiveStat = sortByRoundValue(availableCards, statKeys);
    const sortedByTotal = [...availableCards].sort((a, b) => getCardTotal(b) - getCardTotal(a));

    if (aiBehind || decisive) {
        return sortedByActiveStat.slice(0, cardsNeeded);
    }

    if (aiAhead && roundsLeft > 1) {
        const reservedUids = sortedByTotal.slice(0, 1).map(card => card.uid);
        const playable = sortedByActiveStat.filter(card => !reservedUids.includes(card.uid));
        return (playable.length >= cardsNeeded ? playable : sortedByActiveStat).slice(0, cardsNeeded);
    }

    return sortedByActiveStat.slice(0, cardsNeeded);
}

function chooseHardSupport(availableSupport, statKeys, aiBehind, decisive) {
    const bestSupport = chooseBestSupportForStat(availableSupport, statKeys);
    if (!bestSupport) return null;

    const supportValue = roundStatValue(bestSupport, statKeys);
    if (aiBehind || decisive || supportValue > 50 || Math.random() < 0.2) return bestSupport;
    return null;
}

function chooseNightmareCards(availableCards, statKeys, cardsNeeded, aiAhead, aiBehind, roundsLeft, match) {
    const sortedByActiveStat = sortByRoundValue(availableCards, statKeys);
    const sortedByTotal = [...availableCards].sort((a, b) => getCardTotal(b) - getCardTotal(a));

    if (match.oScore === 0 && match.pScore === 0 && match.round === 1) {
        return sortedByActiveStat.slice(0, cardsNeeded);
    }

    if (aiBehind) {
        return sortedByActiveStat.slice(0, cardsNeeded);
    }

    if (aiAhead && roundsLeft > 1) {
        const bestCard = sortedByTotal[0];
        const playable = sortedByActiveStat.filter(card => card.uid !== (bestCard ? bestCard.uid : ''));
        return (playable.length >= cardsNeeded ? playable : sortedByActiveStat).slice(0, cardsNeeded);
    }

    return sortedByActiveStat.slice(0, cardsNeeded);
}

function chooseNightmareSupport(availableSupport, statKeys) {
    // Only ever a support that actually helps on the required stat(s) — the old fallback
    // ("play ANY support when desperate") could only fire when no support had a bonus
    // there, i.e. it burned the support card for +0.
    return chooseBestSupportForStat(availableSupport, statKeys);
}
