// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { stripModelCitations, cleanParsedComments } from '../src/text-cleanup.js';

test('stripModelCitations: removes cite marks in all shapes, keeps the text', () => {
    assert.equal(stripModelCitations('прям светится зеленым[cite: 2]. Вейн'), 'прям светится зеленым. Вейн');
    assert.equal(stripModelCitations('пресс [cite: 1, 2] незаконно'), 'пресс незаконно');
    assert.equal(stripModelCitations('[cite_start]чибики прелесть!!![cite: 2]'), 'чибики прелесть!!!');
    assert.equal(stripModelCitations('[cite:3]ок'), 'ок');
});

test('stripModelCitations: leaves normal brackets and non-strings alone', () => {
    assert.equal(stripModelCitations('[sticker] [citation needed]'), '[sticker] [citation needed]');
    assert.equal(stripModelCitations('без сносок'), 'без сносок');
    assert.equal(stripModelCitations(undefined), undefined);
});

test('cleanParsedComments: cleans content and reply quotes, keeps the rest', () => {
    const out = cleanParsedComments([
        { username: 'a[cite: 1]', content: 'x[cite: 1]', reactions: [{ emoji: '🔥', count: '3' }] },
        { username: 'b', content: 'y', replyTo: 'a', replyQuote: 'x[cite: 1]' },
    ]);
    assert.equal(out[0].content, 'x');
    assert.equal(out[0].username, 'a[cite: 1]', 'nicknames are not touched');
    assert.deepEqual(out[0].reactions, [{ emoji: '🔥', count: '3' }]);
    assert.equal(out[1].replyQuote, 'x');
    assert.equal(out[1].replyTo, 'a');
    assert.equal(cleanParsedComments(null), null);
});
