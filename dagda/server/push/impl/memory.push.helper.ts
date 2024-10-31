import { deepEqual } from "@dagda/shared/tools/objects";
import { PushSubscription } from "web-push";
import { AbstractPushHelper, UserUID } from "../push.helper";

export class MemoryPushHelper extends AbstractPushHelper {

    protected readonly _usersSubscriptions: Map<UserUID, PushSubscription[]> = new Map();

    protected _getUserSubscriptions(user?: UserUID): Promise<PushSubscription[]> {
        debugger;
        if (user == null) {
            let result: PushSubscription[] = [];
            for (const subscriptions of this._usersSubscriptions.values()) {
                result = result.concat(subscriptions);
            }
            return Promise.resolve(result);
        } else {
            return Promise.resolve(this._usersSubscriptions.get(user) ?? []);
        }
    }

    protected _addUserSubscription(user: UserUID, subscription: PushSubscription): Promise<boolean> {
        debugger;
        const userSubscriptions: PushSubscription[] = this._usersSubscriptions.get(user) ?? [];
        for (const s of userSubscriptions) {
            if (deepEqual(s, subscription)) {
                return Promise.resolve(false);
            }
        }

        userSubscriptions.push(subscription);
        this._usersSubscriptions.set(user, userSubscriptions);
        return Promise.resolve(true);
    }

    protected _deleteSubscription(subscription: PushSubscription): Promise<void> {
        throw new Error("Method not implemented.");
    }

}