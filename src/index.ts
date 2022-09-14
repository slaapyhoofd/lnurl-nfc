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
  noLnurlFound
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

    try
    {
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

      throw(e);
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

  _onReading(event: NDEFReadingEvent, resolve: (value: string) => void, reject: (reason: ErrorReason) => void) {
    if (!event || !event.message || !event.message.records || !Array.isArray(event.message.records)) {
      return reject(ErrorReason.readingError);
    }

    const decoder = new TextDecoder('utf-8');
    const alternatives: string[] = [];

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
          const decoded = bech32.decode(lnurl, 2000);
          const bytes = bech32.fromWords(decoded.words);
          const result = decoder.decode(new Uint8Array(bytes));
          return resolve(result);
        } else if (lowercase.startsWith('lnurlw://')) {
          // Is a new age lnurlw. Replace lnurlw with https, or http if it's an onion.
          let replaceWith = 'https://';
          if (lowercase.endsWith('.onion') || lowercase.indexOf('.onion/') >= 0) {
            replaceWith = 'http://';
          }
          return resolve(replaceWith + currentValue.slice(9));
        } else if (lowercase.startsWith('lnurl') && lowercase.indexOf(':') === -1) {
          // Might be lnurl without 'lightning:' prefix. If decoding with bech32 works, use that.
          const decoded = bech32.decode(currentValue, 2000);
          const bytes = bech32.fromWords(decoded.words);
          const result = decoder.decode(new Uint8Array(bytes));
          return resolve(result);
        } else if (lowercase.startsWith('https://')) {
          // https:// might be the real deal. Add as alternative.
          alternatives.push(currentValue);
        } else if (lowercase.startsWith('http://')) {
          // http:// might be the real deal if it's an onion. Add as alternative.
          if (lowercase.endsWith('.onion') || lowercase.indexOf('.onion/') >= 0) {
            alternatives.push(currentValue);
          }
        }
      } catch { /* Squelch. Decoding error. Record is garbage. */ }
    }

    // Apparently there was no good lnurl match in the ndef records array. 
    // Maybe there was a less obvious match. If so, return that.
    if (alternatives.length > 0) {
      return resolve(alternatives[0]);
    }

    return reject(ErrorReason.noLnurlFound);
  }
}

export async function handleLNURL(
  lnurl: string,
  invoice: string,
  proxy: string,
): Promise<IPaymentResult> {
  try {
    const { callback, k1, reason, status } = await (await fetch(`${proxy}?url=${lnurl}`)).json();

    return status === 'ERROR'
      ? {
          success: false,
          message: reason,
        }
      : handlePayment(callback, k1, invoice, proxy);
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
    const paymentRequest = `${callback}?k1=${k1}&pr=${invoice.replace('lightning:', '')}`;
    const paymentResult = await (
      await fetch(`${proxy}?url=${encodeURIComponent(paymentRequest)}`)
    ).json();

    return paymentResult.status === 'ERROR'
      ? {
          success: false,
          message: paymentResult.reason,
        }
      : {
          success: true,
          message: 'invoice paid!',
        };
  } catch (e: any) {
    return {
      success: false,
      message: e.message,
    };
  }
}
