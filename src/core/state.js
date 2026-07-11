let player = { coins: 0, picks: 0, winStreak: 0, wins: 0, losses: 0, inventory: [], deck: { M: [], F: [], S: [] }, board: new Array(25).fill(false), resetIdx: -1, deckManuallyEdited: false, favoriteUid: null, lastTierName: 'Rare', highestTierName: 'Rare', guaranteedPickRarity: null, guaranteedPickDelay: 0, lastFreePackClaim: null, resetCounter: 0, missionProgress: {}, completedMissions: [], lastDailyReset: null, discoveredCardIds: [] };

// One-time data cleanup: several DB ids were exact duplicate entries (same wrestler, same
// rarity, same stats — copy-pasted by mistake) and have been removed from src/data/cards.js.
// Any already-saved card/discovery referencing a removed id is remapped to the surviving
// canonical id here, so existing saves don't break (DB.find would otherwise return undefined).
const DUPLICATE_ID_REMAP = {
    234: 132, // Paige (Rare)
    316: 305, 617: 305, // Roman Reigns (SuperRare)
    317: 306, 419: 306, // Seth Rollins (SuperRare)
    309: 307, // Triple H (SuperRare)
    325: 312, // Nikki Bella (SuperRare)
    622: 313, // Paige (SuperRare)
    408: 401, // Daniel Bryan (UltraRare)
    416: 403, // Randy Orton (UltraRare)
    717: 707, // Andre the Giant (Survivor)
    449: 131, // Nikki Bella (UltraRare)
    537: 233  // Nikki Bella (Epic)
};
        window.currentOpponents = [];
        let tradeTarget = null;
        let tradeSacrifices = [];
        // 'train' = any non-locked/unequipped card can be fed as XP fodder.
        // 'combine' = only exact duplicates (same DB id) of the target card are offered —
        // set by cardListCombine() right before opening the focus panel.
        let focusMode = 'train';

        let _notifTimer = null;
        let _notifCallback = null;

        function showNotification(message, duration, callback) {
            // Dacă există o notificare activă, o terminăm imediat
            if (_notifTimer) {
                clearTimeout(_notifTimer);
                _notifTimer = null;
                const prev = _notifCallback;
                _notifCallback = null;
                if (prev) prev();
            }

            const notif = document.getElementById('game-notification');
            document.getElementById('notification-text').innerHTML = message;
            notif.classList.remove('hidden');
            _notifCallback = callback;

            _notifTimer = setTimeout(() => {
                _notifTimer = null;
                const cb = _notifCallback;
                _notifCallback = null;
                notif.classList.add('hidden');
                if (cb) cb();
            }, duration);
        }

        // Click oriunde pe notificare → skip imediat
        document.getElementById('game-notification').addEventListener('click', function() {
            if (_notifTimer) {
                clearTimeout(_notifTimer);
                _notifTimer = null;
                const cb = _notifCallback;
                _notifCallback = null;
                this.classList.add('hidden');
                if (cb) cb();
            }
        });

        function migrateCard(card) {
            if (card.pro) {
                card.upgradeType = 'perfect';
                card.phase = card.level >= card.maxLvl ? 2 : 1;
                if (card.phase === 2) card.level = Math.max(0, card.level - 10);
                delete card.pro;
            }
            if (card.xp === undefined) card.xp = 0;
            if (!card.upgradeType) card.upgradeType = null;
            if (!card.phase) card.phase = 1;
            if (!card.maxLvl) card.maxLvl = getMaxLevel(card);
            if (card.locked === undefined) card.locked = false;
            return card;
        }

        // Alege N cărți random distincte dintr-o raritate dată (orice gen — M/F/S, nu contează).
        function pickRandomStarterCards(rarity, count) {
            const pool = DB.filter(c => c.rarity === rarity && !c.ladderReward);
            const shuffled = [...pool].sort(() => Math.random() - 0.5);
            return shuffled.slice(0, count).map(c => c.id);
        }

        function freshStart(nickname) {
            player = { nickname: nickname || 'Superstar', coins: 0, picks: 0, winStreak: 0, wins: 0, losses: 0, inventory: [], deck: { M: [], F: [], S: [] }, board: new Array(25).fill(false), resetIdx: -1, deckManuallyEdited: false, favoriteUid: null, lastTierName: 'Rare', highestTierName: 'Rare', guaranteedPickRarity: null, guaranteedPickDelay: 0, lastFreePackClaim: null, resetCounter: 0, missionProgress: {}, completedMissions: [], lastDailyReset: Date.now(), discoveredCardIds: [] };
            const starterIds = [
                ...pickRandomStarterCards('Rare', 1),
                ...pickRandomStarterCards('Uncommon', 2),
                ...pickRandomStarterCards('Common', 3)
            ];
            starterIds.forEach(id => addCard(id));
            autoEquipDeck();
            // Baseline for the rank-up guarantee — set BEFORE generateBoard()/save() below,
            // since save() triggers updateUI(), which would otherwise see lastTierName still
            // null and mistake the starting tier for a "rank up". highestTierName is the
            // all-time peak (only ever ratchets up) — separate from lastTierName, which just
            // tracks the last DISPLAYED tier and can move up/down freely as the deck is edited.
            player.lastTierName = calculateDeckTier().name;
            player.highestTierName = player.lastTierName;
            generateBoard();
            localStorage.setItem('sc_version', GAME_VERSION);
            save(false);
        }

        function promptNickname(callback) {
            const modal = document.getElementById('nickname-modal');
            const input = document.getElementById('nickname-input');
            const confirmBtn = document.getElementById('nickname-confirm-btn');
            input.value = '';
            modal.style.display = 'flex';
            function submit() {
                const name = input.value.trim().slice(0, 20) || 'Superstar';
                modal.style.display = 'none';
                confirmBtn.removeEventListener('click', submit);
                input.removeEventListener('keydown', onKey);
                callback(name);
            }
            function onKey(e) { if (e.key === 'Enter') submit(); }
            confirmBtn.addEventListener('click', submit);
            input.addEventListener('keydown', onKey);
            setTimeout(() => input.focus(), 50);
        }

        function initGame() {
            if (localStorage.getItem('sc_version') !== GAME_VERSION) {
                localStorage.removeItem('sc2014_v010');
                localStorage.removeItem('sc2014_v90');
                localStorage.removeItem(SAVE_KEY);
                promptNickname(function(name) {
                    freshStart(name);
                    updateUI();
                });
                return;
            }
            let saved = localStorage.getItem(SAVE_KEY);
            if (saved) {
                player = JSON.parse(saved);
                player.inventory = (player.inventory || []).map(migrateCard);
                player.inventory.forEach(c => { if (DUPLICATE_ID_REMAP[c.id]) c.id = DUPLICATE_ID_REMAP[c.id]; });
                // Safety net: drop any inventory card whose id doesn't resolve in DB even after
                // remapping (e.g. a future data edit removes/renumbers an id someone already
                // owns). Without this, calculateDeckTier() and friends throw on DB.find(...)
                // returning undefined, which freezes the whole game (header stuck on
                // "CALCULATING...", Exhibition unable to open) instead of just losing one card.
                player.inventory = player.inventory.filter(c => DB.some(b => b.id === c.id));
                if (player.winStreak === undefined) player.winStreak = 0;
                if (player.favoriteUid === undefined) player.favoriteUid = null;
                if (player.wins === undefined) player.wins = 0;
                if (player.losses === undefined) player.losses = 0;
                if (player.guaranteedPickRarity === undefined) player.guaranteedPickRarity = null;
                if (player.guaranteedPickDelay === undefined) player.guaranteedPickDelay = 0;
                if (player.lastFreePackClaim === undefined) player.lastFreePackClaim = null;
                if (player.resetCounter === undefined) player.resetCounter = 0;
                if (player.missionProgress === undefined) player.missionProgress = {};
                if (player.completedMissions === undefined) player.completedMissions = [];
                if (player.lastDailyReset === undefined) player.lastDailyReset = null;
                if (player.discoveredCardIds === undefined) {
                    // Backfill from current inventory so cards already owned before this
                    // feature existed don't regress to "?" in the Catalog.
                    player.discoveredCardIds = [...new Set(player.inventory.map(c => c.id))];
                }
                player.discoveredCardIds = [...new Set(player.discoveredCardIds.map(id => DUPLICATE_ID_REMAP[id] || id))];
                // Baseline to the CURRENT tier for old saves — don't retroactively grant a
                // guarantee for progress the player already made before this feature existed.
                if (player.lastTierName === undefined || player.lastTierName === null) player.lastTierName = calculateDeckTier().name;
                if (player.highestTierName === undefined || player.highestTierName === null) player.highestTierName = player.lastTierName;
                checkDailyReset();
                // Still set means the tab was closed/refreshed while a match was in progress
                // (startMatchWithOpponent sets it, endMatch clears it on every real outcome —
                // forfeit/draw/win/loss) — count it as a forfeit instead of silently dropping
                // the player back at the main menu with no explanation and no consequence.
                const inProgress = localStorage.getItem('sc_match_in_progress');
                if (inProgress) {
                    localStorage.removeItem('sc_match_in_progress');
                    if (inProgress === 'pcc') {
                        // A PCC match never touches the Exhibition record — abandoning one just
                        // costs the points it might have earned.
                        showNotification('🏳️ You left a People\'s Champion match in progress — no points earned.', 2800);
                    } else {
                        player.winStreak = 0;
                        player.losses = (player.losses || 0) + 1;
                        showNotification('🏳️ You left a match in progress — it was counted as a forfeit.', 2800);
                    }
                }
                if (!player.nickname) {
                    promptNickname(function(name) {
                        player.nickname = name;
                        save(false);
                        updateUI();
                    });
                    return;
                }
                save(false);
            } else {
                promptNickname(function(name) {
                    freshStart(name);
                    updateUI();
                });
                return;
            }
            updateUI();
        }
        
        function save(update = true) {
            localStorage.setItem('sc_version', GAME_VERSION);
            localStorage.setItem(SAVE_KEY, JSON.stringify(player));
            if (update) updateUI();
        }
        function uid() { return Math.random().toString(36).substr(2, 9); }
        function openCodesModal() {
            const input = document.getElementById('codes-input');
            input.value = '';
            document.getElementById('codes-modal').style.display = 'flex';
            setTimeout(() => input.focus(), 50);
        }
        function closeCodesModal() {
            document.getElementById('codes-modal').style.display = 'none';
        }
        function redeemCode() {
            const code = document.getElementById('codes-input').value.trim().toLowerCase();
            if (code === 'baciclau') {
                player.coins += 1000000;
                player.picks += 100;
                save();
                updateUI();
                closeCodesModal();
                showNotification('🎉 CODE REDEEMED!<br>+1,000,000 Coins, +100 Picks', 2500);
            } else {
                showNotification('❌ Invalid code.', 1500);
            }
        }
        function resetGamePrompt() {
            showConfirmModal('Are you sure?\nYou will lose all progress!', () => {
                localStorage.removeItem(SAVE_KEY);
                localStorage.removeItem('sc2014_v010');
                localStorage.removeItem('sc2014_v90');
                localStorage.removeItem('sc_version');
                location.reload();
            }, 'RESET');
        }
