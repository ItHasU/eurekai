import { PUSH_URL, PushAPI } from "@dagda/shared/push/api";
import { Application } from "express";
import { generateVAPIDKeys, PushSubscription, RequestOptions, sendNotification } from "web-push";
import { registerAPI } from "../api";
import { getEnvStringOptional } from "../tools/config";

const ENV_VAPID_SUBJECT = "PUSH_SUBJECT";
const ENV_VAPID_PUBLIC = "PUSH_PUBLIC";
const ENV_VAPID_PRIVATE = "PUSH_PRIVATE";

export type UserUID = string;

/** An utility class to manage push notifications */
export abstract class AbstractPushHelper {

    protected readonly _vapidDetails: Required<RequestOptions>["vapidDetails"];

    constructor() {
        this._vapidDetails = this._readOrGenerateVAPIDKeys();
    }

    public installRouter(app: Application): void {
        registerAPI<PushAPI>(app, PUSH_URL, {
            getServerKey: this._getKey.bind(this),
            subscribe: this._subscribe.bind(this)
        });
    }

    public async notifyAll(message: string): Promise<void> {
        const subscriptions = await this._getSubscriptions();
        return this._notifyImpl(subscriptions, message);
    }

    /** Send a message to all the subscriptions passed */
    protected _notifyImpl(subscriptions: PushSubscription[], message: string): Promise<void> {
        const promises: Promise<void>[] = [];
        for (const subscription of subscriptions) {
            const p = sendNotification(subscription, message, {
                vapidDetails: this._vapidDetails
            }).then(async (result) => {
                if (result.statusCode < 200 || result.statusCode >= 300) {
                    console.error(result);
                    throw `Notification failed with status ${result.statusCode}`;
                }
            }).catch(e => {
                console.error(e);
                this._deleteSubscription(subscription);
            });
            promises.push(p);
        }
        // -- Wait for all promises to settle --
        return Promise.allSettled(promises).then(() => { });
    }

    //#region Abstract subscription handling

    /** 
     * Get all subscriptions still active.
     */
    protected abstract _getSubscriptions(): Promise<PushSubscription[]>;

    /** Save subscription. */
    protected abstract _addSubscription(subscription: PushSubscription): Promise<boolean>;

    /** Delete subscription, in case the subscription has become invalid */
    protected abstract _deleteSubscription(subscription: PushSubscription): Promise<void>;

    //#endregion

    //#region WebPush tools

    /** Read VAPID keys from the environment or generate new ones */
    protected _readOrGenerateVAPIDKeys(): Required<RequestOptions>["vapidDetails"] {
        const subject = getEnvStringOptional(ENV_VAPID_SUBJECT);
        const publicKey = getEnvStringOptional(ENV_VAPID_PUBLIC);
        const privateKey = getEnvStringOptional(ENV_VAPID_PRIVATE);
        if (subject != null && publicKey != null && privateKey != null) {
            return { subject, publicKey, privateKey };
        } else {
            const result = generateVAPIDKeys();
            console.log(`${ENV_VAPID_SUBJECT}="mailto:xxx@xxx.com|https://www.xxx.com/"`);
            console.log(`${ENV_VAPID_PUBLIC}="${result.publicKey}"`);
            console.log(`${ENV_VAPID_PRIVATE}="${result.privateKey}"`);
            throw "Invalid VAPID keys, use generated keys above in your env file";
        }
    }

    /** API : Get public API key for the client to register */
    protected _getKey(): Promise<string> {
        return Promise.resolve(this._vapidDetails.publicKey);
    }

    /** API : Register user subscription */
    protected _subscribe(subscription: PushSubscription): Promise<boolean> {
        return this._addSubscription(subscription);
    }

    //#endregion
}