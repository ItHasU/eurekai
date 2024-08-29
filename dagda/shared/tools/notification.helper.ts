import { EventHandlerData, EventHandlerImpl, EventListener } from "./events";

/** 
 * A broadcast notification system. You should only instantiate one per node (server, client).
 * Communication is handled : 
 * - by the implementation of the broadcast method to send notifications,
 * - by calling the _onNotificationReceived method when a notification is received.
 */
export abstract class AbstractNotificationImpl<Notifications extends Record<string, unknown>> {

    /** Callback called when a notification is received */
    protected _onNotificationReceived: (<NotificationKind extends keyof Notifications>(kind: NotificationKind, data: Notifications[NotificationKind]) => void) = () => { };

    public setNotificationCallback(onNotificationReceived: <NotificationKind extends keyof Notifications>(kind: NotificationKind, data: Notifications[NotificationKind]) => void): void {
        this._onNotificationReceived = onNotificationReceived ?? (() => { });
    }

    /** Broadcast a new notification to all other clients */
    public abstract broadcast<NotificationKind extends keyof Notifications>(kind: NotificationKind, data: Notifications[NotificationKind]): void;

}

/** 
 * This is a singleton to access the notification features.
 * This class depends on the implementation of the AbstractNotificationImpl, however,
 * it can be used before the instance is set.
 */
export class NotificationHelper {

    private static _instance: AbstractNotificationImpl<Record<string, unknown>> | undefined = undefined;

    //#region Implementation management ---------------------------------------

    /** Set the implementation to use */
    public static set(instance: AbstractNotificationImpl<Record<string, unknown>>): void {
        NotificationHelper._instance = instance;
        NotificationHelper._instance.setNotificationCallback((kind, data) => {
            EventHandlerImpl.fire(NotificationHelper._eventHandlerData, kind, data);
        });
    }

    //#endregion

    //#region Event handler ---------------------------------------------------

    private static readonly _eventHandlerData: EventHandlerData<Record<string, unknown>> = {};

    /** Register a listener on any notification kind */
    public static on<Notifications extends Record<string, unknown>, NotificationKind extends keyof Notifications = keyof Notifications>(kind: NotificationKind, listener: EventListener<Notifications[NotificationKind]>): void {
        EventHandlerImpl.on<Notifications, NotificationKind>(NotificationHelper._eventHandlerData as EventHandlerData<Notifications>, kind, listener);
    }

    /** 
     * Broadcast a message if a notification helper is instantiated and set.
     * Errors (if any) are catch and reported by this function.
     */
    public static broadcast<Notifications extends Record<string, unknown>, NotificationKind extends keyof Notifications = keyof Notifications>(kind: NotificationKind, data: Notifications[NotificationKind]): void {
        try {
            NotificationHelper._instance?.broadcast(kind as string, data);
        } catch (e) {
            console.error("Failed to trigger notification");
            console.error(e);
        }
    }

    //#endregion

}