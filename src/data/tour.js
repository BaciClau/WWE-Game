// ============ TOUR MODE — DATA ============
// A narrative single-player campaign: fixed chapters, each a short gauntlet of opponents at
// a SET power (unlike Exhibition/PCC, which always scale to the player's OWN current deck) —
// so early chapters are genuinely trivial for a fresh roster and later ones are a real,
// long-term goal. Stage power targets are pegged to the same TIERS thresholds (config.js)
// that gate deck ranks, so each chapter roughly lines up with "you'll clear this once your
// deck reaches about that rank" — Chapter 6's last stage sits at Survivor territory.
// Rewards are coins/picks/packs only — same modest scale as Missions, never an exclusive
// card — the campaign is a guided tour through the game's OWN economy, not a shortcut
// around it.
const TOUR_CHAPTERS = [
    {
        id: 'ch1', title: 'Chapter 1: Open Try-Out', tagline: 'Prove you belong in the ring.',
        stages: [
            { name: 'Jobber Joe', power: 800, aiMode: 'easy' },
            { name: 'Local Legend', power: 1400, aiMode: 'easy' },
            { name: 'Try-Out Judge', power: 2200, aiMode: 'normal' },
        ],
        reward: { coins: 30, picks: 3 }
    },
    {
        id: 'ch2', title: 'Chapter 2: Local Circuit', tagline: 'Every territory has its own champion.',
        stages: [
            { name: 'Circuit Regular', power: 3000, aiMode: 'normal' },
            { name: 'Tag Team Enforcer', power: 3800, aiMode: 'normal' },
            { name: 'Circuit Champion', power: 4600, aiMode: 'hard' },
        ],
        reward: { coins: 50, picks: 6, pack: ['Rare', 'SuperRare'] }
    },
    {
        id: 'ch3', title: 'Chapter 3: Regional Title', tagline: 'The belt on the line, no shortcuts.',
        stages: [
            { name: 'Number One Contender', power: 6000, aiMode: 'normal' },
            { name: 'Former Champion', power: 7500, aiMode: 'hard' },
            { name: 'Regional Champion', power: 9000, aiMode: 'hard' },
        ],
        reward: { coins: 70, picks: 10 }
    },
    {
        id: 'ch4', title: 'Chapter 4: National Spotlight', tagline: 'The cameras are on you now.',
        stages: [
            { name: 'Rising Star', power: 11000, aiMode: 'hard' },
            { name: 'Grudge Rival', power: 13000, aiMode: 'hard' },
            { name: 'National Champion', power: 15500, aiMode: 'nightmare' },
        ],
        reward: { coins: 90, picks: 14, pack: ['SuperRare', 'UltraRare'] }
    },
    {
        id: 'ch5', title: 'Chapter 5: Main Event Run', tagline: 'Only the toughest make it this far.',
        stages: [
            { name: 'Main Event Enforcer', power: 18000, aiMode: 'hard' },
            { name: "Veteran's Last Stand", power: 21000, aiMode: 'nightmare' },
            { name: 'Main Eventer', power: 24000, aiMode: 'nightmare' },
        ],
        reward: { coins: 150, picks: 20 }
    },
    {
        id: 'ch6', title: 'Chapter 6: World Championship', tagline: 'The very top of the mountain.',
        stages: [
            { name: 'World Title Contender', power: 27000, aiMode: 'nightmare' },
            { name: 'Former World Champion', power: 31000, aiMode: 'nightmare' },
            { name: 'The World Champion', power: 36000, aiMode: 'nightmare' },
        ],
        reward: { coins: 250, picks: 35, pack: ['UltraRare', 'Epic'] }
    },
];
