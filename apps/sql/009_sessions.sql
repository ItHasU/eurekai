-- Sessions of the logged in users (see dagda/server/express/impl/sql.session.store.ts), kept in
-- the database so that a restart of the server does not log everybody out. data is the session
-- as JSON, expire a timestamp in milliseconds. The server deletes the expired sessions itself.
CREATE TABLE IF NOT EXISTS public."sessions" (
    sid text PRIMARY KEY,
    data text NOT NULL,
    expire bigint NOT NULL
);
-- The expired sessions are looked up by their expiration to be deleted
CREATE INDEX IF NOT EXISTS "sessions_expire" ON public."sessions" (expire);
