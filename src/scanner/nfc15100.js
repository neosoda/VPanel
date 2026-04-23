/**
 * Vpanel Scanner — Moteur de validation NF C 15-100 (édition 2010 + amendements)
 */

export const VALID_RATINGS = [6, 10, 16, 20, 25, 32, 40, 50, 63];

const CIRCUIT_KEYWORDS = {
    lighting:       ['lumière', 'lumiere', 'éclairage', 'eclairage', 'plafonnier', 'spot', 'led', 'applique', 'lustre', 'halo'],
    socket_10a:     ['prise 10', 'prises 10'],
    socket_16a:     ['prise', 'prises', 'pc ', 'courant'],
    kitchen:        ['cuisine', 'cuisinière', 'cuisinier'],
    hob:            ['plaque', 'induction', 'vitrocéramique', 'vitroceramique', 'gazinière', 'gaziniere'],
    oven:           ['four'],
    washer:         ['lave-linge', 'lave linge', 'machine à laver', 'machine laver', 'lavante'],
    dishwasher:     ['lave-vaisselle', 'lave vaisselle'],
    dryer:          ['sèche-linge', 'seche-linge', 'sèche linge'],
    water_heater:   ['chauffe-eau', 'cumulus', 'ballon', 'chauffe eau', 'thermoplongeur'],
    heating:        ['chauffage', 'radiateur', 'convecteur', 'sèche-serviette', 'seche serviette'],
    ac:             ['clim', 'climatisation', 'climatiseur', 'pompe à chaleur', 'pac'],
    ev_charger:     ['voiture', 'borne', 'irve', 'véhicule'],
    garage:         ['garage'],
    outdoor:        ['jardin', 'extérieur', 'exterieur', 'terrasse', 'piscine', 'pool'],
    portal:         ['portail', 'portillon', 'digicode'],
    shutters:       ['volet', 'store', 'roulant'],
    solar:          ['solaire', 'photovoltaïque', 'photovoltaique', 'onduleur'],
    vmc:            ['vmc', 'ventilation', 'ventilat'],
    it:             ['informatique', 'réseau', 'reseau', 'internet', 'nas', 'routeur'],
};

const RULES = {
    lighting:       { expected: [10, 16], min: 10, max: 16, wire: 1.5, maxLoad: 8, differential: 30, diffType: 'AC' },
    socket_10a:     { expected: [16],     min: 10, max: 16, wire: 1.5, maxLoad: 8, differential: 30, diffType: 'AC' },
    socket_16a:     { expected: [16, 20], min: 16, max: 20, wire: 2.5, maxLoad: 8, differential: 30, diffType: 'A' },
    kitchen:        { expected: [20],     min: 16, max: 20, wire: 2.5, maxLoad: 6, dedicated: true, differential: 30, diffType: 'A' },
    hob:            { expected: [20, 32], min: 20, max: 32, wire: 6.0, dedicated: true, differential: 30, diffType: 'A' },
    oven:           { expected: [20, 32], min: 16, max: 32, wire: 2.5, dedicated: true, differential: 30, diffType: 'A' },
    washer:         { expected: [16, 20], min: 16, max: 20, wire: 2.5, dedicated: true, differential: 30, diffType: 'A' },
    dishwasher:     { expected: [16, 20], min: 16, max: 20, wire: 2.5, dedicated: true, differential: 30, diffType: 'A' },
    dryer:          { expected: [16, 20], min: 16, max: 20, wire: 2.5, dedicated: true, differential: 30, diffType: 'A' },
    water_heater:   { expected: [16, 20], min: 16, max: 20, wire: 2.5, dedicated: true, differential: 30, diffType: 'A' },
    heating:        { expected: [16, 20, 32], min: 16, max: 32, wire: 2.5, dedicated: false, differential: 30, diffType: 'A' },
    ac:             { expected: [16, 20, 25], min: 16, max: 25, wire: 2.5, dedicated: true, differential: 30, diffType: 'A' },
    ev_charger:     { expected: [16, 20, 32], min: 16, max: 32, wire: 2.5, dedicated: true, differential: 30, diffType: 'A' },
    outdoor:        { expected: [16, 20], min: 10, max: 20, wire: 1.5, differential: 30, diffType: 'AC' },
    default:        { expected: [16, 20], min: 10, max: 32, wire: 2.5, differential: 30, diffType: 'A' },
};

function detectCircuitType(label = '', zone = '') {
    const text = (label + ' ' + zone).toLowerCase();
    for (const [type, keywords] of Object.entries(CIRCUIT_KEYWORDS)) {
        if (keywords.some(kw => text.includes(kw))) return type;
    }
    return 'default';
}

export function validateModule(mod) {
    const messages = [];
    let status = 'ok';

    // Unknown type
    if (mod.type === 'unknown') {
        return { status: 'warning', messages: ['Module non identifié — vérification manuelle requise'] };
    }
    if (mod.type === 'empty' || mod.type === 'bus') {
        return { status: 'ok', messages: [] };
    }
    if (mod.type === 'main') {
        if (mod.rating && mod.rating < 16) {
            messages.push('Disjoncteur de branchement : calibre semble faible (min. 16A)');
            status = 'warning';
        }
        return { status, messages };
    }

    // Validate rating
    if (mod.rating !== null && mod.rating !== undefined) {
        if (!VALID_RATINGS.includes(mod.rating)) {
            messages.push(`Calibre ${mod.rating}A non standard NF C 15-100 (valeurs admises : ${VALID_RATINGS.join(', ')}A)`);
            status = 'error';
        }
    } else {
        messages.push('Calibre non détecté — vérification OCR recommandée');
        status = 'warning';
    }

    // Validate against circuit type if labeled
    if (mod.label) {
        const circuitType = detectCircuitType(mod.label, mod.zone);
        const rule = RULES[circuitType] || RULES.default;

        if (mod.rating !== null && mod.rating !== undefined) {
            if (mod.rating > rule.max) {
                messages.push(`${mod.label} : calibre ${mod.rating}A trop élevé (max recommandé NF C 15-100 : ${rule.max}A)`);
                status = 'error';
            } else if (mod.rating < rule.min) {
                messages.push(`${mod.label} : calibre ${mod.rating}A faible pour ce circuit (min recommandé : ${rule.min}A)`);
                status = 'warning';
            } else if (!rule.expected.includes(mod.rating)) {
                messages.push(`${mod.label} : calibre ${mod.rating}A inhabituel — attendu ${rule.expected.join(' ou ')}A`);
                if (status === 'ok') status = 'warning';
            }

            // Wire section recommendation
            messages.push(`Section câble recommandée : ${rule.wire}mm²`);
        }
    }

    return { status, messages };
}

export function validatePanel(panel) {
    const allModules = panel.rows.flatMap(r => r.modules);
    const warnings = [];

    // Must have a main disconnect
    const hasMain = allModules.some(m => m.type === 'main');
    if (!hasMain) warnings.push('Aucun disjoncteur de branchement détecté');

    // Must have at least one differential
    const hasDiff = allModules.some(m => m.type === 'differential' || m.type === 'rcd');
    if (!hasDiff) warnings.push('Aucun dispositif différentiel 30mA détecté — obligatoire NF C 15-100 art. 771');

    return warnings;
}

export function getRecommendedIcon(label = '', zone = '') {
    const circuitType = detectCircuitType(label, zone);
    const iconMap = {
        lighting:     'swb_ecl.svg',
        socket_10a:   'swb_pc.svg',
        socket_16a:   'swb_pc.svg',
        kitchen:      'swb_pc2.svg',
        hob:          'swb_induction.svg',
        oven:         'swb_four.svg',
        washer:       'swb_lv.svg',
        dishwasher:   'swb_ll.svg',
        dryer:        'swb_twldryer.svg',
        water_heater: 'swb_eau.svg',
        heating:      'swb_chauffage.svg',
        ac:           'swb_clim.svg',
        ev_charger:   'swb_voitureelectrique.svg',
        garage:       'swb_garage.svg',
        outdoor:      'swb_eclext.svg',
        portal:       'swb_portail.svg',
        shutters:     'swb_volet.svg',
        solar:        'swb_solaire.svg',
        vmc:          'swb_vmc.svg',
        it:           'swb_informatique.svg',
        default:      'swb_pc.svg',
    };
    return iconMap[circuitType] || '';
}
