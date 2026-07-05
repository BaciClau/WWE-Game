function clearTradeSelection() {
            tradeTarget = null;
            tradeSacrifices = [];
            updateTradeUI();
            renderDeck();
        }

        function getSacrificeXpEnhanced(uid, targetCard) {
            const c = player.inventory.find(x => x.uid === uid);
            if (!c) return { xp: 0, levelBonus: 0, isNormalUpgrade: false };
            const base = getCardBase(c);
            const idx = RARITIES.indexOf(getCardRarity(c));
            let xp = UPGRADE.XP_BASE * Math.pow(2, Math.max(0, idx));

            // Support cards give normal XP, no bonuses
            if (base.gender === 'S') return { xp, levelBonus: 0, isNormalUpgrade: false };

            const isNormalUpgrade = c.upgradeType === 'normal';
            // Dublu XP dacă sacrificiul e un Normal Upgrade
            if (isNormalUpgrade) xp *= 2;

            // Dacă sacrificiul are nivel mai mare decât 1, transferă o parte din XP acumulat
            // Formula: 25% din (nivel_sacrificiu - 1) * XP_per_level (bazat pe raritate)
            const sacLevel = getEffectiveLevel(c);
            let levelBonus = 0;
            if (sacLevel > 1 && targetCard) {
                const sacRarityIdx = RARITIES.indexOf(getCardRarity(c));
                const xpPerLevel = UPGRADE.XP_BASE * Math.pow(2, Math.max(0, sacRarityIdx));
                // 40% din XP-ul total investit în sacrificiu se transferă
                let totalInvested = 0;
                for (let lv = 1; lv < sacLevel; lv++) totalInvested += lv * 100;
                levelBonus = Math.floor(totalInvested * 0.40);
            }
            return { xp, levelBonus, isNormalUpgrade };
        }

        function updateTradeUI() {
            const status = document.getElementById('trade-status');
            const btnTrade = document.getElementById('btn-trade');
            const btnNorm = document.getElementById('btn-promote-normal');
            const btnPerf = document.getElementById('btn-promote-perfect');
            const btnClear = document.getElementById('btn-clear-trade');
            if (!status) return;

            btnTrade.style.display = 'none';
            btnNorm.style.display = 'none';
            btnPerf.style.display = 'none';
            btnClear.style.display = tradeTarget ? 'inline-flex' : 'none';

            if (!tradeTarget) {
                status.innerHTML = 'Tap a card from your collection as the <strong>target</strong> for trade. You can also use Support cards as fodder!';
                return;
            }

            const target = player.inventory.find(c => c.uid === tradeTarget);
            if (!target) { clearTradeSelection(); return; }
            const base = getCardBase(target);
            if (base.gender === 'S') {
                status.innerHTML = 'Support cards cannot be upgraded (but they can be used as fodder for others).';
                return;
            }

            const effMax = getEffectiveMax(target);
            const effLv = getEffectiveLevel(target);
            const xpNeed = getXpNeeded(target);

            let pendingXP = 0;
            let bonusXP = 0;
            let hasNormalUpgradeFodder = false;
            tradeSacrifices.filter(u => u !== tradeTarget).forEach(u => {
                const info = getSacrificeXpEnhanced(u, target);
                pendingXP += info.xp;
                bonusXP += info.levelBonus;
                if (info.isNormalUpgrade) hasNormalUpgradeFodder = true;
            });
            const pending = pendingXP + bonusXP;

            if (canPromote(target)) {
                status.innerHTML = `<strong>${base.name}</strong> LVL ${effLv}/${effMax} — choose <strong>Normal Upgrade</strong> or <strong>Perfect ★</strong>.`;
                btnNorm.style.display = 'inline-flex';
                btnPerf.style.display = 'inline-flex';
                if (pending > 0) btnTrade.style.display = 'inline-flex';
                return;
            }

            if (effLv >= effMax) {
                status.innerHTML = `<strong>${base.name}</strong> is at max level (${effMax}).`;
                return;
            }

            let xpDesc = `+${pendingXP} XP`;
            if (bonusXP > 0) xpDesc += ` <span style="color:#f1c40f">+${bonusXP} XP level bonus</span>`;
            if (hasNormalUpgradeFodder) xpDesc += ` <span style="color:#e040fb">(2× from Normal Upgrade!)</span>`;
            status.innerHTML = `<strong>${base.name}</strong> LVL ${effLv}/${effMax} — XP: <strong>${target.xp}/${xpNeed}</strong> | fodder: <strong>${xpDesc}</strong> = <strong style="color:#2ecc71">${pending} XP total</strong>`;
            if (pending > 0) btnTrade.style.display = 'inline-flex';
        }

        function selectTradeCard(uid) {
            const card = player.inventory.find(c => c.uid === uid);
            if (!card) return;
            const base = getCardBase(card);

            // Support cards can ONLY be fodder, never target
            if (base.gender === 'S') {
                if (!tradeTarget) return; // no target set — ignoring
                if (tradeSacrifices.includes(uid)) {
                    tradeSacrifices = tradeSacrifices.filter(x => x !== uid);
                } else {
                    tradeSacrifices.push(uid);
                }
                updateTradeUI();
                renderDeck();
                return;
            }

            if (tradeTarget === uid) {
                tradeTarget = null;
                tradeSacrifices = [];
            } else if (!tradeTarget) {
                tradeTarget = uid;
            } else if (tradeSacrifices.includes(uid)) {
                tradeSacrifices = tradeSacrifices.filter(x => x !== uid);
            } else if (uid !== tradeTarget) {
                tradeSacrifices.push(uid);
            }
            updateTradeUI();
            renderDeck();
        }

        function consumeSacrifices() {
            tradeSacrifices.filter(u => u !== tradeTarget).forEach(uid => {
                player.inventory = player.inventory.filter(c => c.uid !== uid);
                player.deck.M = player.deck.M.filter(u => u !== uid);
                player.deck.F = player.deck.F.filter(u => u !== uid);
                player.deck.S = player.deck.S.filter(u => u !== uid);
            });
            tradeSacrifices = [];
        }

        function feedSacrifices() {
            const target = player.inventory.find(c => c.uid === tradeTarget);
            const sacs = tradeSacrifices.filter(u => u !== tradeTarget);
            if (!target || sacs.length === 0) return;

            let baseXP = 0, bonusXP = 0;
            let hasNormalUpgradeFodder = false;
            sacs.forEach(uid => {
                const info = getSacrificeXpEnhanced(uid, target);
                baseXP += info.xp;
                bonusXP += info.levelBonus;
                if (info.isNormalUpgrade) hasNormalUpgradeFodder = true;
            });
            const totalXP = baseXP + bonusXP;
            consumeSacrifices();
            target.xp = (target.xp || 0) + totalXP;
            const levels = processLevelUps(target);

            let msg = `+${baseXP} XP added!`;
            if (hasNormalUpgradeFodder) msg += `<br><span style="color:#e040fb">🔮 2× XP from Normal Upgrade!</span>`;
            if (bonusXP > 0) msg += `<br><span style="color:#f1c40f">+${bonusXP} XP level fodder bonus</span>`;
            if (levels > 0) msg += `<br>⬆️ ${getCardBase(target).name} → LVL ${getEffectiveLevel(target)}`;
            showNotification(msg, 2000);

            if (canPromote(target)) tradeTarget = null;
            autoEquipDeck(); save(); renderDeck();
        }

        function promoteNormal() {
            const target = player.inventory.find(c => c.uid === tradeTarget);
            if (!target || !canPromote(target)) return;
            target.upgradeType = 'normal';
            target.maxLvl = UPGRADE.NORMAL_MAX;
            processLevelUps(target);
            showNotification(`⬆️ UPGRADE NORMAL!<br>${getCardBase(target).name} can now reach LVL 15.`, 2500);
            tradeTarget = null;
            autoEquipDeck(); save(); renderDeck();
        }

        function promotePerfect() {
            const target = player.inventory.find(c => c.uid === tradeTarget);
            if (!target || !canPromote(target)) return;
            target.upgradeType = 'perfect';
            target.phase = 2;
            target.level = 0;
            target.xp = 0;
            target.maxLvl = UPGRADE.BASE_MAX;
            showNotification(`★ UPGRADE PERFECT!<br>${getCardBase(target).name} reset to ★0 — can now reach LVL 20!`, 2500);
            tradeTarget = null;
            autoEquipDeck(); save(); renderDeck();
        }
