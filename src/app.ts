import { router } from './router';
import { renderCalendar } from './pages/calendar';
import { renderDayDetail } from './pages/day-detail';
import { renderPick } from './pages/pick';
import { renderFarm } from './pages/farm';

export function initApp() {
  const app = document.getElementById('app');
  if (!app) return;

  // 全局样式注入
  injectStyles();

  // 路由处理
  router.onChange((route) => {
    switch (route.path) {
      case '/':
        renderCalendar(app);
        break;
      case '/day':
        if (route.params?.date) {
          renderDayDetail(app, route.params.date);
        } else {
          renderCalendar(app);
        }
        break;
      case '/pick':
        renderPick(app);
        break;
      case '/farm':
        renderFarm(app);
        break;
      default:
        renderCalendar(app);
    }
  });

  router.init();
}

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* 基础样式 */
    :root {
      --bg: #f5f0e8;
      --card-bg: #faf8f3;
      --primary: #8b2500;
      --primary-light: #a84a20;
      --secondary: #2c5f2d;
      --accent: #c41e3a;
      --text: #333;
      --text-light: #666;
      --border: #e0d5c5;
      --shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }

    .page {
      max-width: 800px;
      margin: 0 auto;
      padding: 16px;
      min-height: 100vh;
    }

    /* 头部 */
    .page-header, .calendar-header, .detail-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 2px solid var(--primary);
    }

    .page-title {
      font-size: 24px;
      color: var(--primary);
      flex: 1;
    }

    .back-btn, .nav-btn {
      padding: 8px 16px;
      border: 1px solid var(--primary);
      background: transparent;
      color: var(--primary);
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }

    .back-btn:hover, .nav-btn:hover {
      background: var(--primary);
      color: white;
    }

    /* 日历页 */
    .month-nav {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .month-display {
      font-size: 18px;
      font-weight: bold;
      min-width: 120px;
      text-align: center;
    }

    .quick-nav {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }

    .quick-link {
      padding: 6px 16px;
      background: var(--primary);
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 14px;
    }

    .week-header {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
      margin-bottom: 8px;
    }

    .week-day {
      text-align: center;
      padding: 8px;
      font-weight: bold;
      color: var(--primary);
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
    }

    .day-cell {
      aspect-ratio: 1;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 4px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .day-cell:hover {
      border-color: var(--primary);
      box-shadow: var(--shadow);
    }

    .day-cell.empty {
      background: transparent;
      border: none;
      cursor: default;
    }

    .day-cell.today {
      border-color: var(--accent);
      background: #fff0f0;
    }

    .day-cell.solar-term .lunar-day {
      color: var(--secondary);
      font-weight: bold;
    }

    .solar-day {
      font-size: 16px;
      font-weight: bold;
    }

    .lunar-day {
      font-size: 11px;
      color: var(--text-light);
      margin-top: 2px;
    }

    /* 卡片 */
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: var(--shadow);
    }

    .card h3 {
      color: var(--primary);
      margin-bottom: 12px;
      font-size: 16px;
      border-left: 4px solid var(--primary);
      padding-left: 12px;
    }

    /* 农历卡片 */
    .lunar-main {
      text-align: center;
    }

    .lunar-date {
      font-size: 28px;
      color: var(--primary);
      font-weight: bold;
      margin-bottom: 8px;
    }

    .ganzhi {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-bottom: 8px;
      color: var(--text-light);
    }

    .shengxiao {
      color: var(--accent);
      font-size: 18px;
    }

    .solar-term-badge {
      display: inline-block;
      background: var(--secondary);
      color: white;
      padding: 4px 16px;
      border-radius: 16px;
      margin-top: 8px;
      font-size: 14px;
    }

    /* 宜忌卡片 */
    .yiji-row {
      display: flex;
      gap: 20px;
    }

    .yiji-col {
      flex: 1;
    }

    .yiji-label {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 8px;
    }

    .yiji-col.yi .yiji-label { color: var(--secondary); }
    .yiji-col.ji .yiji-label { color: var(--accent); }

    .yiji-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .yi-tag, .ji-tag {
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 13px;
    }

    .yi-tag {
      background: #e8f5e9;
      color: var(--secondary);
    }

    .ji-tag {
      background: #ffebee;
      color: var(--accent);
    }

    .yiji-meta {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 16px;
      font-size: 13px;
      color: var(--text-light);
    }

    /* 时辰 */
    .hour-table {
      display: grid;
      gap: 4px;
    }

    .hour-row {
      display: grid;
      grid-template-columns: 80px 100px 80px 60px;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 4px;
      align-items: center;
    }

    .hour-row.吉 { background: #e8f5e9; }
    .hour-row.凶 { background: #ffebee; }
    .hour-row.平 { background: #f5f5f5; }

    .hour-luck {
      font-weight: bold;
      text-align: center;
    }

    .hour-row.吉 .hour-luck { color: var(--secondary); }
    .hour-row.凶 .hour-luck { color: var(--accent); }

    /* 农事 */
    .farm-hou {
      color: var(--text-light);
      font-size: 14px;
      margin-bottom: 12px;
      font-style: italic;
    }

    .farm-tasks {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .task-tag {
      padding: 6px 14px;
      background: #e3f2fd;
      color: #1565c0;
      border-radius: 16px;
      font-size: 13px;
    }

    /* 择日页 */
    .pick-form {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .form-section {
      margin-bottom: 20px;
    }

    .form-section label {
      display: block;
      margin-bottom: 8px;
      font-weight: bold;
      color: var(--primary);
    }

    .events-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }

    .event-btn {
      padding: 10px;
      border: 2px solid var(--border);
      background: white;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .event-btn:hover {
      border-color: var(--primary);
    }

    .event-btn.selected {
      border-color: var(--primary);
      background: var(--primary);
      color: white;
    }

    .date-range {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .date-range input {
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 14px;
    }

    .form-section input[type="text"] {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 14px;
    }

    .submit-btn {
      width: 100%;
      padding: 14px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
    }

    .submit-btn:hover {
      background: var(--primary-light);
    }

    /* 结果 */
    .result-stats {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .result-stats span {
      padding: 6px 14px;
      background: var(--card-bg);
      border-radius: 16px;
      font-size: 13px;
    }

    .result-stats .elapsed {
      margin-left: auto;
      color: var(--text-light);
    }

    .result-section {
      margin-bottom: 24px;
    }

    .section-title {
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--border);
    }

    .section-title.best { color: var(--accent); border-color: var(--accent); }
    .section-title.good { color: var(--secondary); border-color: var(--secondary); }

    .result-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
    }

    .result-card {
      background: var(--card-bg);
      border: 2px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .result-card:hover {
      box-shadow: var(--shadow);
      border-color: var(--primary);
    }

    .result-card.score-4 { border-color: var(--accent); background: #fff0f0; }
    .result-card.score-3 { border-color: var(--secondary); background: #f0f8f0; }

    .result-date {
      font-weight: bold;
      font-size: 14px;
    }

    .result-ganzhi {
      color: var(--text-light);
      font-size: 12px;
    }

    .result-score {
      font-size: 20px;
      font-weight: bold;
      color: var(--primary);
    }

    .result-reason {
      font-size: 12px;
      color: var(--text-light);
      margin-top: 4px;
    }

    .result-yi {
      margin-top: 6px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .result-yi span {
      padding: 2px 6px;
      background: #e8f5e9;
      color: var(--secondary);
      border-radius: 4px;
      font-size: 11px;
    }

    .export-btn {
      width: 100%;
      padding: 12px;
      background: var(--secondary);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      margin-top: 20px;
    }

    /* 农事计划页 */
    .farm-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }

    .stat-chip {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .stat-value { font-size: 22px; font-weight: bold; color: var(--text-light); }
    .stat-label { font-size: 12px; color: var(--text-light); }
    .stat-danger .stat-value { color: var(--accent); }
    .stat-warning .stat-value { color: #b06d00; }
    .stat-neutral .stat-value { color: var(--primary); }

    .upcoming-card h3 { color: var(--secondary); border-color: var(--secondary); }
    .overdue-card { border-color: var(--accent); }
    .overdue-card h3 { color: var(--accent); border-color: var(--accent); }

    .upcoming-list, .overdue-list { display: grid; gap: 6px; }

    .upcoming-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding: 8px 10px;
      background: #f2f8f2;
      border-radius: 6px;
      font-size: 14px;
    }

    .upcoming-row.conflict { background: #fff6e5; outline: 1px solid #e0b35e; }
    .up-when { font-weight: bold; color: var(--secondary); min-width: 56px; }
    .up-date { color: var(--text-light); font-size: 13px; }
    .up-who { font-weight: bold; }

    .overdue-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding: 8px 10px;
      background: #fff0f0;
      border-radius: 6px;
      font-size: 14px;
    }

    .od-days { font-weight: bold; color: var(--accent); min-width: 70px; }
    .od-who { font-weight: bold; }
    .od-date { color: var(--text-light); font-size: 13px; margin-right: auto; }

    .mini-btn {
      padding: 4px 10px;
      font-size: 12px;
      border: 1px solid var(--border);
      background: white;
      border-radius: 4px;
      cursor: pointer;
      color: var(--text);
    }

    .mini-btn:hover { border-color: var(--primary); color: var(--primary); }
    .done-btn:hover { border-color: var(--secondary); color: var(--secondary); }
    .delay-btn:hover { border-color: #b06d00; color: #b06d00; }
    .stop-btn { color: var(--accent); border-color: #e6b3b3; }
    .stop-btn:hover { background: var(--accent); color: white; border-color: var(--accent); }
    .delete-btn:hover { background: var(--accent); color: white; border-color: var(--accent); }
    .resume-btn:hover { background: var(--secondary); color: white; border-color: var(--secondary); }
    .safe-btn:hover { background: var(--secondary); color: white; border-color: var(--secondary); }

    /* 新增地块表单 */
    .add-plot-card h3 { margin-bottom: 14px; }
    .plot-form { display: grid; gap: 12px; }
    .form-row { display: flex; align-items: center; gap: 10px; }
    .form-row label { min-width: 96px; font-weight: bold; color: var(--primary); font-size: 14px; }
    .form-row input[type="text"], .form-row input[type="date"], .form-row select {
      flex: 1;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 14px;
      background: white;
    }

    .crop-note, .term-hint {
      font-size: 12px;
      color: var(--text-light);
      margin: -4px 0 0 106px;
    }

    /* 地块卡 */
    .plot-card { padding: 16px; }
    .plot-head {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      padding-bottom: 12px;
      margin-bottom: 12px;
      border-bottom: 1px dashed var(--border);
    }

    .plot-title { display: flex; flex-direction: column; gap: 2px; min-width: 140px; }
    .plot-name { font-size: 18px; font-weight: bold; color: var(--primary); }
    .plot-crop { font-size: 14px; color: var(--secondary); font-weight: bold; }
    .plot-growth { font-size: 12px; color: var(--text-light); }

    .harvest-edit { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .harvest-label { font-size: 13px; color: var(--text-light); }
    .harvest-input {
      padding: 6px 8px;
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 13px;
    }
    .plot-head .stop-btn { margin-left: auto; }

    /* 节点时间线 */
    .node-timeline { display: grid; gap: 8px; }
    .node-row {
      border: 1px solid var(--border);
      border-left: 4px solid var(--border);
      border-radius: 6px;
      padding: 10px 12px;
      background: white;
      display: grid;
      gap: 8px;
    }

    .node-row.done { background: #f4f7f4; border-left-color: var(--secondary); opacity: 0.75; }
    .node-row.overdue { border-left-color: var(--accent); background: #fff8f8; }
    .node-row.conflict { border-left-color: #d99000; }
    .node-row.shifted { border-left-color: var(--secondary); }

    .node-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .node-name { font-weight: bold; font-size: 15px; min-width: 84px; }
    .node-date { font-size: 14px; }
    .node-rel { font-size: 12px; color: var(--text-light); }
    .node-rel.rel-overdue { color: var(--accent); font-weight: bold; }

    .node-badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      white-space: nowrap;
    }
    .badge-term { background: #ece4d8; color: var(--text-light); }
    .badge-good { background: #e3f2e5; color: var(--secondary); font-weight: bold; }
    .badge-done { background: #dcedde; color: var(--secondary); }
    .badge-overdue { background: #ffe0e0; color: var(--accent); font-weight: bold; }
    .badge-conflict { background: #fff0d6; color: #9a6500; font-weight: bold; }
    .badge-manual { background: #e8eef7; color: #2a5298; }

    .node-detail { display: grid; gap: 2px; }
    .node-base { font-size: 12px; color: var(--text-light); }
    .node-reason { font-size: 13px; color: #1b6b35; background: #f0f7f1; padding: 6px 8px; border-radius: 4px; }
    .node-warning { font-size: 13px; color: var(--accent); background: #fdf0f0; padding: 6px 8px; border-radius: 4px; }

    .node-actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .node-date-input {
      padding: 4px 6px;
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 12px;
    }

    /* 已停种 */
    .stopped-wrap {
      background: var(--card-bg);
      border: 1px dashed var(--border);
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 16px;
    }
    .stopped-title { color: var(--text-light); font-size: 14px; margin-bottom: 10px; }
    .stopped-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding: 8px 0;
      border-bottom: 1px dashed var(--border);
      font-size: 14px;
      opacity: 0.8;
    }
    .stopped-row:last-child { border-bottom: none; }
    .sp-name { font-weight: bold; min-width: 90px; }
    .sp-crop { color: var(--secondary); }
    .sp-date { color: var(--text-light); font-size: 12px; margin-right: auto; }

    /* 节气参考 */
    .term-reference { margin-top: 24px; }
    .term-ref-toggle {
      width: 100%;
      padding: 10px;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text-light);
      cursor: pointer;
      font-size: 14px;
    }
    .term-ref-toggle:hover { color: var(--primary); border-color: var(--primary); }
    .term-ref-body { margin-top: 12px; display: grid; gap: 10px; }

    .term-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
    }

    .term-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      gap: 10px;
      flex-wrap: wrap;
    }

    .term-name { font-size: 17px; font-weight: bold; color: var(--primary); }
    .term-hou { font-size: 12px; color: var(--text-light); }
    .term-tasks { display: flex; flex-wrap: wrap; gap: 6px; }

    /* 二十八宿 */
    .xiu-name {
      font-size: 20px;
      color: var(--primary);
      text-align: center;
    }

    /* 彭祖百忌 */
    .pengzu-item {
      padding: 8px 0;
      border-bottom: 1px dashed var(--border);
      font-size: 14px;
    }

    .pengzu-item:last-child {
      border-bottom: none;
    }

    /* 响应式 */
    @media (max-width: 600px) {
      .page { padding: 8px; }
      .page-title { font-size: 20px; }
      .events-grid { grid-template-columns: repeat(3, 1fr); }
      .result-grid { grid-template-columns: repeat(2, 1fr); }
      .yiji-row { flex-direction: column; }
      .hour-row { grid-template-columns: 60px 80px 60px 50px; font-size: 13px; }
      .ganzhi { gap: 8px; font-size: 14px; }
      .farm-stats { grid-template-columns: repeat(2, 1fr); }
      .form-row { flex-direction: column; align-items: stretch; }
      .form-row label { min-width: 0; }
      .crop-note, .term-hint { margin-left: 0; }
      .plot-head .stop-btn { margin-left: 0; }
      .harvest-edit { width: 100%; }
    }
  `;
  document.head.appendChild(style);
}
