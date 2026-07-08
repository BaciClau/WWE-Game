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
            focusMode = 'train';

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
            const cardListScreen = document.getElementById('card-list-screen');
            if (cardListScreen && cardListScreen.classList.contains('active')) renderCardList();
            else renderDeck();
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
            const target = player.inventory.find(c => c.uid === tradeTarget);
            const fodderCards = player.inventory.filter(c => {
                if (c.uid === tradeTarget || c.locked || isCardEquipped(c.uid)) return false;
                if (focusMode === 'combine') return target && c.id === target.id;
                return true;
            });
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
            if (focusMode === 'combine') {
                // Combining only ever fuses ONE duplicate into the target — selecting a
                // different duplicate replaces the previous pick instead of stacking.
                tradeSacrifices = tradeSacrifices.includes(uid) ? [] : [uid];
            } else if (tradeSacrifices.includes(uid)) {
                tradeSacrifices = tradeSacrifices.filter(u => u !== uid);
            } else {
                tradeSacrifices.push(uid);
            }
            renderFocusFodderGrid();
            updateFocusTrainStatus();
        }

        // Pro/Perfect Pro requires an exact duplicate (same DB id) fused into the target —
        // matching WWE SuperCard's real Combine mechanic. Combining works at ANY level, even
        // two level-1 duplicates:
        //   - Perfect Pro requires BOTH the target and the duplicate to already be fully
        //     trained (base max level) at the moment of combining.
        //   - Otherwise, fusing works too, just yields a regular (weaker) Pro.
        // TRAIN only ever levels a card up via XP fodder — it never promotes on its own.
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

            if (focusMode === 'combine') {
                const modeTag = `<div style="color:#e040fb; font-size:12px; margin-bottom:6px;">🔀 COMBINE — fuse a duplicate ${base.name} to promote</div>`;
                if (!canPromote(target)) {
                    status.innerHTML = `${modeTag}<strong>${base.name}</strong> has already been promoted.`;
                    return;
                }
                const dup = tradeSacrifices.length === 1 ? player.inventory.find(c => c.uid === tradeSacrifices[0]) : null;
                if (!dup) {
                    status.innerHTML = `${modeTag}<strong>${base.name}</strong> LVL ${effLv}/${effMax} — select the duplicate below to fuse. Works at any level, but <strong>Perfect Pro</strong> needs both cards fully trained first.`;
                    return;
                }
                const targetMaxed = effLv >= effMax;
                const dupMaxed = getEffectiveLevel(dup) >= getBaseMaxLevel(dup);
                const bothMaxed = targetMaxed && dupMaxed;
                const proMax = getProMaxLevel(target);
                status.innerHTML = bothMaxed
                    ? `${modeTag}Both cards are fully trained — <strong style="color:#2ecc71">Perfect Pro</strong> available!`
                    : `${modeTag}Not both fully trained (target ${effLv}/${effMax}, duplicate ${getEffectiveLevel(dup)}/${getBaseMaxLevel(dup)}) — only regular <strong>Pro</strong> available.`;
                btnPro.innerText = `⬆️ PRO (MAX ${proMax})`;
                btnPerfectPro.innerText = `★ PERFECT PRO (MAX ${proMax})`;
                btnPro.style.display = 'inline-flex';
                btnPerfectPro.style.display = bothMaxed ? 'inline-flex' : 'none';
                return;
            }

            // --- TRAIN mode: level up via XP fodder only, no promotion here anymore. ---
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

            if (effLv >= effMax) {
                status.innerHTML = `<strong>${base.name}</strong> is at max level (${effMax}). Use <strong>COMBINE</strong> (Card List) with a duplicate to promote to Pro or Perfect Pro.`;
                return;
            }

            let xpDesc = `+${pendingXP} XP`;
            if (bonusXP > 0) xpDesc += ` <span style="color:#f1c40f">+${bonusXP} XP level bonus</span>`;
            if (hasNormalUpgradeFodder) xpDesc += ` <span style="color:#e040fb">(2× from Pro fodder!)</span>`;
            status.innerHTML = `<strong>${base.name}</strong> LVL ${effLv}/${effMax} — XP: <strong>${target.xp}/${xpNeed}</strong> | fodder: <strong>${xpDesc}</strong> = <strong style="color:#2ecc71">${pending} XP total</strong>`;
            if (pending > 0) btnFeed.style.display = 'inline-flex';
        }

        // TRAIN-only — feeds fodder XP into the target. Never called in combine mode (the
        // FEED button is hidden there; see updateFocusTrainStatus()).
        function focusFeedSacrifices() {
            const target = player.inventory.find(c => c.uid === tradeTarget);
            const sacs = tradeSacrifices.slice();
            if (!target || sacs.length === 0 || focusMode === 'combine') return;

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
            incrementMission('train_card');
            document.getElementById('card-focus-card-wrap').innerHTML = renderHTMLCard(getStats(target));
            if (canPromote(target)) {
                focusBackToMenu();
            } else {
                renderFocusFodderGrid();
                updateFocusTrainStatus();
            }
        }

        // Both promotions now require COMBINE mode with exactly one duplicate selected —
        // matching WWE SuperCard's real mechanic (two identical cards fuse into one Pro/
        // Perfect Pro card; the duplicate is consumed). Perfect Pro additionally requires
        // that duplicate to already be fully trained (base max level).
        function focusPromoteNormal() {
            const target = player.inventory.find(c => c.uid === tradeTarget);
            if (!target || !canPromote(target)) return;
            if (focusMode !== 'combine' || tradeSacrifices.length !== 1) return;
            const dup = player.inventory.find(c => c.uid === tradeSacrifices[0]);
            if (!dup) return;

            consumeSacrifices();
            const proMax = getProMaxLevel(target);
            target.upgradeType = 'normal';
            target.maxLvl = proMax;
            processLevelUps(target);
            incrementMission('combine_card');
            showNotification(`⬆️ PRO!<br>${getCardBase(target).name} can now reach LVL ${proMax}.`, 2500);
            autoEquipDeck(); save();
            focusBackToMenu();
        }

        function focusPromotePerfect() {
            const target = player.inventory.find(c => c.uid === tradeTarget);
            if (!target || !canPromote(target)) return;
            if (focusMode !== 'combine' || tradeSacrifices.length !== 1) return;
            const dup = player.inventory.find(c => c.uid === tradeSacrifices[0]);
            if (!dup) return;
            const targetMaxed = getEffectiveLevel(target) >= getBaseMaxLevel(target);
            const dupMaxed = getEffectiveLevel(dup) >= getBaseMaxLevel(dup);
            if (!targetMaxed || !dupMaxed) return; // Perfect Pro needs BOTH cards fully trained

            consumeSacrifices();
            const proMax = getProMaxLevel(target);
            target.upgradeType = 'perfect';
            target.phase = 2;
            target.level = 0;
            target.xp = 0;
            target.maxLvl = getBaseMaxLevel(target);
            incrementMission('combine_card');
            showNotification(`★ PERFECT PRO!<br>${getCardBase(target).name} reset to ★0 — can now reach LVL ${proMax}!`, 2500);
            autoEquipDeck(); save();
            focusBackToMenu();
        }
