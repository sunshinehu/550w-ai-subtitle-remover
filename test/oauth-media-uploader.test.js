const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const { Writable } = require('node:stream');
const { EventEmitter } = require('node:events');
const { spawnSync } = require('node:child_process');
const { validatePreparedUpload, inspectLocalMedia, uploadPreparedMedia } = require('../dist/oauth-media-uploader');

const ticket = '12345678-1234-1234-1234-123456789abc';
const base = { filePath: '/tmp/example.mp4', mediaType: 'video', region: 'global',
  confirmProcessing: true,
  uploadUrl: 'https://www.550wai.cn/mcp-media/global/video', uploadTicket: ticket };

test('ticket uploader accepts only the exact regional HTTPS endpoint', () => {
  assert.equal(validatePreparedUpload(base).href, base.uploadUrl);
  for (const uploadUrl of [
    'http://www.550wai.cn/mcp-media/global/video',
    'https://www.550wai.cn.evil.example/mcp-media/global/video',
    'https://www.550wai.cn/mcp-media/cn/video',
    'https://www.550wai.cn/mcp-media/global/video?next=evil',
    'https://www.550wai.cn/mcp-media/global/video#fragment',
  ]) assert.throws(() => validatePreparedUpload({ ...base, uploadUrl }), /endpoint/);
  assert.throws(() => validatePreparedUpload({ ...base, filePath: 'relative.mp4' }), /absolute/);
  assert.throws(() => validatePreparedUpload({ ...base, uploadTicket: 'secret' }), /ticket/);
  assert.throws(() => validatePreparedUpload({ ...base, timeoutMs: 0 }), /timeout/);
});

test('upload requires explicit approval before touching the selected file or network', async t => {
  t.mock.method(https, 'request', () => { throw new Error('Unexpected network access'); });
  for (const confirmProcessing of [undefined, false, 'true', 1]) {
    await assert.rejects(uploadPreparedMedia({ ...base, confirmProcessing }), /approval/);
  }
});

test('image upload requires stable operation ID before opening a file', () => {
  const image = { ...base, mediaType: 'image', filePath: '/tmp/example.png',
    uploadUrl: 'https://www.550wai.cn/mcp-media/global/image' };
  assert.throws(() => validatePreparedUpload(image), /operationId/);
  assert.doesNotThrow(() => validatePreparedUpload({ ...image, operationId: 'image-task-001' }));
});

test('local inspection provides the byte size required by remote prepare_media_upload', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '550w-upload-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, 'sample.mp4');
  fs.writeFileSync(filePath, 'video-bytes');
  assert.deepEqual(inspectLocalMedia(filePath, 'video'), { fileSize: 11, fileName: 'sample.mp4' });
  assert.throws(() => inspectLocalMedia('sample.mp4', 'video'), /absolute/);
  const link = path.join(dir, 'link.mp4');
  fs.symlinkSync(filePath, link);
  assert.throws(() => inspectLocalMedia(link, 'video'));
});

test('ticket upload CLI inspects stdin and protects selected paths on failure', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '550w-upload-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, 'sample.mp4');
  fs.writeFileSync(filePath, 'video-bytes');
  const cli = path.join(__dirname, '../dist/oauth-upload-cli.js');
  const result = spawnSync(process.execPath, [cli, 'inspect'], {
    input: JSON.stringify({ filePath, mediaType: 'video' }), encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), { fileSize: 11, fileName: 'sample.mp4' });
  const failed = spawnSync(process.execPath, [cli, 'upload'], {
    input: JSON.stringify({ filePath, mediaType: 'video', region: 'global' }), encoding: 'utf8',
  });
  assert.equal(failed.status, 1);
  assert.ok(!failed.stderr.includes(filePath));
  const badRegion = spawnSync(process.execPath, [cli, 'upload'], {
    input: JSON.stringify({ filePath, mediaType: 'video', region: 'unsupported' }), encoding: 'utf8',
  });
  assert.equal(badRegion.status, 1);
  assert.ok(!badRegion.stderr.includes(filePath));
});

test('uploader rejects symlinks and unsupported files without contacting the server', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '550w-upload-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const image = path.join(dir, 'image.png');
  const link = path.join(dir, 'link.png');
  const wrong = path.join(dir, 'data.txt');
  fs.writeFileSync(image, 'image-data');
  fs.writeFileSync(wrong, 'text-data');
  fs.symlinkSync(image, link);
  const input = { ...base, mediaType: 'image', uploadUrl: 'https://www.550wai.cn/mcp-media/global/image',
    operationId: 'image-task-001' };
  await assert.rejects(uploadPreparedMedia({ ...input, filePath: link }));
  await assert.rejects(uploadPreparedMedia({ ...input, filePath: wrong }), /extension/);
  await assert.rejects(uploadPreparedMedia({ ...input, filePath: dir }), /extension|size or type/);
});

test('uploader streams multipart with ticket but no OAuth bearer', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '550w-upload-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, 'sample.png');
  fs.writeFileSync(filePath, 'sample-image-bytes');
  let headers;
  const chunks = [];
  t.mock.method(https, 'request', (_url, options, callback) => {
    headers = options.headers;
    const request = new Writable({ write(chunk, _encoding, done) { chunks.push(chunk); done(); } });
    request.setTimeout = () => request;
    request.on('finish', () => {
      const response = new EventEmitter();
      response.statusCode = 200;
      callback(response);
      response.emit('data', Buffer.from('{"taskId":"task-1","status":"queued"}'));
      response.emit('end');
    });
    return request;
  });
  const result = await uploadPreparedMedia({ ...base, mediaType: 'image', filePath,
    uploadUrl: 'https://www.550wai.cn/mcp-media/global/image', operationId: 'image-task-001' });
  const body = Buffer.concat(chunks).toString('utf8');
  assert.equal(result.taskId, 'task-1');
  assert.equal(headers['X-550W-Upload-Ticket'], ticket);
  assert.equal(headers.Authorization, undefined);
  assert.match(body, /sample-image-bytes/);
  assert.match(body, /name="operationId"/);
  assert.match(body, /image-task-001/);
});
