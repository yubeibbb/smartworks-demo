/*
 * ===== 工程答疑的本地演示数据与流程 =====
 * 本机测试账号：账号会话按标签页保存，工程答疑数据在本机浏览器中共享。
 * 直接双击打开 HTML 时，数据只保存到浏览器 localStorage，不会写入真实数据库。
 */
const smartWorksAccountKey = "smartWorksTestAccount";
const smartWorksProjectKey = "smartWorksTestProject";
const smartWorksRecordsKey = "smartWorksSharedQaRecordsV1";
const qaDatabaseEndpoint =
  location.protocol === "file:"
    ? "http://127.0.0.1:4183/api/business/engineering-qa"
    : "/api/business/engineering-qa";
let qaUsesDatabase = location.protocol !== "file:" && !window.smartWorksStaticDemo;
const smartWorksRememberKey = "smartWorksRememberedPasswordsV1";
const smartWorksProjects = ["深圳湾综合体项目", "深圳国际会展中心改扩建项目"];
const smartWorksUsers = {
  li: {
    name: "李工",
    avatar: "李",
    phone: "19923456789",
    unit: "建设单位",
    roles: {
      深圳湾综合体项目: "建设单位 · 项目负责人",
      深圳国际会展中心改扩建项目: "建设单位 · 商务经理",
    },
  },
  zhao: {
    name: "赵工",
    avatar: "赵",
    phone: "18823456789",
    unit: "设计单位",
    roles: {
      深圳湾综合体项目: "设计单位 · 设计单位负责人",
      深圳国际会展中心改扩建项目: "设计单位 · 设计单位负责人",
    },
  },
  qian: {
    name: "钱工",
    avatar: "钱",
    phone: "17723456789",
    unit: "监理单位",
    roles: {
      深圳湾综合体项目: "监理单位 · 总监理工程师",
      深圳国际会展中心改扩建项目: "监理单位 · 总监理工程师",
    },
  },
  sun: {
    name: "孙工",
    avatar: "孙",
    phone: "16623456789",
    unit: "施工单位",
    roles: {
      深圳湾综合体项目: "施工单位 · 项目负责人",
      深圳国际会展中心改扩建项目: "施工单位 · 项目负责人",
    },
  },
  yan: {
    name: "鄢工",
    avatar: "鄢",
    phone: "11111111111",
    unit: "系统管理员",
    roles: {
      深圳湾综合体项目: "系统管理员 · 全局权限",
      深圳国际会展中心改扩建项目: "系统管理员 · 全局权限",
    },
    admin: true,
  },
};
const normalizeOwnerArchivedQa = row => row.ownerDirective || row.status === "业主已批示" || row.step === "owner_directed"
  ? {...row, status: "已归档", step: "done", nextNode: "已归档（业主批示结案）"}
  : row;
const getSharedQaRecords = () => {
  try {
    const saved = JSON.parse(
      localStorage.getItem(smartWorksRecordsKey) || "null",
    );
    return Array.isArray(saved)
      ? saved
          .filter((row) => row.project && row.contactNo)
          .map((row) => {
            const status =
              row.status === "待设计回复"
                ? "待设计确认"
                : row.status === "已完成"
                  ? "已归档"
                  : row.status === "已转变更"
                    ? "出具变更"
                    : row.status === "已转协调事项"
                      ? "已转需业主协调"
                      : row.status;
            const readBy =
              row.readBy && typeof row.readBy === "object" ? row.readBy : {};
            const unreadFor =
              row.unreadFor && typeof row.unreadFor === "object"
                ? row.unreadFor
                : {};
            if (!row.unreadFor) {
              Object.keys(smartWorksUsers || {}).forEach((account) => {
                if (!readBy[account]) unreadFor[account] = true;
              });
            }
            return {
              ...row,
              status,
              readBy,
              unreadFor,
              handledBy:
                row.handledBy && typeof row.handledBy === "object"
                  ? row.handledBy
                  : {},
              step:
                row.step ||
                (status === "待监理确认"
                  ? "supervision"
                  : status === "待设计确认"
                    ? "design"
                    : status === "待施工确认"
                      ? "construction"
                      : "done"),
            };
          }).map(normalizeOwnerArchivedQa)
      : null;
  } catch {
    return null;
  }
};
const saveSharedQaRecords = () => {
  if (!qaUsesDatabase) {
    localStorage.setItem(smartWorksRecordsKey, JSON.stringify(qaRecords));
    return;
  }
  fetch(qaDatabaseEndpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records: qaRecords }),
  }).catch(() => {});
};
// 文件方式打开时，优先恢复浏览器中已保存的模拟答疑记录。
const sharedRecords = qaUsesDatabase ? null : getSharedQaRecords();
qaRecords = sharedRecords || [];
const migrateLegacyQaRecords = async () => {
  if (window.smartWorksStaticDemo) return;
  if (qaUsesDatabase) return;
  const legacyRecords = qaRecords;
  if (!legacyRecords.length) {
    location.replace("http://127.0.0.1:4183/");
    return;
  }
  try {
    const response = await fetch(qaDatabaseEndpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records: legacyRecords }),
    });
    if (response.ok) {
      localStorage.removeItem(smartWorksRecordsKey);
      location.replace("http://127.0.0.1:4183/");
    }
  } catch {}
};
// 当前登录的模拟账号和当前项目；用于演示不同单位能看到的权限与待办。
let currentAccountId = sessionStorage.getItem(smartWorksAccountKey) || "li";
let currentProject =
  sessionStorage.getItem(smartWorksProjectKey) || smartWorksProjects[0];
if (!smartWorksUsers[currentAccountId]) currentAccountId = "li";
if (!smartWorksProjects.includes(currentProject))
  currentProject = smartWorksProjects[0];
const accountDialog = document.querySelector("#accountDialog"),
  accountList = document.querySelector("#accountList"),
  accountPassword = document.querySelector("#accountPassword"),
  rememberPassword = document.querySelector("#rememberPassword"),
  accountError = document.querySelector("#accountError"),
  accountSelectedName = document.querySelector("#accountSelectedName");
const qaForm = {
  contactNo: document.querySelector("#qaContactNo"),
  project: document.querySelector("#qaFormProject"),
  discipline: document.querySelector("#qaFormDiscipline"),
  location: document.querySelector("#qaFormLocation"),
  unit: document.querySelector("#qaFormUnit"),
  initiator: document.querySelector("#qaFormInitiator"),
  time: document.querySelector("#qaFormTime"),
  nextNode: document.querySelector("#qaFormNextNode"),
  title: document.querySelector("#qaFormTitle"),
  description: document.querySelector("#qaFormDescription"),
  attachmentInput: document.querySelector("#qaAttachmentInput"),
  attachmentList: document.querySelector("#qaAttachmentList"),
  replyHistory: document.querySelector("#qaReplyHistory"),
  replyHistoryList: document.querySelector("#qaReplyHistoryList"),
  replySection: document.querySelector("#qaReplySection"),
  replyHeading: document.querySelector("#qaReplyHeading"),
  replyLabel: document.querySelector("#qaReplyLabel"),
  replyText: document.querySelector("#qaReplyText"),
  replyCount: document.querySelector("#qaReplyCount"),
  replyAttachmentInput: document.querySelector("#qaReplyAttachmentInput"),
  replyAttachmentList: document.querySelector("#qaReplyAttachmentList"),
  changeChoice: document.querySelector("#qaChangeChoice"),
  resourceBody: document.querySelector("#qaResourceBody"),
  resourceEmpty: document.querySelector("#qaResourceEmpty"),
  note: document.querySelector("#qaDetailNote"),
  detailTitle: document.querySelector("#qaDetailTitle"),
  submit: document.querySelector("#qaDetailSubmit"),
  confirm: document.querySelector("#qaDetailConfirm"),
  returnButton: document.querySelector("#qaDetailReturn"),
  coordinate: document.querySelector("#qaDetailCoordinate"),
  reuse: document.querySelector("#qaDetailReuse"),
};
// 将原生文件选择框包装为可显示“已选文件数”的附件选择组件。
const mountQaFilePicker = (input, label) => {
  const picker = document.createElement("div"),
    button = document.createElement("button"),
    summary = document.createElement("em");
  picker.className = "qa-file-picker";
  button.type = "button";
  button.textContent = "选择文件";
  summary.textContent = "未选择文件";
  button.addEventListener("click", () => input.click());
  input.before(picker);
  picker.append(input, button, summary);
  return { picker, summary };
};
const qaAttachmentPicker = mountQaFilePicker(
    qaForm.attachmentInput,
    "附件资料",
  ),
  qaReplyAttachmentPicker = mountQaFilePicker(
    qaForm.replyAttachmentInput,
    "本次附件",
  );
qaDetailDialog.addEventListener(
  "click",
  (event) => {
    if (
      currentUser?.().admin &&
      event.target.closest(
        "#qaDetailSubmit,#qaDetailConfirm,#qaDetailReturn,#qaDetailCoordinate,#qaDetailReuse",
      )
    ) {
      event.stopImmediatePropagation();
      event.preventDefault();
      window.alert("系统管理员暂不可处理或修改工程答疑流程。");
    }
  },
  true,
);
let qaSelectedFiles = [],
  qaReplyFiles = [],
  qaReusedAttachments = [],
  qaCurrentAttachments = [],
  qaRemovedAttachments = [],
  qaViewingNo = null;
const qaFlowConfirm = document.querySelector("#qaFlowConfirm"),
  qaFlowConfirmText = document.querySelector("#qaFlowConfirmText"),
  qaFlowConfirmCancel = document.querySelector("#qaFlowConfirmCancel"),
  qaFlowConfirmOk = document.querySelector("#qaFlowConfirmOk");
let qaFlowBypass = false,
  qaPendingFlowAction = null;
const requestQaFlowConfirmation = (button) => {
  const action = button.textContent.trim();
  qaFlowConfirmText.textContent = `确认执行“${action}”吗？确认后将写入处理意见并更新答疑流转状态。`;
  qaPendingFlowAction = () => {
    qaFlowBypass = true;
    button.click();
    qaFlowBypass = false;
  };
  qaFlowConfirm.classList.add("show");
  qaFlowConfirm.setAttribute("aria-hidden", "false");
};
const closeQaFlowConfirmation = () => {
  qaFlowConfirm.classList.remove("show");
  qaFlowConfirm.setAttribute("aria-hidden", "true");
  qaPendingFlowAction = null;
};
qaFlowConfirmCancel.addEventListener("click", closeQaFlowConfirmation);
qaFlowConfirmOk.addEventListener("click", () => {
  const action = qaPendingFlowAction;
  closeQaFlowConfirmation();
  action?.();
});
let selectedAccountId = currentAccountId;
const getRememberedPasswords = () => {
  try {
    return JSON.parse(localStorage.getItem(smartWorksRememberKey) || "{}");
  } catch {
    return {};
  }
};
const setRememberedPassword = (id, password, remember) => {
  const remembered = getRememberedPasswords();
  if (remember) remembered[id] = password;
  else delete remembered[id];
  localStorage.setItem(smartWorksRememberKey, JSON.stringify(remembered));
};
const currentUser = () => smartWorksUsers[currentAccountId];
const setQaDefaultView = () => {
  const unit = currentUser().unit;
  qaStatus =
    unit === "监理单位"
      ? "待监理确认"
      : unit === "设计单位"
        ? "待设计确认"
        : "";
  qaPage = 1;
  document
    .querySelectorAll(".qa-stat")
    .forEach((item) =>
      item.classList.toggle("active", item.dataset.statStatus === qaStatus),
    );
};
const renderProjectOptions = () => {
  const user = currentUser();
  projectMenu.innerHTML = smartWorksProjects
    .map(
      (project) =>
        `<button type="button" data-project="${project}">${project}</button>`,
    )
    .join("");
  projectMenu.querySelectorAll("button").forEach((item) =>
    item.addEventListener("click", () => {
      currentProject = item.dataset.project;
      sessionStorage.setItem(smartWorksProjectKey, currentProject);
      applyCurrentAccount(false);
      closeQaDetail();
      window.closeMeetingDialog?.();
      window.closeDrawingChangeDialog?.();
      switchArea("business");
      openBusinessDirectory("项目信息", "项目看板");
      projectMenu.classList.remove("show");
    }),
  );
  projectName.textContent = currentProject;
  profileRole.textContent = user.roles[currentProject];
};
const applyCurrentAccount = (resetQaView = true) => {
  const user = currentUser();
  window.smartWorksIsAdmin=Boolean(user.admin);
  window.smartWorksProjectFilter = currentProject;
  window.smartWorksCurrentUnit = user.unit;
  window.smartWorksCurrentAccount = currentAccountId;
  if (resetQaView) setQaDefaultView();
  menuButton.textContent = user.avatar;
  profileAvatar.textContent = user.avatar;
  profileName.textContent = user.name;
  renderProjectOptions();
  updateDashboard(currentProject);
  document.querySelector("#newQaButton").disabled = !(
    user.unit === "施工单位" || user.admin
  );
  document.querySelector("#newQaButton").title = document.querySelector(
    "#newQaButton",
  ).disabled
    ? "仅施工单位负责人或系统管理员可发起工程答疑"
    : "";
  window.syncBusinessAccess?.();
  renderQa();
  renderMatterPanel();
  window.renderQaAdmin?.();
  window.renderMeetings?.();
  window.renderDrawingChanges?.();
  window.syncAdminWorkspace?.();
};
const selectAccount = (id) => {
  selectedAccountId = id;
  const user = smartWorksUsers[id],
    remembered = getRememberedPasswords();
  accountList
    .querySelectorAll("button")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.account === id),
    );
  accountSelectedName.textContent = `${user.name} · ${user.unit}`;
  accountPassword.value = remembered[id] || "";
  rememberPassword.checked = Boolean(remembered[id]);
  accountError.textContent = "";
  accountPassword.focus();
};
const renderAccountList = () => {
  accountList.innerHTML = Object.entries(smartWorksUsers)
    .map(
      ([id, user]) =>
        `<button class="account-choice" type="button" data-account="${id}"><span class="choice-avatar">${user.avatar}</span><span><b>${user.name}</b><small>${user.phone.slice(0, 3)} ${user.phone.slice(3, 7)} ${user.phone.slice(7)}</small></span></button>`,
    )
    .join("");
  accountList
    .querySelectorAll("button")
    .forEach((button) =>
      button.addEventListener("click", () =>
        selectAccount(button.dataset.account),
      ),
    );
  selectAccount(selectedAccountId);
};
const openAccountDialog = () => {
  selectedAccountId = currentAccountId;
  renderAccountList();
  accountDialog.classList.add("show");
  accountDialog.setAttribute("aria-hidden", "false");
};
const closeAccountDialog = () => {
  accountDialog.classList.remove("show");
  accountDialog.setAttribute("aria-hidden", "true");
  accountError.textContent = "";
};
document.addEventListener("smartworks:switch-account", () => {
  popover.classList.remove("show");
  menuButton.setAttribute("aria-expanded", "false");
  openAccountDialog();
});
document
  .querySelector("#accountDialogClose")
  .addEventListener("click", closeAccountDialog);
document
  .querySelector("#accountDialogCancel")
  .addEventListener("click", closeAccountDialog);

const loginSelectedAccount = () => {
  if (accountPassword.value !== "Test123.") {
    accountError.textContent = "账号或密码不正确，请重新输入。";
    accountPassword.focus();
    return;
  }
  setRememberedPassword(
    selectedAccountId,
    accountPassword.value,
    rememberPassword.checked,
  );
  currentAccountId = selectedAccountId;
  sessionStorage.setItem(smartWorksAccountKey, currentAccountId);
  closeAccountDialog();
  closeQaDetail();
  window.closeMeetingDialog?.();
  matterFilter = "all";
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.filter === "all"));
  applyCurrentAccount(true);
  if(currentUser().admin)window.openAdminWorkspace?.();
  else{switchArea("workbench");openBusinessDirectory("项目信息");}
};
document
  .querySelector("#accountLoginButton")
  .addEventListener("click", loginSelectedAccount);
accountPassword.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loginSelectedAccount();
});
const qaTimeText = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
const qaNextNode = () => {
  const user = currentUser();
  if (user.unit === "监理单位") return "设计单位 · 赵工（设计单位负责人）";
  if (user.unit === "设计单位") return "施工单位 · 孙工（项目负责人）";
  return "监理单位 · 钱工（总监理工程师）";
};
const qaParticipantAccounts = ["li", "zhao", "qian", "sun", "yan"];
const ensureQaAttention = (row) => {
  row.readBy = row.readBy && typeof row.readBy === "object" ? row.readBy : {};
  row.unreadFor =
    row.unreadFor && typeof row.unreadFor === "object" ? row.unreadFor : {};
  row.handledBy =
    row.handledBy && typeof row.handledBy === "object" ? row.handledBy : {};
};
const markQaUnreadFor = (row, scope = "recipient") => {
  ensureQaAttention(row);
  const accountByStep = {
      supervision: "qian",
      design: "zhao",
      construction: "sun",
    },
    targets =
      scope === "all"
        ? qaParticipantAccounts
        : [accountByStep[row.step]].filter(Boolean);
  targets.forEach((account) => {
    delete row.readBy[account];
    row.unreadFor[account] = true;
  });
};
const markQaReadFor = (row, account) => {
  ensureQaAttention(row);
  row.readBy[account] = true;
  delete row.unreadFor[account];
};
const markQaHandledBy = (row, account) => {
  ensureQaAttention(row);
  row.handledBy[account] = true;
  markQaReadFor(row, account);
};
const qaNextNodeForRow = (row) => row.ownerDirective ? "已归档（业主批示结案）" :
  ({
    supervision: "设计单位 · 赵工（设计单位负责人）",
    design: "施工单位 · 孙工（项目负责人）",
    construction: "完成归档",
    done: "已归档",
    returned: "流程已结束",
    changed: "变更管理模块",
    coordinated: "建设单位负责人 · 会议预约",
  })[row.step] || "完成归档";
const attachmentText = (file) =>
  `${qaEsc(file.name)} <em>(${Math.ceil((file.size || 0) / 1024)} KB)</em>`;
const updatePickerSummary = (picker, files) => {
  picker.summary.textContent = files.length
    ? `${files.length} 个已选择文件${files.length === 1 ? `：${files[0].name}` : ""}`
    : "未选择文件";
};
// 渲染新增答疑时的附件列表；readonly 为 true 时只展示、不允许修改。
const renderQaFileList = (readonly = false, row = null) => {
  const source = row
    ? `${qaEsc(row.unit || "发起单位")} · ${qaEsc(row.initiator || "")} · ${qaEsc(row.initiatedAt || row.date || "")}`
    : "";
  qaAttachmentPicker.picker.hidden = readonly;
  const reused = qaReusedAttachments
    .map(
      (file) =>
        `<li><span>${attachmentText(file)} <em>（复用附件）</em></span></li>`,
    )
    .join("");
  const selected = qaSelectedFiles
    .map(
      (file, index) =>
        `<li><span>${attachmentText(file)}${readonly ? `<small>${source}</small>` : ""}</span>${readonly ? "" : `<button type="button" data-remove-qa-file="${index}">移除</button>`}</li>`,
    )
    .join("");
  qaForm.attachmentList.innerHTML = reused + selected;
  updatePickerSummary(qaAttachmentPicker, [
    ...qaReusedAttachments,
    ...qaSelectedFiles,
  ]);
};
const canDeleteQaAttachment = (file) =>
  !currentUser().admin && file.uploaderUnit === currentUser().unit;
const renderReplyFileList = () => {
  const current = qaCurrentAttachments
    .map(
      (file) =>
        `<li><span>${attachmentText(file)} <em>（当前附件 · ${qaEsc(file.uploaderUnit || "原上传单位")}）</em></span>${canDeleteQaAttachment(file) ? `<button type="button" data-remove-current-attachment="${qaEsc(file.id || file.fingerprint || file.name)}">删除</button>` : ""}</li>`,
    )
    .join("");
  const removed = qaRemovedAttachments
    .map(
      (file) =>
        `<li><span class="removed">${attachmentText(file)} <em>（本次将删除）</em></span><button type="button" data-undo-remove-current-attachment="${qaEsc(file.id || file.fingerprint || file.name)}">撤销删除</button></li>`,
    )
    .join("");
  const added = qaReplyFiles
    .map(
      (file, index) =>
        `<li><span>${attachmentText(file)} <em>（本次新增）</em></span><button type="button" data-remove-reply-file="${index}">移除</button></li>`,
    )
    .join("");
  qaForm.replyAttachmentList.innerHTML = current + removed + added;
  updatePickerSummary(qaReplyAttachmentPicker, qaReplyFiles);
};
// 将一条工程答疑的历史回复按时间顺序显示在详情弹窗内。
const renderQaReplyHistory = (row) => {
  const replies = Array.isArray(row?.replies) ? row.replies : [];
  qaForm.replyHistory.hidden = !replies.length;
  qaForm.replyHistoryList.innerHTML = replies
    .map(
      (reply) =>
        `<article><strong>${qaEsc(reply.action || "处理意见")}</strong><br>${qaEsc(reply.content)}${reply.attachments?.length ? `<small>附件：${reply.attachments.map((file) => `${qaEsc(file.name)}（${Math.ceil((file.size || 0) / 1024)} KB）`).join("、")}</small>` : ""}${reply.attachmentChanges?.length ? `<small>附件变更：${reply.attachmentChanges.map((change) => `${qaEsc(reply.user || "")} ${qaEsc(change.type)}“${qaEsc(change.name)}”${change.type === "替换附件" ? `（原文件：${Math.ceil((change.originalSize || 0) / 1024)} KB；新文件：${Math.ceil((change.newSize || 0) / 1024)} KB）` : ""}`).join("；")}</small>` : ""}<small>${qaEsc(reply.unit || "")} · ${qaEsc(reply.user || "")} · ${qaEsc(reply.time || "")}</small><small>接收单位 / 下一节点：${qaEsc(reply.nextNode || "—")}</small></article>`,
    )
    .join("");
};
const renderQaResources = (row) => {
  if (!row) {
    qaForm.resourceBody.innerHTML = "";
    qaForm.resourceEmpty.hidden = false;
    return;
  }
  const attachmentRows = (row.attachments || []).map(
    (file) =>
      `<tr><td>附件资料</td><td>${qaEsc(file.name)}</td><td>${qaEsc(row.unit)} · ${qaEsc(row.initiator)}</td><td>${qaEsc(row.initiatedAt || row.date || "")}</td></tr>`,
  );
  const replyRows = (row.replies || []).flatMap((reply) =>
    (reply.attachments || []).map(
      (file) =>
        `<tr><td>附件资料</td><td>${qaEsc(file.name)}</td><td>${qaEsc(reply.unit)} · ${qaEsc(reply.user)}</td><td>${qaEsc(reply.time || "")}</td></tr>`,
    ),
  );
  const related = row.relatedItem
    ? `<tr><td>关联事项</td><td>${qaEsc(row.relatedItem.name)}</td><td>系统关联</td><td>${qaEsc(row.relatedItem.time)}</td></tr>`
    : "";
  qaForm.resourceBody.innerHTML = [
    ...attachmentRows,
    ...replyRows,
    related,
  ].join("");
  qaForm.resourceEmpty.hidden = Boolean(
    attachmentRows.length || replyRows.length || related,
  );
};
// 根据“新增”或“查看详情”、当前单位和流程节点，控制表单字段及操作按钮的可见性。
const setQaViewControls = (row = null) => {
  const isView = Boolean(row),
    original = [
      qaForm.contactNo,
      qaForm.discipline,
      qaForm.project,
      qaForm.location,
      qaForm.unit,
      qaForm.initiator,
      qaForm.time,
      qaForm.nextNode,
      qaForm.title,
      qaForm.description,
      qaForm.attachmentInput,
    ],
    changeInputs = [...document.querySelectorAll('[name="qaChange"]')];
  original.forEach((field) => (field.disabled = isView));
  qaForm.attachmentInput.hidden = isView;
  qaForm.replySection.hidden = true;
  qaForm.changeChoice.hidden = true;
  qaForm.replyHistory.hidden = true;
  qaForm.submit.hidden = isView;
  qaForm.confirm.hidden = true;
  qaForm.returnButton.hidden = true;
  qaForm.coordinate.hidden = true;
  qaForm.reuse.hidden = true;
  if (!isView) {
    qaForm.detailTitle.textContent = "新增工程答疑";
    qaForm.note.textContent =
      "支持图片及常用办公文件；提交后，答疑将进入“待监理确认”状态，并按工程答疑闭环流程流转。";
    return;
  }
  qaForm.detailTitle.textContent = "工程答疑详情";
  qaForm.note.textContent =
    "原始提疑信息及发起附件仅供查看；全部处理意见、附件和流转动作均留痕。";
  renderQaReplyHistory(row);
  renderQaResources(row);
  const user = currentUser(),
    canHandle =
      user.admin ||
      (user.unit === "监理单位" && row.step === "supervision") ||
      (user.unit === "设计单位" && row.step === "design") ||
      (user.unit === "施工单位" && row.step === "construction"),
    canChooseChange = row.step === "design" && canHandle;
  qaForm.changeChoice.hidden = false;
  changeInputs.forEach((input) => {
    input.disabled = !canChooseChange;
    input.checked =
      typeof row.designInvolvesChange === "boolean" &&
      row.designInvolvesChange === (input.value === "yes");
  });
  if (row.step === "returned") {
    qaForm.reuse.hidden = !(user.admin || user.unit === "施工单位");
    return;
  }
  if (!canHandle || ["done", "changed", "coordinated"].includes(row.step))
    return;
  qaForm.replySection.hidden = false;
  qaForm.replyHeading.textContent =
    row.step === "supervision"
      ? "监理确认意见"
      : row.step === "design"
        ? "设计回复意见"
        : "施工确认意见";
  qaForm.replyLabel.textContent = qaForm.replyHeading.textContent;
  if (row.step === "supervision") {
    qaForm.confirm.hidden = false;
    qaForm.confirm.textContent = "确认并流转";
    qaForm.returnButton.hidden = false;
    qaForm.returnButton.textContent = "退回施工单位";
  } else if (row.step === "design") {
    qaForm.submit.hidden = false;
    qaForm.submit.textContent = "回复并流转";
  } else {
    qaForm.confirm.hidden = false;
    qaForm.confirm.textContent = "确认归档";
    qaForm.returnButton.hidden = false;
    qaForm.returnButton.textContent = "退回设计单位";
    qaForm.coordinate.hidden = false;
  }
};
window.prepareQaForm = () => {
  const user = currentUser();
  qaViewingNo = null;
  qaSelectedFiles = [];
  qaReplyFiles = [];
  qaReusedAttachments = [];
  qaForm.contactNo.value = "";
  delete qaForm.contactNo.dataset.sourceNo;
  qaForm.discipline.value = "";
  qaForm.location.value = "";
  qaForm.title.value = "";
  qaForm.description.value = "";
  qaForm.attachmentInput.value = "";
  qaForm.replyText.value = "";
  qaForm.replyCount.textContent = "0";
  document
    .querySelectorAll('[name="qaChange"]')
    .forEach((item) => (item.checked = false));
  qaForm.project.value = currentProject;
  qaForm.unit.value = user.unit;
  qaForm.initiator.value = user.name;
  qaForm.time.value = qaTimeText(new Date());
  qaForm.nextNode.value = qaNextNode();
  setQaViewControls();
  window.syncQaCoordinationControls?.(null);
  renderQaFileList();
  renderReplyFileList();
  renderQaResources(null);
};
window.prepareQaView = (row) => {
  qaViewingNo = row.no;
  qaSelectedFiles = (row.attachments || []).map((file) => ({
    name: file.name,
    size: Number(file.size) || 0,
    lastModified: 0,
    id: file.id || file.fingerprint || `legacy-${file.name}-${file.size}`,
    fingerprint: file.fingerprint || "",
    uploaderUnit: file.uploaderUnit || row.unit,
    uploader: file.uploader || row.initiator,
  }));
  qaReusedAttachments = [];
  qaReplyFiles = [];
  qaCurrentAttachments = (row.activeAttachments || row.attachments || []).map(
    (file) => ({
      ...file,
      id: file.id || file.fingerprint || `legacy-${file.name}-${file.size}`,
      uploaderUnit: file.uploaderUnit || row.unit,
      uploader: file.uploader || row.initiator,
    }),
  );
  qaRemovedAttachments = [];
  qaForm.contactNo.value = row.contactNo || "";
  qaForm.discipline.value = row.discipline || "";
  qaForm.project.value = row.project || "";
  qaForm.location.value = row.location || "";
  qaForm.unit.value = row.unit || "";
  qaForm.initiator.value = row.initiator || row.owner || "";
  qaForm.time.value = row.initiatedAt || row.date || "";
  qaForm.nextNode.value = qaNextNodeForRow(row);
  qaForm.title.value = row.title || "";
  qaForm.description.value = row.description || "";
  qaForm.replyText.value = "";
  qaForm.replyCount.textContent = "0";
  document
    .querySelectorAll('[name="qaChange"]')
    .forEach((item) => (item.checked = false));
  setQaViewControls(row);
  window.syncQaCoordinationControls?.(row);
  renderQaFileList(true, row);
  renderReplyFileList();
};
const qaAllowedFile = /\.(jpe?g|png|gif|webp|pdf|docx?|pptx?|xlsx?)$/i;
const qaHashFile = async (file) => {
  try {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      await file.arrayBuffer(),
    );
    return `sha256-${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return `fallback-${file.name}-${file.size}-${file.lastModified}`;
  }
};
const qaAttachmentFromFile = async (file) => {
  const fingerprint = await qaHashFile(file);
  return {
    id: fingerprint,
    fingerprint,
    name: file.name,
    size: file.size,
    type: file.type || "",
    lastModified: file.lastModified,
    file,
  };
};
const appendQaFiles = async (files, target, existing = []) => {
  for (const file of [...files]) {
    if (!qaAllowedFile.test(file.name)) {
      window.alert(`不支持“${file.name}”的文件格式。`);
      continue;
    }
    const item = await qaAttachmentFromFile(file),
      duplicate = [...target, ...existing].some(
        (current) => current.fingerprint === item.fingerprint,
      );
    if (!duplicate) target.push(item);
  }
};
qaForm.attachmentInput.addEventListener("change", async () => {
  await appendQaFiles(qaForm.attachmentInput.files, qaSelectedFiles);
  qaForm.attachmentInput.value = "";
  renderQaFileList();
});
qaForm.attachmentList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-qa-file]");
  if (!button) return;
  qaSelectedFiles.splice(Number(button.dataset.removeQaFile), 1);
  renderQaFileList();
});
qaForm.replyAttachmentInput.addEventListener("change", async () => {
  await appendQaFiles(
    qaForm.replyAttachmentInput.files,
    qaReplyFiles,
    qaCurrentAttachments,
  );
  qaForm.replyAttachmentInput.value = "";
  renderReplyFileList();
});
qaForm.replyAttachmentList.addEventListener("click", (event) => {
  const removeCurrent = event.target.closest(
      "[data-remove-current-attachment]",
    ),
    undoRemove = event.target.closest("[data-undo-remove-current-attachment]"),
    removeNew = event.target.closest("[data-remove-reply-file]");
  if (removeCurrent) {
    const index = qaCurrentAttachments.findIndex(
      (file) =>
        (file.id || file.fingerprint || file.name) ===
        removeCurrent.dataset.removeCurrentAttachment,
    );
    if (index > -1 && canDeleteQaAttachment(qaCurrentAttachments[index]))
      qaRemovedAttachments.push(qaCurrentAttachments.splice(index, 1)[0]);
  } else if (undoRemove) {
    const index = qaRemovedAttachments.findIndex(
      (file) =>
        (file.id || file.fingerprint || file.name) ===
        undoRemove.dataset.undoRemoveCurrentAttachment,
    );
    if (index > -1)
      qaCurrentAttachments.push(qaRemovedAttachments.splice(index, 1)[0]);
  } else if (removeNew) {
    qaReplyFiles.splice(Number(removeNew.dataset.removeReplyFile), 1);
  } else return;
  renderReplyFileList();
});
document.querySelector("#newQaButton").addEventListener("click", () => {
  qaCurrentAttachments = [];
  qaRemovedAttachments = [];
  renderReplyFileList();
});
qaForm.replyText.addEventListener("input", () => {
  if (qaForm.replyText.value.length > 200)
    qaForm.replyText.value = qaForm.replyText.value.slice(0, 200);
  qaForm.replyCount.textContent = qaForm.replyText.value.length;
});
const persistQaAttachmentIdentity = (row) => {
  const staged = [...qaReusedAttachments, ...qaSelectedFiles];
  row.attachments = (row.attachments || []).map((file, index) => {
    const source =
      staged.find(
        (item) =>
          item.name === file.name && Number(item.size) === Number(file.size),
      ) || {};
    return {
      ...file,
      id: file.id || source.id || `legacy-${row.no}-${index}`,
      fingerprint: file.fingerprint || source.fingerprint || "",
      uploaderUnit: file.uploaderUnit || row.unit,
      uploader: file.uploader || row.initiator,
      uploadedAt: file.uploadedAt || row.initiatedAt || row.date,
    };
  });
  if (!row.activeAttachments)
    row.activeAttachments = row.attachments.map((file) => ({ ...file }));
};
const refreshQaAfterDetailAction = () => {
  if (!qaViewingNo && qaRecords[0]) persistQaAttachmentIdentity(qaRecords[0]);
  saveSharedQaRecords();
  renderQa();
  renderMatterPanel();
  window.renderQaAdmin?.();
  window.renderMeetings?.();
  closeQaDetail();
};
// 保存当前用户的处理意见、附件变更和下一流程节点到模拟记录中。
const saveQaOpinion = (row, user, action, nextNode) => {
  const content = qaForm.replyText.value.trim();
  if (!content) {
    window.alert("请输入处理意见。");
    qaForm.replyText.focus();
    return false;
  }
  row.replies = Array.isArray(row.replies) ? row.replies : [];
  const attachments = qaReplyFiles.map((file) => ({
    id: file.id || file.fingerprint,
    name: file.name,
    size: file.size,
    type: file.type || "",
    fingerprint: file.fingerprint || "",
    uploaderUnit: user.unit,
    uploader: user.name,
    uploadedAt: qaTimeText(new Date()),
  }));
  const removed = qaRemovedAttachments.map((file) => ({
    id: file.id || file.fingerprint || file.name,
    name: file.name,
    size: file.size,
    type: file.type || "",
    fingerprint: file.fingerprint || "",
    uploaderUnit: file.uploaderUnit,
    uploader: file.uploader,
  }));
  const unpairedRemoved = [...removed],
    attachmentChanges = [];
  attachments.forEach((file) => {
    const index = unpairedRemoved.findIndex(
      (old) => old.name === file.name && old.fingerprint !== file.fingerprint,
    );
    if (index > -1) {
      const original = unpairedRemoved.splice(index, 1)[0];
      attachmentChanges.push({
        type: "替换附件",
        name: file.name,
        attachmentId: file.id,
        originalName: original.name,
        originalSize: original.size,
        newSize: file.size,
        originalFingerprint: original.fingerprint,
        newFingerprint: file.fingerprint,
      });
    } else
      attachmentChanges.push({
        type: "新增附件",
        name: file.name,
        attachmentId: file.id,
      });
  });
  unpairedRemoved.forEach((file) =>
    attachmentChanges.push({
      type: "删除附件",
      name: file.name,
      attachmentId: file.id,
    }),
  );
  row.activeAttachments = [
    ...qaCurrentAttachments.map((file) => ({
      id: file.id || file.fingerprint || file.name,
      name: file.name,
      size: file.size,
      type: file.type || "",
      fingerprint: file.fingerprint || "",
      uploaderUnit: file.uploaderUnit,
      uploader: file.uploader,
      uploadedAt: file.uploadedAt,
    })),
    ...attachments,
  ];
  row.replies.push({
    action,
    content,
    unit: user.unit,
    user: user.name,
    time: qaTimeText(new Date()),
    nextNode,
    attachments,
    removedAttachments: removed,
    attachmentChanges,
  });
  return true;
};
qaForm.submit.addEventListener("click", () => {
  if (!qaFlowBypass) {
    requestQaFlowConfirmation(qaForm.submit);
    return;
  }
  const user = currentUser();
  if (qaViewingNo) {
    const row = qaRecords.find((item) => item.no === qaViewingNo);
    if (
      !row ||
      row.step !== "design" ||
      !(user.admin || user.unit === "设计单位")
    )
      return;
    const choice = document.querySelector('[name="qaChange"]:checked');
    if (!choice) {
      window.alert("请选择是否出具变更后再流转。");
      return;
    }
    const involvesChange = choice.value === "yes";
    if (
      !saveQaOpinion(
        row,
        user,
        involvesChange ? "设计回复（涉及变更）" : "设计回复（不涉及变更）",
        "施工单位 · 孙工（项目负责人）",
      )
    )
      return;
    markQaHandledBy(row, currentAccountId);
    row.designInvolvesChange = involvesChange;
    row.step = "construction";
    row.status = "待施工确认";
    markQaUnreadFor(row);
    refreshQaAfterDetailAction();
    return;
  }
  if (!(user.unit === "施工单位" || user.admin)) {
    window.alert("仅施工单位负责人或系统管理员可发起工程答疑。");
    return;
  }
  const contactNo = qaForm.contactNo.value.trim(),
    discipline = qaForm.discipline.value,
    title = qaForm.title.value.trim(),
    location = qaForm.location.value.trim(),
    description = qaForm.description.value.trim();
  if (!contactNo || !discipline || !title || !location || !description) {
    window.alert("请完整填写联系单编号、专业、位置、主题及问题说明。");
    return;
  }
  if (
    qaRecords.some(
      (row) => row.project === currentProject && row.contactNo === contactNo,
    )
  ) {
    window.alert("联系单编号已存在，请勿重复提交。");
    qaForm.contactNo.focus();
    return;
  }
  const now = new Date(),
    date = qaTimeText(now).slice(0, 10),
    sequence = String(
      qaRecords.filter((row) => row.date === date).length + 1,
    ).padStart(3, "0");
  const row = {
    no: `Q&A-${date.replaceAll("-", "")}-${sequence}`,
    contactNo,
    project: currentProject,
    title,
    discipline,
    owner: user.name,
    date,
    status: "待监理确认",
    step: "supervision",
    unit: user.unit,
    initiator: user.name,
    initiatedAt: qaForm.time.value,
    location,
    description,
    nextNode: qaForm.nextNode.value,
    sourceNo: qaForm.contactNo.dataset.sourceNo || "",
    readBy: {},
    unreadFor: {},
    handledBy: {},
    attachments: [...qaReusedAttachments, ...qaSelectedFiles].map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type || "",
    })),
    replies: [
      {
        action: "施工单位发起",
        content: description,
        unit: user.unit,
        user: user.name,
        time: qaForm.time.value,
        nextNode: qaForm.nextNode.value,
        attachments: [],
      },
    ],
  };
  markQaUnreadFor(row, "all");
  qaRecords.unshift(row);
  refreshQaAfterDetailAction();
});
qaForm.confirm.addEventListener("click", () => {
  if (!qaFlowBypass) {
    requestQaFlowConfirmation(qaForm.confirm);
    return;
  }
  const row = qaRecords.find((item) => item.no === qaViewingNo),
    user = currentUser();
  if (!row) return;
  const permitted =
    user.admin ||
    (user.unit === "监理单位" && row.step === "supervision") ||
    (user.unit === "施工单位" && row.step === "construction");
  if (!permitted) return;
  if (row.step === "supervision") {
    if (
      !saveQaOpinion(
        row,
        user,
        "监理确认并流转",
        "设计单位 · 赵工（设计单位负责人）",
      )
    )
      return;
    markQaHandledBy(row, currentAccountId);
    row.step = "design";
    row.status = "待设计确认";
    markQaUnreadFor(row);
  } else if (row.step === "construction") {
    const nextNode = row.designInvolvesChange ? "变更管理模块" : "归档";
    if (!saveQaOpinion(row, user, "施工确认归档", nextNode)) return;
    markQaHandledBy(row, currentAccountId);
    if (row.designInvolvesChange) {
      row.step = "changed";
      row.status = "出具变更";
      row.relatedItem = {
        type: "变更事项",
        name: `变更事项：${row.contactNo || row.no}`,
        time: qaTimeText(new Date()),
      };
    } else {
      row.step = "done";
      row.status = "已归档";
    }
    markQaUnreadFor(row, "all");
  }
  refreshQaAfterDetailAction();
});
qaForm.returnButton.addEventListener("click", () => {
  if (!qaFlowBypass) {
    requestQaFlowConfirmation(qaForm.returnButton);
    return;
  }
  const row = qaRecords.find((item) => item.no === qaViewingNo),
    user = currentUser();
  if (!row) return;
  const permitted =
    user.admin ||
    (user.unit === "监理单位" && row.step === "supervision") ||
    (user.unit === "设计单位" && row.step === "design") ||
    (user.unit === "施工单位" && row.step === "construction");
  if (!permitted) return;
  if (row.step === "construction") {
    if (
      !saveQaOpinion(
        row,
        user,
        "施工退回设计",
        "设计单位 · 赵工（设计单位负责人）",
      )
    )
      return;
    markQaHandledBy(row, currentAccountId);
    row.step = "design";
    row.status = "待设计确认";
    markQaUnreadFor(row);
  } else {
    if (
      !saveQaOpinion(row, user, "退回施工单位", "施工单位 · 孙工（项目负责人）")
    )
      return;
    markQaHandledBy(row, currentAccountId);
    row.step = "returned";
    row.status = "已退回施工单位";
    row.returnedAt = qaTimeText(new Date());
    row.returnedBy = `${user.unit} · ${user.name}`;
    markQaUnreadFor(row, "all");
  }
  refreshQaAfterDetailAction();
});
qaForm.coordinate.addEventListener("click", () => {
  if (!qaFlowBypass) {
    requestQaFlowConfirmation(qaForm.coordinate);
    return;
  }
  const row = qaRecords.find((item) => item.no === qaViewingNo),
    user = currentUser();
  if (
    !row ||
    !(user.admin || user.unit === "施工单位") ||
    row.step !== "construction"
  )
    return;
  if (!saveQaOpinion(row, user, "转为需业主协调", "建设单位负责人 · 会议预约")) return;
  markQaHandledBy(row, currentAccountId);
  row.step = "coordinated";
  row.status = "已转需业主协调";
  row.nextNode = "建设单位负责人 · 会议预约";
  row.relatedItem = {
    type: "需业主协调事项",
    name: `需业主协调事项：${row.contactNo || row.no}`,
    time: qaTimeText(new Date()),
  };
  markQaUnreadFor(row, "all");
  refreshQaAfterDetailAction();
});
qaForm.reuse.addEventListener("click", () => {
  const row = qaRecords.find((item) => item.no === qaViewingNo),
    user = currentUser();
  if (!row || !(user.admin || user.unit === "施工单位")) return;
  window.prepareQaForm();
  qaForm.discipline.value = row.discipline || "";
  qaForm.location.value = row.location || "";
  qaForm.title.value = row.title || "";
  qaForm.description.value = row.description || "";
  qaReusedAttachments = (row.attachments || []).map((file) => ({
    name: file.name,
    size: Number(file.size) || 0,
    type: file.type || "",
  }));
  qaForm.contactNo.dataset.sourceNo = row.no;
  qaForm.note.textContent =
    "已复用上一条答疑的基础信息与附件清单。请填写新的联系单编号后重新提交，系统将生成新的答疑流程。";
  renderQaFileList();
});
// ===== 管理员视图：只在系统管理员账号下展示的答疑后台列表 =====
const qaAdminBody = document.querySelector("#qaAdminTableBody"),
  qaAdminEmpty = document.querySelector("#qaAdminEmpty");
window.renderQaAdmin = () => {
  if (!currentUser().admin) return;
  qaAdminBody.innerHTML = qaRecords
    .map(
      (row) =>
        `<tr><td>${qaEsc(row.project)}</td><td>${qaEsc(row.contactNo)}</td><td>${qaEsc(row.title)}</td><td>${qaEsc(row.unit)} / ${qaEsc(row.initiator)}</td><td>${qaEsc(row.initiatedAt || row.date)}</td><td>${qaEsc(row.status)}</td><td><button class="qa-admin-delete" type="button" data-delete-qa="${qaEsc(row.no)}">删除</button></td></tr>`,
    )
    .join("");
  qaAdminEmpty.hidden = qaRecords.length > 0;
};
qaAdminBody.addEventListener("click", (event) => {
  const button=event.target.closest('[data-delete-qa]');
  if(button&&currentUser().admin)window.openAdminFlowDeletion?.(button.dataset.deleteQa);
});

window.syncBusinessAccess = () => {
  const changeMenu = secondaryMenu.querySelector("h2");
  if (!changeMenu || changeMenu.textContent !== "变更管理") return;
  const existed = secondaryMenu.querySelector("[data-admin-qa]");
  if (currentUser().admin && !existed) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.adminQa = "true";
    button.textContent = "答疑后台管理";
    button.addEventListener("click", () => {
      secondaryMenu
        .querySelectorAll("button")
        .forEach((item) => item.classList.toggle("active", item === button));
      setBusinessStage("变更管理", "答疑后台管理");
    });
    secondaryMenu.append(button);
  }
  if (!currentUser().admin && existed) {
    const wasOpen = !document.querySelector("#qaAdminStage").hidden;
    existed.remove();
    if (wasOpen) setBusinessStage("变更管理", "工程答疑");
  }
};
window.getQaAdvanceAction = () => "";
qaEl.body.addEventListener("click", (event) => {
  const view = event.target.closest("[data-qa-view]");
  if (!view) return;
  const row = qaRecords.find((item) => item.no === view.dataset.qaView);
  if (!row) return;
  markQaReadFor(row, currentAccountId);
  saveSharedQaRecords();
  renderQa();
  renderMatterPanel();
  window.renderQaAdmin?.();
  window.openQaDetailView?.(row);
});
window.addEventListener("storage", (event) => {
  if (event.key !== smartWorksRecordsKey) return;
  const updated = getSharedQaRecords();
  if (updated) {
    qaRecords = updated;
    renderQa();
    renderMatterPanel();
    window.renderMeetings?.();
  }
});
const syncAccountDatabase = async () => {
  if (window.smartWorksStaticDemo) return;
  try {
    const response = await fetch("/api/accounts", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    payload.accounts.forEach(
      (account) => (smartWorksUsers[account.id] = account),
    );
    const savedAccount = sessionStorage.getItem(smartWorksAccountKey);
    if (savedAccount && smartWorksUsers[savedAccount])
      currentAccountId = savedAccount;
    applyCurrentAccount(true);
  } catch {}
};
const syncQaDatabase = async () => {
  if (!qaUsesDatabase) return;
  try {
    const response = await fetch(qaDatabaseEndpoint, {
      cache: "no-store",
    });
    if (response.status === 404) {
      qaUsesDatabase = false;
      qaRecords = getSharedQaRecords() || qaRecords;
      renderQa();
      renderMatterPanel();
    window.renderMeetings?.();
      return;
    }
    if (!response.ok) return;
    const payload = await response.json();
    qaRecords = Array.isArray(payload.records) ? payload.records.map(normalizeOwnerArchivedQa) : [];
    renderQa();
    renderMatterPanel();
    window.renderMeetings?.();
    window.renderQaAdmin?.();
  } catch {}
};
applyCurrentAccount(true);
window.smartWorksAccountsReady = syncAccountDatabase();
window.smartWorksQaReady = syncQaDatabase();
migrateLegacyQaRecords();
if (qaUsesDatabase) setInterval(syncQaDatabase, 3000);
