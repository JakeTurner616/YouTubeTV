declare module '@gorhill/ubo-core' {
    export class StaticNetFilteringEngine {
        static create(): Promise<StaticNetFilteringEngine>;
        useLists(lists: { name: string; raw: string }[]): Promise<void>;
        matchRequest(request: {
            originURL: string;
            url: string;
            type: string;
        }): number;
        serialize(): Promise<string>;
        deserialize(data: string): Promise<void>;
    }
}
