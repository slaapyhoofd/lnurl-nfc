'use strict';

import { bech32 } from 'bech32';

export interface IPaymentResult {
  success: boolean;
  message: string;
}

export enum ErrorReason {
  unavailable,
  aborted,
  scanInProgress,
  permissionDenied,
  readingError,
  noLnurlFound,
}

export class NFCReader {
  private readonly available: boolean;
  private readonly ndefReader: NDEFReader | undefined;

  constructor() {
    // Checks if Web NFC is present
    if ('NDEFReader' in window) {
      this.available = true;
      this.ndefReader = new NDEFReader();
    } else {
      this.available = false;
    }
  }

  public async listen(signal?: AbortSignal): Promise<string> {
    if (!this.available || !this.ndefReader) {
      return Promise.reject(ErrorReason.unavailable);
    }

    try {
      await this.ndefReader.scan(signal === undefined ? undefined : { signal });
    } catch (e) {
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
  }

  _onReadingError(reject: (reason: ErrorReason) => void) {
    return reject(ErrorReason.readingError);
  }

  _onReading(
    event: NDEFReadingEvent,
    resolve: (value: string) => void,
    reject: (reason: ErrorReason) => void,
  ) {
    if (
      !event ||
      !event.message ||
      !event.message.records ||
      !Array.isArray(event.message.records)
    ) {
      return reject(ErrorReason.readingError);
    }

    const alternatives: string[] = [];
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

function _isOnion(potentialOnion: string) {
  const lowercase = potentialOnion.toLowerCase();
  return (
    lowercase &&
    (lowercase.endsWith('.onion') ||
      lowercase.indexOf('.onion/') >= 0 ||
      lowercase.indexOf('.onion?') >= 0)
  );
}

function _decodeLnurlRecord(
  record: NDEFRecord,
): { isLnurl: LnurlResult.No } | { isLnurl: LnurlResult.Maybe | LnurlResult.Yes; lnurl: string } {
  if (!record || !record.data) {
    return {
      isLnurl: LnurlResult.No,
    };
  }

  const decoder = new TextDecoder(record.encoding ?? 'utf-8');
  try {
    const recordData = decoder.decode(record.data);
    return decodeLnurl(recordData);
  } catch (error) {
    return {
      isLnurl: LnurlResult.No,
    };
  }
}

export enum LnurlResult {
  No,
  Maybe,
  Yes,
}

export function decodeLnurl(
  lnurlCandidate: string,
): { isLnurl: LnurlResult.No } | { isLnurl: LnurlResult.Maybe | LnurlResult.Yes; lnurl: string } {
  if (!lnurlCandidate) {
    return {
      isLnurl: LnurlResult.No,
    };
  }

  try {
    const decoder = new TextDecoder('utf-8');
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
    } else if (lowercase.startsWith('lnurlw://')) {
      // Is a new age lnurlw. Replace lnurlw with https, or http if it's an onion.
      let replaceWith = 'https://';
      if (_isOnion(lnurlCandidate)) {
        replaceWith = 'http://';
      }

      return {
        isLnurl: LnurlResult.Yes,
        lnurl: replaceWith + lnurlCandidate.slice(9),
      };
    } else if (lowercase.startsWith('lnurl') && lowercase.indexOf(':') === -1) {
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
    } else if (lowercase.startsWith('https://')) {
      // https:// might be the real deal. Add as alternative.
      return {
        isLnurl: LnurlResult.Maybe,
        lnurl: lnurlCandidate,
      };
    } else if (lowercase.startsWith('http://')) {
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
  } catch {
    /* Squelch. Decoding error. Record is garbage. */
  }

  return {
    isLnurl: LnurlResult.No,
  };
}

export function isValidLnurl(lnurl: string): boolean {
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

export function bech32Decode(data: string) {
  const decoder = new TextDecoder('utf-8');
  const decoded = bech32.decode(data, 2000);
  const bytes = bech32.fromWords(decoded.words);
  return decoder.decode(new Uint8Array(bytes));
}

export async function handleLNURL(
  lnurl: string,
  invoice: string,
  proxy: string,
): Promise<IPaymentResult> {
  try {
    const encodedLnurl = encodeURIComponent(lnurl);
    const response = await fetch(`${proxy}?url=${encodedLnurl}`);
    const { callback, k1, reason, status } = await response.json();

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
  } catch (e: any) {
    return {
      success: false,
      message: e.message,
    };
  }
}

export async function handlePayment(
  callback: string,
  k1: string,
  invoice: string,
  proxy: string,
): Promise<IPaymentResult> {
  try {
    const separator = callback.indexOf('?') === -1 ? '?' : '&';
    const paymentRequest = `${callback}${separator}k1=${k1}&pr=${invoice.replace(
      'lightning:',
      '',
    )}`;
    const paymentResult = await (
      await fetch(`${proxy}?url=${encodeURIComponent(paymentRequest)}`)
    ).json();

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
  } catch (e: any) {
    return {
      success: false,
      message: e.message,
    };
  }
}
