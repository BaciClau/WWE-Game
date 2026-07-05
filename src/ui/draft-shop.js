function generateBoard() {
    player.board = new Array(25).fill(false);
    player.resetIdx = Math.floor(Math.random() * 25);
    save();
}

function renderDraftBoard() {
    updateUI();
    let g = document.getElementById('draft-board-grid');
    g.innerHTML = "";

    player.board.forEach((r, i) => {
        let d = document.createElement('div');
        d.className = `draft-card ${r ? 'revealed' : ''}`;
        if (!r) d.onclick = () => pullDraft(i);
        g.appendChild(d);
    });
}

        function pullDraft(i) {
            if(player.picks <= 0) return showNotification("No more picks! Play Exhibition to earn more.", 1500);
            player.picks--; player.board[i] = true;

            let isReset = (i === player.resetIdx);
            let pulledId = 1;

            // A tier rank-up guarantees the very next pick is a card from the new tier's
            // rarity, regardless of which tile is clicked — consumed after this one pull.
            let guaranteedRarity = player.guaranteedPickRarity;

            let tInfo = calculateDeckTier();
            let baseRarities = ['Common', 'Uncommon', 'Rare', 'SuperRare', 'UltraRare', 'Epic', 'Legendary', 'Survivor'];
            let pBase = tInfo.base;
            let bIdx = baseRarities.indexOf(pBase);

            if (guaranteedRarity) {
                player.guaranteedPickRarity = null;
                let pool = DB.filter(c => c.rarity === guaranteedRarity);
                if (pool.length === 0) pool = DB.filter(c => c.rarity === 'Rare');
                pulledId = pool[Math.floor(Math.random() * pool.length)].id;
            } else if(isReset) {
                let isPlus = tInfo.name.includes('+');
                let isPlusPlus = tInfo.name.includes('++');
                let dropRarity = pBase; 
                
                // Aplicăm procentajele pentru a pica tier-ul de bază cerute: 10% / 25% / 40%
                let chanceForBase = 10;
                if (isPlusPlus) chanceForBase = 40;
                else if (isPlus) chanceForBase = 25;

                let actualTargetIdx = Math.max(2, bIdx); // 2 = Rare, minimul pt board reset
                
                if (Math.random() * 100 > chanceForBase) {
                    // Trage in jos (drop inferior)
                    let maxLowerIdx = actualTargetIdx - 1;
                    let minLowerIdx = 2; // Minim Rare
                    
                    if (maxLowerIdx < minLowerIdx) {
                        dropRarity = 'Rare'; // Daca deja era Rare, ramane Rare ca minim pt reset
                    } else {
                        // Extrage un nivel inferior limitat la minim Rare
                        let lowerIdx = Math.floor(Math.random() * (maxLowerIdx - minLowerIdx + 1)) + minLowerIdx;
                        dropRarity = baseRarities[lowerIdx];
                    }
                } else {
                    // A prins procentul, primește maximul tier-ului
                    dropRarity = baseRarities[actualTargetIdx];
                }
                
                let pool = DB.filter(c => c.rarity === dropRarity);
                if (pool.length === 0) pool = DB.filter(c => c.rarity === 'Rare'); // Fallback
                pulledId = pool[Math.floor(Math.random() * pool.length)].id;
                
            } else {
                // Trageri Normale de umplutură pe bord (fără a da board reset)
                let rand = Math.random() * 100;
                let pRarity = 'Common';
                if (rand > 75) pRarity = 'Uncommon';
                
                let pool = DB.filter(c => c.rarity === pRarity);
                pulledId = pool[Math.floor(Math.random() * pool.length)].id;
            }
            
            addCard(pulledId); save(); renderDraftBoard();
            
            let s = getStats({uid:'preview', id: pulledId, level: 1, maxLvl: UPGRADE.BASE_MAX, xp: 0, upgradeType: null, phase: 1});
            document.getElementById('pull-card-container').innerHTML = renderHTMLCard(s);
            document.getElementById('pull-title').innerText = guaranteedRarity ? "RANK-UP GUARANTEE! " + s.rarity.toUpperCase() + " CARD!" : (isReset ? "BOARD RESET! " + s.rarity.toUpperCase() + " CARD!" : "YOU PULLED A CARD!");
            document.getElementById('pull-title').style.color = guaranteedRarity ? "#2ecc71" : (isReset ? "#f1c40f" : "#fff");
            document.getElementById('pull-modal').style.display = "flex";
            if(isReset) generateBoard();
        }

        function closePullModal() {
            document.getElementById('pull-modal').style.display = "none";
            renderDraftBoard();
            if(player.picks === 0) {
                setTimeout(() => { showNotification("Returning to Main Menu...", 1500, () => { showScreen('main-menu'); }); }, 500);
            }
        }

        function buyPack(cost, rarityArray) {
            if(player.coins < cost) return showNotification("❌ Insufficient funds! Play more Exhibition.", 2000);
            player.coins -= cost; 
            let pool = DB.filter(c => rarityArray.includes(c.rarity));
            let cardId = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)].id : 1;
            addCard(cardId); save(); 
            let s = getStats({uid:'preview', id: cardId, level: 1, maxLvl: UPGRADE.BASE_MAX, xp: 0, upgradeType: null, phase: 1});
            document.getElementById('pull-card-container').innerHTML = renderHTMLCard(s);
            document.getElementById('pull-title').innerText = "PACK OPENED!";
            document.getElementById('pull-modal').style.display = "flex";
        }
