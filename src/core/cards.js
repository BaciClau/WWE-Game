function getCardBase(card) { return DB.find(c => c.id === card.id); }
        function getCardRarity(card) { return getCardBase(card).rarity; }

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

        // CurrentStat = Base + (Max - Base) * (Level / MaxLevel), cu Max = Base * ratio
        // și MaxLevel = nivelul maxim fără upgrade al rarității. Pro/Perfect Pro continuă
        // peste MaxLevel până la plafonul Pro (PRO_LEVEL_CAPS), dar Perfect Pro folosește
        // un ratio mai mare (PERFECT_STAT_RATIO) — la fel de mult XP investit trebuie să
        // aducă un card vizibil mai puternic, nu doar o etichetă ★ diferită.
        function getStatMultiplier(card) {
            const baseMax = getBaseMaxLevel(card);
            const lvl = getEffectiveLevel(card);
            const ratio = card.upgradeType === 'perfect' ? UPGRADE.PERFECT_STAT_RATIO : UPGRADE.MAX_STAT_RATIO;
            return 1 + (ratio - 1) * (lvl / baseMax);
        }

        function isPerfectCard(card) { return card.upgradeType === 'perfect'; }
        function canPromote(card) {
            return getCardBase(card).gender !== 'S' && !card.upgradeType && card.level >= getBaseMaxLevel(card);
        }

        function getXpNeeded(card) {
            if (getEffectiveLevel(card) >= getEffectiveMax(card)) return 0;
            return Math.max(1, card.level) * 100;
        }

        function getSacrificeXp(uid) {
            const c = player.inventory.find(x => x.uid === uid);
            if (!c) return 0;
            const idx = RARITIES.indexOf(getCardRarity(c));
            return UPGRADE.XP_BASE * Math.pow(2, Math.max(0, idx));
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
        }

        function getStats(card) {
            let base = getCardBase(card);
            if(!base) return null;
            if(base.gender === 'S') return { ...base, uid: card.uid, lvl: 1, maxLvl: 1, xp: 0, xpNeeded: 0, upgradeType: null, phase: 1, effectiveLvl: 1, effectiveMax: 1, locked: !!card.locked };
            let multi = getStatMultiplier(card);
            return {
                ...base, uid: card.uid,
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
