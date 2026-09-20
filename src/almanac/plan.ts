import {
  CropDef, StageTemplate, StageKey, DEFAULT_STAGE_NAMES,
  getCrop, getStageRules
} from './crops';
import { TermDate, getTermDateList, findTermOn, findNextTerm } from './solar-terms';
import { gregorianToJDN, jdnToGregorian } from '../utils/date';

// ── 数据模型 ────────────────────────────────────────────────────────
export interface PlanNode {
  key: StageKey;
  name: string;
  offset: number;              // 相对收成日的天数（0 = 收成）
  date: string;                // 当前计划日期 yyyy-mm-dd（倒推或挪后/手改）
  originalDate: string;        // 纯粹从收成日倒推的日期
  term?: string;               // 计划日恰逢的节气
  preferred: boolean;          // 当天正是宜做此活的节气
  shifted: boolean;            // 被引擎从原节气挪开过
  shiftReason?: string;        // 挪动 / 挪不开的说明
  warning?: string;            // 手改日子仍不合时宜 / 节点次序乱了
  manual: boolean;             // 日期被人工改过
  done: boolean;               // 已做
  doneDate?: string;
}

export interface Plot {
  id: string;
  name: string;                // 地块名，如「村东三亩」
  cropId: string;
  harvestDate: string;         // 打算收的那天
  status: 'active' | 'stopped';
  createdAt: string;
  nodes: PlanNode[];
}

// 建计划时可带入的旧节点状态（改收成日重建时保留进度/手改）
interface PreservedNode {
  date: string;
  manual: boolean;
  done: boolean;
  doneDate?: string;
}

// ── 日期工具 ────────────────────────────────────────────────────────
export function toJdn(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return gregorianToJDN(y, m, d);
}

export function fromJdn(jdn: number): string {
  const [y, m, d] = jdnToGregorian(jdn);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function shiftDate(dateStr: string, days: number): string {
  return fromJdn(toJdn(dateStr) + days);
}

// ── 建计划：从收成日按生长天数倒推，再拿当年节气对一遍 ─────────────
const SHIFT_WINDOW = 60; // 最多向后顺延的天数窗口

function avoidedReason(stage: StageTemplate, term: string): string | undefined {
  const avoided = stage.avoided ?? getStageRules(stage.key).avoided;
  return avoided[term];
}

function preferredTerms(stage: StageTemplate): string[] {
  return stage.preferred ?? getStageRules(stage.key).preferred;
}

interface ResolveResult {
  node: Omit<PlanNode, 'done' | 'doneDate'>;
}

function resolveNode(
  stage: StageTemplate,
  harvestJdn: number,
  terms: TermDate[],
  manual?: PreservedNode
): ResolveResult {
  const name = stage.name ?? DEFAULT_STAGE_NAMES[stage.key];
  const origJdn = harvestJdn + stage.offset;
  const origDate = fromJdn(origJdn);
  const isHarvest = stage.key === 'harvest';

  const base: Omit<PlanNode, 'done' | 'doneDate'> = {
    key: stage.key, name, offset: stage.offset,
    date: origDate, originalDate: origDate,
    preferred: false, shifted: false, manual: false
  };

  // 人工定过的日子：保留日期，只重新对一遍节气给提示，不再自动挪
  if (manual && manual.manual) {
    const jdn = toJdn(manual.date);
    const term = findTermOn(jdn, terms);
    base.date = manual.date;
    base.manual = true;
    if (term) {
      base.term = term.term;
      if (preferredTerms(stage).includes(term.term)) base.preferred = true;
      const reason = avoidedReason(stage, term.term);
      if (reason) base.warning = `自选的日子恰逢「${term.term}」，${reason}，建议再挪`;
    }
    return { node: base };
  }

  const origTerm = findTermOn(origJdn, terms);
  if (!origTerm) return { node: base }; // 不在节气交节当天，无需对节气

  base.term = origTerm.term;
  const reason = avoidedReason(stage, origTerm.term);
  if (preferredTerms(stage).includes(origTerm.term)) base.preferred = true;
  if (!reason) return { node: base }; // 恰逢节气且不忌，原样保留

  // 撞上不合时宜的节气：先找近处「宜」的节气日，再退而求其次找个不忌的
  const upperBound = isHarvest ? origJdn + SHIFT_WINDOW : Math.min(origJdn + SHIFT_WINDOW, harvestJdn);
  const preferredDay = findNextTerm(
    origJdn, terms,
    t => preferredTerms(stage).includes(t.term),
    upperBound
  );
  if (preferredDay) {
    base.date = fromJdn(preferredDay.jdn);
    base.term = preferredDay.term;
    base.preferred = true;
    base.shifted = true;
    base.shiftReason =
      `倒推到 ${origDate} 恰逢「${origTerm.term}」，${reason}；` +
      `顺延 ${preferredDay.jdn - origJdn} 天到「${preferredDay.term}」，${name}宜赶这个节气`;
    return { node: base };
  }

  const safeDay = findNextTerm(
    origJdn, terms,
    t => !((stage.avoided ?? getStageRules(stage.key).avoided)[t.term]),
    upperBound
  );
  if (safeDay) {
    base.date = fromJdn(safeDay.jdn);
    base.term = safeDay.term;
    base.preferred = preferredTerms(stage).includes(safeDay.term);
    base.shifted = true;
    base.shiftReason =
      `倒推到 ${origDate} 恰逢「${origTerm.term}」，${reason}；` +
      `近处一个半月内没有宜用的节气，先挪到「${safeDay.term}」避一避`;
    return { node: base };
  }

  // 挪不开：保留原日子并挂警告，交给人来定
  base.shiftReason = isHarvest
    ? `倒推到 ${origDate} 恰逢「${origTerm.term}」，${reason}；附近没有合适的节气可挪，请人工改收成日`
    : `倒推到 ${origDate} 恰逢「${origTerm.term}」，${reason}；收成前一个半月内没有合适的节气可挪，请人工改期`;
  base.warning = base.shiftReason;
  return { node: base };
}

// 检查同一地块内节点先后次序（挪期/手改后可能与相邻节点打架）
function checkOrder(nodes: PlanNode[]) {
  const sorted = [...nodes].sort((a, b) => a.offset - b.offset);
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    // 先清掉上一轮挂的次序冲突说明，避免重复编辑时堆积
    cur.warning = cur.warning?.replace(/；?（与下一节点[^）]*）/g, '').trim() || undefined;
    if (toJdn(cur.date) > toJdn(next.date)) {
      const overlap = toJdn(cur.date) - toJdn(next.date);
      cur.warning =
        (cur.warning ? cur.warning + '；' : '') +
        `（与下一节点「${next.name}」次序冲突，${overlap}天内安排不开）`;
    }
  }
}

export interface NewPlotInput {
  id?: string;
  name: string;
  cropId: string;
  harvestDate: string;
  createdAt?: string;
}

// 新建地块计划
export function buildPlot(input: NewPlotInput): Plot {
  const crop = getCrop(input.cropId);
  if (!crop) throw new Error(`未知作物：${input.cropId}`);
  const harvestJdn = toJdn(input.harvestDate);
  const year = Number(input.harvestDate.slice(0, 4));
  const terms = getTermDateList(year - 1, year + 1);

  const stages = [...crop.stages].sort((a, b) => a.offset - b.offset);
  const nodes = stages.map(stage => ({
    ...resolveNode(stage, harvestJdn, terms).node,
    done: false
  }));
  checkOrder(nodes);

  return {
    id: input.id ?? `plot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    cropId: input.cropId,
    harvestDate: input.harvestDate,
    status: 'active',
    createdAt: input.createdAt ?? new Date().toISOString().slice(0, 10),
    nodes
  };
}

// 改了收成日：整份计划重新倒推，保留各节点已做状态和人工改过的日子
export function rebuildWithHarvest(plot: Plot, newHarvestDate: string): Plot {
  const crop = getCrop(plot.cropId);
  if (!crop) return plot;
  const preserved = new Map<StageKey, PreservedNode>(
    plot.nodes.map(n => [n.key, { date: n.date, manual: n.manual, done: n.done, doneDate: n.doneDate }])
  );
  const rebuilt = buildPlot({
    id: plot.id, name: plot.name, cropId: plot.cropId,
    harvestDate: newHarvestDate, createdAt: plot.createdAt
  });
  rebuilt.status = plot.status;
  rebuilt.nodes.forEach(n => {
    const old = preserved.get(n.key);
    if (!old) return;
    n.done = old.done;
    n.doneDate = old.doneDate;
    if (old.manual) {
      const year = Number(newHarvestDate.slice(0, 4));
      const terms = getTermDateList(year - 1, year + 1);
      const stage = crop.stages.find(s => s.key === n.key)!;
      const resolved = resolveNode(stage, toJdn(newHarvestDate), terms, old);
      Object.assign(n, resolved.node);
      n.done = old.done;
      n.doneDate = old.doneDate;
    }
  });
  checkOrder(rebuilt.nodes);
  return rebuilt;
}

// ── 节点改期 / 顺延 ─────────────────────────────────────────────────
function mutatingNode(plot: Plot, key: StageKey, fn: (n: PlanNode) => void): Plot {
  const crop = getCrop(plot.cropId)!;
  const next: Plot = {
    ...plot,
    nodes: plot.nodes.map(n => ({ ...n }))
  };
  const node = next.nodes.find(n => n.key === key);
  if (node) fn(node);
  // 重新对节气、查次序
  const year = Number(next.harvestDate.slice(0, 4));
  const terms = getTermDateList(year - 1, year + 1);
  next.nodes.forEach(n => {
    if (n.key !== key) return;
    const stage = crop.stages.find(s => s.key === n.key)!;
    const jdn = toJdn(n.date);
    n.term = findTermOn(jdn, terms)?.term;
    n.preferred = !!n.term && preferredTerms(stage).includes(n.term);
    n.warning = undefined;
    const reason = n.term ? avoidedReason(stage, n.term) : undefined;
    if (reason) n.warning = `自选的日子恰逢「${n.term}」，${reason}，建议再挪`;
  });
  checkOrder(next.nodes);
  return next;
}

// 手工改成指定日期
export function changeNodeDate(plot: Plot, key: StageKey, date: string): Plot {
  return mutatingNode(plot, key, n => {
    n.date = date;
    n.manual = true;
    n.shifted = false;
    n.shiftReason = undefined;
  });
}

// 向后推若干天（默认 7 天）
export function delayNode(plot: Plot, key: StageKey, days = 7): Plot {
  return mutatingNode(plot, key, n => {
    n.date = shiftDate(n.date, days);
    n.manual = true;
  });
}

// 从当前日子往后找最近一个「宜」的节气日（撞忌日时一键挪开）
export function shiftNodeToNextSafe(plot: Plot, key: StageKey): Plot {
  const crop = getCrop(plot.cropId)!;
  const stage = crop.stages.find(s => s.key === key)!;
  const year = Number(plot.harvestDate.slice(0, 4));
  const terms = getTermDateList(year - 1, year + 1);
  const target = findNextTerm(
    toJdn(plot.nodes.find(n => n.key === key)!.date),
    terms,
    t => preferredTerms(stage).includes(t.term),
    toJdn(plot.harvestDate)
  );
  if (!target) return plot;
  return mutatingNode(plot, key, n => {
    n.date = fromJdn(target.jdn);
    n.manual = true;
    n.shiftReason = `人工顺延到「${target.term}」`;
  });
}

// 标记已做 / 撤销
export function markNodeDone(plot: Plot, key: StageKey, done: boolean, today: string): Plot {
  return {
    ...plot,
    nodes: plot.nodes.map(n => n.key === key
      ? { ...n, done, doneDate: done ? today : undefined }
      : n)
  };
}

// 地块不种了：停掉；也可恢复、彻底删除
export function stopPlot(plot: Plot): Plot {
  return { ...plot, status: 'stopped' as const };
}
export function resumePlot(plot: Plot): Plot {
  return { ...plot, status: 'active' as const };
}

// ── 视图层计算：逾期 / 同日冲突 / 倒计时 ────────────────────────────
export interface NodeView {
  plotId: string;
  plotName: string;
  cropName: string;
  node: PlanNode;
  overdue: boolean;          // 过了计划日还没做
  daysOverdue: number;
  daysUntil: number;         // 距今天的天数（负数即已过）
  conflictsWith: string[];   // 同一天挤在一起的别的地块节点，格式「地块·活计」
}

export function buildView(plots: Plot[], today: string): {
  views: NodeView[];
  overdueCount: number;
  conflictCount: number;
  upcoming: NodeView[];      // 未来 14 天要做的
  stoppedCount: number;
} {
  const todayJdn = toJdn(today);
  const activePlots = plots.filter(p => p.status === 'active');

  // 同一天撞期：仅统计在种地块之间
  const sameDay = new Map<string, NodeView[]>();
  const all: NodeView[] = [];

  for (const plot of activePlots) {
    const crop = getCrop(plot.cropId);
    for (const node of plot.nodes) {
      const jdn = toJdn(node.date);
      const view: NodeView = {
        plotId: plot.id,
        plotName: plot.name,
        cropName: crop?.name ?? plot.cropId,
        node,
        overdue: !node.done && jdn < todayJdn,
        daysOverdue: !node.done ? Math.max(0, todayJdn - jdn) : 0,
        daysUntil: jdn - todayJdn,
        conflictsWith: []
      };
      all.push(view);
      const key = node.date;
      const bucket = sameDay.get(key);
      if (bucket) bucket.push(view);
      else sameDay.set(key, [view]);
    }
  }

  let overdueCount = 0;
  let conflictCount = 0;
  for (const bucket of sameDay.values()) {
    if (bucket.length > 1) {
      conflictCount += bucket.length;
      for (const v of bucket) {
        v.conflictsWith = bucket.filter(o => o !== v).map(o => `${o.plotName}·${o.node.name}`);
      }
    }
  }
  for (const v of all) if (v.overdue) overdueCount++;

  const upcoming = all
    .filter(v => !v.node.done && v.daysUntil >= 0 && v.daysUntil <= 14)
    .sort((a, b) => toJdn(a.node.date) - toJdn(b.node.date));

  return {
    views: all.sort((a, b) => toJdn(a.node.date) - toJdn(b.node.date)),
    overdueCount,
    conflictCount,
    upcoming,
    stoppedCount: plots.length - activePlots.length
  };
}

// 同一天总览（供日历/列表按日归组用）
export function groupByDate(views: NodeView[]): Map<string, NodeView[]> {
  const map = new Map<string, NodeView[]>();
  for (const v of views) {
    const bucket = map.get(v.node.date);
    if (bucket) bucket.push(v);
    else map.set(v.node.date, [v]);
  }
  return new Map([...map.entries()].sort(([a], [b]) => toJdn(a) - toJdn(b)));
}

// 作物类型守卫（页面表单用）
export function getCropOrThrow(cropId: string): CropDef {
  const crop = getCrop(cropId);
  if (!crop) throw new Error(`未知作物：${cropId}`);
  return crop;
}
