import { Express, Router } from 'express';
import * as session from "express-session";
import passport from 'passport';
import * as google from 'passport-google-oauth20';

export interface AuthStrategy {
    name: string;
    displayName: string;
    strategy: passport.Strategy;
}

enum AuthStrategyType {
    GOOGLE = "google"
}


export type Verifier = (profile: passport.Profile) => Promise<boolean> | boolean;
export class AuthHandler {

    private readonly _router: Router = Router();
    private readonly _strategies: AuthStrategy[] = [];

    public constructor(protected readonly _app: Express, protected _baseURL: string, protected _verifier: Verifier) {
        this._initialize();
    }

    protected _initialize(): void {
        // -- Configure the app required middlewares --------------------------
        this._app.use(session.default({
            store: new session.MemoryStore(),
            secret: _randomSecret(24) // Use random since sessions are not persisted
        }));
        this._app.use(passport.initialize());
        this._app.use(passport.session());

        // -- Configure the app to reject any unauthenticated request ---------
        this._app.use((req, res, next) => {
            // Send unauthorized if not logged in
            if (req.path.startsWith("/login") || req.path.startsWith("/assets/")) {
                // Allow login routes
                next();
            } else if (!req.user) {
                res.redirect("/login");
            } else {
                next();
            }
        });

        // -- Initialize passport ---------------------------------------------
        passport.serializeUser(function (user, done) {
            done(null, user);
        });

        passport.deserializeUser(function (id, done) {
            done(null, { id });
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

function _randomSecret(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}