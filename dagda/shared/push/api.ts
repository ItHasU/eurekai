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

/** 
 * Content of a push message, sent as JSON by the server and displayed by the service worker.
 * The title is the application name, set by the service worker.
 */
export interface PushMessage {
    body: string;
    /** 
     * Notifications sharing a tag replace each other instead of piling up.
     * Keeps a single "generation done" notification after a few batches.
     */
    tag?: string;
}

export type PushAPI = {
    /** 
     * Get the server's public key, required by the browser to subscribe.
     * @returns null if push notifications are not configured on the server
     */
    getServerKey(): Promise<string | null>;

    /** 
     * Register a subscription, or update its keys if it is already known.
     * Called on each start of the application : the browser may renew a subscription on its own.
     */
    subscribe(subscription: WebPushSubscription): Promise<void>;

    /** Send a test notification to a single subscription, through the push service */
    test(endpoint: string): Promise<void>;
}

/** 
 * Message posted by the service worker to the page when the user clicks on a notification,
 * the page was brought to the front and may want to refresh.
 */
export const PUSH_CLICKED_MESSAGE = "dagda-push-clicked";
