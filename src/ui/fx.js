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

// Round-result reveal, in-ring — replaces the old small text popup (showNotification) after a
// clash: the winning side's card(s) scale up with a spotlight glow, the losing side fades out,
// and a short result label floats at the top of the ring. No blocking popup, just the cards.
function showRoundWinnerSpotlight(winnerSideId, loserSideId, resultLabel, resultColor, onDone) {
    const arena = document.getElementById('arena-area');
    const winnerSide = winnerSideId && document.getElementById(winnerSideId);
    const loserSide = loserSideId && document.getElementById(loserSideId);
    const vsBadge = arena.querySelector('.vs-badge');

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
    }, 1400);
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

// ============ POPUP MARE DE ABILITATE ============
// Înlocuiește vechea notificare mică de jos cu un card mare, centrat pe ecran,
// cu portretul personajului recadrat (fără bara de nivel/stats din poza originală).

function showAbilityPopup(evt, onDone) {
    let old = document.getElementById('ability-popup');
    if (old) old.remove();

    const rarity = evt.cardStats.rarity;
    const glowColor = (RARITY_FX_COLORS[rarity] || RARITY_FX_COLORS.Common)[0];
    const isAI = !!evt.isAI;
    const isSupport = !!evt.isSupport;
    const isCombined = !!evt.isCombined;
    const sideLabel = isCombined
        ? (isAI ? '⚠️ OPPONENT COMBO!' : '💥 COMBINED BOOST!')
        : isSupport
        ? (isAI ? '⚠️ OPPONENT SUPPORT!' : '🛠️ SUPPORT ACTIVATED!')
        : (isAI ? '⚠️ OPPONENT ABILITY!' : '⚡ ABILITY ACTIVATED!');
    const sideColor = isAI ? '#e74c3c' : '#2ecc71';

    const el = document.createElement('div');
    el.id = 'ability-popup';
    el.className = 'ability-popup-overlay';
    el.innerHTML = `
        <div class="ability-popup-card rarity-${rarity}" style="box-shadow: 0 0 55px ${glowColor}, 0 20px 60px rgba(0,0,0,0.85);">
            <div class="ability-popup-header" style="color:${sideColor}; border-color:${sideColor};">${sideLabel}</div>
            <div class="ability-portrait" style="border-color:${glowColor}; box-shadow: 0 0 25px ${glowColor} inset;">
                <img src="${evt.cardStats.img}" onload="fitCardImage(this)">
            </div>
            <div class="ability-popup-name">${evt.cardStats.name}</div>
            <div class="ability-popup-move"><span class="ability-popup-icon">${evt.ab.icon}</span>${evt.ab.name}</div>
            <div class="ability-popup-bonus">+${evt.bonus} ${evt.statName.toUpperCase()}</div>
            <div class="ability-popup-desc">${evt.ab.desc}</div>
            <div class="ability-popup-tap">TAP TO CONTINUE</div>
        </div>
    `;
    document.body.appendChild(el);

    requestAnimationFrame(() => {
        const portrait = el.querySelector('.ability-portrait');
        if (portrait) burstAtElement(portrait, rarity, { spread: 150 });
    });

    let done = false;
    const finish = () => {
        if (done) return;
        done = true;
        el.classList.add('ability-popup-out');
        setTimeout(() => { el.remove(); if (onDone) onDone(); }, 220);
    };
    el.addEventListener('click', finish);
    setTimeout(finish, 2300);
}

// Rulează popup-urile de abilitate unul câte unul (nu suprapuse), în ordinea activării.
// onAllDone se apelează după ce ULTIMUL popup s-a închis — folosit ca să "înghețe"
// gameplay-ul (nu se continuă runda) cât timp mai sunt abilități de arătat.
function queueAbilityPopups(events, onAllDone) {
    if (!events || events.length === 0) { if (onAllDone) onAllDone(); return; }
    let i = 0;
    const next = () => {
        if (i >= events.length) { if (onAllDone) onAllDone(); return; }
        showAbilityPopup(events[i++], next);
    };
    next();
}
