// @ts-check
/**
 * DS Comments — color scheme tests (fork addition).
 * Pure palette resolution + settings.html / defaults contract.
 */

import '../test-helpers/stub-runtime.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { COLOR_SCHEMES, DEFAULT_CUSTOM_COLOR, _testColorSchemes } from '../src/ui/color-schemes.js';
import { defaultSettings } from '../src/core.js';

const { resolveScheme, isKnownScheme, isHexColor } = _testColorSchemes;
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(path.join(root, 'settings.html'), 'utf8');

test('native and unknown schemes resolve to null (theme-sync derives from ST)', () => {
    assert.equal(resolveScheme('native', '#ffffff'), null);
    assert.equal(resolveScheme('nope', '#ffffff'), null);
    assert.equal(resolveScheme(undefined, undefined), null);
    assert.equal(resolveScheme('__proto__', undefined), null);
});

test('every fixed palette resolves to a full token set', () => {
    for (const id of Object.keys(COLOR_SCHEMES)) {
        if (id === 'native' || id === 'custom') continue;
        const t = resolveScheme(id, null);
        assert.ok(t, `${id} resolves`);
        for (const key of ['accent', 'bg', 'overlay', 'text', 'border']) {
            assert.equal(typeof t[key], 'string', `${id}.${key}`);
            assert.ok(t[key].length > 0, `${id}.${key} not empty`);
        }
        // Window background must be opaque (the comments window is never glass).
        assert.match(t.bg, /^#[0-9a-f]{6}$/i, `${id}.bg is an opaque hex`);
        assert.match(t.overlay, /^#[0-9a-f]{6}$/i, `${id}.overlay is an opaque hex`);
    }
});

test('custom scheme derives from the picked color and falls back on garbage', () => {
    const t = resolveScheme('custom', '#c97a86');
    assert.equal(t.accent, '#c97a86');
    assert.match(t.bg, /#c97a86/);
    assert.match(t.border, /#c97a86/);
    assert.equal(resolveScheme('custom', 'red; background:url(x)').accent, DEFAULT_CUSTOM_COLOR);
});

test('validators', () => {
    assert.ok(isKnownScheme('wine'));
    assert.ok(!isKnownScheme('toString'));
    assert.ok(isHexColor('#A98BD6'));
    assert.ok(!isHexColor('#abc'));
    assert.ok(!isHexColor('rgb(1,2,3)'));
});

test('defaults keep the original look', () => {
    assert.equal(defaultSettings.colorScheme, 'native');
    assert.equal(defaultSettings.customColor, DEFAULT_CUSTOM_COLOR);
});

test('settings.html offers exactly the defined schemes plus the custom picker', () => {
    const select = html.match(/<select id="dsc_color_scheme"[^>]*>([\s\S]*?)<\/select>/);
    assert.ok(select, 'scheme select present');
    const values = [...select[1].matchAll(/value="([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(values, Object.keys(COLOR_SCHEMES));
    assert.ok(html.includes('id="dsc_custom_color_group"'));
    assert.match(html, /<input type="color" id="dsc_custom_color"/);
});
