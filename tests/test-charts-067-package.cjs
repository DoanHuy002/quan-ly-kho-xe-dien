const fs=require('fs'),assert=require('assert/strict'),root='D:/Codex/Projects/vinhkhang_QLK',a=require(root+'/node_modules/@electron/asar');
const f=root+'/releases/USB-0.6.7/win-unpacked/resources/app.asar',p=JSON.parse(a.extractFile(f,'package.json'));
assert(p.usbPortable);assert.equal(p.version,'0.6.7');
const names=a.listPackage(f).map(n=>n.replaceAll('\\','/'));
assert(!names.some(n=>['/data/','/work/','/outputs/','/releases/'].some(prefix=>n.startsWith(prefix))));
assert(!names.some(n=>n.endsWith('.mv.db')));
assert(names.includes('/desktop/usb-updates.cjs'));assert(names.includes('/desktop/usb-helper.ps1'));
console.log('PASS USB package: portable 0.6.7; updater included; no user database, work files or previous releases');
