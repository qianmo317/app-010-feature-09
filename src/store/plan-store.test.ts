import { describe, it, expect, beforeEach } from 'vitest';
import * as store from './plan-store';
import { getOverdueNodes, getConflictDates } from '../almanac/plan';

// localStorage stub
const mem: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => mem[k] ?? null,
  setItem: (k: string, v: string) => { mem[k] = v; },
  removeItem: (k: string) => { delete mem[k]; },
  clear: () => { for (const k of Object.keys(mem)) delete mem[k]; },
};

describe('地块计划全流程', () => {
  beforeEach(() => localStorage.clear());

  it('建地块→生成节点→改期/推迟/完成/停种', () => {
    const p1 = store.addPlot('东岗三亩', 'rice', '2026-09-23');
    const p2 = store.addPlot('西坡两亩', 'wheat', '2026-06-01');
    expect(store.loadPlots().length).toBe(2);
    const nodes = store.loadNodes();
    expect(nodes.length).toBe(8 + 9);

    // 让两块地各有一个节点挤在同一天：把 p1 的收获节点改到 p2 某节点的日子
    const p1Harvest = nodes.find(n => n.plotId === p1.id && n.stageKey === 'harvest')!;
    const p2Sow = nodes.find(n => n.plotId === p2.id && n.stageKey === 'sow')!;
    store.setNodeDate(p1Harvest.id, p2Sow.date);
    const after = store.loadNodes();
    expect(after.find(n => n.id === p1Harvest.id)!.date).toBe(p2Sow.date);
    expect(after.find(n => n.id === p1Harvest.id)!.term).not.toBe('');

    const active = after;
    const conflicts = getConflictDates(active);
    expect(conflicts.size).toBeGreaterThan(0);

    // 过期：把 p2 播种推到过去
    store.setNodeDate(p2Sow.id, '2020-01-01');
    const overdue = getOverdueNodes(store.loadNodes(), '2026-09-20');
    expect(overdue.some(n => n.id === p2Sow.id)).toBe(true);

    // 完成后不再过期、不参与撞期
    store.setNodeDone(p2Sow.id, true);
    expect(getOverdueNodes(store.loadNodes(), '2026-09-20').some(n => n.id === p2Sow.id)).toBe(false);

    // 推迟
    store.postponeNode(p1Harvest.id, 7);
    const moved = store.loadNodes().find(n => n.id === p1Harvest.id)!;
    expect(moved.date > p2Sow.date).toBe(true);

    // 停种
    store.setPlotStopped(p2.id, true);
    expect(store.loadPlots().find(p => p.id === p2.id)!.stopped).toBe(true);
    store.setPlotStopped(p2.id, false);
    expect(store.loadPlots().find(p => p.id === p2.id)!.stopped).toBe(false);

    // 删除
    store.removePlot(p2.id);
    expect(store.loadPlots().length).toBe(1);
    expect(store.loadNodes().every(n => n.plotId === p1.id)).toBe(true);
  });
});
