/**
 * Wrap a callback so that it runs at most once every delayMs, however often it is asked for.
 *
 * The first call is not delayed (when calls are rare, nothing is held back) and the calls asked
 * for during the window are collapsed into a single one, run at the end of it. That trailing call
 * is what makes the wrapper usable to report a state : whenever a burst stops, the last state is
 * always reported, instead of being dropped with the calls that were collapsed.
 *
 * The callback is called with no argument on purpose : it has to read the current state itself,
 * since the calls that were collapsed carry states nobody will ever see.
 */
export function throttle(callback: () => void, delayMs: number): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    /** Date of the last run, 0 until the first one so that it does not wait */
    let lastCall: number = 0;

    return () => {
        if (timer != null) {
            // A call is already scheduled, it will report this change too
            return;
        }
        const delay = Math.max(0, delayMs - (Date.now() - lastCall));
        timer = setTimeout(() => {
            timer = null;
            lastCall = Date.now();
            callback();
        }, delay);
    };
}
