import { router } from '../router';
import { createElement, clearElement } from '../utils/dom';
import { CROPS, getCrop } from '../almanac/crops';
import { Plot, PlanNode, getOverdueNodes, getConflictDates } from '../almanac/plan';
import * as store from '../store/plan-store';
import { WEEK_DAYS } from '../almanac/constants';
import { getWeekDay, parseDate, formatDate, addDays } from '../utils/date';

export function renderPlots(app: HTMLElement) {
  clearElement(app);
  app.className = 'page plots-page';

  const now = new Date();
  const todayStr = formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const refresh = () => renderPlots(app);

  const plots = store.loadPlots();
  const allNodes = store.loadNodes();
  const activePlots = plots.filter(p => !p.stopped);
  const stoppedPlots = plots.filter(p => p.stopped);
  const activeNodes = allNodes.filter(n => activePlots.some(p => p.id === n.plotId));
  const overdueNodes = getOverdueNodes(activeNodes, todayStr);
  const overdueIds = new Set(overdueNodes.map(n => n.id));
  const conflicts = getConflictDates(activeNodes);
  const todoCount = activeNodes.filter(n => !n.done).length;

  // 头部
  const header = createElement('div', 'page-header');
  const backBtn = createElement('button', 'back-btn', '◀ 返回');
  backBtn.addEventListener('click', () => router.navigate('/'));
  const title = createElement('h1', 'page-title', '地块农事计划');
  header.append(backBtn, title);

  // 概览条
  const summary = createElement('div', 'plan-summary');
  summary.innerHTML = `
    <span>在种 <b>${activePlots.length}</b> 块地</span>
    <span>待办 <b>${todoCount}</b> 项</span>
    <span class="${overdueNodes.length ? 'warn' : ''}">已过期 <b>${overdueNodes.length}</b> 项</span>
    <span class="${conflicts.size ? 'warn' : ''}">撞期 <b>${conflicts.size}</b> 天</span>
  `;

  // 添加地块表单
  const form = buildAddForm(refresh);

  app.append(header, summary, form);

  // 撞期提醒
  if (conflicts.size > 0) {
    app.appendChild(buildConflictCard(conflicts, plots));
  }

  // 在种地块
  if (activePlots.length === 0 && stoppedPlots.length === 0) {
    const empty = createElement('div', 'card empty-hint',
      '还没有地块。先在上方添加一块地，选好作物和打算收获的日子，就会按生长天数倒推出从播种到收成的整套活计。');
    app.appendChild(empty);
  }

  for (const plot of activePlots) {
    const nodes = allNodes
      .filter(n => n.plotId === plot.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    app.appendChild(buildPlotCard(plot, nodes, overdueIds, conflicts, plots, todayStr, refresh));
  }

  // 已停地块
  if (stoppedPlots.length > 0) {
    const stoppedSection = createElement('div', 'stopped-section');
    stoppedSection.appendChild(createElement('h3', 'section-title', '已停种的地块'));
    for (const plot of stoppedPlots) {
      stoppedSection.appendChild(buildStoppedRow(plot, refresh));
    }
    app.appendChild(stoppedSection);
  }
}

// 添加地块表单
function buildAddForm(refresh: () => void): HTMLElement {
  const form = createElement('div', 'card plot-form');

  const now = new Date();
  const defaultHarvest = formatDate(...addDays(now.getFullYear(), now.getMonth() + 1, now.getDate(), 130));

  form.innerHTML = `
    <h3>添加地块</h3>
    <div class="plot-form-grid">
      <label>地块名<input type="text" id="plot-name" placeholder="如：东岗三亩"></label>
      <label>作物
        <select id="plot-crop">
          ${CROPS.map(c => `<option value="${c.key}">${c.name}（约${c.growthDays}天）</option>`).join('')}
        </select>
      </label>
      <label>打算收获的日子<input type="date" id="plot-harvest" value="${defaultHarvest}"></label>
      <button class="submit-btn" id="plot-add">生成计划</button>
    </div>
    <p class="form-hint">从收获日按生长天数倒推各节点，再对照当年节气，落在不合适节气上的会自动挪开并注明原因。</p>
  `;

  const addBtn = form.querySelector('#plot-add') as HTMLButtonElement;
  addBtn.addEventListener('click', () => {
    const nameInput = form.querySelector('#plot-name') as HTMLInputElement;
    const cropSelect = form.querySelector('#plot-crop') as HTMLSelectElement;
    const harvestInput = form.querySelector('#plot-harvest') as HTMLInputElement;

    const name = nameInput.value.trim();
    if (!name) {
      alert('请给地块起个名字');
      return;
    }
    if (!harvestInput.value) {
      alert('请选打算收获的日子');
      return;
    }
    store.addPlot(name, cropSelect.value, harvestInput.value);
    refresh();
  });

  return form;
}

// 撞期提醒卡
function buildConflictCard(conflicts: Map<string, PlanNode[]>, plots: Plot[]): HTMLElement {
  const card = createElement('div', 'card conflict-card');
  const plotName = (id: string) => plots.find(p => p.id === id)?.name ?? '未知地块';

  const lines = [...conflicts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, nodes]) => {
      const [, m, d] = parseDate(date);
      const names = [...new Set(nodes.map(n => plotName(n.plotId)))].join('、');
      const tasks = nodes.map(n => n.name).join('、');
      return `<div class="conflict-line">⚠️ <b>${m}月${d}日</b>：${names} 挤在一起（${tasks}）</div>`;
    });

  card.innerHTML = `<h3>撞期提醒</h3>${lines.join('')}`;
  return card;
}

// 在种地块卡片
function buildPlotCard(
  plot: Plot,
  nodes: PlanNode[],
  overdueIds: Set<string>,
  conflicts: Map<string, PlanNode[]>,
  plots: Plot[],
  todayStr: string,
  refresh: () => void,
): HTMLElement {
  const crop = getCrop(plot.cropKey);
  const card = createElement('div', 'card plot-card');

  const doneCount = nodes.filter(n => n.done).length;
  const [, hm, hd] = parseDate(plot.harvestDate);
  const first = nodes[0];
  const spanText = first
    ? `${fmtShort(first.date)} ${first.name} → ${hm}月${hd}日 收获`
    : '';

  const head = createElement('div', 'plot-card-head');
  head.innerHTML = `
    <div class="plot-head-main">
      <span class="plot-name">${plot.name}</span>
      <span class="plot-meta">${crop?.name ?? plot.cropKey} · 全生育期约${crop?.growthDays ?? '?'}天 · 进度 ${doneCount}/${nodes.length}</span>
      <span class="plot-span">${spanText}</span>
    </div>
  `;
  const stopBtn = createElement('button', 'stop-btn', '不种了');
  stopBtn.addEventListener('click', () => {
    if (confirm(`「${plot.name}」不种了？停掉后它的节点不再提醒，随时可以恢复。`)) {
      store.setPlotStopped(plot.id, true);
      refresh();
    }
  });
  head.appendChild(stopBtn);
  card.appendChild(head);

  // 节点时间线
  const list = createElement('div', 'node-list');
  for (const node of nodes) {
    list.appendChild(buildNodeRow(node, plot, overdueIds.has(node.id), conflicts, plots, todayStr, refresh));
  }
  card.appendChild(list);

  return card;
}

// 单个节点行
function buildNodeRow(
  node: PlanNode,
  plot: Plot,
  isOverdue: boolean,
  conflicts: Map<string, PlanNode[]>,
  plots: Plot[],
  todayStr: string,
  refresh: () => void,
): HTMLElement {
  const row = createElement('div', 'node-row');
  if (node.done) row.classList.add('done');
  if (isOverdue) row.classList.add('overdue');

  // 完成勾选
  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'node-check';
  check.checked = node.done;
  check.addEventListener('change', () => {
    store.setNodeDone(node.id, check.checked);
    refresh();
  });

  const main = createElement('div', 'node-main');

  // 第一行：日期、名称、徽标
  const line1 = createElement('div', 'node-line1');
  const [y, m, d] = parseDate(node.date);
  const week = WEEK_DAYS[getWeekDay(y, m, d)];
  const dateLabel = createElement('span', 'node-date', `${m}月${d}日 周${week}`);
  if (node.date === todayStr) dateLabel.classList.add('today');

  line1.append(
    dateLabel,
    createElement('span', 'node-name', node.name),
    createElement('span', 'node-term', node.term ? `${node.term}期间` : ''),
  );

  if (isOverdue) {
    line1.appendChild(createElement('span', 'badge badge-overdue', '已过期'));
  }
  const conflictNodes = conflicts.get(node.date);
  if (!node.done && conflictNodes) {
    const others = conflictNodes
      .filter(n => n.plotId !== plot.id)
      .map(n => plots.find(p => p.id === n.plotId)?.name ?? '')
      .filter(Boolean);
    const badge = createElement('span', 'badge badge-conflict', '撞期');
    badge.title = `与 ${others.join('、')} 挤在同一天`;
    line1.appendChild(badge);
  }
  main.appendChild(line1);

  // 节气调整说明
  if (node.adjustedReason) {
    main.appendChild(createElement('div', 'node-reason', `↪ ${node.adjustedReason}`));
  }

  // 操作：改期、往后推
  const actions = createElement('div', 'node-actions');

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'node-date-input';
  dateInput.value = node.date;
  dateInput.title = '改到选中的日子';
  dateInput.addEventListener('change', () => {
    if (!dateInput.value) return;
    store.setNodeDate(node.id, dateInput.value);
    refresh();
  });

  const push1 = createElement('button', 'push-btn', '推1天');
  push1.addEventListener('click', () => { store.postponeNode(node.id, 1); refresh(); });
  const push7 = createElement('button', 'push-btn', '推7天');
  push7.addEventListener('click', () => { store.postponeNode(node.id, 7); refresh(); });

  actions.append(dateInput, push1, push7);
  main.appendChild(actions);

  row.append(check, main);
  return row;
}

// 已停地块行
function buildStoppedRow(plot: Plot, refresh: () => void): HTMLElement {
  const crop = getCrop(plot.cropKey);
  const row = createElement('div', 'stopped-row');
  row.innerHTML = `<span class="stopped-name">${plot.name}</span><span class="stopped-meta">${crop?.name ?? plot.cropKey} · 计划 ${plot.harvestDate} 收</span>`;

  const resumeBtn = createElement('button', 'push-btn', '恢复');
  resumeBtn.addEventListener('click', () => {
    store.setPlotStopped(plot.id, false);
    refresh();
  });
  const delBtn = createElement('button', 'stop-btn', '删除');
  delBtn.addEventListener('click', () => {
    if (confirm(`彻底删除「${plot.name}」和它的全部节点？`)) {
      store.removePlot(plot.id);
      refresh();
    }
  });

  row.append(resumeBtn, delBtn);
  return row;
}

function fmtShort(date: string): string {
  const [, m, d] = parseDate(date);
  return `${m}月${d}日`;
}
