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
exports.nfcReader = exports.lnurlDecode = void 0;
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
                    const lnurl = textDecoder.decode(record.data).replace('lightning:', '');
                    // return the decoded lnurl
                    callback(lnurlDecode(lnurl));
                });
                this.listening = true;
            }
        });
    }
}
function lnurlDecode(lnurl) {
    const result = bech32_1.bech32.decode(lnurl, 2000);
    const requestByteArray = bech32_1.bech32.fromWords(result.words);
    return Buffer.from(requestByteArray).toString();
}
exports.lnurlDecode = lnurlDecode;
exports.nfcReader = new NFCReader();
