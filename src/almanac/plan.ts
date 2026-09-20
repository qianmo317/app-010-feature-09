import { getCrop, getTermRanges, buildStagePlan, termOfDate } from './crops';
import { gregorianToJDN, jdnToGregorian, formatDate, parseDate } from '../utils/date';

// 一块地
export interface Plot {
  id: string;
  name: string;
  cropKey: string;
  harvestDate: string; // 计划收获日 YYYY-MM-DD
  stopped: boolean;    // 不种了就停掉，节点不再参与过期/撞期检测
  createdAt: string;
}

// 一个农事节点
export interface PlanNode {
  id: string;
  plotId: string;
  stageKey: string;
  name: string;
  date: string;          // 当前计划日（可改、可往后推）
  baseDate: string;      // 按生长天数倒推出的原始日
  term: string;          // 计划日所在节气
  adjustedReason?: string; // 节气调整说明
  done: boolean;
  doneAt?: string;
}

function jdnToStr(jdn: number): string {
  const [y, m, d] = jdnToGregorian(jdn);
  return formatDate(y, m, d);
}

// 按作物模板从收获日倒推，生成一块地的全部节点
export function generateNodes(plot: Plot): PlanNode[] {
  const crop = getCrop(plot.cropKey);
  if (!crop) return [];

  const [y, m, d] = parseDate(plot.harvestDate);
  const harvestJdn = gregorianToJDN(y, m, d);
  // 节点最早可能落在上一年的节气里，区间往前多取一年
  const ranges = getTermRanges(y - 1, y);

  return buildStagePlan(crop, harvestJdn, ranges).map(seed => ({
    id: `${plot.id}-${seed.stageKey}`,
    plotId: plot.id,
    stageKey: seed.stageKey,
    name: seed.name,
    date: jdnToStr(seed.jdn),
    baseDate: jdnToStr(seed.baseJdn),
    term: seed.term,
    adjustedReason: seed.adjustedReason,
    done: false,
  }));
}

// 节点改期后重算所在节气
export function refreshNodeTerm(node: PlanNode): void {
  const [y, m, d] = parseDate(node.date);
  node.term = termOfDate(y, m, d);
}

// 过了日子还没做的节点（调用方只传入未停用地块的节点）
export function getOverdueNodes(nodes: PlanNode[], today: string): PlanNode[] {
  const [y, m, d] = parseDate(today);
  const todayJdn = gregorianToJDN(y, m, d);
  return nodes.filter(n => !n.done && gregorianToJDN(...parseDate(n.date)) < todayJdn);
}

// 不同地块挤在同一天的节点（只统计未完成的），返回 日期 -> 节点列表
export function getConflictDates(nodes: PlanNode[]): Map<string, PlanNode[]> {
  const byDate = new Map<string, PlanNode[]>();
  for (const n of nodes) {
    if (n.done) continue;
    const list = byDate.get(n.date) ?? [];
    list.push(n);
    byDate.set(n.date, list);
  }

  const conflicts = new Map<string, PlanNode[]>();
  for (const [date, list] of byDate) {
    const plotIds = new Set(list.map(n => n.plotId));
    if (plotIds.size >= 2) {
      conflicts.set(date, list);
    }
  }
  return conflicts;
}
