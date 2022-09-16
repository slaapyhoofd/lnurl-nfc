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
exports.handlePayment = exports.handleLNURL = exports.bech32Decode = exports.decodeLnurl = exports.LnurlResult = exports.LnurlReader = exports.ErrorReason = void 0;
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
class LnurlReader {
    constructor(onLnurlRead, onReadingError) {
        this.listening = false;
        // Checks if Web NFC is present
        if ('NDEFReader' in window) {
            // @ts-ignore
            this.ndefReader = new window.NDEFReader();
        }
        this.onLnurlRead = onLnurlRead;
        this.onReadingError = onReadingError;
    }
    /**
     * Gets a value indicating whether NFC is available in the browser.
     */
    get isAvailable() {
        return !!this.ndefReader;
    }
    /**
     * Gets a value indicating whether the reader is currently listening for NFC tags.
     */
    get isListening() {
        return this.listening;
    }
    /**
     * listenOnce tries to read an lnurl from a card once. Stops listening after the card is read,
     * or if a reading error occurs. If onLnurlRead or onReadingError are set, they are also invoked
     * before the Promise resolves.
     * @param signal optional {AbortSignal}
     * @returns The read lnurl
     * @reject {ErrorReason} When a reading error or permission error occurs
     * @reject {Object} When a downstream error is unhandled. (Should not happen really)
     */
    listenOnce(signal) {
        return __awaiter(this, void 0, void 0, function* () {
            // Save the callbacks, so we can restore them later.
            const existingOnLnurlRead = this.onLnurlRead;
            const existingOnReadingError = this.onReadingError;
            const wasListening = this.listening;
            const done = () => {
                if (!wasListening) {
                    // Make sure to stop listening for NFC cards if we weren't listening before.
                    this.stopListening();
                }
                // Restore callbacks.
                this.onLnurlRead = existingOnLnurlRead;
                this.onReadingError = existingOnReadingError;
            };
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                // When lnurl is read, invoke the existing callback, then stop and resolve.
                this.onLnurlRead = (lnurl) => {
                    if (existingOnLnurlRead) {
                        existingOnLnurlRead(lnurl);
                    }
                    done();
                    resolve(lnurl);
                };
                // When reading error occurs, invoke the existing callback, then stop and reject.
                this.onReadingError = (error, detail) => {
                    if (existingOnReadingError) {
                        existingOnReadingError(error, detail);
                    }
                    done();
                    reject(error);
                };
                // When aborted, stop and reject
                if (signal) {
                    signal.onabort = () => {
                        done();
                        reject(ErrorReason.aborted);
                    };
                }
                // Callbacks are in place, start listening.
                if (!wasListening) {
                    try {
                        yield this.startListening(signal);
                    }
                    catch (e) {
                        reject(e);
                    }
                }
            }));
        });
    }
    /**
     * startListening starts listening for NFC tags. When an lnurl is read on
     * a tag, onLnurlRead is invoked. When a reading error occurs, onReadingError
     * is invoked.
     * @param signal optional {AbortSignal} to stop listening.
     * @returns A promise that resolves when the listening succesfully started.
     * @reject {ErrorReason} When there are permission issues or NFC is not available
     * @reject {Object} When there is an unhandled downstream error that makes it unable to listen.
     */
    startListening(signal) {
        return __awaiter(this, void 0, void 0, function* () {
            // exit early if NFC is unavailable
            if (!this.ndefReader) {
                return Promise.reject(ErrorReason.unavailable);
            }
            // If listening already exit early.
            if (this.listening) {
                return;
            }
            try {
                // Initialize an AbortController so stopListening can use it.
                this.abortController = new AbortController();
                if (signal) {
                    // If an AbortSignal is passed in, cascade to internal controller.
                    signal.onabort = (event) => this._abort(event);
                }
                // Start the scanning. Returns almost immediately, or throws.
                yield this.ndefReader.scan({ signal: this.abortController.signal });
                this.listening = true;
            }
            catch (e) {
                // Handle documented errors
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
                // Undocumented error
                return Promise.reject(e);
            }
            // Hook up eventhandlers to lnurl parser and callbacks.
            this.ndefReader.onreadingerror = (event) => this._onReadingError(event);
            this.ndefReader.onreading = (event) => this._onReading(event);
        });
    }
    /**
     * stopListening stops listening to NFC tags. Can be called many times.
     */
    stopListening() {
        this._abort(ErrorReason.aborted);
    }
    /**
     * Aborts the underlying scan call, and sets listening to false.
     * @param reason
     */
    _abort(reason) {
        var _a;
        (_a = this.abortController) === null || _a === void 0 ? void 0 : _a.abort(reason);
        this.listening = false;
    }
    /**
     * Invokes the onReadingError callback.
     * @param event optional event with additional error data.
     */
    _onReadingError(event) {
        if (this.onReadingError) {
            this.onReadingError(ErrorReason.readingError, event);
        }
    }
    /**
     * Parses the read NFC tag. If a valid lnurl is found, onLnurlRead is invoked.
     * If no valid lnurl is found onReadingError is invoked.
     * @param event NFC tag.
     */
    _onReading(event) {
        if (!event ||
            !event.message ||
            !event.message.records ||
            !Array.isArray(event.message.records)) {
            this._onReadingError(event);
            return;
        }
        // If something that might be an lnurl record is found, but is not obviously an 
        // lnurl record, it's stored here. Like a plain https link.
        const alternatives = [];
        // Check every ndef record.
        for (let record of event.message.records) {
            if (!record || !record.data) {
                continue;
            }
            const decodeResult = _decodeLnurlRecord(record);
            switch (decodeResult.isLnurl) {
                case LnurlResult.Yes:
                    // Invoke the callback if it's definitely an lnurl
                    if (this.onLnurlRead) {
                        this.onLnurlRead(decodeResult.lnurl);
                    }
                    return;
                case LnurlResult.Maybe:
                    // Store potential lnurl for later.
                    alternatives.push(decodeResult.lnurl);
                    break;
            }
        }
        // Apparently there was no good lnurl match in the ndef records array.
        // Maybe there was a less obvious match. If so, call the callback with that.
        if (alternatives.length > 0) {
            if (this.onLnurlRead) {
                this.onLnurlRead(alternatives[0]);
            }
            return;
        }
        // Nothing was found, notify.
        if (this.onReadingError) {
            this.onReadingError(ErrorReason.noLnurlFound);
        }
    }
}
exports.LnurlReader = LnurlReader;
/**
 * Utility method to check whether the string is an onion link.
 * @param potentialOnion potential onion link.
 * @returns
 */
function _isOnion(potentialOnion) {
    if (!potentialOnion) {
        return false;
    }
    const lowercase = potentialOnion.toLowerCase();
    return (lowercase &&
        (lowercase.endsWith('.onion') ||
            lowercase.indexOf('.onion/') >= 0 ||
            lowercase.indexOf('.onion?') >= 0));
}
/**
 * Decodes any kind of lnurl record
 * @param record The record to decode.
 * @returns Value indicating whether this is an lnurl, and if so (or maybe), return the lnurl with it.
 */
function _decodeLnurlRecord(record) {
    var _a;
    if (!record || !record.data) {
        return {
            isLnurl: LnurlResult.No,
        };
    }
    // Handle weird encodings graciously.
    const decoder = new TextDecoder((_a = record.encoding) !== null && _a !== void 0 ? _a : 'utf-8', { fatal: true });
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
/**
 * Value indicating whether a string is an lnurl link.
 */
var LnurlResult;
(function (LnurlResult) {
    LnurlResult[LnurlResult["No"] = 0] = "No";
    LnurlResult[LnurlResult["Maybe"] = 1] = "Maybe";
    LnurlResult[LnurlResult["Yes"] = 2] = "Yes";
})(LnurlResult = exports.LnurlResult || (exports.LnurlResult = {}));
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
function decodeLnurl(lnurlCandidate) {
    if (!lnurlCandidate) {
        return {
            isLnurl: LnurlResult.No,
        };
    }
    try {
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
function bech32Decode(data) {
    const decoder = new TextDecoder('utf-8', { fatal: true });
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
            const response = yield fetch(`${proxy}?url=${encodeURIComponent(paymentRequest)}`);
            const paymentResult = yield response.json();
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
                message: 'invalid response',
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
