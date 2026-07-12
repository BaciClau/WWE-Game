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
        // Non-mutating projection of what feeding `addXp` into `card` would produce —
        // powers the real-time "→ LVL X" readout and the AUTO selector's stop condition.
        // A shallow copy is enough: processLevelUps only touches level/xp/maxLvl, and the
        // level helpers only read id/upgradeType/phase, all present on the copy.
        function simulateFeed(card, addXp) {
            const sim = { ...card };
            sim.xp = (sim.xp || 0) + addXp;
            processLevelUps(sim);
            const level = getEffectiveLevel(sim);
            return { level, xp: sim.xp, xpNeeded: getXpNeeded(sim), maxed: level >= getEffectiveMax(sim) };
        }

        // AUTO fodder select: fills the sacrifice list with the CHEAPEST cards first —
        // Common upward, and lowest XP value first within a rarity — adding only as many
        // as the simulation says are needed to reach the chosen goal, not one more.
        // mode 'one' is INCREMENTAL: it keeps whatever is already selected and each press
        // stacks one more level on top of the current projection, until fodder runs out.
        // mode 'max' rebuilds the selection from scratch for the full training cap.
        // Locked, equipped and favorite cards are never touched.
        function focusAutoSelectFodder(mode = 'max') {
            const target = player.inventory.find(c => c.uid === tradeTarget);
            if (!target || focusMode === 'combine') return;
            if (getEffectiveLevel(target) >= getEffectiveMax(target)) return;

            const xpOf = (uid) => {
                const info = getSacrificeXpEnhanced(uid, target);
                return info.xp + info.levelBonus;
            };

            let totalXp, goalLevel;
            if (mode === 'one') {
                totalXp = tradeSacrifices.reduce((s, u) => s + xpOf(u), 0);
                const projected = simulateFeed(target, totalXp).level;
                if (projected >= getEffectiveMax(target)) {
                    showNotification('✅ Selection already reaches MAX level — nothing more to add.', 1800);
                    return;
                }
                goalLevel = projected + 1;
            } else {
                tradeSacrifices = [];
                totalXp = 0;
                goalLevel = getEffectiveMax(target);
            }

            const ranked = player.inventory
                .filter(c => c.uid !== tradeTarget && !c.locked && !isCardEquipped(c.uid)
                    && c.uid !== player.favoriteUid && !tradeSacrifices.includes(c.uid))
                .map(c => ({ uid: c.uid, rank: RARITIES.indexOf(getCardRarity(c)), value: xpOf(c.uid) }))
                .sort((a, b) => a.rank - b.rank || a.value - b.value);

            let added = 0;
            for (const f of ranked) {
                if (simulateFeed(target, totalXp).level >= goalLevel) break;
                tradeSacrifices.push(f.uid);
                totalXp += f.value;
                added++;
            }
            if (tradeSacrifices.length === 0) {
                showNotification('❌ No fodder cards available — locked, equipped and favorite cards are skipped.', 2200);
            } else if (mode === 'one' && added === 0) {
                showNotification('❌ Out of fodder — every available card is already selected.', 2000);
            } else if (mode === 'one' && simulateFeed(target, totalXp).level < goalLevel) {
                showNotification('⚠️ Not enough fodder left for a full extra level — added everything available.', 2200);
            }
            renderFocusFodderGrid();
            updateFocusTrainStatus();
        }

        function updateFocusTrainStatus() {
            const status = document.getElementById('focus-train-status');
            const btnFeed = document.getElementById('focus-btn-feed');
            const btnAutoOne = document.getElementById('focus-btn-auto-one');
            const btnAutoMax = document.getElementById('focus-btn-auto-max');
            const btnPro = document.getElementById('focus-btn-pro');
            const btnPerfectPro = document.getElementById('focus-btn-perfect-pro');

            btnFeed.style.display = 'none';
            if (btnAutoOne) btnAutoOne.style.display = 'none';
            if (btnAutoMax) btnAutoMax.style.display = 'none';
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

            // Real-time projection: the player should never have to do XP math themselves —
            // every fodder tap re-runs the ACTUAL level-up simulation and shows exactly
            // where the card lands (final level + progress into the next one).
            const sim = simulateFeed(target, pending);
            let xpDesc = `+${pendingXP} XP`;
            if (bonusXP > 0) xpDesc += ` <span style="color:#f1c40f">+${bonusXP} bonus</span>`;
            if (hasNormalUpgradeFodder) xpDesc += ` <span style="color:#e040fb">(2× Pro fodder!)</span>`;

            const resultLine = sim.maxed
                ? `<strong style="color:#2ecc71">LVL ${sim.level} — FULLY TRAINED! 🏆</strong>`
                : `<strong style="color:#2ecc71">LVL ${sim.level}</strong> <span style="color:#aaa">(${sim.xp}/${sim.xpNeeded} XP toward LVL ${sim.level + 1})</span>`;

            status.innerHTML = pending > 0
                ? `<strong>${base.name}</strong> LVL ${effLv}/${effMax} ➜ ${resultLine}<br>` +
                  `${tradeSacrifices.length} fodder card${tradeSacrifices.length === 1 ? '' : 's'}: ${xpDesc} = <strong style="color:#2ecc71">${pending} XP</strong>`
                : `<strong>${base.name}</strong> LVL ${effLv}/${effMax} — XP: <strong>${target.xp}/${xpNeed}</strong><br>` +
                  `Tap fodder below (or <strong>⚡ AUTO +1 LVL / AUTO MAX</strong>) — the resulting level shows here in real time.`;

            if (pending > 0) btnFeed.style.display = 'inline-flex';
            if (btnAutoOne) btnAutoOne.style.display = 'inline-flex';
            if (btnAutoMax) btnAutoMax.style.display = 'inline-flex';
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

        // Multiplier a card has ACTUALLY earned so far — getStatMultiplier() plus the
        // partial XP already fed toward its next level, converted to its fractional share
        // of a level's stat growth. Used by the combines below so mid-level training is
        // never thrown away when the level resets.
        function earnedMultiplier(c) {
            let m = getStatMultiplier(c);
            const need = getXpNeeded(c);
            if (need > 0 && c.xp > 0) {
                m += (Math.min(c.xp, need) / need) * (UPGRADE.MAX_STAT_RATIO - 1) / (getBaseMaxLevel(c) - 1);
            }
            return m;
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

            // Bank the BETTER of the two cards' earned multipliers (partial XP included)
            // BEFORE resetting the level — the level number drops back to 1, but the stats
            // must NEVER end up below what either card already had: averaging here meant a
            // LVL 6 fused with a LVL 1 came out WEAKER than the LVL 6 went in, with all its
            // training silently lost. "The higher the level of the two cards when you
            // combine them, the better the effect will be" still holds (a stronger pair
            // banks a higher multiplier); COMBINE_BASE_BONUS is the small guaranteed boost
            // on top — even two level-1 duplicates come out ahead, matching the real game.
            const banked = Math.max(earnedMultiplier(target), earnedMultiplier(dup)) + UPGRADE.COMBINE_BASE_BONUS;
            consumeSacrifices();
            const proMax = getProMaxLevel(target);
            target.upgradeType = 'normal';
            target.maxLvl = proMax;
            target.level = 1;
            target.xp = 0;
            target.comboMultiplier = banked;
            incrementMission('combine_card');
            showNotification(`⬆️ PRO!<br>${getCardBase(target).name} reset to LVL 1 (stats boosted from training) — can now reach LVL ${proMax}.`, 2500);
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

            // Same banking as focusPromoteNormal — both cards are required to already be
            // maxed here, so this lands right at MAX_STAT_RATIO + COMBINE_BASE_BONUS
            // (which is exactly what the opponent simulation in opponents.js assumes).
            const banked = Math.max(earnedMultiplier(target), earnedMultiplier(dup)) + UPGRADE.COMBINE_BASE_BONUS;
            consumeSacrifices();
            const proMax = getProMaxLevel(target);
            target.upgradeType = 'perfect';
            target.phase = 2;
            target.level = 0;
            target.xp = 0;
            target.maxLvl = getBaseMaxLevel(target);
            target.comboMultiplier = banked;
            incrementMission('combine_card');
            showNotification(`★ PERFECT PRO!<br>${getCardBase(target).name} reset to ★0 (stats boosted from training) — can now reach LVL ${proMax}!`, 2500);
            autoEquipDeck(); save();
            focusBackToMenu();
        }
