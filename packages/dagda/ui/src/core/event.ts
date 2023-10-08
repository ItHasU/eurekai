/** Callback that will be executed when an event of type E is fired */
export type Callback<E> = (event: Event<E>) => false | void;

/** Event container */
export class Event<E> {
    protected _stop: boolean = false;

    constructor(public readonly data: E) { }

    /** Was stopPropagation() called ? */
    public get stopped(): boolean { return this._stop; }
    /** If called, next callbacks won't be called */
    public stopPropagation(): void { this._stop = true; }
}

/** A generic event handler */
export class EventHandler<E> {

    /** List of registered callbacks */
    protected _callbacks: Callback<E>[] = [];

    /** 
     * Trigger an event.
     * Will call all registered callbacks until stopPropagation() is called.
     */
    public async fire(data: E): Promise<void> {
        const nextCallback: Callback<E>[] = [];
        const event = new Event(data);
        for (const cb of this._callbacks) {
            const keep = cb(event);
            if (keep === false) {
                // Don't keep the event
            } else {
                nextCallback.push(cb);
            }
            if (event.stopped) {
                break;
            }
        }
        this._callbacks = nextCallback;
    }

    /** Register a callback */
    public on(callback: Callback<E>): void {
        this._callbacks.push(callback);
    }
}
