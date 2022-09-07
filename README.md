# lnurl-nfc
A library to help interacting with Web NFC to handle LNURLw payments

## Example
``` typescript
import { handleLNURL, NFCReader } from 'lnurl-nfc';

document.addEventListener('DOMContentLoaded', async () => {
  const invoice = document.getElementById('invoice') as HTMLInputElement;
  const button = document.getElementById('button');

  button?.addEventListener('click', async () => {
    try {
      const nfcReader = new NFCReader();
      await nfcReader.listen((lnurl) => {
        handleLNURL(lnurl, invoice?.value, 'proxy.php').then(() => console.log('done!!'));
      });
    } catch () {
      console.log('Error reading NFC');
    }
  });
});
```
