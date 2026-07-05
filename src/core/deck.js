function autoEquipDeck(force = false) {
            // Dacă userul și-a editat manual deck-ul, nu îl suprascrie automat
            if (!force && player.deckManuallyEdited) {
                // Verifică totuși că cărțile din deck mai există în inventar (pot fi sacrificate)
                player.deck.M = player.deck.M.filter(uid => player.inventory.some(c => c.uid === uid));
                player.deck.F = player.deck.F.filter(uid => player.inventory.some(c => c.uid === uid));
                player.deck.S = player.deck.S.filter(uid => player.inventory.some(c => c.uid === uid));
                // Dacă deck-ul manual a rămas fără suficiente cărți, completează automat
                if (player.deck.M.length < 4 || player.deck.F.length < 1) {
                    _fillMissingDeckSlots();
                }
                return;
            }
            let sortedM = player.inventory.filter(c => DB.find(b=>b.id===c.id).gender === 'M').sort((a,b) => {
                let stA=getStats(a), stB=getStats(b); return (stB.pow+stB.tgh+stB.spd+stB.cha) - (stA.pow+stA.tgh+stA.spd+stA.cha);
            });
            let sortedF = player.inventory.filter(c => DB.find(b=>b.id===c.id).gender === 'F').sort((a,b) => {
                let stA=getStats(a), stB=getStats(b); return (stB.pow+stB.tgh+stB.spd+stB.cha) - (stA.pow+stA.tgh+stA.spd+stA.cha);
            });
            let sortedS = player.inventory.filter(c => DB.find(b=>b.id===c.id).gender === 'S').sort((a,b) => {
                let stA=getStats(a), stB=getStats(b); return (stB.pow+stB.tgh+stB.spd+stB.cha) - (stA.pow+stA.tgh+stA.spd+stA.cha);
            });
            
            while(sortedM.length < 4) { addCard(1); sortedM = player.inventory.filter(c => DB.find(b=>b.id===c.id).gender === 'M'); }
            if(sortedF.length < 1) { addCard(11); sortedF = player.inventory.filter(c => DB.find(b=>b.id===c.id).gender === 'F'); }

            player.deck.M = sortedM.slice(0, 4).map(c => c.uid);
            player.deck.F = sortedF.length > 0 ? [sortedF[0].uid] : [];
            player.deck.S = sortedS.length > 0 ? [sortedS[0].uid] : [];
        }

        function _fillMissingDeckSlots() {
            // Completează doar sloturile lipsă, fără a suprascrie ce e deja ales manual
            let inDeck = new Set([...player.deck.M, ...player.deck.F, ...player.deck.S]);
            if (player.deck.M.length < 4) {
                let extra = player.inventory.filter(c => DB.find(b=>b.id===c.id).gender === 'M' && !inDeck.has(c.uid))
                    .sort((a,b) => { let stA=getStats(a), stB=getStats(b); return (stB.pow+stB.tgh+stB.spd+stB.cha) - (stA.pow+stA.tgh+stA.spd+stA.cha); });
                while (player.deck.M.length < 4 && extra.length > 0) {
                    let c = extra.shift(); player.deck.M.push(c.uid); inDeck.add(c.uid);
                }
                while (player.deck.M.length < 4) { addCard(1); let c = player.inventory[player.inventory.length-1]; player.deck.M.push(c.uid); inDeck.add(c.uid); }
            }
            if (player.deck.F.length < 1) {
                let extra = player.inventory.filter(c => DB.find(b=>b.id===c.id).gender === 'F' && !inDeck.has(c.uid))
                    .sort((a,b) => { let stA=getStats(a), stB=getStats(b); return (stB.pow+stB.tgh+stB.spd+stB.cha) - (stA.pow+stA.tgh+stA.spd+stA.cha); });
                if (extra.length > 0) { player.deck.F.push(extra[0].uid); }
                else { addCard(11); let c = player.inventory[player.inventory.length-1]; player.deck.F.push(c.uid); }
            }
        }

        // --- EDITARE MANUALĂ DECK ---
        let deckEditMode = false;
        let deckEditDraft = { M: [], F: [], S: [] }; // draft temporar cât ești în edit

        function toggleDeckEdit() {
            if (deckEditMode) {
                cancelDeckEdit();
            } else {
                deckEditMode = true;
                // Porneste cu deck-ul curent ca baza
                deckEditDraft = { M: [...player.deck.M], F: [...player.deck.F], S: [...player.deck.S] };
                document.getElementById('btn-auto-deck').style.display = 'inline-flex';
                document.getElementById('btn-save-deck').style.display = 'inline-flex';
                document.getElementById('btn-cancel-deck').style.display = 'inline-flex';
                document.getElementById('deck-edit-info').style.display = 'block';
                document.getElementById('deck-mode-label').innerText = 'MANUAL EDIT — 4 M, 1 F, 1 SUPP';
                document.getElementById('btn-edit-deck').innerHTML = '✏️ EDITING...';
                renderDeck();
            }
        }

        function cancelDeckEdit() {
            deckEditMode = false;
            deckEditDraft = { M: [], F: [], S: [] };
            document.getElementById('btn-auto-deck').style.display = 'none';
            document.getElementById('btn-save-deck').style.display = 'none';
            document.getElementById('btn-cancel-deck').style.display = 'none';
            document.getElementById('deck-edit-info').style.display = 'none';
            document.getElementById('deck-mode-label').innerText = 'Top cards: 4 M, 1 F, 1 SUPP';
            document.getElementById('btn-edit-deck').innerHTML = '✏️ EDITEAZĂ DECK';
            renderDeck();
        }

        function saveDeckEdit() {
            if (deckEditDraft.M.length !== 4) return showNotification('❌ You need exactly 4 Male cards in the deck!', 1500);
            if (deckEditDraft.F.length !== 1) return showNotification('❌ You need exactly 1 Female card in the deck!', 1500);
            // Support e opțional
            player.deck.M = [...deckEditDraft.M];
            player.deck.F = [...deckEditDraft.F];
            player.deck.S = [...deckEditDraft.S];
            player.deckManuallyEdited = true; // Marchează că deck-ul e manual — autoEquip nu îl va suprascrie
            save();
            showNotification('✅ Deck saved!', 1200);
            cancelDeckEdit();
        }

        function applyAutoDeck() {
            player.deckManuallyEdited = false; // Permite autoEquip să suprascrie
            autoEquipDeck(true);
            deckEditDraft = { M: [...player.deck.M], F: [...player.deck.F], S: [...player.deck.S] };
            renderDeck();
            showNotification('🤖 Auto-best applied to draft!', 1000);
        }

        function toggleDeckCard(uid) {
            if (!deckEditMode) return;
            const card = player.inventory.find(c => c.uid === uid);
            if (!card) return;
            const g = getCardBase(card).gender;

            const slot = g === 'M' ? 'M' : g === 'F' ? 'F' : 'S';
            const limit = slot === 'M' ? 4 : 1;
            const inDeck = deckEditDraft[slot].includes(uid);

            if (inDeck) {
                deckEditDraft[slot] = deckEditDraft[slot].filter(x => x !== uid);
            } else {
                if (deckEditDraft[slot].length >= limit) {
                    // Înlocuiește primul din slot cu noul
                    deckEditDraft[slot].shift();
                }
                deckEditDraft[slot].push(uid);
            }
            updateDeckSlotsInfo();
            renderDeck();
        }

        function updateDeckSlotsInfo() {
            const m = deckEditDraft.M.length, f = deckEditDraft.F.length, s = deckEditDraft.S.length;
            const el = document.getElementById('deck-slots-info');
            if (el) el.innerHTML = `M: <span style="color:${m===4?'#2ecc71':'#e74c3c'}">${m}/4</span>  F: <span style="color:${f===1?'#2ecc71':'#e74c3c'}">${f}/1</span>  SUPP: <span style="color:${s<=1?'#2ecc71':'#f1c40f'}">${s}/1</span>`;
        }

        function calculateDeckTier() {
            let m = player.inventory.filter(c => DB.find(b=>b.id===c.id).gender === 'M').sort((a,b) => { let stA=getStats(a), stB=getStats(b); return (stB.pow+stB.tgh+stB.spd+stB.cha) - (stA.pow+stA.tgh+stA.spd+stA.cha); }).slice(0,4);
            let f = player.inventory.filter(c => DB.find(b=>b.id===c.id).gender === 'F').sort((a,b) => { let stA=getStats(a), stB=getStats(b); return (stB.pow+stB.tgh+stB.spd+stB.cha) - (stA.pow+stA.tgh+stA.spd+stA.cha); }).slice(0,1);
            let s = player.inventory.filter(c => DB.find(b=>b.id===c.id).gender === 'S').sort((a,b) => { let stA=getStats(a), stB=getStats(b); return (stB.pow+stB.tgh+stB.spd+stB.cha) - (stA.pow+stA.tgh+stA.spd+stA.cha); }).slice(0,1);

            let totalStats = 0;
            [...m, ...f, ...s].forEach(c => { let st = getStats(c); totalStats += (st.pow + st.tgh + st.spd + st.cha); });

            let cTier = TIERS[0]; let nTier = TIERS[1];
            for(let i=0; i<TIERS.length; i++) {
                if(totalStats >= TIERS[i].min) { cTier = TIERS[i]; nTier = TIERS[i+1] || null; }
            }
            let pct = 100;
            if(nTier) pct = ((totalStats - cTier.min) / (nTier.min - cTier.min)) * 100;
            return { name: cTier.name, base: cTier.base, pct: Math.min(100, Math.max(0, pct)), color: cTier.color, current: Math.floor(totalStats), next: nTier ? nTier.min : 'MAX' };
        }
