function _void(): void { }

export type Runnable<T, R> = (resource: T) => PromiseLike<R>;

/** 
 * A queue for runnables.
 * 
 * The queue can optionally have a shared resource that will be
 * passed to all the runnables. The queue guarantees that the 
 * resource will only be accessible to one runnable at a time.
 */
export class Queue<T = void> {

    protected _queue: Promise<void> = Promise.resolve();
    protected _count: number = 0;

    constructor(protected _resource: T) {
    }

    /** 
     * Enqueue a runnable.
     * The runnable will receive the resource passed in the constructor as first parameter.
     */
    run<R>(f: Runnable<T, R>): Promise<R> {
        this._count++;
        const result = this._queue.then(() => {
            return f(this._resource);
        });

        // Don't catch the rejection and ignore the result
        this._queue = result.catch(_void).then(() => {
            this._count--;
        });

        return result;
    }
}