// @ts-check
/**
 * DS Comments — fork: response timeout (responseTimeoutSec).
 */
import '../test-helpers/stub-runtime.mjs';
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, getCtx, defaultSettings } from '../src/core.js';
import { _testGenerateFeed } from '../src/generator.js';
import { _resetFeedFileStore, getFeedSlot } from '../src/feed-file-store.js';

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const validResponse = JSON.stringify([{ username: 'n', content: 'c', reactions: [] }]);
const ai = (mes) => ({ mes, name: 'Veyne', is_user: false, is_system: false, is_hidden: false, swipe_id: 0, swipes: [mes] });

/** Fake API that never answers until its signal aborts. */
const hangingApi = (calls) => (_s, msgs, _p, signal) => new Promise((_resolve, reject) => {
    calls.push(Array.isArray(msgs.at(-1)) ? 'image' : 'text');
    signal?.addEventListener('abort', () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError')), { once: true });
});

beforeEach(() => {
    Object.assign(state, {
        generationInProgress: false, generationOwner: null, abortController: null,
        generationTarget: null, generationObservedTarget: null, pendingActivatedWorldInfo: null,
    });
    state.settings = {
        enabled: true, autoUpdate: true, noSaveMode: false,
        apiSource: 'custom', customEndpoint: 'http://x', customModel: 'm',
        promptTemplate: 'main', userCount: 3, includeChatHistory: true, contextDepth: 4,
        includePersona: false, includeCharacterDescription: false,
        enableJailbreakBlock: false, jailbreakRole: 'system', profileId: '', soundEnabled: false,
        promptTemplates: { main: 'Generate {{count}} comments.' },
        includeImages: 'off', responseTimeoutSec: 0.05,
    };
    Object.assign(getCtx(), { chatId: 'chatA', chat: [ai('пост')], chatMetadata: { dscomments_commentary: { posts: {}, current: { msgId: null, swipeIdx: 0 } } }, saveMetadata: () => {}, name1: 'U', name2: 'Veyne', substituteParams: t => t });
    globalThis._stFilesReset?.();
    _resetFeedFileStore();
});

test('default timeout is 180 s', () => {
    assert.equal(defaultSettings.responseTimeoutSec, 180);
});

test('a silent model is cut off; nothing is stored', async () => {
    const calls = [];
    await _testGenerateFeed('0', 0, true, hangingApi(calls));
    assert.deepEqual(calls, ['text']);
    assert.equal(getFeedSlot('0', 0), null, 'no feed stored after a timeout');
    assert.equal(state.generationInProgress, false, 'generation released');
});

test('a timed-out image attempt is NOT retried text-only', async () => {
    getCtx().chat = [ai(`пост <img src="${TINY_PNG}">`)];
    state.settings.includeImages = 'always';
    const calls = [];
    await _testGenerateFeed('0', 0, true, hangingApi(calls));
    assert.deepEqual(calls, ['image']);
});

test('timeout 0 waits as long as the model needs', async () => {
    state.settings.responseTimeoutSec = 0;
    await _testGenerateFeed('0', 0, true, () => new Promise(r => setTimeout(() => r(validResponse), 80)));
    assert.ok(getFeedSlot('0', 0), 'slow answer still stored');
});
