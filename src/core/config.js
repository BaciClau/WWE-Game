// Praguri recalibrate (v3): deck-ul a trecut de la 4M+1F+1S (6 carduri numărate în
// rank) la 4M+2F+1S (7 carduri) — a doua Diva adaugă ~19% la totalul de stats folosit
// de calculateDeckTier(), deci toate pragurile din v2 au fost scalate ×1.19 ca să nu
// devină din nou prea ușor de atins (același bug ca la v1: un lineup abia colectat,
// nivel 1, ajungea aproape de pragul următor). Vezi v2 pentru logica de calibrare
// originală (1.3x/1.6x/1.9x peste suma de bază nivel 1 a fiecărei rarități).
// Praguri exponențiale (v5): progresia liniară din v4 (+1860 la fiecare treaptă)
// făcea fiecare rank-up la fel de greu ca precedentul, nerealist față de curba
// reală din WWE SuperCard Season 1 (Rare~200, SuperRare~350, UltraRare~550,
// Epic~800, Legendary~1100, Survivor~1500 — fiecare ~1.4-1.8x greu decât precedentul).
// SuperRare rămâne ancora de pornire (5570, ca în v4) ca ritmul de început de joc
// să nu se schimbe; de acolo fiecare rank de bază următor cere ×1.8 față de precedentul.
// Subtreptele (+/++) marchează 33%/66% din distanța către următorul rank de bază.
const TIERS = [
  { name: 'Rare',         base: 'Rare',      min: 0,     color: '#3498db' },
  { name: 'Rare+',        base: 'Rare',      min: 3325,  color: '#3498db' },
  { name: 'Rare++',       base: 'Rare',      min: 3962,  color: '#3498db' },
  { name: 'Super Rare',   base: 'SuperRare', min: 4599,  color: '#00bcd4' },
  { name: 'Super Rare+',  base: 'SuperRare', min: 5607,  color: '#00bcd4' },
  { name: 'Super Rare++', base: 'SuperRare', min: 6615,  color: '#00bcd4' },
  { name: 'Ultra Rare',   base: 'UltraRare', min: 7653,  color: '#e040fb' },
  { name: 'Ultra Rare+',  base: 'UltraRare', min: 8632,  color: '#e040fb' },
  { name: 'Ultra Rare++', base: 'UltraRare', min: 9611,  color: '#e040fb' },
  { name: 'Epic',         base: 'Epic',      min: 10620, color: '#9b59b6' },
  { name: 'Epic+',        base: 'Epic',      min: 12329, color: '#9b59b6' },
  { name: 'Epic++',       base: 'Epic',      min: 14037, color: '#9b59b6' },
  { name: 'Legendary',    base: 'Legendary', min: 15798, color: '#f1c40f' },
  { name: 'Legendary+',   base: 'Legendary', min: 18966, color: '#f1c40f' },
  { name: 'Legendary++',  base: 'Legendary', min: 22134, color: '#f1c40f' },
  { name: 'Survivor',     base: 'Survivor',  min: 25398, color: '#e74c3c' },
  { name: 'Survivor+',    base: 'Survivor',  min: 27912, color: '#e74c3c' },
  { name: 'Survivor++',   base: 'Survivor',  min: 30427, color: '#e74c3c' },
];

        // Crește la fiecare update → hard reset automat la load
        const GAME_VERSION = '0.11.0';
        const SAVE_KEY = 'sc2014_save';

        const RARITIES = ['Common', 'Uncommon', 'Rare', 'SuperRare', 'UltraRare', 'Epic', 'Legendary', 'Survivor'];

        // Nivel maxim (fără upgrade) și nivel maxim Pro / Perfect Pro, per raritate.
        // Pro și Perfect Pro ating exact același nivel maxim (Perfect Pro doar are o
        // curbă vizuală diferită de afișare ★, nu un plafon mai mare).
        const LEVEL_CAPS = {
            Common: 10, Uncommon: 15, Rare: 20, SuperRare: 25,
            UltraRare: 30, Epic: 35, Legendary: 40, Survivor: 45
        };
        const PRO_LEVEL_CAPS = {
            Common: 15, Uncommon: 20, Rare: 25, SuperRare: 30,
            UltraRare: 35, Epic: 40, Legendary: 45, Survivor: 50
        };

        const UPGRADE = {
            BASE_MAX: 10,
            NORMAL_MAX: 15,
            PERFECT_MAX: 20,
            XP_BASE: 25,
            // CurrentStat = Base + (Max - Base) * (Level / MaxLevel), unde Max = Base * MAX_STAT_RATIO
            // și MaxLevel e nivelul maxim fără upgrade al rarității (LEVEL_CAPS).
            MAX_STAT_RATIO: 1.8,
            // Perfect Pro folosește un ratio mai mare decât Pro normal, ca cele două upgrade-uri
            // să nu mai ajungă la exact aceleași statistici finale (înainte era doar cosmetic ★).
            PERFECT_STAT_RATIO: 2.1
        };

        // Recompense pentru streak de victorii consecutive (reset la orice înfrângere/forfeit)
        // Fiecare prag se activează la orice multiplu (ex: 6, 9, 12... la fel ca 3)
        const STREAK_REWARDS = {
            coinBonusEvery: 3,   // +10% coins la câștig
            coinBonusPct: 10,
            pickBonusEvery: 5,   // +1 Pick suplimentar
            pickBonusAmount: 1,
            freePackEvery: 10,   // Pack gratuit (Rare/SuperRare)
            freePackRarities: ['Rare', 'SuperRare']
        };
