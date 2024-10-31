export const PUSH_URL = "push";

/**
 * Configuration for a Push Subscription. This can be obtained on the frontend by calling
 * serviceWorkerRegistration.pushManager.subscribe().
 * The expected format is the same output as JSON.stringify'ing a PushSubscription in the browser.
 */
export interface WebPushSubscription {
    endpoint: string;
    expirationTime?: null | number;
    keys: {
        p256dh: string;
        auth: string;
    };
}

export type PushAPI<O> = {
    /** Get the server's public API key */
    getServerKey(options: O): Promise<string>;

    /** 
     * Subscribe to push notifications.
     * @returns true if subscription is newly registered, false if subscription was already registered.
     */
    subscribe(options: O, subscription: WebPushSubscription): Promise<boolean>;
}