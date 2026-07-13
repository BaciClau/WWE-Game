// ============ TOUR MODE — CORE LOGIC ============
// Sequential campaign: each chapter's stages must be beaten IN ORDER, and a chapter itself
// stays locked until the PREVIOUS chapter's reward has been claimed (same "claim to unlock
// the next thing" pattern Missions/Ladder Rewards already use). Losing a stage costs
// nothing — no win/loss record, no picks lost, no streak — it's a fixed, replayable
// checkpoint, not a ladder climb; the only thing on the line each attempt is your time.

function ensureTourState() {
    if (!player.tour) player.tour = { stageProgress: {}, claimedChapters: [] };
    if (!player.tour.stageProgress) player.tour.stageProgress = {};
    if (!player.tour.claimedChapters) player.tour.claimedChapters = [];
    return player.tour;
}

function getTourStagesBeaten(chapterId) {
    return ensureTourState().stageProgress[chapterId] || 0;
}

// 'locked' (previous chapter's reward not yet claimed), 'active' (in progress or ready to
// claim), 'complete' (reward already claimed).
function getTourChapterStatus(chapterIdx) {
    const s = ensureTourState();
    const chapter = TOUR_CHAPTERS[chapterIdx];
    if (s.claimedChapters.includes(chapter.id)) return 'complete';
    if (chapterIdx === 0) return 'active';
    const prev = TOUR_CHAPTERS[chapterIdx - 1];
    return s.claimedChapters.includes(prev.id) ? 'active' : 'locked';
}

function isTourChapterReadyToClaim(chapterIdx) {
    const chapter = TOUR_CHAPTERS[chapterIdx];
    return getTourChapterStatus(chapterIdx) === 'active'
        && getTourStagesBeaten(chapter.id) >= chapter.stages.length;
}

// ---- MATCH HOOKS ----

// Set while a Tour stage is running; endMatch() routes its outcome here instead of the
// Exhibition rewards path — see the window._tourMatch check in match.js's endMatch().
window._tourMatch = null;

function startTourStage(chapterIdx, stageIdx) {
    const chapter = TOUR_CHAPTERS[chapterIdx];
    if (!chapter || getTourChapterStatus(chapterIdx) === 'locked') return;
    const beaten = getTourStagesBeaten(chapter.id);
    if (stageIdx > beaten) return; // only the next unbeaten stage (or a replay) is playable
    const stage = chapter.stages[stageIdx];

    autoEquipDeck(); save();
    const deck = createDeckForPower(stage.power);
    const avatarCard = deck[Math.floor(Math.random() * deck.length)];

    localStorage.setItem('sc_match_in_progress', 'tour');
    window._tourMatch = { chapterIdx, stageIdx, stageName: stage.name };
    _matchOver = false;
    _matchToken++;
    showScreen('match-screen');
    match = { round: 1, pScore: 0, oScore: 0, fallResults: [], hand: [...player.deck.M, ...player.deck.F, ...player.deck.S], oppHand: deck, used: [], selected: [], activeSupportUID: null, activeManagerUID: null, managerLockedIn: false, managerSlideShown: false, supportBonus: {pow:0, tgh:0, spd:0, cha:0}, matchWideBonus: {pow:0, tgh:0, spd:0, cha:0}, aiMode: stage.aiMode || 'normal', overtimePlayed: false };
    document.getElementById('score-player').innerText = "0"; document.getElementById('score-opp').innerText = "0";
    renderFallPips();
    document.getElementById('arena-area').innerHTML = '<div class="vs-badge">VS</div>';
    document.getElementById('support-status').innerText = "Tap your Support card to activate it this round!";
    nextRound();
}

function endTourMatch(forfeit, isDraw) {
    const tm = window._tourMatch;
    window._tourMatch = null;
    const chapter = TOUR_CHAPTERS[tm.chapterIdx];
    const s = ensureTourState();
    const won = !forfeit && !isDraw && match.pScore > match.oScore;

    let msg;
    if (won) {
        const beaten = getTourStagesBeaten(chapter.id);
        const isNewStage = tm.stageIdx === beaten;
        if (isNewStage) {
            s.stageProgress[chapter.id] = beaten + 1;
            save();
            const chapterDone = s.stageProgress[chapter.id] >= chapter.stages.length;
            playSfx(chapterDone ? 'champion' : 'win'); vibrate('win');
            msg = chapterDone
                ? `🎉 VICTORY over ${tm.stageName}!<br>🏆 CHAPTER COMPLETE — claim your reward on the Tour screen!`
                : `🎉 VICTORY over ${tm.stageName}!<br>Next stage unlocked.`;
        } else {
            playSfx('win');
            msg = `🎉 VICTORY over ${tm.stageName}! (already-beaten stage — no new progress)`;
        }
    } else if (isDraw) {
        playSfx('draw');
        msg = `🤝 A draw against ${tm.stageName} — stage not beaten, try again.`;
    } else {
        playSfx('lose'); vibrate('lose');
        msg = forfeit
            ? `🏳️ You left the match with ${tm.stageName} — stage not beaten.`
            : `💀 ${tm.stageName} got the better of you this time — stage not beaten.`;
    }
    showNotification(msg, 2800, () => { showScreen('tour-screen'); renderTourScreen(); });
}

function claimTourChapterReward(chapterIdx) {
    if (!isTourChapterReadyToClaim(chapterIdx)) return;
    const chapter = TOUR_CHAPTERS[chapterIdx];
    const s = ensureTourState();

    const parts = [];
    if (chapter.reward.coins) { player.coins += chapter.reward.coins; parts.push(`+${chapter.reward.coins} Coins`); }
    if (chapter.reward.picks) { player.picks += chapter.reward.picks; parts.push(`+${chapter.reward.picks} Picks`); }
    s.claimedChapters.push(chapter.id);
    save();
    playSfx('reward');
    if (typeof updateAchievementsUI === 'function') updateAchievementsUI();
    renderTourScreen();
    // Coins/picks confirm first, THEN the pack reveal (its own modal) — a chapter reward can
    // carry both, and the pack modal would otherwise silently swallow the coins/picks text.
    showNotification(`🏆 CHAPTER COMPLETE!<br><strong>${chapter.title}</strong>${parts.length ? '<br>' + parts.join(' + ') : ''}`, 2400, () => {
        if (chapter.reward.pack) grantBonusPack(chapter.reward.pack);
    });
}
