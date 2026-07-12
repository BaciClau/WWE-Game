// ============ PEOPLE'S CHAMPION CHALLENGE — CORE LOGIC ============
// Event clock, the simulated community vote race, the player's per-event state,
// end-of-event finalization (champion card grant) and the PCC match outcome hook
// called from endMatch(). All UI lives in src/ui/pcc-screen.js.

// Which event cycle a timestamp falls in, and where inside it.
function getPccCycleInfo(now) {
    now = now || Date.now();
    const cycleIdx = Math.floor((now - PCC_EPOCH) / PCC_CYCLE_MS);
    const tIn = now - (PCC_EPOCH + cycleIdx * PCC_CYCLE_MS);
    const matchup = PCC_MATCHUPS[((cycleIdx % PCC_MATCHUPS.length) + PCC_MATCHUPS.length) % PCC_MATCHUPS.length];
    const active = tIn < PCC_ACTIVE_MS;
    return {
        cycleIdx, matchup, active,
        // While live: time to the final bell. In intermission: time to the next matchup.
        remainingMs: active ? (PCC_ACTIVE_MS - tIn) : (PCC_CYCLE_MS - tIn),
        elapsedActiveMs: Math.min(tIn, PCC_ACTIVE_MS),
    };
}

// Deterministic per-cycle PRNG (mulberry32) — the community's voting history for a
// given event is a pure function of (cycleIdx, hour), so reloading the page never
// rewrites the past and both "sides" can be recomputed at any time, including for a
// cycle that already ended (finalization of a stale save).
function _pccRand(seed) {
    let t = seed >>> 0;
    return function () {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

// Community votes for both sides after `elapsedMs` of a given cycle. Both sides share
// the same base hourly turnout (the race reads as huge either way); only a small
// seeded per-hour delta separates them — so the gap stays in the low thousands and a
// dedicated player's own votes (500/point) genuinely matter.
function getPccCommunityVotes(cycleIdx, elapsedMs) {
    const rand = _pccRand(cycleIdx * 2654435761 + 97);
    const fullHours = Math.floor(Math.min(elapsedMs, PCC_ACTIVE_MS) / 3600000);
    const frac = Math.min(1, Math.max(0, (Math.min(elapsedMs, PCC_ACTIVE_MS) - fullHours * 3600000) / 3600000));
    let a = 0, b = 0;
    const totalHours = Math.ceil(PCC_ACTIVE_MS / 3600000);
    for (let h = 0; h < totalHours; h++) {
        const base = 7000 + Math.floor(rand() * 5000);
        const delta = Math.floor((rand() - 0.5) * 700);
        if (h < fullHours || (h === fullHours && frac > 0)) {
            const share = h < fullHours ? 1 : frac;
            a += Math.floor((base + delta) * share);
            b += Math.floor((base - delta) * share);
        } else {
            // Still consume the PRNG so past hours never change as time advances.
        }
    }
    return { a, b };
}

function ensurePccState() {
    if (!player.pcc) {
        player.pcc = { cycle: null, side: null, points: 0, wins: 0, losses: 0, claimedMilestones: [] };
    }
    return player.pcc;
}

// Player's vote contribution to their own side for display/finalize.
function getPccPlayerVotes() {
    return (player.pcc && player.pcc.side) ? player.pcc.points * PCC_VOTES_PER_POINT : 0;
}

// Called on entering the event screen (and by the menu banner): if the stored state
// belongs to a cycle whose VOTING has already closed, settle it — decide the community
// winner, hand out the champion card / consolation — then reset for the current cycle.
// `onDone(resultHtmlOrNull)` runs after any reward UI so the caller can re-render.
//
// Gated on the 66h ACTIVE window closing, NOT on the full 72h cycle rolling over: the
// old version compared cycleIdx (which only advances after the whole 72h, active+break)
// against the stored cycle, so a player who finished playing right as voting closed sat
// staring at "ring being set up" for the entire 6h break with zero payout and — worse —
// that break screen showed THEIR OWN just-closed matchup mislabeled as "come back for
// X vs Y", as if it were still upcoming. Voting closing is what actually decides the
// outcome, so that's the real trigger.
function settlePccIfNeeded(onDone) {
    const s = ensurePccState();
    const info = getPccCycleInfo();
    const votingCloseTime = (s.cycle !== null) ? (PCC_EPOCH + s.cycle * PCC_CYCLE_MS + PCC_ACTIVE_MS) : 0;
    const votingClosedForStored = s.cycle !== null && Date.now() >= votingCloseTime;
    if (!votingClosedForStored) { onDone(null); return; }

    // Never participated in the old cycle (or first visit ever) — just roll forward.
    if (s.cycle === null || !s.side || s.points <= 0) {
        player.pcc = { cycle: info.cycleIdx, side: null, points: 0, wins: 0, losses: 0, claimedMilestones: [] };
        save(false);
        onDone(null);
        return;
    }

    // Finalize the OLD cycle the player fought in.
    const oldCycle = s.cycle;
    const oldMatchup = PCC_MATCHUPS[((oldCycle % PCC_MATCHUPS.length) + PCC_MATCHUPS.length) % PCC_MATCHUPS.length];
    const votes = getPccCommunityVotes(oldCycle, PCC_ACTIVE_MS);
    const mine = s.points * PCC_VOTES_PER_POINT;
    const aTotal = votes.a + (s.side === 'a' ? mine : 0);
    const bTotal = votes.b + (s.side === 'b' ? mine : 0);
    const mySideWon = (s.side === 'a') ? (aTotal >= bTotal) : (bTotal >= aTotal);
    const champKey = s.side === 'a' ? oldMatchup.a : oldMatchup.b;
    const champ = getPccChampion(champKey);

    // Contribution tier from points, then drop one tier on a community loss.
    let tierIdx = -1;
    PCC_REWARD_TIERS.forEach((t, i) => { if (s.points >= t.points) tierIdx = i; });
    if (!mySideWon) tierIdx -= 1;

    const summary = `${champ.name}: ${(s.side === 'a' ? aTotal : bTotal).toLocaleString()} votes vs ${(s.side === 'a' ? bTotal : aTotal).toLocaleString()}`;
    player.pcc = { cycle: info.cycleIdx, side: null, points: 0, wins: 0, losses: 0, claimedMilestones: [] };

    if (tierIdx >= 0) {
        const cardId = getPccCardId(champKey, PCC_REWARD_TIERS[tierIdx].rarity);
        addCard(cardId);
        save();
        const headline = mySideWon
            ? `🏆 ${champ.name.toUpperCase()} IS THE PEOPLE'S CHAMPION!`
            : `😤 Your side lost the vote... but your effort still counts.`;
        showNotification(`${headline}<br><span style="font-size:14px;color:#bbb;">${summary}</span>`, 3200, () => {
            showCardSummaryModal([cardId], "PEOPLE'S CHAMPION REWARD", () => onDone(true));
        });
    } else {
        // Lost the vote at the lowest tier — picks-only consolation.
        player.picks += PCC_LOSER_CONSOLATION_PICKS;
        save();
        showNotification(`😤 ${champ.name} lost the People's Champion vote.<br><span style="font-size:14px;color:#bbb;">${summary}</span><br>You received ${PCC_LOSER_CONSOLATION_PICKS} consolation Draft picks.`, 3200, () => onDone(true));
    }
}

// ---- PCC MATCH HOOKS ----

// Set while a PCC match is running; endMatch() routes its outcome here instead of the
// Exhibition rewards path (no picks, no win/loss record, no streak — points only).
window._pccMatch = null;

function endPccMatch(forfeit, isDraw) {
    const pm = window._pccMatch;
    window._pccMatch = null;
    const s = ensurePccState();
    incrementMission('play_pcc');
    let msg;
    if (forfeit) {
        s.losses++;
        msg = `🏳️ You forfeited — no points earned.`;
    } else if (isDraw) {
        s.points += 1;
        msg = `🤝 A DRAW! The people award you 1 point for the war.`;
    } else if (match.pScore > match.oScore) {
        s.wins++;
        s.points += pm.points;
        msg = `🎉 VICTORY! +${pm.points} POINT${pm.points > 1 ? 'S' : ''} (${(pm.points * PCC_VOTES_PER_POINT).toLocaleString()} votes) for ${pm.champName}!`;
    } else {
        s.losses++;
        msg = `💀 You lost the match... no points this time.`;
    }
    save();
    showNotification(msg, 2600, () => { showScreen('pcc-screen'); renderPccScreen(true); });
}

// Starts a PCC match against generated opponent `opp` worth `points` — the PCC deal:
// FOUR of your fighter cards are drawn at random (plus your support card), not the
// whole deck, exactly like the original's "four of your cards are dealt".
function startPccMatch(opp, points, champName) {
    autoEquipDeck(); save();
    const fighters = [...player.deck.M, ...player.deck.F].sort(() => Math.random() - 0.5).slice(0, 4);
    const dealtHand = [...fighters, ...player.deck.S];

    // 'pcc' (not '1') so a mid-match refresh doesn't get booked as an Exhibition
    // forfeit on the next load (see initGame in state.js) — PCC matches don't touch
    // the Exhibition record at all.
    localStorage.setItem('sc_match_in_progress', 'pcc');
    window._pccMatch = { active: true, points, champName };
    _matchOver = false;
    _matchToken++;
    showScreen('match-screen');
    match = { round: 1, pScore: 0, oScore: 0, fallResults: [], hand: dealtHand, oppHand: opp.deck, used: [], selected: [], activeSupportUID: null, activeManagerUID: null, managerLockedIn: false, managerSlideShown: false, supportBonus: {pow:0, tgh:0, spd:0, cha:0}, matchWideBonus: {pow:0, tgh:0, spd:0, cha:0}, aiMode: opp.aiMode || 'normal', overtimePlayed: false };
    document.getElementById('score-player').innerText = "0"; document.getElementById('score-opp').innerText = "0";
    renderFallPips();
    document.getElementById('arena-area').innerHTML = '<div class="vs-badge">VS</div>';
    document.getElementById('support-status').innerText = "Tap your Support card to activate it this round!";
    nextRound();
}
