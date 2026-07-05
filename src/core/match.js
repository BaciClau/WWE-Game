let match = { round: 1, pScore: 0, oScore: 0, hand: [], oppHand: [], used: [], selected: [], activeSupportUID: null, supportBonus: {pow:0, tgh:0, spd:0, cha:0}, pickBonus: 0 };

        function startMatchWithOpponent(idx) {
            let oppData = window.currentOpponents[idx];
            autoEquipDeck(); save();
            showScreen('match-screen');
            match = { round: 1, pScore: 0, oScore: 0, hand: [...player.deck.M, ...player.deck.F, ...player.deck.S], oppHand: oppData.deck, used: [], selected: [], activeSupportUID: null, supportBonus: {pow:0, tgh:0, spd:0, cha:0}, pickBonus: oppData.pickBonus, aiMode: oppData.aiMode || 'normal' };
            document.getElementById('score-player').innerText = "0"; document.getElementById('score-opp').innerText = "0";
            document.getElementById('arena-area').innerHTML = '<div class="vs-badge">VS</div>';
            document.getElementById('support-status').innerText = "Tap your Support card to activate it this round!";
            nextRound();
        }

        function nextRound() {
            if(match.round > 3 || match.pScore === 2 || match.oScore === 2) return endMatch(false);
            match.selected = []; match.activeSupportUID = null; match.supportBonus = {pow:0, tgh:0, spd:0, cha:0}; 
            document.getElementById('arena-area').innerHTML = '<div class="vs-badge">VS</div>';
            document.getElementById('btn-confirm-play').style.display = 'none';

            let availM = match.hand.filter(u => player.inventory.find(c=>c.uid===u) && DB.find(x=>x.id===player.inventory.find(c=>c.uid===u).id).gender === 'M' && !match.used.includes(u));
            let availF = match.hand.filter(u => player.inventory.find(c=>c.uid===u) && DB.find(x=>x.id===player.inventory.find(c=>c.uid===u).id).gender === 'F' && !match.used.includes(u));

            let rules = [];
            if(availM.length >= 1) rules.push({ t: 'SINGLES', r: 1, g: 'M' });
            if(availM.length >= 2) rules.push({ t: 'TAG TEAM', r: 2, g: 'M' });
            if(availF.length >= 1) rules.push({ t: 'DIVAS', r: 1, g: 'F' });

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

            document.getElementById('match-info').innerHTML = `ROUND ${match.round}<br><span style="color:#fff; font-size:18px;">STAT: <span style="color:#f1c40f">${st.toUpperCase()}</span></span>`;
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
                
                let div = document.createElement('div');
                div.innerHTML = renderHTMLCard(s, false, match.rule.stat);
                let cardEl = div.children[0];
                
                if (isU && !isSupportActivated) {
                    // Carte deja folosita in rundele anterioare
                    cardEl.classList.add('used');
                } else if (isSupportActivated) {
                    // Support activat — contur verde
                    cardEl.classList.add('support-active');
                } else if (isSupportCard) {
                    // Support disponibil — pulsatie verde
                    cardEl.classList.add('support-ready');
                } else if (isS) {
                    // Carte selectata
                    cardEl.style.cssText = "transform: translateY(-15px); border-color: #3498db !important; box-shadow: 0 10px 30px rgba(52, 152, 219, 0.8) !important;";
                } else if (!isActiveGender) {
                    // Carte de gen gresit — intunecata
                    cardEl.classList.add('battle-inactive');
                }
                
                // Onclick handlers
                if (isSupportCard && !isU && !isSupportActivated) {
                    div.onclick = () => {
                        match.activeSupportUID = u; match.used.push(u);
                        match.supportBonus = {pow: s.pow, tgh: s.tgh, spd: s.spd, cha: s.cha};
                        document.getElementById('support-status').innerHTML = `<span style="color:#2ecc71">✅ ${s.name} Activat! Bonus la ${match.rule.stat.toUpperCase()}!</span>`;
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

        function skipClash(pTot, oTot) {
            // Curăță timere rămase
            if (_clashTimer1) { clearTimeout(_clashTimer1); _clashTimer1 = null; }
            if (_clashTimer2) { clearTimeout(_clashTimer2); _clashTimer2 = null; }
            // Dezabonează click-ul de skip
            let arena = document.getElementById('arena-area');
            arena.onclick = null;
            arena.style.cursor = '';

            if(pTot > oTot) {
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
            } else if(oTot > pTot) {
                match.oScore++;
                showNotification(`<span style="color:#e74c3c;">ROUND LOSS...</span><br>${pTot} lost to ${oTot}`, 1500, () => {
                    document.getElementById('score-opp').innerText = match.oScore;
                    match.round++; nextRound();
                });
            } else {
                showNotification(`<span style="color:#f1c40f;">DRAW!</span><br>${pTot} vs ${oTot}`, 1500, () => { match.round++; nextRound(); });
            }
        }

        function showAbilityNotif(msg) {
            let old = document.getElementById('ability-notif');
            if (old) old.remove();
            let el = document.createElement('div');
            el.id = 'ability-notif';
            el.className = 'ability-notif';
            el.innerHTML = msg;
            document.body.appendChild(el);
            setTimeout(() => { if (el.parentNode) el.remove(); }, 3000);
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
            let abilityMessages = [];
            let abilityActivated = false;
            
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
                        pTot += bonus;
                        abilityMessages.push(`⚡ ${ab.icon} <strong>${cardStats.name}</strong>: "${ab.name}"! +${bonus} ${match.rule.stat.toUpperCase()}! ${ab.desc}`);
                        abilityActivated = true;
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
            });
            pTot += match.supportBonus[match.rule.stat] || 0; 

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
            oTot += aiPlay.supportBonus;

            oppP.forEach(c => {
                const ab = ABILITIES[c.id];
                if (ab && ab.stats.includes(activeStat) && Math.random() < aiPlay.abilityChance) {
                    const bonus = getAbilityBonus(c, activeStat);
                    oTot += bonus;
                    abilityMessages.push(`🔴 ${ab.icon} <strong>${c.name}</strong> (AI): "${ab.name}"! +${bonus} ${activeStat.toUpperCase()}!`);
                    setTimeout(() => {
                        let el = document.getElementById('card-'+c.uid);
                        if (el) {
                            el.classList.add('ability-active-flash');
                            burstAtElement(el, c.rarity);
                            setTimeout(()=>el.classList.remove('ability-active-flash'), 700);
                        }
                    }, 700);
                }
            });
            let arena = document.getElementById('arena-area');
            arena.innerHTML = `
                <div class="arena-side slide-in-left" id="arena-player">${match.selected.map(u => renderHTMLCard(getStats(player.inventory.find(c=>c.uid===u)), false, match.rule.stat)).join('')}</div>
                <div class="vs-badge">VS</div>
                <div class="arena-side slide-in-right" id="arena-opp">${oppP.map(c => renderHTMLCard(c, false, match.rule.stat)).join('')}</div>
            `;
            document.getElementById('btn-confirm-play').style.display = 'none';
            document.getElementById('support-status').innerText = ""; 

            // Arată notificare abilitate activată
            if (abilityMessages.length > 0) {
                setTimeout(() => showAbilityNotif(abilityMessages.join('<br>')), 400);
            }

            // Click pe arena pentru skip animație clash
            arena.style.cursor = 'pointer';
            arena.onclick = () => skipClash(pTot, oTot);

            _clashTimer1 = setTimeout(() => {
                _clashTimer1 = null;
                let ap = document.getElementById('arena-player');
                let ao = document.getElementById('arena-opp');
                if (ap) ap.classList.add('anim-clash-left');
                if (ao) ao.classList.add('anim-clash-right');

                _clashTimer2 = setTimeout(() => {
                    _clashTimer2 = null;
                    skipClash(pTot, oTot);
                }, 800);
            }, 600);
        }

        function endMatch(forfeit) {
            let priorStreak = player.winStreak || 0;

            if(forfeit) {
                match.oScore = 3; match.pScore = 0;
                player.winStreak = 0; save();
                let resetNote = priorStreak >= 3 ? `<br><span style="color:#e74c3c; font-size:15px;">🔥 Win streak reset (was ${priorStreak}).</span>` : '';
                showNotification(`🏳️ You forfeited the match. Defeat!${resetNote}`, 2500, () => { showScreen('draft-board-screen'); renderDraftBoard(); });
                return;
            }

            let w = match.pScore > match.oScore;
            let picksWon = (match.pScore === 3) ? 3 : (w ? 2 : 1);

            if (w && match.pickBonus > 0) {
                picksWon += match.pickBonus; // Aplicam Pick Bonus pt victoriile pe Hard
            }

            let coinsWon = w ? 30 : 10;
            let streakMsgs = [];
            let freePackEarned = false;

            if (w) {
                player.winStreak = priorStreak + 1;
                let streak = player.winStreak;

                if (streak % STREAK_REWARDS.freePackEvery === 0) {
                    freePackEarned = true;
                    streakMsgs.push(`🔥 ${streak}-Win Streak! FREE PACK!`);
                }
                if (streak % STREAK_REWARDS.pickBonusEvery === 0) {
                    picksWon += STREAK_REWARDS.pickBonusAmount;
                    streakMsgs.push(`🔥 ${streak}-Win Streak! +${STREAK_REWARDS.pickBonusAmount} Pick`);
                }
                if (streak % STREAK_REWARDS.coinBonusEvery === 0) {
                    let bonus = Math.round(coinsWon * STREAK_REWARDS.coinBonusPct / 100);
                    coinsWon += bonus;
                    streakMsgs.push(`🔥 ${streak}-Win Streak! +${STREAK_REWARDS.coinBonusPct}% coins`);
                }
            } else {
                player.winStreak = 0;
            }

            player.picks += picksWon; player.coins += coinsWon; save();

            let streakHtml = streakMsgs.length ? `<br><span style="color:#ff9800; font-size:15px;">${streakMsgs.join('<br>')}</span>` : '';
            let lossResetNote = (!w && priorStreak >= 3) ? `<br><span style="color:#e74c3c; font-size:15px;">🔥 Win streak reset (was ${priorStreak}).</span>` : '';

            if(w) {
                celebrateMatchWin();
                showNotification(`🎉 YOU WON THE MATCH! 🎉<br>You received ${picksWon} Draft picks.${streakHtml}`, streakMsgs.length ? 4000 : 3000, () => {
                    showScreen('draft-board-screen'); renderDraftBoard();
                    if (freePackEarned) buyPack(0, STREAK_REWARDS.freePackRarities);
                });
            } else {
                showNotification(`💀 YOU LOST THE MATCH... 💀<br>You received 1 consolation pick.${lossResetNote}`, 3000, () => { showScreen('draft-board-screen'); renderDraftBoard(); });
            }
        }
