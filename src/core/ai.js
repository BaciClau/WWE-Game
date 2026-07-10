function getAiAbilityChance(aiMode) {
    if (aiMode === 'easy') return 0.15;
    if (aiMode === 'normal') return 0.33;
    if (aiMode === 'hard') return 0.42;
    return 0.50;
}

function getCardTotal(card) {
    return card.pow + card.tgh + card.spd + card.cha;
}

function sortByStat(cards, stat) {
    return [...cards].sort((a, b) => b[stat] - a[stat]);
}

function shuffleCards(cards) {
    return [...cards].sort(() => Math.random() - 0.5);
}

// The real match format (see match.js nextRound): first to 3 round wins, hard cap of 5
// rounds, plus one optional Overtime round. An earlier version of this file assumed a
// 3-round match, which made hard/nightmare AI go all-in on round 3 and have no plan at
// all for rounds 4-5 — the ones that actually decide most matches.
const AI_TOTAL_ROUNDS = 5;

function chooseAiPlay(match) {
    const aiMode = match.aiMode || 'normal';
    const activeStat = match.rule.stat;
    const cardsNeeded = match.rule.r;
    const roundsLeft = Math.max(1, AI_TOTAL_ROUNDS - match.round + 1);
    const aiAhead = match.oScore > match.pScore;
    const aiBehind = match.oScore < match.pScore;
    // A round the AI can't afford to coast through: the last regular round, Overtime, or
    // any round where either side is one win away from taking the match.
    const decisive = match.round >= AI_TOTAL_ROUNDS || match.pScore === 2 || match.oScore === 2 || !!match.overtimePlayed;

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
        result.cards = sortByStat(availableCards, activeStat).slice(0, cardsNeeded);
        result.support = chooseBestSupportForStat(availableSupport, activeStat);
    } else if (aiMode === 'hard') {
        result.cards = chooseHardCards(availableCards, activeStat, cardsNeeded, aiAhead, aiBehind, roundsLeft, decisive);
        result.support = chooseHardSupport(availableSupport, activeStat, aiBehind, decisive);
    } else {
        result.cards = chooseNightmareCards(availableCards, activeStat, cardsNeeded, aiAhead, aiBehind, roundsLeft, match);
        result.support = chooseNightmareSupport(availableSupport, activeStat);
    }

    if (result.support) {
        result.supportBonus = result.support[activeStat] || 0;
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

function chooseBestSupportForStat(availableSupport, activeStat) {
    const usefulSupport = sortByStat(availableSupport, activeStat).find(card => (card[activeStat] || 0) > 0);
    return usefulSupport || null;
}

function chooseHardCards(availableCards, activeStat, cardsNeeded, aiAhead, aiBehind, roundsLeft, decisive) {
    const sortedByActiveStat = sortByStat(availableCards, activeStat);
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

function chooseHardSupport(availableSupport, activeStat, aiBehind, decisive) {
    const bestSupport = chooseBestSupportForStat(availableSupport, activeStat);
    if (!bestSupport) return null;

    const supportValue = bestSupport[activeStat] || 0;
    if (aiBehind || decisive || supportValue > 50 || Math.random() < 0.2) return bestSupport;
    return null;
}

function chooseNightmareCards(availableCards, activeStat, cardsNeeded, aiAhead, aiBehind, roundsLeft, match) {
    const sortedByActiveStat = sortByStat(availableCards, activeStat);
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

function chooseNightmareSupport(availableSupport, activeStat) {
    // Only ever a support that actually helps on the active stat — the old fallback
    // ("play ANY support when desperate") could only fire when no support had a bonus
    // there, i.e. it burned the support card for +0.
    return chooseBestSupportForStat(availableSupport, activeStat);
}
