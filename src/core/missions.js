const MISSION_DAILY_RESET_MS = 24 * 60 * 60 * 1000;
const MISSION_TIER_ORDER = ['Common', 'Uncommon', 'Rare', 'SuperRare', 'UltraRare', 'Epic', 'Legendary', 'Survivor'];

// Resets progress (and re-locks the claim button) on every repeatable mission once 24h have
// passed since the last reset. Called on game load and whenever the missions screen opens.
function checkDailyReset() {
    if (!player.lastDailyReset) {
        player.lastDailyReset = Date.now();
        save(false);
        return;
    }
    if (Date.now() - player.lastDailyReset >= MISSION_DAILY_RESET_MS) {
        MISSIONS.filter(m => m.repeatable).forEach(m => {
            player.missionProgress[m.id] = 0;
            const idx = player.completedMissions.indexOf(m.id);
            if (idx !== -1) player.completedMissions.splice(idx, 1);
        });
        player.lastDailyReset = Date.now();
        save(false);
        if (typeof updateMissionsUI === 'function') updateMissionsUI();
    }
}

// Bumps progress on every non-tier mission matching `type`. Reaching the target just makes
// the mission claimable — the reward itself is only granted via claimMissionReward() (tapping
// CLAIM on the missions screen), matching its three states (in progress / ready / done).
function incrementMission(type, amount = 1) {
    if (type === 'reach_tier') return; // handled separately by checkTierMissions()
    let changed = false;
    MISSIONS.forEach(m => {
        if (m.type !== type) return;
        if (player.completedMissions.includes(m.id)) return;
        const current = player.missionProgress[m.id] || 0;
        if (current >= m.target) return;
        player.missionProgress[m.id] = Math.min(m.target, current + amount);
        changed = true;
    });
    if (changed) {
        save();
        if (typeof updateMissionsUI === 'function') updateMissionsUI();
    }
}

// reach_tier missions don't have a numeric counter to increment — they're either met or not,
// based on the CURRENT deck tier, so they're re-checked wholesale instead of incremented.
function checkTierMissions() {
    const currentIdx = MISSION_TIER_ORDER.indexOf(calculateDeckTier().base);
    let changed = false;
    MISSIONS.filter(m => m.type === 'reach_tier').forEach(m => {
        if (player.completedMissions.includes(m.id)) return;
        const targetIdx = MISSION_TIER_ORDER.indexOf(m.target);
        const reached = currentIdx >= targetIdx ? 1 : 0;
        if ((player.missionProgress[m.id] || 0) !== reached) {
            player.missionProgress[m.id] = reached;
            changed = true;
        }
    });
    if (changed) {
        save();
        if (typeof updateMissionsUI === 'function') updateMissionsUI();
    }
}

// The Daily Sweep unlocks only when every OTHER repeatable mission has been CLAIMED (not
// just reached) — called after every claim and on daily reset. Progress-based like any
// other mission, so the existing render/claim flow needs no special cases.
function checkDailySweep() {
    const sweep = MISSIONS.find(m => m.type === 'daily_sweep');
    if (!sweep || player.completedMissions.includes(sweep.id)) return;
    const others = MISSIONS.filter(m => m.repeatable && m.type !== 'daily_sweep');
    const allClaimed = others.length > 0 && others.every(m => player.completedMissions.includes(m.id));
    const val = allClaimed ? 1 : 0;
    if ((player.missionProgress[sweep.id] || 0) !== val) {
        player.missionProgress[sweep.id] = val;
        save(false);
    }
}

function claimMissionReward(missionId) {
    const mission = MISSIONS.find(m => m.id === missionId);
    if (!mission) return;
    if (player.completedMissions.includes(missionId)) return;

    const progress = player.missionProgress[missionId] || 0;
    if (progress < mission.target) return; // not eligible yet

    const rewardParts = [];
    if (mission.reward.coins) {
        player.coins += mission.reward.coins;
        rewardParts.push(`+${mission.reward.coins} Coins`);
    }
    if (mission.reward.picks) {
        player.picks += mission.reward.picks;
        rewardParts.push(`+${mission.reward.picks} Draft Pick${mission.reward.picks > 1 ? 's' : ''}`);
    }
    if (mission.reward.card) {
        const pool = DB.filter(c => c.rarity === mission.reward.card && !c.ladderReward);
        if (pool.length > 0) {
            const card = pool[Math.floor(Math.random() * pool.length)];
            addCard(card.id);
            rewardParts.push(`+1 ${(typeof PACK_RARITY_LABELS !== 'undefined' && PACK_RARITY_LABELS[mission.reward.card]) || mission.reward.card} Card`);
        }
    }
    if (mission.reward.cardId) {
        const card = DB.find(c => c.id === mission.reward.cardId);
        if (card) {
            addCard(card.id);
            rewardParts.push(`+1 ${card.name} (${(typeof PACK_RARITY_LABELS !== 'undefined' && PACK_RARITY_LABELS[card.rarity]) || card.rarity})`);
        }
    }

    player.completedMissions.push(missionId);
    checkDailySweep();
    save();
    updateUI();
    if (typeof updateMissionsUI === 'function') updateMissionsUI();
    playSfx('reward');
    showNotification(`🎯 MISSION COMPLETE!<br><strong>${mission.title}</strong><br>${rewardParts.join(' + ')}`, 2500);
}
