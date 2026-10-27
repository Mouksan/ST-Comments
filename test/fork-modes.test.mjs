// @ts-check
/**
 * DS Comments — fork: user-post modes exclude each other; quick-menu media
 * toggle remembers what was on.
 */
import '../test-helpers/stub-runtime.mjs';
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../src/core.js';
import { setUserPostMode } from '../src/ui/settings-sync.js';
import { setMediaEnabled, isMediaEnabled } from '../src/ui/quickmenu.js';

let toasts;
beforeEach(() => {
    toasts = [];
    globalThis.toastr = { ...(globalThis.toastr || {}), info: (m) => toasts.push(m) };
    state.settings = { includeUserTurn: false, commentUserPosts: false, mediaProvider: 'off', mediaMemes: false };
});

test('user-post modes: turning one on switches the other off with a notice', () => {
    setUserPostMode('turn', true);
    assert.equal(state.settings.includeUserTurn, true);
    assert.equal(toasts.length, 0, 'nothing to switch off yet');

    assert.equal(setUserPostMode('feeds', true), 'turn');
    assert.equal(state.settings.commentUserPosts, true);
    assert.equal(state.settings.includeUserTurn, false);
    assert.equal(toasts.length, 1);

    assert.equal(setUserPostMode('turn', true), 'feeds');
    assert.equal(state.settings.commentUserPosts, false);
    assert.equal(state.settings.includeUserTurn, true);
});

test('user-post modes: turning one off never touches the other', () => {
    state.settings.commentUserPosts = true;
    assert.equal(setUserPostMode('turn', false), null);
    assert.equal(state.settings.commentUserPosts, true);
});

test('media toggle: first on enables Giphy + memes; off/on restores the exact mix', () => {
    setMediaEnabled(true);
    assert.equal(state.settings.mediaProvider, 'giphy');
    assert.equal(state.settings.mediaMemes, true);
    assert.equal(isMediaEnabled(), true);

    state.settings.mediaProvider = 'off';            // user kept only memes in the drawer
    setMediaEnabled(false);
    assert.equal(isMediaEnabled(), false);
    setMediaEnabled(true);
    assert.equal(state.settings.mediaProvider, 'off');
    assert.equal(state.settings.mediaMemes, true);
});
