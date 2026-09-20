import { describe, it, expect } from 'vitest';
import { CROPS, getCrop, getTermRanges, findTermAt, termOfDate, buildStagePlan, CropTemplate } from './crops';
import { gregorianToJDN } from '../utils/date';

describe('节气区间', () => {
  it('应覆盖全年且首尾相接', () => {
    const ranges = getTermRanges(2025, 2026);
    expect(ranges.length).toBe(24 * 3 - 1);
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i].startJdn).toBe(ranges[i - 1].endJdn);
      expect(ranges[i].startJdn).toBeGreaterThan(ranges[i - 1].startJdn);
    }
  });

  it('能查出某天所在节气', () => {
    // 按内置节气表：2026 年小寒为 1 月 5 日，大寒为 1 月 19 日
    expect(termOfDate(2026, 1, 5)).toBe('小寒');
    expect(termOfDate(2026, 1, 18)).toBe('小寒');
    expect(termOfDate(2026, 1, 19)).toBe('大寒');
    // 1 月 5 日之前仍属上一年的冬至
    expect(termOfDate(2026, 1, 4)).toBe('冬至');
  });

  it('findTermAt 对区间外的日期返回空', () => {
    const ranges = getTermRanges(2026, 2026);
    expect(findTermAt(ranges, gregorianToJDN(2030, 1, 1))).toBeUndefined();
  });
});

describe('从收获日倒推节点', () => {
  const testCrop: CropTemplate = {
    key: 'test',
    name: '测试作物',
    growthDays: 10,
    stages: [
      { key: 'sow', name: '播种', offsetDays: -10, badTerms: ['冬至'], avoidReason: '天寒地冻' },
      { key: 'harvest', name: '收获', offsetDays: 0, badTerms: [], avoidReason: '' },
    ],
  };

  it('节点原始日 = 收获日 + 偏移天数', () => {
    const harvestJdn = gregorianToJDN(2026, 9, 23);
    const ranges = getTermRanges(2025, 2026);
    const seeds = buildStagePlan(getCrop('rice')!, harvestJdn, ranges);

    expect(seeds.length).toBe(getCrop('rice')!.stages.length);
    for (const seed of seeds) {
      const stage = getCrop('rice')!.stages.find(s => s.key === seed.stageKey)!;
      expect(seed.baseJdn).toBe(harvestJdn + stage.offsetDays);
    }
    // 收获节点不动
    expect(seeds[seeds.length - 1].jdn).toBe(harvestJdn);
  });

  it('落在忌用节气上的节点顺延到下一节气并说明原因', () => {
    // 收获 2026-01-01，倒推 10 天 = 2025-12-22，正值冬至（12/21 起）
    const harvestJdn = gregorianToJDN(2026, 1, 1);
    const ranges = getTermRanges(2025, 2026);
    const seeds = buildStagePlan(testCrop, harvestJdn, ranges);

    const sow = seeds[0];
    // 顺延到冬至结束、小寒开始（2026-01-05）
    expect(sow.jdn).toBe(gregorianToJDN(2026, 1, 5));
    expect(sow.term).toBe('小寒');
    expect(sow.adjustedReason).toContain('冬至');
    expect(sow.adjustedReason).toContain('天寒地冻');
    expect(sow.adjustedReason).toContain('顺延至1月5日');
  });

  it('连续落在忌用节气上会连续顺延', () => {
    const crop: CropTemplate = {
      key: 'test2',
      name: '测试作物2',
      growthDays: 10,
      stages: [
        { key: 'sow', name: '播种', offsetDays: -10, badTerms: ['冬至', '小寒'], avoidReason: '天寒地冻' },
      ],
    };
    const harvestJdn = gregorianToJDN(2026, 1, 1);
    const ranges = getTermRanges(2025, 2026);
    const [sow] = buildStagePlan(crop, harvestJdn, ranges);

    // 冬至 → 小寒（1/5）仍忌 → 大寒（1/19）
    expect(sow.jdn).toBe(gregorianToJDN(2026, 1, 19));
    expect(sow.term).toBe('大寒');
    expect(sow.adjustedReason).toBeTruthy();
  });

  it('不犯忌的节点保持原日期、无调整说明', () => {
    const harvestJdn = gregorianToJDN(2026, 1, 1);
    const ranges = getTermRanges(2025, 2026);
    const seeds = buildStagePlan(testCrop, harvestJdn, ranges);

    const harvest = seeds[1];
    expect(harvest.jdn).toBe(harvest.baseJdn);
    expect(harvest.adjustedReason).toBeUndefined();
  });

  it('每种作物的首节点距收获日都等于全生育期天数', () => {
    for (const crop of CROPS) {
      const harvestJdn = gregorianToJDN(2026, 9, 23);
      const ranges = getTermRanges(2025, 2026);
      const seeds = buildStagePlan(crop, harvestJdn, ranges);
      const first = seeds[0];
      expect(harvestJdn - first.baseJdn).toBe(crop.growthDays);
    }
  });
});
