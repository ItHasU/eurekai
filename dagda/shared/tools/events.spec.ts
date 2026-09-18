import * as assert from "assert";
import { describe } from "mocha";
import { EventHandlerData, EventHandlerImpl, EventListener } from "./events";

type TestEvents = {
    ping: { value: number };
}

describe("EventHandlerImpl", () => {

    it("fires an event to every listener", () => {
        const data: EventHandlerData<TestEvents> = {};
        const received: number[] = [];
        EventHandlerImpl.on<TestEvents, "ping">(data, "ping", (event) => received.push(event.data.value));
        EventHandlerImpl.on<TestEvents, "ping">(data, "ping", (event) => received.push(event.data.value * 10));

        EventHandlerImpl.fire<TestEvents, "ping">(data, "ping", { value: 1 });

        assert.deepStrictEqual(received, [1, 10]);
    });

    it("stops notifying a listener that was removed", () => {
        const data: EventHandlerData<TestEvents> = {};
        const received: number[] = [];
        const listener: EventListener<TestEvents["ping"]> = (event) => received.push(event.data.value);
        EventHandlerImpl.on<TestEvents, "ping">(data, "ping", listener);

        EventHandlerImpl.fire<TestEvents, "ping">(data, "ping", { value: 1 });
        EventHandlerImpl.off<TestEvents, "ping">(data, "ping", listener);
        EventHandlerImpl.fire<TestEvents, "ping">(data, "ping", { value: 2 });

        assert.deepStrictEqual(received, [1], "the listener must not be notified once removed");
    });

    it("only removes the listener passed", () => {
        const data: EventHandlerData<TestEvents> = {};
        const received: string[] = [];
        const kept: EventListener<TestEvents["ping"]> = () => received.push("kept");
        const removed: EventListener<TestEvents["ping"]> = () => received.push("removed");
        EventHandlerImpl.on<TestEvents, "ping">(data, "ping", kept);
        EventHandlerImpl.on<TestEvents, "ping">(data, "ping", removed);

        EventHandlerImpl.off<TestEvents, "ping">(data, "ping", removed);
        EventHandlerImpl.fire<TestEvents, "ping">(data, "ping", { value: 1 });

        assert.deepStrictEqual(received, ["kept"]);
    });

    it("ignores the removal of a listener that was never registered", () => {
        const data: EventHandlerData<TestEvents> = {};
        // On an event nobody ever listened to, and on an event with other listeners
        EventHandlerImpl.off<TestEvents, "ping">(data, "ping", () => { });
        EventHandlerImpl.on<TestEvents, "ping">(data, "ping", () => { });
        EventHandlerImpl.off<TestEvents, "ping">(data, "ping", () => { });

        let received: number = 0;
        EventHandlerImpl.on<TestEvents, "ping">(data, "ping", () => received++);
        EventHandlerImpl.fire<TestEvents, "ping">(data, "ping", { value: 1 });
        assert.strictEqual(received, 1);
    });

});
