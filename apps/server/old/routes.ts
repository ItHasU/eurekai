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

    router.get("/attachment/:id", async (req, res) => {
        // Send attachment as a png image from the base 64 string
        const id = +req.params.id;
        try {
            const attachment = await data.getAttachment(id);
            if (!attachment) {
                res.status(404).send(`Attachment ${id} not found`);
            } else {
                var img = Buffer.from(attachment, 'base64');

                res.writeHead(200, {
                    'Content-Type': 'image/png',
                    'Content-Length': img.length,
                    'Cache-Control': 'max-age=86400' // 1 day in seconds
                });
                res.end(img);
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: new String(err) });
        }
    });

    return router;
}