// MISSIONS — Season 1 (2014)-style daily/one-time objectives. Rewards are coins, draft
// picks, or a random card of a given rarity (never a fixed card id) — same "no hardcoded
// card identity" rule the pack shop and draft board already follow.
const MISSIONS = [
    // --- Daily (repeatable, reset every 24h — see checkDailyReset() in core/missions.js) ---
    { id: 'daily_play_3', title: 'Get In The Ring', description: 'Play 3 Exhibition matches', type: 'play_exhibition', target: 3, reward: { coins: 50 }, repeatable: true },
    { id: 'daily_win_2', title: 'Quick Victories', description: 'Win 2 Exhibition matches', type: 'win_exhibition', target: 2, reward: { coins: 75 }, repeatable: true },
    { id: 'daily_draft_5', title: 'Board Regular', description: 'Use 5 Draft picks', type: 'draft_picks', target: 5, reward: { picks: 1 }, repeatable: true },
    { id: 'daily_win_5', title: 'Dominant Day', description: 'Win 5 Exhibition matches', type: 'win_exhibition', target: 5, reward: { coins: 100, picks: 1 }, repeatable: true },

    // --- One-time ---
    { id: 'once_play_1', title: 'First Bell', description: 'Play your first match', type: 'play_exhibition', target: 1, reward: { coins: 100 }, repeatable: false },
    { id: 'once_win_1', title: 'First Blood', description: 'Win your first match', type: 'win_exhibition', target: 1, reward: { coins: 150 }, repeatable: false },
    { id: 'once_collect_10', title: 'Starter Roster', description: 'Collect 10 cards', type: 'collect_cards', target: 10, reward: { coins: 200 }, repeatable: false },
    { id: 'once_collect_25', title: 'Growing Collection', description: 'Collect 25 cards', type: 'collect_cards', target: 25, reward: { picks: 2 }, repeatable: false },
    { id: 'once_collect_50', title: 'Card Hoarder', description: 'Collect 50 cards', type: 'collect_cards', target: 50, reward: { picks: 3 }, repeatable: false },
    { id: 'once_train_1', title: 'Hit The Gym', description: 'Train a card for the first time', type: 'train_card', target: 1, reward: { coins: 100 }, repeatable: false },
    { id: 'once_combine_1', title: 'Level Up', description: 'Combine two duplicate cards for the first time', type: 'combine_card', target: 1, reward: { coins: 200, picks: 1 }, repeatable: false },
    { id: 'once_draft_25', title: 'Board Veteran', description: 'Use 25 Draft picks', type: 'draft_picks', target: 25, reward: { picks: 3 }, repeatable: false },
    { id: 'once_draft_50', title: 'Board Master', description: 'Use 50 Draft picks', type: 'draft_picks', target: 50, reward: { card: 'Common' }, repeatable: false },
    { id: 'once_win_10', title: 'Ring Veteran', description: 'Win 10 Exhibition matches', type: 'win_exhibition', target: 10, reward: { coins: 300 }, repeatable: false },
    { id: 'once_win_25', title: 'Ring Champion', description: 'Win 25 Exhibition matches', type: 'win_exhibition', target: 25, reward: { picks: 2 }, repeatable: false },
    { id: 'once_win_50', title: 'Main Eventer', description: 'Win 50 Exhibition matches', type: 'win_exhibition', target: 50, reward: { card: 'Uncommon' }, repeatable: false },
    { id: 'once_win_100', title: 'Hall of Famer', description: 'Win 100 Exhibition matches', type: 'win_exhibition', target: 100, reward: { card: 'Rare' }, repeatable: false },
    { id: 'once_tier_superrare', title: 'Rising Star', description: 'Reach Super Rare deck tier', type: 'reach_tier', target: 'SuperRare', reward: { coins: 500, picks: 2 }, repeatable: false },
    { id: 'once_tier_ultrarare', title: 'Elite Status', description: 'Reach Ultra Rare deck tier', type: 'reach_tier', target: 'UltraRare', reward: { coins: 1000, picks: 3 }, repeatable: false },
    { id: 'once_tier_epic', title: 'Epic Roster', description: 'Reach Epic deck tier', type: 'reach_tier', target: 'Epic', reward: { card: 'SuperRare' }, repeatable: false },
    { id: 'once_tier_legendary', title: 'Legendary Status', description: 'Reach Legendary deck tier', type: 'reach_tier', target: 'Legendary', reward: { coins: 2000, card: 'UltraRare' }, repeatable: false },
    { id: 'once_tier_survivor', title: 'The Ultimate Survivor', description: 'Reach Survivor deck tier', type: 'reach_tier', target: 'Survivor', reward: { card: 'Epic', picks: 5 }, repeatable: false }
];
