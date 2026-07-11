// ============ DAILY LOGIN BONUS ============
// A small, ever-repeating 7-day drip — calibrated the same way the daily missions are: a
// nice bonus for showing up, never the main event. Day 7's free pack is the biggest single
// payout in the cycle and even that stays modest (Rare/SuperRare, same pool the win-streak
// free pack already draws from) — nothing here should ever rival what a real day of playing
// (missions + Exhibition + PCC) already earns.
const LOGIN_BONUS_GRACE_MS = 48 * 60 * 60 * 1000; // miss more than 2 days -> streak resets
const LOGIN_BONUS_SCHEDULE = [
    { day: 1, coins: 50 },
    { day: 2, coins: 75 },
    { day: 3, picks: 1 },
    { day: 4, coins: 100 },
    { day: 5, picks: 2 },
    { day: 6, coins: 150 },
    { day: 7, picks: 3, pack: ['Rare', 'SuperRare'] },
];

function ensureLoginBonusState() {
    if (player.loginStreak === undefined) player.loginStreak = 0;
    if (player.lastLoginClaim === undefined) player.lastLoginClaim = null;
}

// Which cycle day the NEXT claim would land on (1-7) — doesn't mutate state, safe to call
// from render paths. A streak lapsed past the grace window claims as a fresh Day 1.
function getNextLoginDay() {
    ensureLoginBonusState();
    if (!player.lastLoginClaim || Date.now() - player.lastLoginClaim >= LOGIN_BONUS_GRACE_MS) return 1;
    return (player.loginStreak % 7) + 1;
}

function canClaimLoginBonus() {
    ensureLoginBonusState();
    if (!player.lastLoginClaim) return true;
    // One claim per real day — the missions' own 24h cadence (MISSION_DAILY_RESET_MS).
    return Date.now() - player.lastLoginClaim >= MISSION_DAILY_RESET_MS;
}

function claimLoginBonus() {
    if (!canClaimLoginBonus()) return;
    const lapsed = !player.lastLoginClaim || Date.now() - player.lastLoginClaim >= LOGIN_BONUS_GRACE_MS;
    player.loginStreak = lapsed ? 1 : player.loginStreak + 1;
    player.lastLoginClaim = Date.now();

    const dayIdx = (player.loginStreak - 1) % 7;
    const reward = LOGIN_BONUS_SCHEDULE[dayIdx];
    const parts = [];
    if (reward.coins) { player.coins += reward.coins; parts.push(`+${reward.coins} Coins`); }
    if (reward.picks) { player.picks += reward.picks; parts.push(`+${reward.picks} Draft Pick${reward.picks > 1 ? 's' : ''}`); }
    save();
    renderLoginBonusModal();
    updateLoginBonusDashDot();

    if (reward.pack) {
        // grantBonusPack (draft-shop.js) opens its own reveal modal on top — same free-pack
        // flow the win-streak reward already uses, so the payoff feels consistent.
        grantBonusPack(reward.pack);
    } else {
        showNotification(`📅 DAY ${reward.day} LOGIN BONUS!<br>${parts.join(' + ')}`, 2200);
    }
}

function openLoginBonusModal() {
    ensureLoginBonusState();
    renderLoginBonusModal();
    document.getElementById('login-bonus-modal').style.display = 'flex';
}
function closeLoginBonusModal() {
    document.getElementById('login-bonus-modal').style.display = 'none';
}

function renderLoginBonusModal() {
    const track = document.getElementById('login-bonus-track');
    const claimBtn = document.getElementById('login-bonus-claim-btn');
    const note = document.getElementById('login-bonus-note');
    if (!track) return;

    const canClaim = canClaimLoginBonus();
    const nextDay = getNextLoginDay();
    // "Claimed" chips: every day up to (but not including) the one that's next, WITHIN the
    // current unbroken streak — i.e. if the streak lapsed, nothing shows as claimed even
    // though loginStreak still holds the old count (that count gets overwritten on next claim).
    const lapsed = !player.lastLoginClaim || Date.now() - player.lastLoginClaim >= LOGIN_BONUS_GRACE_MS;
    const claimedDayInCycle = lapsed ? 0 : ((player.loginStreak - 1) % 7) + 1;

    track.innerHTML = LOGIN_BONUS_SCHEDULE.map(r => {
        const isClaimedToday = !lapsed && claimedDayInCycle === r.day && !canClaim;
        const isNext = canClaim && nextDay === r.day;
        const rewardLabel = r.pack ? `🎁 PACK +${r.picks}` : (r.coins ? `💰${r.coins}` : `🎴${r.picks}`);
        return `
            <div class="login-day-chip ${isClaimedToday ? 'login-day-claimed' : ''} ${isNext ? 'login-day-next' : ''} ${r.day === 7 ? 'login-day-big' : ''}">
                <div class="login-day-num">DAY ${r.day}</div>
                <div class="login-day-reward">${rewardLabel}</div>
                ${isClaimedToday ? '<div class="login-day-check">✔</div>' : ''}
            </div>`;
    }).join('');

    if (canClaim) {
        claimBtn.style.display = 'inline-flex';
        claimBtn.innerText = `CLAIM DAY ${nextDay}`;
        claimBtn.onclick = claimLoginBonus;
        note.innerText = player.loginStreak > 0 ? `Current streak: ${player.loginStreak} day${player.loginStreak === 1 ? '' : 's'}` : 'Come back every day to keep your streak going!';
    } else {
        claimBtn.style.display = 'none';
        const nextClaimAt = player.lastLoginClaim + MISSION_DAILY_RESET_MS;
        note.innerText = `✅ Already claimed today — streak: ${player.loginStreak} day${player.loginStreak === 1 ? '' : 's'}. Next bonus in ${formatCountdown(Math.max(0, nextClaimAt - Date.now()))}.`;
    }
}

// Small red dot on the main-menu button — same "something's waiting" language a mission's
// ready-to-claim glow already uses, so a bonus never goes unnoticed without being pushy.
function updateLoginBonusDashDot() {
    const dot = document.getElementById('login-bonus-dot');
    if (!dot) return;
    dot.style.display = canClaimLoginBonus() ? 'block' : 'none';
}
