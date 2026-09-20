import { SOLAR_TERMS } from './constants';
import { getSolarTermDates } from './lunar';
import { gregorianToJDN, jdnToGregorian } from '../utils/date';

// 农事节点模板：相对收获日倒推
export interface StageTemplate {
  key: string;
  name: string;
  offsetDays: number;   // 相对收获日的偏移天数（负数为收获前）
  badTerms: string[];   // 不适宜安排该农事的节气
  avoidReason: string;  // 落在忌用节气上要挪开的原因
}

// 作物模板
export interface CropTemplate {
  key: string;
  name: string;
  growthDays: number;   // 全生育期天数（播种到收获）
  stages: StageTemplate[];
}

const SOW_REASON = '气温极端，种子难以发芽出苗';
const HEAT_FERTILIZE_REASON = '高温施肥易烧苗';
const WET_HARVEST_REASON = '多雨潮湿，不利收割晾晒';
const FROZEN_FIELD_REASON = '地冻未消，无法整地';

// 常见作物模板（生长天数为一般参考值，节点按收获日倒推）
export const CROPS: CropTemplate[] = [
  {
    key: 'rice',
    name: '水稻（一季稻）',
    growthDays: 130,
    stages: [
      { key: 'seedling', name: '整地育秧', offsetDays: -130, badTerms: ['小寒', '大寒'], avoidReason: '天寒地冻，秧苗易受冻害' },
      { key: 'transplant', name: '插秧移栽', offsetDays: -105, badTerms: ['大暑'], avoidReason: '高温煮苗，移栽成活率低' },
      { key: 'tiller', name: '分蘖期追肥', offsetDays: -85, badTerms: ['大暑'], avoidReason: HEAT_FERTILIZE_REASON },
      { key: 'sundry', name: '晒田控苗', offsetDays: -65, badTerms: ['雨水', '谷雨'], avoidReason: '雨多田烂，晒田不成' },
      { key: 'booting', name: '孕穗期追肥', offsetDays: -50, badTerms: ['霜降'], avoidReason: '气温走低，肥效难发挥' },
      { key: 'spray', name: '破口期防稻瘟螟虫', offsetDays: -30, badTerms: [], avoidReason: '' },
      { key: 'water', name: '灌浆期水浆管理', offsetDays: -15, badTerms: [], avoidReason: '' },
      { key: 'harvest', name: '收割晾晒', offsetDays: 0, badTerms: ['雨水', '谷雨'], avoidReason: WET_HARVEST_REASON },
    ],
  },
  {
    key: 'wheat',
    name: '冬小麦',
    growthDays: 240,
    stages: [
      { key: 'plow', name: '整地施基肥', offsetDays: -240, badTerms: ['大暑'], avoidReason: '高温整地，墒情难保' },
      { key: 'sow', name: '播种', offsetDays: -235, badTerms: ['大寒', '大暑'], avoidReason: SOW_REASON },
      { key: 'weed', name: '冬前除草', offsetDays: -200, badTerms: ['霜降'], avoidReason: '气温走低，除草剂药效差' },
      { key: 'winter-water', name: '浇越冬水', offsetDays: -160, badTerms: ['大雪', '冬至'], avoidReason: '封冻浇水，易冻伤麦根' },
      { key: 'green-up', name: '返青期追肥', offsetDays: -90, badTerms: ['大寒'], avoidReason: '严寒未过，肥效难发挥' },
      { key: 'jointing', name: '拔节期肥水', offsetDays: -70, badTerms: [], avoidReason: '' },
      { key: 'aphid', name: '抽穗期防蚜', offsetDays: -40, badTerms: [], avoidReason: '' },
      { key: 'spray', name: '灌浆期一喷三防', offsetDays: -25, badTerms: [], avoidReason: '' },
      { key: 'harvest', name: '收割晾晒', offsetDays: 0, badTerms: ['雨水', '谷雨'], avoidReason: WET_HARVEST_REASON },
    ],
  },
  {
    key: 'corn',
    name: '春玉米',
    growthDays: 120,
    stages: [
      { key: 'plow', name: '整地', offsetDays: -120, badTerms: ['大寒'], avoidReason: FROZEN_FIELD_REASON },
      { key: 'sow', name: '播种', offsetDays: -115, badTerms: ['大寒', '大暑'], avoidReason: SOW_REASON },
      { key: 'thin', name: '间苗定苗', offsetDays: -95, badTerms: [], avoidReason: '' },
      { key: 'jointing', name: '拔节期追肥', offsetDays: -80, badTerms: ['大暑'], avoidReason: HEAT_FERTILIZE_REASON },
      { key: 'borer', name: '大喇叭口期防螟', offsetDays: -50, badTerms: [], avoidReason: '' },
      { key: 'irrigate', name: '抽雄期灌溉', offsetDays: -35, badTerms: ['大雪', '冬至'], avoidReason: '封冻灌溉伤根' },
      { key: 'harvest', name: '收获', offsetDays: 0, badTerms: ['雨水', '谷雨'], avoidReason: WET_HARVEST_REASON },
    ],
  },
  {
    key: 'cotton',
    name: '棉花',
    growthDays: 180,
    stages: [
      { key: 'plow', name: '整地施肥', offsetDays: -180, badTerms: ['大寒'], avoidReason: FROZEN_FIELD_REASON },
      { key: 'sow', name: '播种', offsetDays: -175, badTerms: ['大寒', '大暑'], avoidReason: SOW_REASON },
      { key: 'thin', name: '间苗定苗', offsetDays: -155, badTerms: [], avoidReason: '' },
      { key: 'bud', name: '蕾期追肥', offsetDays: -130, badTerms: ['大暑'], avoidReason: HEAT_FERTILIZE_REASON },
      { key: 'top', name: '整枝打顶', offsetDays: -90, badTerms: [], avoidReason: '' },
      { key: 'bollworm', name: '花铃期防棉铃虫', offsetDays: -60, badTerms: [], avoidReason: '' },
      { key: 'harvest', name: '吐絮采收', offsetDays: 0, badTerms: ['雨水', '谷雨'], avoidReason: '多雨潮湿，棉絮易霉' },
    ],
  },
  {
    key: 'rape',
    name: '油菜',
    growthDays: 210,
    stages: [
      { key: 'seedling', name: '育苗', offsetDays: -210, badTerms: ['大暑'], avoidReason: '高温苗床易烧苗' },
      { key: 'transplant', name: '移栽', offsetDays: -180, badTerms: ['大寒'], avoidReason: '冻害伤苗，成活率低' },
      { key: 'winter-fert', name: '冬前追肥', offsetDays: -150, badTerms: ['大雪', '冬至'], avoidReason: '封冻施肥，肥效流失' },
      { key: 'bolt', name: '春后薹肥', offsetDays: -60, badTerms: [], avoidReason: '' },
      { key: 'spray', name: '初花期防菌核病', offsetDays: -35, badTerms: [], avoidReason: '' },
      { key: 'harvest', name: '收割', offsetDays: 0, badTerms: ['雨水', '谷雨'], avoidReason: '多雨潮湿，角果易霉' },
    ],
  },
  {
    key: 'soybean',
    name: '大豆',
    growthDays: 110,
    stages: [
      { key: 'plow', name: '整地', offsetDays: -110, badTerms: ['大寒'], avoidReason: FROZEN_FIELD_REASON },
      { key: 'sow', name: '播种', offsetDays: -105, badTerms: ['大寒', '大暑'], avoidReason: SOW_REASON },
      { key: 'thin', name: '间苗', offsetDays: -85, badTerms: [], avoidReason: '' },
      { key: 'flower', name: '开花期追肥', offsetDays: -55, badTerms: ['大暑'], avoidReason: HEAT_FERTILIZE_REASON },
      { key: 'spray', name: '鼓粒期防虫', offsetDays: -30, badTerms: [], avoidReason: '' },
      { key: 'harvest', name: '收获', offsetDays: 0, badTerms: ['雨水', '谷雨'], avoidReason: '多雨潮湿，豆粒易霉' },
    ],
  },
  {
    key: 'peanut',
    name: '花生',
    growthDays: 130,
    stages: [
      { key: 'plow', name: '整地', offsetDays: -130, badTerms: ['大寒'], avoidReason: FROZEN_FIELD_REASON },
      { key: 'sow', name: '播种', offsetDays: -125, badTerms: ['大寒', '大暑'], avoidReason: SOW_REASON },
      { key: 'seedling', name: '清棵蹲苗', offsetDays: -100, badTerms: [], avoidReason: '' },
      { key: 'peg', name: '花针期追肥', offsetDays: -75, badTerms: ['大暑'], avoidReason: HEAT_FERTILIZE_REASON },
      { key: 'earth', name: '结荚期培土', offsetDays: -50, badTerms: [], avoidReason: '' },
      { key: 'harvest', name: '收获', offsetDays: 0, badTerms: ['雨水', '谷雨'], avoidReason: '多雨潮湿，花生易发芽霉变' },
    ],
  },
  {
    key: 'sweetpotato',
    name: '红薯',
    growthDays: 150,
    stages: [
      { key: 'seedling', name: '育苗', offsetDays: -150, badTerms: ['小寒', '大寒'], avoidReason: '天寒地冻，薯苗易冻坏' },
      { key: 'ridge', name: '整地起垄', offsetDays: -130, badTerms: ['大寒'], avoidReason: FROZEN_FIELD_REASON },
      { key: 'plant', name: '栽插', offsetDays: -120, badTerms: ['大暑'], avoidReason: '高温栽插，成活率低' },
      { key: 'vine', name: '蔓薯并长期追肥', offsetDays: -80, badTerms: ['大暑'], avoidReason: HEAT_FERTILIZE_REASON },
      { key: 'lift', name: '提蔓控旺', offsetDays: -50, badTerms: [], avoidReason: '' },
      { key: 'harvest', name: '收获', offsetDays: 0, badTerms: ['大雪', '冬至'], avoidReason: '地温太低，薯块易冻伤腐烂' },
    ],
  },
];

export function getCrop(key: string): CropTemplate | undefined {
  return CROPS.find(c => c.key === key);
}

// 节气区间：[startJdn, endJdn)，endJdn 为下一节气开始日
export interface TermRange {
  term: string;
  startJdn: number;
  endJdn: number;
}

// 生成覆盖 startYear 年初到 endYear 年末的节气区间序列
export function getTermRanges(startYear: number, endYear: number): TermRange[] {
  const starts: { term: string; jdn: number }[] = [];
  for (let y = startYear; y <= endYear + 1; y++) {
    const dates = getSolarTermDates(y);
    for (let i = 0; i < 24; i++) {
      starts.push({ term: SOLAR_TERMS[i], jdn: gregorianToJDN(y, Math.floor(i / 2) + 1, dates[i]) });
    }
  }
  starts.sort((a, b) => a.jdn - b.jdn);

  const ranges: TermRange[] = [];
  for (let i = 0; i < starts.length - 1; i++) {
    ranges.push({ term: starts[i].term, startJdn: starts[i].jdn, endJdn: starts[i + 1].jdn });
  }
  return ranges;
}

export function findTermAt(ranges: TermRange[], jdn: number): TermRange | undefined {
  return ranges.find(r => jdn >= r.startJdn && jdn < r.endJdn);
}

// 查询某个公历日期所在的节气
export function termOfDate(year: number, month: number, day: number): string {
  const ranges = getTermRanges(year - 1, year);
  const range = findTermAt(ranges, gregorianToJDN(year, month, day));
  return range ? range.term : '';
}

// 倒推 + 节气调整后的节点种子
export interface NodeSeed {
  stageKey: string;
  name: string;
  baseJdn: number;        // 按生长天数倒推出的原始日
  jdn: number;            // 节气调整后的计划日
  term: string;           // 计划日所在节气
  adjustedReason?: string; // 被挪开的原因说明
}

const MAX_SHIFT = 3; // 连续落在忌用节气上时最多顺延次数

// 从收获日倒推各节点，落在忌用节气上的顺延到下一节气并说明原因
export function buildStagePlan(crop: CropTemplate, harvestJdn: number, ranges: TermRange[]): NodeSeed[] {
  return crop.stages.map(stage => {
    const baseJdn = harvestJdn + stage.offsetDays;
    let jdn = baseJdn;
    let reason: string | undefined;

    for (let attempt = 0; attempt < MAX_SHIFT; attempt++) {
      const range = findTermAt(ranges, jdn);
      if (!range || !stage.badTerms.includes(range.term)) break;
      if (!reason) {
        const [, bm, bd] = jdnToGregorian(baseJdn);
        reason = `原定${bm}月${bd}日正值${range.term}，${stage.avoidReason}`;
      }
      jdn = range.endJdn;
    }

    if (reason) {
      const [, m, d] = jdnToGregorian(jdn);
      const range = findTermAt(ranges, jdn);
      reason += `，顺延至${m}月${d}日${range ? `（${range.term}期间）` : ''}`;
    }

    const term = findTermAt(ranges, jdn)?.term ?? '';
    return { stageKey: stage.key, name: stage.name, baseJdn, jdn, term, adjustedReason: reason };
  });
}
