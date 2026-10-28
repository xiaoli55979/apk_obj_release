import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../docs/assets/app.js', import.meta.url), 'utf8');

async function render(data) {
  let document;
  class Element {
    constructor(tag) {
      this.tag = tag;
      this.children = [];
      this.attributes = {};
      this.events = {};
      this.textContent = '';
    }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.append(child); }
    replaceChildren(...children) { this.children = children; }
    set innerHTML(value) { this.children = []; this.html = value; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(key, handler) { this.events[key] = handler; }
    querySelector(selector) {
      return walk(this).find(element => selector.startsWith('.')
        ? element.className?.split(' ').includes(selector.slice(1))
        : element.tag === selector);
    }
    focus() { document.activeElement = this; }
  }
  const ids = Object.fromEntries(['site-title', 'generated-at', 'app-list', 'qr-modal', 'qr-title', 'qr-hint', 'qr-canvas']
    .map(id => [id, new Element('div')]));
  const close = new Element('button');
  close.className = 'btn-close';
  ids['qr-modal'].append(close);
  ids['qr-modal'].hidden = true;
  const regions = [new Element('header'), ids['app-list'], new Element('footer')];
  document = {
    events: {},
    createElement: tag => new Element(tag),
    querySelector: selector => ids[selector.slice(1)],
    querySelectorAll: () => regions,
    addEventListener(type, handler) { this.events[type] = handler; },
  };
  const context = vm.createContext({
    document,
    Image: class extends Element { constructor() { super('img'); } },
    window: {},
    fetch: async () => ({ ok: true, json: async () => structuredClone(data) }),
    Date,
    encodeURIComponent,
  });
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return { document, ids, close, regions };
}

function walk(element) {
  return element.children.flatMap(child => [child, ...walk(child)]);
}

function text(element) {
  return [element.textContent, ...element.children.map(text)].filter(Boolean).join(' ');
}

const entry = (file, version = 'v1.0.11', count = 2) => ({
  file, version, downloadCount: count, size: 1024,
  uploadedAt: '2026-10-28T12:00:00Z',
  downloadUrl: `https://example.com/${file}`,
});

test('legacy metadata never offers an incremental archive as the main installer', async () => {
  const { ids } = await render({ apps: [{ id: 'com.apkobj.tools', name: 'APKObj',
    mac: [entry('apkobj-mac-v1.0.11-update.zip'), entry('apkobj-mac-v1.0.11.zip')],
    win: [entry('apkobj-win-v1.0.11-update.zip'), entry('apkobj-win-v1.0.11.zip')],
  }] });
  const links = walk(ids['app-list']).filter(element => element.tag === 'a');
  assert.deepEqual(links.map(element => element.href), [
    'https://example.com/apkobj-mac-v1.0.11.zip',
    'https://example.com/apkobj-win-v1.0.11.zip',
  ]);
  assert.match(text(ids['app-list']), /下载 2 次/);
  assert.doesNotMatch(text(ids['app-list']), /vv1\.0\.11/);
});

test('missing apps metadata shows the empty state', async () => {
  const { ids } = await render({ siteTitle: 'APKObj' });
  assert.match(text(ids['app-list']), /暂无可下载的安装包/);
  assert.doesNotMatch(text(ids['app-list']), /加载失败/);
});

test('QR dialog supports keyboard dismissal and returns focus', async () => {
  const { ids, document, close, regions } = await render({ apps: [{
    id: 'com.apkobj.tools', name: 'APKObj', mac: [entry('apkobj-mac-v1.0.11.zip')],
  }] });
  const qr = walk(ids['app-list']).find(element => element.className === 'btn-qr btn-qr-mac');
  qr.focus();
  qr.events.click({ stopPropagation() {} });
  assert.equal(ids['qr-modal'].hidden, false);
  assert.equal(document.activeElement, close);
  assert.ok(regions.every(element => element.inert));
  document.events.keydown({ key: 'Escape' });
  assert.equal(ids['qr-modal'].hidden, true);
  assert.equal(document.activeElement, qr);
  assert.ok(regions.every(element => !element.inert));
});
