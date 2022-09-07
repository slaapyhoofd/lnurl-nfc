'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePayment = exports.handleLNURL = exports.bin2String = exports.lnurlDecode = exports.NFCReader = void 0;
const bech32_1 = require("bech32");
class NFCReader {
    constructor() {
        this.listening = false;
        // Checks if Web NFC is present
        if ('NDEFReader' in window) {
            this.available = true;
            this.ndefReader = new NDEFReader();
        }
        else {
            this.available = false;
        }
    }
    listen(callback) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.available && this.ndefReader && !this.listening) {
                yield this.ndefReader.scan();
                this.ndefReader.addEventListener('readingerror', () => {
                    throw new Error('Error reading nfc');
                });
                // @ts-ignore
                this.ndefReader.addEventListener('reading', ({ message }) => {
                    const record = message.records[0];
                    const textDecoder = new TextDecoder('utf-8');
                    // Decode NDEF data from tag, and remove lightning: prefix
                    const lnurl = textDecoder.decode(record.data);
                    // return the decoded lnurl
                    callback(lnurl);
                });
                this.listening = true;
            }
        });
    }
}
exports.NFCReader = NFCReader;
function lnurlDecode(lnurl) {
    if (lnurl.indexOf('lnurlw:') !== -1) {
        // boltcard support
        return lnurl.replace('lnurlw:', 'https:');
    }
    const result = bech32_1.bech32.decode(lnurl.replace('lightning:', ''), 2000);
    const requestByteArray = bech32_1.bech32.fromWords(result.words);
    return bin2String(requestByteArray);
}
exports.lnurlDecode = lnurlDecode;
function bin2String(array) {
    let result = '';
    for (let i = 0; i < array.length; i++) {
        result += String.fromCharCode(array[i]);
    }
    return result;
}
exports.bin2String = bin2String;
function handleLNURL(lnurl, invoice, proxy) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const decoded = lnurlDecode(lnurl);
            const { callback, k1, reason, status } = yield (yield fetch(`${proxy}?url=${decoded}`)).json();
            return status === 'ERROR'
                ? {
                    success: false,
                    message: reason,
                }
                : handlePayment(callback, k1, invoice, proxy);
        }
        catch (e) {
            return {
                success: false,
                message: e.message,
            };
        }
    });
}
exports.handleLNURL = handleLNURL;
function handlePayment(callback, k1, invoice, proxy) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const paymentRequest = `${callback}?k1=${k1}&pr=${invoice.replace('lightning:', '')}`;
            const paymentResult = yield (yield fetch(`${proxy}?url=${encodeURIComponent(paymentRequest)}`)).json();
            return paymentResult.status === 'ERROR'
                ? {
                    success: false,
                    message: paymentResult.reason,
                }
                : {
                    success: true,
                    message: 'invoice paid!',
                };
        }
        catch (e) {
            return {
                success: false,
                message: e.message,
            };
        }
    });
}
exports.handlePayment = handlePayment;
