export interface WorkerMessage {
    id: number;
    method: "get" | "all" | "run";
    query: string;
    params: any[];
}

export interface WorkerResponse {
    id: number;
    data: any;
}