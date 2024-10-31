/// <reference lib="WebWorker" />
import { apiCall } from "@dagda/client/api";
import { PUSH_URL, PushAPI, WebPushSubscription } from "@dagda/shared/push/api";

/** Utility class to handle web-push and notifications from the worker */
export class PushHelper {

    public constructor(protected _appName: string, protected _notificationOptions: Pick<NotificationOptions, "icon" | "silent">) {
        try {
            this._serviceWorker.addEventListener("push", async (evt) => {
                const message = await evt.data?.text();
                if (message) {
                    this.notify(message);
                }
            });
        } catch (e) {
            console.error(e);
        }
    }

    /** Get self as a ServiceWorker */
    protected get _serviceWorker(): ServiceWorkerGlobalScope {
        return (self as any as ServiceWorkerGlobalScope);
    }

    /** 
     * Get the push manager.
     * @throws if the worker is not a service worker
     */
    protected get _pushManager(): PushManager {
        try {
            return this._serviceWorker.registration.pushManager;
        } catch (e) {
            console.error(e);
            throw "Not in a Service worker";
        }
    }

    /** Subscribe to push notifications on the server */
    public async subscribe(): Promise<void> {
        // -- Get service worker registration --
        let subscription: PushSubscription | null = await this._pushManager.getSubscription();
        if (subscription == null) {
            // Not registered yet ...
            // ... request an api key from the server ...
            const applicationServerKey = await apiCall<PushAPI, "getServerKey">(PUSH_URL, "getServerKey");
            // ... and subscribe with the key
            subscription = await this._pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });
        }

        await apiCall<PushAPI, "subscribe">(PUSH_URL, "subscribe", subscription.toJSON() as WebPushSubscription);
    }

    public notify(text: string): void {
        const permission: NotificationPermission = Notification.permission;
        if (permission === "granted") {
            try {
                this._serviceWorker.registration.showNotification(this._appName, {
                    ...this._notificationOptions,
                    body: text
                });
            } catch (e) {
                console.error(e);
            }
        }

    }
}