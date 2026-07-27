import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorBackup } from '../packages/core/src/editorBackup.js';

const createStorage = () => {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

test('editor backup requires a stable key and isolates different editors', async () => {
  const storage = createStorage();
  assert.throws(() => createEditorBackup({ backupKey: '', storage }), /backupKey/);

  const first = createEditorBackup({ backupKey: 'admin-1:posts:post-1', storage });
  const second = createEditorBackup({ backupKey: 'admin-1:posts:post-2', storage });

  await first.save({ title: 'First', markdown: '# One' });
  await second.save({ title: 'Second', markdown: '# Two' });

  assert.deepEqual((await first.discover())?.payload, { title: 'First', markdown: '# One' });
  assert.deepEqual((await second.discover())?.payload, { title: 'Second', markdown: '# Two' });
});

test('editor backup debounces changes and flushes only the latest complete payload', async () => {
  const storage = createStorage();
  const statuses = [];
  const backup = createEditorBackup({
    backupKey: 'admin-1:products:product-1',
    storage,
    debounceMs: 60_000,
    onStatus: (event) => statuses.push(event.status),
  });

  backup.schedule({ title: 'Old', markdown: '# Old' });
  backup.schedule({ title: 'Latest', markdown: '# Latest', category: 'news' });
  const entry = await backup.flush();

  assert.deepEqual(entry?.payload, { title: 'Latest', markdown: '# Latest', category: 'news' });
  assert.deepEqual((await backup.discover())?.payload, entry?.payload);
  assert.deepEqual(statuses.slice(0, 4), ['scheduled', 'scheduled', 'saving', 'saved']);
});

test('editor backup automatically persists after the debounce window and publishes events', async () => {
  const storage = createStorage();
  const events = [];
  const backup = createEditorBackup({ backupKey: 'admin-1:posts:post-3', storage, debounceMs: 5 });
  const saved = new Promise((resolve) => {
    backup.subscribe((event) => {
      events.push(event);
      if (event.type === 'status' && event.status === 'saved') resolve();
    });
  });

  backup.schedule({ markdown: '# First' });
  backup.schedule({ markdown: '# Latest' });
  await saved;

  assert.deepEqual((await backup.discover())?.payload, { markdown: '# Latest' });
  assert.equal(events.some((event) => event.type === 'status' && event.status === 'scheduled'), true);
  assert.equal(events.some((event) => event.type === 'status' && event.status === 'saved'), true);
});

test('editor backup discovers, restores, discards and clears without mutating host data', async () => {
  const storage = createStorage();
  const backup = createEditorBackup({ backupKey: 'admin-2:pages:page-1', storage });
  const original = { title: 'Unsaved', markdown: '# Draft', seo: { title: 'SEO' } };

  await backup.save(original);
  original.title = 'Changed after backup';

  const discovered = await backup.discover();
  assert.equal(discovered?.backupKey, 'admin-2:pages:page-1');
  assert.equal(typeof discovered?.savedAt, 'string');
  assert.deepEqual(await backup.restore(), { title: 'Unsaved', markdown: '# Draft', seo: { title: 'SEO' } });

  await backup.discard();
  assert.equal(await backup.discover(), null);

  await backup.save({ title: 'Another change' });
  await backup.clear();
  assert.equal(await backup.discover(), null);
});

test('editor backup reports storage failures through status and error events', async () => {
  const statusEvents = [];
  const errorEvents = [];
  const storageError = new Error('storage full');
  const backup = createEditorBackup({
    backupKey: 'admin-3:posts:post-1',
    storage: {
      getItem: () => null,
      setItem: () => { throw storageError; },
      removeItem: () => undefined,
    },
    onStatus: (event) => statusEvents.push(event),
    onError: (event) => errorEvents.push(event),
  });

  await assert.rejects(backup.save({ markdown: '# Full' }), storageError);
  assert.equal(backup.status, 'error');
  assert.equal(statusEvents.at(-1)?.status, 'error');
  assert.equal(errorEvents.at(-1)?.operation, 'save');
  assert.equal(errorEvents.at(-1)?.error, storageError);
});

test('editor backup rejects file data instead of pretending it was preserved', async () => {
  const storage = createStorage();
  const backup = createEditorBackup({ backupKey: 'admin-3:posts:post-2', storage });
  const file = new File(['image'], 'cover.png', { type: 'image/png' });

  await assert.rejects(backup.save({ markdown: '# File', cover: file }), /File or Blob/);
  assert.equal(storage.values.size, 0);
});

test('destroy cancels a pending automatic backup', async () => {
  const storage = createStorage();
  const backup = createEditorBackup({ backupKey: 'admin-4:posts:post-1', storage, debounceMs: 5 });

  backup.schedule({ markdown: '# Do not save' });
  backup.destroy();
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(storage.values.size, 0);
});
