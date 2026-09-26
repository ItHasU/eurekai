import { PUSH_CLICKED_MESSAGE, PushMessage } from "@dagda/shared/push/api";

declare const self: ServiceWorkerGlobalScope;

export interface PushWorkerOptions {
    /** Title of the notifications, typically the name of the application */
    title: string;
    /** Icon of the notifications */
    icon?: string;
    /** Page opened on click when the application is not open (default: /) */
    url?: string;
    /** Keep the notifications on screen until the user interacts with them (desktop only) */
    requireInteraction?: boolean;
}

/** 
 * Handlers of a service worker displaying the push notifications sent by the server
 * (see dagda/server/push).
 * 
 * The worker does not subscribe by itself : the page does (see dagda/client/push), because the
 * permission can only be asked from the page, and a subscription must be sent to the server
 * again whenever the browser renews it, which is checked each time the application starts.
 */
export function installPushWorker(options: PushWorkerOptions): void {
    // -- Life cycle --
    // A new version of the worker takes over right away, instead of waiting for every tab of
    // the application to be closed (which may never happen with an installed application)
    self.addEventListener("install", () => {
        self.skipWaiting();
    });
    self.addEventListener("activate", (event) => {
        event.waitUntil(self.clients.claim());
    });

    // -- Display the notifications --
    self.addEventListener("push", (event) => {
        let message: PushMessage;
        try {
            message = event.data?.json() ?? { body: "" };
        } catch (e) {
            // Not sent by dagda, display it as-is
            message = { body: event.data?.text() ?? "" };
        }

        // renotify is missing from the typings
        const notificationOptions: NotificationOptions & { renotify?: boolean } = {
            body: message.body,
            icon: options.icon,
            requireInteraction: options.requireInteraction,
            tag: message.tag,
            // Without renotify, a notification replacing another one with the same tag
            // makes no sound nor vibration
            renotify: message.tag != null
        };
        // A notification must be displayed before the event ends, the browser displays a
        // generic one otherwise (and may revoke the subscription)
        event.waitUntil(self.registration.showNotification(options.title, notificationOptions));
    });

    // -- Bring the application to the front on click --
    self.addEventListener("notificationclick", (event) => {
        event.notification.close();
        event.waitUntil((async () => {
            const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
            const window = windows.find(w => w.focused) ?? windows[0];
            if (window != null) {
                await window.focus();
                window.postMessage(PUSH_CLICKED_MESSAGE);
            } else {
                await self.clients.openWindow(options.url ?? "/");
            }
        })());
    });
}
