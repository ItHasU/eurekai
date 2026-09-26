import { WebPushSubscription } from "@dagda/shared/push/api";
import { AbstractSQLRunner } from "../../sql/runner";
import { AbstractPushHelper } from "../push.helper";

/** 
 * Stores the subscriptions in a table, so they survive a restart of the server.
 * The table is expected to be :
 * (endpoint text PRIMARY KEY, p256dh text NOT NULL, auth text NOT NULL)
 */
export class SQLPushHelper extends AbstractPushHelper {

    constructor(protected readonly _db: AbstractSQLRunner, defaultSubject: string, protected readonly _table: string = "pushSubscriptions") {
        super(defaultSubject);
    }

    /** @inheritdoc */
    protected override async _getSubscriptions(): Promise<WebPushSubscription[]> {
        const rows = await this._db.all<{ endpoint: string, p256dh: string, auth: string }>(
            `SELECT "endpoint", "p256dh", "auth" FROM "${this._table}"`);
        return rows.map(row => ({
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth }
        }));
    }

    /** @inheritdoc */
    protected override _saveSubscription(subscription: WebPushSubscription): Promise<void> {
        return this._db.run(
            `INSERT INTO "${this._table}" ("endpoint", "p256dh", "auth") VALUES ($1, $2, $3)`
            + ` ON CONFLICT ("endpoint") DO UPDATE SET "p256dh"=EXCLUDED."p256dh", "auth"=EXCLUDED."auth"`,
            subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);
    }

    /** @inheritdoc */
    protected override _deleteSubscription(endpoint: string): Promise<void> {
        return this._db.run(`DELETE FROM "${this._table}" WHERE "endpoint"=$1`, endpoint);
    }
}
