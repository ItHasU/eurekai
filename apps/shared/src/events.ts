export type AppEvents = {
    generating: {
        /** Count of images pending for generation */
        count: number
    };
    /** 
     * Sent by a client to ask the server to broadcast the current generation count.
     * This is typically sent once the websocket is opened because, otherwise, the client
     * would have to wait for the next picture to start or end to get the count.
     */
    generatingRefresh: {};
}
