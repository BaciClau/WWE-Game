// Praguri recalibrate: "Rare" e podeaua minimă (nu mai există rank sub asta), iar curba
// de dificultate e gândită să ceară în jur de nivel ~10 mediu pe top 6 carduri ca să atingi
// Survivor++ (nivelul de bază înainte de upgrade-uri rare) — nu nivel 1 (prea ușor), dar nici
// nivel 20 perfect pe fiecare carte (aproape imposibil, cum era înainte). Fiecare prag de bază
// e sub totalul maxim atingibil cu raritatea anterioară, deci nu există interval "blocat".
const TIERS = [
            { name: 'Rare', base: 'Rare', min: 0, color: '#3498db' },
            { name: 'Rare+', base: 'Rare', min: 700, color: '#3498db' },
            { name: 'Rare++', base: 'Rare', min: 1250, color: '#3498db' },
            { name: 'Super Rare', base: 'SuperRare', min: 1800, color: '#00bcd4' },
            { name: 'Super Rare+', base: 'SuperRare', min: 2700, color: '#00bcd4' },
            { name: 'Super Rare++', base: 'SuperRare', min: 3600, color: '#00bcd4' },
            { name: 'Ultra Rare', base: 'UltraRare', min: 4900, color: '#e040fb' },
            { name: 'Ultra Rare+', base: 'UltraRare', min: 6100, color: '#e040fb' },
            { name: 'Ultra Rare++', base: 'UltraRare', min: 7150, color: '#e040fb' },
            { name: 'Epic', base: 'Epic', min: 8500, color: '#9b59b6' },
            { name: 'Epic+', base: 'Epic', min: 9800, color: '#9b59b6' },
            { name: 'Epic++', base: 'Epic', min: 11150, color: '#9b59b6' },
            { name: 'Legendary', base: 'Legendary', min: 12950, color: '#f1c40f' },
            { name: 'Legendary+', base: 'Legendary', min: 14750, color: '#f1c40f' },
            { name: 'Legendary++', base: 'Legendary', min: 17000, color: '#f1c40f' },
            { name: 'Survivor', base: 'Survivor', min: 19650, color: '#e74c3c' },
            { name: 'Survivor+', base: 'Survivor', min: 22350, color: '#e74c3c' },
            { name: 'Survivor++', base: 'Survivor', min: 25000, color: '#e74c3c' }
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
