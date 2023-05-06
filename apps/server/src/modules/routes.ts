import { AbstractDataWrapper } from "@eurekai/shared/src/data";
import { Router } from "express";

/** Builds a router that will bind all routes of data to routes */
export function buildRoutes(data: AbstractDataWrapper): Router {
    const router: Router = Router();

    router.post("/:method", async (req, res) => {
        const method = req.params.method;
        const args = JSON.parse(req.body);
        const result = await (data as any)[method](...args);
        res.json(result);
    });

    return router;
}