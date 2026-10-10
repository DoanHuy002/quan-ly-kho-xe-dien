const { EventEmitter } = require('events');
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert/strict');
const { UpdateManager, githubConfig } = require('../desktop/updates.cjs');
const root = path.resolve(__dirname, '..'), data = fs.mkdtempSync(path.join(root, 'work', 'updates-unit-'));
class Feed extends EventEmitter {
  setFeedURL(value) { this.feed = value; }
  async checkForUpdates() { this.emit('checking-for-update'); if (this.offline) throw Error('offline'); this.emit(this.current ? 'update-not-available' : 'update-available', { version: '0.4.1', releaseNotes: '<script>text, never HTML</script>' }); }
  async downloadUpdate() { this.emit('download-progress', { percent: 55 }); if (this.corrupt) throw Error('checksum mismatch'); this.emit('update-downloaded', { version: '0.4.1' }); }
  quitAndInstall() { this.installed = true; assert.equal(prepared, true, 'Installer must not start before closed DB and completed backup'); }
}
let prepared = false;
const feed = new Feed();
const manager = new UpdateManager({ updater: feed, version: '0.4.0', packaged: true, dataDir: data, defaults: { url: '' }, authorize: async (token, admin) => { if (!['admin', 'viewer'].includes(token) || admin && token !== 'admin') throw Error('denied'); }, prepareInstall: async () => { prepared = true; }, notify() {} });
(async () => {
  assert.equal(manager.snapshot().status, 'unconfigured');
  await assert.rejects(manager.check('admin'), /Chưa gắn/);
  for (const url of ['http://github.com/o/r', 'https://github.com.evil.test/o/r', 'https://github.com/o/r?token=secret', 'https://other.test/o/r', 'https://github.com/o/..']) assert.throws(() => githubConfig({ url }));
  await assert.rejects(manager.save({ token: 'viewer', url: 'https://github.com/test-owner/test-releases' }), /denied/);
  await manager.save({ token: 'admin', url: 'https://github.com/test-owner/test-releases.git' });
  assert.equal(feed.feed.provider, 'github'); assert.equal(feed.feed.owner, 'test-owner');
  assert.equal(feed.autoDownload, false); assert.equal(feed.autoInstallOnAppQuit, false); assert.equal(feed.allowDowngrade, false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(data, 'updates.json'))).url, 'https://github.com/test-owner/test-releases');
  await manager.check('viewer'); assert.equal(manager.snapshot().status, 'available');
  feed.offline = true; await manager.check('viewer'); assert.equal(manager.snapshot().status, 'error'); assert.equal(manager.snapshot().version, '0.4.1'); feed.offline = false;
  feed.corrupt = true; await manager.download('viewer'); assert.equal(manager.downloaded, false); await assert.rejects(manager.install('viewer'), /chưa tải xong/); assert.equal(feed.installed, undefined);
  feed.corrupt = false; await manager.download('viewer'); assert.equal(manager.snapshot().status, 'downloaded');
  await assert.rejects(manager.save({ token: 'admin', url: 'https://github.com/test-owner/other' }), /chờ cài/);
  manager.prepareInstall = async () => { throw Error('backup failure'); }; await manager.install('viewer'); assert.equal(feed.installed, undefined); assert.equal(manager.snapshot().status, 'error');
  manager.prepareInstall = async () => { prepared = true; }; await manager.install('viewer'); assert.equal(feed.installed, true);
  const second = new UpdateManager({ updater: new Feed(), version: '0.4.0', packaged: false, dataDir: data, defaults: {}, authorize: async () => {}, prepareInstall: async () => {}, notify() {} });
  assert.equal(second.config.repo, 'test-releases'); await assert.rejects(second.check('admin'), /bộ cài/);
  console.log('PASS update permission, GitHub validation / persistence, explicit download / install, offline / corruption / backup failure, no downgrade and closed-data-before-installer ordering.');
})().catch(e => { console.error(e); process.exitCode = 1; });
