import { Application, Router } from "express";

/** Base typing for a list of methods */
type BaseMethods = { [MethodName: string]: (...args: any) => any };

/** Builds a router that will bind all routes of data to routes */
export function buildAPIRouter<Methods extends BaseMethods>(api: Methods): Router {
    const router: Router = Router();

    router.post("/:method", async (req, res) => {
        try {
            const methodName: keyof Methods = req.params.method;
            const args: any[] = req.body ?? [];
            console.debug(`Calling ${methodName as string} with args: ${JSON.stringify(args)}`);
            const method = api[methodName];
            if (method == null) {
                res.status(404).json({ error: `No method named ${methodName as string}()` });
                return;
            }
            let result = await method(...args);
            if (result === void (0)) {
                res.json(null); // No content
            } else {
                res.json(result ?? null);
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: new String(err) });
        }
    });

    return router;
}

/** 
 * Simply register an API on the application 
 * url MUST start with a /
 */
export function registerAPI<Methods extends BaseMethods>(app: Application, url: string, api: Methods): void {
    console.log(`Registered /${url}/[${Object.keys(api).join(", ")}]`);
    app.use(`/${url}`, buildAPIRouter(api));
}