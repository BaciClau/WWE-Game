// EFECTE VIZUALE "PREMIUM" — camera shake, particule colorate pe raritate, explozii Survivor.
// Nu ating gameplay-ul: doar cosmetice, apelate din match.js la evenimente cheie.

const RARITY_FX_COLORS = {
    Common: ['#bdc3c7', '#7f8c8d'],
    Uncommon: ['#2ecc71', '#27ae60', '#a8ffcf'],
    Rare: ['#3498db', '#2980b9', '#aad4f5'],
    SuperRare: ['#00bcd4', '#00838f', '#7bfcff'],
    UltraRare: ['#e040fb', '#aa00ff', '#f3b6ff'],
    Epic: ['#9b59b6', '#8e44ad', '#d9b3ff'],
    Legendary: ['#f1c40f', '#f39c12', '#fff2b0'],
    Survivor: ['#e74c3c', '#ff9800', '#f1c40f', '#2ecc71', '#3498db', '#e040fb', '#ff69b4']
};

function cameraShake(big = false) {
    const cls = big ? 'camera-shake-big' : 'camera-shake';
    document.body.classList.remove('camera-shake', 'camera-shake-big');
    void document.body.offsetWidth; // forțează reflow ca animația să poată reporni
    document.body.classList.add(cls);
    setTimeout(() => document.body.classList.remove(cls), big ? 900 : 500);
}

function spawnParticles(clientX, clientY, colors, count = 16, options = {}) {
    const spread = options.spread || 110;
    const size = options.size || 8;
    const confetti = !!options.confetti;
    const lift = options.lift || 0;

    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'fx-particle' + (confetti ? ' confetti' : '');

        const angle = (Math.PI * 2 * i / count) + (Math.random() * 0.6 - 0.3);
        const dist = spread * (0.5 + Math.random() * 0.5);
        const x1 = Math.cos(angle) * dist;
        const y1 = Math.sin(angle) * dist - lift;

        el.style.setProperty('--fx-x1', x1 + 'px');
        el.style.setProperty('--fx-y1', y1 + 'px');
        el.style.left = clientX + 'px';
        el.style.top = clientY + 'px';
        el.style.background = colors[Math.floor(Math.random() * colors.length)];

        const s = size * (0.6 + Math.random() * 0.8);
        el.style.width = s + 'px';
        el.style.height = s + 'px';
        el.style.animationDuration = (0.7 + Math.random() * 0.5) + 's';

        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1500);
    }
}

// Explozie de particule colorate pe rarity, ancorată la un element din DOM (ex: o carte).
function burstAtElement(el, rarity, options = {}) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = RARITY_FX_COLORS[rarity] || RARITY_FX_COLORS.Common;
    const isSurvivor = rarity === 'Survivor';

    spawnParticles(cx, cy, colors, isSurvivor ? 34 : 16, {
        spread: isSurvivor ? 190 : 100,
        size: isSurvivor ? 10 : 7,
        confetti: isSurvivor,
        lift: isSurvivor ? 30 : 0,
        ...options
    });

    if (isSurvivor) cameraShake(false);
}

// Support card activation, in-ring — replaces the old big showAbilityPopup overlay: the actual
// support card (art + stats, same renderHTMLCard as everywhere else) slides in from the left
// under the activating side's fighter card(s), sits for a beat, then slides back out the way
// it came. Non-blocking (doesn't pause the clash sequence). tagText is the full label shown
// under the card (e.g. "+15 POW" for a one-round support boost, or "+9 POW, +9 CHA TO DECK"
// for a manager signing) — callers format it since a manager can affect several stats at once.
function showSupportBoostSlide(side, cardStats, tagText, icon = '🛠️') {
    const arena = document.getElementById('arena-area');
    if (!arena) return;
    // Remove any slide already in flight for this same side first — without this, spamming
    // the trigger (e.g. rapidly toggling a manager on/off) piles up one overlapping slide per
    // click, each with its own independent timers, instead of ever cleanly replacing itself.
    arena.querySelectorAll('.support-boost-slide-' + side).forEach(el => el.remove());
    const wrap = document.createElement('div');
    wrap.className = 'support-boost-slide support-boost-slide-' + side;
    wrap.innerHTML = renderHTMLCard(cardStats) +
        `<div class="support-boost-slide-tag">${icon} ${tagText}</div>`;
    arena.appendChild(wrap);
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('support-boost-slide-in')));
    setTimeout(() => {
        wrap.classList.remove('support-boost-slide-in');
        setTimeout(() => wrap.remove(), 450);
    }, 1600);
}

// Round-result reveal, in-ring — replaces the old small text popup (showNotification) after a
// clash: the winning side's card(s) scale up with a spotlight glow, the losing side fades out,
// and a short result label floats at the top of the ring. No blocking popup, just the cards.
function showRoundWinnerSpotlight(winnerSideId, loserSideId, resultLabel, resultColor, onDone) {
    const arena = document.getElementById('arena-area');
    const winnerSide = winnerSideId && document.getElementById(winnerSideId);
    const loserSide = loserSideId && document.getElementById(loserSideId);
    const vsBadge = arena.querySelector('.vs-badge');

    // CRITICAL: strip any still-attached animation classes first. slide-in-* used
    // `animation ... forwards`, whose fill kept overriding `transform` FOREVER — which is
    // why the winner zoom transition never actually showed on screen.
    [winnerSide, loserSide].forEach(s => { if (s) s.classList.remove('slide-in-left', 'slide-in-right', 'anim-clash-left', 'anim-clash-right'); });

    if (vsBadge) vsBadge.classList.add('vs-badge-hidden');
    if (loserSide) loserSide.classList.add('round-loser-fade');
    if (winnerSide) winnerSide.classList.add('round-winner-spotlight');

    const label = document.createElement('div');
    label.className = 'round-result-badge';
    label.style.color = resultColor;
    label.innerText = resultLabel;
    arena.appendChild(label);

    setTimeout(() => {
        label.remove();
        if (vsBadge) vsBadge.classList.remove('vs-badge-hidden');
        if (loserSide) loserSide.classList.remove('round-loser-fade');
        if (winnerSide) winnerSide.classList.remove('round-winner-spotlight');
        if (onDone) onDone();
    }, 2500); // unhurried — the zoom glides in over ~1s and the result stays readable
}

// Sărbătoare mare la câștigarea meciului — confetti multicolor din centrul ecranului + shake puternic.
function celebrateMatchWin() {
    cameraShake(true);
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 3;
    const rainbow = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#e040fb', '#00bcd4', '#ff9800'];
    spawnParticles(cx, cy, rainbow, 46, { spread: 260, size: 10, confetti: true, lift: 60 });
    setTimeout(() => spawnParticles(cx * 0.5, cy * 1.2, rainbow, 24, { spread: 180, size: 8, confetti: true }), 200);
    setTimeout(() => spawnParticles(cx * 1.5, cy * 1.2, rainbow, 24, { spread: 180, size: 8, confetti: true }), 350);
}

// ============ ACTIVĂRI PE CARTE, UNA CÂTE UNA ============
// Replaces the old full-screen ability popup: the callout now appears centered ON the
// card whose ability fired (attached to document.body — body is never transform-scaled,
// so getBoundingClientRect coordinates line up at any auto-scale), together with the
// flash + rarity burst on that same card.

// Animated stat change ON the in-ring card: the number visibly counts up (or down) to
// its new value with a scale pop, and keeps the green boost / red penalty tint after.
// This is what makes a boost READ as "my card just got stronger" instead of the final
// number silently being there from the start.
function animateStatBump(cardUid, statKey, delta, duration = 700) {
    // Always the ARENA copy of the card: the same uid also exists in the hand below (the
    // played cards stay rendered there, greyed out), so an unscoped lookup could animate
    // the number on the wrong, off-view copy and leave the in-ring one frozen.
    const arena = document.getElementById('arena-area');
    const sel = '#card-' + cardUid + ' .stat-v2[data-stat="' + statKey + '"]';
    const el = (arena && arena.querySelector(sel)) || document.querySelector(sel);
    if (!el || !delta) return;
    const valEl = el.querySelector('.stat-v2-value');
    if (!valEl) return;
    const from = parseInt(valEl.innerText, 10) || 0;
    const to = from + delta;
    el.classList.remove('stat-highlight');
    el.classList.add(delta > 0 ? 'stat-boosted' : 'stat-penalty', 'stat-bump');
    const t0 = performance.now();
    const tick = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        valEl.innerText = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
        else setTimeout(() => el.classList.remove('stat-bump'), 300);
    };
    requestAnimationFrame(tick);
}

// Tag-team chemistry announcement, floating top-center of the ring (green handshake for
// a matched pair, red clash for a mismatched one) while both cards' stats animate.
function showChemistryBadge(text, color) {
    const arena = document.getElementById('arena-area');
    if (!arena) return;
    const el = document.createElement('div');
    el.className = 'chemistry-badge';
    el.style.color = color;
    el.innerText = text;
    arena.appendChild(el);
    setTimeout(() => { el.classList.add('chemistry-badge-out'); setTimeout(() => el.remove(), 400); }, 1500);
}

function showCardActivationOverlay(evt, onDone) {
    // Same arena-first lookup as animateStatBump: the played card's uid also exists in the
    // hand below — anchoring the callout to THAT copy put it way below the ring (sometimes
    // fully off-screen), with the flash/burst on the wrong card too.
    const arena = document.getElementById('arena-area');
    const el = (arena && arena.querySelector('#card-' + evt.cardStats.uid)) || document.getElementById('card-' + evt.cardStats.uid);
    if (!el) { if (onDone) setTimeout(onDone, 50); return; }

    // If the ring is scrolled out of view (small screens scroll to reach the hand), bring
    // it back first — otherwise the callout lands at off-screen coordinates and the whole
    // activation plays invisibly.
    const preRect = el.getBoundingClientRect();
    if (preRect.top < 0 || preRect.bottom > window.innerHeight) el.scrollIntoView({ block: 'center' });

    el.classList.add('ability-active-flash');
    burstAtElement(el, evt.cardStats.rarity);
    setTimeout(() => el.classList.remove('ability-active-flash'), 900);

    const rect = el.getBoundingClientRect();
    const wrap = document.createElement('div');
    wrap.className = 'card-ability-overlay' + (evt.isAI ? ' cao-ai' : '');
    wrap.innerHTML = `
        <div class="cao-icon">${evt.ab.icon}</div>
        <div class="cao-name">${evt.ab.name}</div>
        <div class="cao-bonus">${evt.tag}</div>`;
    document.body.appendChild(wrap);
    // Clamp the callout fully on-screen: it's centered on the card, so a card hugging the
    // ring's left/right edge (tag rounds on phones) pushed half the badge past the viewport.
    const halfW = wrap.offsetWidth / 2, halfH = wrap.offsetHeight / 2, pad = 6;
    const cx = Math.min(Math.max(rect.left + rect.width / 2, pad + halfW), window.innerWidth - pad - halfW);
    const cy = Math.min(Math.max(rect.top + rect.height / 2, pad + halfH), window.innerHeight - pad - halfH);
    wrap.style.left = cx + 'px';
    wrap.style.top = cy + 'px';
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('cao-in')));

    setTimeout(() => {
        wrap.classList.remove('cao-in');
        setTimeout(() => wrap.remove(), 350);
    }, 1500);
    setTimeout(() => { if (onDone) onDone(); }, 1900);
}

// Plays every activation of the round STRICTLY one at a time, on a slow, readable beat:
// support/manager slides (with the support card's own flash+burst) and ability callouts.
// onAllDone fires only after the LAST one has fully played — the clash waits for it.
function playActivationsSequentially(list, onAllDone, isCancelled) {
    if (!list || list.length === 0) { if (onAllDone) onAllDone(); return; }
    let i = 0;
    const next = () => {
        // A cancelled round (forfeit mid-queue / a new match already started) stops cold —
        // no more slides, callouts or stat bumps, and onAllDone (the clash) never fires.
        if (isCancelled && isCancelled()) return;
        if (i >= list.length) { if (onAllDone) onAllDone(); return; }
        const a = list[i++];
        // Every step carries the stat deltas it grants — the numbers on the affected
        // cards count up/down IN SYNC with that step's own visual, one step at a time.
        const applyBumps = () => { (a.bumps || []).forEach(b => animateStatBump(b.uid, b.stat, b.delta)); };
        if (a.kind === 'support') {
            showSupportBoostSlide(a.side, a.card, a.tag, a.icon || '🛠️');
            // Flash the slide's own in-ring copy of the support card, not the greyed-out
            // duplicate still sitting in the hand (same uid, same element id).
            const arena = document.getElementById('arena-area');
            const el = (arena && arena.querySelector('#card-' + a.card.uid)) || document.getElementById('card-' + a.card.uid);
            if (el) {
                el.classList.add('ability-active-flash');
                burstAtElement(el, a.card.rarity);
                setTimeout(() => el.classList.remove('ability-active-flash'), 900);
            }
            setTimeout(applyBumps, 500); // numbers rise as the slide settles in
            setTimeout(next, 2100);
        } else if (a.kind === 'chemistry') {
            showChemistryBadge(a.text, a.color);
            applyBumps();
            setTimeout(next, 1800);
        } else {
            setTimeout(applyBumps, 350); // as the callout pops on the card
            showCardActivationOverlay(a.evt, next);
        }
    };
    next();
}
