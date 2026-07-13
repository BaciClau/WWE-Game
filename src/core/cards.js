function getCardBase(card) { return DB.find(c => c.id === card.id); }
        function getCardRarity(card) { return getCardBase(card).rarity; }

        // TAG TEAM CHEMISTRY — the original WWE SuperCard Season 1 half-diamond system:
        // every fighter card carries a diamond with only HALF of it filled, in one of two
        // colors. BLUE diamonds are split left/right; GOLD diamonds are split top/bottom.
        // The rule reads itself straight off the card, no legend needed:
        //   - the two halves COMPLETE one diamond (blue-left + blue-right, or gold-top +
        //     gold-bottom)  →  💎 +10% on every stat
        //   - the two halves are IDENTICAL                    →  0%, nothing moves
        //   - the colors don't even match (blue vs gold)      →  💢 -5% on every stat
        const CHEM_STYLES = {
            'blue-l': { label: 'BLUE ◀ LEFT HALF — completes BLUE RIGHT' },
            'blue-r': { label: 'BLUE ▶ RIGHT HALF — completes BLUE LEFT' },
            'gold-t': { label: 'GOLD ▲ TOP HALF — completes GOLD BOTTOM' },
            'gold-b': { label: 'GOLD ▼ BOTTOM HALF — completes GOLD TOP' },
        };
        function getChemFactor(a, b) {
            if (!a || !b) return 0;
            if (a === b) return 0;                       // same half — nothing new
            if (a.slice(0, 4) === b.slice(0, 4)) return 0.10; // same color, other half — complete!
            return -0.05;                                // colors clash
        }
        // Real Season 1 (2014-era) relationships decide the halves, so real tag teams
        // genuinely complete each other's diamond: The Usos, Gold & Stardust, Miz & Mizdow,
        // the Bella Twins... Trios get two members completing and the third on a SAME half
        // (neutral) — except Seth Rollins, whose 2014 betrayal of The Shield puts him on the
        // OTHER color entirely (clashes with both his old brothers). First match in this
        // list wins; names not listed fall back to a stable hash of the NAME (not the id),
        // so every rarity of the same wrestler always carries the same half.
        const CHEM_ASSIGN = [
            ['jimmy uso', 'blue-l'], ['jey uso', 'blue-r'],                      // The Usos
            ['goldust', 'gold-t'], ['stardust', 'gold-b'], ['cody rhodes', 'gold-b'], // Gold & Stardust / Rhodes Brothers
            ['the miz', 'blue-l'], ['damien mizdow', 'blue-r'], ['damien sandow', 'blue-r'], // Miz & Mizdow
            ['roman reigns', 'gold-t'], ['dean ambrose', 'gold-b'], ['seth rollins', 'blue-l'], // The Shield (+ the betrayal)
            ['luke harper', 'blue-l'], ['erick rowan', 'blue-r'], ['bray wyatt', 'blue-l'],     // Wyatt Family
            ['heath slater', 'gold-t'], ['titus', 'gold-b'],                     // Slater Gator
            ['kofi kingston', 'blue-l'], ['big e', 'blue-r'], ['xavier woods', 'blue-l'], // New Day
            ['brie bella', 'gold-t'], ['nikki bella', 'gold-b'],                 // Bella Twins
            ['cameron', 'blue-l'], ['naomi', 'blue-r'],                          // Funkadactyls
            ['layla', 'gold-t'], ['summer rae', 'gold-b'],                       // SLayers
            ['aj lee', 'blue-l'], ['tamina', 'blue-r'],                          // AJ & her bodyguard
            ['kane', 'gold-t'], ['undertaker', 'gold-b'],                        // Brothers of Destruction
            ['hollywood hogan', 'blue-l'], ['hulk hogan', 'blue-l'], ['macho man', 'blue-r'], ['randy savage', 'blue-r'], // Mega Powers
            ['randy orton', 'gold-t'], ['batista', 'gold-b'], ['triple h', 'gold-t'], ['shawn michaels', 'gold-b'], // Evolution + DX
            ['razor ramon', 'blue-l'], ['diesel', 'blue-r'],                     // The Outsiders
            ['ted dibiase', 'gold-t'], ['virgil', 'gold-b'],                     // Million Dollar Man & bodyguard
            ['mr. perfect', 'blue-l'], ['ric flair', 'blue-r'],                  // Perfect & Flair alliance
            ['eddie guerrero', 'gold-t'], ['rey mysterio', 'gold-b'],            // Eddie & Rey
            ['cesaro', 'blue-l'], ['jack swagger', 'blue-r'],                    // Real Americans
        ];
        const CHEM_VARIANTS = ['blue-l', 'blue-r', 'gold-t', 'gold-b'];
        function getCardChemStyle(base) {
            if (!base || base.gender === 'S') return null;
            const n = base.name.toLowerCase();
            const hit = CHEM_ASSIGN.find(([sub]) => n.includes(sub));
            if (hit) return hit[1];
            // Stable name hash — every copy/rarity of the same wrestler shares one half.
            let h = 0;
            for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
            return CHEM_VARIANTS[h % 4];
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
            const proMax = getProMaxLevel(card);
            const banked = card.comboMultiplier || 1;
            if (card.upgradeType === 'perfect' && card.phase === 2) {
                // Perfect Pro's post-combine climb is its own short stretch (card.level runs
                // 0..stretchMax, shown as the ★ rating). ★0 — right away — already carries the
                // banked pre-combine multiplier (typically ~MAX_STAT_RATIO, since Perfect Pro
                // requires both source cards fully trained), climbing further to banked +
                // (PERFECT_STAT_RATIO - 1) at the top of the stretch. Deliberately NOT using
                // getEffectiveLevel()'s baseMax offset here.
                const stretchMax = proMax - baseMax;
                return banked + (UPGRADE.PERFECT_STAT_RATIO - 1) * (card.level / stretchMax);
            }
            if (card.upgradeType === 'normal') {
                // Pro also resets to level 1 and climbs its OWN stretched range (1..proMax,
                // wider than a normal card's 1..baseMax — see LEVEL_CAPS vs PRO_LEVEL_CAPS).
                // This MUST be normalized against that same wider range, not baseMax: dividing
                // by (baseMax - 1) while card.level legally climbs past baseMax up to proMax
                // let the growth term blow straight through the intended +80% and out the
                // other side (a Rare Pro at its own max level came out stronger than a
                // Perfect Pro at ITS max — the whole point of Perfect Pro being the rarer,
                // better upgrade). Same "climb from 1, reach exactly +80% at your own real
                // max" shape a normal card gets, just stretched to the longer Pro ladder.
                return banked + (UPGRADE.MAX_STAT_RATIO - 1) * ((card.level - 1) / (proMax - 1));
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
                chem: getCardChemStyle(base),
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
