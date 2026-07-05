function updateUI() {
            document.getElementById('coins-display').innerText = player.coins;
            document.getElementById('picks-display').innerText = player.picks;
            document.getElementById('draft-picks').innerText = player.picks;
            document.getElementById('streak-display').innerText = player.winStreak || 0;
            document.getElementById('streak-badge').style.display = (player.winStreak > 0) ? 'inline' : 'none';
            if(document.getElementById('col-count')) document.getElementById('col-count').innerText = player.inventory.length;

            let tierInfo = calculateDeckTier();
            let tn = document.getElementById('tier-name');
            tn.innerText = tierInfo.name; tn.style.color = tierInfo.color;
            document.getElementById('tier-bar').style.width = tierInfo.pct + '%';
            document.getElementById('tier-bar').style.background = `linear-gradient(90deg, ${tierInfo.color}, #fff)`;
            document.getElementById('tier-numbers-display').innerText = `${tierInfo.current} / ${tierInfo.next}`;
        }

        function showScreen(id) { 
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); 
            document.getElementById(id).classList.add('active'); 
            if (id !== 'deck-screen') {
                clearTradeSelection();
                if (deckEditMode) cancelDeckEdit();
            }
        }

        function renderHTMLCard(stats, selectable=false, highlight="", extraClass="") {
            let lvlLabel = stats.effectiveLvl ?? stats.lvl;
            let maxLabel = stats.effectiveMax ?? stats.maxLvl;
            if (stats.lvl === '?') {
                lvlLabel = '?';
                maxLabel = '?';
            } else if (stats.perfect && stats.phase === 2) {
                lvlLabel = `★${stats.lvl}`;
                maxLabel = `${stats.effectiveLvl}/20`;
            }
            const xpMax = stats.xpNeeded || 0;
            const xpPct = (stats.gender === 'S' || stats.lvl === '?' || xpMax === 0) ? 100 : Math.min(100, ((stats.xp || 0) / xpMax) * 100);
            const upgradeTag = stats.upgradeType === 'normal' ? '<div class="star star-normal">◆</div>' : '';
            
            // Abilitate specială pentru cărțile non-Support, non-Common
            let abilityHTML = '';
            if (stats.gender !== 'S' && stats.rarity !== 'Common') {
                const ab = ABILITIES[stats.id];
                if (ab) {
                    const s1 = ab.stats[0].toUpperCase();
                    const s2 = ab.stats[1].toUpperCase();
                    // Bonus fix afișat pe carte per raritate
                    let badgesHTML = '';
                    const rarity = stats.rarity;
                    if (rarity === 'Uncommon') {
                        // +10 la un singur stat (primul)
                        badgesHTML = `<span class="ability-stat-badge">${s1} +10</span>`;
                    } else if (rarity === 'Rare') {
                        // +15 la stat-ul principal
                        badgesHTML = `<span class="ability-stat-badge">${s1} +15</span>`;
                    } else if (rarity === 'SuperRare') {
                        // Verificăm dacă exceleaza considerabil
                        const statVals = { pow: stats.pow, tgh: stats.tgh, spd: stats.spd, cha: stats.cha };
                        const vals = Object.entries(statVals).filter(([k]) => statVals[k] > 0).sort((a, b) => b[1] - a[1]);
                        const topStat = vals.length > 0 ? vals[0][0] : null;
                        const topVal = vals.length > 0 ? vals[0][1] : 0;
                        const secondVal = vals.length > 1 ? vals[1][1] : 0;
                        const excels = topStat && (secondVal === 0 || (topVal - secondVal) / secondVal >= 0.05);
                        if (excels && ab.stats.includes(topStat)) {
                            badgesHTML = `<span class="ability-stat-badge">${topStat.toUpperCase()} +20</span>`;
                        } else {
                            badgesHTML = `<span class="ability-stat-badge">${s1} +11</span><span class="ability-stat-badge">${s2} +11</span>`;
                        }
                    } else if (rarity === 'UltraRare') {
                        badgesHTML = `<span class="ability-stat-badge">${s1} +17</span><span class="ability-stat-badge">${s2} +17</span>`;
                    } else if (rarity === 'Epic') {
                        badgesHTML = `<span class="ability-stat-badge">${s1} +25</span><span class="ability-stat-badge">${s2} +25</span>`;
                    } else if (rarity === 'Legendary') {
                        badgesHTML = `<span class="ability-stat-badge">${s1} +42</span><span class="ability-stat-badge">${s2} +42</span>`;
                    } else if (rarity === 'Survivor') {
                        badgesHTML = `<span class="ability-stat-badge">${s1} +55</span><span class="ability-stat-badge">${s2} +55</span>`;
                    }
                    abilityHTML = `<div class="card-ability">
                        <span class="ability-name"><span class="ability-icon-small">${ab.icon}</span>${ab.name}</span>
                        <div class="ability-stats-row">${badgesHTML}</div>
                    </div>`;
                }
            }

            return `
                <div class="card rarity-${stats.rarity} ${extraClass}" onclick="${selectable ? `selectTradeCard('${stats.uid}')` : ''}" id="card-${stats.uid||stats.id}">
                    ${stats.perfect ? '<div class="star">★</div>' : upgradeTag}
                    <img src="${stats.img}">
                    <div class="card-name-plate">${stats.name}</div>
                    <div class="card-stats">
                        <div class="stat ${highlight==='pow'?'stat-highlight':''}">${stats.pow>0?'POW: '+stats.pow:''}</div>
                        <div class="stat ${highlight==='tgh'?'stat-highlight':''}">${stats.tgh>0?'TGH: '+stats.tgh:''}</div>
                        <div class="stat ${highlight==='spd'?'stat-highlight':''}">${stats.spd>0?'SPD: '+stats.spd:''}</div>
                        <div class="stat ${highlight==='cha'?'stat-highlight':''}">${stats.cha>0?'CHA: '+stats.cha:''}</div>
                    </div>
                    ${abilityHTML}
                    ${stats.gender !== 'S' ? `
                    <div class="card-footer"><span>LVL ${lvlLabel}</span><span>MAX ${maxLabel}</span></div>
                    <div class="xp-bar"><div class="xp-fill" style="width:${xpPct}%"></div></div>
                    <div class="xp-text">${stats.lvl==='?'?'SCALAT LA PUTEREA TA':((stats.xp||0)+' / '+(xpMax||'MAX')+' XP')}</div>` : '<div style="text-align:center;color:#bbb;font-size:12px;margin-top:5px; font-weight:bold;">SUPPORT</div>'}
                </div>
            `;
        }
