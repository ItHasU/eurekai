/**
 * Utility class passed to listeners
 * It contains the event payload and can be use to control the workflow of event listeners.
 */
declare class Event<EventData> {
    readonly data: EventData;
    constructor(data: EventData);
}
/** A base listener */
export type EventListener<EventData> = (event: Event<EventData>) => void;
/** This typings is used to associate the event name with the payload that will be associated to it on fire */
type BaseEvents = {
    [eventName: string]: unknown;
};
/** Base class to implement */
export interface EventHandler<Events extends BaseEvents> {
    /** Register an event listener that will be fired on each call event fire */
    on<EventName extends keyof Events>(eventName: EventName, listener: EventListener<Events[EventName]>): void;
}
type EventInfo<Events extends BaseEvents, EventName extends keyof Events> = {
    listeners: EventListener<Events[EventName]>[];
};
export type EventHandlerData<Events extends BaseEvents> = {
    [EventName in keyof Events]?: EventInfo<Events, EventName>;
};
export declare class EventHandlerImpl {
    /**
     * Base implementation of the EventHandler.on method.
     * Just call it in the class implementing.
     */
    static on<Events extends BaseEvents, EventName extends keyof Events>(data: EventHandlerData<Events>, eventName: EventName, listener: EventListener<Events[EventName]>): void;
    /**
     * Base implement to fire an event.
     * If you choose to create a fire method in your EventHandler, this method MUST always be protected
     * so your class is the only only one to fire an event.
     * Most of the time, you may probably just want to call directly this static method as would only gain a small amount of typings.
     */
    static fire<Events extends BaseEvents, EventName extends keyof Events>(data: EventHandlerData<Events>, eventName: EventName, eventData: Events[EventName]): void;
}
export {};
