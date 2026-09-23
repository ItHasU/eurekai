import { PushClient } from "@dagda/client/push/push.client";
import { APP } from "src";

/** 
 * True once this browser is subscribed to the push notifications : the server notifies it
 * itself, even when the application is closed.
 */
let _pushSubscribed: boolean = false;

/** 
 * Register the service worker and renew the push subscription, if the user allowed the
 * notifications (see the maintenance page). A click on a notification refreshes the current page.
 */
export function initNotifications(): void {
    PushClient.register("/sw.js");
    PushClient.onClicked(() => APP.refresh());
    PushClient.ensureSubscribed().then(subscription => {
        _pushSubscribed = subscription != null;
    }).catch(e => {
        console.error("Failed to subscribe to push notifications");
        console.error(e);
    });
}

/** @returns true if the notifications are pushed by the server to this browser */
export function isPushSubscribed(): boolean {
    return _pushSubscribed;
}

/** Called once this browser has subscribed to the push notifications */
export function setPushSubscribed(): void {
    _pushSubscribed = true;
}

/** 
 * Show a system notification from the page, when push is not available (not configured on the
 * server, refused by the browser). Only works while the application is open.
 * On clicked, the current page will be refreshed.
 */
export async function showNotificationIfPossible(options: NotificationOptions): Promise<void> {
    try {
        if (!("Notification" in window) || Notification.permission !== "granted") {
            return;
        }
        options = {
            icon: "/assets/icon.png",
            requireInteraction: true,
            ...options
        };
        // Android refuses new Notification() : the notification must come from the service worker
        const registration = await PushClient.getRegistration();
        if (registration != null) {
            await registration.showNotification("eurekAI", options);
        } else {
            const n = new Notification("eurekAI", options);
            n.addEventListener("click", function () {
                APP.refresh();
                n.close();
            });
        }
    } catch (e) {
        console.error(e);
    }
}
