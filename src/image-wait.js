// @ts-check
/**
 * DS Comments — wait for a post's images before commenting (fork addition).
 *
 * Image extensions draw AFTER the post is rendered: Frameweaver subscribes to
 * CHARACTER_MESSAGE_RENDERED with makeLast, so our generation always starts
 * before its picture exists. When post images are going to be attached, the
 * generator parks here until the post's image work settles.
 *
 * Signals (all event-driven, no polling):
 *   - window 'iig:message-done'  — Frameweaver finished/failed/skipped a message
 *   - window 'iig:image-saved'   — older Frameweaver builds: a file was saved
 *     (fires BEFORE the tag is written into the post, so a few short delayed
 *     re-checks follow it)
 *   - window.IIG.isBusy(id)      — Frameweaver still working on that message
 *   - the post text itself       — src="[IMG:GEN]" placeholders (images.js)
 * Exits: ready, timeout, user skip ("Don't wait"), or abort (cancel/chat change).
 */

import { getCtx } from './core.js';
import { hasPendingPostImages } from './images.js';

export const IMAGE_WAIT_TIMEOUT_MS = 3 * 60 * 1000;
// Delayed re-checks after an 'iig:image-saved' (old Frameweaver: the save
// event precedes the commit into the post text).
const SAVED_RECHECK_DELAYS_MS = [400, 1500, 4000];

/** Frameweaver's own busy flag for a message (false when absent/older build). */
export function isImageExtensionBusy(messageId) {
    try {
        const iig = /** @type {any} */ (globalThis).IIG;
        return typeof iig?.isBusy === 'function' && !!iig.isBusy(Number(messageId));
    } catch {
        return false;
    }
}

/**
 * Is image work still pending for this post/swipe?
 * Swipe-aware: the placeholder check reads the requested swipe; the busy flag
 * is about the message (Frameweaver works on the active swipe).
 */
export function isPostImageWorkPending(messageId, swipeIdx) {
    const msg = getCtx()?.chat?.[parseInt(messageId)];
    if (!msg) return false;
    return hasPendingPostImages(msg, swipeIdx) || isImageExtensionBusy(messageId);
}

// Let already-queued event listeners run first (Frameweaver's render handler
// is registered last, so it claims its busy slot after ours started).
const yieldToQueue = () => new Promise(resolve => setTimeout(resolve, 0));

let _skip = null;

/** "Don't wait" — release the current wait (no-op when nothing is waiting). */
export function skipImageWait() {
    const skip = _skip;
    _skip = null;
    skip?.();
}

export function isWaitingForImages() {
    return _skip !== null;
}

/**
 * Wait until the post's image work settles.
 * @param {{ messageId: string|number, swipeIdx: number, signal?: AbortSignal,
 *           timeoutMs?: number, onWaitStart?: () => void }} opts
 * @returns {Promise<'none'|'ready'|'timeout'|'skipped'>} 'none' = nothing to wait for.
 *   Rejects with an AbortError when the signal aborts.
 */
export async function waitForPostImages({ messageId, swipeIdx, signal, timeoutMs = IMAGE_WAIT_TIMEOUT_MS, onWaitStart }) {
    const abortError = () => signal?.reason instanceof Error && signal.reason.name === 'AbortError'
        ? signal.reason
        : new DOMException('Aborted', 'AbortError');
    if (signal?.aborted) throw abortError();
    await yieldToQueue();
    if (signal?.aborted) throw abortError();
    if (!isPostImageWorkPending(messageId, swipeIdx)) return 'none';

    onWaitStart?.();
    return await new Promise((resolve, reject) => {
        const timers = new Set();
        let settled = false;
        const finish = (outcome, isError = false) => {
            if (settled) return;
            settled = true;
            for (const t of timers) clearTimeout(t);
            timers.clear();
            globalThis.removeEventListener?.('iig:message-done', onDone);
            globalThis.removeEventListener?.('iig:image-saved', onSaved);
            signal?.removeEventListener('abort', onAbort);
            if (_skip === skipThis) _skip = null;
            if (isError) reject(outcome); else resolve(outcome);
        };
        const check = () => {
            if (!settled && !isPostImageWorkPending(messageId, swipeIdx)) finish('ready');
        };
        const later = (ms) => {
            const t = setTimeout(() => { timers.delete(t); check(); }, ms);
            timers.add(t);
        };
        const onDone = () => later(0);
        const onSaved = () => { for (const ms of SAVED_RECHECK_DELAYS_MS) later(ms); };
        const onAbort = () => finish(abortError(), true);
        const skipThis = () => finish('skipped');

        _skip = skipThis;
        globalThis.addEventListener?.('iig:message-done', onDone);
        globalThis.addEventListener?.('iig:image-saved', onSaved);
        signal?.addEventListener('abort', onAbort, { once: true });
        const timeout = setTimeout(() => finish('timeout'), timeoutMs);
        timers.add(timeout);
        check();   // settled between the first check and listener setup
    });
}
