import test from 'node:test';
import assert from 'node:assert/strict';
import { clientPoint, screenRectangle, geographicRectangle, artworkRectangle, bindRectangleSelection } from '../lib/map-rectangle-selection.ts';

test('rectangle geometry uses viewport offsets, normalizes either drag direction and rejects tiny selections', () => {
  const viewport = { left: 100, top: 200, width: 400, height: 300 };
  assert.deepEqual(clientPoint(viewport, 140, 230), { x: 40, y: 30 });
  assert.equal(clientPoint(viewport, 99, 230), null);
  assert.equal(clientPoint({ ...viewport, width: 0 }, 140, 230), null);
  for (const points of [[{ x: 40, y: 30 }, { x: 280, y: 240 }], [{ x: 280, y: 240 }, { x: 40, y: 30 }]]) {
    const rectangle = screenRectangle(...points);
    assert.deepEqual(rectangle, { left: 40, top: 30, width: 240, height: 210 });
    const calls = [];
    const bounds = geographicRectangle(rectangle, ([x, y]) => { calls.push([x, y]); return { lng: -64.5 + x / 1000, lat: -33 - y / 1000 }; });
    assert.deepEqual(bounds, { west: -64.46, east: -64.22, south: -33.24, north: -33.03 });
    assert.equal(calls.length, 4, 'projection uses all four viewport corners, not global city bounds');
  }
  assert.equal(screenRectangle({ x: 5, y: 5 }, { x: 5, y: 10 }), null);
  assert.equal(screenRectangle({ x: 5, y: 5 }, { x: 8, y: 20 }), null);
  assert.deepEqual(artworkRectangle({ left: 20, top: 10, width: 60, height: 80 }, { width: 100, height: 100 }, { west: 0, east: 10, south: 0, north: 10 }), { west: 2, east: 8, south: 1, north: 9 });
});

function fixture() {
  const events = () => ({ listeners: new Map(), addEventListener(name, fn) { this.listeners.set(name, fn); }, removeEventListener(name, fn) { if (this.listeners.get(name) === fn) this.listeners.delete(name); } });
  const parent = { children: [], append(node) { this.children.push(node); node.parent = this; }, getBoundingClientRect: () => ({ left: 80, top: 190 }) };
  const document = { ...events(), createElement: () => ({ style: {}, setAttribute() {}, remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); } }) };
  const canvas = { ...events(), ownerDocument: document, parentElement: parent, style: { cursor: 'grab', touchAction: 'auto', userSelect: '' }, getBoundingClientRect: () => ({ left: 100, top: 200, width: 400, height: 300 }), setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {} };
  const control = initial => ({ enabled: initial, isEnabled() { return this.enabled; }, disable() { this.enabled = false; }, enable() { this.enabled = true; } });
  const interactions = [control(true), control(false)];
  const chosen = []; let cancelled = 0; let live = true;
  const release = bindRectangleSelection({ canvas, container: parent, interactions, isActive: () => live, unproject: ([x, y]) => ({ lng: x / 10, lat: -y / 10 }), onSelect: bounds => chosen.push(bounds), onCancel: () => cancelled++ });
  const emit = (name, x, y, extra = {}) => canvas.listeners.get(name)?.({ pointerId: 4, button: 0, isPrimary: true, clientX: x, clientY: y, preventDefault() {}, stopPropagation() {}, ...extra });
  return { canvas, document, parent, interactions, chosen, emit, release, cancelled: () => cancelled, dispose: () => { release(); live = false; } };
}

test('pointer drag previews without committing and commits once only after a valid release', () => {
  const app = fixture();
  assert.deepEqual(app.interactions.map(control => control.enabled), [false, false]);
  app.emit('pointerdown', 140, 230);
  assert.equal(app.chosen.length, 0);
  app.emit('pointermove', 300, 400);
  assert.equal(app.chosen.length, 0); assert.equal(app.parent.children.length, 1);
  assert.equal(app.parent.children[0].style.left, '60px');
  app.emit('pointerup', 300, 400);
  assert.deepEqual(app.chosen, [{ west: 4, east: 20, south: -20, north: -3 }]);
  assert.equal(app.parent.children.length, 0);
  app.emit('pointerup', 350, 450); assert.equal(app.chosen.length, 1);
  app.release(); assert.deepEqual(app.interactions.map(control => control.enabled), [true, false]);
  assert.equal(app.canvas.style.cursor, 'grab'); assert.equal(app.canvas.listeners.size, 0);
  app.release();
});

test('cancel, lost capture, Escape, outside starts and tiny drags never commit', () => {
  for (const end of ['pointercancel', 'lostpointercapture', 'escape', 'tiny', 'outside']) {
    const app = fixture();
    app.emit('pointerdown', 99, 230); assert.equal(app.parent.children.length, 0);
    app.emit('pointerdown', 140, 230); app.emit('pointermove', 300, 400);
    if (end === 'escape') app.document.listeners.get('keydown')({ key: 'Escape', preventDefault() {}, stopPropagation() {} });
    else if (end === 'tiny') app.emit('pointerup', 142, 232);
    else if (end === 'outside') app.emit('pointerup', 501, 400);
    else app.emit(end, 300, 400);
    assert.equal(app.chosen.length, 0, end); assert.equal(app.parent.children.length, 0, end);
    app.dispose();
  }
});

test('dispose clears preview, restores controls before destruction and makes captured events inert', () => {
  const app = fixture(); app.emit('pointerdown', 140, 230);
  const staleUp = app.canvas.listeners.get('pointerup');
  app.dispose();
  assert.equal(app.parent.children.length, 0);
  assert.deepEqual(app.interactions.map(control => control.enabled), [true, false]);
  staleUp({ pointerId: 4, clientX: 300, clientY: 400 });
  assert.equal(app.chosen.length, 0); assert.equal(app.document.listeners.size, 0);
});
