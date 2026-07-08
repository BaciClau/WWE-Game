let match = { round: 1, pScore: 0, oScore: 0, hand: [], oppHand: [], used: [], selected: [], activeSupportUID: null, activeManagerUID: null, supportBonus: {pow:0, tgh:0, spd:0, cha:0}, matchWideBonus: {pow:0, tgh:0, spd:0, cha:0}, overtimePlayed: false };

        function startMatchWithOpponent(idx) {
            let oppData = window.currentOpponents[idx];
            autoEquipDeck(); save();
            showScreen('match-screen');
            match = { round: 1, pScore: 0, oScore: 0, hand: [...player.deck.M, ...player.deck.F, ...player.deck.S], oppHand: oppData.deck, used: [], selected: [], activeSupportUID: null, activeManagerUID: null, supportBonus: {pow:0, tgh:0, spd:0, cha:0}, matchWideBonus: {pow:0, tgh:0, spd:0, cha:0}, aiMode: oppData.aiMode || 'normal', overtimePlayed: false };
            document.getElementById('score-player').innerText = "0"; document.getElementById('score-opp').innerText = "0";
            document.getElementById('arena-area').innerHTML = '<div class="vs-badge">VS</div>';
            document.getElementById('support-status').innerText = "Tap your Support card to activate it this round!";
            nextRound();
        }

        function nextRound() {
            if (match.pScore === 3 || match.oScore === 3) return endMatch(false);
            if (match.round > 5) return handleStalemate();
            playRound();
        }

        // Called whenever the match can't continue normally — the round-5 cap was hit, or
        // there are no fighting cards left to play — while nobody has reached 3 wins yet.
        // No coin flips: whoever's ahead just wins outright. If it's genuinely tied and we
        // haven't had our one Overtime round yet, every card becomes available again and
        // one final sudden-death round is played. If THAT also ties, the whole match ends
        // in a real draw (10 picks, no win/loss recorded — it's not tracked anywhere, it's
        // just a one-off outcome).
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
            match.selected = []; match.activeSupportUID = null; match.activeManagerUID = null; match.supportBonus = {pow:0, tgh:0, spd:0, cha:0};
            document.getElementById('arena-area').innerHTML = '<div class="vs-badge">VS</div>';
            document.getElementById('btn-confirm-play').style.display = 'none';

            let availM = match.hand.filter(u => player.inventory.find(c=>c.uid===u) && DB.find(x=>x.id===player.inventory.find(c=>c.uid===u).id).gender === 'M' && !match.used.includes(u));
            let availF = match.hand.filter(u => player.inventory.find(c=>c.uid===u) && DB.find(x=>x.id===player.inventory.find(c=>c.uid===u).id).gender === 'F' && !match.used.includes(u));

            let rules = [];
            if(availM.length >= 1) rules.push({ t: 'SINGLES', r: 1, g: 'M' });
            if(availM.length >= 2) rules.push({ t: 'TAG TEAM', r: 2, g: 'M' });
            if(availF.length >= 1) rules.push({ t: 'DIVAS', r: 1, g: 'F' });

            if (rules.length === 0) return handleStalemate();

            let r = rules[Math.floor(Math.random() * rules.length)];
            let st = ['pow', 'tgh', 'spd', 'cha'][Math.floor(Math.random()*4)];
            match.rule = r; match.rule.stat = st;

            // Banner tip luptă vizibil
            const isDivas = r.g === 'F';
            const matchTypeBannerClass = isDivas ? 'divas' : 'superstar';
            const matchTypeLabel = isDivas ? 'DIVAS MATCH' : (r.t === 'TAG TEAM' ? 'TAG TEAM MATCH' : 'SUPERSTAR MATCH');
            const matchTypeBannerEl = document.getElementById('match-type-banner');
            if (matchTypeBannerEl) {
                matchTypeBannerEl.className = `match-type-banner ${matchTypeBannerClass}`;
                matchTypeBannerEl.innerText = matchTypeLabel;
                matchTypeBannerEl.style.display = 'block';
            }

            const roundLabel = match.overtimePlayed ? 'OVERTIME' : `ROUND ${match.round}`;
            document.getElementById('match-info').innerHTML = `${roundLabel}<br><span style="color:#fff; font-size:18px;">STAT: <span style="color:#f1c40f">${st.toUpperCase()}</span></span>`;
            document.getElementById('cards-to-pick').innerText = r.r;
            document.getElementById('cards-text').innerText = r.r === 1 ? "CARD" : "CARDS";

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

                let div = document.createElement('div');
                div.innerHTML = renderHTMLCard(s, false, match.rule.stat);
                let cardEl = div.children[0];

                if (isU && !isSupportActivated && !isManagerActivated) {
                    // Carte deja folosita in rundele anterioare
                    cardEl.classList.add('used');
                } else if (isSupportActivated || isManagerActivated) {
                    // Support activat — contur verde (poate fi declickat inapoi)
                    cardEl.classList.add('support-active');
                } else if (isSupportCard) {
                    // Support disponibil — pulsatie verde (doar daca nu e deja alt support activ)
                    if (!isAnySupportActiveThisRound) cardEl.classList.add('support-ready');
                    else cardEl.classList.add('battle-inactive');
                } else if (isS) {
                    // Carte selectata
                    cardEl.style.cssText = "transform: translateY(-15px); border-color: #3498db !important; box-shadow: 0 10px 30px rgba(52, 152, 219, 0.8) !important;";
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
                } else if (isManagerActivated) {
                    // Click din nou pe manager-ul deja activ = anuleaza buff-ul permanent adaugat
                    div.onclick = () => {
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
                            showNotification(`🎙️ MANAGER SIGNED!<br>${s.name} boosts your ENTIRE roster: ${added} for the rest of the match!`, 2400);
                        } else {
                            match.activeSupportUID = u; match.used.push(u);
                            match.supportBonus = {pow: s.pow, tgh: s.tgh, spd: s.spd, cha: s.cha};
                            document.getElementById('support-status').innerHTML = `<span style="color:#2ecc71">✅ ${s.name} Activat! Bonus la ${match.rule.stat.toUpperCase()}! (tap again to undo)</span>`;
                        }
                        renderHand();
                    };
                } else if (isActiveGender && !isU) {
                    div.onclick = () => {
                        if(isS) match.selected = match.selected.filter(x=>x!==u);
                        else if(match.selected.length < match.rule.r) match.selected.push(u);
                        document.getElementById('btn-confirm-play').style.display = (match.selected.length === match.rule.r) ? 'flex' : 'none';
                        renderHand();
                    };
                }
                h.appendChild(div);
            });
        }

        let _clashTimer1 = null, _clashTimer2 = null;

        // An exact tie on the active stat is a real draw — neither side scores a point,
        // the round just moves on.
        function skipClash(pTot, oTot) {
            // Curăță timere rămase
            if (_clashTimer1) { clearTimeout(_clashTimer1); _clashTimer1 = null; }
            if (_clashTimer2) { clearTimeout(_clashTimer2); _clashTimer2 = null; }
            // Dezabonează click-ul de skip
            let arena = document.getElementById('arena-area');
            arena.onclick = null;
            arena.style.cursor = '';

            if (pTot > oTot) {
                match.pScore++;
                cameraShake(false);
                let arenaPlayer = document.getElementById('arena-player');
                let bestRarity = match.selected.reduce((best, u) => {
                    let s = getStats(player.inventory.find(c=>c.uid===u));
                    if (!s) return best;
                    return RARITIES.indexOf(s.rarity) > RARITIES.indexOf(best) ? s.rarity : best;
                }, 'Common');
                burstAtElement(arenaPlayer, bestRarity);
                showNotification(`<span style="color:#2ecc71;">ROUND WIN!</span><br>${pTot} beat ${oTot}`, 1500, () => {
                    document.getElementById('score-player').innerText = match.pScore;
                    match.round++; nextRound();
                });
            } else if (oTot > pTot) {
                match.oScore++;
                showNotification(`<span style="color:#e74c3c;">ROUND LOSS...</span><br>${pTot} lost to ${oTot}`, 1500, () => {
                    document.getElementById('score-opp').innerText = match.oScore;
                    match.round++; nextRound();
                });
            } else {
                showNotification(`<span style="color:#f1c40f;">DRAW!</span><br>${pTot} vs ${oTot} — no point for either side.`, 1500, () => {
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
            let pTot = 0, oTot = 0;
            let abilityEvents = [];
            // Per-card extra bonus (ability and/or support) actually landed this round, so
            // the arena card can show its real boosted number in green — not just a color
            // change, and not a separate popup — everything that applies to a card adds up
            // into the one number shown on it.
            const playerCardBonus = {};
            const aiCardBonus = {};

            // A manager-type support activated earlier this match permanently buffs every
            // card in the player's deck for the rest of the match (never the opponent's).
            const managerBonus = match.matchWideBonus[match.rule.stat] || 0;
            if (managerBonus > 0) {
                match.selected.forEach(u => { playerCardBonus[u] = (playerCardBonus[u] || 0) + managerBonus; });
                pTot += managerBonus * match.selected.length;
            }

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
                            playerCardBonus[u] = (playerCardBonus[u] || 0) + bonus;
                            abilityEvents.push({ cardStats, ab, bonus, statName: match.rule.stat, isAI: false });
                            // Flash animatie + particule colorate pe raritate, pe carte in arena
                            setTimeout(() => {
                                let el = document.getElementById('card-'+cardStats.uid);
                                if (el) {
                                    el.classList.add('ability-active-flash');
                                    burstAtElement(el, cardStats.rarity);
                                    setTimeout(()=>el.classList.remove('ability-active-flash'), 700);
                                }
                            }, 700);
                        }
                    }
                }
            });
            // In a Tag Team round (2 cards per side), the support card backs up the whole
            // team, so its bonus counts double instead of a flat single-card add.
            const teamSupportMultiplier = match.rule.r === 2 ? 2 : 1;
            const playerSupportBonus = (match.supportBonus[match.rule.stat] || 0) * teamSupportMultiplier;
            pTot += playerSupportBonus;

            // Support gets the same big popup treatment as an ability activation, and its
            // bonus adds onto every fighter it backed up this round (same card can also
            // carry an ability bonus on top — both add into the one number shown on it).
            // NOTE: playerSupportBonus is already doubled for Tag Team rounds (team-wide
            // total) — showing that doubled amount on EACH of the 2 cards would visually
            // double-count it (30+30 on-card vs the real 30 added to pTot). Each card shows
            // its own undoubled share instead, so the two card displays sum to the real total.
            const perCardSupportBonus = match.supportBonus[match.rule.stat] || 0;
            if (playerSupportBonus > 0) {
                match.selected.forEach(u => { playerCardBonus[u] = (playerCardBonus[u] || 0) + perCardSupportBonus; });
            }
            if (match.activeSupportUID && playerSupportBonus > 0) {
                const supportCard = player.inventory.find(c => c.uid === match.activeSupportUID);
                if (supportCard) {
                    const supportStats = getStats(supportCard);
                    abilityEvents.push({
                        cardStats: supportStats,
                        ab: { icon: '🛠️', name: 'Support Boost', desc: `${supportStats.name} backs up the team!` },
                        bonus: playerSupportBonus, statName: match.rule.stat, isAI: false, isSupport: true
                    });
                    setTimeout(() => {
                        let el = document.getElementById('card-' + supportStats.uid);
                        if (el) {
                            el.classList.add('ability-active-flash');
                            burstAtElement(el, supportStats.rarity);
                            setTimeout(() => el.classList.remove('ability-active-flash'), 700);
                        }
                    }, 700);
                }
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
            // Same fix as the player's side above: show each card its own undoubled share,
            // not the team-wide doubled total, so the displayed numbers don't double-count.
            if (aiSupportBonus > 0) {
                oppP.forEach(c => { aiCardBonus[c.uid] = (aiCardBonus[c.uid] || 0) + aiPlay.supportBonus; });
            }

            if (aiPlay.support && aiSupportBonus > 0) {
                abilityEvents.push({
                    cardStats: aiPlay.support,
                    ab: { icon: '🛠️', name: 'Support Boost', desc: `${aiPlay.support.name} backs up the team!` },
                    bonus: aiSupportBonus, statName: activeStat, isAI: true, isSupport: true
                });
                setTimeout(() => {
                    let el = document.getElementById('card-' + aiPlay.support.uid);
                    if (el) {
                        el.classList.add('ability-active-flash');
                        burstAtElement(el, aiPlay.support.rarity);
                        setTimeout(() => el.classList.remove('ability-active-flash'), 700);
                    }
                }, 700);
            }

            oppP.forEach(c => {
                const ab = ABILITIES[c.id];
                if (ab && ab.stats.includes(activeStat) && Math.random() < aiPlay.abilityChance) {
                    const bonus = getAbilityBonus(c, activeStat);
                    // Common (și Uncommon pe stat-ul secundar) dau bonus 0 — nu există
                    // nicio abilitate reală de arătat, deci nu declanșăm popup/flash.
                    if (bonus > 0) {
                        oTot += bonus;
                        aiCardBonus[c.uid] = (aiCardBonus[c.uid] || 0) + bonus;
                        abilityEvents.push({ cardStats: c, ab, bonus, statName: activeStat, isAI: true });
                        setTimeout(() => {
                            let el = document.getElementById('card-'+c.uid);
                            if (el) {
                                el.classList.add('ability-active-flash');
                                burstAtElement(el, c.rarity);
                                setTimeout(()=>el.classList.remove('ability-active-flash'), 700);
                            }
                        }, 700);
                    }
                }
            });

            // Cards whose stat actually got boosted this round (ability and/or support —
            // both add together into one total per card) show their real new number in
            // green right there on the card, instead of just a color change.
            let arena = document.getElementById('arena-area');
            arena.innerHTML = `
                <div class="arena-side slide-in-left" id="arena-player">${match.selected.map(u => renderHTMLCard(getStats(player.inventory.find(c=>c.uid===u)), false, match.rule.stat, '', playerCardBonus[u] ? match.rule.stat : '', playerCardBonus[u] || 0)).join('')}</div>
                <div class="vs-badge">VS</div>
                <div class="arena-side slide-in-right" id="arena-opp">${oppP.map(c => renderHTMLCard(c, false, match.rule.stat, '', aiCardBonus[c.uid] ? activeStat : '', aiCardBonus[c.uid] || 0)).join('')}</div>
            `;
            document.getElementById('btn-confirm-play').style.display = 'none';
            document.getElementById('support-status').innerText = "";

            // Secvența de "clash" (animație + rezolvare rundă) — pornește DOAR după ce
            // popup-urile de abilitate (dacă există) s-au terminat, ca gameplay-ul să
            // rămână "înghețat" cât timp se arată o abilitate activată.
            const startClashSequence = () => {
                arena.style.cursor = 'pointer';
                arena.onclick = () => skipClash(pTot, oTot);

                _clashTimer1 = setTimeout(() => {
                    _clashTimer1 = null;
                    let ap = document.getElementById('arena-player');
                    let ao = document.getElementById('arena-opp');
                    if (ap) ap.classList.add('anim-clash-left');
                    if (ao) ao.classList.add('anim-clash-right');
                    arena.classList.add('impact-flash');
                    setTimeout(() => arena.classList.remove('impact-flash'), 500);

                    _clashTimer2 = setTimeout(() => {
                        _clashTimer2 = null;
                        skipClash(pTot, oTot);
                    }, 800);
                }, 600);
            };

            if (abilityEvents.length > 0) {
                setTimeout(() => queueAbilityPopups(abilityEvents, startClashSequence), 700);
            } else {
                startClashSequence();
            }
        }

        function endMatch(forfeit, isDraw) {
            let priorStreak = player.winStreak || 0;

            if(forfeit) {
                match.oScore = 3; match.pScore = 0;
                player.winStreak = 0; player.losses = (player.losses || 0) + 1; save();
                incrementMission('play_exhibition');
                let resetNote = priorStreak >= 3 ? `<br><span style="color:#e74c3c; font-size:15px;">🔥 Win streak reset (was ${priorStreak}).</span>` : '';
                showNotification(`🏳️ You forfeited the match. Defeat!${resetNote}`, 2500, () => { showScreen('draft-board-screen'); renderDraftBoard(); });
                return;
            }

            if (isDraw) {
                // Genuine draw after Overtime — rare enough that it's worth a flat 10-pick
                // reward, but it doesn't touch wins/losses/streak at all; it's not tracked
                // as its own stat anywhere, just a one-off result.
                player.picks += 10; save();
                incrementMission('play_exhibition');
                showNotification(`🤝 MATCH DRAW!<br>Even Overtime couldn't decide it — you received 10 Draft picks.`, 3000, () => { showScreen('draft-board-screen'); renderDraftBoard(); });
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
