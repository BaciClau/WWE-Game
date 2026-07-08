let _missionsCountdownTimer = null;

function enterMissionsScreen() {
    checkDailyReset();
    checkTierMissions();
    renderMissionsScreen();
}

function isMissionComplete(m) {
    if (m.type === 'reach_tier') {
        return MISSION_TIER_ORDER.indexOf(calculateDeckTier().base) >= MISSION_TIER_ORDER.indexOf(m.target);
    }
    return (player.missionProgress[m.id] || 0) >= m.target;
}

function renderMissionRewardHTML(reward) {
    const parts = [];
    if (reward.coins) parts.push(`<span class="mission-reward-part">💰 ${reward.coins}</span>`);
    if (reward.picks) parts.push(`<span class="mission-reward-part">🎴 ${reward.picks}</span>`);
    if (reward.card) {
        const color = (typeof CATALOG_RARITY_COLORS !== 'undefined' && CATALOG_RARITY_COLORS[reward.card]) || '#fff';
        const label = (typeof PACK_RARITY_LABELS !== 'undefined' && PACK_RARITY_LABELS[reward.card]) || reward.card;
        parts.push(`<span class="mission-reward-part" style="color:${color};">🃏 ${label}</span>`);
    }
    return parts.join('');
}

function renderMissionRowHTML(m) {
    const isTier = m.type === 'reach_tier';
    const claimed = player.completedMissions.includes(m.id);
    const complete = isMissionComplete(m);
    const progress = player.missionProgress[m.id] || 0;

    const pct = isTier ? (complete ? 100 : 0) : Math.min(100, Math.round((progress / m.target) * 100));
    const progressLabel = isTier ? (complete ? 'REACHED' : 'NOT YET') : `${Math.min(progress, m.target)} / ${m.target}`;

    let btnHtml;
    if (claimed) {
        btnHtml = `<button class="mission-claim-btn done" disabled>DONE</button>`;
    } else if (complete) {
        btnHtml = `<button class="mission-claim-btn ready" onclick="claimMissionReward('${m.id}')">CLAIM</button>`;
    } else {
        btnHtml = `<button class="mission-claim-btn" disabled>IN PROGRESS</button>`;
    }

    return `
        <div class="mission-row ${claimed ? 'mission-row-done' : ''}">
            <div class="mission-info">
                <div class="mission-title-text">${m.title}</div>
                <div class="mission-desc">${m.description}</div>
                <div class="mission-progress-bar-bg">
                    <div class="mission-progress-bar-fill" style="width:${pct}%;"></div>
                    <div class="mission-progress-text">${progressLabel}</div>
                </div>
            </div>
            <div class="mission-reward-col">
                <div class="mission-reward">${renderMissionRewardHTML(m.reward)}</div>
                ${btnHtml}
            </div>
        </div>
    `;
}

function updateMissionsCountdown() {
    const screen = document.getElementById('missions-screen');
    const el = document.getElementById('missions-countdown');
    if (!screen || !screen.classList.contains('active') || !el) {
        if (_missionsCountdownTimer) { clearInterval(_missionsCountdownTimer); _missionsCountdownTimer = null; }
        return;
    }
    const nextReset = (player.lastDailyReset || Date.now()) + MISSION_DAILY_RESET_MS;
    const remaining = Math.max(0, nextReset - Date.now());
    el.innerText = `RESETS IN ${formatCountdown(remaining)}`;
}

// MISSIONS screen (from the main menu) — daily missions only.
function renderMissionsScreen() {
    const list = MISSIONS.filter(m => m.repeatable);
    const listEl = document.getElementById('missions-list');
    if (listEl) listEl.innerHTML = list.map(renderMissionRowHTML).join('');

    updateMissionsCountdown();
    if (_missionsCountdownTimer) clearInterval(_missionsCountdownTimer);
    _missionsCountdownTimer = setInterval(updateMissionsCountdown, 1000);
}

// Refreshes the missions screen in place if it's the one currently on-screen — called by the
// mission tracking functions (incrementMission/checkTierMissions/claimMissionReward/
// checkDailyReset) so progress bars and CLAIM buttons update live even if triggered from
// another screen (e.g. finishing an Exhibition match while this was the last screen shown).
function updateMissionsUI() {
    const screen = document.getElementById('missions-screen');
    if (screen && screen.classList.contains('active')) renderMissionsScreen();
    const ladderScreen = document.getElementById('ladder-rewards-screen');
    if (ladderScreen && ladderScreen.classList.contains('active')) renderLadderRewardsScreen();
}

// LADDER REWARDS screen (from Exhibition) — one-time missions only.
function enterLadderRewards() {
    checkTierMissions();
    renderLadderRewardsScreen();
}

function renderLadderRewardsScreen() {
    const list = MISSIONS.filter(m => !m.repeatable);
    const listEl = document.getElementById('ladder-rewards-list');
    if (listEl) listEl.innerHTML = list.map(renderMissionRowHTML).join('');
}
