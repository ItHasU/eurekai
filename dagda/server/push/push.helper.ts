import { PUSH_URL, PushAPI } from "@dagda/shared/push/types";
import { deepEqual } from "@dagda/shared/tools/objects";
import { Application } from "express";
import { generateVAPIDKeys, PushSubscription, RequestOptions, sendNotification, SendResult } from "web-push";
import { registerAPI } from "../api";
import { getEnvStringOptional } from "../tools/config";

const ENV_VAPID_SUBJECT = "PUSH_SUBJECT";
const ENV_VAPID_PUBLIC = "PUSH_PUBLIC";
const ENV_VAPID_PRIVATE = "PUSH_PRIVATE";

/** An utility class to manage push notifications */
export class PushHelper {

    protected readonly _vapidDetails: Required<RequestOptions>["vapidDetails"];

    protected readonly _subscriptions: PushSubscription[] = [];

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
        console.log(`push (${this._subscriptions.length}):`, message);

        // -- Send Notification to all subscriptions --
        const promises: Promise<SendResult>[] = [];
        for (const subscription of this._subscriptions) {
            const p = sendNotification(subscription, message, {
                vapidDetails: this._vapidDetails
            });
            promises.push(p);
        }

        // -- Wait for everything to be done --
        await Promise.allSettled(promises);
    }


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

    protected _getKey(): Promise<string> {
        return Promise.resolve(this._vapidDetails.publicKey);
    }

    protected _subscribe(subscription: PushSubscription): Promise<boolean> {
        // -- Check if subscription is already existing --
        for (const existingSubscription of this._subscriptions) {
            if (deepEqual(subscription, existingSubscription)) {
                return Promise.resolve(false);
            }
        }

        // -- Register subscription --
        this._subscriptions.push(subscription);

        return Promise.resolve(true);
    }
}