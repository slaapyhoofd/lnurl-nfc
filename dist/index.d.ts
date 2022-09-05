declare class NFCReader {
    private readonly available;
    private readonly ndefReader;
    private listening;
    constructor();
    listen(callback: (lnurl: string) => void): Promise<void>;
}
export declare function lnurlDecode(lnurl: string): string;
export declare const nfcReader: NFCReader;
export {};
