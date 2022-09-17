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
export declare class LnurlReader {
    private readonly ndefReader?;
    private abortController?;
    private listening;
    constructor(onLnurlRead?: (lnurl: string) => void | Promise<void>, onReadingError?: (error: ErrorReason, detail?: Event) => void | Promise<void>);
    /**
     * Gets a value indicating whether NFC is available in the browser.
     */
    get isAvailable(): boolean;
    /**
     * Gets a value indicating whether the reader is currently listening for NFC tags.
     */
    get isListening(): boolean;
    /**
     * onLnurlRead is called with an lnurl string when a valid lnurl string is found in an NFC tag.
     */
    onLnurlRead?: (lnurl: string) => void | Promise<void>;
    /**
     * onReadingError is called with an error code and optional detail when a reading error occurs.
     * For example when the card is invalid or doesn't contain an lnurl.
     */
    onReadingError?: (error: ErrorReason, detail?: Event) => void | Promise<void>;
    /**
     * listenOnce tries to read an lnurl from a card once. Stops listening after the card is read,
     * or if a reading error occurs. If onLnurlRead or onReadingError are set, they are also invoked
     * before the Promise resolves.
     * @param signal optional {AbortSignal}
     * @returns The read lnurl
     * @reject {ErrorReason} When a reading error or permission error occurs
     * @reject {Object} When a downstream error is unhandled. (Should not happen really)
     */
    listenOnce(signal?: AbortSignal): Promise<string>;
    /**
     * startListening starts listening for NFC tags. When an lnurl is read on
     * a tag, onLnurlRead is invoked. When a reading error occurs, onReadingError
     * is invoked.
     * @param signal optional {AbortSignal} to stop listening.
     * @returns A promise that resolves when the listening successfully started.
     * @reject {ErrorReason} When there are permission issues or NFC is not available
     * @reject {Object} When there is an unhandled downstream error that makes it unable to listen.
     */
    startListening(signal?: AbortSignal): Promise<void>;
    /**
     * stopListening stops listening to NFC tags. Can be called many times.
     */
    stopListening(): void;
    /**
     * Aborts the underlying scan call, and sets listening to false.
     * @param reason
     */
    private _abort;
    /**
     * Invokes the onReadingError callback.
     * @param event optional event with additional error data.
     */
    private _onReadingError;
    /**
     * Parses the read NFC tag. If a valid lnurl is found, onLnurlRead is invoked.
     * If no valid lnurl is found onReadingError is invoked.
     * @param event NFC tag.
     */
    private _onReading;
}
/**
 * Value indicating whether a string is an lnurl link.
 */
export declare enum LnurlResult {
    No = 0,
    Maybe = 1,
    Yes = 2
}
/**
 * Decodes an lnurl string into a usable link.
 * https://bitcoin.org -> https://bitcoin.org
 * lnurlw://bitcoin.org -> https://bitcoin.org
 * lnurlw://bitcoin.onion -> http://bitcoin.onion
 * lightning:LNURL1DP68GURN8GHJ7CNFW33K76TW9EHHYECRU2TLH -> https://bitcoin.org
 * LIGHTNING:LNURL1DP68GURN8GHJ7CNFW33K76TW9EHHYECRU2TLH -> https://bitcoin.org
 * lightning:lnurl1dp68gurn8ghj7cnfw33k76tw9ehhyecru2tlh -> https://bitcoin.org
 * LIGHTNING:lnurl1dp68gurn8ghj7cnfw33k76tw9ehhyecru2tlh -> https://bitcoin.org
 * @param lnurlCandidate The lnurl string to decode.
 * @returns Value indicating whether the string is an lnurl, and if so (or maybe) returns the usable link.
 */
export declare function decodeLnurl(lnurlCandidate: string): {
    isLnurl: LnurlResult.No;
} | {
    isLnurl: LnurlResult.Maybe | LnurlResult.Yes;
    lnurl: string;
};
export declare function bech32Decode(data: string): string;
export declare function handleLNURL(lnurl: string, invoice: string, proxy: string): Promise<IPaymentResult>;
export declare function handlePayment(callback: string, k1: string, invoice: string, proxy: string): Promise<IPaymentResult>;
