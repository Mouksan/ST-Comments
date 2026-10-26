// @ts-check
/**
 * DS Comments — model-artifact cleanup for parsed comments (fork addition).
 *
 * Gemini-family models treat attached images as "files" and sprinkle grounding
 * citations into the text: "[cite: 2]", "[cite: 1, 3]", "[cite_start]". They
 * are never part of a reader's comment, so they are stripped from every
 * parsed message before rendering/storing. The most common file-name shape,
 * "на file.jpg", is rewritten to "на арте".
 */

const CITATION_RE = /[ \t]*\[cite(?:_start|_end)?(?:[:\s][^\]\n]*)?\]/gi;

// "на file.jpg" / "в file_2.png" → "на арте" / "на втором арте". Only the
// prepositional "на/в + file" shape is rewritten: there the case is fixed
// (prepositional), so the replacement always reads right. Bare "file.jpg"
// in other positions is left alone — any noun there would need a case guess.
const FILE_REF_RE = /(^|[^\p{L}\p{N}_])(на|в)\s+file(?:[_\s-]?(\d+))?\.(?:jpe?g|png|webp|gif)\b/giu;
const ORDINAL_PREP = { 1: 'первом', 2: 'втором', 3: 'третьем', 4: 'четвёртом' };

/** @param {unknown} text */
export function replaceFileReferences(text) {
    if (typeof text !== 'string' || !/file/i.test(text)) return text;
    return text.replace(FILE_REF_RE, (_m, lead, prep, num) => {
        const ordinal = num ? ORDINAL_PREP[Number(num)] : '';
        const na = prep[0] === prep[0].toUpperCase() && prep[0] !== prep[0].toLowerCase() ? 'На' : 'на';
        return `${lead}${na} ${ordinal ? `${ordinal} ` : ''}арте`;
    });
}

/** @param {unknown} text */
export function stripModelCitations(text) {
    if (typeof text !== 'string' || !text.includes('[cite')) return text;
    return text.replace(CITATION_RE, '').replace(/[ \t]{2,}/g, ' ').trim();
}

/**
 * Clean a parsed comment list in place-safe fashion (returns new objects).
 * @param {Array<any>} messages
 */
export function cleanParsedComments(messages) {
    if (!Array.isArray(messages)) return messages;
    return messages.map(m => {
        if (!m || typeof m !== 'object') return m;
        const out = { ...m, content: replaceFileReferences(stripModelCitations(m.content)) };
        // Parsed shape carries the quoted fragment as replyQuote.
        if (typeof m.replyQuote === 'string') out.replyQuote = replaceFileReferences(stripModelCitations(m.replyQuote));
        return out;
    });
}
