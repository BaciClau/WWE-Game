function getCardBase(card) { return DB.find(c => c.id === card.id); }
        function getCardRarity(card) { return getCardBase(card).rarity; }

        function getMaxLevel(card) {
            if (card.upgradeType === 'normal') return UPGRADE.NORMAL_MAX;
            if (card.upgradeType === 'perfect') return card.phase === 2 ? UPGRADE.BASE_MAX : UPGRADE.BASE_MAX;
            return UPGRADE.BASE_MAX;
        }

        function getEffectiveLevel(card) {
            if (card.upgradeType === 'perfect' && card.phase === 2) return 10 + card.level;
            return card.level;
        }

        function getEffectiveMax(card) {
            if (card.upgradeType === 'normal') return UPGRADE.NORMAL_MAX;
            if (card.upgradeType === 'perfect') return UPGRADE.PERFECT_MAX;
            return UPGRADE.BASE_MAX;
        }

        function getStatMultiplier(card) {
            const lv = card.level;
            if (!card.upgradeType) return 1 + (lv - 1) * UPGRADE.GROWTH.base;
            if (card.upgradeType === 'normal') {
                if (lv <= 10) return 1 + (lv - 1) * UPGRADE.GROWTH.base;
                const at10 = 1 + 9 * UPGRADE.GROWTH.base;
                return at10 + (lv - 10) * UPGRADE.GROWTH.normal;
            }
            if (card.upgradeType === 'perfect' && card.phase === 2) {
                const base10 = 1 + 9 * UPGRADE.GROWTH.base;
                return base10 + lv * UPGRADE.GROWTH.perfectP2;
            }
            return 1 + (lv - 1) * UPGRADE.GROWTH.base;
        }

        function isPerfectCard(card) { return card.upgradeType === 'perfect'; }
        function canPromote(card) {
            return getCardBase(card).gender !== 'S' && !card.upgradeType && card.level >= UPGRADE.BASE_MAX;
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
            player.inventory.push({ uid: uid(), id: id, level: 1, maxLvl: UPGRADE.BASE_MAX, xp: 0, upgradeType: null, phase: 1 });
        }

        function getStats(card) {
            let base = getCardBase(card);
            if(!base) return null;
            if(base.gender === 'S') return { ...base, uid: card.uid, lvl: 1, maxLvl: 1, xp: 0, xpNeeded: 0, upgradeType: null, phase: 1, effectiveLvl: 1, effectiveMax: 1 };
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
                pow: Math.floor(base.pow * multi), tgh: Math.floor(base.tgh * multi),
                spd: Math.floor(base.spd * multi), cha: Math.floor(base.cha * multi)
            };
        }
