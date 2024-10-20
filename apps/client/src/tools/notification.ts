import { APP } from "src";

/** Show a system notification. On clicked, the current page will be refreshed. */
export function showNotificationIfPossible(options: NotificationOptions): void {
    try {
        const n = new Notification("eurekAI", {
            icon: "/assets/icon.png",
            requireInteraction: true,
            silent: true,
            ...options
        });
        n.addEventListener("click", function () {
            APP.refresh();
            n.close();
        });
    } catch (e) {
        console.error(e);
    }
}
