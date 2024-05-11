import { Score } from "@eurekai/shared/src/entities";
import { AbstractDTOElement } from "./abstract.dto.element";

export interface ScoreInfo {
    score: Score;
    picturesCount: number;
}

export class ScoreElement extends AbstractDTOElement<ScoreInfo> {

    constructor(data: ScoreInfo) {
        super(data, require("./score.element.html").default);
    }

    /** utility attribute to light the star */
    public get star1(): boolean {
        return this.data.score >= 1;
    }
    /** utility attribute to light the star */
    public get star2(): boolean {
        return this.data.score >= 2;
    }
    /** utility attribute to light the star */
    public get star3(): boolean {
        return this.data.score >= 3;
    }
    /** utility attribute to light the star */
    public get star4(): boolean {
        return this.data.score >= 4;
    }

}

customElements.define("custom-score", ScoreElement);