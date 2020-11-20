import { DevicePushToken } from '../../Tokens.types';
import { updatePushTokenAsync } from '../updatePushTokenAsync';

const TOKEN: DevicePushToken = { type: 'ios', data: 'i-am-token' };

jest.mock('../../ServerRegistrationModule');

declare const global: any;

const expoEndpointUrl = 'https://exp.host/--/api/v2/push/updateDeviceToken';

describe('given valid registration info', () => {
  const successResponse = {
    status: 200,
    ok: true,
  } as Response;

  const failureResponse = {
    status: 500,
    ok: false,
    text: async () => 'Server error',
  } as Response;

  let originalFetch: typeof fetch | undefined;

  beforeAll(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('submits the request to proper URL', async () => {
    global.fetch.mockResolvedValue(successResponse);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    await updatePushTokenAsync(TOKEN);
    warnSpy.mockRestore();
    expect(global.fetch).toHaveBeenCalledWith(expoEndpointUrl, expect.anything());
  });

  describe('when server responds with an ok status', () => {
    beforeAll(() => {
      global.fetch.mockResolvedValue(successResponse);
    });

    it('submits the request only once', async () => {
      await updatePushTokenAsync(TOKEN);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  it('retries until it succeeds whilst server responds with an error status', async () => {
    const spy = jest.spyOn(console, 'debug').mockImplementation();
    global.fetch
      .mockResolvedValueOnce(failureResponse)
      .mockResolvedValueOnce(failureResponse)
      .mockResolvedValueOnce(successResponse);
    await updatePushTokenAsync(TOKEN);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });

  it('retries until it succeeds if fetch throws', async () => {
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    global.fetch.mockRejectedValueOnce(new TypeError()).mockResolvedValueOnce(successResponse);
    await updatePushTokenAsync(TOKEN);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
    debugSpy.mockRestore();
  });
});
