import { Express, Request, RequestHandler, Response, Router } from 'express';
import * as session from "express-session";
import { IncomingMessage } from "http";
import { randomBytes } from "node:crypto";
import passport from 'passport';
import * as google from 'passport-google-oauth20';
import { getEnvStringOptional } from "../tools/config";

const ENV_SESSION_SECRET = "SESSION_SECRET";
/** Lifetime of a session without any request, pushed back on each request */
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
/** How long the answer of the session verifier is reused, see AuthOptions.sessionVerifier */
const USER_CHECK_TTL_MS = 60 * 1000;

export interface AuthStrategy {
    name: string;
    displayName: string;
    strategy: passport.Strategy;
}

enum AuthStrategyType {
    GOOGLE = "google"
}


/** Tells whether a user may log in, called once when the login succeeds */
export type Verifier = (profile: passport.Profile) => Promise<boolean> | boolean;
/** Tells whether a user may still use its session, see AuthOptions.sessionVerifier */
export type SessionVerifier = (userId: string) => Promise<boolean> | boolean;

export interface AuthOptions {
    /**
     * Where the sessions are kept. In memory when not set : they are all lost when the server
     * restarts, and everybody has to log in again.
     */
    store?: session.Store;
    /**
     * Called with the id of the user (the id of its profile) on the requests carrying a session.
     * Once a session is kept for weeks, this is what allows cutting the access of a user before
     * the session expires. Its answer is reused for USER_CHECK_TTL_MS, so a request does not cost
     * a query : a user is locked out at most that long after being disabled.
     * When not set, a session stays valid until it expires.
     */
    sessionVerifier?: SessionVerifier;
}

export class AuthHandler {

    private readonly _router: Router = Router();
    private readonly _strategies: AuthStrategy[] = [];

    /** Kept to read the session of the requests express does not handle, see isRequestAuthenticated */
    private _sessionMiddleware: RequestHandler | null = null;
    /** Last answers of the session verifier, by user id */
    private readonly _checkedUsers: Map<string, { valid: boolean, checkedAt: number }> = new Map();

    /**
     * @param _publicPaths Prefixes of the paths served without being logged in. Some files are
     * fetched by the browser without the session cookie : the manifest (required to install the
     * application, and so to get push notifications on iOS) and the icons it references.
     */
    public constructor(protected readonly _app: Express, protected _baseURL: string, protected _verifier: Verifier, protected readonly _publicPaths: string[] = [], protected readonly _options: AuthOptions = {}) {
        this._initialize();
    }

    protected _initialize(): void {
        // -- Configure the app required middlewares --------------------------
        this._sessionMiddleware = session.default({
            store: this._options.store ?? new session.MemoryStore(),
            secret: _getSessionSecret(),
            // Only written when modified : with a store in a database, rewriting the session of
            // every request (each thumbnail of a page included) would cost as many writes. Its
            // expiration is pushed back by the store's touch() instead.
            resave: false,
            // Nothing is stored until the user logs in, so the requests of anonymous visitors
            // (or bots) hitting the login page do not fill the store
            saveUninitialized: false,
            rolling: true,
            cookie: {
                maxAge: SESSION_LIFETIME_MS
            }
        });
        this._app.use(this._sessionMiddleware);
        this._app.use(passport.initialize());
        this._app.use(passport.session());

        // -- Configure the app to reject any unauthenticated request ---------
        this._app.use((req, res, next) => {
            // Send unauthorized if not logged in
            if (req.path.startsWith("/login") || this._publicPaths.some(path => req.path.startsWith(path))) {
                // Allow login routes and public files
                next();
            } else if (!req.user) {
                res.redirect("/login");
            } else {
                next();
            }
        });

        // -- Initialize passport ---------------------------------------------
        // Only the id of the user is kept in the session, not its whole profile : that is all the
        // requests need, and the session verifier looks the user up by this id.
        passport.serializeUser(function (user, done) {
            done(null, (user as passport.Profile).id);
        });

        passport.deserializeUser((id: unknown, done: (err: unknown, user?: Express.User | false) => void) => {
            if (typeof id !== "string") {
                // Not written by serializeUser above : the user logs in again
                done(null, false);
                return;
            }
            // false makes passport drop the login from the session, the request is then
            // handled as anonymous and redirected to the login page
            this._isUserValid(id).then(valid => done(null, valid ? { id } : false), done);
        });

        this._app.use(this._router);

        // -- Create router ---------------------------------------------------

        // Register login landing page
        this._router.get("/login", (req, res) => {
            if (this._strategies.length === 0) {
                res.send("No login strategy registered");
                return;
            } else if (this._strategies.length === 1) {
                res.redirect(`/login/${this._strategies[0].name}`);
                return;
            } else {
                let content: string = `<h1>Login</h1><ul>`;
                for (const strategy of this._strategies) {
                    content += `<li><a href="/login/${strategy.name}">${strategy.displayName}</a></li>`;
                };
                content += "</ul>";
                res.send(content);
            }
        });

        // Register logout route
        this._router.get("/logout", (req, res, next) => {
            req.logout((err) => {
                if (err) {
                    return next(err);
                } else {
                    res.redirect('/');
                }
            });
        });

    }

    /**
     * Tell whether a request express never sees comes from a logged in user. This is the case of
     * the websocket upgrade : the HTTP server hands it to ws directly, so none of the middlewares
     * above runs on it.
     * The session is only read, never written : an upgrade has no response to carry a cookie.
     */
    public isRequestAuthenticated(req: IncomingMessage): Promise<boolean> {
        const sessionMiddleware = this._sessionMiddleware;
        if (sessionMiddleware == null) {
            return Promise.resolve(false);
        }
        return new Promise<unknown>((resolve, reject) => {
            // express-session only needs the request to load the session : the response is used to
            // write the cookie once it ends, which never happens here
            sessionMiddleware(req as Request, {} as Response, (err?: unknown) => {
                if (err) {
                    reject(err);
                } else {
                    // Where passport stores what serializeUser returned
                    resolve((req as unknown as { session?: { passport?: { user?: unknown } } }).session?.passport?.user);
                }
            });
        }).then(userId => typeof userId === "string" ? this._isUserValid(userId) : false);
    }

    /** Ask the session verifier, if any, reusing its recent answers */
    protected async _isUserValid(userId: string): Promise<boolean> {
        const verifier = this._options.sessionVerifier;
        if (verifier == null) {
            return true;
        }
        const now = Date.now();
        const checked = this._checkedUsers.get(userId);
        if (checked != null && now - checked.checkedAt < USER_CHECK_TTL_MS) {
            return checked.valid;
        }
        // Not cached on error : the next request asks again
        const valid = await verifier(userId);
        this._checkedUsers.set(userId, { valid, checkedAt: now });
        return valid;
    }

    /** Register a strategy specific to Google accounts SSO */
    public registerGoogleStrategy(clientId: string, clientSecret: string): void {
        // Check if the strategy is already registered
        if (this._strategies.find(s => s.name === AuthStrategyType.GOOGLE)) {
            throw new Error("Google strategy already registered");
        }

        // -- Create the strategy ---------------------------------------------
        const strategy = new google.Strategy({
            clientID: clientId,
            clientSecret: clientSecret,
            callbackURL: this.getCallbackURL(AuthStrategyType.GOOGLE),
            scope: ['profile']
        }, (accessToken: string, refreshToken: string, profile: google.Profile, done: google.VerifyCallback) => {
            Promise.resolve().then(() => {
                return this._verifier(profile);
            }).then(isUserValid => {
                if (isUserValid) {
                    done(null, profile);
                } else {
                    done(null, false);
                }
            }).catch(err => done(err));
        });

        // Register the strategy
        this.registerStrategy({
            name: AuthStrategyType.GOOGLE,
            displayName: "Google",
            strategy
        });
    }

    /**
     * Register a new strategy.
     * This function will register the strategy in passport and create the required routes
     */
    public registerStrategy(strategy: AuthStrategy): void {
        this._strategies.push(strategy);

        // Register the strategy in passport
        passport.use(strategy.name, strategy.strategy);

        // Redirect to the strategy login page
        this._router.get(`/login/${strategy.name}`, passport.authenticate(strategy.strategy));
        // Handle strategy login callback
        this._router.get(AuthHandler.getCallbackPath(strategy.name), passport.authenticate(strategy.strategy, {
            successReturnToOrRedirect: '/',
            failureRedirect: '/login'
        }));
    }

    /** Get the callback URL that will be registered by @see registerStrategy() */
    public getCallbackURL(strategyName: string): string {
        // Remove trailing slash if any
        const baseURL = this._baseURL.endsWith("/") ? this._baseURL.slice(0, -1) : this._baseURL;
        return `${baseURL}${AuthHandler.getCallbackPath(strategyName)}`;
    }

    /** Get the callback URL that will be registered by @see registerStrategy() */
    public static getCallbackPath(strategyName: string): string {
        return `/login/redirect/${strategyName}`;
    }
}

/**
 * The secret signing the session cookies, read from the environment.
 * It must not change from one start to the next, or every cookie becomes invalid and everybody has
 * to log in again, whatever the store. When it is not set, a random one is used for this run only
 * and printed, to be copied in the environment.
 */
function _getSessionSecret(): string {
    const secret = getEnvStringOptional(ENV_SESSION_SECRET);
    if (secret != null && secret !== "") {
        return secret;
    }
    const generated = randomBytes(32).toString("hex");
    console.warn(`${ENV_SESSION_SECRET} is not set, the users will have to log in again after each restart. Add the following line to the environment to keep them logged in :`);
    console.warn(`${ENV_SESSION_SECRET}=${generated}`);
    return generated;
}