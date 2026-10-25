// @ts-check
/**
 * DS Comments — built-in vibe templates (fork addition).
 * Every chat-styles/*.md is registered as a built-in and every built-in has a
 * file; {{random::}} blocks are balanced so ST's macro engine sees them whole.
 */

import '../test-helpers/stub-runtime.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { isBuiltinTemplate } from '../src/ui/settings-sync.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stylesDir = path.join(root, 'chat-styles');
const EXPECTED = ['main', 'fandom-chaos', 'bl-feed', 'bl-omegaverse'];

test('every expected built-in has a template file and is registered', () => {
    for (const name of EXPECTED) {
        assert.ok(existsSync(path.join(stylesDir, `${name}.md`)), `${name}.md exists`);
        assert.ok(isBuiltinTemplate(name), `${name} is registered as built-in`);
    }
});

test('every chat-styles file is a registered built-in', () => {
    for (const file of readdirSync(stylesDir).filter(f => f.endsWith('.md'))) {
        assert.ok(isBuiltinTemplate(file.replace(/\.md$/, '')), `${file} registered`);
    }
});

test('random macros are balanced and non-empty', () => {
    for (const name of EXPECTED) {
        const text = readFileSync(path.join(stylesDir, `${name}.md`), 'utf8');
        const opens = (text.match(/\{\{random::/g) || []).length;
        const blocks = [...text.matchAll(/\{\{random::([^{}]*)\}\}/g)];
        assert.equal(blocks.length, opens, `${name}: every {{random:: closes without nested braces`);
        for (const [, body] of blocks) {
            const options = body.split('::');
            assert.ok(options.length >= 2, `${name}: random block has options`);
            assert.ok(options.every(o => o.trim().length > 0), `${name}: no empty option in "${body.slice(0, 40)}…"`);
        }
    }
});

test('a user template cannot shadow the new built-ins', () => {
    assert.ok(!isBuiltinTemplate('bl-feed_copy'));
    assert.ok(!isBuiltinTemplate('toString'));
});
