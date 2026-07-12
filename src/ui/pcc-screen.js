// ============ PEOPLE'S CHAMPION CHALLENGE — SCREEN ============
// One screen, fully rendered by JS into #pcc-content: matchup banner with the live
// community vote race, side pick, the three standing opponents (+1/+3/+5), milestone
// rewards and the contribution reward track. Countdown ticks once a second while the
// screen is on, same pattern as the missions countdown.

let _pccCountdownTimer = null;
let _pccOpponents = null; // regenerated per visit and after every PCC match

function enterPccScreen() {
    settlePccIfNeeded(() => {
        _pccOpponents = null;
        showScreen('pcc-screen');
        renderPccScreen(true);
    });
}

function _pccChampionPosterHTML(champ, sideLabel, chosen) {
    // The Legendary version of the exclusive card is the event poster.
    const cardId = getPccCardId(champ.key, 'Legendary');
    const stats = getStats({ uid: 'pcc_poster_' + champ.key, id: cardId, level: 1, xp: 0, upgradeType: null, phase: 1, locked: false });
    return `
        <div class="pcc-side ${chosen ? 'pcc-side-chosen' : ''}">
            ${renderHTMLCard(stats, false, '', 'pcc-poster-card')}
            <div class="pcc-side-label">${sideLabel}</div>
        </div>`;
}

function _pccVoteBarHTML(info) {
    const s = ensurePccState();
    const votes = getPccCommunityVotes(info.cycleIdx, info.elapsedActiveMs);
    const mine = getPccPlayerVotes();
    const aTotal = votes.a + (s.side === 'a' ? mine : 0);
    const bTotal = votes.b + (s.side === 'b' ? mine : 0);
    const pctA = Math.round(aTotal / (aTotal + bTotal) * 100);
    const chA = getPccChampion(info.matchup.a), chB = getPccChampion(info.matchup.b);
    return `
        <div class="pcc-vote-race">
            <div class="pcc-vote-names"><span>${chA.name.toUpperCase()}</span><span>${chB.name.toUpperCase()}</span></div>
            <div class="pcc-vote-bar"><div class="pcc-vote-fill" style="width:${pctA}%;"></div></div>
            <div class="pcc-vote-counts"><span>${aTotal.toLocaleString()} votes</span><span>${bTotal.toLocaleString()} votes</span></div>
            ${s.side ? `<div class="pcc-vote-mine">🗳️ Your contribution: <b>${mine.toLocaleString()}</b> votes for ${getPccChampion(s.side === 'a' ? info.matchup.a : info.matchup.b).name}</div>` : ''}
        </div>`;
}

// The reward showcase, original-style: the ACTUAL champion cards you're fighting for,
// rendered at every tier — not just rarity names. The one your points currently earn
// glows with a check; everything above it stays visible but dimmed, as the chase.
function _pccRewardTrackHTML(s, info) {
    let earnedIdx = -1;
    PCC_REWARD_TIERS.forEach((t, i) => { if (s.points >= t.points) earnedIdx = i; });
    const champKey = s.side === 'a' ? info.matchup.a : info.matchup.b;
    const cards = PCC_REWARD_TIERS.map((t, i) => {
        const cardId = getPccCardId(champKey, t.rarity);
        const stats = getStats({ uid: 'pcc_rw_' + i, id: cardId, level: 1, xp: 0, upgradeType: null, phase: 1, locked: false });
        const earned = i <= earnedIdx;
        return `
            <div class="pcc-reward-card ${earned ? 'pcc-reward-earned' : 'pcc-reward-locked'}">
                <div class="pcc-reward-card-scale">${renderHTMLCard(stats)}${t.copies === 2 ? '<div class="pcc-reward-x2">×2</div>' : ''}</div>
                <div class="pcc-reward-req ${earned ? 'pcc-reward-req-earned' : ''}">${earned ? '✔ ' : ''}${t.points} PTS</div>
            </div>`;
    }).join('');
    const tierName = t => t.rarity + (t.copies === 2 ? ' ×2 (Perfect Pro!)' : '');
    const nextTier = PCC_REWARD_TIERS[earnedIdx + 1];
    const progressLine = earnedIdx === PCC_REWARD_TIERS.length - 1
        ? `<div class="pcc-reward-progress" style="color:#f1c40f;">🏆 MAXED OUT — the ${tierName(PCC_REWARD_TIERS[earnedIdx])} is yours at the final bell!`
            + `</div>`
        : `<div class="pcc-reward-progress">${nextTier.points - s.points} more point${nextTier.points - s.points === 1 ? '' : 's'} to the <b style="color:#f1c40f;">${tierName(nextTier)}</b> card</div>`;
    return `
        <div class="pcc-panel">
            <div class="pcc-panel-title">🏆 END-OF-EVENT REWARDS — YOUR CHAMPION CARD</div>
            <div class="pcc-reward-track">${cards}</div>
            ${progressLine}
            <div class="pcc-panel-note">Delivered when the event ends — you get the highest tier you reached. ×2 tiers drop TWO copies of the card: combine them yourself for a Perfect Pro. Win the community vote to claim the full tier — if your side loses, the reward drops one tier (below ${PCC_REWARD_TIERS[0].rarity}: ${PCC_LOSER_CONSOLATION_PICKS} consolation picks). Milestone rewards below are yours to keep either way.</div>
        </div>`;
}

function _pccMilestonesHTML(s) {
    const rows = PCC_MILESTONES.map((m, i) => {
        const reached = s.points >= m.points;
        const claimed = s.claimedMilestones.includes(i);
        let btn;
        if (claimed) btn = '<button class="mission-claim-btn done" disabled>DONE</button>';
        else if (reached) btn = `<button class="mission-claim-btn ready" onclick="claimPccMilestone(${i})">CLAIM</button>`;
        else btn = '<button class="mission-claim-btn" disabled>' + m.points + ' PTS</button>';
        return `
            <div class="mission-row ${claimed ? 'mission-row-done' : ''}">
                <div class="mission-info"><div class="mission-title-text">${m.label}</div></div>
                <div class="mission-reward-col">${btn}</div>
            </div>`;
    }).join('');
    return `<div class="pcc-panel"><div class="pcc-panel-title">🎁 EVENT MILESTONES</div>${rows}</div>`;
}

function _pccGenerateOpponents() {
    const myPower = calculateDeckTier().current;
    _pccOpponents = PCC_OPPONENT_SLOTS.map(slot => {
        const power = Math.max(1, Math.floor(myPower * (slot.minPct + Math.random() * (slot.maxPct - slot.minPct))));
        const deck = createDeckForPower(power);
        const avatarCard = deck[Math.floor(Math.random() * deck.length)];
        return { deck, aiMode: slot.aiMode, points: slot.points, label: slot.label, name: generateGamerTag(), avatarImg: avatarCard.img, avatarRarity: avatarCard.rarity };
    });
}

function _pccOpponentsHTML() {
    if (!_pccOpponents) _pccGenerateOpponents();
    return `
        <div class="pcc-panel">
            <div class="pcc-panel-title">🥊 CHALLENGERS — WIN FOR POINTS</div>
            ${_pccOpponents.map((opp, idx) => `
                <div class="opponent-row" onclick="pccFight(${idx})">
                    <div class="opponent-avatar card rarity-${opp.avatarRarity}">${
                        _bgRemovedCache[opp.avatarImg]
                            ? `<img src="${_bgRemovedCache[opp.avatarImg]}" data-card-fitted="1" alt="">`
                            : `<img src="${opp.avatarImg}" onload="fitCardImage(this)" alt="">`
                    }</div>
                    <div class="opponent-info">
                        <div class="opponent-name">${opp.name}</div>
                        <div class="opponent-tier pcc-opp-label">${opp.label}</div>
                    </div>
                    <div class="pcc-opp-points">+${opp.points}</div>
                    <div class="opponent-fight-btn">▶</div>
                </div>`).join('')}
            <div class="pcc-panel-note">4 of your cards are dealt at random each match — the rest of your deck sits this one out!</div>
        </div>`;
}

function pccChooseSide(side) {
    const s = ensurePccState();
    const info = getPccCycleInfo();
    if (!info.active || s.side) return;
    s.side = side;
    save(false);
    const champ = getPccChampion(side === 'a' ? info.matchup.a : info.matchup.b);
    showNotification(`🎤 You're with <b>${champ.name.toUpperCase()}</b>!<br>Every match you win adds votes to crown the People's Champion.`, 2600);
    renderPccScreen(false);
}

function pccFight(idx) {
    const s = ensurePccState();
    const info = getPccCycleInfo();
    if (!info.active || !s.side) return;
    if (!_pccOpponents || !_pccOpponents[idx]) return;
    const opp = _pccOpponents[idx];
    _pccOpponents = null; // fresh set of challengers after every match, like the original
    const champ = getPccChampion(s.side === 'a' ? info.matchup.a : info.matchup.b);
    startPccMatch(opp, opp.points, champ.name);
}

function claimPccMilestone(i) {
    const s = ensurePccState();
    const m = PCC_MILESTONES[i];
    if (!m || s.claimedMilestones.includes(i) || s.points < m.points) return;
    s.claimedMilestones.push(i);
    const parts = [];
    if (m.picks) { player.picks += m.picks; parts.push(`+${m.picks} Picks`); }
    if (m.coins) { player.coins += m.coins; parts.push(`+${m.coins.toLocaleString()} Coins`); }
    // Random Superstar of the given rarity from the NORMAL pool — exclusives (Ladder/
    // PCC) and support cards never drop here.
    let randomCardId = null;
    if (m.randomCard) {
        const pool = DB.filter(c => c.rarity === m.randomCard && c.gender !== 'S' && !c.ladderReward);
        if (pool.length > 0) randomCardId = pool[Math.floor(Math.random() * pool.length)].id;
        if (randomCardId !== null) addCard(randomCardId);
    }
    save();
    if (m.pack) {
        grantBonusPack(m.pack);
    } else if (randomCardId !== null) {
        showCardSummaryModal([randomCardId], '🎁 MILESTONE REWARD', () => renderPccScreen(false));
        return;
    } else {
        showNotification(`🎁 MILESTONE CLAIMED!<br>${parts.join(' • ')}`, 2200);
    }
    renderPccScreen(false);
}

function updatePccCountdown() {
    const screen = document.getElementById('pcc-screen');
    const el = document.getElementById('pcc-countdown');
    if (!screen || !screen.classList.contains('active') || !el) {
        if (_pccCountdownTimer) { clearInterval(_pccCountdownTimer); _pccCountdownTimer = null; }
        return;
    }
    const info = getPccCycleInfo();
    el.innerText = info.active ? `⏱ EVENT ENDS IN ${formatCountdown(info.remainingMs)}` : `⏱ NEXT CHALLENGE IN ${formatCountdown(info.remainingMs)}`;
}

function renderPccScreen(regenOpponents) {
    const s = ensurePccState();
    const info = getPccCycleInfo();
    const container = document.getElementById('pcc-content');
    if (!container) return;
    if (regenOpponents) _pccOpponents = null;

    // During the 6h break, info.matchup/info.cycleIdx still describe the cycle that JUST
    // closed (cycleIdx only advances once the full 72h — active+break — has elapsed) —
    // showing that in "come back for X vs Y!" would advertise the fight the player already
    // finished (and whose votes are already settled) as if it were still ahead of them.
    // The genuinely upcoming one is next cycle's matchup, which is what actually opens the
    // moment the break ends.
    const displayMatchup = info.active ? info.matchup : PCC_MATCHUPS[((info.cycleIdx + 1) % PCC_MATCHUPS.length + PCC_MATCHUPS.length) % PCC_MATCHUPS.length];
    const chA = getPccChampion(displayMatchup.a), chB = getPccChampion(displayMatchup.b);

    let body;
    if (!info.active) {
        body = `<div class="pcc-panel pcc-break-panel">
            <div class="pcc-panel-title">🛠 THE RING IS BEING SET UP...</div>
            <div class="pcc-panel-note">The next People's Champion Challenge starts soon. Come back for ${chA.name} vs ${chB.name}!</div>
        </div>`;
    } else if (!s.side) {
        body = `<div class="pcc-panel">
            <div class="pcc-panel-title">🎤 PICK YOUR CHAMPION</div>
            <div class="pcc-panel-note">Align yourself with one Superstar — your wins add votes to their total, and at the final bell you earn THEIR exclusive card. Choose wisely: you can't switch sides.</div>
            <div class="pcc-pick-row">
                <button class="menu-btn btn-play pcc-pick-btn" onclick="pccChooseSide('a')">TEAM ${chA.name.toUpperCase()}</button>
                <button class="menu-btn btn-danger pcc-pick-btn" onclick="pccChooseSide('b')">TEAM ${chB.name.toUpperCase()}</button>
            </div>
        </div>`;
    } else {
        body = `
            <div class="pcc-stats-row">
                <div class="pcc-stat-box"><div class="pcc-stat-num">${s.points}</div><div class="pcc-stat-label">POINTS</div></div>
                <div class="pcc-stat-box"><div class="pcc-stat-num">${s.wins}</div><div class="pcc-stat-label">WINS</div></div>
                <div class="pcc-stat-box"><div class="pcc-stat-num">${s.losses}</div><div class="pcc-stat-label">LOSSES</div></div>
            </div>
            ${_pccOpponentsHTML()}
            ${_pccRewardTrackHTML(s, info)}
            ${_pccMilestonesHTML(s)}`;
    }

    container.innerHTML = `
        <div class="pcc-banner">
            <div class="pcc-title">PEOPLE'S CHAMPION CHALLENGE</div>
            <div class="pcc-tagline">${displayMatchup.tagline}</div>
            <div class="pcc-matchup">
                ${_pccChampionPosterHTML(chA, 'TEAM ' + chA.name.toUpperCase(), s.side === 'a')}
                <div class="pcc-vs">VS</div>
                ${_pccChampionPosterHTML(chB, 'TEAM ' + chB.name.toUpperCase(), s.side === 'b')}
            </div>
            ${info.active ? _pccVoteBarHTML(info) : ''}
            <div class="pcc-countdown" id="pcc-countdown"></div>
        </div>
        ${body}`;

    updatePccCountdown();
    if (_pccCountdownTimer) clearInterval(_pccCountdownTimer);
    _pccCountdownTimer = setInterval(updatePccCountdown, 1000);
}

// Main-menu banner status line — kept fresh by updateUI().
function updatePccDashStatus() {
    const el = document.getElementById('pcc-dash-status');
    if (!el) return;
    const info = getPccCycleInfo();
    const chA = getPccChampion(info.matchup.a), chB = getPccChampion(info.matchup.b);
    el.innerText = info.active ? `🔴 LIVE — ${chA.name} vs ${chB.name}` : `NEXT EVENT SOON`;
}
