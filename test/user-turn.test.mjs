// @ts-check
/**
 * DS Comments — fork: the user's post right before the reply joins the
 * current chapter as Part 1 (setting includeUserTurn, off by default).
 */
import '../test-helpers/stub-runtime.mjs';
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, getCtx, defaultSettings } from '../src/core.js';
import { _testGenerateFeed } from '../src/generator.js';
import { _resetFeedFileStore } from '../src/feed-file-store.js';

const validResponse = JSON.stringify([{ username: 'n', content: 'c', reactions: [] }]);
const user = (mes, extra = {}) => ({ mes, name: 'Hadrian', is_user: true, is_system: false, is_hidden: false, swipe_id: 0, swipes: [mes], ...extra });
const ai = (mes, extra = {}) => ({ mes, name: 'Veyne', is_user: false, is_system: false, is_hidden: false, swipe_id: 0, swipes: [mes], ...extra });

beforeEach(() => {
    Object.assign(state, {
        generationInProgress: false, generationOwner: null, abortController: null,
        generationTarget: null, generationObservedTarget: null, pendingActivatedWorldInfo: null,
    });
    state.settings = {
        enabled: true, autoUpdate: true, noSaveMode: false,
        apiSource: 'custom', customEndpoint: 'http://x', customModel: 'm',
        promptTemplate: 'main', userCount: 20, includeChatHistory: true,
        contextDepth: 6, includePersona: false, includeCharacterDescription: false,
        enableJailbreakBlock: false, jailbreakRole: 'system', profileId: '', soundEnabled: false,
        promptTemplates: { main: 'Generate {{count}} comments.' },
        includeImages: 'off', includeUserTurn: true,
    };
    Object.assign(getCtx(), { chatId: 'chatA', chatMetadata: { dscomments_commentary: { posts: {}, current: { msgId: null, swipeIdx: 0 } } }, saveMetadata: () => {}, name1: 'Hadrian', name2: 'Veyne', substituteParams: t => t });
    globalThis._stFilesReset?.();
    _resetFeedFileStore();
});

async function promptFor(chat, anchor) {
    getCtx().chat = chat;
    let captured = null;
    await _testGenerateFeed(String(anchor), 0, true, async (_s, msgs) => { captured = msgs; return validResponse; });
    return captured.filter(m => typeof m === 'string').join('\n\n');
}

test('default is off', () => {
    assert.equal(defaultSettings.includeUserTurn, false);
});

test('on: the preceding user post becomes Part 1, out of [Previously]', async () => {
    const p = await promptFor([ai('old reply'), user('Адриан швыряет банку с мазью'), ai('Вейн ловит банку')], 2);
    assert.match(p, /\[Current chapter — two parts/);
    assert.match(p, /Part 1 — Hadrian:\nАдриан швыряет банку с мазью/);
    assert.match(p, /Part 2 — Veyne:\nВейн ловит банку/);
    assert.match(p, /about a third of the comments react to Part 1/);
    const previously = p.match(/\[Previously[\s\S]*?\]/)?.[0] ?? '';
    assert.match(previously, /old reply/);
    assert.doesNotMatch(previously, /швыряет/, 'the user post is not duplicated in [Previously]');
});

test('off: legacy single-part chapter', async () => {
    state.settings.includeUserTurn = false;
    const p = await promptFor([user('мой пост'), ai('ответ')], 1);
    assert.match(p, /\[Current chapter:\nVeyne: ответ\]/);
    assert.doesNotMatch(p, /Part 1/);
    assert.match(p, /\[Previously[\s\S]*мой пост/);
});

test('no pairing: previous is the AI, hidden, or system', async () => {
    for (const prev of [ai('другой ответ'), user('скрыт', { is_hidden: true }), user('sys', { is_system: true })]) {
        const p = await promptFor([user('давний пост'), prev, ai('ответ')], 2);
        assert.doesNotMatch(p, /Part 1/, `prev=${prev.mes}`);
        assert.match(p, /\[Current chapter:\nVeyne: ответ\]/);
    }
});

test('first message (nothing before) stays single-part', async () => {
    const p = await promptFor([ai('приветствие')], 0);
    assert.match(p, /\[Current chapter:\nVeyne: приветствие\]/);
});
