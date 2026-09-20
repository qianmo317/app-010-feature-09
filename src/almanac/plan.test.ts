import { describe, it, expect } from 'vitest';
import {
  buildPlot, rebuildWithHarvest, changeNodeDate, delayNode,
  shiftNodeToNextSafe, markNodeDone, stopPlot, buildView, toJdn, fromJdn, shiftDate
} from './plan';
import { CROPS } from './crops';
import { getTermDateList } from './solar-terms';

// 取某年某节气的公历日期
function termDate(year: number, term: string): string {
  const t = getTermDateList(year, year + 1).find(x => x.term === term && x.year === year)!;
  return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`;
}

describe('节气窗口', () => {
  it('跨年节气按日先后排序', () => {
    const list = getTermDateList(2025, 2026);
    expect(list.length).toBe(48);
    for (let i = 1; i < list.length; i++) {
      expect(list[i].jdn).toBeGreaterThan(list[i - 1].jdn);
    }
    expect(list[0].term).toBe('小寒');
    expect(list[list.length - 1].term).toBe('冬至');
  });

  it('2026 年清明仍在 4 月 5 日前后', () => {
    expect(termDate(2026, '清明')).toBe('2026-04-05');
  });
});

describe('倒推建计划', () => {
  it('收成节点落在收成日，其余节点按偏移往前排且先后有序', () => {
    const plot = buildPlot({ name: '东头地', cropId: 'spring-corn', harvestDate: '2026-08-25' });
    const harvest = plot.nodes.find(n => n.key === 'harvest')!;
    expect(harvest.date).toBe('2026-08-25');
    const sow = plot.nodes.find(n => n.key === 'sow')!;
    expect(sow.originalDate).toBe(shiftDate('2026-08-25', -115));
    const dates = plot.nodes.map(n => toJdn(n.originalDate));
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeGreaterThan(dates[i - 1]);
    }
  });

  it('倒推日撞上忌用节气时自动顺延并说明原因', () => {
    // 春玉米播种偏移 -115；2026 大暑 + 115 天得到一个收成日，
    // 使播种恰好倒推到大暑（播种忌大暑烫芽）
    const harvest = shiftDate(termDate(2026, '大暑'), 115);
    const plot = buildPlot({ name: '南坡', cropId: 'spring-corn', harvestDate: harvest });
    const sow = plot.nodes.find(n => n.key === 'sow')!;
    expect(sow.originalDate).toBe(termDate(2026, '大暑'));
    expect(sow.shifted).toBe(true);
    expect(sow.shiftReason).toContain('大暑');
    expect(sow.shiftReason).toMatch(/顺延/);
    expect(toJdn(sow.date)).toBeGreaterThan(toJdn(sow.originalDate));
  });

  it('恰逢宜用节气保持不动并标记 preferred', () => {
    // 夏玉米播种偏移 -95；让播种恰好落在芒种
    const harvest = shiftDate(termDate(2026, '芒种'), 95);
    const plot = buildPlot({ name: '河西', cropId: 'summer-corn', harvestDate: harvest });
    const sow = plot.nodes.find(n => n.key === 'sow')!;
    expect(sow.date).toBe(termDate(2026, '芒种'));
    expect(sow.preferred).toBe(true);
    expect(sow.shifted).toBe(false);
  });

  it('每种作物都能正常建出含收成节点的计划', () => {
    for (const crop of CROPS) {
      const plot = buildPlot({ name: '试种地', cropId: crop.id, harvestDate: '2026-10-01' });
      expect(plot.nodes.length).toBe(crop.stages.length);
      const harvest = plot.nodes.find(n => n.key === 'harvest');
      expect(harvest).toBeDefined();
      expect(harvest!.date).toBe('2026-10-01');
    }
  });

  it('收成日本身撞忌用节气时也会顺延并说明原因', () => {
    // 收获忌谷雨（多雨晒不干），15 天后就是宜收的立夏
    const plot = buildPlot({ name: '北岗', cropId: 'chinese-cabbage', harvestDate: termDate(2026, '谷雨') });
    const harvest = plot.nodes.find(n => n.key === 'harvest')!;
    expect(harvest.shifted).toBe(true);
    expect(harvest.shiftReason).toContain('谷雨');
    expect(harvest.date).toBe(termDate(2026, '立夏'));
  });

  it('忌用节气后近一个半月全是忌日时，保留原日子并标记需人工处理', () => {
    const plot = buildPlot({ name: '北岗', cropId: 'sweet-potato', harvestDate: termDate(2026, '大雪') });
    const harvest = plot.nodes.find(n => n.key === 'harvest')!;
    expect(harvest.shifted).toBe(false);
    expect(harvest.warning).toContain('人工');
  });
});

describe('逾期与同日冲突', () => {
  it('过了计划日还没做的标逾期，已做的不算逾期', () => {
    let plot = buildPlot({ name: '东头地', cropId: 'spring-corn', harvestDate: '2026-08-25' });
    const sowDate = plot.nodes.find(n => n.key === 'sow')!.date;
    const today = shiftDate(sowDate, 10);
    const view = buildView([plot], today);
    const sow = view.views.find(v => v.node.key === 'sow')!;
    expect(sow.overdue).toBe(true);
    expect(sow.daysOverdue).toBe(10);

    plot = markNodeDone(plot, 'sow', true, today);
    const view2 = buildView([plot], today);
    expect(view2.overdueCount).toBe(0);
    expect(plot.nodes.find(n => n.key === 'sow')!.doneDate).toBe(today);
  });

  it('未来 14 天内的活计出现在 upcoming，已做的不出现', () => {
    let plot = buildPlot({ name: '东头地', cropId: 'spring-corn', harvestDate: '2026-08-25' });
    const sowDate = plot.nodes.find(n => n.key === 'sow')!.date;
    const view = buildView([plot], shiftDate(sowDate, -5));
    expect(view.upcoming.some(v => v.node.key === 'sow')).toBe(true);

    plot = markNodeDone(plot, 'sow', true, sowDate);
    const view2 = buildView([plot], shiftDate(sowDate, -5));
    expect(view2.upcoming.some(v => v.node.key === 'sow')).toBe(false);
  });

  it('不同地块活计挤在同一天时互相标出', () => {
    const p1 = buildPlot({ name: '东地', cropId: 'spring-corn', harvestDate: '2026-08-25' });
    let p2 = buildPlot({ name: '西地', cropId: 'peanut', harvestDate: '2026-09-23' });
    const target = p1.nodes.find(n => n.key === 'sow')!.date;
    p2 = changeNodeDate(p2, 'topdress', target);
    const view = buildView([p1, p2], '2026-01-01');
    expect(view.conflictCount).toBe(2);
    const n1 = view.views.find(v => v.plotName === '东地' && v.node.key === 'sow')!;
    expect(n1.conflictsWith).toEqual(['西地·开花下针追肥']);
  });

  it('已停掉的地块不参与逾期和冲突统计', () => {
    const p1 = buildPlot({ name: '东地', cropId: 'spring-corn', harvestDate: '2026-08-25' });
    const stopped = stopPlot(buildPlot({ name: '西地', cropId: 'peanut', harvestDate: '2026-08-25' }));
    const view = buildView([p1, stopped], '2026-09-01');
    expect(view.stoppedCount).toBe(1);
    expect(view.views.every(v => v.plotName !== '西地')).toBe(true);
  });
});

describe('节点改期与顺延', () => {
  it('人工改期保留日期并重新对节气给提示', () => {
    let plot = buildPlot({ name: '南坡', cropId: 'spring-corn', harvestDate: '2026-08-25' });
    plot = changeNodeDate(plot, 'sow', termDate(2026, '小寒'));
    const sow = plot.nodes.find(n => n.key === 'sow')!;
    expect(sow.manual).toBe(true);
    expect(sow.date).toBe(termDate(2026, '小寒'));
    expect(sow.warning).toContain('小寒');
  });

  it('顺延默认加 7 天', () => {
    let plot = buildPlot({ name: '南坡', cropId: 'spring-corn', harvestDate: '2026-08-25' });
    const before = plot.nodes.find(n => n.key === 'topdress')!.date;
    plot = delayNode(plot, 'topdress');
    expect(plot.nodes.find(n => n.key === 'topdress')!.date).toBe(fromJdn(toJdn(before) + 7));
  });

  it('一键挪到下一个宜用节气', () => {
    let plot = buildPlot({ name: '南坡', cropId: 'spring-corn', harvestDate: '2026-08-25' });
    plot = changeNodeDate(plot, 'sow', termDate(2026, '大寒'));
    plot = shiftNodeToNextSafe(plot, 'sow');
    const sow = plot.nodes.find(n => n.key === 'sow')!;
    expect(toJdn(sow.date)).toBeGreaterThan(toJdn(termDate(2026, '大寒')));
    expect(sow.preferred).toBe(true);
  });

  it('改收成日重新倒推：未手改的节点跟着重排，手改和已做状态保留', () => {
    let plot = buildPlot({ name: '南坡', cropId: 'spring-corn', harvestDate: '2026-08-25' });
    plot = markNodeDone(plot, 'sow', true, '2026-05-01');
    plot = changeNodeDate(plot, 'topdress', '2026-06-20');
    const rebuilt = rebuildWithHarvest(plot, '2026-09-10');
    const sow = rebuilt.nodes.find(n => n.key === 'sow')!;
    expect(sow.done).toBe(true);
    expect(sow.doneDate).toBe('2026-05-01');
    expect(sow.date).toBe(shiftDate('2026-09-10', -115));
    expect(sow.manual).toBe(false);
    const top = rebuilt.nodes.find(n => n.key === 'topdress')!;
    expect(top.date).toBe('2026-06-20');
    expect(top.manual).toBe(true);
  });

  it('节点次序被改乱时给出冲突警告，改回来后警告清除', () => {
    let plot = buildPlot({ name: '南坡', cropId: 'spring-corn', harvestDate: '2026-08-25' });
    plot = changeNodeDate(plot, 'sow', '2026-08-20');
    let sow = plot.nodes.find(n => n.key === 'sow')!;
    expect(sow.warning).toContain('次序冲突');
    plot = changeNodeDate(plot, 'sow', shiftDate('2026-08-25', -115));
    sow = plot.nodes.find(n => n.key === 'sow')!;
    expect(sow.warning ?? '').not.toContain('次序冲突');
  });
});
