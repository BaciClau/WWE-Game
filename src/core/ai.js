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

function chooseAiPlay(match) {
    const aiMode = match.aiMode || 'normal';
    const activeStat = match.rule.stat;
    const cardsNeeded = match.rule.r;
    const roundsLeft = 3 - match.round + 1;
    const aiAhead = match.oScore > match.pScore;
    const aiBehind = match.oScore < match.pScore;

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
        result.cards = chooseHardCards(availableCards, activeStat, cardsNeeded, aiAhead, aiBehind, roundsLeft, match.round);
        result.support = chooseHardSupport(availableSupport, activeStat, aiBehind, match.round);
    } else {
        result.cards = chooseNightmareCards(availableCards, activeStat, cardsNeeded, aiAhead, aiBehind, roundsLeft, match);
        result.support = chooseNightmareSupport(availableSupport, activeStat, aiBehind, match.round);
    }

    if (result.support) {
        result.supportBonus = result.support[activeStat] || 0;
    }

    return result;
}

function chooseEasySupport(availableSupport) {
    if (availableSupport.length === 0 || Math.random() >= 0.15) return null;
    return shuffleCards(availableSupport)[0];
}

function chooseBestSupportForStat(availableSupport, activeStat) {
    const usefulSupport = sortByStat(availableSupport, activeStat).find(card => (card[activeStat] || 0) > 0);
    return usefulSupport || null;
}

function chooseHardCards(availableCards, activeStat, cardsNeeded, aiAhead, aiBehind, roundsLeft, round) {
    const sortedByActiveStat = sortByStat(availableCards, activeStat);
    const sortedByTotal = [...availableCards].sort((a, b) => getCardTotal(b) - getCardTotal(a));

    if (aiBehind || round === 3) {
        return sortedByActiveStat.slice(0, cardsNeeded);
    }

    if (aiAhead && roundsLeft > 1) {
        const reservedUids = sortedByTotal.slice(0, 1).map(card => card.uid);
        const playable = sortedByActiveStat.filter(card => !reservedUids.includes(card.uid));
        return (playable.length >= cardsNeeded ? playable : sortedByActiveStat).slice(0, cardsNeeded);
    }

    return sortedByActiveStat.slice(0, cardsNeeded);
}

function chooseHardSupport(availableSupport, activeStat, aiBehind, round) {
    const bestSupport = chooseBestSupportForStat(availableSupport, activeStat);
    if (!bestSupport) return null;

    const supportValue = bestSupport[activeStat] || 0;
    if (aiBehind || round === 3 || supportValue > 50) return bestSupport;
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

function chooseNightmareSupport(availableSupport, activeStat, aiBehind, round) {
    const bestSupport = chooseBestSupportForStat(availableSupport, activeStat);
    if (bestSupport) return bestSupport;
    if (aiBehind && round === 3 && availableSupport.length > 0) return availableSupport[0];
    return null;
}
