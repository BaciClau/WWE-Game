function showOpponentSelect() {
            autoEquipDeck();
            let myPower = calculateDeckTier().current;

            // 4 opponents with distinct difficulty brackets
            const brackets = [
                { label: 'EASY',      emoji: '😌', minPct: 0.95, maxPct: 0.95, pickBonus: 0, aiMode: 'easy' },
                { label: 'NORMAL',    emoji: '😐', minPct: 1.00, maxPct: 1.00, pickBonus: 0, aiMode: 'normal' },
                { label: 'HARD',      emoji: '😤', minPct: 1.00, maxPct: 1.03, pickBonus: 1, aiMode: 'hard' },
                { label: 'NIGHTMARE', emoji: '💀', minPct: 1.02, maxPct: 1.05, pickBonus: 2, aiMode: 'nightmare' },
            ];

            window.currentOpponents = brackets.map(b => {
                let oppPower = Math.floor(myPower * (b.minPct + Math.random() * (b.maxPct - b.minPct)));
                oppPower = Math.max(1, oppPower);
                return { deck: createDeckForPower(oppPower), pickBonus: b.pickBonus, power: oppPower, label: b.label, emoji: b.emoji, aiMode: b.aiMode };
            });

            let container = document.getElementById('opponents-container');
            container.innerHTML = '';

            window.currentOpponents.forEach((opp, idx) => {
                let relPct = Math.round((opp.power / myPower) * 100);
                let diffColor;
                if (opp.aiMode === 'easy') diffColor = '#2ecc71';
                else if (opp.aiMode === 'normal') diffColor = '#f1c40f';
                else if (opp.aiMode === 'hard') diffColor = '#e67e22';
                else diffColor = '#e74c3c';

                let diffLabel;
                if (opp.power > myPower) diffLabel = `+${relPct - 100}% vs you`;
                else if (opp.power < myPower) diffLabel = `-${100 - relPct}% vs you`;
                else diffLabel = 'Even match';

                let diffDesc;
                if (opp.aiMode === 'easy') diffDesc = '🎲 AI plays random';
                else if (opp.aiMode === 'normal') diffDesc = '🧠 AI plays best card available';
                else if (opp.aiMode === 'hard') diffDesc = '⚡ AI plays strategic & smart';
                else diffDesc = '💡 AI plays near-optimally';

                container.innerHTML += `
                    <div class="card" style="width:220px; height:auto; padding:22px 18px; align-items:center; border-color:${diffColor}; box-shadow: 0 0 25px ${diffColor}55; cursor:pointer;" onclick="startMatchWithOpponent(${idx})">
                        <div style="font-size: 52px; margin-bottom: 6px;">${opp.emoji}</div>
                        <div style="color:${diffColor}; font-size:18px; font-weight:bold; letter-spacing:2px; margin-bottom:6px;">${opp.label}</div>
                        <div style="color:#aaa; font-size:11px; font-family:Arial; margin-bottom:10px; letter-spacing:0.5px;">${diffDesc}</div>
                        <div style="background: rgba(0,0,0,0.85); padding: 10px 14px; border-radius:10px; border:1px solid #555; width: 100%; text-align:center; margin-bottom:10px;">
                            <div style="color:#aaa; font-size:11px; font-family:Arial; letter-spacing:1px; margin-bottom:4px;">OPPONENT POWER</div>
                            <div style="color:#fff; font-size:26px; font-weight:bold;">${opp.power}</div>
                            <div style="color:${diffColor}; font-size:12px; font-family:Arial; margin-top:4px;">${diffLabel}</div>
                        </div>
                        ${opp.pickBonus > 0 ? `<div style="background: rgba(241,196,15,0.15); border:1px solid #f1c40f; border-radius:8px; padding:6px 12px; color:#f1c40f; font-size:13px; font-weight:bold; width:100%; text-align:center; margin-bottom:8px;">🎴 +${opp.pickBonus} PICK BONUS if you win</div>` : ''}
                        <div style="margin-top:8px; color:#fff; font-size:18px; font-weight:bold; letter-spacing:2px; text-shadow:0 0 10px ${diffColor};">▶ FIGHT!</div>
                    </div>
                `;
            });

            showScreen('opp-select-screen');
        }

        // Genereaza o echipă inamică scalată fix pe puterea target-ată, din tier-ul in care trebuie sa fie
        function createDeckForPower(targetPower) {
            let t = TIERS[2]; // Default Rare
            for(let i=0; i<TIERS.length; i++) { if(targetPower >= TIERS[i].min) t = TIERS[i]; }
            
            let base = t.base;
            let poolM = DB.filter(c => c.gender === 'M' && c.rarity === base);
            let poolF = DB.filter(c => c.gender === 'F' && c.rarity === base);
            let poolS = DB.filter(c => c.gender === 'S' && c.rarity === base);
            
            // Siguranta
            if(!poolM.length) poolM = DB.filter(c => c.gender === 'M');
            if(!poolF.length) poolF = DB.filter(c => c.gender === 'F');
            if(!poolS.length) poolS = DB.filter(c => c.gender === 'S');
            
            let deck = [];
            for(let i=0; i<4; i++) deck.push({ ...poolM[Math.floor(Math.random()*poolM.length)] });
            deck.push({ ...poolF[Math.floor(Math.random()*poolF.length)] });
            deck.push({ ...poolS[Math.floor(Math.random()*poolS.length)] });
            
            let sum = 0;
            deck.forEach(c => sum += (c.pow + c.tgh + c.spd + c.cha));
            sum = Math.max(1, sum);
            
            let ratio = targetPower / sum;
            
            // Construieste stats custom si returneaza "Stats Finale" pentru inamic
            return deck.map((c, i) => {
                return {
                    ...c, uid: 'o_'+i, lvl: '?', maxLvl: '?', xp: 0, pro: false,
                    pow: Math.floor(c.pow * ratio),
                    tgh: Math.floor(c.tgh * ratio),
                    spd: Math.floor(c.spd * ratio),
                    cha: Math.floor(c.cha * ratio)
                };
            });
        }
