import { LnurlReader, ErrorReason, handleLNURL } from '../../src';

log('initializing lnurl reader');
const lnurlReader = new LnurlReader();

// Register onLnurlRead callback for when we start listening.
lnurlReader.onLnurlRead = async (lnurl) => {
  try {
    // Update UI that lnurl has successfully been read.
    log(`lnurlw read successfully: ${lnurl}`);

    // Call the lnurlw flow
    const invoice = (document.getElementById('invoice') as HTMLInputElement)!.value;
    const result = await handleLNURL(lnurl, invoice, '/proxy');
    if (result.success) {
      log('lnurlw flow succeeded. Invoice should be paid shortly.');
    } else {
      log(`lnurlw flow failed. Reason: '${result.message}'`);
    }
  } catch (e: any) {
    // Handle errors you caused in the code above (inside try)
    log(`error: ${e.message}`);
  }

  nfcButton!.textContent = 'Still scanning...';

  // Note that we're still scanning for nfc tags after we found one.
  // Calling lnurlReader.stopListening() will cause the nfc control to be
  // handed over to the OS. So that causes the phone to scan the tag again
  // and another screen will be shown to take you to your lightning app.
  // So only stop listening if you're sure the card out of proximity.
};

// Register onReadingError callback for when we start listening.
lnurlReader.onReadingError = (error, detail) => {
  // If we end up in this error block, that means we failed to scan the card.
  // Note that we're still scanning. If you'd want to stop scanning, call `lnurlReader.stopListening()`.
  // Note that `stopListening()` returns control of the nfc reader to the OS, so if the card is still
  // in proximity of the device, another page will be opened where the OS tries to find an appropriate
  // app for the card. So probably calling `stoplistening` here is not a very good idea.
  try {
    switch (error) {
      case ErrorReason.noLnurlFound:
        log('Scanned card does not contain an lnurlw. Try another card');
        break;
      case ErrorReason.readingError:
        log('Error reading the card. Is the card invalid?');
        break;
      default:
        log(
          `error: This example code should be updated. Unknown ErrorReason '${ErrorReason[error]}'.`,
        );
        break;
    }
  } catch (e: any) {
    // Handle errors you caused in the code above (inside try)
    log(
      `error handling the error. This is pretty bad. Developer: fix the example page please: ${e.message}`,
    );
  }

  nfcButton!.textContent = 'Still scanning...';

  // Note that we're still scanning for nfc tags after a reading error.
  // Calling lnurlReader.stopListening() will cause the nfc control to be
  // handed over to the OS. So that causes the phone to scan the tag again
  // and another screen will probably show the reading error again.
};

const nfcButton = document.getElementById('nfcButton') as HTMLButtonElement;
const nfcUnavailableText = document.getElementById('nfcUnavailableText');
if (lnurlReader.isAvailable) {
  log('nfc is available');
  nfcButton!.removeAttribute('style');
} else {
  log('nfc is unavailable');
  nfcUnavailableText!.removeAttribute('style');
}

// Function called when nfc button is clicked.
// Note that you need to click a button in order to be able to activate NFC.
// The browser will not allow scanning for NFC without user interaction.
async function onClickNfcButton() {
  try {
    log('checking nfc permissions');
    nfcButton!.textContent = 'Scanning...';
    nfcButton!['disabled'] = true;

    // Start listening.
    // This call will show a permissions popup if needed.
    await lnurlReader.startListening();
    log('listening for nfc tags');
  } catch (e: any) {
    // Errors could occur BEFORE we're actually listening.

    if (e in ErrorReason) {
      switch (e) {
        case ErrorReason.unavailable:
          nfcButton!.textContent = 'Unavailable';
          log('Turns out nfc is unavailable after all.');
          break;
        case ErrorReason.aborted:
          nfcButton!.textContent = 'Scan NFC';
          nfcButton!['disabled'] = false;
          log('Scan was aborted for some reason. Try scanning again?');
          break;
        case ErrorReason.scanInProgress:
          log('An nfc scan was already in progress. Must be a bug in the button update flow.');
          break;
        case ErrorReason.permissionDenied:
          nfcButton!.textContent = 'Scan NFC';
          nfcButton!['disabled'] = false;
          log('Permission to read nfc was denied. Check nfc settings for this website.');
          break;
        default:
          nfcButton!.textContent = 'Scan NFC';
          nfcButton!['disabled'] = false;
          log(
            `We did not handle this error case. Example should be updated: Error reason ${ErrorReason[e]}`,
          );
          break;
      }
    } else {
      nfcButton!.textContent = 'Scan NFC';
      nfcButton!['disabled'] = false;
      log(`Undocumented error occurred in NDEFReader: ${e.message}`);
    }
  }
}

function log(message: string) {
  const logDiv = document.getElementById('log');
  const el = document.createElement('p');
  const messageEl = document.createTextNode(message);
  el.appendChild(messageEl);
  logDiv!.appendChild(el);
}
