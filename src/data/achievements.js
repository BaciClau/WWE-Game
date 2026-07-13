// ============ ACHIEVEMENTS / TROPHY ROOM ============
// Permanent milestones, three tiers each (Bronze/Silver/Gold) — unlike Missions (daily) or
// Ladder Rewards (deck-tier gated), these track a lifetime stat that only ever goes up.
// Deliberately computed LIVE from existing player/inventory state via getValue() instead of
// a separate incrementing counter for every achievement — the number on screen IS the
// player's actual current stat, so there's nothing to fall out of sync. Only two counters
// exist purely because the underlying stat resets elsewhere and needs its own permanent
// high-water mark: player.highestWinStreak (winStreak resets on any loss) and
// player.pccChampionWins (the PCC event itself resets every cycle).
// Rewards stay in the same modest coins/picks range as Missions — trophies are recognition
// for things you were already going to do, never a reason to grind past the fun.
const ACHIEVEMENT_TIER_LABELS = ['BRONZE', 'SILVER', 'GOLD'];

const ACHIEVEMENTS = [
    {
        id: 'ach_collector', title: 'Card Collector', icon: '🃏',
        desc: 'Own {N} total cards',
        getValue: () => player.inventory.length,
        tiers: [
            { target: 30, reward: { coins: 15 } },
            { target: 100, reward: { picks: 6 } },
            { target: 250, reward: { picks: 15 } },
        ]
    },
    {
        id: 'ach_epic_hunter', title: 'Epic Hunter', icon: '💎',
        desc: 'Own {N} Epic-or-better cards (Epic/Legendary/Survivor)',
        getValue: () => player.inventory.filter(c => {
            const b = getCardBase(c);
            return b && ['Epic', 'Legendary', 'Survivor'].includes(b.rarity);
        }).length,
        tiers: [
            { target: 1, reward: { coins: 20 } },
            { target: 5, reward: { picks: 8 } },
            { target: 15, reward: { picks: 20 } },
        ]
    },
    {
        id: 'ach_combine_artist', title: 'Combine Artist', icon: '🔮',
        desc: 'Own {N} Pro cards',
        getValue: () => player.inventory.filter(c => c.upgradeType === 'normal').length,
        tiers: [
            { target: 1, reward: { coins: 15 } },
            { target: 5, reward: { picks: 6 } },
            { target: 15, reward: { picks: 18 } },
        ]
    },
    {
        id: 'ach_perfectionist', title: 'Perfectionist', icon: '★',
        desc: 'Own {N} Perfect Pro cards',
        getValue: () => player.inventory.filter(c => c.upgradeType === 'perfect').length,
        tiers: [
            { target: 1, reward: { picks: 10 } },
            { target: 3, reward: { picks: 20 } },
            { target: 10, reward: { picks: 40 } },
        ]
    },
    {
        id: 'ach_ring_warrior', title: 'Ring Warrior', icon: '🥊',
        desc: 'Win {N} Exhibition matches',
        getValue: () => player.wins || 0,
        tiers: [
            { target: 25, reward: { coins: 20 } },
            { target: 150, reward: { picks: 10 } },
            { target: 600, reward: { picks: 25 } },
        ]
    },
    {
        id: 'ach_streak_legend', title: 'Streak Legend', icon: '🔥',
        desc: 'Reach a {N}-match win streak',
        getValue: () => player.highestWinStreak || 0,
        tiers: [
            { target: 5, reward: { coins: 15 } },
            { target: 10, reward: { picks: 8 } },
            { target: 20, reward: { picks: 20 } },
        ]
    },
    {
        id: 'ach_peoples_champ', title: "People's Champion", icon: '🏆',
        desc: 'Get crowned People\'s Champion {N} time(s)',
        getValue: () => player.pccChampionWins || 0,
        tiers: [
            { target: 1, reward: { picks: 10 } },
            { target: 3, reward: { picks: 25 } },
            { target: 8, reward: { picks: 50 } },
        ]
    },
    {
        id: 'ach_tour_conqueror', title: 'Tour Conqueror', icon: '🗺️',
        desc: 'Complete {N} Tour chapters',
        getValue: () => (player.tour && player.tour.claimedChapters) ? player.tour.claimedChapters.length : 0,
        tiers: [
            { target: 1, reward: { coins: 20 } },
            { target: 3, reward: { picks: 12 } },
            { target: 6, reward: { picks: 30 } },
        ]
    },
];
