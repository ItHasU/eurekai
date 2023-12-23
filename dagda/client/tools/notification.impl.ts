import { AbstractNotificationImpl } from "@dagda/shared/tools/notification.helper";

/** Notification server based on websocket protocol */
export class ClientNotificationImpl<Notifications extends Record<string, unknown>> extends AbstractNotificationImpl<Notifications> {

    protected readonly _socket: WebSocket;

    public constructor() {
        super();

        this._socket = new WebSocket(`ws://${window.location.host}`);
        this._socket.onmessage = async (event) => {
            // Convert the blob to a string
            const str = typeof event.data === "string" ? event.data : (await (event.data as Blob).text());
            const notification = JSON.parse(str);
            this._onNotificationReceived(notification.kind, notification.data);
        };
    }

    /** @inheritdoc */
    public override broadcast<NotificationKind extends keyof Notifications>(kind: NotificationKind, data: Notifications[NotificationKind]): void {
        this._socket.send(JSON.stringify({ kind: kind, data: data }));
    }

}