// @ts-check
/**
 * DS Comments — model-artifact cleanup for parsed comments (fork addition).
 *
 * Gemini-family models treat attached images as "files" and sprinkle grounding
 * citations into the text: "[cite: 2]", "[cite: 1, 3]", "[cite_start]". They
 * are never part of a reader's comment, so they are stripped from every
 * parsed message before rendering/storing.
 */

const CITATION_RE = /[ \t]*\[cite(?:_start|_end)?(?:[:\s][^\]\n]*)?\]/gi;

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
        const out = { ...m, content: stripModelCitations(m.content) };
        // Parsed shape carries the quoted fragment as replyQuote.
        if (typeof m.replyQuote === 'string') out.replyQuote = stripModelCitations(m.replyQuote);
        return out;
    });
}
