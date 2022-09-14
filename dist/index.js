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
exports.handlePayment = exports.handleLNURL = exports.NFCReader = exports.ErrorReason = void 0;
const bech32_1 = require("bech32");
var ErrorReason;
(function (ErrorReason) {
    ErrorReason[ErrorReason["unavailable"] = 0] = "unavailable";
    ErrorReason[ErrorReason["aborted"] = 1] = "aborted";
    ErrorReason[ErrorReason["scanInProgress"] = 2] = "scanInProgress";
    ErrorReason[ErrorReason["permissionDenied"] = 3] = "permissionDenied";
    ErrorReason[ErrorReason["readingError"] = 4] = "readingError";
    ErrorReason[ErrorReason["noLnurlFound"] = 5] = "noLnurlFound";
})(ErrorReason = exports.ErrorReason || (exports.ErrorReason = {}));
class NFCReader {
    constructor() {
        // Checks if Web NFC is present
        if ('NDEFReader' in window) {
            this.available = true;
            this.ndefReader = new NDEFReader();
        }
        else {
            this.available = false;
        }
    }
    listen(signal) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.available || !this.ndefReader) {
                return Promise.reject(ErrorReason.unavailable);
            }
            try {
                yield this.ndefReader.scan(signal === undefined ? undefined : { signal });
            }
            catch (e) {
                if (e instanceof DOMException && !!e.name) {
                    switch (e.name) {
                        case 'AbortError':
                            return Promise.reject(ErrorReason.aborted);
                        case 'InvalidStateError':
                            return Promise.reject(ErrorReason.scanInProgress);
                        case 'NotAllowedError':
                            return Promise.reject(ErrorReason.permissionDenied);
                        case 'NotSupportedError':
                            return Promise.reject(ErrorReason.unavailable);
                    }
                }
                throw e;
            }
            return new Promise((resolve, reject) => {
                if (!this.ndefReader) {
                    return reject(ErrorReason.unavailable);
                }
                if (signal !== undefined) {
                    signal.onabort = () => reject(ErrorReason.aborted);
                }
                this.ndefReader.onreadingerror = () => this._onReadingError(reject);
                this.ndefReader.onreading = (event) => this._onReading(event, resolve, reject);
            });
        });
    }
    _onReadingError(reject) {
        return reject(ErrorReason.readingError);
    }
    _onReading(event, resolve, reject) {
        if (!event ||
            !event.message ||
            !event.message.records ||
            !Array.isArray(event.message.records)) {
            return reject(ErrorReason.readingError);
        }
        const decoder = new TextDecoder('utf-8');
        const alternatives = [];
        for (let record of event.message.records) {
            if (!record || !record.data) {
                continue;
            }
            try {
                const currentValue = decoder.decode(record.data);
                const lowercase = currentValue.toLowerCase();
                if (lowercase.startsWith('lightning:')) {
                    // Is an oldschool bech32 encoded lnurlw, remove lightning: and bech32 decode the rest.
                    const lnurl = currentValue.slice('lightning:'.length);
                    const decoded = bech32_1.bech32.decode(lnurl, 2000);
                    const bytes = bech32_1.bech32.fromWords(decoded.words);
                    const result = decoder.decode(new Uint8Array(bytes));
                    return resolve(result);
                }
                else if (lowercase.startsWith('lnurlw://')) {
                    // Is a new age lnurlw. Replace lnurlw with https, or http if it's an onion.
                    let replaceWith = 'https://';
                    if (_isOnion(currentValue)) {
                        replaceWith = 'http://';
                    }
                    return resolve(replaceWith + currentValue.slice(9));
                }
                else if (lowercase.startsWith('lnurl') && lowercase.indexOf(':') === -1) {
                    // Might be lnurl without 'lightning:' prefix. If decoding with bech32 works, use that.
                    const decoded = bech32_1.bech32.decode(currentValue, 2000);
                    const bytes = bech32_1.bech32.fromWords(decoded.words);
                    const result = decoder.decode(new Uint8Array(bytes));
                    return resolve(result);
                }
                else if (lowercase.startsWith('https://')) {
                    // https:// might be the real deal. Add as alternative.
                    alternatives.push(currentValue);
                }
                else if (lowercase.startsWith('http://')) {
                    // http:// might be the real deal if it's an onion. Add as alternative.
                    if (_isOnion(currentValue)) {
                        alternatives.push(currentValue);
                    }
                }
            }
            catch (_a) {
                /* Squelch. Decoding error. Record is garbage. */
            }
        }
        // Apparently there was no good lnurl match in the ndef records array.
        // Maybe there was a less obvious match. If so, return that.
        if (alternatives.length > 0) {
            return resolve(alternatives[0]);
        }
        return reject(ErrorReason.noLnurlFound);
    }
}
exports.NFCReader = NFCReader;
function _isOnion(potentialOnion) {
    const lowercase = potentialOnion.toLowerCase();
    return (lowercase &&
        (lowercase.endsWith('.onion') ||
            lowercase.indexOf('.onion/') >= 0 ||
            lowercase.indexOf('.onion?') >= 0));
}
function handleLNURL(lnurl, invoice, proxy) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const encodedLnurl = encodeURIComponent(lnurl);
            const response = yield fetch(`${proxy}?url=${encodedLnurl}`);
            const { callback, k1, reason, status } = yield response.json();
            if (status === 'ERROR') {
                return {
                    success: false,
                    message: reason,
                };
            }
            if (!callback || typeof callback !== 'string' || !k1 || typeof k1 !== 'string') {
                return {
                    success: false,
                    message: 'invalid response',
                };
            }
            return handlePayment(callback, k1, invoice, proxy);
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
            const separator = callback.indexOf('?') === -1 ? '?' : '&';
            const paymentRequest = `${callback}${separator}k1=${k1}&pr=${invoice.replace('lightning:', '')}`;
            const paymentResult = yield (yield fetch(`${proxy}?url=${encodeURIComponent(paymentRequest)}`)).json();
            if (paymentResult.status === 'OK') {
                return {
                    success: true,
                    message: 'invoice payment initiated',
                };
            }
            if (paymentResult.status === 'ERROR') {
                return {
                    success: false,
                    message: paymentResult.reason,
                };
            }
            return {
                success: false,
                message: 'Invalid reponse',
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
