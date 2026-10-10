const { _electron: electron } = require('C:/Users/Doan Huy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), http = require('http'), crypto = require('crypto');
const root = path.resolve(__dirname, '..'), data = path.join(root, 'work', 'updates-ui-' + Date.now());
let app, mode = 'new';
// Real electron-updater check/download against a local fixture. The fixture is
// deliberately not executable; never launch it. Installation is replaced only
// inside the isolated test main process, after the production prepareInstall.
const bytes = Buffer.concat([Buffer.from('MZ-not-an-executable-fixture'), crypto.randomBytes(250000)]);
const sha = crypto.createHash('sha512').update(bytes).digest('base64');
const server = http.createServer((req, res) => {
  if (mode === 'offline') { res.writeHead(503); res.end('offline test'); return; }
  if (req.url.startsWith('/latest.yml')) {
    res.setHeader('Content-Type', 'text/yaml');
    const version = mode === 'current' ? '0.4.0' : '0.4.1';
    res.end(`version: ${version}\nfiles:\n  - url: fixture.exe\n    sha512: ${sha}\n    size: ${bytes.length}\npath: fixture.exe\nsha512: ${sha}\nreleaseNotes: Bản kiểm thử cập nhật\n`);
  } else if (req.url.startsWith('/fixture.exe')) {
    res.setHeader('Content-Length', bytes.length); res.setHeader('Content-Type', 'application/octet-stream');
    if (mode === 'corrupt') res.end(Buffer.alloc(bytes.length, 88));
    else { res.write(bytes.subarray(0, 10000)); setTimeout(() => res.end(bytes.subarray(10000)), 300); }
  } else { res.writeHead(404); res.end(); }
});
async function launch() {
  app = await electron.launch({ executablePath: process.env.VK_TEST_EXECUTABLE || path.join(root, 'node_modules/electron/dist/electron.exe'), args: [root], env: { ...process.env, VK_DATA_DIR: data, VK_BACKEND_PORT: '18767', VK_UPDATE_AUTO_CHECK: 'false' }, timeout: 60000 });
  return app.firstWindow({ timeout: 60000 });
}
async function api(page, route, method, body, token) {
  const result = await page.evaluate(req => window.warehouse.api(req), { route: '/api/' + route, method, body, token }); assert.equal(result.status, 200, JSON.stringify(result)); return result.data;
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    let page = await launch(); await page.getByRole('heading', { name: 'Chào mừng trở lại' }).waitFor();
    const password = fs.readFileSync(path.join(data, 'credentials.txt'), 'utf8').split('Mật khẩu lần đầu: ')[1].split('\n')[0];
    const login = await api(page, 'login', 'POST', { username: 'admin', password });
    await api(page, 'parts', 'POST', { code: 'UPDATE-KEEP', name: 'Linh kiện giữ sau cập nhật', unit: 'cái' }, login.token);
    await page.getByLabel('Tên đăng nhập', { exact: true }).fill('admin'); await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Đăng nhập →', exact: true }).click(); await page.getByRole('heading', { name: 'Sẵn sàng cho ngày làm việc mới' }).waitFor();
    await page.getByRole('button', { name: 'Cập nhật', exact: true }).click();
    await page.getByRole('heading', { name: 'Chưa gắn nơi phát hành' }).waitFor();
    await page.getByLabel('Link kho GitHub phát hành').fill('https://github.com/example-test/qlk-releases-test');
    await page.getByRole('button', { name: 'Lưu nơi phát hành', exact: true }).click();
    await page.getByText('Đã lưu nơi cập nhật.', { exact: true }).waitFor();
    const port = server.address().port;
    await app.evaluate(({ app, dialog }, { root, data, port }) => {
      const require = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/package.json');
      const fs = require('fs'), path = require('path');
      const main = require(path.join(app.getAppPath(), 'desktop/main.cjs')), m = main.getUpdateManager();
      m.packaged = true; m.state.packaged = true;
      m.updater.forceDevUpdateConfig = true;
      const config = path.join(data, 'test-update.yml'); fs.writeFileSync(config, 'updaterCacheDirName: isolated-updater\n');
      m.updater.updateConfigPath = config;
      Object.defineProperty(m.updater.app, 'baseCachePath', { get: () => path.join(data, 'updater-cache') });
      m.updater.setFeedURL({ provider: 'generic', url: `http://127.0.0.1:${port}/` });
      m.updater.quitAndInstall = () => { fs.writeFileSync(path.join(data, 'install-called.txt'), 'Prepared first'); };
      dialog.showMessageBox = async () => ({ response: 0 });
      m.set({});
    }, { root, data, port });
    mode = 'offline'; await page.getByRole('button', { name: 'Kiểm tra cập nhật', exact: true }).click(); await page.getByText('Không kiểm tra được bản mới.', { exact: false }).waitFor();
    mode = 'current'; await page.getByRole('button', { name: 'Kiểm tra cập nhật', exact: true }).click(); await page.getByRole('heading', { name: 'Đang dùng bản mới nhất' }).waitFor();
    mode = 'new'; await page.getByRole('button', { name: 'Kiểm tra cập nhật', exact: true }).click(); await page.getByRole('heading', { name: 'Có phiên bản mới' }).waitFor();
    mode = 'corrupt'; await page.getByRole('button', { name: 'Tải bản mới', exact: true }).click(); await page.getByText('Tải bản mới chưa thành công', { exact: false }).waitFor();
    assert.equal(fs.existsSync(path.join(data, 'install-called.txt')), false);
    assert.equal(await page.getByRole('button', { name: 'Cài bản mới và mở lại', exact: true }).count(), 0);
    mode = 'new'; await page.getByRole('button', { name: 'Tải lại bản mới', exact: true }).click(); await page.getByRole('heading', { name: 'Đã tải xong' }).waitFor();
    await page.screenshot({ path: path.join(root, 'outputs/cap-nhat-ung-dung.png') });
    const exported = await app.evaluate(({ app }) => { const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json'); return require(require('path').join(app.getAppPath(), 'desktop/main.cjs')).getUpdateManager().updater.installerPath; });
    assert.equal(crypto.createHash('sha512').update(fs.readFileSync(exported)).digest('base64'), sha);
    await page.getByRole('button', { name: 'Cài bản mới và mở lại', exact: true }).click();
    await page.getByText('Đang đóng dữ liệu và sao lưu trước khi cài bản mới…', { exact: true }).waitFor();
    for (let i = 0; !fs.existsSync(path.join(data, 'install-called.txt')) && i < 100; i++) await new Promise(r => setTimeout(r, 100));
    assert.equal(fs.existsSync(path.join(data, 'install-called.txt')), true);
    const backups = fs.readdirSync(path.join(data, 'backups')).filter(n => n.startsWith('before-update-'));
    assert.equal(backups.length, 1); assert.ok(fs.statSync(path.join(data, 'backups', backups[0])).size > 0);
    assert.match(fs.readFileSync(path.join(data, 'backend.log'), 'utf8'), /Shutdown completed/);
    await app.close(); app = null;
    page = await launch(); await page.getByRole('heading', { name: 'Chào mừng trở lại' }).waitFor();
    const again = await api(page, 'login', 'POST', { username: 'admin', password });
    assert.equal((await api(page, 'parts', 'GET', null, again.token))[0].CODE, 'UPDATE-KEEP');
    const configured = await page.evaluate(() => window.warehouse.updates({ action: 'status' })); assert.equal(configured.githubUrl, 'https://github.com/example-test/qlk-releases-test');
    console.log('PASS actual electron-updater HTTP check / download, offline / same-version / SHA512 corruption rejection / retry, UI, pre-install graceful DB backup, config and data after restart. Installer execution replaced by a test recorder; no installer fixture executed.');
  } finally { if (app) await app.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
