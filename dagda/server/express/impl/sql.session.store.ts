import { SessionData, Store } from "express-session";
import { AbstractSQLRunner } from "../../sql/runner";

/**
 * How long a session may go without its expiration being written again, see touch().
 * A session is therefore dropped between its lifetime minus this delay and its full lifetime of
 * inactivity, which is fine for sessions lasting weeks.
 */
const TOUCH_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** Delay between two deletions of the expired sessions */
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;
/** Lifetime of a session whose cookie has no expiration, which should not happen with a maxAge */
const DEFAULT_LIFETIME_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TABLE = "sessions";

/**
 * Stores the sessions in a table, so the users stay logged in when the server restarts.
 * The table is expected to be :
 * (sid text PRIMARY KEY, data text NOT NULL, expire bigint NOT NULL)
 * where data is the session as JSON and expire a timestamp in milliseconds.
 *
 * Every request carrying a session cookie reads its session here, and express-session also asks
 * for its expiration to be pushed back (touch) on each of them : a page loading hundreds of
 * thumbnails would cost as many writes. Writes are therefore limited, see touch().
 */
export class SQLSessionStore extends Store {

    constructor(protected readonly _db: AbstractSQLRunner, protected readonly _table: string = DEFAULT_TABLE) {
        super();
        // Expired sessions are never returned (see get), deleting them only keeps the table small.
        // The pruning alone must not keep the process alive.
        setInterval(() => {
            this._db.run(`DELETE FROM "${this._table}" WHERE "expire"<=$1`, Date.now()).catch(e => {
                console.error("Failed to delete the expired sessions");
                console.error(e);
            });
        }, PRUNE_INTERVAL_MS).unref();
    }

    /**
     * @returns false when the table cannot be read, typically because the script creating it was
     * not applied yet. The caller is expected to fall back on another store rather than having
     * every login fail, hence a check to run before creating the store.
     */
    public static async isAvailable(db: AbstractSQLRunner, table: string = DEFAULT_TABLE): Promise<boolean> {
        try {
            await db.all(`SELECT 1 FROM "${table}" LIMIT 1`);
            return true;
        } catch (e) {
            return false;
        }
    }

    /** @inheritdoc */
    public override get(sid: string, callback: (err: any, session?: SessionData | null) => void): void {
        // An expired session is ignored rather than deleted here : the pruning takes care of it
        this._db.get<{ data: string }>(`SELECT "data" FROM "${this._table}" WHERE "sid"=$1 AND "expire">$2`, sid, Date.now())
            .then(row => callback(null, row == null ? null : JSON.parse(row.data)), callback);
    }

    /** @inheritdoc */
    public override set(sid: string, session: SessionData, callback?: (err?: any) => void): void {
        this._db.run(
            `INSERT INTO "${this._table}" ("sid", "data", "expire") VALUES ($1, $2, $3)`
            + ` ON CONFLICT ("sid") DO UPDATE SET "data"=EXCLUDED."data", "expire"=EXCLUDED."expire"`,
            sid, JSON.stringify(session), _getExpire(session))
            .then(() => callback?.(), callback);
    }

    /** @inheritdoc */
    public override destroy(sid: string, callback?: (err?: any) => void): void {
        this._db.run(`DELETE FROM "${this._table}" WHERE "sid"=$1`, sid)
            .then(() => callback?.(), callback);
    }

    /**
     * Push the expiration of a session back, called by express-session on each request whose
     * session was not modified.
     * The expiration is only written when the stored one is older than TOUCH_INTERVAL_MS, which
     * the query checks itself : at most one write per session and per day, instead of one per
     * request. The condition is evaluated in the database, so this costs no extra read.
     */
    public override touch(sid: string, session: SessionData, callback?: () => void): void {
        const expire = _getExpire(session);
        this._db.run(`UPDATE "${this._table}" SET "expire"=$1 WHERE "sid"=$2 AND "expire"<$3`, expire, sid, expire - TOUCH_INTERVAL_MS)
            .then(() => callback?.(), (e) => {
                // express-session ignores the error of a touch, the request goes on anyway
                console.error(`Failed to touch session`);
                console.error(e);
                callback?.();
            });
    }
}

/** Expiration of a session, as a timestamp in milliseconds */
function _getExpire(session: SessionData): number {
    const expires = session.cookie?.expires;
    // Once stored as JSON and read back, the date may be a string
    return expires == null ? Date.now() + DEFAULT_LIFETIME_MS : new Date(expires).getTime();
}
