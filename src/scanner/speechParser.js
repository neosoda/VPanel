/**
 * Vpanel Scanner — Parseur de commandes vocales (local, sans API)
 * Langue : français
 */

const FRENCH_NUMBERS = {
    'zéro': 0, 'zero': 0, 'un': 1, 'une': 1, 'deux': 2, 'trois': 3,
    'quatre': 4, 'cinq': 5, 'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9,
    'dix': 10, 'onze': 11, 'douze': 12, 'treize': 13, 'quatorze': 14,
    'quinze': 15, 'seize': 16, 'dix-sept': 17, 'dix-huit': 18, 'dix-neuf': 19,
    'vingt': 20, 'vingt-cinq': 25, 'vingt cinq': 25,
    'trente': 30, 'trente-deux': 32, 'trente deux': 32,
    'quarante': 40, 'quarante-cinq': 45, 'quarante cinq': 45,
    'cinquante': 50, 'soixante': 60, 'soixante-trois': 63, 'soixante trois': 63,
};

const COMMAND_PATTERNS = {
    next:     ['suivant', 'next', 'suite', 'continuer', 'après', 'apres', 'valider', 'ok ok'],
    previous: ['précédent', 'precedent', 'retour', 'arrière', 'arriere', 'back', 'revenir'],
    done:     ['terminer', 'terminé', 'termine', 'finir', 'fini', 'fin', 'done', "j'ai fini", 'clôturer', 'cloturer'],
};

export const ICON_KEYWORDS = {
    'eclairage':     'swb_ecl.svg',
    'lumière':       'swb_ecl.svg',
    'lumiere':       'swb_ecl.svg',
    'plafonnier':    'swb_ecl.svg',
    'spot':          'swb_ecl.svg',
    'led':           'swb_ecl.svg',
    'extérieur':     'swb_eclext.svg',
    'exterieur':     'swb_eclext.svg',
    'jardin':        'swb_eclext.svg',
    'terrasse':      'swb_eclext.svg',
    'prise':         'swb_pc.svg',
    'prises':        'swb_pc.svg',
    'courant':       'swb_pc.svg',
    'four':          'swb_four.svg',
    'plaque':        'swb_induction.svg',
    'induction':     'swb_induction.svg',
    'vitro':         'swb_induction.svg',
    'frigo':         'swb_frigo.svg',
    'réfrigérateur': 'swb_frigo.svg',
    'refrigerateur': 'swb_frigo.svg',
    'micro-onde':    'swb_microonde.svg',
    'micro onde':    'swb_microonde.svg',
    'micro':         'swb_microonde.svg',
    'lave-linge':    'swb_lv.svg',
    'lave linge':    'swb_lv.svg',
    'machine':       'swb_lv.svg',
    'sèche-linge':   'swb_twldryer.svg',
    'seche-linge':   'swb_twldryer.svg',
    'lave-vaisselle':'swb_ll.svg',
    'lave vaisselle':'swb_ll.svg',
    'chauffage':     'swb_chauffage.svg',
    'radiateur':     'swb_chauffage.svg',
    'convecteur':    'swb_chauffage.svg',
    'chauffe-eau':   'swb_eau.svg',
    'chauffe eau':   'swb_eau.svg',
    'ballon':        'swb_eau.svg',
    'cumulus':       'swb_eau.svg',
    'vmc':           'swb_vmc.svg',
    'ventilation':   'swb_vmc.svg',
    'clim':          'swb_clim.svg',
    'climatisation': 'swb_clim.svg',
    'garage':        'swb_garage.svg',
    'portail':       'swb_portail.svg',
    'volet':         'swb_volet.svg',
    'store':         'swb_store.svg',
    'piscine':       'swb_pool.svg',
    'voiture':       'swb_voitureelectrique.svg',
    'borne':         'swb_voitureelectrique.svg',
    'solaire':       'swb_solaire.svg',
    'panneaux':      'swb_solaire.svg',
    'informatique':  'swb_informatique.svg',
    'réseau':        'swb_informatique.svg',
    'reseau':        'swb_informatique.svg',
    'tv':            'swb_tv.svg',
    'télévision':    'swb_tv.svg',
    'television':    'swb_tv.svg',
    'musique':       'swb_music.svg',
    'alarme':        'swb_homeshield.svg',
    'sécurité':      'swb_homeshield.svg',
    'securite':      'swb_homeshield.svg',
};

const ZONE_KEYWORDS = [
    'salon', 'séjour', 'sejour', 'living',
    'cuisine', 'kitchenette',
    'chambre', 'bureau',
    'salle de bain', 'salle de bains', 'sdb', 'douche',
    'toilette', 'wc',
    'couloir', 'entrée', 'entree', 'hall',
    'garage', 'cave', 'sous-sol',
    'grenier', 'combles',
    'jardin', 'terrasse', 'extérieur', 'exterieur',
    'cellier', 'buanderie',
    'dressing',
];

function normalise(text) {
    return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function detectCommand(text) {
    const lower = text.toLowerCase().trim();
    for (const [cmd, patterns] of Object.entries(COMMAND_PATTERNS)) {
        if (patterns.some(p => lower === p || lower.startsWith(p + ' ') || lower.endsWith(' ' + p))) {
            return cmd;
        }
    }
    return null;
}

function extractRating(text) {
    // Numeric first
    const numMatch = text.match(/\b(\d{1,3})\s*(?:ampères?|amps?|a\b)/i);
    if (numMatch) {
        const v = parseInt(numMatch[1], 10);
        return [6, 10, 16, 20, 25, 32, 40, 50, 63].includes(v) ? v : null;
    }
    // French words
    const lower = text.toLowerCase();
    for (const [word, val] of Object.entries(FRENCH_NUMBERS)) {
        if (lower.includes(word + ' ampère') || lower.includes(word + ' amp') || lower.includes(word + ' a')) {
            return val;
        }
    }
    // Standalone French number at end of phrase (often the calibre)
    const words = lower.split(/\s+/);
    for (let i = words.length - 1; i >= 0; i--) {
        if (FRENCH_NUMBERS[words[i]] !== undefined) {
            const v = FRENCH_NUMBERS[words[i]];
            if ([6, 10, 16, 20, 25, 32, 40, 50, 63].includes(v)) return v;
        }
    }
    return null;
}

function extractZone(text) {
    const lower = text.toLowerCase();
    for (const zone of ZONE_KEYWORDS) {
        if (lower.includes(zone)) {
            return zone.charAt(0).toUpperCase() + zone.slice(1);
        }
    }
    return null;
}

function extractIcon(text) {
    const lower = text.toLowerCase();
    for (const [kw, file] of Object.entries(ICON_KEYWORDS)) {
        if (lower.includes(kw)) return file;
    }
    return null;
}

function cleanLabel(text, rating) {
    let label = text;
    // Remove rating mentions
    label = label.replace(/\b\d{1,3}\s*(?:ampères?|amps?|a)\b/gi, '');
    for (const word of Object.keys(FRENCH_NUMBERS)) {
        const re = new RegExp(`\\b${word}\\s*(?:ampères?|amps?|a)?\\b`, 'gi');
        label = label.replace(re, '');
    }
    return label.trim().replace(/\s+/g, ' ');
}

/**
 * Parse a voice transcript locally (no API call).
 * Returns: { label, zone, rating, iconFilename, command }
 */
export function parseSpeechLocal(transcript) {
    const text = transcript.trim();

    const command = detectCommand(text);
    if (command) return { label: null, zone: null, rating: null, iconFilename: null, command };

    const rating = extractRating(text);
    const zone = extractZone(text);
    const iconFilename = extractIcon(text);
    const label = cleanLabel(text, rating);

    return { label: label || null, zone, rating, iconFilename, command: null };
}
