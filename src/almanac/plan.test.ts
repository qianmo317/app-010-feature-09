import { describe, it, expect } from 'vitest';
import { generateNodes, getOverdueNodes, getConflictDates, refreshNodeTerm, Plot, PlanNode } from './plan';

function makePlot(id: string, harvestDate: string, stopped = false): Plot {
  return { id, name: `地块${id}`, cropKey: 'rice', harvestDate, stopped, createdAt: '2026-01-01' };
}

function makeNode(id: string, plotId: string, date: string, done = false): PlanNode {
  return { id, plotId, stageKey: id, name: `节点${id}`, date, baseDate: date, term: '', done };
}

describe('计划生成', () => {
  it('按作物模板生成全部节点，收获节点落在计划收获日', () => {
    const plot = makePlot('p1', '2026-09-23');
    const nodes = generateNodes(plot);

    expect(nodes.length).toBe(8); // 水稻 8 个节点
    const harvest = nodes.find(n => n.stageKey === 'harvest')!;
    expect(harvest.date).toBe('2026-09-23');
    // 每个节点都带节气标注
    for (const n of nodes) {
      expect(n.term).not.toBe('');
      expect(n.done).toBe(false);
    }
    // 最早的节点是整地育秧，比收获日早 130 天
    const first = nodes.find(n => n.stageKey === 'seedling')!;
    expect(first.baseDate).toBe('2026-05-16');
  });

  it('跨年的计划能正确标注上一年的节气', () => {
    // 冬小麦 2026-06-01 收获，播种倒推到 2025 年秋
    const plot: Plot = { ...makePlot('p2', '2026-06-01'), cropKey: 'wheat' };
    const nodes = generateNodes(plot);
    const sow = nodes.find(n => n.stageKey === 'sow')!;
    expect(sow.baseDate.startsWith('2025-')).toBe(true);
    expect(sow.term).not.toBe('');
  });

  it('改期后重算节气', () => {
    const node = makeNode('n1', 'p1', '2026-01-05');
    refreshNodeTerm(node);
    expect(node.term).toBe('小寒');
    node.date = '2026-01-19';
    refreshNodeTerm(node);
    expect(node.term).toBe('大寒');
  });
});

describe('过期检测', () => {
  it('过了日子还没做的标为过期', () => {
    const nodes = [
      makeNode('a', 'p1', '2026-09-01'),          // 过期未做
      makeNode('b', 'p1', '2026-09-01', true),    // 过期但已做
      makeNode('c', 'p1', '2026-09-20'),          // 当天
      makeNode('d', 'p1', '2026-09-21'),          // 未到
    ];
    const overdue = getOverdueNodes(nodes, '2026-09-20');
    expect(overdue.map(n => n.id)).toEqual(['a']);
  });
});

describe('撞期检测', () => {
  it('不同地块挤在同一天的标出来', () => {
    const nodes = [
      makeNode('a', 'p1', '2026-09-10'),
      makeNode('b', 'p2', '2026-09-10'),
      makeNode('c', 'p3', '2026-09-11'),
    ];
    const conflicts = getConflictDates(nodes);
    expect(conflicts.size).toBe(1);
    expect(conflicts.get('2026-09-10')!.map(n => n.id)).toEqual(['a', 'b']);
  });

  it('同一地块同一天的多个节点不算撞期', () => {
    const nodes = [
      makeNode('a', 'p1', '2026-09-10'),
      makeNode('b', 'p1', '2026-09-10'),
    ];
    expect(getConflictDates(nodes).size).toBe(0);
  });

  it('已完成的节点不参与撞期', () => {
    const nodes = [
      makeNode('a', 'p1', '2026-09-10', true),
      makeNode('b', 'p2', '2026-09-10'),
    ];
    expect(getConflictDates(nodes).size).toBe(0);
  });
});
