/*
 * ===== 工程答疑列表 =====
 * 负责把答疑记录渲染为统计卡片和表格，并实现搜索、筛选、排序、分页及“查看详情”。
 * 这里的 qa 是 question and answer（工程答疑）的缩写。
 */
let qaRecords = [];
const qaPageSize = 10;
const qaEl = {
  body: document.querySelector("#qaTableBody"),
  count: document.querySelector("#qaCount"),
  pages: document.querySelector("#qaPageButtons"),
  pager: document.querySelector("#qaPager"),
  pageInput: document.querySelector("#qaPageInput"),
  totalPages: document.querySelector("#qaTotalPages"),
  jumpButton: document.querySelector("#qaJumpButton"),
  no: document.querySelector("#qaNoFilter"),
  title: document.querySelector("#qaTitleFilter"),
  discipline: document.querySelector("#qaDisciplineFilter"),
  date: document.querySelector("#qaDateFilter"),
  status: document.querySelector("#qaStatusFilter"),
  reset: document.querySelector("#qaResetFilter"),
  total: document.querySelector("#qaTotal"),
  supervisor: document.querySelector("#qaSupervisorTotal"),
  design: document.querySelector("#qaDesignTotal"),
  construction: document.querySelector("#qaConstructionTotal"),
  done: document.querySelector("#qaDoneTotal"),
};
let qaPage = 1;
let qaStatus = "";
let qaSorts = [{ field: "date", direction: "desc" }];
const qaEsc = (value) =>
  String(value).replace(
    /[&<>'"]/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[char],
  );
const normalizeQaDate = (value) =>
  value
    .trim()
    .replace(/\s/g, "")
    .replace(/[年月]/g, "-")
    .replace(/日/g, "")
    .replace(/[/.]/g, "-");
const qaTerminalStatuses = new Set([
  "已归档",
  "出具变更",
  "已退回施工单位",
]);
const isQaProcessed = (row) => Boolean(row.ownerDirective) || qaTerminalStatuses.has(row.status);
const qaChangeResult = (row) =>
  typeof row.designInvolvesChange === "boolean"
    ? row.designInvolvesChange
      ? "涉及变更"
      : "不涉及变更"
    : "未进入设计确认";
const getQaSearchResults = () =>
  qaRecords.filter(
    (row) =>
      (!window.smartWorksProjectFilter ||
        row.project === window.smartWorksProjectFilter) &&
      row.no.toLowerCase().includes(qaEl.no.value.trim().toLowerCase()) &&
      row.title.toLowerCase().includes(qaEl.title.value.trim().toLowerCase()) &&
      (!qaEl.discipline.value || row.discipline === qaEl.discipline.value) &&
      (!qaEl.date.value || row.date === normalizeQaDate(qaEl.date.value)) &&
      (!qaEl.status.value || row.status === qaEl.status.value),
  );
const qaSortValue = (row, field) =>
  field === "change" ? qaChangeResult(row) : String(row[field] || "");
const sortQaRows = (rows) =>
  rows.slice().sort((a, b) => {
    const unit = window.smartWorksCurrentUnit;
    const allView =
      !qaStatus &&
      !qaEl.status.value &&
      (unit === "建设单位" || unit === "施工单位");
    if (allView && isQaProcessed(a) !== isQaProcessed(b))
      return isQaProcessed(a) ? 1 : -1;
    for (const rule of qaSorts) {
      const result = qaSortValue(a, rule.field).localeCompare(
        qaSortValue(b, rule.field),
        "zh-Hans-CN",
        { numeric: true },
      );
      if (result) return rule.direction === "asc" ? result : -result;
    }
    return 0;
  });
const getQaResults = () =>
  sortQaRows(
    getQaSearchResults().filter(
      (row) =>
        !qaStatus ||
        (qaStatus === "__terminal__"
          ? isQaProcessed(row)
          : row.status === qaStatus),
    ),
  );
const qaIsUnread = (row) =>
  Boolean(
    window.smartWorksCurrentAccount &&
      row.unreadFor &&
      row.unreadFor[window.smartWorksCurrentAccount],
  );
const qaCanHandle = (row) =>
  (window.smartWorksCurrentUnit === "监理单位" && row.step === "supervision") ||
  (window.smartWorksCurrentUnit === "设计单位" && row.step === "design") ||
  (window.smartWorksCurrentUnit === "施工单位" && row.step === "construction") ||
  (window.smartWorksCurrentUnit === "建设单位" && (row.step === "coordinated" || row.status === "已转需业主协调") && (window.isQaCoordinationPending?.(row) ?? true));
const qaIsHandledByCurrentUser = (row) =>
  Boolean(row.handledBy && row.handledBy[window.smartWorksCurrentAccount]) &&
  !qaCanHandle(row) &&
  !qaIsUnread(row);
const qaIsReadNoActionByCurrentUser = (row) =>
  !qaIsUnread(row) &&
  !qaCanHandle(row) &&
  !Boolean(row.handledBy && row.handledBy[window.smartWorksCurrentAccount]);
let matterFilter = "all";
const qaLatestTime = (row) =>
  row.replies?.[row.replies.length - 1]?.time ||
  row.initiatedAt ||
  row.date ||
  "—";
const renderMatterPanel = () => {
  const host = document.querySelector("#matters"),
    unreadCount = document.querySelector("#matterUnreadCount"),
    todoCount = document.querySelector("#matterTodoCount");
  if (!host || !window.smartWorksProjectFilter) return;
  const scoped = qaRecords.filter(
    (row) => row.project === window.smartWorksProjectFilter,
  );
  const unreadRows = scoped.filter(
      (row) => qaIsUnread(row) && !qaCanHandle(row),
    ),
    todoRows = scoped.filter(qaCanHandle),
    readRows = scoped.filter(qaIsReadNoActionByCurrentUser),
    doneRows = scoped.filter(qaIsHandledByCurrentUser);
  unreadCount.textContent = unreadRows.length || "";
  todoCount.textContent = todoRows.length || "";
  const source =
    matterFilter === "unread"
      ? unreadRows
      : matterFilter === "read"
        ? readRows
        : matterFilter === "todo"
          ? todoRows
          : matterFilter === "done"
            ? doneRows
            : scoped.filter((row) => qaIsUnread(row) || qaCanHandle(row));
  host.innerHTML = source.length
    ? source
        .map((row) => {
          const unread = qaIsUnread(row),
            pending = qaCanHandle(row),
            state = qaEsc(pending && (row.step === "coordinated" || row.status === "已转需业主协调") ? "查看问题 / 批示" : row.status),
            title = qaEsc(row.title);
          return `<article class="matter" data-qa-matter-view="${qaEsc(row.no)}" data-unread="${unread}"><span class="dot"></span><div><span class="module">工程答疑</span><h3><a class="matter-title ${unread ? "unread" : ""}" href="#工程答疑">${title}</a></h3></div><div class="date"><span>最近处理时间</span><time>${qaEsc(qaLatestTime(row))}</time></div><button class="state-link matter-state" type="button" data-qa-matter-view="${qaEsc(row.no)}">${state}</button></article>`;
        })
        .join("")
    : '<div class="matter-empty">暂无符合条件的事项</div>';
  host.querySelectorAll("[data-qa-matter-view]").forEach((item) =>
    item.addEventListener("click", (event) => {
      event.preventDefault();
      const row = qaRecords.find(
        (record) => record.no === item.dataset.qaMatterView,
      );
      if (!row) return;
      markQaReadFor(row, currentAccountId);
      saveSharedQaRecords();
      renderQa();
      renderMatterPanel();
      window.renderQaAdmin?.();
      if (qaCanHandle(row) && (row.step === "coordinated" || row.status === "已转需业主协调")) window.openQaCoordination?.(row.no);
      else window.openQaDetailView?.(row);
    }),
  );
  window.appendMeetingMatters?.({host, filter: matterFilter, unreadCount: unreadRows.length, todoCount: todoRows.length});
  window.appendDrawingChangeMatters?.({host, filter: matterFilter});
  // Merge notifications and QA work in one timeline instead of hiding meetings below QA rows.
  host.querySelectorAll('[data-qa-matter-view].matter').forEach(item => {
    const row = scoped.find(record => record.no === item.dataset.qaMatterView);
    item.dataset.matterTime = String(Date.parse(qaLatestTime(row)) || 0);
  });
  [...host.querySelectorAll('.matter')]
    .sort((a, b) => Number(b.dataset.matterTime || 0) - Number(a.dataset.matterTime || 0))
    .forEach(item => host.append(item));
};
document.querySelectorAll(".tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    matterFilter = tab.dataset.filter;
    document
      .querySelectorAll(".tab")
      .forEach((item) => item.classList.toggle("active", item === tab));
    renderMatterPanel();
    document.querySelector('#matters').scrollTop = 0;
  }),
);
const qaSortLabels = {
  no: "答疑编号",
  title: "答疑主题",
  discipline: "提疑专业",
  owner: "提疑人",
  date: "提疑日期",
  change: "变更判定",
  status: "状态",
};
const renderQaSort = () =>
  document.querySelectorAll("[data-qa-sort]").forEach((button) => {
    const index = qaSorts.findIndex(
        (item) => item.field === button.dataset.qaSort,
      ),
      active = index > -1,
      rule = qaSorts[index];
    button.classList.toggle("active", active);
    button.querySelector(".qa-sort-indicator").textContent = active
      ? rule.direction === "asc"
        ? "↑"
        : "↓"
      : "↕";
    button.querySelector(".qa-sort-priority").textContent = active
      ? index + 1
      : "";
    button.setAttribute(
      "aria-label",
      `按${qaSortLabels[button.dataset.qaSort]}排序`,
    );
  });
// 根据当前筛选条件和页码，重新绘制工程答疑统计数字与表格行。
function renderQa() {
  document.body.classList.toggle(
    "qa-admin-readonly",
    window.smartWorksCurrentAccount === "yan",
  );
  const searchRows = getQaSearchResults(),
    rows = getQaResults(),
    pages = Math.max(1, Math.ceil(rows.length / qaPageSize));
  qaPage = Math.min(Math.max(1, qaPage), pages);
  const slice = rows.slice((qaPage - 1) * qaPageSize, qaPage * qaPageSize);
  qaEl.body.innerHTML = slice.length
    ? slice
        .map((row) => {
          const kind =
            row.status === "待监理确认"
              ? "wait"
              : row.status === "待设计确认" || row.status === "待施工确认"
                ? "progress"
                : "done";
          const unread = qaIsUnread(row),
            decision = qaChangeResult(row),
            decisionClass =
              decision === "涉及变更"
                ? "yes"
                : decision === "不涉及变更"
                  ? "no"
                  : "",
            actionLabel = qaCanHandle(row) ? "去处理" : "查看",
            action = window.getQaAdvanceAction
              ? window.getQaAdvanceAction(row)
              : "",
            entry = `<button class="qa-row-entry" type="button" data-qa-view="${qaEsc(row.no)}">`;
          return `<tr class="${unread ? "qa-row-unread" : ""}"><td class="qa-number">${entry}${qaEsc(row.no)}${unread ? '<span class="qa-unread-badge">未读</span>' : ""}</button></td><td class="qa-title">${entry}${qaEsc(row.title)}</button></td><td>${qaEsc(row.discipline)}</td><td>${qaEsc(row.owner)}</td><td>${qaEsc(row.date)}</td><td><span class="qa-change-result ${decisionClass}">${decision}</span></td><td><div class="qa-operation"><span class="qa-status ${kind}">${qaEsc(row.status)}</span><button class="qa-action" type="button" data-qa-view="${qaEsc(row.no)}">${actionLabel}</button>${action}</div></td></tr>`;
        })
        .join("")
    : '<tr><td colspan="7" style="text-align:center;color:#8b979d">暂无符合条件的工程答疑</td></tr>';
  qaEl.count.textContent = `共 ${rows.length} 条`;
  const visiblePages = [qaPage - 1, qaPage, qaPage + 1].filter(
    (page) => page >= 1 && page <= pages,
  );
  qaEl.pages.innerHTML = visiblePages
    .map(
      (page) =>
        `<button type="button" data-page="${page}" class="${page === qaPage ? "active" : ""}">${page}</button>`,
    )
    .join("");
  qaEl.pageInput.value = qaPage;
  qaEl.pageInput.max = pages;
  qaEl.totalPages.textContent = pages;
  qaEl.pager.querySelector('[data-page-action="jump-prev"]').disabled =
    qaPage === 1;
  qaEl.pager.querySelector('[data-page-action="prev"]').disabled = qaPage === 1;
  qaEl.pager.querySelector('[data-page-action="next"]').disabled =
    qaPage === pages;
  qaEl.pager.querySelector('[data-page-action="jump-next"]').disabled =
    qaPage === pages;
  qaEl.total.textContent = searchRows.length;
  qaEl.supervisor.textContent = searchRows.filter(
    (row) => row.status === "待监理确认",
  ).length;
  qaEl.design.textContent = searchRows.filter(
    (row) => row.status === "待设计确认",
  ).length;
  qaEl.construction.textContent = searchRows.filter(
    (row) => row.status === "待施工确认",
  ).length;
  qaEl.done.textContent = searchRows.filter(isQaProcessed).length;
  renderQaSort();
}
qaEl.pager.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const action = button.dataset.pageAction;
  if (action) {
    if (action === "jump-prev") qaPage -= 10;
    else if (action === "prev") qaPage -= 1;
    else if (action === "next") qaPage += 1;
    else if (action === "jump-next") qaPage += 10;
    renderQa();
    return;
  }
  if (button.dataset.page) {
    qaPage = Number(button.dataset.page);
    renderQa();
  }
});
document.querySelector(".qa-summary").addEventListener("click", (event) => {
  const stat = event.target.closest("[data-stat-status]");
  if (!stat) return;
  document
    .querySelectorAll(".qa-stat")
    .forEach((item) => item.classList.toggle("active", item === stat));
  qaStatus = stat.dataset.statStatus;
  qaPage = 1;
  renderQa();
});
document.querySelectorAll("[data-qa-sort]").forEach((button) =>
  button.addEventListener("click", () => {
    const field = button.dataset.qaSort,
      index = qaSorts.findIndex((item) => item.field === field);
    if (index < 0) qaSorts.push({ field, direction: "asc" });
    else if (qaSorts[index].direction === "asc")
      qaSorts[index].direction = "desc";
    else qaSorts.splice(index, 1);
    qaPage = 1;
    renderQa();
  }),
);
[qaEl.no, qaEl.title, qaEl.discipline, qaEl.date, qaEl.status].forEach(
  (input) =>
    input.addEventListener(
      input.tagName === "INPUT" ? "input" : "change",
      () => {
        qaPage = 1;
        renderQa();
      },
    ),
);
qaEl.reset.addEventListener("click", () => {
  qaStatus = "";
  qaSorts = [{ field: "date", direction: "desc" }];
  document
    .querySelectorAll(".qa-stat")
    .forEach((item, index) => item.classList.toggle("active", index === 0));
  [qaEl.no, qaEl.title, qaEl.discipline, qaEl.date, qaEl.status].forEach(
    (input) => (input.value = ""),
  );
  qaPage = 1;
  renderQa();
});
qaEl.jumpButton.addEventListener("click", () => {
  qaPage = Number(qaEl.pageInput.value) || 1;
  renderQa();
});
qaEl.pageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    qaPage = Number(qaEl.pageInput.value) || 1;
    renderQa();
  }
});
renderQa();
