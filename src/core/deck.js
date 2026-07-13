// Best-to-worst full ranking for one gender/slot — shared by both the "manually edited"
// upgrade check and the full auto-build below, so the two paths can never disagree about
// what "better" means. S ranking is multi-criteria (rarity, then Manager preference, then
// stats) so it can't collapse to a simple stat-total number the way M/F can — callers use
// each card's POSITION in this list as its rank instead (see _autoUpgradeIfBetter).
function _rankedGenderList(gender) {
    if (gender === 'S') {
        return player.inventory.filter(c => DB.find(b=>b.id===c.id).gender === 'S').sort((a,b) => {
            let baseA = DB.find(x=>x.id===a.id), baseB = DB.find(x=>x.id===b.id);
            let rankA = RARITIES.indexOf(baseA.rarity), rankB = RARITIES.indexOf(baseB.rarity);
            if (rankB !== rankA) return rankB - rankA;
            let mgrA = baseA.manager ? 1 : 0, mgrB = baseB.manager ? 1 : 0;
            if (mgrB !== mgrA) return mgrB - mgrA;
            let stA=getStats(a), stB=getStats(b);
            return (stB.pow+stB.tgh+stB.spd+stB.cha) - (stA.pow+stA.tgh+stA.spd+stA.cha);
        });
    }
    return player.inventory.filter(c => DB.find(b=>b.id===c.id).gender === gender).sort((a,b) => {
        let stA=getStats(a), stB=getStats(b); return (stB.pow+stB.tgh+stB.spd+stB.cha) - (stA.pow+stA.tgh+stA.spd+stA.cha);
    });
}

// Fills empty seats and swaps out the WORST currently-equipped, UN-PINNED card whenever a
// not-yet-equipped card outranks it (by position in `sortedFull`, best-first) — one-for-one,
// never more swaps than there are genuine upgrades. A PINNED card (see player.deckPinned,
// toggled via the 📌 button in the deck editor) is never evicted, no matter how it ranks —
// that's the whole point of pinning: "this exact card stays, auto can do whatever it wants
// with the rest." Leaves a slot alone entirely when nothing beats what's already there (or
// everything left is pinned), so a curated deck only ever gets STRONGER on its open slots,
// never rearranged where the player explicitly said not to.
function _autoUpgradeIfBetter(currentUids, pinnedUids, sortedFull, limit) {
    const rankOf = new Map(sortedFull.map((c, i) => [c.uid, i]));
    let uids = currentUids.slice();
    let changed = false;
    for (const candidate of sortedFull) {
        if (uids.includes(candidate.uid)) continue;
        if (uids.length < limit) { uids.push(candidate.uid); changed = true; continue; }
        let worstUid = null, worstRank = -1;
        uids.forEach(uid => {
            if (pinnedUids.includes(uid)) return; // pinned — never a swap-out candidate
            const r = rankOf.has(uid) ? rankOf.get(uid) : -1;
            if (r > worstRank) { worstRank = r; worstUid = uid; }
        });
        if (worstUid === null) continue; // every equipped slot here is pinned
        const candRank = rankOf.get(candidate.uid);
        if (candRank < worstRank) { uids = uids.map(uid => uid === worstUid ? candidate.uid : uid); changed = true; }
    }
    return { uids, changed };
}

function autoEquipDeck(force = false) {
            let sortedM = _rankedGenderList('M');
            let sortedF = _rankedGenderList('F');
            let sortedS = _rankedGenderList('S');
            if (!player.deckPinned) player.deckPinned = [];
            // Stale pins (the card was sacrificed/deleted) can't protect anything — drop them
            // so they don't silently linger in save data forever.
            player.deckPinned = player.deckPinned.filter(uid => player.inventory.some(c => c.uid === uid));

            // Dacă userul și-a editat manual deck-ul, nu îl suprascrie complet — dar tot
            // trebuie să poată "auto" un card mai bun pe care l-a primit între timp, pe orice
            // slot NEpinned, altfel "auto" pare stricat pentru totdeauna după prima editare
            // manuală (vezi _autoUpgradeIfBetter mai sus).
            if (!force && player.deckManuallyEdited) {
                // Verifică totuși că cărțile din deck mai există în inventar (pot fi sacrificate)
                player.deck.M = player.deck.M.filter(uid => player.inventory.some(c => c.uid === uid));
                player.deck.F = player.deck.F.filter(uid => player.inventory.some(c => c.uid === uid));
                player.deck.S = player.deck.S.filter(uid => player.inventory.some(c => c.uid === uid));
                // Dacă deck-ul manual a rămas fără suficiente cărți, completează automat
                if (player.deck.M.length < 4 || player.deck.F.length < 2) {
                    _fillMissingDeckSlots();
                }
                const upM = _autoUpgradeIfBetter(player.deck.M, player.deckPinned, sortedM, 4);
                const upF = _autoUpgradeIfBetter(player.deck.F, player.deckPinned, sortedF, 2);
                const upS = _autoUpgradeIfBetter(player.deck.S, player.deckPinned, sortedS, 1);
                player.deck.M = upM.uids; player.deck.F = upF.uids; player.deck.S = upS.uids;
                return;
            }

            while(sortedM.length < 4) { addCard(1); sortedM = _rankedGenderList('M'); }
            while(sortedF.length < 2) { addCard(11); sortedF = _rankedGenderList('F'); }

            player.deck.M = sortedM.slice(0, 4).map(c => c.uid);
            player.deck.F = sortedF.slice(0, 2).map(c => c.uid);
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
            if (player.deck.F.length < 2) {
                let extra = player.inventory.filter(c => DB.find(b=>b.id===c.id).gender === 'F' && !inDeck.has(c.uid))
                    .sort((a,b) => { let stA=getStats(a), stB=getStats(b); return (stB.pow+stB.tgh+stB.spd+stB.cha) - (stA.pow+stA.tgh+stA.spd+stA.cha); });
                while (player.deck.F.length < 2 && extra.length > 0) {
                    let c = extra.shift(); player.deck.F.push(c.uid); inDeck.add(c.uid);
                }
                while (player.deck.F.length < 2) { addCard(11); let c = player.inventory[player.inventory.length-1]; player.deck.F.push(c.uid); inDeck.add(c.uid); }
            }
        }

        // --- EDITARE MANUALĂ DECK ---
        let deckEditMode = false;
        let deckEditDraft = { M: [], F: [], S: [] }; // draft temporar cât ești în edit
        // Draft-ul de pin-uri (📌) — cărțile alese aici NU vor fi niciodată înlocuite automat
        // de autoEquipDeck() (vezi _autoUpgradeIfBetter în deck.js), chiar dacă mai târziu
        // primești ceva "mai bun" statistic. Orice slot NEpinned rămâne liber pentru auto —
        // exact "jumi-juma" cerut: tu ții ce vrei, restul se optimizează singur.
        let deckEditPinned = [];

        // Live preview: while editing, the header tier bar reflects the in-progress draft
        // (deckEditDraft) instead of the saved player.deck, so swapping cards updates the tier
        // instantly without needing to hit Save first. Purely a DOM repaint — it never touches
        // player.guaranteedPickRarity/highestTierName/save(), so nothing is granted until the
        // player actually commits the change via saveDeckEdit().
        function refreshLiveTierPreview() {
            if (typeof renderTierDisplay === 'function') renderTierDisplay(calculateDeckTier(deckEditDraft));
        }

        function toggleDeckEdit() {
            // While editing, this button is just a status label ("EDITING...") — CANCEL and
            // SAVE DECK are the only ways out, so it doesn't also duplicate cancelDeckEdit().
            if (deckEditMode) return;
            deckEditMode = true;
            // Porneste cu deck-ul curent ca baza
            deckEditDraft = { M: [...player.deck.M], F: [...player.deck.F], S: [...player.deck.S] };
            deckEditPinned = [...(player.deckPinned || [])].filter(uid =>
                [...deckEditDraft.M, ...deckEditDraft.F, ...deckEditDraft.S].includes(uid));
            // visibility (not display) — these stay in the layout flow either way, so the
            // screen's total height doesn't change when entering/exiting edit mode, which
            // would otherwise make the auto-scale safety net visibly re-shrink everything.
            document.getElementById('btn-auto-deck').style.visibility = 'visible';
            document.getElementById('btn-auto-deck').style.pointerEvents = 'auto';
            document.getElementById('btn-save-deck').style.visibility = 'visible';
            document.getElementById('btn-save-deck').style.pointerEvents = 'auto';
            document.getElementById('btn-cancel-deck').style.visibility = 'visible';
            document.getElementById('btn-cancel-deck').style.pointerEvents = 'auto';
            document.getElementById('deck-edit-info').style.visibility = 'visible';
            const editBtn = document.getElementById('btn-edit-deck');
            editBtn.innerHTML = '✏️ EDITING...';
            editBtn.style.pointerEvents = 'none';
            editBtn.style.opacity = '0.6';
            // Can't start a match mid-edit — only CANCEL or SAVE DECK get you out of here.
            const startBtn = document.getElementById('btn-start-confirm-deck');
            startBtn.style.pointerEvents = 'none';
            startBtn.style.opacity = '0.5';
            renderDeck();
            refreshLiveTierPreview();
        }

        function cancelDeckEdit() {
            deckEditMode = false;
            deckEditDraft = { M: [], F: [], S: [] };
            deckEditPinned = [];
            document.getElementById('btn-auto-deck').style.visibility = 'hidden';
            document.getElementById('btn-auto-deck').style.pointerEvents = 'none';
            document.getElementById('btn-save-deck').style.visibility = 'hidden';
            document.getElementById('btn-save-deck').style.pointerEvents = 'none';
            document.getElementById('btn-cancel-deck').style.visibility = 'hidden';
            document.getElementById('btn-cancel-deck').style.pointerEvents = 'none';
            document.getElementById('deck-edit-info').style.visibility = 'hidden';
            const editBtn = document.getElementById('btn-edit-deck');
            editBtn.innerHTML = '✏️ EDIT DECK';
            editBtn.style.pointerEvents = 'auto';
            editBtn.style.opacity = '1';
            const startBtn = document.getElementById('btn-start-confirm-deck');
            startBtn.style.pointerEvents = 'auto';
            startBtn.style.opacity = '1';
            renderDeck();
            // Restore the header to the real saved tier (the preview never touched player.deck).
            if (typeof renderTierDisplay === 'function') renderTierDisplay(calculateDeckTier());
        }

        function saveDeckEdit() {
            if (deckEditDraft.M.length !== 4) return showNotification('❌ You need exactly 4 Male cards in the deck!', 1500);
            if (deckEditDraft.F.length !== 2) return showNotification('❌ You need exactly 2 Female cards in the deck!', 1500);
            // Support e opțional
            player.deck.M = [...deckEditDraft.M];
            player.deck.F = [...deckEditDraft.F];
            player.deck.S = [...deckEditDraft.S];
            // Doar pin-urile pentru cărți încă prezente în deck-ul salvat contează.
            const allUids = [...player.deck.M, ...player.deck.F, ...player.deck.S];
            player.deckPinned = deckEditPinned.filter(uid => allUids.includes(uid));
            player.deckManuallyEdited = true; // Marchează că deck-ul e manual — autoEquip nu îl va suprascrie
            save();
            showNotification('✅ Deck saved!', 1200);
            cancelDeckEdit();
        }

        function applyAutoDeck() {
            player.deckManuallyEdited = false; // Permite autoEquip să suprascrie
            deckEditPinned = []; // "cel mai bun deck posibil" ignoră orice pin anterior
            autoEquipDeck(true);
            deckEditDraft = { M: [...player.deck.M], F: [...player.deck.F], S: [...player.deck.S] };
            renderDeck();
            refreshLiveTierPreview();
            showNotification('🤖 Auto-best applied to draft!', 1000);
        }

        function toggleDeckCard(uid) {
            if (!deckEditMode) return;
            const card = player.inventory.find(c => c.uid === uid);
            if (!card) return;
            const g = getCardBase(card).gender;

            const slot = g === 'M' ? 'M' : g === 'F' ? 'F' : 'S';
            const limit = slot === 'M' ? 4 : slot === 'F' ? 2 : 1;
            const inDeck = deckEditDraft[slot].includes(uid);

            if (inDeck) {
                deckEditDraft[slot] = deckEditDraft[slot].filter(x => x !== uid);
                deckEditPinned = deckEditPinned.filter(x => x !== uid);
            } else {
                if (deckEditDraft[slot].length >= limit) {
                    // Înlocuiește primul din slot cu noul
                    const evicted = deckEditDraft[slot].shift();
                    deckEditPinned = deckEditPinned.filter(x => x !== evicted);
                }
                deckEditDraft[slot].push(uid);
                // Orice carte adusă AICI e o alegere deliberată a jucătorului — se pinuiește
                // automat, fără sa mai trebuiască să apese și butonul 📍 separat. "Auto" tot
                // rămâne liber pe sloturile pe care jucătorul nu le-a atins deloc (completate
                // de _fillMissingDeckSlots sau rămase din auto-equip-ul inițial). Butonul de
                // pin manual e doar pentru a ELIBERA explicit un slot ales manual, dacă vrea.
                if (!deckEditPinned.includes(uid)) deckEditPinned.push(uid);
            }
            updateDeckSlotsInfo();
            renderDeck();
            refreshLiveTierPreview();
        }

        // 📌 pin toggle — stops event bubbling so tapping the pin button never ALSO triggers
        // the tile's own onclick (which would remove the card from the deck entirely).
        function toggleDeckPin(uid, event) {
            if (event) event.stopPropagation();
            if (!deckEditMode) return;
            const i = deckEditPinned.indexOf(uid);
            if (i === -1) deckEditPinned.push(uid); else deckEditPinned.splice(i, 1);
            renderDeck();
        }

        function updateDeckSlotsInfo() {
            const m = deckEditDraft.M.length, f = deckEditDraft.F.length, s = deckEditDraft.S.length;
            const el = document.getElementById('deck-slots-info');
            if (el) el.innerHTML = `M: <span style="color:${m===4?'#2ecc71':'#e74c3c'}">${m}/4</span>  F: <span style="color:${f===2?'#2ecc71':'#e74c3c'}">${f}/2</span>  SUPP: <span style="color:${s<=1?'#2ecc71':'#f1c40f'}">${s}/1</span>`;
        }

        function calculateDeckTier(deckOverride) {
            // Tier is driven by the cards actually EQUIPPED in the active deck (player.deck),
            // not by the best cards sitting in the full collection — so swapping cards in/out
            // of the deck moves the tier up or down immediately, instead of the tier only ever
            // being able to climb as the collection grows regardless of what's equipped.
            // deckOverride lets the deck editor preview the tier of the in-progress draft
            // (deckEditDraft) before it's actually saved to player.deck.
            let deck = deckOverride || player.deck;
            let equippedUids = new Set([...deck.M, ...deck.F, ...deck.S]);
            let equipped = player.inventory.filter(c => equippedUids.has(c.uid));

            let totalStats = 0;
            equipped.forEach(c => { let st = getStats(c); totalStats += (st.pow + st.tgh + st.spd + st.cha); });

            let cTier = TIERS[0]; let nTier = TIERS[1];
            for(let i=0; i<TIERS.length; i++) {
                if(totalStats >= TIERS[i].min) { cTier = TIERS[i]; nTier = TIERS[i+1] || null; }
            }
            let pct = 100;
            if(nTier) pct = ((totalStats - cTier.min) / (nTier.min - cTier.min)) * 100;
            return { name: cTier.name, base: cTier.base, pct: Math.min(100, Math.max(0, pct)), color: cTier.color, current: Math.floor(totalStats), next: nTier ? nTier.min : 'MAX' };
        }
