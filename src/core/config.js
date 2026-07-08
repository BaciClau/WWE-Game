// Praguri recalibrate (v3): deck-ul a trecut de la 4M+1F+1S (6 carduri numărate în
// rank) la 4M+2F+1S (7 carduri) — a doua Diva adaugă ~19% la totalul de stats folosit
// de calculateDeckTier(), deci toate pragurile din v2 au fost scalate ×1.19 ca să nu
// devină din nou prea ușor de atins (același bug ca la v1: un lineup abia colectat,
// nivel 1, ajungea aproape de pragul următor). Vezi v2 pentru logica de calibrare
// originală (1.3x/1.6x/1.9x peste suma de bază nivel 1 a fiecărei rarități).
// Praguri calibrate din date reale (v6): pragul de bază al fiecărei rarități = totalul
// EXACT al celui mai bun deck posibil (4M+2F+1S) compus DOAR din carduri de acea raritate,
// la nivel 1, neantrenate — calculat direct din src/data/cards.js. Așa, un jucător care
// tocmai și-a completat un deck dintr-o raritate ajunge automat în acel rank, fără să
// depindă de cât de mult a antrenat cardurile (versiunea anterioară cerea mult peste ce
// oferă cardurile brute — se putea avea un deck plin de Epic și tot ieșea Super Rare).
// Subtreptele (+/++) marchează 33%/66% din distanța către pragul de bază al rarității
// următoare. Rare rămâne 0 (rangul de start, toată lumea începe aici).
const TIERS = [
  { name: 'Rare',         base: 'Rare',      min: 0,     color: '#3498db' },
  { name: 'Rare+',        base: 'Rare',      min: 949,   color: '#3498db' },
  { name: 'Rare++',       base: 'Rare',      min: 1899,  color: '#3498db' },
  { name: 'Super Rare',   base: 'SuperRare', min: 2877,  color: '#00bcd4' },
  { name: 'Super Rare+',  base: 'SuperRare', min: 3250,  color: '#00bcd4' },
  { name: 'Super Rare++', base: 'SuperRare', min: 3623,  color: '#00bcd4' },
  { name: 'Ultra Rare',   base: 'UltraRare', min: 4008,  color: '#e040fb' },
  { name: 'Ultra Rare+',  base: 'UltraRare', min: 5071,  color: '#e040fb' },
  { name: 'Ultra Rare++', base: 'UltraRare', min: 6134,  color: '#e040fb' },
  { name: 'Epic',         base: 'Epic',      min: 7229,  color: '#9b59b6' },
  { name: 'Epic+',        base: 'Epic',      min: 8322,  color: '#9b59b6' },
  { name: 'Epic++',       base: 'Epic',      min: 9414,  color: '#9b59b6' },
  { name: 'Legendary',    base: 'Legendary', min: 10540, color: '#f1c40f' },
  { name: 'Legendary+',   base: 'Legendary', min: 12493, color: '#f1c40f' },
  { name: 'Legendary++',  base: 'Legendary', min: 14447, color: '#f1c40f' },
  { name: 'Survivor',     base: 'Survivor',  min: 16459, color: '#e74c3c' },
  { name: 'Survivor+',    base: 'Survivor',  min: 19951, color: '#e74c3c' },
  { name: 'Survivor++',   base: 'Survivor',  min: 23442, color: '#e74c3c' },
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

        // Recompense pentru streak de victorii consecutive (reset la orice înfrângere/forfeit).
        // Meciurile nu mai dau coins deloc (nici de bază, nici bonus) — singura sursă de coins
        // e din misiuni. Streak-ul dă doar picks suplimentare, pe un ciclu de 10 victorii care
        // se repetă la nesfârșit: 3→+1, 5→+2, 7→+4, 10→+10, 13→+1, 15→+2, ... (cheia e
        // streak % 10, cu 10/20/30... mapate la 0).
        const STREAK_REWARDS = {
            pickBonusSchedule: { 3: 1, 5: 2, 7: 4, 0: 10 },
            freePackEvery: 10,   // Pack gratuit (Rare/SuperRare)
            freePackRarities: ['Rare', 'SuperRare']
        };
