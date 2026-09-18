import * as assert from "assert";
import { describe } from "mocha";
import { throttle } from "./throttle";

/** Delay used by the tests, short enough to keep them fast */
const DELAY_MS = 50;

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe("throttle", () => {

    it("runs an isolated call without waiting for the whole delay", async () => {
        let calls = 0;
        const throttled = throttle(() => calls++, DELAY_MS);

        throttled();
        await sleep(DELAY_MS / 2);
        assert.strictEqual(calls, 1);
    });

    it("collapses a burst into one call", async () => {
        let calls = 0;
        const throttled = throttle(() => calls++, DELAY_MS);

        for (let i = 0; i < 20; i++) {
            throttled();
        }
        await sleep(DELAY_MS * 2);
        assert.strictEqual(calls, 1, "the calls of a single burst must be collapsed");
    });

    it("always reports the last state of a burst", async () => {
        // What the callback reports, changed after the first call went through : the trailing
        // call is the only thing that can report it
        let state = "start";
        const reported: string[] = [];
        const throttled = throttle(() => reported.push(state), DELAY_MS);

        throttled();
        await sleep(DELAY_MS / 2);
        for (let i = 0; i < 5; i++) {
            state = `step ${i}`;
            throttled();
        }
        state = "end";
        throttled();

        await sleep(DELAY_MS * 2);
        assert.strictEqual(reported[0], "start");
        assert.strictEqual(reported[reported.length - 1], "end", "the last state must always be reported");
    });

    it("keeps at most one call per delay", async () => {
        let calls = 0;
        const throttled = throttle(() => calls++, DELAY_MS);

        // Ask for a call far more often than the delay allows
        const end = Date.now() + DELAY_MS * 4;
        while (Date.now() < end) {
            throttled();
            await sleep(1);
        }
        await sleep(DELAY_MS * 2);

        // 4 windows, plus the trailing call of the last one, and a margin for a slow runner
        assert.ok(calls <= 6, `expected at most 6 calls, got ${calls}`);
        assert.ok(calls >= 3, `expected at least 3 calls, got ${calls}`);
    });

    it("does not delay a call following a quiet period", async () => {
        const dates: number[] = [];
        const throttled = throttle(() => dates.push(Date.now()), DELAY_MS);

        throttled();
        await sleep(DELAY_MS * 3);
        const askedAt = Date.now();
        throttled();
        await sleep(DELAY_MS);

        assert.strictEqual(dates.length, 2);
        assert.ok(dates[1] - askedAt < DELAY_MS, "a call after a quiet period must not be held back");
    });

});
