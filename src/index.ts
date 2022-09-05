'use strict';

import { bech32 } from 'bech32';

class NFCReader {
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

  public async listen(callback: (lnurl: string) => void): Promise<void> {
    if (this.available && this.ndefReader && !this.listening) {
      await this.ndefReader.scan();

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
  }
}

export function lnurlDecode(lnurl: string): string {
  const result = bech32.decode(lnurl, 2000);
  const requestByteArray = bech32.fromWords(result.words);

  return Buffer.from(requestByteArray).toString();
}

export const nfcReader = new NFCReader();
