// @ts-check
/**
 * DS Comments — UI: Color schemes.
 *
 * Fixed palettes for the comments window, ported from Lifeweaver's appearance.js
 * (flat "legacy" mode only — no glass/opacity layers; the window is opaque by
 * design, see theme-sync.js).
 *
 *   native  — follows the SillyTavern theme (theme-sync.js derives the tokens).
 *   others  — independent: they override the ST theme so its colors can't leak
 *             through and break the palette.
 *   custom  — one user color; background and borders are derived from it.
 *
 * Kept in its own file so upstream DS Comments merges only touch a few lines in
 * theme-sync.js / settings.html.
 */

export const DEFAULT_CUSTOM_COLOR = '#a98bd6';

// Base surface the custom color is mixed into (same as Lifeweaver).
const CUSTOM_BASE = '#14151a';

/**
 * label/i18nKey: shown in the settings select and the Aa popover chips.
 * Every i18nKey is a quoted literal so the i18n tests can see it.
 * Colors: accent, bg (window), overlay (popovers/menus/FAB), text, border.
 */
export const COLOR_SCHEMES = {
    native: { id: 'native', label: 'SillyTavern',  i18nKey: 'dscomments.scheme.native' },
    ash: {
        id: 'ash', label: 'Ash', i18nKey: 'dscomments.scheme.ash',
        accent: '#9fa8b8', bg: '#16181d', overlay: '#121418',
        text: '#e6e8ec', border: 'rgba(159, 168, 184, 0.28)',
    },
    plum: {
        id: 'plum', label: 'Plum', i18nKey: 'dscomments.scheme.plum',
        accent: '#a98bd6', bg: '#1a1524', overlay: '#15111e',
        text: '#f0eaf8', border: 'rgba(169, 139, 214, 0.3)',
    },
    wine: {
        id: 'wine', label: 'Wine', i18nKey: 'dscomments.scheme.wine',
        accent: '#c97a86', bg: '#221317', overlay: '#1c0f13',
        text: '#f6e9eb', border: 'rgba(201, 122, 134, 0.3)',
    },
    frost: {
        id: 'frost', label: 'Frost', i18nKey: 'dscomments.scheme.frost',
        accent: '#8fb4cc', bg: '#161d24', overlay: '#12181e',
        text: '#e6edf3', border: 'rgba(143, 180, 204, 0.28)',
    },
    ink: {
        id: 'ink', label: 'Ink', i18nKey: 'dscomments.scheme.ink',
        accent: '#7f8fb0', bg: '#111319', overlay: '#0d0f14',
        text: '#dfe3ec', border: 'rgba(127, 143, 176, 0.26)',
    },
    custom: { id: 'custom', label: 'Custom color', i18nKey: 'dscomments.scheme.custom' },
};

/** @param {unknown} id */
export function isKnownScheme(id) {
    return typeof id === 'string' && Object.prototype.hasOwnProperty.call(COLOR_SCHEMES, id);
}

/** @param {unknown} c */
export function isHexColor(c) {
    return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
}

/**
 * Resolve a scheme id to concrete tokens.
 * Returns null for 'native' (and anything unknown) — the caller then derives
 * the tokens from the ST theme as before.
 *
 * @param {unknown} id
 * @param {unknown} customColor
 * @returns {{accent:string,bg:string,overlay:string,text:string,border:string}|null}
 */
export function resolveScheme(id, customColor) {
    if (id === 'custom') {
        const c = isHexColor(customColor) ? /** @type {string} */ (customColor) : DEFAULT_CUSTOM_COLOR;
        return {
            accent: c,
            bg: `color-mix(in srgb, ${c} 15%, ${CUSTOM_BASE})`,
            overlay: `color-mix(in srgb, ${c} 11%, #0f1014)`,
            text: '#eceef4',
            border: `color-mix(in srgb, ${c} 32%, rgba(255, 255, 255, 0.14))`,
        };
    }
    if (!isKnownScheme(id) || id === 'native') return null;
    const sc = COLOR_SCHEMES[/** @type {keyof typeof COLOR_SCHEMES} */ (id)];
    return { accent: sc.accent, bg: sc.bg, overlay: sc.overlay, text: sc.text, border: sc.border };
}

// Test-only exports (NODE_TEST guard — invisible in the ST browser host).
const _test = typeof process !== 'undefined' && process?.env?.NODE_TEST === '1'
    ? { resolveScheme, isKnownScheme, isHexColor }
    : undefined;
export { _test as _testColorSchemes };
