// ============ ACHIEVEMENTS — CORE LOGIC ============
// Claim ids are "<achievementId>_t<tierIndex>" (e.g. "ach_collector_t0") — stored flat in
// player.claimedAchievements, same list-of-strings pattern as player.completedMissions.

function achievementTierClaimId(achId, tierIdx) { return `${achId}_t${tierIdx}`; }

function isAchievementTierClaimed(achId, tierIdx) {
    return player.claimedAchievements.includes(achievementTierClaimId(achId, tierIdx));
}

// The next not-yet-claimed tier for an achievement (or null if every tier is claimed) —
// only ONE tier is ever claimable at a time, in order, even if the live value already
// blows past a later tier's target (grinding past Bronze while offline still unlocks
// Bronze first, Silver second, exactly like reaching them one at a time would).
function getNextAchievementTier(ach) {
    for (let i = 0; i < ach.tiers.length; i++) {
        if (!isAchievementTierClaimed(ach.id, i)) return i;
    }
    return null;
}

function isAchievementTierReady(ach, tierIdx) {
    if (isAchievementTierClaimed(ach.id, tierIdx)) return false;
    if (getNextAchievementTier(ach) !== tierIdx) return false; // must claim in order
    return ach.getValue() >= ach.tiers[tierIdx].target;
}

function claimAchievementTier(achId, tierIdx) {
    const ach = ACHIEVEMENTS.find(a => a.id === achId);
    if (!ach || !isAchievementTierReady(ach, tierIdx)) return;
    const tier = ach.tiers[tierIdx];

    const parts = [];
    if (tier.reward.coins) { player.coins += tier.reward.coins; parts.push(`+${tier.reward.coins} Coins`); }
    if (tier.reward.picks) { player.picks += tier.reward.picks; parts.push(`+${tier.reward.picks} Picks`); }

    player.claimedAchievements.push(achievementTierClaimId(achId, tierIdx));
    save();
    updateUI();
    if (typeof updateAchievementsUI === 'function') updateAchievementsUI();
    playSfx('reward');
    showNotification(`🏅 ${ACHIEVEMENT_TIER_LABELS[tierIdx]} TROPHY!<br><strong>${ach.icon} ${ach.title}</strong><br>${parts.join(' + ')}`, 2600);
}

// Powers the little red dot on the main-menu ACHIEVEMENTS button — true the moment ANY
// tier of ANY achievement is ready to claim, so the player never has to open the screen
// just to check.
function hasAnyClaimableAchievement() {
    return ACHIEVEMENTS.some(ach => {
        const next = getNextAchievementTier(ach);
        return next !== null && isAchievementTierReady(ach, next);
    });
}

function updateAchievementsDashDot() {
    const dot = document.getElementById('achievements-dash-dot');
    if (!dot) return;
    dot.style.display = hasAnyClaimableAchievement() ? 'block' : 'none';
}
