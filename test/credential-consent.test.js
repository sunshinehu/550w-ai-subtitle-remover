const test = require('node:test');
const assert = require('node:assert/strict');
const { invoke } = require('../dist/dispatcher');
const { ApiClient } = require('../dist/api-client');
const { CredentialManager } = require('../dist/credential-manager');

test('credential verification and persistence require explicit consent before either effect', async () => {
  const oldPost = ApiClient.prototype.post;
  const oldSet = CredentialManager.prototype.set;
  let network = 0, storage = 0;
  ApiClient.prototype.post = async () => { network++; return { code: 200 }; };
  CredentialManager.prototype.set = () => { storage++; };
  try {
    for (const confirmation of [undefined, false, 'true']) {
      const result = await invoke({ action: 'configureCredentials', params: {
        userNo: 'test-user', apiKey: 'test-only-key', locale: 'en', confirmCredentialStorage: confirmation,
      } });
      assert.notEqual(result.code, 200);
    }
    assert.equal(network, 0);
    assert.equal(storage, 0);
    const result = await invoke({ action: 'configureCredentials', params: {
      userNo: 'test-user', apiKey: 'test-only-key', locale: 'en', confirmCredentialStorage: true,
    } });
    assert.equal(result.code, 200);
    assert.equal(network, 1);
    assert.equal(storage, 1);
  } finally {
    ApiClient.prototype.post = oldPost;
    CredentialManager.prototype.set = oldSet;
  }
});
