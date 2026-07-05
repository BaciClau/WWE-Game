const TIERS = [
            { name: 'Common', base: 'Common', min: 0, color: '#95a5a6' },
            { name: 'Uncommon', base: 'Uncommon', min: 1000, color: '#2ecc71' },
            { name: 'Rare', base: 'Rare', min: 2000, color: '#3498db' },
            { name: 'Rare+', base: 'Rare', min: 2800, color: '#3498db' },
            { name: 'Rare++', base: 'Rare', min: 3400, color: '#3498db' },
            { name: 'Super Rare', base: 'SuperRare', min: 4000, color: '#00bcd4' },
            { name: 'Super Rare+', base: 'SuperRare', min: 5000, color: '#00bcd4' },
            { name: 'Super Rare++', base: 'SuperRare', min: 6000, color: '#00bcd4' },
            { name: 'Ultra Rare', base: 'UltraRare', min: 7500, color: '#e040fb' },
            { name: 'Ultra Rare+', base: 'UltraRare', min: 8800, color: '#e040fb' },
            { name: 'Ultra Rare++', base: 'UltraRare', min: 10000, color: '#e040fb' },
            { name: 'Epic', base: 'Epic', min: 11500, color: '#9b59b6' },
            { name: 'Epic+', base: 'Epic', min: 13000, color: '#9b59b6' },
            { name: 'Epic++', base: 'Epic', min: 14500, color: '#9b59b6' },
            { name: 'Legendary', base: 'Legendary', min: 16500, color: '#f1c40f' },
            { name: 'Legendary+', base: 'Legendary', min: 18500, color: '#f1c40f' },
            { name: 'Legendary++', base: 'Legendary', min: 21000, color: '#f1c40f' },
            { name: 'Survivor', base: 'Survivor', min: 24000, color: '#e74c3c' },
            { name: 'Survivor+', base: 'Survivor', min: 27000, color: '#e74c3c' },
            { name: 'Survivor++', base: 'Survivor', min: 30000, color: '#e74c3c' }
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
