import { EventHandler } from "./event";

class Test {

    protected _count: number = 0;

    /** Count elements */
    public readonly stepEvent = new EventHandler<number>();

    public step(): void {
        this._count++;
        this.stepEvent.fire(this._count);
    }
}

const t1: Test = new Test();

t1.stepEvent.on((e) => {
    console.log("At step", e.data);
    if (e.data > 10) {
        return false; // Stop receiving events
    }
});

for (let i = 0; i < 100; i++) {
    t1.step();
}