// @ts-check
/**
 * DS Comments — chat-presence visibility (fork patch).
 *
 * The panel and its launchers exist only inside a chat. Visibility is derived
 * live from ST's current chat id, so it is correct from the first mount of the
 * session (ST starting on the landing page) and never rewrites the user's own
 * `collapsed` flag.
 */

import { resetCtx } from '../test-helpers/stub-runtime.mjs';
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../src/core.js';
import { hasOpenChat, isPanelVisible } from '../src/ui/window.js';

beforeEach(() => {
    resetCtx();
    state.settings.enabled = true;
    state.settings.collapsed = false;
});

test('landing page (getCurrentChatId empty): panel hidden even when expanded', () => {
    globalThis._stCtx.getCurrentChatId = () => undefined;
    assert.equal(hasOpenChat(), false);
    assert.equal(isPanelVisible(), false);
    assert.equal(state.settings.collapsed, false, 'collapsed flag must not be touched');
});

test('inside a chat: panel visible when expanded', () => {
    globalThis._stCtx.getCurrentChatId = () => 'Alice - 2026-09-30';
    assert.equal(hasOpenChat(), true);
    assert.equal(isPanelVisible(), true);
});

test('inside a chat: user collapse still wins', () => {
    globalThis._stCtx.getCurrentChatId = () => 'Alice - 2026-09-30';
    state.settings.collapsed = true;
    assert.equal(isPanelVisible(), false);
});

test('falls back to ctx.chatId when getCurrentChatId is absent', () => {
    globalThis._stCtx.chatId = undefined;
    assert.equal(hasOpenChat(), false);
    globalThis._stCtx.chatId = 'chat1';
    assert.equal(hasOpenChat(), true);
});

test('host without chat identity (stub) counts as chat open', () => {
    assert.equal(hasOpenChat(), true);
});

test('disabled extension: never visible', () => {
    globalThis._stCtx.getCurrentChatId = () => 'chat1';
    state.settings.enabled = false;
    assert.equal(isPanelVisible(), false);
});
