import { AbstractNotificationImpl, HEARTBEAT_INTERVAL_MS, HEARTBEAT_NOTIFICATION_KIND } from "@dagda/shared/tools/notification.helper";
import { Server } from "http";
import { WebSocket, WebSocketServer } from "ws";

/** Notification server based on websocket protocol */
export class ServerNotificationImpl<Notifications extends Record<string, unknown>> extends AbstractNotificationImpl<Notifications> {

    protected readonly _socket: WebSocketServer;

    /**
     * Clients that answered the last ping. One that is still missing on the next heartbeat never
     * answered : its connection is dead, see _checkClients.
     * A WeakSet, so a terminated client does not stay referenced from here.
     */
    protected readonly _aliveClients: WeakSet<WebSocket> = new WeakSet();

    protected readonly _heartbeat: NodeJS.Timeout;

    /** @param options.heartbeatIntervalMs Only meant to be changed by tests */
    public constructor(server: Server, options?: { heartbeatIntervalMs?: number }) {
        super();

        // Register a websocket from ws on the Express server
        this._socket = new WebSocketServer({ server });
        this._socket.on('connection', (ws) => {
            // It just connected, so it is alive until the next heartbeat says otherwise
            this._aliveClients.add(ws);
            ws.on('pong', () => {
                this._aliveClients.add(ws);
            });

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

        // -- Heartbeat --
        // A connection lost without a proper close (network change, laptop sleep, mobile going to
        // background, a proxy dropping idle connections) is never reported : the socket would stay
        // in the clients forever, and every broadcast would keep writing to it for nothing.
        this._heartbeat = setInterval(() => this._checkClients(), options?.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS);
        // The heartbeat alone must not keep the process alive
        this._heartbeat.unref();
        // Given an existing HTTP server, the websocket server only emits "close" when it is closed
        // itself : closing the HTTP server does not close it. Both are watched.
        const stopHeartbeat = () => clearInterval(this._heartbeat);
        this._socket.on('close', stopHeartbeat);
        server.on('close', stopHeartbeat);
    }

    /**
     * Terminate the clients that did not answer the previous ping, then ping the others.
     * A client is therefore given a whole heartbeat interval to answer, and a dead connection is
     * detected within two intervals.
     */
    protected _checkClients(): void {
        const heartbeat = JSON.stringify({ kind: HEARTBEAT_NOTIFICATION_KIND, data: null });
        for (const client of this._socket.clients) {
            if (client.readyState !== WebSocket.OPEN) {
                // Already closing : ws completes it on its own, with a timeout of its own
                continue;
            }
            if (!this._aliveClients.has(client)) {
                // terminate() rather than close() : close() starts a closing handshake that a dead
                // peer will never answer, the socket would linger until ws gives up on it
                client.terminate();
                continue;
            }
            this._aliveClients.delete(client);
            // The pong is what the server watches. The message is for the browser, which answers
            // pings on its own but cannot see them : it watches for this message instead, see
            // ClientNotificationImpl.
            client.ping();
            client.send(heartbeat);
        }
    }

    /**
     * @inheritdoc
     * If the websocket is not initialized yet, the notification will be lost without an error or a warning.
     */
    public override broadcast<NotificationKind extends keyof Notifications>(kind: NotificationKind, data: Notifications[NotificationKind]): void {
        // Serialized once, it is the same for every client
        const message = JSON.stringify({ kind: kind, data: data });
        this._socket.clients.forEach((client) => {
            // Same check as the relay in the message handler : ws throws on a socket still
            // connecting, and silently drops what is sent to one that is closing
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

}
