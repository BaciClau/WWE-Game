function getCardBase(card) { return DB.find(c => c.id === card.id); }
        function getCardRarity(card) { return getCardBase(card).rarity; }

        // FACE/HEEL alignment (the original game's diamond indicator) — drives the Tag Team
        // alignment mechanic from WWE SuperCard 2014: a matched tag pair gets +10% on the
        // active stat, a mismatched one -5% (applied in resolveRound). Assignments follow the
        // 2014-era on-screen personas; wrestlers not listed fall back to a stable id-parity
        // coin flip so every card always has SOME consistent alignment. HEEL list is checked
        // FIRST so e.g. a "Hollywood Hogan" entry would hit "hollywood" before "hogan".
        const HEEL_NAMES = ['randy orton', 'seth rollins', 'triple h', 'kane', 'brock lesnar',
            'paul heyman', 'rusev', 'lana', 'the miz', 'damien sandow', 'cesaro', 'bad news barrett',
            'bray wyatt', 'luke harper', 'erick rowan', 'alberto del rio', 'jbl', 'david otunga',
            'titus', 'heath slater', 'bo dallas', 'fandango', 'ryback', 'mcmahon', 'batista',
            'tyson kidd', 'vader', 'yokozuna', 'razor ramon', 'roddy piper', 'mr. perfect',
            'ted dibiase', 'rick rude', 'bobby heenan', 'big john studd', 'andre the giant',
            'mr. fuji', 'jimmy hart', 'hollywood', 'kevin nash', 'nikki bella', 'cameron',
            'eva marie', 'summer rae', 'layla', 'alicia fox', 'rosa mendes', 'tamina', 'eve',
            'stephanie', 'paige', 'edge'];
        const FACE_NAMES = ['john cena', 'daniel bryan', 'roman reigns', 'dean ambrose',
            'dolph ziggler', 'rey mysterio', 'big e', 'kofi kingston', 'xavier woods', 'sheamus',
            'mark henry', 'chris jericho', 'rob van dam', 'zack ryder', 'santino', 'jey uso',
            'jimmy uso', 'r-truth', 'adam rose', 'darren young', 'khali', 'justin gabriel',
            'jack swagger', 'goldust', 'cody rhodes', 'stardust', 'christian', 'big show',
            'sting', 'booker t', 'ric flair', 'hulk hogan', 'ultimate warrior', 'macho man',
            'randy savage', 'ricky steamboat', 'dusty rhodes', 'bruno sammartino',
            'eddie guerrero', 'shawn michaels', 'stone cold', 'the rock', 'undertaker',
            'jake roberts', 'sgt. slaughter', 'virgil', 'aj lee', 'natalya', 'naomi',
            'brie bella', 'emma'];
        function getCardAlignment(base) {
            if (!base || base.gender === 'S') return null;
            const n = base.name.toLowerCase();
            if (HEEL_NAMES.some(x => n.includes(x))) return 'heel';
            if (FACE_NAMES.some(x => n.includes(x))) return 'face';
            return base.id % 2 === 0 ? 'face' : 'heel';
        }

        // Nivel maxim fără upgrade, respectiv Pro/Perfect Pro, pentru raritatea cărții.
        function getBaseMaxLevel(card) {
            return LEVEL_CAPS[getCardRarity(card)] || UPGRADE.BASE_MAX;
        }
        function getProMaxLevel(card) {
            return PRO_LEVEL_CAPS[getCardRarity(card)] || UPGRADE.NORMAL_MAX;
        }

        function getMaxLevel(card) {
            if (card.upgradeType === 'normal') return getProMaxLevel(card);
            if (card.upgradeType === 'perfect') return getBaseMaxLevel(card);
            return getBaseMaxLevel(card);
        }

        function getEffectiveLevel(card) {
            if (card.upgradeType === 'perfect' && card.phase === 2) return getBaseMaxLevel(card) + card.level;
            return card.level;
        }

        function getEffectiveMax(card) {
            if (card.upgradeType === 'normal') return getProMaxLevel(card);
            if (card.upgradeType === 'perfect') return getProMaxLevel(card);
            return getBaseMaxLevel(card);
        }

        // CurrentStat = Base + (Max - Base) * ((Level - 1) / (MaxLevel - 1)), cu Max = Base * ratio
        // și MaxLevel = nivelul maxim fără upgrade al rarității. Anchored at Level 1 so a
        // freshly-pulled, never-combined card shows exactly its cards.js base stats.
        //
        // Combining (Pro/Perfect Pro) is the one deliberate exception, matching the real
        // game: "combining cards will transform two identical cards into the pro version...
        // and will not only provide a stat boost, but drop the card's level back down to 1.
        // The higher the level of the two cards when you combine them, the better the
        // effect will be" — i.e. the level number resets, but the STATS don't fall back to
        // raw base; they carry over the multiplier the card had earned right before the
        // combine (banked into card.comboMultiplier by focusPromoteNormal/
        // focusPromotePerfect) and keep growing from there, not from 1.
        function getStatMultiplier(card) {
            const baseMax = getBaseMaxLevel(card);
            const banked = card.comboMultiplier || 1;
            if (card.upgradeType === 'perfect' && card.phase === 2) {
                // Perfect Pro's post-combine climb is its own short stretch (card.level runs
                // 0..stretchMax, shown as the ★ rating). ★0 — right away — already carries the
                // banked pre-combine multiplier (typically ~MAX_STAT_RATIO, since Perfect Pro
                // requires both source cards fully trained), climbing further to banked +
                // (PERFECT_STAT_RATIO - 1) at the top of the stretch. Deliberately NOT using
                // getEffectiveLevel()'s baseMax offset here.
                const stretchMax = getProMaxLevel(card) - baseMax;
                return banked + (UPGRADE.PERFECT_STAT_RATIO - 1) * (card.level / stretchMax);
            }
            const lvl = getEffectiveLevel(card);
            return banked + (UPGRADE.MAX_STAT_RATIO - 1) * ((lvl - 1) / (baseMax - 1));
        }

        function isPerfectCard(card) { return card.upgradeType === 'perfect'; }
        // Combining works at ANY level in the real game — even two level-1 duplicates can
        // fuse into a Pro card. The only requirements are: not a support card, and not
        // already Pro/Perfect Pro itself. Whether the result is Pro vs. Perfect Pro depends
        // on how trained both cards were at the moment of combining (see focusPromoteNormal/
        // focusPromotePerfect in training.js), not on reaching max level first.
        function canPromote(card) {
            return getCardBase(card).gender !== 'S' && !card.upgradeType;
        }

        function getXpNeeded(card) {
            if (getEffectiveLevel(card) >= getEffectiveMax(card)) return 0;
            return Math.max(1, card.level) * 100;
        }

        function processLevelUps(card) {
            let gained = 0;
            while (getEffectiveLevel(card) < getEffectiveMax(card)) {
                const needed = getXpNeeded(card);
                if (needed <= 0 || card.xp < needed) break;
                card.xp -= needed;
                card.level++;
                gained++;
            }
            card.maxLvl = getMaxLevel(card);
            return gained;
        }

        function addCard(id) {
            let base = DB.find(c => c.id === id);
            if(!base) return;
            const cap = LEVEL_CAPS[base.rarity] || UPGRADE.BASE_MAX;
            player.inventory.push({ uid: uid(), id: id, level: 1, maxLvl: cap, xp: 0, upgradeType: null, phase: 1, locked: false });
            if (!player.discoveredCardIds.includes(id)) player.discoveredCardIds.push(id);
            incrementMission('collect_cards');
            checkTierMissions();
        }

        function getStats(card) {
            let base = getCardBase(card);
            if(!base) return null;
            if(base.gender === 'S') return { ...base, uid: card.uid, lvl: 1, maxLvl: 1, xp: 0, xpNeeded: 0, upgradeType: null, phase: 1, effectiveLvl: 1, effectiveMax: 1, locked: !!card.locked };
            let multi = getStatMultiplier(card);
            return {
                ...base, uid: card.uid,
                alignment: getCardAlignment(base),
                lvl: card.level,
                xp: card.xp || 0,
                xpNeeded: getXpNeeded(card),
                effectiveLvl: getEffectiveLevel(card),
                maxLvl: getMaxLevel(card),
                effectiveMax: getEffectiveMax(card),
                upgradeType: card.upgradeType,
                phase: card.phase,
                perfect: isPerfectCard(card),
                locked: !!card.locked,
                pow: Math.floor(base.pow * multi), tgh: Math.floor(base.tgh * multi),
                spd: Math.floor(base.spd * multi), cha: Math.floor(base.cha * multi)
            };
        }
