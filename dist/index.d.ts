/// <reference types="w3c-web-nfc" />
export interface IPaymentResult {
    success: boolean;
    message: string;
}
export declare enum ErrorReason {
    unavailable = 0,
    aborted = 1,
    scanInProgress = 2,
    permissionDenied = 3,
    readingError = 4,
    noLnurlFound = 5
}
export declare class NFCReader {
    private readonly available;
    private readonly ndefReader;
    constructor();
    listen(signal?: AbortSignal): Promise<string>;
    _onReadingError(reject: (reason: ErrorReason) => void): void;
    _onReading(event: NDEFReadingEvent, resolve: (value: string) => void, reject: (reason: ErrorReason) => void): void;
}
export declare function handleLNURL(lnurl: string, invoice: string, proxy: string): Promise<IPaymentResult>;
export declare function handlePayment(callback: string, k1: string, invoice: string, proxy: string): Promise<IPaymentResult>;
