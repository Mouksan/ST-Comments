// @ts-check
/**
 * DS Comments — fork additions around post images:
 *   - placeholder filter + display_text scanning (images.js)
 *   - waiting for the image extension (image-wait.js)
 *   - text-only retry when the image attempt fails (generator.js)
 *   - quick-menu images toggle with mode memory (quickmenu.js)
 */
import '../test-helpers/stub-runtime.mjs';
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, getCtx } from '../src/core.js';
import { isUsableImageSrc, hasPendingPostImages, planPostImages, postImageSources } from '../src/images.js';
import { waitForPostImages, skipImageWait, isWaitingForImages } from '../src/image-wait.js';
import { _testGenerateFeed } from '../src/generator.js';
import { _resetFeedFileStore } from '../src/feed-file-store.js';
import { setImagesEnabled } from '../src/ui/quickmenu.js';

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PENDING_TAG = `<img data-iig-instruction='{"prompt":"hare prince by the window"}' src="[IMG:GEN]">`;
const ERROR_TAG = `<img data-iig-instruction='{"prompt":"x"}' src="/scripts/extensions/third-party/frameweaver/error.svg">`;
const doneTag = (src) => `<img data-iig-instruction='{"prompt":"hare prince by the window"}' src="${src}">`;
const aiMsg = (mes, extra) => ({ mes, is_user: false, is_system: false, is_hidden: false, swipe_id: 0, swipes: [mes], extra });
const validResponse = JSON.stringify([{ username: 'n', content: 'c', reactions: [] }]);
const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));

// The ST host is a browser: window events live on globalThis. Node has no
// global EventTarget surface, so install one per test.
let bus;
beforeEach(() => {
    bus = new EventTarget();
    globalThis.addEventListener = bus.addEventListener.bind(bus);
    globalThis.removeEventListener = bus.removeEventListener.bind(bus);
    globalThis.dispatchEvent = bus.dispatchEvent.bind(bus);
    delete globalThis.IIG;
    Object.assign(state, {
        settings: {},
        generationInProgress: false, generationOwner: null, abortController: null,
        generationTarget: null, generationObservedTarget: null,
        pendingActivatedWorldInfo: null,
    });
    const ctx = getCtx();
    Object.assign(ctx, { chatId: 'chatA', chat: [], chatMetadata: {}, saveMetadata: () => {}, name1: 'User', name2: 'Char', substituteParams: t => t });
    globalThis._stFilesReset?.();
    _resetFeedFileStore();
});
afterEach(() => {
    skipImageWait();
    delete globalThis.addEventListener;
    delete globalThis.removeEventListener;
    delete globalThis.dispatchEvent;
    delete globalThis.IIG;
});
const fire = (type) => globalThis.dispatchEvent(new Event(type));

function setupGeneration(mes, extra) {
    state.settings = {
        enabled: true, autoUpdate: true, noSaveMode: false,
        apiSource: 'custom', customEndpoint: 'http://x', customModel: 'argon',
        promptTemplate: 'main', userCount: 3, includeChatHistory: false,
        contextDepth: 4, includePersona: false, includeCharacterDescription: false,
        enableJailbreakBlock: false, jailbreakRole: 'system',
        profileId: '', soundEnabled: false,
        promptTemplates: { main: 'Generate {{count}} comments.' },
        includeImages: 'always',
    };
    getCtx().chat = [aiMsg(mes, extra)];
    getCtx().chatMetadata = { dscomments_commentary: { posts: {}, current: { msgId: null, swipeIdx: 0 } } };
}

// ── filter + sources ──

test('isUsableImageSrc: rejects Frameweaver placeholders, error icons and svg', () => {
    assert.equal(isUsableImageSrc('[IMG:GEN]'), false);
    assert.equal(isUsableImageSrc('/scripts/extensions/third-party/frameweaver/error.svg'), false);
    assert.equal(isUsableImageSrc('/x/icon.svg?v=2'), false);
    assert.equal(isUsableImageSrc('data:image/svg+xml;base64,AAAA'), false);
    assert.equal(isUsableImageSrc('data:image/png;base64,AA'), false);
    assert.equal(isUsableImageSrc(''), false);
    assert.equal(isUsableImageSrc('/user/images/Veyne/iig_1.png'), true);
    assert.equal(isUsableImageSrc(TINY_PNG), true);
});

test('planPostImages: placeholders and error icons never reach the plan', () => {
    const msg = aiMsg(`text ${PENDING_TAG} more ${ERROR_TAG}`);
    const plan = planPostImages(msg, 0, { includeImages: 'always', apiSource: 'custom' }, null);
    assert.equal(plan.images.length, 0);
    assert.equal(plan.hash, '');
});

test('planPostImages: reads display_text (Frameweaver prompt-model mode)', () => {
    const msg = aiMsg('story text only', { display_text: `story text only ${doneTag('/user/images/a.png')}` });
    const plan = planPostImages(msg, 0, { includeImages: 'always', apiSource: 'custom' }, null);
    assert.deepEqual(plan.images.map(i => i.url), ['/user/images/a.png']);
});

test('postImageSources: swipe-level display_text wins for that swipe', () => {
    const msg = { mes: 'b', swipe_id: 1, swipes: ['a', 'b'], swipe_info: [{ extra: { display_text: 'A-display' } }, {}], extra: { display_text: 'B-display' } };
    assert.deepEqual(postImageSources(msg, 0), ['a', 'A-display']);
    assert.deepEqual(postImageSources(msg, 1), ['b', 'B-display']);
});

test('hasPendingPostImages: canonical and legacy markers, text and display_text', () => {
    assert.equal(hasPendingPostImages(aiMsg(`x ${PENDING_TAG}`), 0), true);
    assert.equal(hasPendingPostImages(aiMsg('x [IMG:GEN:{"prompt":"p"}]'), 0), true);
    assert.equal(hasPendingPostImages(aiMsg('x', { display_text: `x ${PENDING_TAG}` }), 0), true);
    assert.equal(hasPendingPostImages(aiMsg(`x ${doneTag('/user/images/a.png')}`), 0), false);
    assert.equal(hasPendingPostImages(aiMsg(`x ${ERROR_TAG}`), 0), false);
});

// ── waitForPostImages ──

test('wait: nothing pending resolves "none" without waiting', async () => {
    getCtx().chat = [aiMsg('plain post')];
    assert.equal(await waitForPostImages({ messageId: '0', swipeIdx: 0 }), 'none');
});

test('wait: resolves "ready" on iig:message-done once the tag is filled in', async () => {
    getCtx().chat = [aiMsg(`post ${PENDING_TAG}`)];
    let started = false;
    const p = waitForPostImages({ messageId: '0', swipeIdx: 0, onWaitStart: () => { started = true; } });
    await tick(5);
    assert.equal(started, true);
    assert.equal(isWaitingForImages(), true);
    fire('iig:message-done');                       // still pending → keeps waiting
    await tick(5);
    const msg = getCtx().chat[0];
    msg.mes = msg.swipes[0] = `post ${doneTag('/user/images/a.png')}`;
    fire('iig:message-done');
    assert.equal(await p, 'ready');
    assert.equal(isWaitingForImages(), false);
});

test('wait: honours window.IIG.isBusy even before a tag exists', async () => {
    getCtx().chat = [aiMsg('post, sidecar still writing the image tag')];
    let busy = true;
    globalThis.IIG = { isBusy: (id) => id === 0 && busy };
    const p = waitForPostImages({ messageId: '0', swipeIdx: 0 });
    await tick(5);
    busy = false;
    fire('iig:message-done');
    assert.equal(await p, 'ready');
});

test('wait: old Frameweaver — image-saved triggers delayed re-checks', async () => {
    getCtx().chat = [aiMsg(`post ${PENDING_TAG}`)];
    const p = waitForPostImages({ messageId: '0', swipeIdx: 0 });
    await tick(5);
    fire('iig:image-saved');                        // saved, not yet committed
    const msg = getCtx().chat[0];
    msg.mes = msg.swipes[0] = `post ${doneTag('/user/images/a.png')}`;   // commit lands later
    assert.equal(await p, 'ready');
});

test('wait: "Don\'t wait" resolves skipped; timeout resolves timeout', async () => {
    getCtx().chat = [aiMsg(`post ${PENDING_TAG}`)];
    const p = waitForPostImages({ messageId: '0', swipeIdx: 0 });
    await tick(5);
    skipImageWait();
    assert.equal(await p, 'skipped');
    assert.equal(await waitForPostImages({ messageId: '0', swipeIdx: 0, timeoutMs: 20 }), 'timeout');
});

test('wait: abort rejects with AbortError and cleans up', async () => {
    getCtx().chat = [aiMsg(`post ${PENDING_TAG}`)];
    const ctrl = new AbortController();
    const p = waitForPostImages({ messageId: '0', swipeIdx: 0, signal: ctrl.signal });
    await tick(5);
    ctrl.abort();
    await assert.rejects(p, e => e.name === 'AbortError');
    assert.equal(isWaitingForImages(), false);
});

// ── generator integration ──

test('generateFeed: waits for the pending image, then attaches the finished one', async () => {
    setupGeneration(`post ${PENDING_TAG}`);
    let captured = null;
    const run = _testGenerateFeed('0', 0, true, async (_sys, userMsgs) => { captured = userMsgs; return validResponse; });
    await tick(10);
    assert.equal(captured, null, 'no API call while the picture is still being drawn');
    const msg = getCtx().chat[0];
    msg.mes = msg.swipes[0] = `post ${doneTag(TINY_PNG)}`;
    fire('iig:message-done');
    await run;
    const last = captured.at(-1);
    assert.ok(Array.isArray(last), 'finished image is attached');
    assert.match(last[0].text, /illustrated by 1 attached image/);
    assert.doesNotMatch(last[0].text, /MORE art/);
    assert.match(last[0].text, /never by file names/);
});

test('generateFeed: images off → no waiting even with a pending tag', async () => {
    setupGeneration(`post ${PENDING_TAG}`);
    state.settings.includeImages = 'off';
    let called = false;
    await _testGenerateFeed('0', 0, true, async () => { called = true; return validResponse; });
    assert.equal(called, true);
});

test('generateFeed: image attempt failing retries once text-only and stores the feed', async () => {
    setupGeneration(`post ${doneTag(TINY_PNG)}`);
    const toasts = [];
    globalThis.toastr = { ...(globalThis.toastr || {}), warning: (m) => toasts.push(m) };
    const calls = [];
    await _testGenerateFeed('0', 0, true, async (_sys, userMsgs) => {
        const withImage = Array.isArray(userMsgs.at(-1));
        calls.push(withImage);
        if (withImage) throw new Error('PROHIBITED_CONTENT');
        return validResponse;
    });
    assert.deepEqual(calls, [true, false]);
    assert.equal(toasts.length, 1);
    assert.ok(getCtx().chatMetadata, 'generation finished');
});

test('generateFeed: zero parsed comments with an image also falls back', async () => {
    setupGeneration(`post ${doneTag(TINY_PNG)}`);
    globalThis.toastr = { ...(globalThis.toastr || {}), warning: () => {} };
    const calls = [];
    await _testGenerateFeed('0', 0, true, async (_sys, userMsgs) => {
        const withImage = Array.isArray(userMsgs.at(-1));
        calls.push(withImage);
        return withImage ? '[]' : validResponse;
    });
    assert.deepEqual(calls, [true, false]);
});

test('generateFeed: text-only failure is not retried', async () => {
    setupGeneration('plain post');
    let n = 0;
    await _testGenerateFeed('0', 0, true, async () => { n++; throw new Error('boom'); });
    assert.equal(n, 1);
});

// ── quick menu toggle ──

test('setImagesEnabled: off remembers auto/always, on restores it', () => {
    state.settings = { includeImages: 'auto', imagesResumeMode: 'always' };
    setImagesEnabled(false);
    assert.equal(state.settings.includeImages, 'off');
    assert.equal(state.settings.imagesResumeMode, 'auto');
    setImagesEnabled(true);
    assert.equal(state.settings.includeImages, 'auto');
    state.settings = { includeImages: 'off' };
    setImagesEnabled(true);
    assert.equal(state.settings.includeImages, 'always', 'default resume mode is always');
});
