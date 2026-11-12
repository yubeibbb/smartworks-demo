/*
 * ===== 工作台基础交互 =====
 * 负责用户菜单、项目切换、快捷入口、工作台/业务栏切换与项目看板刷新。
 * querySelector 用于在 HTML 中找到指定 id 或 class 的元素，后续再改变它的文字、样式或显示状态。
 */
const implementedBusinessItems = {
  项目信息: ["项目看板"],
  AI助手: ["项目资料智能检索与问答"],
  设计管理: ["工程答疑", "会议协调", "图纸变更", "答疑后台管理"],
  变更管理: ["工程答疑", "答疑后台管理"],
  资料管理: ["资料上传", "资料管理"],
};
function isBusinessAvailable(module, item) {
  if(window.smartWorksIsAdmin)return module==='管理后台'&&(item===undefined||item==='流程管理');
  if(module==='管理后台'||item==='答疑后台管理')return false;
  const items = implementedBusinessItems[module] || [];
  return item === undefined ? items.length > 0 : items.includes(item);
}
function lockUnavailableBusiness(button, available) {
  button.disabled = !available;
  button.classList.toggle("business-locked", !available);
  if (!available) {
    button.classList.remove("active");
    button.setAttribute("aria-disabled", "true");
    button.title = "暂未开放";
  }
}
// Match the public second-level business pages; do not expose nested actions.
const shortcutCatalog = [
  {label:'项目看板',module:'项目信息',item:'项目看板',selected:true},
  {label:'项目资料智能检索与问答',module:'AI助手',item:'项目资料智能检索与问答'},
  {label:'工程答疑',module:'设计管理',item:'工程答疑',selected:true},
  {label:'会议协调',module:'设计管理',item:'会议协调',selected:true},
  {label:'图纸变更',module:'设计管理',item:'图纸变更',selected:true},
  {label:'资料上传',module:'资料管理',item:'资料上传'},
  {label:'资料管理',module:'资料管理',item:'资料管理'},
].filter(shortcut=>isBusinessAvailable(shortcut.module,shortcut.item));
document.querySelector('#shortcutOptions').innerHTML=shortcutCatalog.map(shortcut=>`<button class="shortcut-option${shortcut.selected?' selected':''}" type="button" title="${shortcut.label}">${shortcut.label}</button>`).join('');
try {
  const saved=JSON.parse(localStorage.getItem('smartworks-shortcuts-v1')||'null');
  if(Array.isArray(saved)){const aliases={'我的会议':'会议协调','AI资料问答':'项目资料智能检索与问答'};const labels=saved.map(label=>aliases[label]||label);document.querySelectorAll('#shortcutOptions .shortcut-option').forEach(option=>option.classList.toggle('selected',labels.includes(option.textContent.trim())));}
} catch {}
const tabs = document.querySelectorAll(".tab"),
  matters = document.querySelectorAll(".matter"),
  menuButton = document.querySelector("#userMenuButton"),
  popover = document.querySelector("#userPopover"),
  projectButton = document.querySelector("#projectButton"),
  projectMenu = document.querySelector("#projectMenu"),
  projectName = document.querySelector("#projectName"),
  profileName = document.querySelector("#profileName"),
  profileRole = document.querySelector("#profileRole"),
  profileAvatar = document.querySelector("#profileAvatar"),
  customButton = document.querySelector("#customButton"),
  dialog = document.querySelector("#shortcutDialog"),
  options = [...document.querySelectorAll(".shortcut-option")],
  quickList = document.querySelector("#quickList"),
  areaSwitch = document.querySelector("#areaSwitch"),
  workbenchButton = document.querySelector("#workbenchButton"),
  businessButton = document.querySelector("#businessButton"),
  workbenchContent = document.querySelector("#workbenchContent"),
  businessContent = document.querySelector("#businessContent"),
  primaryMenus = document.querySelectorAll(".primary-menu button"),
  secondaryMenu = document.querySelector("#secondaryMenu"),
  monitorTime = document.querySelector("#monitorTime") || {
    textContent: "",
  };
// 两个演示项目的看板数据；没有请求后端，切换项目时直接读取这里的模拟数据。
const dashboardData = {
  深圳湾综合体项目: {
    camera: "摄像头 01",
    location: "深圳湾综合体项目 · 主施工区",
    image: "素材/现场实时监控-施工鸟瞰图.png",
    status: "建设中",
    owner: "深圳市建设发展有限公司",
    phase: "主体施工",
    total: "12,000",
    used: "7,560",
    rate: "63%",
    schedule: "按专业 · 计划工期 720 天",
    investments: [35, 48, 42, 65, 56, 79, 72, 91],
    disciplines: [
      ["土建", 100, 76, "#d3182c"],
      ["机电", 78, 64, "#e45a69"],
      ["幕墙", 61, 82, "#258bd3"],
      ["装饰", 46, 53, "#bf7b20"],
      ["园林", 35, 38, "#3e9b63"],
    ],
  },
  深圳国际会展中心改扩建项目: {
    camera: "摄像头 03",
    location: "深圳国际会展中心改扩建项目 · 北区场馆",
    image: "素材/会展中心改扩建现场监控.png",
    status: "建设中",
    owner: "深圳市国际会展中心有限公司",
    phase: "钢结构施工",
    total: "36,800",
    used: "14,720",
    rate: "40%",
    schedule: "按专业 · 计划工期 960 天",
    investments: [18, 24, 29, 36, 43, 51, 58, 66],
    disciplines: [
      ["桩基", 100, 100, "#d3182c"],
      ["主体", 84, 52, "#e45a69"],
      ["钢结构", 72, 41, "#258bd3"],
      ["机电", 43, 18, "#bf7b20"],
      ["幕墙", 18, 6, "#3e9b63"],
    ],
  },
};
// 根据项目名称，把项目数据写回监控卡片、统计数字、柱状图和专业进度条。
function updateDashboard(project) {
  const data = dashboardData[project];
  if (!data) return;
  document.querySelector("#cameraNumber").textContent = data.camera;
  document.querySelector("#cameraLocation").textContent = data.location;
  document.querySelector("#monitorVisual").style.backgroundImage =
    `url('${data.image}')`;
  document.querySelector("#projectStatus").textContent = data.status;
  document.querySelector("#dashboardProjectName").textContent = project;
  document.querySelector("#projectInfo").innerHTML =
    `建设单位：${data.owner}<br>项目阶段：${data.phase}`;
  document.querySelector("#investmentTotal").textContent = data.total;
  document.querySelector("#investmentUsed").textContent = data.used;
  document.querySelector("#investmentRate").textContent = data.rate;
  const progressSchedule = document.querySelector("#progressSchedule");
  if (progressSchedule) progressSchedule.textContent = data.schedule;
  document
    .querySelector("#investmentChart")
    .querySelectorAll(".bar")
    .forEach(
      (bar, index) => (bar.style.height = `${data.investments[index]}%`),
    );
  const progressPanel = document.querySelector("#disciplineProgress");
  if (progressPanel)
    progressPanel.innerHTML = data.disciplines
      .map(
        ([name, investment, complete, color]) =>
          `<div class="discipline"><span class="discipline-bar" style="--investment:${investment}%;--complete:${complete}%;--bar-color:${color}"><b data-rate="${complete}%"></b></span><span>${name}</span></div>`,
      )
      .join("");
}
// 事项面板页签：按 data-filter 属性筛选当前显示的事项。
tabs.forEach((tab) =>
  tab.addEventListener("click", () => {
    tabs.forEach((x) => x.classList.toggle("active", x === tab));
    matters.forEach(
      (matter) =>
        (matter.style.display =
          tab.dataset.filter === "all" ||
          tab.dataset.filter === matter.dataset.kind
            ? "grid"
            : "none"),
    );
  }),
);
// 用户头像、项目选择和快捷入口弹窗的打开/关闭交互。
menuButton.addEventListener("click", (event) => {
  event.stopPropagation();
  const open = popover.classList.toggle("show");
  menuButton.setAttribute("aria-expanded", open);
});
projectButton.addEventListener("click", (event) => {
  event.stopPropagation();
  projectMenu.classList.toggle("show");
});
document.addEventListener("click", () => {
  popover.classList.remove("show");
  projectMenu.classList.remove("show");
  menuButton.setAttribute("aria-expanded", "false");
});
popover.addEventListener("click", (event) => event.stopPropagation());
customButton.addEventListener("click", () => dialog.classList.add("show"));
quickList.addEventListener('click',event=>{
  const button=event.target.closest('button');
  const shortcut=shortcutCatalog.find(item=>item.label===button?.textContent.trim());
  if(!shortcut||!isBusinessAvailable(shortcut.module,shortcut.item))return;
  switchArea('business');openBusinessDirectory(shortcut.module,shortcut.item);
});
document
  .querySelector("#dialogClose")
  .addEventListener("click", () => dialog.classList.remove("show"));
document
  .querySelector("#dialogCancel")
  .addEventListener("click", () => dialog.classList.remove("show"));
options.forEach(item=>item.addEventListener('click',()=>item.classList.toggle('selected')));
function renderQuickShortcuts() {
  quickList.innerHTML=options.filter(item=>item.classList.contains('selected')).map(item=>'<button type="button" title="'+item.textContent+'">'+item.textContent+'</button>').join('')+'<button class="custom" id="customButton" type="button">自定义</button>';
  quickList.querySelector('#customButton').addEventListener('click',()=>dialog.classList.add('show'));
}
renderQuickShortcuts();
document.querySelector('#dialogConfirm').addEventListener('click',()=>{
  renderQuickShortcuts();
  try {localStorage.setItem('smartworks-shortcuts-v1',JSON.stringify(options.filter(item=>item.classList.contains('selected')).map(item=>item.textContent.trim())));} catch {}
  dialog.classList.remove('show');
});
// 在“工作台”和“业务栏”两种主区域间切换显示状态。
function switchArea(target) {
  if(window.smartWorksIsAdmin)target='business';
  const isBusiness = target === "business";
  areaSwitch.classList.toggle("business-mode", isBusiness);
  workbenchButton.classList.toggle("active", !isBusiness);
  workbenchButton.classList.toggle("compact", isBusiness);
  businessButton.classList.toggle("active", isBusiness);
  businessButton.classList.toggle("compact", !isBusiness);
  workbenchContent.style.display = isBusiness ? "none" : "grid";
  businessContent.classList.toggle("show", isBusiness);
}
// 根据当前一级菜单和二级菜单，决定右侧显示项目看板、工程答疑或后台管理。
function setBusinessStage(module, item = "") {
  if (!isBusinessAvailable(module, item)) return;
  const isDashboard = module === "项目信息" && item === "项目看板",
    isQa = module === "变更管理" && item === "工程答疑",
    isQaAdmin = module === "变更管理" && item === "答疑后台管理",
    isAiAssistant = module === "AI助手" && item === "项目资料智能检索与问答",
    isMaterialUpload = module === "资料管理" && item === "资料上传",
    isMaterialLibrary = module === "资料管理" && item === "资料管理";
  document.querySelector(".open-tabs").innerHTML = isQa
    ? '<button class="open-tab active" data-module="变更管理" data-item="工程答疑" type="button">工程答疑<i class="tab-close" aria-hidden="true">×</i></button>'
    : isQaAdmin
      ? '<button class="open-tab active" data-module="变更管理" data-item="答疑后台管理" type="button">答疑后台管理<i class="tab-close" aria-hidden="true">×</i></button>'
      : "";
  document.querySelector("#projectDashboard").hidden = !isDashboard;
  document.querySelector("#qaStage").hidden = !isQa;
  document.querySelector("#qaAdminStage").hidden = !isQaAdmin;
  document.querySelector("#aiAssistantStage").hidden = !isAiAssistant;
  document.querySelector("#materialUploadStage").hidden = !isMaterialUpload;
  document.querySelector("#materialLibraryStage").hidden = !isMaterialLibrary;
  document.querySelector(".business-head p").textContent =
    isAiAssistant
      ? "当前页面：AI 助手 · 项目资料智能检索与问答"
      : isMaterialUpload
        ? "当前页面：资料管理 · 资料上传"
        : isMaterialLibrary
          ? "当前页面：资料管理 · 资料管理"
        : `当前页面：${module}${item ? ` · ${item}` : ""}`;
  const meetingStage = document.querySelector("#meetingStage");
  if (meetingStage) meetingStage.hidden = !(module === "设计管理" && item === "会议协调");
  if (module === "设计管理" && item === "会议协调") window.renderMeetings?.();
  const drawingStage = document.querySelector('#drawingChangeStage');
  if (drawingStage) drawingStage.hidden = !(module === '设计管理' && item === '图纸变更');
  if (module === '设计管理' && item === '图纸变更') window.renderDrawingChanges?.();
  if (isQaAdmin) window.renderQaAdmin?.();
  document
    .querySelectorAll(".open-tab")
    .forEach((tab) =>
      tab.addEventListener("click", () =>
        setBusinessStage(tab.dataset.module, tab.dataset.item),
      ),
    );
}
// 给运行时生成的二级菜单按钮绑定点击事件。
function bindSecondaryMenu(module) {
  secondaryMenu.querySelectorAll("button").forEach((button) => {
    lockUnavailableBusiness(button, isBusinessAvailable(module, button.textContent.trim()));
    if (button.disabled) return;
    button.addEventListener("click", () => {
      secondaryMenu
        .querySelectorAll("button")
        .forEach((item) => item.classList.toggle("active", item === button));
      setBusinessStage(module, button.textContent);
    });
  });
}
// 点击一级菜单后，生成对应的二级菜单并默认打开第一个可用页面。
function openBusinessModule(module) {
  if (!isBusinessAvailable(module)) return;
  primaryMenus.forEach((item) =>
    item.classList.toggle("active", item.dataset.module === module),
  );
  if (module === "项目信息") {
    secondaryMenu.innerHTML =
      '<h2>项目信息</h2><button class="active" type="button">项目看板</button>';
    setBusinessStage(module, "项目看板");
  } else if (module === "变更管理") {
    secondaryMenu.innerHTML =
      '<h2>变更管理</h2><button class="active" type="button">工程答疑</button>';
    window.syncBusinessAccess?.(module);
    setBusinessStage(module, "工程答疑");
  } else if (module === "AI助手") {
    secondaryMenu.innerHTML =
      '<h2>AI 助手</h2><button class="active" type="button">项目资料智能检索与问答</button>';
    setBusinessStage(module, "项目资料智能检索与问答");
  } else if (module === "资料管理") {
    secondaryMenu.innerHTML =
      '<h2>资料管理</h2><button class="active" type="button">资料上传</button><button type="button">资料管理</button>';
    setBusinessStage(module, "资料上传");
  } else {
    secondaryMenu.innerHTML = `<h2>${module}</h2><p class="empty-sub">该业务功能暂未配置</p>`;
    setBusinessStage(module);
  }
  bindSecondaryMenu(module);
}
workbenchButton.addEventListener("click", () => switchArea("workbench"));
businessButton.addEventListener("click", () => switchArea("business"));
primaryMenus.forEach((button) =>
  button.addEventListener("click", () =>
    openBusinessModule(button.dataset.module),
  ),
);
primaryMenus.forEach((button) => lockUnavailableBusiness(button, isBusinessAvailable(button.dataset.module)));
openBusinessModule("项目信息");
// 每秒更新监控画面右下角的模拟时间。
function updateMonitorTime() {
  const now = new Date();
  monitorTime.textContent = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
}
updateMonitorTime();
setInterval(updateMonitorTime, 1000);
