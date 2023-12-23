import { AbstractNotificationImpl } from "@dagda/shared/tools/notification.helper";
import { Server } from "http";
import { WebSocket, WebSocketServer } from "ws";

/** Notification server based on websocket protocol */
export class ServerNotificationImpl<Notifications extends Record<string, unknown>> extends AbstractNotificationImpl<Notifications> {

    protected readonly _socket: WebSocketServer;

    public constructor(server: Server) {
        super();

        // Register a websocket from ws on the Express server
        this._socket = new WebSocketServer({ server });
        this._socket.on('connection', (ws) => {
            ws.on('message', (message) => {
                // Forward to all other clients
                this._socket?.clients.forEach((client) => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(message);
                    }
                });
                // Fire notification
                const notification = JSON.parse(message.toString());
                this._onNotificationReceived(notification.kind, notification.data);
            });
        });
    }

    /** 
     * @inheritdoc 
     * If the websocket is not initialized yet, the notification will be lost without an error or a warning.
     */
    public override broadcast<NotificationKind extends keyof Notifications>(kind: NotificationKind, data: Notifications[NotificationKind]): void {
        this._socket.clients.forEach((client) => {
            client.send(JSON.stringify({ kind: kind, data: data }));
        });
    }

}