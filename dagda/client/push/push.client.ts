import { PUSH_CLICKED_MESSAGE, PUSH_URL, PushAPI, WebPushSubscription } from "@dagda/shared/push/api";
import { apiCall } from "../api";

/** 
 * Page side of the push notifications : registers the service worker (see dagda/webworker/push)
 * and subscribes to the push notifications sent by the server (see dagda/server/push).
 */
export class PushClient {

    protected static _registration: Promise<ServiceWorkerRegistration | null> = Promise.resolve(null);

    /** @returns true if the browser can receive push notifications */
    public static isSupported(): boolean {
        // On iOS, push is only available once the application is added to the home screen
        return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    }

    /** 
     * Register the service worker, once when the application starts.
     * @param url URL of the worker script. The worker only receives the clicks of the pages in its
     * scope, which is the folder of the script : it must be served at the root of the site.
     */
    public static register(url: string): Promise<ServiceWorkerRegistration | null> {
        if (!("serviceWorker" in navigator)) {
            return this._registration;
        }
        this._registration = navigator.serviceWorker.register(url).catch(e => {
            console.error("Failed to register the service worker");
            console.error(e);
            return null;
        });
        return this._registration;
    }

    /** Get the registration of the service worker, once active */
    public static async getRegistration(): Promise<ServiceWorkerRegistration | null> {
        const registration = await this._registration;
        return registration == null ? null : navigator.serviceWorker.ready;
    }

    /** Called when the user clicks on a notification and the page is brought to the front */
    public static onClicked(listener: () => void): void {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.addEventListener("message", (event) => {
                if (event.data === PUSH_CLICKED_MESSAGE) {
                    listener();
                }
            });
        }
    }

    /** 
     * Make sure the server knows the subscription of this browser, if the user allowed the
     * notifications. Never asks for the permission : to be called when the application starts.
     * 
     * The subscription is sent each time : the browser may renew it on its own, and the server
     * forgets the ones the push service rejects.
     * @returns The subscription, or null if push is not available
     */
    public static async ensureSubscribed(): Promise<PushSubscription | null> {
        if (!this.isSupported() || Notification.permission !== "granted") {
            return null;
        }
        const registration = await this.getRegistration();
        if (registration == null) {
            return null;
        }
        const serverKey = await apiCall<PushAPI, "getServerKey">(PUSH_URL, "getServerKey");
        if (serverKey == null) {
            // Push is not configured on the server
            return null;
        }
        const applicationServerKey = urlBase64ToUint8Array(serverKey);

        let subscription = await registration.pushManager.getSubscription();
        if (subscription != null && !sameKey(subscription.options?.applicationServerKey, applicationServerKey)) {
            // The keys of the server have changed, the subscription is useless
            await subscription.unsubscribe();
            subscription = null;
        }
        if (subscription == null) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true, // Required by the browsers : each push displays a notification
                applicationServerKey
            });
        }

        await apiCall<PushAPI, "subscribe">(PUSH_URL, "subscribe", subscription.toJSON() as WebPushSubscription);
        return subscription;
    }

    /** 
     * Ask for the permission, subscribe and send a test notification through the push service.
     * Must be called from a user action (a click) : iOS refuses to ask for the permission otherwise.
     * @throws A message for the user when something is missing
     */
    public static async enableAndTest(): Promise<void> {
        if (!this.isSupported()) {
            throw "This browser does not support push notifications (on iOS, add the application to the home screen first)";
        }
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            throw "Notifications are blocked for this site, allow them in the settings of the browser";
        }
        const subscription = await this.ensureSubscribed();
        if (subscription == null) {
            throw "Push notifications are not configured on the server (see PUSH_PUBLIC and PUSH_PRIVATE in its logs)";
        }
        await apiCall<PushAPI, "test">(PUSH_URL, "test", subscription.endpoint);
    }
}

/** Convert a key encoded as URL-safe base64 (as sent by the server) to bytes */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const result = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        result[i] = raw.charCodeAt(i);
    }
    return result;
}

/** 
 * @returns false if the subscription was made with another key. When the browser does not
 * expose the key (older Safari), the subscription is kept : subscribing again on each start would
 * only multiply the subscriptions.
 */
function sameKey(key: ArrayBuffer | null | undefined, expected: Uint8Array): boolean {
    if (key == null) {
        return true;
    }
    const bytes = new Uint8Array(key);
    return bytes.length === expected.length && bytes.every((b, i) => b === expected[i]);
}
