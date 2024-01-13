import { Express, Router } from 'express';
import * as session from "express-session";
import passport from 'passport';

export interface AuthStrategy {
    name: string;
    displayName: string;
    strategy: passport.Strategy;
}

export class AuthHandler {

    private readonly _router: Router = Router();
    private readonly _strategies: AuthStrategy[] = [];

    public constructor(protected readonly _app: Express) {
        this._initialize();
    }

    protected _initialize(): void {
        // -- Configure the app required middlewares --------------------------
        this._app.use(session.default({ secret: 'keyboard cat' }));
        this._app.use(passport.initialize());
        this._app.use(passport.session());

        // -- Configure the app to reject any unauthenticated request ---------
        this._app.use((req, res, next) => {
            // Send unauthorized if not logged in
            if (req.path.startsWith("/login")) {
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
            console.log("serializeUser", user);
            done(null, user);
        });

        passport.deserializeUser(function (id, done) {
            console.log("deserializeUser", id);
            done(null, { id });
        });

        this._app.use(this._router);

        // -- Create router ---------------------------------------------------

        // Register login landing page
        this._router.get("/login", (req, res) => {
            let content: string = `<h1>Login</h1><ul>`;
            for (const strategy of this._strategies) {
                content += `<li><a href="/login/${strategy.name}">${strategy.displayName}</a></li>`;
            };
            content += "</ul>";
            res.send(content);
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
     * Register a new strategy 
     * This function will register the strategy in passport and create the required routes
     */
    public registerStrategy(strategy: AuthStrategy): void {
        this._strategies.push(strategy);

        // Register the strategy in passport
        passport.use(strategy.name, strategy.strategy);

        // Redirect to the strategy login page
        this._router.get(`/login/${strategy.name}`, passport.authenticate(strategy.strategy));
        // Handle strategy login callback
        this._router.get(AuthHandler.getCallbackURL(strategy.name), passport.authenticate(strategy.strategy, {
            successReturnToOrRedirect: '/',
            failureRedirect: '/login'
        }));
    }

    /** Get the callback URL that will be registered by @see registerStrategy() */
    public static getCallbackURL(strategyName: string): string {
        return `/login/redirect/${strategyName}`;
    }
}