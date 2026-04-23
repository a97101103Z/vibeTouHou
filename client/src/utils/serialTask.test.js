import { describe, expect, it, vi } from 'vitest';

import { createSerialTaskRunner } from './serialTask.js';

describe('createSerialTaskRunner', () => {
  it('serializes concurrent triggers and runs at most one queued rerun', async () => {
    const order = [];
    const gate = [];
    const task = vi.fn(() => new Promise(resolve => {
      order.push('start');
      gate.push(() => {
        order.push('finish');
        resolve();
      });
    }));

    const trigger = createSerialTaskRunner(task);

    trigger();
    trigger();
    trigger();
    await Promise.resolve();

    expect(task).toHaveBeenCalledTimes(1);
    expect(gate).toHaveLength(1);

    gate.shift()();
    await Promise.resolve();
    await Promise.resolve();

    expect(task).toHaveBeenCalledTimes(2);
    expect(gate).toHaveLength(1);

    gate.shift()();
    await Promise.resolve();
    await Promise.resolve();

    expect(task).toHaveBeenCalledTimes(2);
    expect(order).toEqual(['start', 'finish', 'start', 'finish']);
  });
});
