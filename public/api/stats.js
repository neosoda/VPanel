/**
 * Vpanel - Générateur d'étiquettes pour tableaux et armoires électriques
 * Copyright (C) 2024-2026 Neosoda
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

const _apiBase = () => import.meta.env.VITE_APP_API_URL;
const _mode    = () => import.meta.env.VITE_APP_MODE;

function _buildURL(filename, args = {}) {
    const base = _apiBase() + filename;
    const params = new URLSearchParams({ m: _mode(), ...args });
    return `${base}?${params.toString()}`;
}

/**
 * Fire-and-forget analytics beacon.
 * Prefers sendBeacon (guaranteed delivery on page-unload); falls back to fetch.
 * Silently swallows errors — analytics must never break the UX.
 */
function _send(filename, args = {}) {
    const url = _buildURL(filename, args);
    try {
        if (navigator.sendBeacon) {
            navigator.sendBeacon(url);
            return;
        }
        fetch(url, { method: 'GET', keepalive: true })
            .catch(() => { /* intentionally silent */ });
    } catch {
        /* intentionally silent */
    }
}

export function visit(struct = 'web') {
    _send('visit.php', { s: struct });
}

export function action(actionName, struct = 'app') {
    if (!actionName || typeof actionName !== 'string') return;
    _send('action.php', { s: struct, a: actionName });
}

export function choices(choiceName, keys = [], struct = 'app') {
    if (!choiceName || !Array.isArray(keys) || keys.length === 0) return;
    _send('choices.php', { s: struct, c: choiceName, k: keys.join('|') });
}
