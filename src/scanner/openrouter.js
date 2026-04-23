/**
 * Vpanel Scanner — OpenRouter API client
 * Vision model: nvidia/nemotron-nano-12b-v2-vl:free
 * Text models: fallback chain
 */

const VISION_MODEL = 'nvidia/nemotron-nano-12b-v2-vl:free';
const API_KEY = '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';
const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

const TEXT_MODELS = [
    'nvidia/nemotron-3-super-120b-a12b:free',
    'google/gemma-4-31b-it:free',
    'google/gemma-3-27b-it:free',
    'minimax/minimax-m2.5:free',
    'z-ai/glm-4.5-air:free',
    'openai/gpt-oss-20b:free',
    'nvidia/nemotron-3-nano-30b-a3b:free',
    'nvidia/nemotron-nano-9b-v2:free',
    'google/gemma-3-4b-it:free',
    'meta-llama/llama-3.2-3b-instruct:free',
];

const PANEL_PROMPT = `Tu es un expert en installations électriques résidentielles françaises (norme NF C 15-100).
Analyse cette image de tableau électrique et retourne UNIQUEMENT un objet JSON valide, sans texte avant ni après, sans markdown.

Détecte chaque rangée (rail DIN) de haut en bas, chaque module de gauche à droite.

Pour chaque module :
- type : "breaker" (disjoncteur), "differential" (disjoncteur différentiel 30mA/300mA), "rcd" (interrupteur différentiel seul), "main" (disjoncteur de branchement/compteur), "bus" (bornier/rail de terre), "empty" (emplacement vide), "unknown"
- rating : calibre entier en A (6,10,16,20,25,32,40,63) ou null
- poles : 1 (1P ou 1P+N), 2 (2P), 3 (3P), 4 (3P+N ou 4P) ou null
- width : largeur en modules DIN (1 par défaut, 2 pour double, 4 pour quadruple)
- brand : "Legrand","Schneider","Hager","ABB","Siemens" ou null
- confidence : 0.0 à 1.0

JSON attendu exactement :
{
  "brand": "Legrand",
  "rows": [
    {
      "rowIndex": 0,
      "modules": [
        {"position": 0, "type": "main", "rating": 32, "poles": 2, "width": 2, "brand": "Legrand", "confidence": 0.9}
      ]
    }
  ]
}`;

const VOICE_PARSE_PROMPT = (transcript, ctx) =>
    `Tu es un assistant pour électriciens. Contexte du module courant : ${JSON.stringify(ctx)}
L'électricien dit : "${transcript}"

Retourne UNIQUEMENT ce JSON, sans texte avant ni après, sans markdown :
{
  "label": "nom du circuit ou null",
  "zone": "pièce ou zone ou null",
  "rating": null ou entier (ampères),
  "iconKeyword": "mot-clé icône parmi : eclairage, prise, four, induction, frigo, lv, lave-vaisselle, chauffage, clim, vmc, eau, chauffe-eau, garage, portail, jardin, voiture, volet, store, solaire, informatique, tv, music ou null",
  "command": null ou "next" ou "previous" ou "done"
}

Règles :
- "suivant","next","suite" → command:"next"
- "précédent","retour","arrière" → command:"previous"
- "terminer","fin","finir","done","terminé","j'ai fini" → command:"done"
- Convertis chiffres en lettres : "dix"→10, "seize"→16, "vingt"→20, "vingt-cinq"→25, "trente-deux"→32, "quarante"→40
- zone : déduis depuis le label si possible (ex: "Prises salon" → zone:"Salon")`;

async function callModel(model, messages, maxTokens = 1024) {
    const resp = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://www.vpanel.fr',
            'X-Title': 'Vpanel Scanner',
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.1 }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
}

function extractJSON(raw) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Pas de JSON dans la réponse IA');
    return JSON.parse(match[0]);
}

export async function analyzePanel(imageBase64) {
    const messages = [{
        role: 'user',
        content: [
            { type: 'text', text: PANEL_PROMPT },
            { type: 'image_url', image_url: { url: imageBase64 } },
        ],
    }];
    const raw = await callModel(VISION_MODEL, messages, 2048);
    return extractJSON(raw);
}

export async function parseVoiceWithAI(transcript, moduleContext) {
    const prompt = VOICE_PARSE_PROMPT(transcript, moduleContext);
    for (const model of TEXT_MODELS) {
        try {
            const raw = await callModel(model, [{ role: 'user', content: prompt }], 512);
            return extractJSON(raw);
        } catch {
            continue;
        }
    }
    return null;
}
