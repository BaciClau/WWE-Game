// ============ TOUR MODE — SCREEN ============
// One panel per chapter (reusing .pcc-panel), each listing its 3 fixed stages as
// .opponent-row entries — locked chapters render dimmed with a lock note, the active
// chapter shows FIGHT buttons up to its next unbeaten stage, and a completed chapter stays
// visible (checked off) so the campaign reads as a real progression, not a vanishing list.

function enterTourScreen() {
    renderTourScreen();
}

function _tourStageRowHTML(chapter, stage, stageIdx, beaten, playable) {
    const isBeaten = stageIdx < beaten;
    const isPlayable = playable && stageIdx <= beaten;
    return `
        <div class="opponent-row ${isBeaten ? 'tour-stage-beaten' : ''} ${!isPlayable ? 'tour-stage-locked' : ''}"
             ${isPlayable ? `onclick="startTourStage(${TOUR_CHAPTERS.indexOf(chapter)}, ${stageIdx})"` : ''}>
            <div class="opponent-avatar card rarity-Rare" style="display:flex; align-items:center; justify-content:center; font-size:28px;">
                ${isBeaten ? '✔️' : (isPlayable ? '🥊' : '🔒')}
            </div>
            <div class="opponent-info">
                <div class="opponent-name">${stage.name}</div>
                <div class="opponent-tier pcc-opp-label">POWER ~${stage.power.toLocaleString()}</div>
            </div>
            ${isPlayable ? '<div class="opponent-fight-btn">▶</div>' : ''}
        </div>`;
}

function _tourChapterPanelHTML(chapter, idx) {
    const status = getTourChapterStatus(idx);
    const beaten = getTourStagesBeaten(chapter.id);
    const readyToClaim = isTourChapterReadyToClaim(idx);

    if (status === 'locked') {
        const prev = TOUR_CHAPTERS[idx - 1];
        return `
            <div class="pcc-panel tour-chapter-locked">
                <div class="pcc-panel-title">🔒 ${chapter.title}</div>
                <div class="pcc-panel-note">Complete and claim "${prev.title}" to unlock.</div>
            </div>`;
    }

    const stagesHTML = chapter.stages.map((st, i) => _tourStageRowHTML(chapter, st, i, beaten, status === 'active')).join('');
    const rewardParts = [];
    if (chapter.reward.coins) rewardParts.push(`💰 ${chapter.reward.coins}`);
    if (chapter.reward.picks) rewardParts.push(`🎴 ${chapter.reward.picks}`);
    if (chapter.reward.pack) rewardParts.push(`📦 Bonus Pack`);

    const claimBtn = status === 'complete'
        ? `<button class="mission-claim-btn done" disabled>CHAPTER CLAIMED</button>`
        : readyToClaim
            ? `<button class="mission-claim-btn ready" onclick="claimTourChapterReward(${idx})">CLAIM CHAPTER REWARD</button>`
            : `<button class="mission-claim-btn" disabled>${beaten} / ${chapter.stages.length} STAGES BEATEN</button>`;

    return `
        <div class="pcc-panel ${status === 'complete' ? 'mission-row-done' : ''}">
            <div class="pcc-panel-title">${status === 'complete' ? '✔️' : '🗺️'} ${chapter.title}</div>
            <div class="pcc-panel-note" style="margin-top:-6px; margin-bottom:10px;">${chapter.tagline}</div>
            ${stagesHTML}
            <div class="tour-chapter-footer">
                <div class="mission-reward">${rewardParts.map(p => `<span class="mission-reward-part">${p}</span>`).join('')}</div>
                ${claimBtn}
            </div>
        </div>`;
}

function renderTourScreen() {
    const container = document.getElementById('tour-content');
    if (!container) return;
    container.innerHTML = TOUR_CHAPTERS.map(_tourChapterPanelHTML).join('');
    updateTourDashStatus();
}

// Main-menu banner status line — kept fresh by updateUI().
function updateTourDashStatus() {
    const el = document.getElementById('tour-dash-status');
    if (!el) return;
    const totalStages = TOUR_CHAPTERS.reduce((s, c) => s + c.stages.length, 0);
    const beatenStages = TOUR_CHAPTERS.reduce((s, c) => s + getTourStagesBeaten(c.id), 0);
    el.innerText = `${beatenStages} / ${totalStages} STAGES BEATEN`;
}
