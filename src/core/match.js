let match = { round: 1, pScore: 0, oScore: 0, fallResults: [], hand: [], oppHand: [], used: [], selected: [], activeSupportUID: null, activeManagerUID: null, managerLockedIn: false, managerSlideShown: false, supportBonus: {pow:0, tgh:0, spd:0, cha:0}, matchWideBonus: {pow:0, tgh:0, spd:0, cha:0}, overtimePlayed: false };

        // The original match screen's fall markers: one diamond per fall (3, plus a 4th for
        // Overtime), colored by outcome from the PLAYER's perspective — green won, red lost,
        // gold shared/draw — with the fall currently being fought pulsing white.
        function renderFallPips() {
            const el = document.getElementById('fall-pips');
            if (!el) return;
            const total = 3 + (match.overtimePlayed ? 1 : 0);
            let html = '';
            for (let i = 0; i < total; i++) {
                const res = match.fallResults[i];
                const isCurrent = !res && i === match.fallResults.length && !_matchOver;
                html += `<span class="fall-pip ${res ? 'fall-' + res : ''} ${isCurrent ? 'fall-current' : ''}"${i === 3 ? ' title="OVERTIME"' : ''}></span>`;
            }
            el.innerHTML = html;
        }

        // True from the moment endMatch() runs until the next match starts. The round flow
        // has several delayed callbacks in flight at any time (clash timers, the spotlight's
        // 1.4s onDone, a queued Overtime notification) that a mid-round forfeit does NOT
        // cancel — without this guard one of them could fire AFTER the forfeit already ended
        // the match and run endMatch a second time (double loss recorded, a consolation pick
        // granted for a forfeited match, and a surprise screen jump to the draft board).
        let _matchOver = false;
        // Generation counter: _matchOver alone can't stop a STALE round's delayed work once
        // a NEW match has started (which resets _matchOver to false) — the activation queue
        // can run for many seconds, and a player who forfeits mid-queue and jumps straight
        // into another match would otherwise get the OLD round's clash (with the old totals)
        // fired into the new match. Every match bumps the token; every round's delayed
        // closures capture it and refuse to run if it no longer matches.
        let _matchToken = 0;

        function startMatchWithOpponent(idx) {
            let oppData = window.currentOpponents[idx];
            autoEquipDeck(); save();
            // Cleared in endMatch() on every real outcome — if this is still set on the NEXT
            // page load, the tab was closed/refreshed mid-match instead of ending normally.
            localStorage.setItem('sc_match_in_progress', '1');
            _matchOver = false;
            _matchToken++;
            showScreen('match-screen');
            match = { round: 1, pScore: 0, oScore: 0, fallResults: [], hand: [...player.deck.M, ...player.deck.F, ...player.deck.S], oppHand: oppData.deck, used: [], selected: [], activeSupportUID: null, activeManagerUID: null, managerLockedIn: false, managerSlideShown: false, supportBonus: {pow:0, tgh:0, spd:0, cha:0}, matchWideBonus: {pow:0, tgh:0, spd:0, cha:0}, aiMode: oppData.aiMode || 'normal', overtimePlayed: false };
            document.getElementById('score-player').innerText = "0"; document.getElementById('score-opp').innerText = "0";
            renderFallPips();
            document.getElementById('arena-area').innerHTML = '<div class="vs-badge">VS</div>';
            document.getElementById('support-status').innerText = "Tap your Support card to activate it this round!";
            nextRound();
        }

        // Original WWE SuperCard 2014 format: EXACTLY 3 falls, all three played out
        // regardless of who's leading (a 2-0 lead still plays fall 3 — a clean 3-0 sweep
        // pays a bonus pick, see endMatch). A tied fall gives BOTH sides a point, so the
        // final score can tie (e.g. 2-2) — that's what Overtime is for.
        function nextRound() {
            if (_matchOver) return;
            if (match.round > 3) return handleStalemate();
            // Dead-rubber guard: if even winning every remaining fall can't catch the
            // opponent (i.e. 0-2 down going into fall 3), end the match NOW — the original
            // played all three falls out, but a fall the player can gain NOTHING from is
            // pure time waste. The mirrored case (player up 2-0) still plays fall 3: the
            // clean-sweep bonus pick is on the line, and the round intro calls it out.
            const remaining = 3 - match.round + 1;
            if (match.pScore + remaining < match.oScore) return endMatch(false);
            playRound();
        }

        // Called after all 3 falls are played (or if there are somehow no fighting cards
        // left). No coin flips: whoever's ahead just wins outright. If it's genuinely tied
        // and we haven't had our one Overtime round yet, every card becomes available again
        // and one final sudden-death round is played. If THAT also ties, the whole match
        // ends in a real draw (10 picks, no win/loss recorded — it's not tracked anywhere,
        // it's just a one-off outcome).
        function handleStalemate() {
            if (match.pScore !== match.oScore) return endMatch(false);

            if (match.overtimePlayed) return endMatch(false, true);

            match.overtimePlayed = true;
            match.used = [];
            showNotification(`⚡ OVERTIME!<br>Scores are tied — one final round decides it all!`, 2200, () => {
                playRound();
            });
        }

        function playRound() {
            // Guards the Overtime notification's delayed callback (and any other queued
            // path into a new round) against a forfeit that already ended the match.
            if (_matchOver) return;
            // activeManagerUID is deliberately NOT reset here — a signed manager buffs the
            // deck for the REST OF THE MATCH (see matchWideBonus), not just the round it was
            // played in, so its "signed" state (and the card's "TO DECK" footer text) must
            // survive every subsequent round until the player explicitly un-signs it. Regular
            // support cards (activeSupportUID/supportBonus) ARE meant to be a one-round boost,
            // so those still reset every round.
            match.selected = []; match.activeSupportUID = null; match.supportBonus = {pow:0, tgh:0, spd:0, cha:0};
            document.getElementById('arena-area').innerHTML = '<div class="vs-badge">VS</div>';
            document.getElementById('btn-confirm-play').style.display = 'none';

            let availM = match.hand.filter(u => player.inventory.find(c=>c.uid===u) && DB.find(x=>x.id===player.inventory.find(c=>c.uid===u).id).gender === 'M' && !match.used.includes(u));
            let availF = match.hand.filter(u => player.inventory.find(c=>c.uid===u) && DB.find(x=>x.id===player.inventory.find(c=>c.uid===u).id).gender === 'F' && !match.used.includes(u));

            let rules = [];
            if(availM.length >= 1) rules.push({ t: 'SINGLES', r: 1, g: 'M' });
            if(availM.length >= 2) rules.push({ t: 'TAG TEAM', r: 2, g: 'M' });
            if(availF.length >= 1) rules.push({ t: 'DIVAS', r: 1, g: 'F' });
            if(availF.length >= 2) rules.push({ t: 'TAG TEAM', r: 2, g: 'F' });

            if (rules.length === 0) return handleStalemate();

            let r = rules[Math.floor(Math.random() * rules.length)];
            let st = ['pow', 'tgh', 'spd', 'cha'][Math.floor(Math.random()*4)];
            match.rule = r; match.rule.stat = st;

            // Round announcement, IN THE RING (like the original's stipulation reveal):
            // one animated card in the arena's center carrying the round, the match type
            // AND the active stat — the single source for all three. The old version split
            // this across two static spots (a separate banner strip for the type + the
            // score box for the stat), shown twice with no announcement moment at all.
            // resolveRound()'s arena.innerHTML rewrite naturally clears it when the cards
            // actually enter the ring.
            const isDivas = r.g === 'F';
            const isTag = r.t === 'TAG TEAM';
            const introClass = isDivas ? 'divas' : (isTag ? 'tag' : 'superstar');
            const matchTypeLabel = isDivas ? (isTag ? 'DIVAS TAG TEAM MATCH' : 'DIVAS MATCH') : (isTag ? 'TAG TEAM MATCH' : 'SUPERSTAR MATCH');
            const roundLabel = match.overtimePlayed ? 'OVERTIME' : `ROUND ${match.round}`;
            // Up 2-0 into the final fall: the match is already won, but the 3-0 sweep pays
            // an extra Draft pick (see endMatch) — say so, so the fall doesn't feel dead.
            const sweepLine = (match.pScore === 2 && match.oScore === 0)
                ? '<div class="round-intro-sweep">🧹 WIN THIS FOR A CLEAN SWEEP — BONUS PICK!</div>' : '';
            document.getElementById('arena-area').innerHTML = `
                <div class="round-intro ${introClass}">
                    <div class="round-intro-round">${roundLabel}</div>
                    <div class="round-intro-type">${matchTypeLabel}</div>
                    <div class="round-intro-stat">STAT: <span>${st.toUpperCase()}</span></div>
                    ${sweepLine}
                </div>`;

            document.getElementById('match-info').innerHTML = roundLabel;
            renderFallPips();
            document.getElementById('cards-to-pick').innerText = r.r;
            document.getElementById('cards-text').innerText = r.r === 1 ? "CARD" : "CARDS";
            // The active stat is made readable ON the hand cards themselves: this attribute
            // drives CSS that dims every OTHER stat block (like the played-card grey-out),
            // so the round's stat is the only number that pops — no matter how many green
            // manager-boost tints are lighting up the rest of the card.
            document.getElementById('player-hand-area').dataset.activeStat = st;

            renderHand();
        }

        function renderHand() {
            let h = document.getElementById('player-hand-area'); h.innerHTML = "";
            match.hand.forEach(u => {
                let cardObj = player.inventory.find(c=>c.uid===u);
                if(!cardObj) return; 
                let s = getStats(cardObj);
                let isU = match.used.includes(u);
                let isS = match.selected.includes(u);
                let isSupportCard = s.gender === 'S';
                let isActiveGender = s.gender === match.rule.g;
                let isSupportActivated = (match.activeSupportUID === u);
                let isManagerActivated = (match.activeManagerUID === u);
                let isAnySupportActiveThisRound = !!match.activeSupportUID || !!match.activeManagerUID;
                let isManagerCard = isSupportCard && !!DB.find(x => x.id === cardObj.id).manager;

                // Fighter cards show their manager-boosted stats in green right in hand — the
                // real number they'll fight with — never the manager card itself (it doesn't
                // benefit from its own signing bonus). But ONLY once the manager has actually
                // activated in the ring (its slide played during a resolve): before that, a
                // freshly-signed manager's boost showing up all over the hand looked like the
                // bonus applied before the card was ever played.
                const showManagerBonus = !isSupportCard && match.managerSlideShown;
                let div = document.createElement('div');
                div.innerHTML = renderHTMLCard(s, false, match.rule.stat, '', '', 0, showManagerBonus ? match.matchWideBonus : null);
                let cardEl = div.children[0];
                div.style.position = 'relative';
                div.dataset.uid = u;

                // A manager card's footer always reads "TO DECK" — it's describing what
                // signing it DOES (a permanent whole-deck buff), not a state that only
                // appears once you've actually signed it — so this runs regardless of
                // isManagerActivated, unlike the old signed-only version.
                if (isManagerCard) {
                    const bonusEl = cardEl.querySelector('.ability-footer-bonus-v2');
                    if (bonusEl && !bonusEl.innerText.endsWith('TO DECK')) bonusEl.innerText = bonusEl.innerText + ' TO DECK';
                }

                if ((isU && !isSupportActivated) || isManagerActivated) {
                    // Carte deja folosita in rundele anterioare — un manager semnat conteaza
                    // ca "folosit" din prima clipa (gri), spre deosebire de support-ul normal
                    // care ramane cu contur verde cat timp poate fi inca declickat.
                    cardEl.classList.add('used');
                } else if (isSupportActivated) {
                    // Support activat — contur verde (poate fi declickat inapoi)
                    cardEl.classList.add('support-active');
                } else if (isSupportCard) {
                    // Support disponibil — pulsatie verde (doar daca nu e deja alt support activ)
                    if (!isAnySupportActiveThisRound) cardEl.classList.add('support-ready');
                    else cardEl.classList.add('battle-inactive');
                } else if (isS) {
                    // Carte selectata — clasă, nu stil inline, ca toggle-ul in-place de mai
                    // jos și un full re-render să producă exact același aspect.
                    cardEl.classList.add('card-selected');
                } else if (!isActiveGender) {
                    // Carte de gen gresit — intunecata
                    cardEl.classList.add('battle-inactive');
                }

                // Onclick handlers
                if (isSupportActivated) {
                    // Click din nou pe support-ul deja activ = deselectare (inainte sa rezolvi runda)
                    div.onclick = () => {
                        match.used = match.used.filter(x => x !== u);
                        match.activeSupportUID = null;
                        match.supportBonus = {pow:0, tgh:0, spd:0, cha:0};
                        document.getElementById('support-status').innerText = "Tap your Support card to activate it this round!";
                        renderHand();
                    };
                } else if (isManagerActivated && !match.managerLockedIn) {
                    // Click din nou pe manager-ul deja activ = anuleaza buff-ul permanent adaugat
                    // — doar inainte ca vreo runda sa se fi rezolvat cu el activ (vezi
                    // managerLockedIn in resolveRound()); dupa aceea ramane semnat tot meciul,
                    // fara optiune de undo (ar anula retroactiv o runda deja jucata).
                    div.onclick = () => {
                        // Re-check at click time: this handler is bound at render, BEFORE the
                        // round resolves — without this a tap during the resolve animations
                        // could still un-sign a manager that just got locked in.
                        if (match.managerLockedIn) return;
                        match.used = match.used.filter(x => x !== u);
                        ['pow','tgh','spd','cha'].forEach(k => { match.matchWideBonus[k] -= s[k]; });
                        match.activeManagerUID = null;
                        document.getElementById('support-status').innerText = "Tap your Support card to activate it this round!";
                        renderHand();
                    };
                } else if (isSupportCard && !isU && !isAnySupportActiveThisRound) {
                    div.onclick = () => {
                        const isManager = !!DB.find(x => x.id === cardObj.id).manager;
                        if (isManager) {
                            // Manager-type support (not an object/action prop): instead of a
                            // one-round boost for the cards played that round, it permanently
                            // buffs the player's ENTIRE deck for the rest of THIS match only
                            // (never the opponent, never carried past the match).
                            match.used.push(u);
                            match.activeManagerUID = u;
                            ['pow','tgh','spd','cha'].forEach(k => { match.matchWideBonus[k] += s[k]; });
                            const added = ['pow','tgh','spd','cha'].filter(k => s[k] > 0).map(k => `+${s[k]} ${k.toUpperCase()}`).join(', ');
                            document.getElementById('support-status').innerHTML = `<span style="color:#f1c40f">🎙️ ${s.name} SIGNED! ${added} to your whole roster for the rest of the match! (tap again to undo)</span>`;
                            renderHand();
                            // No slide here at the moment of signing — it plays instead the
                            // first time a round actually resolves with the manager active
                            // (see resolveRound()/managerSlideShown), same as when the manager
                            // is truly "played" in the ring rather than just selected.
                            return;
                        } else {
                            match.activeSupportUID = u; match.used.push(u);
                            match.supportBonus = {pow: s.pow, tgh: s.tgh, spd: s.spd, cha: s.cha};
                            // Only claim a bonus the card actually gives on THIS round's stat —
                            // activating a support with 0 there is allowed (player's call, can
                            // still undo), but the old message promised a bonus regardless.
                            const roundBonus = s[match.rule.stat] || 0;
                            document.getElementById('support-status').innerHTML = roundBonus > 0
                                ? `<span style="color:#2ecc71">✅ ${s.name} Activat! +${roundBonus} ${match.rule.stat.toUpperCase()}! (tap again to undo)</span>`
                                : `<span style="color:#f39c12">⚠️ ${s.name} gives no ${match.rule.stat.toUpperCase()} bonus this round! (tap again to undo)</span>`;
                        }
                        renderHand();
                    };
                } else if (isActiveGender && !isU) {
                    // Select/deselect happens IN PLACE — no renderHand() here. Rebuilding
                    // the whole hand on every tap re-created every card node (image flash,
                    // states snapping with no transition), which made picking cards feel
                    // jumpy. Selection only ever changes THIS card's look, so toggling its
                    // class (animated by .card's transition) is all that's needed.
                    div.onclick = () => {
                        const already = match.selected.includes(u);
                        if (already) match.selected = match.selected.filter(x => x !== u);
                        else if (match.selected.length < match.rule.r) match.selected.push(u);
                        else return; // hand full — ignore the tap, same as before
                        cardEl.classList.toggle('card-selected', !already);
                        document.getElementById('btn-confirm-play').style.display = (match.selected.length === match.rule.r) ? 'flex' : 'none';
                    };
                }
                h.appendChild(div);
            });
        }

        let _clashTimer1 = null, _clashTimer2 = null;

        // Bumps the big score number with a quick pop (see .score-pop in styles.css) so a
        // scored fall lands with weight instead of the digit silently changing.
        function setScoreWithPop(elId, value) {
            const el = document.getElementById(elId);
            if (!el) return;
            el.innerText = value;
            el.classList.remove('score-pop');
            void el.offsetWidth; // restart the animation even on back-to-back falls
            el.classList.add('score-pop');
        }

        // An exact tie on the active stat is a real draw — neither side scores a point,
        // the round just moves on.
        function skipClash(pTot, oTot) {
            // A clash timer can still be pending when a forfeit ends the match — never let
            // it score a round (and cascade into a second endMatch) after the fact.
            if (_matchOver) return;
            // Curăță timere rămase
            if (_clashTimer1) { clearTimeout(_clashTimer1); _clashTimer1 = null; }
            if (_clashTimer2) { clearTimeout(_clashTimer2); _clashTimer2 = null; }
            // Dezabonează click-ul de skip
            let arena = document.getElementById('arena-area');
            arena.onclick = null;
            arena.style.cursor = '';

            match.fallResults.push(pTot > oTot ? 'win' : (oTot > pTot ? 'loss' : 'draw'));
            renderFallPips();

            if (pTot > oTot) {
                match.pScore++;
                setScoreWithPop('score-player', match.pScore);
                cameraShake(false);
                let arenaPlayer = document.getElementById('arena-player');
                let bestRarity = match.selected.reduce((best, u) => {
                    let s = getStats(player.inventory.find(c=>c.uid===u));
                    if (!s) return best;
                    return RARITIES.indexOf(s.rarity) > RARITIES.indexOf(best) ? s.rarity : best;
                }, 'Common');
                burstAtElement(arenaPlayer, bestRarity);
                showRoundWinnerSpotlight('arena-player', 'arena-opp', 'ROUND WIN!', '#2ecc71', () => {
                    match.round++; nextRound();
                });
            } else if (oTot > pTot) {
                match.oScore++;
                setScoreWithPop('score-opp', match.oScore);
                showRoundWinnerSpotlight('arena-opp', 'arena-player', 'ROUND LOSS...', '#e74c3c', () => {
                    match.round++; nextRound();
                });
            } else {
                // Original 2014 rule: a tied fall awards one point to BOTH competitors —
                // not a scoreless wash. This is also what makes 2-2 finals (→ Overtime)
                // possible in a 3-fall match.
                match.pScore++; match.oScore++;
                setScoreWithPop('score-player', match.pScore);
                setScoreWithPop('score-opp', match.oScore);
                showRoundWinnerSpotlight(null, null, 'DRAW! +1 BOTH', '#f1c40f', () => {
                    match.round++; nextRound();
                });
            }
        }

        // Returnează bonusul FIX al abilității bazat pe raritate și card
        // Common: nicio abilitate
        // Uncommon: +10 la un singur stat (primul din lista)
        // Rare: +15 la un singur stat principal
        // SuperRare: dacă exceleaza considerabil → +20 la acel stat; altfel +11 +11
        // UltraRare: +17 +17
        // Epic: +25 +25
        // Legendary: +42 +42
        // Survivor: +55 +55
        function getAbilityBonus(cardStats, activeStat) {
            const rarity = cardStats.rarity;
            const ab = ABILITIES[cardStats.id];
            if (!ab) return 0;

            switch (rarity) {
                case 'Common':
                    return 0; // Common nu are abilitate

                case 'Uncommon':
                    // +10 doar la primul stat din lista abilității
                    if (activeStat === ab.stats[0]) return 10;
                    return 0;

                case 'Rare':
                    // +15 la stat-ul principal (primul din lista)
                    if (activeStat === ab.stats[0]) return 15;
                    return 0;

                case 'SuperRare': {
                    // Verificăm dacă cartea exceleaza considerabil la un stat față de restul
                    const stats = { pow: cardStats.pow, tgh: cardStats.tgh, spd: cardStats.spd, cha: cardStats.cha };
                    const vals = Object.entries(stats).filter(([k]) => stats[k] > 0);
                    if (vals.length === 0) return 0;
                    const sorted = vals.sort((a, b) => b[1] - a[1]);
                    const topStat = sorted[0][0];
                    const topVal = sorted[0][1];
                    const secondVal = sorted.length > 1 ? sorted[1][1] : 0;
                    // "Exceleaza considerabil" = top stat e cu cel puțin 5% mai mare decât al doilea
                    const excels = secondVal === 0 || (topVal - secondVal) / secondVal >= 0.05;
                    if (excels && activeStat === topStat) return 20;
                    // Altfel +11 la oricare din cei 2 stats ai abilității
                    if (ab.stats.includes(activeStat)) return 11;
                    return 0;
                }

                case 'UltraRare':
                    if (ab.stats.includes(activeStat)) return 17;
                    return 0;

                case 'Epic':
                    if (ab.stats.includes(activeStat)) return 25;
                    return 0;

                case 'Legendary':
                    if (ab.stats.includes(activeStat)) return 42;
                    return 0;

                case 'Survivor':
                    if (ab.stats.includes(activeStat)) return 55;
                    return 0;

                default:
                    return 0;
            }
        }

        function resolveRound() {
            // A manager's buff is permanent for the rest of the match the moment a round
            // actually resolves with it active — once THAT'S happened, un-signing must no
            // longer be possible (it would retroactively cancel a buff that already decided
            // an earlier round's outcome). Before this point (same round, not yet resolved)
            // the "tap again to undo" option is still fair game.
            if (match.activeManagerUID) match.managerLockedIn = true;

            let pTot = 0, oTot = 0;
            let abilityEvents = [];
            // Chemistry steps (tag rounds) — built here, PLAYED in the sequential queue,
            // where each card's stats visibly count up/down as the step fires.
            const chemistryEvents = [];

            // A manager-type support activated earlier this match permanently buffs every
            // card in the player's deck for the rest of the match (never the opponent's).
            // It's persistent state (already shown green on the hand cards), so it stays
            // baked into the arena render rather than replayed as an animation every round.
            const managerBonus = match.matchWideBonus[match.rule.stat] || 0;
            pTot += managerBonus * match.selected.length;

            // Captured here (same reason as playerSupportCardStats below), fired further down
            // AFTER the arena rebuilds — but only the FIRST round the manager is actually
            // played/resolved, via managerSlideShown, not every round after that.
            let managerCardStats = null, managerAddedText = '';
            if (match.activeManagerUID && !match.managerSlideShown) {
                const managerCard = player.inventory.find(c => c.uid === match.activeManagerUID);
                if (managerCard) {
                    managerCardStats = getStats(managerCard);
                    managerAddedText = ['pow','tgh','spd','cha'].filter(k => managerCardStats[k] > 0).map(k => `+${managerCardStats[k]} ${k.toUpperCase()}`).join(', ');
                    match.managerSlideShown = true;
                }
            }

            // Per-card ability bonuses are remembered so the TEAM chemistry % (applied
            // LAST, on the final numbers) can include them in its base.
            const abilityBonusByUid = {};
            match.selected.forEach(u => {
                let cardObj = player.inventory.find(c=>c.uid===u);
                let cardStats = getStats(cardObj);
                let baseStat = cardStats[match.rule.stat];
                pTot += baseStat;
                match.used.push(u);

                // Verifică abilitate specială (33% șansă)
                const ab = ABILITIES[cardStats.id];
                if (ab && ab.stats.includes(match.rule.stat)) {
                    if (Math.random() < 0.33) {
                        // ABILITATE ACTIVATĂ! Bonus fix bazat pe raritate
                        const bonus = getAbilityBonus(cardStats, match.rule.stat);
                        // Common (și Uncommon pe stat-ul secundar) dau bonus 0 — nu există
                        // nicio abilitate reală de arătat, deci nu declanșăm popup/flash.
                        if (bonus > 0) {
                            pTot += bonus;
                            abilityBonusByUid[cardStats.uid] = (abilityBonusByUid[cardStats.uid] || 0) + bonus;
                            // Flash + burst + on-card callout + the stat counting up all
                            // fire from the SEQUENTIAL activation queue below.
                            abilityEvents.push({ cardStats, ab, bonus, statName: match.rule.stat, isAI: false, bumps: [{ uid: cardStats.uid, stat: match.rule.stat, delta: bonus }] });
                        }
                    }
                }
            });
            // In a Tag Team round (2 cards per side), the support card backs up the whole
            // team, so its bonus counts double instead of a flat single-card add.
            const teamSupportMultiplier = match.rule.r === 2 ? 2 : 1;
            const playerSupportBonus = (match.supportBonus[match.rule.stat] || 0) * teamSupportMultiplier;
            pTot += playerSupportBonus;

            // NOTE: playerSupportBonus is already doubled for Tag Team rounds (team-wide
            // total) — animating that doubled amount onto EACH of the 2 cards would visually
            // double-count it. Each card's number rises by its own undoubled share instead,
            // so the two on-card increases sum to the real total added to pTot.
            const perCardSupportBonus = match.supportBonus[match.rule.stat] || 0;

            // TAG TEAM ALIGNMENT (original 2014 mechanic): a matching pair fights as a real
            // team, +10% on EVERY stat of each card; a mismatched pair pays -5% on every
            // stat. The TEAM bonus is ALWAYS applied LAST: the % is taken from each card's
            // FINAL numbers this round (base + manager + support + ability), never from the
            // raw base. Only the active stat's share counts toward the round total — but
            // ALL four numbers animate up/down on both cards when the chemistry step plays.
            if (match.rule.r === 2 && match.selected.length === 2) {
                const pair = match.selected.map(u => getStats(player.inventory.find(c => c.uid === u)));
                const matched = pair[0].alignment === pair[1].alignment;
                const factor = matched ? 0.10 : -0.05;
                const bumps = [];
                pair.forEach(s => {
                    ['pow','tgh','spd','cha'].forEach(k => {
                        let eff = s[k] + (match.matchWideBonus[k] || 0);
                        if (k === match.rule.stat) eff += perCardSupportBonus + (abilityBonusByUid[s.uid] || 0);
                        const d = Math.round(eff * factor);
                        if (d !== 0) bumps.push({ uid: s.uid, stat: k, delta: d });
                        if (k === match.rule.stat) pTot += d;
                    });
                });
                chemistryEvents.push({ kind: 'chemistry', bumps,
                    text: matched ? '🤝 PERFECT TEAM! +10% ALL STATS' : '💢 BAD CHEMISTRY... -5% ALL STATS',
                    color: matched ? '#2ecc71' : '#e74c3c' });
            }
            // Captured here, but the actual slide-in fires further below — AFTER
            // arena.innerHTML rebuilds the ring with this round's fighter cards. Firing it
            // this early would just get wiped out by that innerHTML replacement before the
            // browser ever paints it.
            let playerSupportCardStats = null;
            if (match.activeSupportUID && playerSupportBonus > 0) {
                const supportCard = player.inventory.find(c => c.uid === match.activeSupportUID);
                if (supportCard) playerSupportCardStats = getStats(supportCard);
            }

            // ---- AI CARD SELECTION ----
            const activeStat = match.rule.stat;
            const aiPlay = chooseAiPlay(match);
            let oppP = aiPlay.cards;

            if (aiPlay.support) {
                match.used.push(aiPlay.support.uid);
            }

            oppP.forEach(c => {
                oTot += c[activeStat];
                match.used.push(c.uid);
            });

            const aiSupportBonus = aiPlay.supportBonus * teamSupportMultiplier;
            oTot += aiSupportBonus;

            const aiAbilityByUid = {};
            oppP.forEach(c => {
                const ab = ABILITIES[c.id];
                if (ab && ab.stats.includes(activeStat) && Math.random() < aiPlay.abilityChance) {
                    const bonus = getAbilityBonus(c, activeStat);
                    // Common (și Uncommon pe stat-ul secundar) dau bonus 0 — nu există
                    // nicio abilitate reală de arătat, deci nu declanșăm popup/flash.
                    if (bonus > 0) {
                        oTot += bonus;
                        aiAbilityByUid[c.uid] = (aiAbilityByUid[c.uid] || 0) + bonus;
                        abilityEvents.push({ cardStats: c, ab, bonus, statName: activeStat, isAI: true, bumps: [{ uid: c.uid, stat: activeStat, delta: bonus }] });
                    }
                }
            });

            // Same all-stats tag-team chemistry for the AI's pair (its deck cards carry
            // alignments too — getStats stamps them on every fighter). Same TEAM-bonus-last
            // rule as the player: the % is taken from each AI card's final numbers this
            // round (base + support + ability).
            if (match.rule.r === 2 && oppP.length === 2) {
                const matched = oppP[0].alignment === oppP[1].alignment;
                const factor = matched ? 0.10 : -0.05;
                const bumps = [];
                oppP.forEach(c => {
                    ['pow','tgh','spd','cha'].forEach(k => {
                        let eff = c[k];
                        if (k === activeStat) eff += aiPlay.supportBonus + (aiAbilityByUid[c.uid] || 0);
                        const d = Math.round(eff * factor);
                        if (d !== 0) bumps.push({ uid: c.uid, stat: k, delta: d });
                        if (k === activeStat) oTot += d;
                    });
                });
                chemistryEvents.push({ kind: 'chemistry', bumps,
                    text: matched ? '⚠️ ENEMY TEAM CHEMISTRY! +10%' : '💢 ENEMY BAD CHEMISTRY -5%',
                    color: matched ? '#e74c3c' : '#f39c12' });
            }

            // Cards whose stat actually got boosted this round (ability and/or support —
            // both add together into one total per card) show their real new number in
            // green right there on the card, instead of just a color change.
            // Cards enter the ring showing their BASE stats (only the manager's permanent
            // whole-deck buff is pre-applied — it's standing state, already green in hand).
            // Every OTHER bonus lands during the sequential queue below, where the affected
            // numbers visibly count up (or down) as each activation plays.
            let arena = document.getElementById('arena-area');
            // The manager's buff is pre-baked into the arena render ONLY from its second
            // resolved round on (standing state by then, already green in hand). The FIRST
            // time it resolves (managerCardStats set → its slide is about to play), cards
            // enter the ring at base stats and the buff counts up during the slide, same as
            // every other activation — otherwise the boost was visible before the manager
            // card ever "activated" in the ring.
            const managerMap = (match.activeManagerUID && !managerCardStats) ? match.matchWideBonus : null;
            arena.innerHTML = `
                <div class="arena-stat-tag">${activeStat.toUpperCase()}</div>
                <div class="arena-side slide-in-left" id="arena-player">${match.selected.map(u => renderHTMLCard(getStats(player.inventory.find(c=>c.uid===u)), false, match.rule.stat, '', '', 0, managerMap)).join('')}</div>
                <div class="vs-badge">VS</div>
                <div class="arena-side slide-in-right" id="arena-opp">${oppP.map(c => renderHTMLCard(c, false, match.rule.stat)).join('')}</div>
            `;
            document.getElementById('btn-confirm-play').style.display = 'none';
            document.getElementById('support-status').innerText = "";

            // EVERYTHING that activated this round plays STRICTLY ONE AT A TIME, on an
            // unhurried beat — manager signing, tag chemistry (stats animating on both
            // cards), support boosts, then each ability with its callout ON its card.
            const activations = [];
            if (managerCardStats) {
                // First resolve with the manager: the arena cards entered at base stats (see
                // managerMap above), so the buff lands here, animating up on every played
                // card's affected stats as the signing slide plays.
                const managerBumps = [];
                match.selected.forEach(u => {
                    ['pow','tgh','spd','cha'].forEach(k => {
                        const d = match.matchWideBonus[k] || 0;
                        if (d !== 0) managerBumps.push({ uid: u, stat: k, delta: d });
                    });
                });
                activations.push({ kind: 'support', side: 'player', card: managerCardStats, tag: `${managerAddedText} TO DECK`, icon: '🎙️', bumps: managerBumps });
            }
            if (playerSupportCardStats) activations.push({ kind: 'support', side: 'player', card: playerSupportCardStats, tag: `+${playerSupportBonus} ${match.rule.stat.toUpperCase()}`,
                bumps: match.selected.map(u => ({ uid: u, stat: match.rule.stat, delta: perCardSupportBonus })) });
            if (aiPlay.support && aiSupportBonus > 0) activations.push({ kind: 'support', side: 'ai', card: aiPlay.support, tag: `+${aiSupportBonus} ${activeStat.toUpperCase()}`,
                bumps: oppP.map(c => ({ uid: c.uid, stat: activeStat, delta: aiPlay.supportBonus })) });
            abilityEvents.forEach(evt => activations.push({ kind: 'ability', evt, bumps: evt.bumps }));
            // TEAM CHEMISTRY PLAYS LAST — same order the math already uses (its % is taken
            // from each card's FINAL numbers: base + manager + support + ability). Playing it
            // any earlier meant the on-card numbers kept moving AFTER the chemistry step,
            // which read as stats being added/subtracted after the team bonus was "done".
            chemistryEvents.forEach(e => activations.push(e));

            const myToken = _matchToken;
            const isStale = () => _matchOver || myToken !== _matchToken;

            const startClashSequence = () => {
                if (isStale()) return; // this round's match ended (or a new one started) mid-queue
                arena.style.cursor = 'pointer';
                arena.onclick = () => { if (!isStale()) skipClash(pTot, oTot); };

                _clashTimer1 = setTimeout(() => {
                    _clashTimer1 = null;
                    let ap = document.getElementById('arena-player');
                    let ao = document.getElementById('arena-opp');
                    // The slide-in classes must come OFF before the clash ones go on — both
                    // set the `animation` property, and only one declaration can win.
                    if (ap) { ap.classList.remove('slide-in-left'); ap.classList.add('anim-clash-left'); }
                    if (ao) { ao.classList.remove('slide-in-right'); ao.classList.add('anim-clash-right'); }
                    arena.classList.add('impact-flash');
                    setTimeout(() => arena.classList.remove('impact-flash'), 500);

                    _clashTimer2 = setTimeout(() => {
                        _clashTimer2 = null;
                        if (!isStale()) skipClash(pTot, oTot);
                    }, 800);
                }, 700);
            };

            if (activations.length > 0) {
                // Small breather after the cards slide in, then the queue; the clash only
                // starts once the LAST activation has fully played out. isStale aborts the
                // queue between steps if this round's match is gone by then.
                setTimeout(() => playActivationsSequentially(activations, startClashSequence, isStale), 800);
            } else {
                startClashSequence();
            }
        }

        function endMatch(forfeit, isDraw) {
            if (_matchOver) return;
            _matchOver = true;
            // A forfeit can land mid-round-resolution — kill the pending clash timers and the
            // arena's skip-click so the already-decided round can't keep resolving afterwards.
            if (_clashTimer1) { clearTimeout(_clashTimer1); _clashTimer1 = null; }
            if (_clashTimer2) { clearTimeout(_clashTimer2); _clashTimer2 = null; }
            let arenaEl = document.getElementById('arena-area');
            if (arenaEl) { arenaEl.onclick = null; arenaEl.style.cursor = ''; }
            // Cleared here (every outcome — forfeit/draw/win/loss all pass through this
            // function) so a NORMAL match end never gets mistaken for "left mid-match" on the
            // next page load. See startMatchWithOpponent() where it's set, and initGame() in
            // state.js where a still-set flag on load means the tab was closed/refreshed while
            // a match was in progress.
            localStorage.removeItem('sc_match_in_progress');

            // People's Champion Challenge matches settle through their own rewards path —
            // event points only, never picks/wins/losses/streak (see endPccMatch in pcc.js).
            if (window._pccMatch && window._pccMatch.active) return endPccMatch(forfeit, isDraw);

            let priorStreak = player.winStreak || 0;

            if(forfeit) {
                match.oScore = 3; match.pScore = 0;
                player.winStreak = 0; player.losses = (player.losses || 0) + 1; save();
                incrementMission('play_exhibition');
                let resetNote = priorStreak >= 3 ? `<br><span style="color:#e74c3c; font-size:15px;">🔥 Win streak reset (was ${priorStreak}).</span>` : '';
                // Unlike win/loss/draw, a forfeit earns zero picks — sending the player to the
                // draft board (nothing new to spend) was pointless. Back to Exhibition instead,
                // with a fresh set of opponents, so they can jump straight into another match.
                showNotification(`🏳️ You forfeited the match. Defeat!${resetNote}`, 2500, () => { showScreen('opp-select-screen'); showOpponentSelect(); });
                return;
            }

            if (isDraw) {
                // Genuine draw after Overtime — pays a bit more than a win (3 picks vs 2)
                // as a novelty, but nowhere near the old 10: that was 5x a WIN for an
                // outcome the player doesn't even control. Doesn't touch wins/losses/streak.
                player.picks += 3; save();
                incrementMission('play_exhibition');
                showNotification(`🤝 MATCH DRAW!<br>Even Overtime couldn't decide it — you received 3 Draft picks.`, 3000, () => { showScreen('draft-board-screen'); renderDraftBoard(); });
                return;
            }

            let w = match.pScore > match.oScore;
            // A clean 3-0 sweep earns a bonus pick (3 total); a normal win (3-1/3-2) is 2, a loss is 1.
            let picksWon = w ? (match.oScore === 0 ? 3 : 2) : 1;

            let streakMsgs = [];
            let freePackEarned = false;

            if (w) {
                player.wins = (player.wins || 0) + 1;
                player.winStreak = priorStreak + 1;
                let streak = player.winStreak;

                if (streak % STREAK_REWARDS.freePackEvery === 0) {
                    freePackEarned = true;
                    streakMsgs.push(`🔥 ${streak}-Win Streak! FREE PACK!`);
                }
                let pickBonus = STREAK_REWARDS.pickBonusSchedule[streak % 10];
                if (pickBonus) {
                    picksWon += pickBonus;
                    streakMsgs.push(`🔥 ${streak}-Win Streak! +${pickBonus} Pick${pickBonus > 1 ? 's' : ''}`);
                }
            } else {
                player.losses = (player.losses || 0) + 1;
                player.winStreak = 0;
            }

            player.picks += picksWon; save();
            incrementMission('play_exhibition');
            if (w) incrementMission('win_exhibition');

            let streakHtml = streakMsgs.length ? `<br><span style="color:#ff9800; font-size:15px;">${streakMsgs.join('<br>')}</span>` : '';
            let lossResetNote = (!w && priorStreak >= 3) ? `<br><span style="color:#e74c3c; font-size:15px;">🔥 Win streak reset (was ${priorStreak}).</span>` : '';

            if(w) {
                celebrateMatchWin();
                showNotification(`🎉 YOU WON THE MATCH! 🎉<br>You received ${picksWon} Draft picks.${streakHtml}`, streakMsgs.length ? 4000 : 3000, () => {
                    showScreen('draft-board-screen'); renderDraftBoard();
                    if (freePackEarned) grantBonusPack(STREAK_REWARDS.freePackRarities);
                });
            } else {
                showNotification(`💀 YOU LOST THE MATCH... 💀<br>You received 1 consolation pick.${lossResetNote}`, 3000, () => { showScreen('draft-board-screen'); renderDraftBoard(); });
            }
        }
