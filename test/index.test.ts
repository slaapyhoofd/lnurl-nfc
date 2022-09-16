import { decodeLnurl, ErrorReason, handleLNURL, LnurlResult, NFCReader } from '../src/index';
import { TextEncoder } from 'util';

describe('decodeLnurl', () => {
  describe('basecases', () => {
    test('Should return No if undefined', () => {
      const result = decodeLnurl(undefined as unknown as string);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No if null', () => {
      const result = decodeLnurl(null as unknown as string);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No if not a string', () => {
      const result = decodeLnurl({ is: 'not a string' } as unknown as string);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No if random text', () => {
      const result = decodeLnurl('random text');
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });
  });

  describe('https link', () => {
    test('Should return Maybe if https link', () => {
      const lnurl = 'https://bitcoin.org';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.Maybe, lnurl: lnurl });
    });
  });

  describe('http link', () => {
    test('Should return No if http link without onion', () => {
      const lnurl = 'http://bitcoin.org';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return Maybe if http link with onion', () => {
      const lnurl = 'http://bitcoin.onion';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.Maybe, lnurl: lnurl });
    });

    test('Should return Maybe if http link with onion with querystring', () => {
      const lnurl = 'http://bitcoin.onion?some=string';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.Maybe, lnurl: lnurl });
    });

    test('Should return Maybe if http link with onion with path', () => {
      const lnurl = 'http://bitcoin.onion/some/path';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.Maybe, lnurl: lnurl });
    });

    test('Should return Maybe if http link with onion with path and querystring', () => {
      const lnurl = 'http://bitcoin.onion/some/path?some=query';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.Maybe, lnurl: lnurl });
    });
  });

  describe('lnurlw link', () => {
    test('Should return Yes with https link', () => {
      const lnurl = 'lnurlw://bitcoin.org';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.Yes, lnurl: 'https://bitcoin.org' });
    });

    test('Should return Yes with http link if onion', () => {
      const lnurl = 'lnurlw://bitcoin.onion';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.Yes, lnurl: 'http://bitcoin.onion' });
    });

    test('Should return Yes with http link if onion with querystring', () => {
      const lnurl = 'lnurlw://bitcoin.onion?some=query';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({
        isLnurl: LnurlResult.Yes,
        lnurl: 'http://bitcoin.onion?some=query',
      });
    });

    test('Should return Yes with http link if onion with path', () => {
      const lnurl = 'lnurlw://bitcoin.onion/some/path';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({
        isLnurl: LnurlResult.Yes,
        lnurl: 'http://bitcoin.onion/some/path',
      });
    });
  });

  describe('bech32 encoded lnurl prefix', () => {
    test('Should return No when no suffix', () => {
      const lnurl = 'lnurl';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No when arbitrary suffix', () => {
      const lnurl = 'lnurl is cool';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No when suffix with random data', () => {
      const lnurl = 'lnurl1wfskuer0d5sxgct5vyecnpzw'; // random data
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No when suffix is padded zeroes', () => {
      const lnurl = 'lnurl1qqqqqqqqqqqqh3glaf'; // 0x00000000000000
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return Yes with https link', () => {
      const lnurl = 'lnurl1dp68gurn8ghj7cnfw33k76tw9ehhyeckq6864'; // https://bitcoin.org
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.Yes, lnurl: 'https://bitcoin.org' });
    });

    test('Should return No with http link', () => {
      const lnurl = 'lnurl1dp68gup69uhky6t5vdhkjm3wdaexw28j5fz'; // http://bitcoin.org
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return Yes with http onion link', () => {
      const lnurl = 'lnurl1dp68gup69uhky6t5vdhkjm3wdahxjmmw578xuq'; // http://bitcoin.onion
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.Yes, lnurl: 'http://bitcoin.onion' });
    });
  });

  describe('bech32 encoded LNURL prefix transformed from lowercase', () => {
    test('Should return No when no suffix', () => {
      const lnurl = 'LNURL';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No when arbitrary suffix', () => {
      const lnurl = 'LNURL is cool';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No when suffix with random data', () => {
      const lnurl = 'LNURL1WFSKUER0D5SXGCT5VYPXMQV7'; // random data
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No when suffix is padded zeroes', () => {
      const lnurl = 'LNURL1QQQQQQQQQQQQH3GLAF'; // 0x00000000000000
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return Yes with https link', () => {
      const lnurl = 'LNURL1DP68GURN8GHJ7CNFW33K76TW9EHHYECKQ6864'; // https://bitcoin.org
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.Yes, lnurl: 'https://bitcoin.org' });
    });

    test('Should return No with http link', () => {
      const lnurl = 'LNURL1DP68GUP69UHKY6T5VDHKJM3WDAEXW28J5FZ'; // http://bitcoin.org
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return Yes with http onion link', () => {
      const lnurl = 'LNURL1DP68GUP69UHKY6T5VDHKJM3WDAHXJMMW578XUQ'; // http://bitcoin.onion
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.Yes, lnurl: 'http://bitcoin.onion' });
    });
  });

  describe('bech32 encoded lnurl prefix with lightning: prefix', () => {
    test('Should return No when no suffix', () => {
      const lnurl = 'lightning:lnurl';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No when arbitrary suffix', () => {
      const lnurl = 'lightning:lnurl is cool';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No when suffix with random data', () => {
      const lnurl = 'lightning:lnurl1wfskuer0d5sxgct5vyecnpzw'; // random data
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No when suffix is padded zeroes', () => {
      const lnurl = 'lightning:lnurl1qqqqqqqqqqqqh3glaf'; // 0x00000000000000
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return Yes with https link', () => {
      const lnurl = 'lightning:lnurl1dp68gurn8ghj7cnfw33k76tw9ehhyeckq6864'; // https://bitcoin.org
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.Yes, lnurl: 'https://bitcoin.org' });
    });

    test('Should return No with http link', () => {
      const lnurl = 'lightning:lnurl1dp68gup69uhky6t5vdhkjm3wdaexw28j5fz'; // http://bitcoin.org
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return Yes with http onion link', () => {
      const lnurl = 'lightning:lnurl1dp68gup69uhky6t5vdhkjm3wdahxjmmw578xuq'; // http://bitcoin.onion
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.Yes, lnurl: 'http://bitcoin.onion' });
    });
  });

  describe('bech32 encoded lnurl prefix with LIGHTNING: prefix', () => {
    test('Should return No when no suffix', () => {
      const lnurl = 'LIGHTNING:lnurl';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No when arbitrary suffix', () => {
      const lnurl = 'LIGHTNING:lnurl is cool';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No when suffix with random data', () => {
      const lnurl = 'LIGHTNING:lnurl1wfskuer0d5sxgct5vyecnpzw'; // random data
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No when suffix is padded zeroes', () => {
      const lnurl = 'LIGHTNING:lnurl1qqqqqqqqqqqqh3glaf'; // 0x00000000000000
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return Yes with https link', () => {
      const lnurl = 'LIGHTNING:lnurl1dp68gurn8ghj7cnfw33k76tw9ehhyeckq6864'; // https://bitcoin.org
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.Yes, lnurl: 'https://bitcoin.org' });
    });

    test('Should return No with http link', () => {
      const lnurl = 'LIGHTNING:lnurl1dp68gup69uhky6t5vdhkjm3wdaexw28j5fz'; // http://bitcoin.org
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return Yes with http onion link', () => {
      const lnurl = 'LIGHTNING:lnurl1dp68gup69uhky6t5vdhkjm3wdahxjmmw578xuq'; // http://bitcoin.onion
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.Yes, lnurl: 'http://bitcoin.onion' });
    });
  });

  describe('bech32 encoded LNURL prefix transformed from lowercase with lightning: prefix', () => {
    test('Should return No when no suffix', () => {
      const lnurl = 'lightning:LNURL';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No when arbitrary suffix', () => {
      const lnurl = 'lightning:LNURL is cool';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No when suffix with random data', () => {
      const lnurl = 'lightning:LNURL1WFSKUER0D5SXGCT5VYPXMQV7'; // random data
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No when suffix is padded zeroes', () => {
      const lnurl = 'lightning:LNURL1QQQQQQQQQQQQH3GLAF'; // 0x00000000000000
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return Yes with https link', () => {
      const lnurl = 'lightning:LNURL1DP68GURN8GHJ7CNFW33K76TW9EHHYECKQ6864'; // https://bitcoin.org
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.Yes, lnurl: 'https://bitcoin.org' });
    });

    test('Should return No with http link', () => {
      const lnurl = 'lightning:LNURL1DP68GUP69UHKY6T5VDHKJM3WDAEXW28J5FZ'; // http://bitcoin.org
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return Yes with http onion link', () => {
      const lnurl = 'lightning:LNURL1DP68GUP69UHKY6T5VDHKJM3WDAHXJMMW578XUQ'; // http://bitcoin.onion
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.Yes, lnurl: 'http://bitcoin.onion' });
    });
  });

  describe('bech32 encoded LNURL prefix transformed from lowercase with LIGHTNING: prefix', () => {
    test('Should return No when no suffix', () => {
      const lnurl = 'LIGHTNING:LNURL';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No when arbitrary suffix', () => {
      const lnurl = 'LIGHTNING:LNURL is cool';
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No when suffix with random data', () => {
      const lnurl = 'LIGHTNING:LNURL1WFSKUER0D5SXGCT5VYPXMQV7'; // random data
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return No when suffix is padded zeroes', () => {
      const lnurl = 'LIGHTNING:LNURL1QQQQQQQQQQQQH3GLAF'; // 0x00000000000000
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return Yes with https link', () => {
      const lnurl = 'LIGHTNING:LNURL1DP68GURN8GHJ7CNFW33K76TW9EHHYECKQ6864'; // https://bitcoin.org
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.Yes, lnurl: 'https://bitcoin.org' });
    });

    test('Should return No with http link', () => {
      const lnurl = 'LIGHTNING:LNURL1DP68GUP69UHKY6T5VDHKJM3WDAEXW28J5FZ'; // http://bitcoin.org
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.No });
    });

    test('Should return Yes with http onion link', () => {
      const lnurl = 'LIGHTNING:LNURL1DP68GUP69UHKY6T5VDHKJM3WDAHXJMMW578XUQ'; // http://bitcoin.onion
      const result = decodeLnurl(lnurl);
      expect(result).toStrictEqual({ isLnurl: LnurlResult.Yes, lnurl: 'http://bitcoin.onion' });
    });
  });
});

describe('listen', () => {
  let windowSpy: jest.SpyInstance;
  let scanMock: jest.Mock;
  let onSetReadingMock: jest.Mock;
  let onSetReadingErrorMock: jest.Mock;
  beforeEach(() => {
    onSetReadingMock = jest.fn().mockImplementation((func) => {});
    onSetReadingErrorMock = jest.fn().mockImplementation((func) => {});
    scanMock = jest.fn().mockImplementation(() => Promise.resolve());
    const ndefReaderMockInstance = { scan: scanMock };
    Object.defineProperty(ndefReaderMockInstance, 'onreading', {
      set: (val) => onSetReadingMock(val),
    });
    Object.defineProperty(ndefReaderMockInstance, 'onreadingerror', {
      set: (val) => onSetReadingErrorMock(val),
    });

    const originalWindow = { ...window };
    windowSpy = jest.spyOn(global, 'window', 'get') as any;
    windowSpy.mockImplementation(() => ({
      ...originalWindow,
      NDEFReader: jest.fn().mockImplementation(() => ndefReaderMockInstance),
    }));
  });

  afterEach(() => {
    windowSpy.mockRestore();
    scanMock.mockRestore();
    onSetReadingMock.mockRestore();
    onSetReadingErrorMock.mockRestore();
  });

  test('Should reject with unavailable if ndefreader not in window', () => {
    windowSpy.mockImplementation(() => ({}));
    const reader = new NFCReader();
    return expect(reader.listen()).rejects.toBe(ErrorReason.unavailable);
  });

  test('Should reject with aborted if scan throws with AbortedError', () => {
    scanMock.mockRejectedValue(new DOMException('', 'AbortError'));
    const reader = new NFCReader();
    return expect(reader.listen()).rejects.toBe(ErrorReason.aborted);
  });

  test('Should reject with scanInProgress if scan throws with InvalidStateError', () => {
    scanMock.mockRejectedValue(new DOMException('', 'InvalidStateError'));
    const reader = new NFCReader();
    return expect(reader.listen()).rejects.toBe(ErrorReason.scanInProgress);
  });

  test('Should reject with permissionDenied if scan throws with NotAllowedError', () => {
    scanMock.mockRejectedValue(new DOMException('', 'NotAllowedError'));
    const reader = new NFCReader();
    return expect(reader.listen()).rejects.toBe(ErrorReason.permissionDenied);
  });

  test('Should reject with unavailable if scan throws with NotSupportedError', () => {
    scanMock.mockRejectedValue(new DOMException('', 'NotSupportedError'));
    const reader = new NFCReader();
    return expect(reader.listen()).rejects.toBe(ErrorReason.unavailable);
  });

  test('Should reject with whatever is thrown if scan throws another error', () => {
    const ex = new DOMException('', 'Something else');
    scanMock.mockRejectedValue(ex);
    const reader = new NFCReader();
    return expect(reader.listen()).rejects.toBe(ex);
  });

  test('Should reject with readingError on readingerror', () => {
    onSetReadingErrorMock.mockImplementation((func) => func());
    const reader = new NFCReader();
    return expect(reader.listen()).rejects.toBe(ErrorReason.readingError);
  });

  test('Should reject with readingError if malformed message', () => {
    const ndefReadingEvent = { message: {} };
    onSetReadingMock.mockImplementation((callback) => {
      callback(ndefReadingEvent);
    });
    const reader = new NFCReader();
    return expect(reader.listen()).rejects.toBe(ErrorReason.readingError);
  });

  test('Should reject with noLnurlFound if no records in the message', () => {
    const ndefReadingEvent = { message: { records: [] } };
    onSetReadingMock.mockImplementation((callback) => {
      callback(ndefReadingEvent);
    });
    const reader = new NFCReader();
    return expect(reader.listen()).rejects.toBe(ErrorReason.noLnurlFound);
  });

  test('Should return found lnurl', async () => {
    const url = 'https://bitcoin.org';
    const binary = new TextEncoder().encode(url);
    const ndefReadingEvent = { message: { records: [{ data: binary }] } };
    onSetReadingMock.mockImplementation((callback) => {
      callback(ndefReadingEvent);
    });
    const reader = new NFCReader();
    const result = await reader.listen();
    expect(result).toBe(url);
  });

  test('Should return found lnurlw', async () => {
    const url = 'lnurlw://bitcoin.org';
    const binary = new TextEncoder().encode(url);
    const ndefReadingEvent = { message: { records: [{ data: binary }] } };
    onSetReadingMock.mockImplementation((callback) => {
      callback(ndefReadingEvent);
    });
    const reader = new NFCReader();
    const result = await reader.listen();
    expect(result).toBe('https://bitcoin.org');
  });

  test('Should return lnurl if it is in second record', async () => {
    const url = 'https://bitcoin.org';
    const binary = new TextEncoder().encode(url);
    const ndefReadingEvent = { message: { records: [{}, { data: binary }] } };
    onSetReadingMock.mockImplementation((callback) => {
      callback(ndefReadingEvent);
    });
    const reader = new NFCReader();
    const result = await reader.listen();
    expect(result).toBe(url);
  });

  test('Should reject with noLnurlFound if it is not a valid lnurl', async () => {
    const url = 'http://bitcoin.org'; // http is not valid, should be https.
    const binary = new TextEncoder().encode(url);
    const ndefReadingEvent = { message: { records: [{ data: binary }] } };
    onSetReadingMock.mockImplementation((callback) => {
      callback(ndefReadingEvent);
    });
    const reader = new NFCReader();
    return expect(reader.listen()).rejects.toBe(ErrorReason.noLnurlFound);
  });

  test('Should reject with noLnurlFound if record is garbage', async () => {
    const binary = new Uint8Array([0, 18, 2, 255, 65, 1, 99, 3, 2]);
    const ndefReadingEvent = { message: { records: [{ data: binary }] } };
    onSetReadingMock.mockImplementation((callback) => {
      callback(ndefReadingEvent);
    });
    const reader = new NFCReader();
    return expect(reader.listen()).rejects.toBe(ErrorReason.noLnurlFound);
  });

  test('Should reject with noLnurlFound if record is empty', async () => {
    const url = ''; // http is not valid, should be https.
    const binary = new TextEncoder().encode(url);
    const ndefReadingEvent = { message: { records: [{ data: binary }] } };
    onSetReadingMock.mockImplementation((callback) => {
      callback(ndefReadingEvent);
    });
    const reader = new NFCReader();
    return expect(reader.listen()).rejects.toBe(ErrorReason.noLnurlFound);
  });
});

describe('handleLnurl', () => {
  let fetchMock: jest.Mock;
  const proxyUrl = 'https://bitkassa.nl/proxy';
  const invoice = 'asdf';
  const url = 'https://bitcoin.org/lnurlw';
  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    fetchMock.mockClear();
  });

  test('Should call proxy with url encoded url in querystring', async () => {
    await handleLNURL(url, invoice, proxyUrl);
    expect(fetchMock).toBeCalledTimes(1);
    expect(fetchMock).toBeCalledWith(
      'https://bitkassa.nl/proxy?url=https%3A%2F%2Fbitcoin.org%2Flnurlw',
    );
  });

  test('Should return success false if fetch rejects', async () => {
    fetchMock.mockRejectedValue(new Error('oops'));
    const result = await handleLNURL(url, invoice, proxyUrl);
    expect(result).toStrictEqual({ success: false, message: 'oops' });
  });

  test('Should return success false if json rejects', async () => {
    fetchMock.mockResolvedValue({
      json: jest.fn().mockRejectedValue(new Error('oops')),
    });
    const result = await handleLNURL(url, invoice, proxyUrl);
    expect(result).toStrictEqual({ success: false, message: 'oops' });
  });

  test('Should return success false if json is not according to spec', async () => {
    fetchMock.mockResolvedValue({
      json: jest.fn().mockResolvedValue({ something: 'else' }),
    });
    const result = await handleLNURL(url, invoice, proxyUrl);
    expect(result).toStrictEqual({ success: false, message: 'invalid response' });
  });

  test('Should return success false if status error is returned', async () => {
    fetchMock.mockResolvedValue({
      json: jest.fn().mockResolvedValue({ status: 'ERROR', reason: 'oops' }),
    });
    const result = await handleLNURL(url, invoice, proxyUrl);
    expect(result).toStrictEqual({ success: false, message: 'oops' });
  });

  test('Should return success false if status error is returned without reason', async () => {
    fetchMock.mockResolvedValue({
      json: jest.fn().mockResolvedValue({ status: 'ERROR' }),
    });
    const result = await handleLNURL(url, invoice, proxyUrl);
    expect(result).toStrictEqual({ success: false, message: undefined });
  });

  test('Should return success false if status OK but no callback', async () => {
    fetchMock.mockResolvedValue({
      json: jest.fn().mockResolvedValue({ status: 'OK', k1: '1234' }),
    });
    const result = await handleLNURL(url, invoice, proxyUrl);
    expect(result).toStrictEqual({ success: false, message: 'invalid response' });
  });

  test('Should return success false if status OK but no k1', async () => {
    fetchMock.mockResolvedValue({
      json: jest.fn().mockResolvedValue({ status: 'OK', callback: 'https://callback' }),
    });
    const result = await handleLNURL(url, invoice, proxyUrl);
    expect(result).toStrictEqual({ success: false, message: 'invalid response' });
  });

  test('Should call the right url when callback without querystring', async () => {
    fetchMock.mockResolvedValueOnce({
      json: jest.fn().mockResolvedValue({ status: 'OK', callback: 'https://callback', k1: '1234' }),
    });
    await handleLNURL(url, invoice, proxyUrl);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://bitkassa.nl/proxy?url=https%3A%2F%2Fcallback%3Fk1%3D1234%26pr%3Dasdf',
    );
  });

  test('Should call the right url when callback with querystring', async () => {
    fetchMock.mockResolvedValueOnce({
      json: jest
        .fn()
        .mockResolvedValue({ status: 'OK', callback: 'https://callback?some=query', k1: '1234' }),
    });
    await handleLNURL(url, invoice, proxyUrl);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://bitkassa.nl/proxy?url=https%3A%2F%2Fcallback%3Fsome%3Dquery%26k1%3D1234%26pr%3Dasdf',
    );
  });

  test('Should strip lightning: from invoice', async () => {
    fetchMock.mockResolvedValueOnce({
      json: jest.fn().mockResolvedValue({ status: 'OK', callback: 'https://callback', k1: '1234' }),
    });
    await handleLNURL(url, 'lightning:asdf', proxyUrl);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://bitkassa.nl/proxy?url=https%3A%2F%2Fcallback%3Fk1%3D1234%26pr%3Dasdf',
    );
  });

  test('Should return success false if second fetch throws', async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: jest
          .fn()
          .mockResolvedValue({ status: 'OK', callback: 'https://callback', k1: '1234' }),
      })
      .mockRejectedValueOnce(new Error('oops'));
    const result = await handleLNURL(url, invoice, proxyUrl);
    expect(result).toStrictEqual({ success: false, message: 'oops' });
  });

  test('Should return success false if second fetch json throws', async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: jest
          .fn()
          .mockResolvedValue({ status: 'OK', callback: 'https://callback', k1: '1234' }),
      })
      .mockResolvedValueOnce({
        json: jest.fn().mockRejectedValue(new Error('oops')),
      });
    const result = await handleLNURL(url, invoice, proxyUrl);
    expect(result).toStrictEqual({ success: false, message: 'oops' });
  });

  test('Should return success false if second response invalid', async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: jest
          .fn()
          .mockResolvedValue({ status: 'OK', callback: 'https://callback', k1: '1234' }),
      })
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({ something: 'else' }),
      });
    const result = await handleLNURL(url, invoice, proxyUrl);
    expect(result).toStrictEqual({ success: false, message: 'invalid response' });
  });

  test('Should return success false if second status is error', async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: jest
          .fn()
          .mockResolvedValue({ status: 'OK', callback: 'https://callback', k1: '1234' }),
      })
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({ status: 'ERROR', reason: 'oops' }),
      });
    const result = await handleLNURL(url, invoice, proxyUrl);
    expect(result).toStrictEqual({ success: false, message: 'oops' });
  });

  test('Should return success false if second status is error without reason', async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: jest
          .fn()
          .mockResolvedValue({ status: 'OK', callback: 'https://callback', k1: '1234' }),
      })
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({ status: 'ERROR' }),
      });
    const result = await handleLNURL(url, invoice, proxyUrl);
    expect(result).toStrictEqual({ success: false, message: undefined });
  });

  test('Should return success if second status OK', async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: jest
          .fn()
          .mockResolvedValue({ status: 'OK', callback: 'https://callback', k1: '1234' }),
      })
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({ status: 'OK' }),
      });
    const result = await handleLNURL(url, invoice, proxyUrl);
    expect(result).toStrictEqual({ success: true, message: 'invoice payment initiated' });
  });
});
