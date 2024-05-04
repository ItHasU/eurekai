import { Seed } from "@eurekai/shared/src/entities";
import { AbstractDTOElement } from "./abstract.dto.element";

export interface SeedInfo {
    seed: Seed;
    picturesCount: number;
    isPreferredSeed: boolean;
}

export class SeedElement extends AbstractDTOElement<SeedInfo> {

    constructor(data: SeedInfo) {
        super(data, require("./seed.element.html").default);
    }

}

customElements.define("custom-seed", SeedElement);