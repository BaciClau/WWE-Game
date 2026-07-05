// Praguri recalibrate (v3): deck-ul a trecut de la 4M+1F+1S (6 carduri numărate în
// rank) la 4M+2F+1S (7 carduri) — a doua Diva adaugă ~19% la totalul de stats folosit
// de calculateDeckTier(), deci toate pragurile din v2 au fost scalate ×1.19 ca să nu
// devină din nou prea ușor de atins (același bug ca la v1: un lineup abia colectat,
// nivel 1, ajungea aproape de pragul următor). Vezi v2 pentru logica de calibrare
// originală (1.3x/1.6x/1.9x peste suma de bază nivel 1 a fiecărei rarități).
const TIERS = [
            { name: 'Rare', base: 'Rare', min: 0, color: '#3498db' },
            { name: 'Rare+', base: 'Rare', min: 2800, color: '#3498db' },
            { name: 'Rare++', base: 'Rare', min: 3450, color: '#3498db' },
            { name: 'Super Rare', base: 'SuperRare', min: 3600, color: '#00bcd4' },
            { name: 'Super Rare+', base: 'SuperRare', min: 4400, color: '#00bcd4' },
            { name: 'Super Rare++', base: 'SuperRare', min: 5250, color: '#00bcd4' },
            { name: 'Ultra Rare', base: 'UltraRare', min: 5350, color: '#e040fb' },
            { name: 'Ultra Rare+', base: 'UltraRare', min: 6200, color: '#e040fb' },
            { name: 'Ultra Rare++', base: 'UltraRare', min: 7300, color: '#e040fb' },
            { name: 'Epic', base: 'Epic', min: 7900, color: '#9b59b6' },
            { name: 'Epic+', base: 'Epic', min: 9750, color: '#9b59b6' },
            { name: 'Epic++', base: 'Epic', min: 11550, color: '#9b59b6' },
            { name: 'Legendary', base: 'Legendary', min: 12500, color: '#f1c40f' },
            { name: 'Legendary+', base: 'Legendary', min: 15450, color: '#f1c40f' },
            { name: 'Legendary++', base: 'Legendary', min: 18350, color: '#f1c40f' },
            { name: 'Survivor', base: 'Survivor', min: 21550, color: '#e74c3c' },
            { name: 'Survivor+', base: 'Survivor', min: 26550, color: '#e74c3c' },
            { name: 'Survivor++', base: 'Survivor', min: 31550, color: '#e74c3c' }
        ];

        // Crește la fiecare update → hard reset automat la load
        const GAME_VERSION = '0.11.0';
        const SAVE_KEY = 'sc2014_save';

        const RARITIES = ['Common', 'Uncommon', 'Rare', 'SuperRare', 'UltraRare', 'Epic', 'Legendary', 'Survivor'];

        const UPGRADE = {
            BASE_MAX: 10,
            NORMAL_MAX: 15,
            PERFECT_MAX: 20,
            XP_BASE: 25,
            GROWTH: { base: 0.058, normal: 0.042, perfect: 0.072, perfectP2: 0.078 }
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
