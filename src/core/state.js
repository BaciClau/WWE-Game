let player = { coins: 0, picks: 0, winStreak: 0, inventory: [], deck: { M: [], F: [], S: [] }, board: new Array(25).fill(false), resetIdx: -1, deckManuallyEdited: false };
        window.currentOpponents = [];
        let tradeTarget = null;
        let tradeSacrifices = [];

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
            return card;
        }

        function freshStart() {
            player = { coins: 0, picks: 0, inventory: [], deck: { M: [], F: [], S: [] }, board: new Array(25).fill(false), resetIdx: -1, deckManuallyEdited: false };
            [201, 101, 111, 1, 2, 20].forEach(id => addCard(id));
            autoEquipDeck();
            generateBoard();
            localStorage.setItem('sc_version', GAME_VERSION);
            save(false);
        }

        function initGame() {
            if (localStorage.getItem('sc_version') !== GAME_VERSION) {
                localStorage.removeItem('sc2014_v010');
                localStorage.removeItem('sc2014_v90');
                localStorage.removeItem(SAVE_KEY);
                freshStart();
                updateUI();
                return;
            }
            let saved = localStorage.getItem(SAVE_KEY);
            if (saved) {
                player = JSON.parse(saved);
                player.inventory = (player.inventory || []).map(migrateCard);
                if (player.winStreak === undefined) player.winStreak = 0;
                save(false);
            } else {
                freshStart();
            }
            updateUI();
        }
        
        function save(update = true) {
            localStorage.setItem('sc_version', GAME_VERSION);
            localStorage.setItem(SAVE_KEY, JSON.stringify(player));
            if (update) updateUI();
        }
        function uid() { return Math.random().toString(36).substr(2, 9); }
        function resetGamePrompt() {
            if (confirm("Are you sure? You will lose all progress!")) {
                localStorage.removeItem(SAVE_KEY);
                localStorage.removeItem('sc2014_v010');
                localStorage.removeItem('sc2014_v90');
                localStorage.removeItem('sc_version');
                location.reload();
            }
        }
