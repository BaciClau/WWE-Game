function getSacrificeXpEnhanced(uid, targetCard) {
            const c = player.inventory.find(x => x.uid === uid);
            if (!c) return { xp: 0, levelBonus: 0, isNormalUpgrade: false };
            const base = getCardBase(c);
            const idx = RARITIES.indexOf(getCardRarity(c));
            let xp = UPGRADE.XP_BASE * Math.pow(2, Math.max(0, idx));

            // Support cards give normal XP, no bonuses
            if (base.gender === 'S') return { xp, levelBonus: 0, isNormalUpgrade: false };

            const isNormalUpgrade = c.upgradeType === 'normal';
            // Dublu XP dacă sacrificiul e un Normal Upgrade (Pro)
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

        function consumeSacrifices() {
            tradeSacrifices.filter(u => u !== tradeTarget).forEach(uid => {
                player.inventory = player.inventory.filter(c => c.uid !== uid);
                player.deck.M = player.deck.M.filter(u => u !== uid);
                player.deck.F = player.deck.F.filter(u => u !== uid);
                player.deck.S = player.deck.S.filter(u => u !== uid);
            });
            tradeSacrifices = [];
        }

        // --- CARD FOCUS POPUP: Train / Lock / Favorite ---

        function isCardEquipped(uid) {
            return player.deck.M.includes(uid) || player.deck.F.includes(uid) || player.deck.S.includes(uid);
        }

        function openCardFocus(uid) {
            const card = player.inventory.find(c => c.uid === uid);
            if (!card) return;
            tradeTarget = uid;
            tradeSacrifices = [];

            document.getElementById('card-focus-card-wrap').innerHTML = renderHTMLCard(getStats(card));
            document.getElementById('card-focus-menu').style.display = 'flex';
            document.getElementById('card-focus-train').style.display = 'none';
            updateFocusMenuButtons();

            document.getElementById('card-focus-modal').style.display = 'flex';
        }

        function closeCardFocus(event) {
            if (event && event.target && event.target.id !== 'card-focus-modal') return;
            document.getElementById('card-focus-modal').style.display = 'none';
            tradeTarget = null;
            tradeSacrifices = [];
            renderDeck();
        }

        function updateFocusMenuButtons() {
            const card = player.inventory.find(c => c.uid === tradeTarget);
            if (!card) return;
            const lockBtn = document.getElementById('focus-lock-btn');
            const favBtn = document.getElementById('focus-fav-btn');
            lockBtn.innerText = card.locked ? '🔓 UNLOCK' : '🔒 LOCK';
            lockBtn.classList.toggle('active', !!card.locked);
            const isFav = player.favoriteUid === card.uid;
            favBtn.innerText = isFav ? '💔 UNFAVORITE' : '❤️ FAVORITE';
            favBtn.classList.toggle('active', isFav);
        }

        function focusToggleLock() {
            const card = player.inventory.find(c => c.uid === tradeTarget);
            if (!card) return;
            card.locked = !card.locked;
            document.getElementById('card-focus-card-wrap').innerHTML = renderHTMLCard(getStats(card));
            updateFocusMenuButtons();
            save(false);
        }

        function focusToggleFavorite() {
            const card = player.inventory.find(c => c.uid === tradeTarget);
            if (!card) return;
            player.favoriteUid = (player.favoriteUid === card.uid) ? null : card.uid;
            updateFocusMenuButtons();
            save(false);
            updateUI();
        }

        function focusBackToMenu() {
            const card = player.inventory.find(c => c.uid === tradeTarget);
            if (!card) return;
            tradeSacrifices = [];
            document.getElementById('card-focus-card-wrap').innerHTML = renderHTMLCard(getStats(card));
            document.getElementById('card-focus-menu').style.display = 'flex';
            document.getElementById('card-focus-train').style.display = 'none';
            updateFocusMenuButtons();
        }

        function focusStartTrain() {
            const card = player.inventory.find(c => c.uid === tradeTarget);
            if (!card) return;
            document.getElementById('card-focus-menu').style.display = 'none';
            document.getElementById('card-focus-train').style.display = 'flex';
            renderFocusFodderGrid();
            updateFocusTrainStatus();
        }

        function renderFocusFodderGrid() {
            const grid = document.getElementById('focus-fodder-grid');
            grid.innerHTML = '';
            const fodderCards = player.inventory.filter(c => c.uid !== tradeTarget && !c.locked && !isCardEquipped(c.uid));
            fodderCards.forEach(c => {
                const s = getStats(c);
                const extra = tradeSacrifices.includes(c.uid) ? 'trade-sacrifice' : '';
                const wrapper = document.createElement('div');
                wrapper.innerHTML = renderHTMLCard(s, false, '', extra);
                wrapper.firstElementChild.onclick = () => toggleFocusFodder(c.uid);
                wrapper.firstElementChild.style.cursor = 'pointer';
                grid.appendChild(wrapper.firstElementChild);
            });
        }

        function toggleFocusFodder(uid) {
            if (tradeSacrifices.includes(uid)) {
                tradeSacrifices = tradeSacrifices.filter(u => u !== uid);
            } else {
                tradeSacrifices.push(uid);
            }
            renderFocusFodderGrid();
            updateFocusTrainStatus();
        }

        function updateFocusTrainStatus() {
            const status = document.getElementById('focus-train-status');
            const btnFeed = document.getElementById('focus-btn-feed');
            const btnPro = document.getElementById('focus-btn-pro');
            const btnPerfectPro = document.getElementById('focus-btn-perfect-pro');

            btnFeed.style.display = 'none';
            btnPro.style.display = 'none';
            btnPerfectPro.style.display = 'none';

            const target = player.inventory.find(c => c.uid === tradeTarget);
            if (!target) return;
            const base = getCardBase(target);
            if (base.gender === 'S') {
                status.innerHTML = 'Support cards cannot be trained (but they can be used as fodder for others).';
                return;
            }

            const effMax = getEffectiveMax(target);
            const effLv = getEffectiveLevel(target);
            const xpNeed = getXpNeeded(target);

            let pendingXP = 0;
            let bonusXP = 0;
            let hasNormalUpgradeFodder = false;
            tradeSacrifices.forEach(u => {
                const info = getSacrificeXpEnhanced(u, target);
                pendingXP += info.xp;
                bonusXP += info.levelBonus;
                if (info.isNormalUpgrade) hasNormalUpgradeFodder = true;
            });
            const pending = pendingXP + bonusXP;

            if (canPromote(target)) {
                status.innerHTML = `<strong>${base.name}</strong> LVL ${effLv}/${effMax} — choose <strong>Pro</strong> or <strong>Perfect Pro ★</strong>.`;
                btnPro.style.display = 'inline-flex';
                btnPerfectPro.style.display = 'inline-flex';
                if (pending > 0) btnFeed.style.display = 'inline-flex';
                return;
            }

            if (effLv >= effMax) {
                status.innerHTML = `<strong>${base.name}</strong> is at max level (${effMax}).`;
                return;
            }

            let xpDesc = `+${pendingXP} XP`;
            if (bonusXP > 0) xpDesc += ` <span style="color:#f1c40f">+${bonusXP} XP level bonus</span>`;
            if (hasNormalUpgradeFodder) xpDesc += ` <span style="color:#e040fb">(2× from Pro fodder!)</span>`;
            status.innerHTML = `<strong>${base.name}</strong> LVL ${effLv}/${effMax} — XP: <strong>${target.xp}/${xpNeed}</strong> | fodder: <strong>${xpDesc}</strong> = <strong style="color:#2ecc71">${pending} XP total</strong>`;
            if (pending > 0) btnFeed.style.display = 'inline-flex';
        }

        function focusFeedSacrifices() {
            const target = player.inventory.find(c => c.uid === tradeTarget);
            const sacs = tradeSacrifices.slice();
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
            if (hasNormalUpgradeFodder) msg += `<br><span style="color:#e040fb">🔮 2× XP from Pro fodder!</span>`;
            if (bonusXP > 0) msg += `<br><span style="color:#f1c40f">+${bonusXP} XP level fodder bonus</span>`;
            if (levels > 0) msg += `<br>⬆️ ${getCardBase(target).name} → LVL ${getEffectiveLevel(target)}`;
            showNotification(msg, 2000);

            autoEquipDeck(); save();
            document.getElementById('card-focus-card-wrap').innerHTML = renderHTMLCard(getStats(target));
            if (canPromote(target)) {
                focusBackToMenu();
            } else {
                renderFocusFodderGrid();
                updateFocusTrainStatus();
            }
        }

        function focusPromoteNormal() {
            const target = player.inventory.find(c => c.uid === tradeTarget);
            if (!target || !canPromote(target)) return;
            target.upgradeType = 'normal';
            target.maxLvl = UPGRADE.NORMAL_MAX;
            processLevelUps(target);
            showNotification(`⬆️ PRO!<br>${getCardBase(target).name} can now reach LVL 15.`, 2500);
            autoEquipDeck(); save();
            focusBackToMenu();
        }

        function focusPromotePerfect() {
            const target = player.inventory.find(c => c.uid === tradeTarget);
            if (!target || !canPromote(target)) return;
            target.upgradeType = 'perfect';
            target.phase = 2;
            target.level = 0;
            target.xp = 0;
            target.maxLvl = UPGRADE.BASE_MAX;
            showNotification(`★ PERFECT PRO!<br>${getCardBase(target).name} reset to ★0 — can now reach LVL 20!`, 2500);
            autoEquipDeck(); save();
            focusBackToMenu();
        }
