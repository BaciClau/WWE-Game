// Pure DOM paint for the header tier bar — split out of updateUI() so the deck editor can
// call it with a live PREVIEW tier (computed from the in-progress draft, not the saved deck)
// without touching any of updateUI()'s side effects (missions, rank-up granting, save()).
function renderTierDisplay(tierInfo) {
    let tn = document.getElementById('tier-name');
    if (!tn) return;
    tn.innerText = tierInfo.name; tn.style.color = tierInfo.color;
    document.getElementById('tier-bar').style.width = tierInfo.pct + '%';
    document.getElementById('tier-bar').style.background = `linear-gradient(90deg, ${tierInfo.color}, #fff)`;
    document.getElementById('tier-numbers-display').innerText = `${tierInfo.current} / ${tierInfo.next}`;
}

function updateUI() {
            const favCard = player.favoriteUid ? player.inventory.find(c => c.uid === player.favoriteUid) : null;

            const hubImg = document.getElementById('hub-photo-img');
            const hubPlaceholder = document.getElementById('hub-photo-placeholder');
            const hubName = document.getElementById('hub-photo-name');
            const hubUsername = document.getElementById('hub-photo-username');
            const dashCard = document.getElementById('dash-card');
            if (hubUsername) hubUsername.innerText = player.nickname || '';
            if (hubImg && favCard) {
                const newSrc = getCardBase(favCard).img;
                if (hubImg.getAttribute('src') !== newSrc) {
                    delete hubImg.dataset.cardFitted; // allow re-processing when the favorite photo actually changes
                    hubImg.onload = () => fitCardImage(hubImg);
                    hubImg.src = newSrc;
                }
                hubImg.style.display = 'block';
                hubPlaceholder.style.display = 'none';
                hubName.innerText = getCardBase(favCard).name;
                if (dashCard) {
                    // Backdrop is tinted by the favorite card's RARITY (see .dash-rarity-* in
                    // styles.css), not a second copy of the same photo — using the photo twice
                    // (once as a cover-cropped background, once as the sharp foreground cutout)
                    // read as a ghostly double-exposure of the character.
                    dashCard.style.backgroundImage = '';
                    RARITIES.forEach(r => dashCard.classList.remove('dash-rarity-' + r));
                    dashCard.classList.add('dash-rarity-' + getCardBase(favCard).rarity);
                }
            } else if (hubImg) {
                hubImg.style.display = 'none';
                hubPlaceholder.style.display = 'flex';
                hubName.innerText = 'NO FAVORITE SET';
                if (dashCard) {
                    dashCard.style.backgroundImage = '';
                    RARITIES.forEach(r => dashCard.classList.remove('dash-rarity-' + r));
                }
            }
            if (document.getElementById('hub-wins')) document.getElementById('hub-wins').innerText = player.wins || 0;
            if (document.getElementById('hub-losses')) document.getElementById('hub-losses').innerText = player.losses || 0;

            if (document.getElementById('draft-picks')) document.getElementById('draft-picks').innerText = player.picks;
            if(document.getElementById('col-count')) document.getElementById('col-count').innerText = player.inventory.length;

            let tierInfo = calculateDeckTier();
            renderTierDisplay(tierInfo);

            if (typeof updatePccDashStatus === 'function') updatePccDashStatus();
            if (typeof updateLoginBonusDashDot === 'function') updateLoginBonusDashDot();

            if (tierInfo.name !== player.lastTierName) {
                const tierNames = TIERS.map(t => t.name);
                const newIdx = tierNames.indexOf(tierInfo.name);
                // The guarantee is a ONE-TIME reward per tier, ever — gated on the all-time
                // PEAK tier (highestTierName, which only ratchets up), not the last-displayed
                // tier. Since the deck is editable and tier now tracks whatever's equipped
                // (see calculateDeckTier), lastTierName alone would let a player farm infinite
                // guarantees by swapping a weak card in (tier drops), then back out (tier
                // "rises" again) — re-triggering the reward each time. Comparing against the
                // peak instead means only a genuinely NEW best tier ever grants one.
                const peakIdx = tierNames.indexOf(player.highestTierName);
                if (newIdx > peakIdx) {
                    player.guaranteedPickRarity = tierInfo.base;
                    // Guaranteed, but not necessarily the very next tile — mirrors the
                    // original board's rank-up reward, which lands on a random upcoming pick
                    // rather than deterministically the first one (0-4 normal picks first).
                    player.guaranteedPickDelay = Math.floor(Math.random() * 5);
                    player.highestTierName = tierInfo.name;
                    showNotification(`🎉 RANK UP! You reached <strong>${tierInfo.name}</strong>!<br>You've earned a guaranteed <strong>${tierInfo.base}</strong> card on an upcoming Draft pick!`, 3000);
                }
                player.lastTierName = tierInfo.name;
                save(false);
            }
        }

        function showScreen(id) {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById(id).classList.add('active');
            const backBtn = document.getElementById('header-back-btn');
            if (backBtn) {
                const show = id !== 'main-menu';
                backBtn.style.visibility = show ? 'visible' : 'hidden';
                backBtn.style.pointerEvents = show ? 'auto' : 'none';
            }
            if (id !== 'deck-edit-screen') {
                tradeTarget = null;
                tradeSacrifices = [];
                document.getElementById('card-focus-modal').style.display = 'none';
                if (deckEditMode) cancelDeckEdit();
            }
            if (typeof scheduleAutoScale === 'function') scheduleAutoScale();
        }

        // In-theme replacement for the native browser confirm() popup — same yes/no modal
        // look as every other popup in the game (pull-modal-overlay/box), instead of the
        // browser's own chrome. onConfirm fires only if the player taps YES.
        function showConfirmModal(message, onConfirm, yesLabel, noLabel) {
            const modal = document.getElementById('confirm-modal');
            document.getElementById('confirm-modal-title').innerText = message;
            const yesBtn = document.getElementById('confirm-modal-yes-btn');
            const noBtn = document.getElementById('confirm-modal-no-btn');
            yesBtn.innerText = yesLabel || 'YES';
            noBtn.innerText = noLabel || 'CANCEL';
            const cleanup = () => {
                modal.style.display = 'none';
                yesBtn.onclick = null;
                noBtn.onclick = null;
            };
            yesBtn.onclick = () => { cleanup(); onConfirm(); };
            noBtn.onclick = cleanup;
            modal.style.display = 'flex';
        }

        // Header back button: leaving the Bulletin Board with unclaimed draft pulls shows the
        // same "here's what you got" summary as running out of picks — otherwise it's a no-op
        // extra screen. No pulls this session → just go back, nothing to show.
        function headerBackClicked() {
            const current = document.querySelector('.screen.active');
            if (current && current.id === 'draft-board-screen' && _draftSessionPulls.length > 0) {
                const pulls = [..._draftSessionPulls];
                _draftSessionPulls = [];
                showCardSummaryModal(pulls, 'DRAFT SUMMARY', () => showScreen('main-menu'));
                return;
            }
            // The dedicated FORFEIT button is hidden now (see .match-forfeit-row in
            // styles.css) — leaving a match this way forfeits it instead, same as that button
            // did, just gated behind a confirm so a stray back-tap can't cost a match by
            // accident.
            if (current && current.id === 'match-screen') {
                showConfirmModal('Are you sure you want to forfeit the match?\nIt will count as a loss.', () => endMatch(true));
                return;
            }
            // Ladder Rewards is only ever opened from Opponent Select — back should return
            // there, not dump the player all the way out to the main menu.
            if (current && current.id === 'ladder-rewards-screen') {
                showScreen('opp-select-screen');
                return;
            }
            showScreen('main-menu');
        }

        // Several of the newly-added card photos aren't actually cut out — they carry a
        // flat grey/white studio-backdrop color (sometimes even a baked-in checkerboard —
        // a "transparency preview" grid saved as real, opaque pixels by mistake) instead of
        // real alpha, and often a lot of empty margin around the wrestler too. This keys the
        // backdrop color(s) out (sampled from the image's own border), crops tightly to
        // whatever's left (the actual subject, plus a little padding), and caches the result
        // — so every photo ends up sized to its real content instead of an arbitrary canvas,
        // which is what let small/padded photos get zoomed into just a face.
        // Image container is a fixed height on every card (CSS), always object-fit:cover —
        // no per-image contain/width branching, so no card's box ever resizes based on
        // what photo happens to be in it.
        const _bgRemovedCache = {};
        function fitCardImage(img) {
            if (!img.naturalWidth || !img.naturalHeight) return;
            if (img.dataset.cardFitted) return;

            const src = img.currentSrc || img.src;
            if (_bgRemovedCache[src]) { img.dataset.cardFitted = '1'; img.src = _bgRemovedCache[src]; return; }

            // img.onload firing doesn't always guarantee the browser has finished decoding
            // the image into a paintable state — drawing it into a canvas a hair too early
            // silently produces a blank/transparent canvas (no error thrown), which then got
            // cached and served as "the" image forever, i.e. a wrestler photo replaced by
            // nothing. img.decode() waits for a real, paint-ready frame before we touch canvas.
            const run = () => processCardImage(img, src);
            if (img.decode) img.decode().then(run).catch(run);
            else run();
        }

        function processCardImage(img, src) {
            try {
                const nw = img.naturalWidth, nh = img.naturalHeight;
                const scale = Math.min(1, 400 / Math.max(nw, nh));
                const w = Math.max(1, Math.round(nw * scale)), h = Math.max(1, Math.round(nh * scale));
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                const imgData = ctx.getImageData(0, 0, w, h);
                const data = imgData.data;

                const idx = (y,x) => (y*w+x)*4;
                let bgColors = [];
                if (data[idx(0,0)+3] >= 10) {
                    // Bucket every border pixel's color and key out whichever ones show up
                    // often enough — a flat backdrop is basically one bucket, a baked-in
                    // checkerboard splits across a couple of close-but-distinct grey/white ones.
                    const buckets = new Map();
                    const addSample = (i) => {
                        const key = (data[i]>>4)+','+(data[i+1]>>4)+','+(data[i+2]>>4);
                        const e = buckets.get(key);
                        if (e) e.count++; else buckets.set(key, { count: 1, r: data[i], g: data[i+1], b: data[i+2] });
                    };
                    for (let x = 0; x < w; x++) { addSample(idx(0,x)); addSample(idx(h-1,x)); }
                    for (let y = 0; y < h; y++) { addSample(idx(y,0)); addSample(idx(y,w-1)); }
                    const sorted = Array.from(buckets.values()).sort((a,b) => b.count - a.count);
                    const total = sorted.reduce((s,e) => s+e.count, 0);
                    bgColors = sorted.filter(e => e.count > total * 0.08).slice(0, 6);
                }

                const tolerance = 26;
                let minX=w, maxX=-1, minY=h, maxY=-1;
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const p = idx(y,x);
                        let isBg = data[p+3] < 10;
                        if (!isBg) {
                            for (const bgc of bgColors) {
                                const dr = data[p]-bgc.r, dg = data[p+1]-bgc.g, db = data[p+2]-bgc.b;
                                if (Math.sqrt(dr*dr + dg*dg + db*db) < tolerance) { isBg = true; break; }
                            }
                        }
                        if (isBg) { data[p+3] = 0; }
                        else { if (x<minX) minX=x; if (x>maxX) maxX=x; if (y<minY) minY=y; if (y>maxY) maxY=y; }
                    }
                }
                if (maxX < minX || maxY < minY) return; // nothing detected (blank/undecoded canvas) — leave the original image untouched, never cache a blank result

                ctx.putImageData(imgData, 0, 0);

                let outCanvas = canvas;
                {
                    // Crop to the actual subject (plus a small margin) instead of the full,
                    // often padding-heavy canvas — this is what makes a tiny/close-up-looking
                    // source photo end up "maxed out" to fill the card like the rest.
                    const padX = Math.round((maxX-minX) * 0.04) + 2, padY = Math.round((maxY-minY) * 0.04) + 2;
                    const cx0 = Math.max(0, minX-padX), cy0 = Math.max(0, minY-padY);
                    const cx1 = Math.min(w-1, maxX+padX), cy1 = Math.min(h-1, maxY+padY);
                    const cw = cx1-cx0+1, ch = cy1-cy0+1;
                    if (cw > 0 && ch > 0 && (cw < w || ch < h)) {
                        const cropped = document.createElement('canvas');
                        cropped.width = cw; cropped.height = ch;
                        cropped.getContext('2d').drawImage(canvas, cx0, cy0, cw, ch, 0, 0, cw, ch);
                        outCanvas = cropped;
                    }
                }

                // Blob URL, not a data URL: a data URL keeps the whole image as a ~200KB
                // base64 string in the JS heap AND in every <img src> that uses it, and the
                // browser re-decodes that string on every fresh render — with 100+ card
                // photos that's tens of MB and constant decode work on phones. A blob URL
                // is a tiny string pointing at pixels the browser stores once.
                if (outCanvas.toBlob) {
                    outCanvas.toBlob((blob) => {
                        if (!blob) return;
                        const url = URL.createObjectURL(blob);
                        _bgRemovedCache[src] = url;
                        img.dataset.cardFitted = '1';
                        img.src = url;
                    }, 'image/png');
                } else {
                    const dataUrl = outCanvas.toDataURL('image/png');
                    _bgRemovedCache[src] = dataUrl;
                    img.dataset.cardFitted = '1';
                    img.src = dataUrl;
                }
            } catch (e) { /* cross-origin image — leave it as-is */ }
        }

        // Numele abilității + bonusul fix afișat pe carte, per raritate (aceeași logică
        // folosită și în match.js pentru calculul real — aici doar pentru afișare).
        function getAbilityInfo(stats) {
            const ab = ABILITIES[stats.id];
            if (!ab || stats.rarity === 'Common') return null;
            const s1 = ab.stats[0].toUpperCase();
            const s2 = ab.stats[1].toUpperCase();
            const rarity = stats.rarity;
            let bonus = null;
            if (rarity === 'Uncommon') bonus = `${s1} +10`;
            else if (rarity === 'Rare') bonus = `${s1} +15`;
            else if (rarity === 'SuperRare') {
                const statVals = { pow: stats.pow, tgh: stats.tgh, spd: stats.spd, cha: stats.cha };
                const vals = Object.entries(statVals).filter(([k]) => statVals[k] > 0).sort((a, b) => b[1] - a[1]);
                const topStat = vals.length > 0 ? vals[0][0] : null;
                const topVal = vals.length > 0 ? vals[0][1] : 0;
                const secondVal = vals.length > 1 ? vals[1][1] : 0;
                const excels = topStat && (secondVal === 0 || (topVal - secondVal) / secondVal >= 0.05);
                if (excels && ab.stats.includes(topStat)) {
                    // Matches getAbilityBonus() in match.js exactly: the excelling stat pays
                    // +20, but the ability's OTHER stat still pays +11 when it's the active
                    // one — the old footer only showed the +20, so the player sometimes got
                    // a (correct) +11 the card never advertised.
                    const otherStat = ab.stats.find(k => k !== topStat);
                    bonus = otherStat ? `${topStat.toUpperCase()} +20, ${otherStat.toUpperCase()} +11` : `${topStat.toUpperCase()} +20`;
                } else {
                    bonus = `${s1} +11, ${s2} +11`;
                }
            }
            else if (rarity === 'UltraRare') bonus = `${s1} +17, ${s2} +17`;
            else if (rarity === 'Epic') bonus = `${s1} +25, ${s2} +25`;
            else if (rarity === 'Legendary') bonus = `${s1} +42, ${s2} +42`;
            else if (rarity === 'Survivor') bonus = `${s1} +55, ${s2} +55`;
            if (!bonus) return null;
            return { name: ab.name, bonus };
        }

        // Ce oferă un support card (obiect/acțiune sau manager) — folosit în locul
        // abilității pe footer-ul cărții.
        function getSupportEffectText(stats) {
            const parts = [];
            ['pow','tgh','spd','cha'].forEach(k => { if (stats[k] > 0) parts.push(`${k.toUpperCase()} +${stats[k]}`); });
            return parts.length ? parts.join(', ') : 'NA';
        }

        function statBlock(label, key, stats, boosted, boostedAmount, highlight, matchWideMap) {
            // A signed manager's permanent whole-deck bonus (matchWideMap) shows green right
            // on the hand card itself, same as an in-round boost — so the player already sees
            // the real number a card will fight with before picking it, instead of having to
            // do the math themselves.
            // Net per-stat delta: the all-stats map (manager buff, tag-team chemistry — which
            // applies to EVERY stat, not just the played one) plus the active-stat-only extra
            // (ability + support). Sign decides the color: green up, red down; the number on
            // the card is always the real total it fights with.
            const mwBonus = (matchWideMap && matchWideMap[key]) || 0;
            const extra = (boosted === key ? boostedAmount : 0) + mwBonus;
            const val = stats[key] + extra;
            const isPenalty = extra < 0;
            const isBoosted = extra > 0;
            // `highlight` may carry BOTH of a two-stat round's keys ('pow,cha') — the keys
            // are distinct 3-letter strings, so a simple includes() match is unambiguous.
            const isHighlight = extra === 0 && !!highlight && highlight.includes(key);
            return `
                <div class="stat-v2 ${isPenalty ? 'stat-penalty' : (isBoosted ? 'stat-boosted' : (isHighlight ? 'stat-highlight' : ''))}" data-stat="${key}">
                    <div class="stat-v2-label">${label}</div>
                    <div class="stat-v2-value">${val}</div>
                </div>`;
        }

        function renderHTMLCard(stats, selectable=false, highlight="", extraClass="", boosted="", boostedAmount=0, matchWideMap=null) {
            const isSupport = stats.gender === 'S';
            let lvlText = '';
            if (!isSupport) {
                let lvlLabel = stats.effectiveLvl ?? stats.lvl;
                let maxLabel = stats.effectiveMax ?? stats.maxLvl;
                if (stats.lvl === '?') { lvlLabel = '?'; maxLabel = '?'; }
                else if (stats.perfect && stats.phase === 2) { lvlLabel = `★${stats.lvl}`; maxLabel = `${stats.effectiveLvl}/${stats.effectiveMax}`; }
                lvlText = stats.lvl === '?' ? 'SCALAT' : `${lvlLabel}/${maxLabel}`;
            }
            const upgradeTag = stats.upgradeType === 'normal' ? '<div class="star star-normal">◆</div>' : '';

            const abilityInfo = isSupport ? null : getAbilityInfo(stats);
            const footerName = isSupport ? 'SUPPORT BONUS' : (abilityInfo ? abilityInfo.name : 'NA');
            const footerBonus = isSupport ? getSupportEffectText(stats) : (abilityInfo ? abilityInfo.bonus : '');

            const statsColHTML = isSupport ? '' : `
                <div class="card-stats-col-v2">
                    ${statBlock('POW', 'pow', stats, boosted, boostedAmount, highlight, matchWideMap)}
                    ${statBlock('TGH', 'tgh', stats, boosted, boostedAmount, highlight, matchWideMap)}
                    ${statBlock('SPD', 'spd', stats, boosted, boostedAmount, highlight, matchWideMap)}
                    ${statBlock('CHA', 'cha', stats, boosted, boostedAmount, highlight, matchWideMap)}
                </div>`;

            return `
                <div class="card rarity-${stats.rarity} ${stats.pcc ? 'pcc-reward' : (stats.ladderReward ? 'ladder-reward' : '')} ${extraClass}" onclick="${selectable ? `openCardFocus('${stats.uid}')` : ''}" id="card-${stats.uid||stats.id}">
                    ${stats.locked ? '<div class="lock-badge">🔒</div>' : ''}
                    ${stats.perfect ? '<div class="star">★</div>' : upgradeTag}
                    <div class="card-header-v2">
                        <div class="card-rarity-label">${stats.rarity}${stats.chem ? `<span class="align-diamond chem-${stats.chem}" title="${CHEM_STYLES[stats.chem].label}"></span>` : ''}</div>
                        <div class="card-name-v2">${stats.name}</div>
                    </div>
                    <div class="card-body-v2 ${isSupport ? 'card-body-support-v2' : ''}">
                        <div class="card-image-col-v2 ${isSupport ? 'card-image-col-support-v2' : ''}">
                            ${_bgRemovedCache[stats.img]
                                ? `<img src="${_bgRemovedCache[stats.img]}" data-card-fitted="1">`
                                : `<img src="${stats.img}" onload="fitCardImage(this)">`}
                            ${isSupport ? '' : `<div class="card-score-v2">${lvlText}</div>`}
                        </div>
                        ${statsColHTML}
                    </div>
                    <div class="card-ability-footer">
                        <div class="ability-footer-name-v2">${footerName}</div>
                        ${footerBonus ? `<div class="ability-footer-bonus-v2">${footerBonus}</div>` : ''}
                    </div>
                </div>
            `;
        }
