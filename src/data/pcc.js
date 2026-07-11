// ============ PEOPLE'S CHAMPION CHALLENGE — DATA ============
// Faithful single-player adaptation of WWE SuperCard's PCC (first ran Sept 2014,
// John Cena vs Brock Lesnar, tied to Night of Champions):
//   - Two Superstars face off; you ALIGN with one side at the start of the event and
//     that choice sets your rewards track (you're playing for THAT champion's card).
//   - You're always shown three opponents worth +1 / +3 / +5 points — the higher the
//     points, the nastier the opponent.
//   - PCC matches deal FOUR of your cards (not the whole deck) and run the usual
//     3-fall format — best stats win.
//   - Points earned during the event bank milestone rewards along the way, and your
//     final contribution decides which version of the champion card you take home.
//   - The original's global leaderboard/community is simulated here: both sides
//     accumulate "community votes" over the event (deterministic per event, so a
//     reload never changes history), your wins add real votes to your side, and the
//     side with more votes when time runs out crowns the People's Champion.

// --- Event clock ---
// 72h cycles: 66h of live event + 6h intermission before the next matchup starts.
// Anchored to a fixed epoch (a Monday 00:00 UTC) so cycle boundaries are stable
// regardless of when the game is opened.
const PCC_EPOCH = Date.UTC(2026, 0, 5);
const PCC_ACTIVE_MS = 66 * 3600 * 1000;
const PCC_CYCLE_MS = 72 * 3600 * 1000;

// Every win = this many community votes for your champion (a draw pays 1 point).
const PCC_VOTES_PER_POINT = 500;

// --- The champions ---
// Base statlines are Rare-tier numbers; the exclusive reward cards are generated from
// them below at fixed multipliers, tuned ~5% ABOVE a normal card of the same rarity —
// same prestige treatment as the Ladder Reward exclusives (ids 900+).
const PCC_CHAMPIONS = [
    { key: 'rock',   name: 'The Rock',    base: { pow: 95, tgh: 93, spd: 87, cha: 109 }, img: 'src/assets/images/carti/The%20rock.png' },
    { key: 'cena',   name: 'John Cena',   base: { pow: 96, tgh: 96, spd: 83, cha: 103 }, img: 'src/assets/images/carti/John_ceva_1-removebg-preview.png' },
    { key: 'hogan',  name: 'Hulk Hogan',  base: { pow: 92, tgh: 99, spd: 79, cha: 109 }, img: 'src/assets/images/carti/Hulk_Hogan_pro.png' },
    { key: 'savage', name: 'Macho Man',   base: { pow: 90, tgh: 92, spd: 96, cha: 110 }, img: 'src/assets/images/carti/Macho%20man.png' },
    { key: 'brock',  name: 'Brock Lesnar', base: { pow: 99, tgh: 96, spd: 83, cha: 87 }, img: 'src/assets/images/carti/Brock%20lesnar.webp' },
    { key: 'taker',  name: 'Undertaker',  base: { pow: 92, tgh: 97, spd: 82, cha: 103 }, img: 'src/assets/images/carti/Undertaker_2-removebg-preview.png' },
    { key: 'austin', name: 'Stone Cold',  base: { pow: 90, tgh: 98, spd: 78, cha: 109 }, img: 'src/assets/images/carti/Stone_Cold.webp' },
    { key: 'hhh',    name: 'Triple H',    base: { pow: 94, tgh: 97, spd: 80, cha: 104 }, img: 'src/assets/images/carti/Triple%20H.webp' },
];

// Rotating matchup pool — one per event cycle, in order, repeating.
const PCC_MATCHUPS = [
    { a: 'rock',   b: 'cena',   tagline: 'ONCE IN A LIFETIME' },
    { a: 'hogan',  b: 'savage', tagline: 'THE MEGA POWERS EXPLODE' },
    { a: 'brock',  b: 'taker',  tagline: 'THE STREAK ON THE LINE' },
    { a: 'austin', b: 'hhh',    tagline: 'ATTITUDE ERA WAR' },
];

// Contribution tiers → which version of your champion's card you earn at the end.
// If your side LOSES the community vote you drop exactly one tier (SuperRare → a
// picks-only consolation) — performance still pays, but crowning the champ pays more.
// Calibrated against the real economy (packs cost 100-1,500 coins, an Exhibition win
// pays 2 picks): the top card demands a serious multi-day grind — 75 points is 15 wins
// against the hardest (+5) opponent inside one 66h event — so the event stays a chase,
// not a free power spike every 3 days.
const PCC_REWARD_TIERS = [
    { points: 3,  rarity: 'SuperRare' },
    { points: 15, rarity: 'Epic' },
    { points: 35, rarity: 'Legendary' },
    { points: 75, rarity: 'Survivor' },
];
const PCC_LOSER_CONSOLATION_PICKS = 3;

// Rewards sprinkled through the event "for playing, winning, and so on" — claimable
// from the event screen the moment the threshold is reached. Sized as a nice daily
// drip (a pack's worth of coins here, a few picks there), never a jackpot.
const PCC_MILESTONES = [
    { points: 3,  label: '3 Draft Picks',           picks: 3 },
    { points: 8,  label: '300 Coins',               coins: 300 },
    { points: 15, label: 'Free Pack (Rare/SR)',     pack: ['Rare', 'SuperRare'] },
    { points: 25, label: '5 Draft Picks',           picks: 5 },
    { points: 40, label: '500 Coins + 2 Picks',     coins: 500, picks: 2 },
];

// The three standing opponents: points paid on a WIN, power relative to the player's
// deck, and the AI brain used. Mirrors the original's "+1 / +3 / +5, harder pays more".
const PCC_OPPONENT_SLOTS = [
    { points: 1, minPct: 0.90, maxPct: 0.96, aiMode: 'easy',      label: 'CONTENDER' },
    { points: 3, minPct: 0.98, maxPct: 1.03, aiMode: 'hard',      label: 'HEADLINER' },
    { points: 5, minPct: 1.03, maxPct: 1.08, aiMode: 'nightmare', label: 'MAIN EVENTER' },
];

// --- Exclusive reward cards, generated into DB ---
// Multipliers vs the champion's Rare base line (a normal SuperRare sits ~1.28x a Rare,
// Epic ~2.64x, Legendary ~4.24x, Survivor ~6.93x — these run ~5% hotter).
// `ladderReward: true` keeps them out of every draft/store/pack/opponent pool exactly
// like the Ladder exclusives; `pcc: true` drives their own styling and lets the event
// find each champion's card set by id range: 950 + championIndex*4 + tierIndex.
const PCC_CARD_ID_BASE = 950;
(function generatePccCards() {
    const mults = { SuperRare: 1.34, Epic: 2.78, Legendary: 4.45, Survivor: 7.3 };
    PCC_CHAMPIONS.forEach((ch, ci) => {
        PCC_REWARD_TIERS.forEach((tier, ti) => {
            const m = mults[tier.rarity];
            DB.push({
                id: PCC_CARD_ID_BASE + ci * 4 + ti,
                name: ch.name,
                rarity: tier.rarity,
                gender: 'M',
                pow: Math.round(ch.base.pow * m), tgh: Math.round(ch.base.tgh * m),
                spd: Math.round(ch.base.spd * m), cha: Math.round(ch.base.cha * m),
                ladderReward: true, pcc: true,
                img: ch.img,
            });
        });
    });
})();

function getPccChampion(key) { return PCC_CHAMPIONS.find(c => c.key === key); }
function getPccCardId(championKey, rarity) {
    const ci = PCC_CHAMPIONS.findIndex(c => c.key === championKey);
    const ti = PCC_REWARD_TIERS.findIndex(t => t.rarity === rarity);
    if (ci === -1 || ti === -1) return null;
    return PCC_CARD_ID_BASE + ci * 4 + ti;
}
