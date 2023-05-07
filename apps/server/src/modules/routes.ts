import { AbstractDataWrapper } from "@eurekai/shared/src/data";
import { Router } from "express";

/** Builds a router that will bind all routes of data to routes */
export function buildRoutes(data: AbstractDataWrapper): Router {
    const router: Router = Router();

    router.post("/:method", async (req, res) => {
        try {
            const method = req.params.method;
            const args: any[] = req.body ?? [];
            console.debug(`Calling ${method} with args: ${JSON.stringify(args)}`);
            let result = await (data as any)[method](...args);
            if (result === void(0)) {
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