import { AbstractNotificationImpl, HEARTBEAT_INTERVAL_MS, HEARTBEAT_NOTIFICATION_KIND } from "@dagda/shared/tools/notification.helper";

export type SocketEvents = {
    connected: boolean;
}

/** Delay before connecting again once the connection is lost */
const RECONNECT_DELAY_MS = 1000;

/** Notification server based on websocket protocol */
export class ClientNotificationImpl<Notifications extends SocketEvents & Record<string, unknown>> extends AbstractNotificationImpl<Notifications> {

    protected _socket: WebSocket | null = null;

    /** Declares the connection dead when the server stays silent for too long, see _watchSilence */
    protected _silenceTimer: ReturnType<typeof setTimeout> | null = null;
    protected readonly _silenceTimeoutMs: number;

    /** @param options.silenceTimeoutMs Only meant to be changed by tests */
    public constructor(options?: { silenceTimeoutMs?: number }) {
        super();
        // Over two heartbeat intervals : a heartbeat arriving a little late must not be mistaken
        // for a dead connection, only a missing one
        this._silenceTimeoutMs = options?.silenceTimeoutMs ?? 2.5 * HEARTBEAT_INTERVAL_MS;
        this._connect();
    }

    protected _connect(): void {
        this._dropSocket();

        let socket: WebSocket;
        try {
            socket = new WebSocket(`ws${window.location.protocol.includes("s") ? "s" : ""}://${window.location.host}`);
        } catch (e) {
            this._onNotificationReceived("connected", false);
            return;
        }
        this._socket = socket;
        // Watched from now on and not only once opened : a connection attempt can hang as well
        this._watchSilence();

        socket.onopen = () => {
            console.log("Socket opened");
            this._watchSilence();
            this._onNotificationReceived("connected", true);
        };
        socket.onmessage = async (event) => {
            // Anything received proves the connection alive, before even reading it
            this._watchSilence();
            // Convert the blob to a string
            const str = typeof event.data === "string" ? event.data : (await (event.data as Blob).text());
            const notification = JSON.parse(str);
            if (notification.kind === HEARTBEAT_NOTIFICATION_KIND) {
                // Only there to prove the connection alive, which is done
                return;
            }
            this._onNotificationReceived(notification.kind, notification.data);
        };
        socket.onclose = () => {
            console.log(`Socket closed, reconnecting in ${RECONNECT_DELAY_MS / 1000} second(s)`);
            this._reconnect();
        };
    }

    /**
     * Give up on the current socket and connect again shortly.
     * Called when the socket reports its closing, and when the server stayed silent for too long.
     */
    protected _reconnect(): void {
        this._clearSilenceTimer();
        this._dropSocket();
        // Listeners ask for fresh data once connected again : what they missed meanwhile is lost
        this._onNotificationReceived("connected", false);
        setTimeout(() => this._connect(), RECONNECT_DELAY_MS);
    }

    /**
     * Forget the current socket, if any.
     * Its handlers are detached before closing it : a socket that is being replaced must not
     * report its own closing later on, that would tear down the socket that replaced it.
     */
    protected _dropSocket(): void {
        const socket = this._socket;
        this._socket = null;
        if (socket == null) {
            return;
        }
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.close();
    }

    /**
     * (Re)start the silence timer. The server sends a heartbeat every HEARTBEAT_INTERVAL_MS, so a
     * connection that brought nothing for longer is dead, whatever the browser thinks : a
     * connection lost without a proper close (network change, laptop sleep, mobile going to
     * background, a proxy dropping idle connections) may report its closing very late, or never.
     *
     * The socket is not merely closed then : on a dead connection, the closing handshake started by
     * close() cannot complete either, and waiting for "close" would mean waiting just as long.
     */
    protected _watchSilence(): void {
        this._clearSilenceTimer();
        this._silenceTimer = setTimeout(() => {
            this._silenceTimer = null;
            console.log(`Nothing received for ${this._silenceTimeoutMs / 1000} second(s), reconnecting`);
            this._reconnect();
        }, this._silenceTimeoutMs);
    }

    protected _clearSilenceTimer(): void {
        if (this._silenceTimer != null) {
            clearTimeout(this._silenceTimer);
            this._silenceTimer = null;
        }
    }

    /** @inheritdoc */
    public override broadcast<NotificationKind extends keyof Notifications>(kind: NotificationKind, data: Notifications[NotificationKind]): void {
        // Between a lost connection and the next one opening, there is either no socket or one
        // still connecting, and a browser throws when sending on a socket that is not open yet
        if (this._socket?.readyState === WebSocket.OPEN) {
            this._socket.send(JSON.stringify({ kind: kind, data: data }));
        }
    }

}
