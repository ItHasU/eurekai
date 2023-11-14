export interface WorkerRequest {
    id: number;
    method: "get" | "all" | "run";
    query: string;
    params: any[];
}

export interface WorkerResponse {
    id: number;
    error?: string;
    data: any;
}