// 作物目录：每种作物给出总生长天数、从收成日倒推的农活节点，
// 以及每个节点落在哪些节气上宜 / 忌。忌的节点会被引擎从原节气挪开。

export type StageKey =
  | 'sow'        // 播种 / 育苗
  | 'transplant' // 移栽定植
  | 'thin'       // 间苗定苗
  | 'topdress'   // 追肥
  | 'pest'       // 防虫
  | 'heading'    // 抽穗开花（或打顶整枝）
  | 'harvest';   // 收获

export interface StageTemplate {
  key: StageKey;
  // 距收成日的天数（收成 = 0），例如 -120 表示收前 120 天
  offset: number;
  name?: string; // 覆盖默认节点名
  preferred?: string[];               // 宜落的节气
  avoided?: Record<string, string>;   // 忌落的节气 → 挪开的原因
}

export interface CropDef {
  id: string;
  name: string;
  growthDays: number; // 全生育期天数
  stages: StageTemplate[];
  note?: string;
}

export const DEFAULT_STAGE_NAMES: Record<StageKey, string> = {
  sow: '播种',
  transplant: '移栽定植',
  thin: '间苗定苗',
  topdress: '追肥',
  pest: '防治病虫',
  heading: '抽穗开花',
  harvest: '收获'
};

// ── 节点通用的节气宜忌规则 ───────────────────────────────────────────
// 规则为「农时经验」，用于演示倒推后撞上不合时宜的节气时如何挪日子。

const RULES: Record<StageKey, { preferred: string[]; avoided: Record<string, string> }> = {
  sow: {
    preferred: ['惊蛰', '春分', '清明', '谷雨', '立夏', '芒种', '夏至', '小暑', '白露', '秋分'],
    avoided: {
      '大雪': '大雪土冻，种子下地易烂在冻土里',
      '冬至': '冬至地冻天寒，不能下种',
      '小寒': '小寒天最冷，出不了苗',
      '大寒': '大寒土冻，强播出苗不齐',
      '霜降': '霜降下种易遭霜冻，苗出不齐',
      '立冬': '立冬后气温走低，下种赶不上收成',
      '小雪': '小雪转寒，土温不足难出苗',
      '大暑': '大暑高温烫芽，应趁早晚或避后再播',
      '处暑': '处暑后暑气渐收，下种生长期不够'
    }
  },
  transplant: {
    preferred: ['清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '立秋', '处暑'],
    avoided: {
      '大雪': '大雪封地，无法移栽',
      '冬至': '冬至冻土，栽不活',
      '小寒': '小寒冻害重，移栽难活棵',
      '大寒': '大寒栽苗要挨冻，缓不过苗',
      '霜降': '霜降栽苗正赶上霜冻，容易冻死',
      '小雪': '小雪后寒，栽下也不扎根',
      '大暑': '大暑伏天栽苗易被晒死，要躲高温'
    }
  },
  thin: {
    preferred: ['谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '处暑', '白露'],
    avoided: {
      '大雪': '大雪封地，进不了地间苗',
      '冬至': '冬至地冻，没法下田',
      '小寒': '小寒冻土，田间干不了活',
      '大寒': '大寒天寒，不出工',
      '雨水': '雨水地湿黏，间苗踩地板结'
    }
  },
  topdress: {
    preferred: ['立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '立秋'],
    avoided: {
      '大雪': '大雪盖地，肥撒了也化不进土',
      '冬至': '冬至封冻，追肥白搭',
      '小寒': '小寒地冻，施了肥作物也吸不上',
      '大寒': '大寒追肥肥效随冻水流走',
      '小雪': '小雪土寒，追肥不见效'
    }
  },
  pest: {
    preferred: ['惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑'],
    avoided: {
      '大雪': '大雪无虫，打药白费工',
      '冬至': '冬至虫蛰不活动，不是防的时候',
      '小寒': '小寒天寒无虫，药也打不匀',
      '大寒': '大寒打药纯属浪费',
      '小雪': '小雪后虫入土休眠，防了也白防'
    }
  },
  heading: {
    preferred: ['小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露'],
    avoided: {
      '大雪': '大雪封田，哪来的抽穗',
      '冬至': '冬至物候对不上，不是抽穗的时令',
      '小寒': '小寒最冷，作物早该收完了',
      '大寒': '大寒时节无穗可抽',
      '霜降': '霜降再抽穗，籽粒来不及成熟'
    }
  },
  harvest: {
    preferred: ['小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降'],
    avoided: {
      '雨水': '雨水连天，收上来的籽粒没法晾晒、要发霉',
      '谷雨': '谷雨多雨，抢收的粮食晒不干',
      '大雪': '大雪封地，作物早冻在地里了',
      '冬至': '冬至地冻，收不回来',
      '小寒': '小寒大寒前早该收仓，这时候只剩冻害',
      '大寒': '大寒地冻，颗粒无收',
      '小雪': '小雪一下，没收的庄稼要烂在雪里',
      '惊蛰': '惊蛰时节庄稼早过了收获季',
      '春分': '春分青黄不接，没有可收的庄稼'
    }
  }
};

export function getStageRules(key: StageKey): { preferred: string[]; avoided: Record<string, string> } {
  return RULES[key];
}

// ── 作物目录 ────────────────────────────────────────────────────────
export const CROPS: CropDef[] = [
  {
    id: 'winter-wheat',
    name: '冬小麦',
    growthDays: 240,
    note: '秋播夏收，白露前后下种、芒种前后收割',
    stages: [
      { key: 'sow', offset: -235, preferred: ['白露', '秋分', '寒露'], avoided: { ...RULES.sow.avoided, '立冬': '立冬后种麦要减产，麦棵冬前发不起棵' } },
      { key: 'topdress', offset: -90, name: '返青拔节追肥' },
      { key: 'heading', offset: -45 },
      { key: 'pest', offset: -30, name: '防赤霉病/蚜虫' },
      { key: 'harvest', offset: 0 }
    ]
  },
  {
    id: 'spring-corn',
    name: '春玉米',
    growthDays: 120,
    note: '清明谷雨播种，处暑前后收获',
    stages: [
      { key: 'sow', offset: -115 },
      { key: 'thin', offset: -90 },
      { key: 'topdress', offset: -60, name: '拔节孕穗追肥' },
      { key: 'pest', offset: -35, name: '防玉米螟' },
      { key: 'harvest', offset: 0 }
    ]
  },
  {
    id: 'summer-corn',
    name: '夏玉米',
    growthDays: 100,
    note: '麦收后抢种，秋分前后收获',
    stages: [
      { key: 'sow', offset: -95, preferred: ['芒种', '夏至'] },
      { key: 'thin', offset: -75 },
      { key: 'topdress', offset: -45, name: '拔节追肥' },
      { key: 'pest', offset: -25, name: '防玉米螟' },
      { key: 'harvest', offset: 0 }
    ]
  },
  {
    id: 'middle-rice',
    name: '中稻',
    growthDays: 150,
    note: '清明育秧、立夏插秧，白露前后收割',
    stages: [
      { key: 'sow', offset: -145, name: '育秧', preferred: ['清明', '谷雨'] },
      { key: 'transplant', offset: -115, preferred: ['立夏', '小满'] },
      { key: 'topdress', offset: -75, name: '分蘖拔节追肥' },
      { key: 'pest', offset: -45, name: '防稻瘟病/螟虫' },
      { key: 'heading', offset: -30, name: '抽穗扬花' },
      { key: 'harvest', offset: 0 }
    ]
  },
  {
    id: 'late-rice',
    name: '晚稻',
    growthDays: 130,
    note: '芒种插秧、霜降前后收',
    stages: [
      { key: 'sow', offset: -125, name: '育秧', preferred: ['立夏', '小满'] },
      { key: 'transplant', offset: -100, preferred: ['芒种', '夏至'] },
      { key: 'topdress', offset: -65, name: '分蘖追肥' },
      { key: 'pest', offset: -40, name: '防稻飞虱/稻瘟病' },
      { key: 'heading', offset: -25, name: '抽穗扬花' },
      { key: 'harvest', offset: 0, preferred: ['寒露', '霜降'] }
    ]
  },
  {
    id: 'winter-rapeseed',
    name: '冬油菜',
    growthDays: 220,
    note: '秋分育苗移栽，次年小满收籽',
    stages: [
      { key: 'sow', offset: -215, preferred: ['秋分', '白露'], name: '育苗' },
      { key: 'transplant', offset: -190, preferred: ['寒露', '霜降'] },
      { key: 'topdress', offset: -120, name: '薹肥' },
      { key: 'pest', offset: -55, name: '防菌核病/蚜虫' },
      { key: 'harvest', offset: 0, preferred: ['小满', '芒种'] }
    ]
  },
  {
    id: 'cotton',
    name: '棉花',
    growthDays: 180,
    note: '谷雨前后播种，秋分开始吐絮采收',
    stages: [
      { key: 'sow', offset: -175, preferred: ['谷雨', '立夏'] },
      { key: 'thin', offset: -150, name: '定苗' },
      { key: 'topdress', offset: -105, name: '花铃肥' },
      { key: 'pest', offset: -70, name: '防棉铃虫/棉蚜' },
      { key: 'heading', offset: -60, name: '打顶整枝', preferred: ['小暑', '大暑', '夏至'] },
      { key: 'harvest', offset: 0, name: '吐絮采收', preferred: ['白露', '秋分', '寒露'] }
    ]
  },
  {
    id: 'peanut',
    name: '花生',
    growthDays: 130,
    note: '谷雨立夏下种，白露起花生',
    stages: [
      { key: 'sow', offset: -125, preferred: ['谷雨', '立夏'] },
      { key: 'thin', offset: -100 },
      { key: 'topdress', offset: -60, name: '开花下针追肥' },
      { key: 'pest', offset: -35, name: '防叶斑病/蛴螬' },
      { key: 'harvest', offset: 0, preferred: ['白露', '秋分'] }
    ]
  },
  {
    id: 'spring-soybean',
    name: '春大豆',
    growthDays: 110,
    note: '清明前后种豆，处暑白露收',
    stages: [
      { key: 'sow', offset: -105, preferred: ['清明', '谷雨'] },
      { key: 'thin', offset: -80 },
      { key: 'topdress', offset: -45 },
      { key: 'pest', offset: -25, name: '防豆荚螟' },
      { key: 'harvest', offset: 0, preferred: ['处暑', '白露'] }
    ]
  },
  {
    id: 'sweet-potato',
    name: '红薯',
    growthDays: 160,
    note: '谷雨栽秧，霜降前必须起完',
    stages: [
      { key: 'transplant', offset: -150, name: '栽插薯秧', preferred: ['谷雨', '立夏'] },
      { key: 'topdress', offset: -90, name: '催薯肥' },
      { key: 'pest', offset: -50, name: '防甘薯天蛾' },
      { key: 'heading', offset: -30, name: '翻蔓控旺', preferred: ['处暑', '白露'] },
      { key: 'harvest', offset: 0, preferred: ['寒露', '霜降'], avoided: { ...RULES.harvest.avoided, '立冬': '立冬一冻，红薯在窖外都冻坏了，必须抢在霜前起' } }
    ]
  },
  {
    id: 'chinese-cabbage',
    name: '秋大白菜',
    growthDays: 85,
    note: '立秋前后下种，小雪前收窖',
    stages: [
      { key: 'sow', offset: -80, preferred: ['立秋', '处暑'] },
      { key: 'thin', offset: -60, name: '定苗' },
      { key: 'topdress', offset: -30, name: '包心肥' },
      { key: 'pest', offset: -45, name: '防菜青虫/蚜虫' },
      { key: 'harvest', offset: 0, preferred: ['立冬', '小雪'], avoided: { ...RULES.harvest.avoided, '大雪': '大雪一盖菜冻在地里，必须赶在大雪前收窖' } }
    ]
  },
  {
    id: 'spring-tomato',
    name: '露地春番茄',
    growthDays: 120,
    note: '惊蛰温室育苗、清明谷雨定植，大暑前后罢园',
    stages: [
      { key: 'sow', offset: -115, name: '育苗', preferred: ['惊蛰', '春分'] },
      { key: 'transplant', offset: -85, preferred: ['清明', '谷雨'] },
      { key: 'topdress', offset: -45, name: '坐果追肥' },
      { key: 'pest', offset: -30, name: '防棉铃虫/晚疫病' },
      { key: 'heading', offset: -40, name: '整枝打杈', preferred: ['立夏', '小满', '芒种'] },
      { key: 'harvest', offset: 0, preferred: ['小暑', '大暑'] }
    ]
  }
];

export function getCrop(id: string): CropDef | undefined {
  return CROPS.find(c => c.id === id);
}

// 作物最早节点距收成日的天数（用于给出建议收成日时的提示）
export function getCropStartOffset(crop: CropDef): number {
  return Math.min(...crop.stages.map(s => s.offset));
}
