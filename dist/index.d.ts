export interface IPaymentResult {
    success: boolean;
    message: string;
}
export declare class NFCReader {
    private readonly available;
    private readonly ndefReader;
    private listening;
    constructor();
    listen(callback: (lnurl: string) => void): Promise<void>;
}
export declare function lnurlDecode(lnurl: string): string;
export declare function bin2String(array: number[]): string;
export declare function handleLNURL(lnurl: string, invoice: string, proxy: string): Promise<IPaymentResult>;
export declare function handlePayment(callback: string, k1: string, invoice: string, proxy: string): Promise<IPaymentResult>;
