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

  private listening = false;

  constructor() {
    // Checks if Web NFC is present
    if ('NDEFReader' in window) {
      this.available = true;
      this.ndefReader = new NDEFReader();
    } else {
      this.available = false;
    }
  }

  public async listen(): Promise<string> {
    if (!this.available || !this.ndefReader) {
      return Promise.reject(ErrorReason.unavailable);
    }

    if (this.listening) {
      return Promise.reject(ErrorReason.scanInProgress);
    }

    await this.ndefReader.scan();

    return new Promise((resolve, reject) => {
      if (!this.ndefReader) {
        return reject(ErrorReason.unavailable);
      }

      this.ndefReader.onreadingerror = () => {
        return reject(ErrorReason.readingError);
      };

      this.ndefReader.onreading = ({ message }) => {
        const record = message.records[0];
        const textDecoder = new TextDecoder('utf-8');

        // Decode NDEF data from tag, and remove lightning: prefix
        const lnurl = textDecoder.decode(record.data);

        // return the decoded lnurl
        return resolve(lnurl);
      };

      this.listening = true;
    });
  }
}

export function lnurlDecode(lnurl: string): string {
  if (lnurl.indexOf('lnurlw:') !== -1) {
    // boltcard support
    return lnurl.replace('lnurlw:', 'https:');
  }
  const result = bech32.decode(lnurl.replace('lightning:', ''), 2000);
  const requestByteArray = bech32.fromWords(result.words);

  return bin2String(requestByteArray);
}

export function bin2String(array: number[]) {
  let result = '';
  for (let i = 0; i < array.length; i++) {
    result += String.fromCharCode(array[i]);
  }
  return result;
}

export async function handleLNURL(
  lnurl: string,
  invoice: string,
  proxy: string,
): Promise<IPaymentResult> {
  try {
    const decoded = lnurlDecode(lnurl);
    const { callback, k1, reason, status } = await (await fetch(`${proxy}?url=${decoded}`)).json();

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
