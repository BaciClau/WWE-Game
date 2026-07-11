// MISSIONS — Season 1 (2014)-style daily/one-time objectives. Rewards are coins, draft
// picks, or a random card of a given rarity (never a fixed card id) — same "no hardcoded
// card identity" rule the pack shop and draft board already follow.
const MISSIONS = [
    // --- Daily (repeatable, reset every 24h — see checkDailyReset() in core/missions.js) ---
    // Sized as a solid daily DRIP, never the main chase: clearing the whole board plus the
    // sweep bonus pays ~650 coins (≈ one Super Rare pack) and 7 picks — a nice boost on top
    // of normal play, achievable in one relaxed session without grinding FOR the missions.
    { id: 'daily_play_10', title: 'Get In The Ring', description: 'Play 10 Exhibition matches', type: 'play_exhibition', target: 10, reward: { coins: 100 }, repeatable: true },
    { id: 'daily_win_5', title: 'Quick Victories', description: 'Win 5 Exhibition matches', type: 'win_exhibition', target: 5, reward: { coins: 100 }, repeatable: true },
    { id: 'daily_win_15', title: 'On A Roll', description: 'Win 15 Exhibition matches', type: 'win_exhibition', target: 15, reward: { coins: 150, picks: 1 }, repeatable: true },
    { id: 'daily_win_25', title: 'Dominant Day', description: 'Win 25 Exhibition matches', type: 'win_exhibition', target: 25, reward: { picks: 2 }, repeatable: true },
    { id: 'daily_draft_30', title: 'Board Regular', description: 'Use 30 Draft picks', type: 'draft_picks', target: 30, reward: { picks: 1 }, repeatable: true },
    { id: 'daily_train_3', title: 'Gym Session', description: 'Train cards 3 times', type: 'train_card', target: 3, reward: { coins: 75 }, repeatable: true },
    { id: 'daily_pcc_3', title: "For The People", description: "Play 3 People's Champion matches", type: 'play_pcc', target: 3, reward: { coins: 125 }, repeatable: true },
    // The sweep: checkDailySweep() (core/missions.js) marks it complete once every OTHER
    // daily above has been CLAIMED — clearing the whole board pays a real bonus on top.
    { id: 'daily_sweep', title: '🧹 DAILY SWEEP', description: 'Claim every other daily mission today', type: 'daily_sweep', target: 1, reward: { coins: 300, picks: 3 }, repeatable: true },

    // --- One-time ---
    { id: 'once_play_1', title: 'First Bell', description: 'Play your first match', type: 'play_exhibition', target: 1, reward: { coins: 100 }, repeatable: false },
    { id: 'once_win_1', title: 'First Blood', description: 'Win your first match', type: 'win_exhibition', target: 1, reward: { coins: 150 }, repeatable: false },
    { id: 'once_collect_10', title: 'Starter Roster', description: 'Collect 60 cards', type: 'collect_cards', target: 60, reward: { coins: 200 }, repeatable: false },
    { id: 'once_collect_25', title: 'Growing Collection', description: 'Collect 180 cards', type: 'collect_cards', target: 180, reward: { picks: 15 }, repeatable: false },
    { id: 'once_collect_50', title: 'Card Hoarder', description: 'Collect 350 cards', type: 'collect_cards', target: 350, reward: { picks: 25 }, repeatable: false },
    { id: 'once_train_1', title: 'Hit The Gym', description: 'Train a card for the first time', type: 'train_card', target: 1, reward: { coins: 100 }, repeatable: false },
    { id: 'once_combine_1', title: 'Level Up', description: 'Combine two duplicate cards for the first time', type: 'combine_card', target: 1, reward: { coins: 200, picks: 1 }, repeatable: false },
    { id: 'once_draft_25', title: 'Board Veteran', description: 'Use 150 Draft picks', type: 'draft_picks', target: 150, reward: { picks: 20 }, repeatable: false },
    { id: 'once_draft_50', title: 'Board Master', description: 'Use 450 Draft picks', type: 'draft_picks', target: 450, reward: { picks: 35 }, repeatable: false },
    { id: 'once_win_10', title: 'Ring Veteran', description: 'Win 75 Exhibition matches', type: 'win_exhibition', target: 75, reward: { coins: 300 }, repeatable: false },
    { id: 'once_win_25', title: 'Ring Champion', description: 'Win 200 Exhibition matches', type: 'win_exhibition', target: 200, reward: { picks: 20 }, repeatable: false },
    { id: 'once_win_50', title: 'Main Eventer', description: 'Win 500 Exhibition matches', type: 'win_exhibition', target: 500, reward: { picks: 30 }, repeatable: false },
    { id: 'once_win_100', title: 'Hall of Famer', description: 'Win 1200 Exhibition matches', type: 'win_exhibition', target: 1200, reward: { card: 'SuperRare', picks: 40 }, repeatable: false },
    // Total matches PLAYED (wins + losses + draws + forfeits all count) — a separate grind
    // from the win-count ladder above, since it rewards just showing up and grinding matches
    // regardless of outcome, not only winning streaks.
    { id: 'once_play_150', title: 'Ring Regular', description: 'Play 150 Exhibition matches', type: 'play_exhibition', target: 150, reward: { coins: 100 }, repeatable: false },
    { id: 'once_play_400', title: 'Road Warrior', description: 'Play 400 Exhibition matches', type: 'play_exhibition', target: 400, reward: { picks: 20 }, repeatable: false },
    { id: 'once_play_1000', title: 'Iron Competitor', description: 'Play 1000 Exhibition matches', type: 'play_exhibition', target: 1000, reward: { picks: 30 }, repeatable: false },
    { id: 'once_play_2500', title: 'Marathon Legend', description: 'Play 2500 Exhibition matches', type: 'play_exhibition', target: 2500, reward: { card: 'SuperRare', picks: 40 }, repeatable: false },
    { id: 'once_tier_superrare', title: 'Rising Star', description: 'Reach Super Rare deck tier', type: 'reach_tier', target: 'SuperRare', reward: { coins: 500, picks: 20 }, repeatable: false },
    { id: 'once_tier_ultrarare', title: 'Elite Status', description: 'Reach Ultra Rare deck tier', type: 'reach_tier', target: 'UltraRare', reward: { coins: 1000, picks: 30 }, repeatable: false },
    { id: 'once_tier_epic', title: 'Epic Roster', description: 'Reach Epic deck tier', type: 'reach_tier', target: 'Epic', reward: { card: 'SuperRare', picks: 40 }, repeatable: false },
    { id: 'once_tier_legendary', title: 'Legendary Status', description: 'Reach Legendary deck tier', type: 'reach_tier', target: 'Legendary', reward: { coins: 2000, card: 'UltraRare', picks: 50 }, repeatable: false },
    { id: 'once_tier_survivor', title: 'The Ultimate Survivor', description: 'Reach Survivor deck tier', type: 'reach_tier', target: 'Survivor', reward: { card: 'Epic', picks: 75 }, repeatable: false },

    // --- Ladder Rewards (one-time, shown only on the LADDER REWARDS screen) ---
    // Fixed, named-card rewards — the one deliberate exception to the "never a fixed card id"
    // rule above. These are exclusive "Ladder Reward" reprints (John Cena / Paige) from the
    // real WWE SuperCard Season 1 card set, flagged `ladderReward: true` in cards.js so they
    // can never drop from packs/draft/starter/opponent decks — a pure win-count grind is the
    // only way to obtain them. Most cards have a 2nd-copy rung at a much higher win count
    // (useful for the combine/upgrade mechanic once you own two). Thresholds per user spec;
    // Legendary Paige (60000) and Survivor Cena (75000) extend the same escalating pattern.
    { id: 'ladder_1', title: 'Ladder Reward: Rare Paige', description: 'Win 125 Exhibition matches', type: 'win_exhibition', target: 125, reward: { cardId: 900 }, repeatable: false },
    { id: 'ladder_2', title: 'Ladder Reward: 2nd Rare Paige', description: 'Win 200 Exhibition matches', type: 'win_exhibition', target: 200, reward: { cardId: 900 }, repeatable: false },
    { id: 'ladder_3', title: 'Ladder Reward: Super Rare Cena', description: 'Win 450 Exhibition matches', type: 'win_exhibition', target: 450, reward: { cardId: 901 }, repeatable: false },
    { id: 'ladder_4', title: 'Ladder Reward: Super Rare Paige', description: 'Win 750 Exhibition matches', type: 'win_exhibition', target: 750, reward: { cardId: 902 }, repeatable: false },
    { id: 'ladder_5', title: 'Ladder Reward: 2nd Super Rare Cena', description: 'Win 1200 Exhibition matches', type: 'win_exhibition', target: 1200, reward: { cardId: 901 }, repeatable: false },
    { id: 'ladder_6', title: 'Ladder Reward: 2nd Super Rare Paige', description: 'Win 2000 Exhibition matches', type: 'win_exhibition', target: 2000, reward: { cardId: 902 }, repeatable: false },
    { id: 'ladder_7', title: 'Ladder Reward: Ultra Rare Cena', description: 'Win 4000 Exhibition matches', type: 'win_exhibition', target: 4000, reward: { cardId: 903 }, repeatable: false },
    { id: 'ladder_8', title: 'Ladder Reward: Ultra Rare Paige', description: 'Win 6500 Exhibition matches', type: 'win_exhibition', target: 6500, reward: { cardId: 904 }, repeatable: false },
    { id: 'ladder_9', title: 'Ladder Reward: 2nd Ultra Rare Cena', description: 'Win 9000 Exhibition matches', type: 'win_exhibition', target: 9000, reward: { cardId: 903 }, repeatable: false },
    { id: 'ladder_10', title: 'Ladder Reward: 2nd Ultra Rare Paige', description: 'Win 11500 Exhibition matches', type: 'win_exhibition', target: 11500, reward: { cardId: 904 }, repeatable: false },
    { id: 'ladder_11', title: 'Ladder Reward: Epic Cena', description: 'Win 15000 Exhibition matches', type: 'win_exhibition', target: 15000, reward: { cardId: 905 }, repeatable: false },
    { id: 'ladder_12', title: 'Ladder Reward: Epic Paige', description: 'Win 17500 Exhibition matches', type: 'win_exhibition', target: 17500, reward: { cardId: 906 }, repeatable: false },
    { id: 'ladder_13', title: 'Ladder Reward: 2nd Epic Cena', description: 'Win 20000 Exhibition matches', type: 'win_exhibition', target: 20000, reward: { cardId: 905 }, repeatable: false },
    { id: 'ladder_14', title: 'Ladder Reward: 2nd Epic Paige', description: 'Win 30000 Exhibition matches', type: 'win_exhibition', target: 30000, reward: { cardId: 906 }, repeatable: false },
    { id: 'ladder_15', title: 'Ladder Reward: Legendary Cena', description: 'Win 40000 Exhibition matches', type: 'win_exhibition', target: 40000, reward: { cardId: 907 }, repeatable: false },
    { id: 'ladder_16', title: 'Ladder Reward: 2nd Legendary Cena', description: 'Win 50000 Exhibition matches', type: 'win_exhibition', target: 50000, reward: { cardId: 907 }, repeatable: false },
    { id: 'ladder_17', title: 'Ladder Reward: Legendary Paige', description: 'Win 60000 Exhibition matches', type: 'win_exhibition', target: 60000, reward: { cardId: 908 }, repeatable: false },
    { id: 'ladder_18', title: 'Ladder Reward: Survivor Cena', description: 'Win 75000 Exhibition matches', type: 'win_exhibition', target: 75000, reward: { cardId: 909 }, repeatable: false }
];
