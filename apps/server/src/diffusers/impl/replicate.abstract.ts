import { asNamed } from "@dagda/shared/entities/named.types";
import { AppTypes } from "@eurekai/shared/src/entities";
import { ModelInfo } from "@eurekai/shared/src/models.api";
import Replicate from "replicate";
import { fetch } from "undici";
import { AbstractDiffuser, ImageDescription } from "../diffuser";

export type ModelIdentifier = `${string}/${string}` | `${string}/${string}:${string}`;

/** Diffuser implementation using the Replicate WebService */
export abstract class ReplicateAbstract<T extends object> extends AbstractDiffuser {

    protected _replicate: Replicate;

    public constructor(token: string, protected _model: ModelIdentifier) {
        super();
        this._replicate = new Replicate({
            auth: token
        });
    }

    /** @inheritdoc */
    public override getLock(options: ImageDescription): string | null {
        // Can generate has many images as necessary in parallel
        return null;
    }

    /** @inheritdoc */
    public override getModelInfo(): ModelInfo {
        return {
            uid: `replicate_${this._model}`,
            displayName: `[Replicate] ${this._model.replace(/\:.*/, "")}`,
            size: 1024
        };
    }

    /** Create input for the target Replicate API from the image description */
    protected abstract _getInputFromImageDescription(options: ImageDescription): T;

    /** Get the closest ratio */
    protected _getClosestRatio<Ratio extends `${number}:${number}`>(options: ImageDescription, knownRatios: Ratio[]): Ratio | "1:1" {
        const ratio = options.width / options.height;
        let closest: Ratio | "1:1" = "1:1";
        let minDiff = Number.POSITIVE_INFINITY;
        for (const knownRatio of knownRatios) {
            let sizes = knownRatio.split(":").map(s => +s);
            if (sizes.length != 2) {
                continue;
            }
            const r = sizes[0] / sizes[1];
            const diff = Math.abs(ratio - r);
            if (diff < minDiff) {
                minDiff = diff;
                closest = knownRatio;
            }
        }
        return closest;
    }

    /** @inheritdoc */
    public override async txt2img(options: ImageDescription): Promise<{ data: AppTypes["BASE64_DATA"] }> {
        // -- Call tge API --
        const output = await this._replicate.run(
            this._model,
            {
                input: this._getInputFromImageDescription(options)
            },
            (prediction) => {
                console.log(`${prediction.created_at} >> ${prediction.completed_at ?? "?"}`);
            }
        );

        // -- Get the image URL --
        let url: string;
        if (Array.isArray(output)) {
            const urls: string[] = output as string[];
            if (urls.length != 1) {
                console.error(output);
                throw new Error(`Expecting only one URL`);
            }
            url = urls[0];
        } else if (typeof output === "string") {
            url = output;
        } else {
            console.error(output);
            throw new Error(`Invalid response format. Expecting array or string, got: ${typeof output}`);
        }

        if (typeof url !== "string") {
            console.error(url);
            throw new Error(`Invalid url, expecting string, got: ${typeof url}`);
        }

        // -- Fetch the image --
        // Fetch the URL and convert the received image to base64
        const response = await fetch(url);

        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        return { data: asNamed(Buffer.from(buffer).toString("base64")) };
    }
}