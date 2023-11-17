import { Runnable } from "./queue";

function _void(): void { }

/** 
 * A pool for runnables.
 * 
 * The queue can optionally have a shared resource that will be
 * passed to all the runnables. The queue guarantees that the 
 * resource will only be accessible to one runnable at a time.
 */
export class Pool<T = void> {

    protected _queue: {
        resolve: (result: unknown) => void;
        reject: (e: any) => void;
        runnable: Runnable<T, unknown>;
    }[] = [];

    protected _resources: {
        /** Resource that will be passed to the runnable */
        resource: T;
        /** Current runnable, null if resource is available */
        runnable: Runnable<T, unknown> | null;
    }[] = [];

    constructor(resources: T[]) {
        for (const resource of resources) {
            this._resources.push({
                resource,
                runnable: null
            });
        }
    }

    /** 
     * Enqueue a runnable.
     * The runnable will receive the resource passed in the constructor as first parameter.
     */
    run<R>(runnable: Runnable<T, R>): Promise<R> {
        const p: Promise<R> = new Promise<R>((resolve, reject) => {
            this._queue.push({
                resolve: resolve as (result: unknown) => void,
                reject,
                runnable
            });
        });
        this._next();
        return p;
    }

    /**
     * Call next pending runnable.
     * If no runnable is pending or no resource is available, just exit.
     */
    protected _next(): void {
        if (this._queue.length === 0) {
            // No pending runnable
            return;
        }
        const availableResource = this._resources.find(r => r.runnable === null);
        if (availableResource == null) {
            // No available resource
            return;
        }
        // Here we are sure something will be returned as we checked the array size earlier
        const runnable = this._queue.shift()!;
        availableResource.runnable = runnable.runnable;
        Promise.resolve().then(async () => {
            try {
                const result = await runnable.runnable(availableResource.resource);
                runnable.resolve(result);
            } catch (e) {
                runnable.reject(e);
            }
            // Free the resource
            availableResource.runnable = null;
            // Run next runnable
            this._next();
        });
    }
}