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
exports.handlePayment = exports.handleLNURL = exports.bech32Decode = exports.isValidLnurl = exports.decodeLnurl = exports.LnurlResult = exports.NFCReader = exports.ErrorReason = void 0;
const bech32_1 = require("bech32");
const util_1 = require("util");
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
            // @ts-ignore
            this.ndefReader = new window.NDEFReader();
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
        const alternatives = [];
        for (let record of event.message.records) {
            if (!record || !record.data) {
                continue;
            }
            const decodeResult = _decodeLnurlRecord(record);
            switch (decodeResult.isLnurl) {
                case LnurlResult.Yes:
                    return resolve(decodeResult.lnurl);
                case LnurlResult.Maybe:
                    alternatives.push(decodeResult.lnurl);
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
function _decodeLnurlRecord(record) {
    var _a;
    if (!record || !record.data) {
        return {
            isLnurl: LnurlResult.No,
        };
    }
    const decoder = new util_1.TextDecoder((_a = record.encoding) !== null && _a !== void 0 ? _a : 'utf-8');
    try {
        const recordData = decoder.decode(record.data);
        return decodeLnurl(recordData);
    }
    catch (error) {
        return {
            isLnurl: LnurlResult.No,
        };
    }
}
var LnurlResult;
(function (LnurlResult) {
    LnurlResult[LnurlResult["No"] = 0] = "No";
    LnurlResult[LnurlResult["Maybe"] = 1] = "Maybe";
    LnurlResult[LnurlResult["Yes"] = 2] = "Yes";
})(LnurlResult = exports.LnurlResult || (exports.LnurlResult = {}));
function decodeLnurl(lnurlCandidate) {
    if (!lnurlCandidate) {
        return {
            isLnurl: LnurlResult.No,
        };
    }
    try {
        const decoder = new util_1.TextDecoder('utf-8');
        const lowercase = lnurlCandidate.toLowerCase();
        if (lowercase.startsWith('lightning:')) {
            // Is an oldschool bech32 encoded lnurlw, remove lightning: and bech32 decode the rest.
            const lnurl = lnurlCandidate.slice('lightning:'.length);
            const result = bech32Decode(lnurl);
            if (isValidLnurl(result)) {
                return {
                    isLnurl: LnurlResult.Yes,
                    lnurl: result,
                };
            }
            return {
                isLnurl: LnurlResult.No,
            };
        }
        else if (lowercase.startsWith('lnurlw://')) {
            // Is a new age lnurlw. Replace lnurlw with https, or http if it's an onion.
            let replaceWith = 'https://';
            if (_isOnion(lnurlCandidate)) {
                replaceWith = 'http://';
            }
            return {
                isLnurl: LnurlResult.Yes,
                lnurl: replaceWith + lnurlCandidate.slice(9),
            };
        }
        else if (lowercase.startsWith('lnurl') && lowercase.indexOf(':') === -1) {
            // Might be lnurl without 'lightning:' prefix. If decoding with bech32 works, use that.
            const result = bech32Decode(lnurlCandidate);
            if (isValidLnurl(result)) {
                return {
                    isLnurl: LnurlResult.Yes,
                    lnurl: result,
                };
            }
            return {
                isLnurl: LnurlResult.No,
            };
        }
        else if (lowercase.startsWith('https://')) {
            // https:// might be the real deal. Add as alternative.
            return {
                isLnurl: LnurlResult.Maybe,
                lnurl: lnurlCandidate,
            };
        }
        else if (lowercase.startsWith('http://')) {
            // http:// might be the real deal if it's an onion. Add as alternative.
            if (_isOnion(lnurlCandidate)) {
                return {
                    isLnurl: LnurlResult.Maybe,
                    lnurl: lnurlCandidate,
                };
            }
            return {
                isLnurl: LnurlResult.No,
            };
        }
    }
    catch (_a) {
        /* Squelch. Decoding error. Record is garbage. */
    }
    return {
        isLnurl: LnurlResult.No,
    };
}
exports.decodeLnurl = decodeLnurl;
function isValidLnurl(lnurl) {
    if (!lnurl) {
        return false;
    }
    if (lnurl.startsWith('https://')) {
        return true;
    }
    if (lnurl.startsWith('http://') && _isOnion(lnurl)) {
        return true;
    }
    return false;
}
exports.isValidLnurl = isValidLnurl;
function bech32Decode(data) {
    const decoder = new util_1.TextDecoder('utf-8');
    const decoded = bech32_1.bech32.decode(data, 2000);
    const bytes = bech32_1.bech32.fromWords(decoded.words);
    return decoder.decode(new Uint8Array(bytes));
}
exports.bech32Decode = bech32Decode;
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
