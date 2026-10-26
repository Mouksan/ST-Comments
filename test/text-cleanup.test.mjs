// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { stripModelCitations, cleanParsedComments, replaceFileReferences } from '../src/text-cleanup.js';

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

test('replaceFileReferences: "на/в file.jpg" becomes "на арте" with ordinals', () => {
    assert.equal(replaceFileReferences('какие ключицы на file.jpg'), 'какие ключицы на арте');
    assert.equal(replaceFileReferences('Кева на file_2.jpg просто богиня'), 'Кева на втором арте просто богиня');
    assert.equal(replaceFileReferences('ору с чибиков внизу на file_2.jpg где Адриан'), 'ору с чибиков внизу на втором арте где Адриан');
    assert.equal(replaceFileReferences('в file_3.png так круто нарисовали'), 'на третьем арте так круто нарисовали');
    assert.equal(replaceFileReferences('На file.jpg баночка'), 'На арте баночка');
    assert.equal(replaceFileReferences('на file_4.webp и на file_7.png'), 'на четвёртом арте и на арте');
});

test('replaceFileReferences: other shapes and non-strings are untouched', () => {
    assert.equal(replaceFileReferences('спасибо художникам за file_2.jpg'), 'спасибо художникам за file_2.jpg');
    assert.equal(replaceFileReferences('profile.jpg на аве'), 'profile.jpg на аве');
    assert.equal(replaceFileReferences('гна file.jpg'), 'гна file.jpg');
    assert.equal(replaceFileReferences(42), 42);
});

test('cleanParsedComments: citations and file names in one pass', () => {
    const [m] = cleanParsedComments([{ username: 'u', content: 'мазь на file_2.jpg светится[cite: 2]' }]);
    assert.equal(m.content, 'мазь на втором арте светится');
});
