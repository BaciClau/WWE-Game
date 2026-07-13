// ============ ACHIEVEMENTS / TROPHY ROOM — SCREEN ============
// One row per achievement, three tier pips (Bronze/Silver/Gold) showing claimed/ready/locked
// at a glance, plus a live progress bar toward whichever tier is next. Reuses the same
// .pcc-panel / .mission-row visual language as Missions and PCC so it doesn't need its own
// design language.

function enterAchievementsScreen() {
    renderAchievementsScreen();
}

function _achievementRowHTML(ach) {
    const value = ach.getValue();
    const nextIdx = getNextAchievementTier(ach);
    const maxed = nextIdx === null;
    const activeTierIdx = maxed ? ach.tiers.length - 1 : nextIdx;
    const activeTier = ach.tiers[activeTierIdx];

    const pips = ach.tiers.map((t, i) => {
        const claimed = isAchievementTierClaimed(ach.id, i);
        const ready = !claimed && isAchievementTierReady(ach, i);
        const cls = claimed ? 'ach-pip-claimed' : (ready ? 'ach-pip-ready' : 'ach-pip-locked');
        return `<span class="ach-pip ${cls}" title="${ACHIEVEMENT_TIER_LABELS[i]}: ${t.target}">${claimed ? '✔' : i + 1}</span>`;
    }).join('');

    const pct = maxed ? 100 : Math.min(100, Math.round((value / activeTier.target) * 100));
    const progressLabel = maxed ? 'ALL TIERS CLAIMED' : `${Math.min(value, activeTier.target).toLocaleString()} / ${activeTier.target.toLocaleString()}`;

    const rewardParts = [];
    if (!maxed) {
        if (activeTier.reward.coins) rewardParts.push(`<span class="mission-reward-part">💰 ${activeTier.reward.coins}</span>`);
        if (activeTier.reward.picks) rewardParts.push(`<span class="mission-reward-part">🎴 ${activeTier.reward.picks}</span>`);
    }

    let btnHtml;
    if (maxed) {
        btnHtml = `<button class="mission-claim-btn done" disabled>MAXED</button>`;
    } else if (isAchievementTierReady(ach, activeTierIdx)) {
        btnHtml = `<button class="mission-claim-btn ready" onclick="claimAchievementTier('${ach.id}', ${activeTierIdx})">CLAIM</button>`;
    } else {
        btnHtml = `<button class="mission-claim-btn" disabled>${ACHIEVEMENT_TIER_LABELS[activeTierIdx]}</button>`;
    }

    return `
        <div class="mission-row ${maxed ? 'mission-row-done' : ''}">
            <div class="mission-info">
                <div class="mission-title-text">${ach.icon} ${ach.title} <span class="ach-pips">${pips}</span></div>
                <div class="mission-desc">${ach.desc.replace('{N}', maxed ? ach.tiers[ach.tiers.length - 1].target.toLocaleString() : activeTier.target.toLocaleString())}</div>
                <div class="mission-progress-bar-bg">
                    <div class="mission-progress-bar-fill" style="width:${pct}%;"></div>
                    <div class="mission-progress-text">${progressLabel}</div>
                </div>
            </div>
            <div class="mission-reward-col">
                <div class="mission-reward">${rewardParts.join('')}</div>
                ${btnHtml}
            </div>
        </div>`;
}

function renderAchievementsScreen() {
    const listEl = document.getElementById('achievements-list');
    if (listEl) listEl.innerHTML = ACHIEVEMENTS.map(_achievementRowHTML).join('');
    const totalTiers = ACHIEVEMENTS.reduce((s, a) => s + a.tiers.length, 0);
    const claimedTiers = player.claimedAchievements.length;
    const summaryEl = document.getElementById('achievements-summary');
    if (summaryEl) summaryEl.innerText = `🏅 ${claimedTiers} / ${totalTiers} TROPHIES CLAIMED`;
    updateAchievementsDashDot();
}

function updateAchievementsUI() {
    const screen = document.getElementById('achievements-screen');
    if (screen && screen.classList.contains('active')) renderAchievementsScreen();
    updateAchievementsDashDot();
}
