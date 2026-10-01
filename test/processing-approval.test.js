const test = require('node:test');
const assert = require('node:assert/strict');
const { requireProcessingApproval } = require('../dist/processing-approval');
const { invoke } = require('../dist/dispatcher');
test('outbound processing rejects missing, false and truthy nonboolean consent', async () => {
  for (const action of ['uploadVideo','submitTask','removeVideoWatermark','removeImageWatermark','workflow']) {
    for (const confirmProcessing of [undefined,false,'true',1]) {
      const result=await invoke({action,params:{confirmProcessing,locale:'en'}});
      assert.equal(result.code,-200);
      assert.match(result.message,/confirmProcessing=true/);
    }
    assert.equal(requireProcessingApproval(action,{confirmProcessing:true}),null);
  }
});
test('read-only actions never require processing approval', () => {
  for (const action of ['queryCredits','taskDetail','taskList','imageWatermarkTaskDetail'])
    assert.equal(requireProcessingApproval(action,{}),null);
});
