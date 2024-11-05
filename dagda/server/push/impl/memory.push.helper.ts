import { deepEqual } from "@dagda/shared/tools/objects";
import { PushSubscription } from "web-push";
import { AbstractPushHelper } from "../push.helper";

/** Simple implementation that will store subscriptions in memory */
export class MemoryPushHelper extends AbstractPushHelper {

    protected readonly _subscriptions: PushSubscription[] = [];

    protected _getSubscriptions(): Promise<PushSubscription[]> {
        return Promise.resolve(this._subscriptions);
    }

    protected _addSubscription(subscription: PushSubscription): Promise<boolean> {
        for (const s of this._subscriptions) {
            if (deepEqual(s, subscription)) {
                return Promise.resolve(false);
            }
        }

        this._subscriptions.push(subscription);
        return Promise.resolve(true);
    }

    protected _deleteSubscription(subscription: PushSubscription): Promise<void> {
        throw new Error("Method not implemented.");
    }

}