import { PUSH_URL, PushAPI, PushMessage, WebPushSubscription } from "@dagda/shared/push/api";
import { Application } from "express";
import { generateVAPIDKeys, sendNotification, setVapidDetails, Urgency, WebPushError } from "web-push";
import { registerAPI } from "../api";
import { getEnvStringOptional } from "../tools/config";

const ENV_VAPID_SUBJECT = "PUSH_SUBJECT";
const ENV_VAPID_PUBLIC = "PUSH_PUBLIC";
const ENV_VAPID_PRIVATE = "PUSH_PRIVATE";

/** Options of a single notification */
export interface PushOptions {
    /** 
     * How long the push service keeps the message while the device is offline, in seconds.
     * A notification that is days old is of no use, hence a default of one day.
     */
    ttl?: number;
    /**
     * Hint for the push service. "high" wakes up a phone in power saving mode right away,
     * where "normal" may be delayed until the phone wakes up by itself.
     */
    urgency?: Urgency;
    /** 
     * A message waiting on the push service is replaced by a newer message with the same topic
     * (32 characters max, URL-safe base64 alphabet).
     */
    topic?: string;
}

/** 
 * An utility class to manage web push notifications.
 * 
 * Push notifications are sent by the server through the push service of each browser, they are
 * delivered to the service worker even if the application is closed. This is the only reliable
 * way to notify a phone : the page is frozen as soon as it is in the background.
 * 
 * The keys (VAPID) identify the server to the push services. They are read from the environment
 * and must never change : the subscriptions are bound to the public key. When they are not set,
 * push is disabled and a new pair is printed to be copied in the environment.
 */
export abstract class AbstractPushHelper {

    /** False when the keys are not configured */
    protected readonly _enabled: boolean;
    protected readonly _publicKey: string | null = null;

    /** @param defaultSubject Contact of the server's owner, used when not set in the environment (mailto: or https: URL) */
    constructor(defaultSubject: string) {
        const subject = getEnvStringOptional(ENV_VAPID_SUBJECT) ?? defaultSubject;
        const publicKey = getEnvStringOptional(ENV_VAPID_PUBLIC);
        const privateKey = getEnvStringOptional(ENV_VAPID_PRIVATE);
        if (publicKey == null || privateKey == null) {
            const keys = generateVAPIDKeys();
            console.warn(`Push notifications are disabled, add the following keys to the environment to enable them :`);
            console.warn(`${ENV_VAPID_PUBLIC}=${keys.publicKey}`);
            console.warn(`${ENV_VAPID_PRIVATE}=${keys.privateKey}`);
            console.warn(`${ENV_VAPID_SUBJECT}=mailto:you@example.com (optional, defaults to ${defaultSubject})`);
            this._enabled = false;
            return;
        }

        try {
            // Validates the keys and the subject, throws if they are malformed
            setVapidDetails(subject, publicKey, privateKey);
            this._publicKey = publicKey;
            this._enabled = true;
        } catch (e) {
            console.error(`Invalid push notification settings, push notifications are disabled`);
            console.error(e);
            this._enabled = false;
        }
    }

    public installRouter(app: Application): void {
        registerAPI<PushAPI>(app, PUSH_URL, {
            getServerKey: () => Promise.resolve(this._publicKey),
            subscribe: async (subscription) => {
                this._checkSubscription(subscription);
                await this._saveSubscription(subscription);
            },
            test: async (endpoint) => {
                const subscription = (await this._getSubscriptions()).find(s => s.endpoint === endpoint);
                if (subscription == null) {
                    throw "Unknown subscription";
                }
                const failure = await this._sendImpl(subscription, { body: "If you see this, notifications are set up correctly" }, { urgency: "high" });
                if (failure != null) {
                    throw failure;
                }
            }
        });
    }

    /** Send a notification to every subscription */
    public async notifyAll(message: PushMessage, options?: PushOptions): Promise<void> {
        if (!this._enabled) {
            return;
        }
        try {
            const subscriptions = await this._getSubscriptions();
            await Promise.all(subscriptions.map(s => this._sendImpl(s, message, options)));
        } catch (e) {
            console.error("Failed to send push notifications");
            console.error(e);
        }
    }

    /** 
     * Send a message to a subscription.
     * Never throws : a failure is logged and returned, a subscription that expired is forgotten.
     * @returns The failure, if any
     */
    protected async _sendImpl(subscription: WebPushSubscription, message: PushMessage, options?: PushOptions): Promise<string | null> {
        if (!this._enabled) {
            return "Push notifications are not configured on the server";
        }
        try {
            await sendNotification(subscription, JSON.stringify(message), {
                TTL: options?.ttl ?? 24 * 60 * 60,
                urgency: options?.urgency,
                topic: options?.topic
            });
            return null;
        } catch (e) {
            // 404 and 410 : the subscription expired or the user revoked the permission, it will
            // never work again. Any other error (push service unavailable, network) may be
            // temporary, the subscription must be kept.
            if (e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410)) {
                console.log(`Push subscription expired (${e.statusCode}), forgetting it`);
                await this._deleteSubscription(subscription.endpoint).catch(e => console.error(e));
                return "The subscription has expired";
            }
            console.error(`Failed to send a push notification`);
            console.error(e);
            return e instanceof WebPushError ? `Push service answered ${e.statusCode}: ${e.body}` : "" + e;
        }
    }

    /** @throws if the subscription is not usable, it comes from the client */
    protected _checkSubscription(subscription: WebPushSubscription): void {
        if (typeof subscription?.endpoint !== "string" || !subscription.endpoint.startsWith("https://")
            || typeof subscription.keys?.p256dh !== "string" || typeof subscription.keys?.auth !== "string") {
            throw "Invalid push subscription";
        }
    }

    //#region Abstract subscription handling

    /** Get all the known subscriptions */
    protected abstract _getSubscriptions(): Promise<WebPushSubscription[]>;

    /** Save a subscription, or update its keys if its endpoint is already known */
    protected abstract _saveSubscription(subscription: WebPushSubscription): Promise<void>;

    /** Delete a subscription, when it has become invalid */
    protected abstract _deleteSubscription(endpoint: string): Promise<void>;

    //#endregion
}
