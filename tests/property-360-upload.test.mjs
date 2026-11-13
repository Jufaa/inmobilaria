import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compile = path => ts.transpileModule(readFileSync(path, 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const policy = {};
new Function('exports', compile('lib/properties/tour360-upload.ts'))(policy);
const file = (overrides = {}) => ({ name: 'living.jpg', type: 'image/jpeg', size: 1024, ...overrides });
const nodes = (tree, type) => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree)
  ? tree.flatMap(item => nodes(item, type))
  : [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
const content = tree => JSON.stringify(tree);

function mount(initialProps = {}) {
  const slots = [], effects = [], images = [], revoked = [], created = [];
  let cursor = 0, props = initialProps, updates = 0;
  const hooks = {
    useId: () => 'tour-test',
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { updates++; slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useEffect(callback, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
        previous?.cleanup?.();
        const effect = { deps, callback };
        slots[index] = effect;
        effects.push(effect);
      }
    },
  };
  class MockImage {
    constructor() { images.push(this); }
    naturalWidth = 4000;
    naturalHeight = 2000;
    src = '';
    onload = null;
    onerror = null;
  }
  const mockURL = {
    createObjectURL(value) { const url = `blob:local-${created.length}`; created.push({ value, url }); return url; },
    revokeObjectURL(url) { revoked.push(url); },
  };
  const exports = {};
  new Function('require', 'exports', 'Image', 'URL', compile('components/auth/Property360Upload.tsx'))(id => {
    if (id === 'react') return hooks;
    if (id === '@/lib/properties/tour360-upload') return policy;
    if (id === 'next/dynamic') return { __esModule: true, default: (_, options) => {
      assert.equal(options.ssr, false);
      return 'mock-panorama';
    } };
    if (id.endsWith('.module.css')) return { __esModule: true, default: {} };
    return require(id);
  }, exports, MockImage, mockURL);
  const render = (nextProps = props) => {
    props = nextProps;
    cursor = 0;
    const tree = exports.Property360Upload(props);
    while (effects.length) { const effect = effects.shift(); effect.cleanup = effect.callback(); }
    return tree;
  };
  const choose = value => nodes(render(), 'input')[0].props.onChange({ currentTarget: { files: value ? [value] : [], value: 'selected' } });
  const click = label => {
    const button = nodes(render(), 'button').find(node => node.props.children === label);
    assert.ok(button, `Missing ${label}`);
    return button.props.onClick?.();
  };
  render();
  return { render, choose, click, images, created, revoked, get updates() { return updates; },
    unmount() { for (const slot of slots) slot?.cleanup?.(); } };
}

test('file policy only accepts bounded nonempty JPEG, PNG and WebP', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) assert.equal(policy.validateTour360File(file({ type })), null);
  for (const candidate of [file({ type: 'image/svg+xml' }), file({ type: '' }), file({ size: 0 }), file({ size: 20 * 1024 * 1024 + 1 })]) {
    assert.equal(typeof policy.validateTour360File(candidate), 'string');
  }
  assert.equal(policy.validateTour360File(file({ size: 20 * 1024 * 1024 })), null);
});

test('dimension policy requires approximately 2:1 within GPU bounds', () => {
  for (const dimensions of [[4000, 2000], [4096, 2048], [8192, 4096], [2000, 1020], [1900, 1000], [2100, 1000]]) assert.equal(policy.validateTour360Dimensions(...dimensions), null);
  for (const dimensions of [[1000, 1000], [9000, 4500], [8192, 4200], [0, 0], [Infinity, 2000], [NaN, 1]]) {
    assert.equal(typeof policy.validateTour360Dimensions(...dimensions), 'string');
  }
});

test('successful adapter resources must be safe HTTPS URLs without credentials', () => {
  assert.equal(policy.isSafeTour360Url('https://media.example.test/tour.jpg'), true);
  for (const url of ['http://media.example.test/a', 'javascript:alert(1)', 'blob:a', '/tour.jpg', 'https://user:secret@media.example.test/a', '', undefined]) {
    assert.equal(policy.isSafeTour360Url(url), false);
  }
});

test('component keeps parent submission safe and has no implicit demo preview', () => {
  const h = mount();
  const tree = h.render();
  assert.equal(nodes(tree, 'form').length, 0);
  assert.equal(nodes(tree, 'input')[0].props.name, undefined);
  assert.equal(nodes(tree, 'input')[0].props.type, 'file');
  assert.ok(nodes(tree, 'button').every(button => button.props.type === 'button'));
  for (const label of ['Agregar 360°', 'Cambiar', 'Quitar', 'Subir 360°']) assert.ok(content(tree).includes(label));
  assert.equal(nodes(tree, 'mock-panorama').length, 0);
  assert.ok(content(tree).includes('Vista previa local; no se ha subido ni guardado'));
});

test('actual selection handler rejects bad files before object URL creation', () => {
  const h = mount();
  h.choose(file({ type: 'image/svg+xml' }));
  assert.equal(h.created.length, 0);
  assert.ok(nodes(h.render(), 'p').some(node => node.props.role === 'alert'));
  h.choose(file({ size: 21 * 1024 * 1024 }));
  assert.equal(h.created.length, 0);
});

test('preview uses selected local URL, explicit label and URL key; replacement and removal revoke', () => {
  const h = mount();
  h.choose(file());
  h.images[0].onload();
  let preview = nodes(h.render(), 'mock-panorama')[0];
  assert.equal(preview.props.url, 'blob:local-0');
  assert.equal(preview.key, 'blob:local-0');
  assert.match(preview.props.label, /local/i);
  h.choose(file({ name: 'next.png', type: 'image/png' }));
  assert.deepEqual(h.revoked, ['blob:local-0']);
  h.images[1].onload();
  preview = nodes(h.render(), 'mock-panorama')[0];
  assert.equal(preview.props.url, 'blob:local-1');
  h.click('Quitar');
  assert.deepEqual(h.revoked, ['blob:local-0', 'blob:local-1']);
  assert.equal(nodes(h.render(), 'mock-panorama').length, 0);
});

test('bad dimensions and decode errors discard and revoke pending resources', () => {
  const h = mount();
  h.choose(file());
  h.images[0].naturalWidth = 1000;
  h.images[0].onload();
  assert.deepEqual(h.revoked, ['blob:local-0']);
  assert.equal(nodes(h.render(), 'mock-panorama').length, 0);
  h.choose(file());
  h.images[1].onerror();
  assert.deepEqual(h.revoked, ['blob:local-0', 'blob:local-1']);
});

test('cancel leaves current selection unchanged; stale decode cannot resurrect removed or replaced preview', () => {
  const h = mount();
  h.choose(file());
  const stale = h.images[0].onload;
  h.choose(null);
  assert.deepEqual(h.revoked, []);
  h.choose(file({ name: 'replacement.jpg' }));
  stale();
  assert.equal(nodes(h.render(), 'mock-panorama').length, 0);
  const removed = h.images[1].onload;
  h.click('Quitar');
  removed();
  assert.equal(nodes(h.render(), 'mock-panorama').length, 0);
});

test('unmount revokes ready/pending URL and prevents asynchronous updates', () => {
  for (const loaded of [false, true]) {
    const h = mount();
    h.choose(file());
    const callback = h.images[0].onload;
    if (loaded) callback();
    h.unmount();
    const count = h.updates;
    callback();
    assert.equal(h.updates, count);
    assert.deepEqual(h.revoked, ['blob:local-0']);
  }
});

test('absent adapter or property identity never uploads and explains configuration requirement', async () => {
  let calls = 0;
  for (const props of [{ propertyId: 'p' }, { uploadAdapter: async () => { calls++; return { url: 'https://example.test/a.jpg' }; } }]) {
    const h = mount(props);
    h.choose(file());
    h.images[0].onload();
    assert.equal(nodes(h.render(), 'button').find(node => node.props.children === 'Subir 360°').props.disabled, true);
    await h.click('Subir 360°');
    assert.match(content(h.render()), /configur|Guarda|guarda/);
  }
  assert.equal(calls, 0);
});

test('disabled blocks controls and direct file/upload handler invocation', async () => {
  let calls = 0;
  const h = mount({ disabled: true, propertyId: 'p', uploadAdapter: async () => { calls++; } });
  assert.ok(nodes(h.render(), 'button').every(node => node.props.disabled));
  assert.equal(nodes(h.render(), 'input')[0].props.disabled, true);
  h.choose(file());
  await h.click('Subir 360°');
  assert.equal(h.created.length, 0);
  assert.equal(calls, 0);
});

test('adapter success is not persisted association and unsafe adapter results fail honestly', async () => {
  for (const url of ['https://media.example.test/tour.jpg', 'https://user:secret@media.example.test/tour.jpg']) {
    let request;
    const selected = file();
    const h = mount({ propertyId: 'p', uploadAdapter: async value => { request = value; return { url }; } });
    h.choose(selected);
    h.images[0].onload();
    await h.click('Subir 360°');
    assert.equal(request.propertyId, 'p');
    assert.equal(request.file, selected);
    assert.ok(request.signal instanceof AbortSignal);
    if (policy.isSafeTour360Url(url)) {
      assert.match(content(h.render()), /no se ha guardado la asociación/);
      assert.doesNotMatch(content(h.render()), /no se ha subido ni guardado/i);
    }
    else assert.ok(nodes(h.render(), 'p').some(node => node.props.role === 'alert'));
  }
});

test('replacement aborts pending upload and ignores stale successful completion', async () => {
  let resolve, signal;
  const h = mount({ propertyId: 'p', uploadAdapter: request => { signal = request.signal; return new Promise(done => { resolve = done; }); } });
  h.choose(file());
  h.images[0].onload();
  const upload = h.click('Subir 360°');
  h.choose(file({ name: 'new.jpg' }));
  assert.equal(signal.aborted, true);
  resolve({ url: 'https://example.test/old.jpg' });
  await upload;
  assert.doesNotMatch(content(h.render()), /Archivo subido/);
});

test('disable or property target change clears local resources and cancels upload', async () => {
  for (const nextProps of [{ disabled: true, propertyId: 'p' }, { propertyId: 'other' }]) {
    let resolve, signal;
    const uploadAdapter = request => { signal = request.signal; return new Promise(done => { resolve = done; }); };
    const h = mount({ propertyId: 'p', uploadAdapter });
    h.choose(file());
    h.images[0].onload();
    const uploading = h.click('Subir 360°');
    h.render({ ...nextProps, uploadAdapter });
    assert.equal(signal.aborted, true);
    assert.deepEqual(h.revoked, ['blob:local-0']);
    resolve({ url: 'https://example.test/old.jpg' });
    await uploading;
    assert.equal(nodes(h.render(), 'mock-panorama').length, 0);
    assert.doesNotMatch(content(h.render()), /Archivo subido/);
  }
});

test('unmount aborts adapter and does not apply its later failure', async () => {
  let reject, signal;
  const h = mount({ propertyId: 'p', uploadAdapter: request => { signal = request.signal; return new Promise((_, fail) => { reject = fail; }); } });
  h.choose(file());
  h.images[0].onload();
  const uploading = h.click('Subir 360°');
  h.unmount();
  const count = h.updates;
  assert.equal(signal.aborted, true);
  reject(new Error('Upload failed'));
  await uploading;
  assert.equal(h.updates, count);
});

test('adapter rejection is contained and does not claim persistence', async () => {
  const h = mount({ propertyId: 'p', uploadAdapter: async () => { throw new Error('Offline'); } });
  h.choose(file());
  h.images[0].onload();
  await h.click('Subir 360°');
  assert.ok(nodes(h.render(), 'p').some(node => node.props.role === 'alert'));
  assert.doesNotMatch(content(h.render()), /Archivo subido/);
});

test('Panorama keeps synthetic and remote-demo default labels but accepts a local label', () => {
  const exports = {};
  new Function('require', 'exports', compile('components/Panorama.tsx'))(id => {
    if (id === 'react') return { useRef: () => ({ current: null }), useState: value => [value, () => {}], useEffect() {} };
    if (id === 'three' || id.includes('OrbitControls')) return {};
    return require(id);
  }, exports);
  assert.match(content(exports.default({})), /Panorama de demostración/);
  assert.match(content(exports.default({ url: '/demo-assets/example.jpg' })), /Panorama sintético/);
  assert.match(content(exports.default({ url: 'blob:local', label: 'Local preview' })), /Local preview/);
  assert.doesNotMatch(content(exports.default({ url: 'blob:local', label: 'Local preview' })), /Panorama de demostración/);
});
