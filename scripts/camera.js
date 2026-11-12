/*
 * ===== 最终业务栏目录 =====
 * 按已确认的信息架构渲染；既有看板和工程答疑只调整入口位置。
 * 业务目录写在下面的对象中，之后新增菜单时优先从这里开始看。
 */
const businessDirectory = {
  项目信息: ["项目看板"],
  AI助手: ["项目资料智能检索与问答"],
  规划报建: ["报批报建管理"],
  设计管理: ["工程答疑", "会议协调", "图纸变更"],
  现场管理: ["进度管理", "质量管理", "安全管理"],
  招采管理: ["招标管理", "造价管理", "合同管理"],
  资料管理: ["资料上传", "资料管理"],
  BIM管理: [],
};
const directoryHead = document.querySelector(".business-head p");
const showDirectoryStage = (module, item = "") => {
  if(window.smartWorksIsAdmin){window.openAdminWorkspace?.();return;}
  if (!isBusinessAvailable(module, item)) return;
  const isDashboard = module === "项目信息" && item === "项目看板";
  const isAiAssistant =
    module === "AI助手" && item === "项目资料智能检索与问答";
  const isQa = module === "设计管理" && item === "工程答疑";
  const isQaAdmin = module === "设计管理" && item === "答疑后台管理";
  const isMaterialUpload = module === "资料管理" && item === "资料上传";
  const isMaterialLibrary = module === "资料管理" && item === "资料管理";
  document.querySelector("#projectDashboard").hidden = !isDashboard;
  document.querySelector("#aiAssistantStage").hidden = !isAiAssistant;
  document.querySelector("#qaStage").hidden = !isQa;
  document.querySelector("#qaAdminStage").hidden = !isQaAdmin;
  document.querySelector("#materialUploadStage").hidden = !isMaterialUpload;
  document.querySelector("#materialLibraryStage").hidden = !isMaterialLibrary;
  const meetingStage = document.querySelector("#meetingStage");
  if (meetingStage) meetingStage.hidden = !(module === "设计管理" && item === "会议协调");
  if (module === "设计管理" && item === "会议协调") window.renderMeetings?.();
  const drawingStage = document.querySelector('#drawingChangeStage');
  const adminStage=document.querySelector('#adminWorkspaceStage');if(adminStage)adminStage.hidden=true;
  if (drawingStage) drawingStage.hidden = !(module === '设计管理' && item === '图纸变更');
  if (module === '设计管理' && item === '图纸变更') window.renderDrawingChanges?.();
  if (isQaAdmin) window.renderQaAdmin?.();
  document.querySelector(".open-tabs").innerHTML = isQa
    ? '<button class="open-tab active" type="button">工程答疑<i class="tab-close" aria-hidden="true">×</i></button>'
    : isQaAdmin
      ? '<button class="open-tab active" type="button">答疑后台管理<i class="tab-close" aria-hidden="true">×</i></button>'
      : "";
  directoryHead.textContent = `当前页面：${module}${item ? ` · ${item}` : ""}`;
};
const openBusinessDirectory = (module, item) => {
  if(window.smartWorksIsAdmin){window.openAdminWorkspace?.();return;}
  if (!isBusinessAvailable(module) || (item !== undefined && !isBusinessAvailable(module, item))) return;
  primaryMenus.forEach((button) =>
    button.classList.toggle("active", button.dataset.module === module),
  );
  const items = businessDirectory[module] || [];
  const selected = item === undefined ? items[0] || "" : item;
  secondaryMenu.innerHTML = `<h2>${module}</h2>${items.map((name, index) => `<button class="${name === selected ? "active" : ""}" data-directory-item="${name}" type="button">${name}</button>`).join("")}`;
  if (module === "设计管理" && currentUser?.().admin) {
    const adminButton = document.createElement("button");
    adminButton.type = "button";
    adminButton.dataset.directoryItem = "答疑后台管理";
    adminButton.textContent = "答疑后台管理";
    adminButton.classList.toggle("active", selected === "答疑后台管理");
    secondaryMenu.append(adminButton);
  }
  secondaryMenu
    .querySelectorAll("[data-directory-item]")
    .forEach((button) => lockUnavailableBusiness(button, isBusinessAvailable(module, button.dataset.directoryItem)));
  secondaryMenu
    .querySelectorAll("[data-directory-item]:not(:disabled)")
    .forEach((button) =>
      button.addEventListener("click", () =>
        openBusinessDirectory(module, button.dataset.directoryItem),
      ),
    );
  showDirectoryStage(module, selected);
};
primaryMenus.forEach((button) =>
  button.addEventListener("click", () =>
    openBusinessDirectory(button.dataset.module),
  ),
);
window.syncBusinessAccess = () => {
  if(window.smartWorksIsAdmin){window.syncAdminWorkspace?.();return;}
  if (secondaryMenu.querySelector("h2")?.textContent !== "设计管理") return;
  const activeItem =
    secondaryMenu.querySelector("button.active")?.dataset.directoryItem;
  openBusinessDirectory(
    "设计管理",
    activeItem === "答疑后台管理" && !currentUser().admin
      ? "工程答疑"
      : activeItem,
  );
};
openBusinessDirectory("项目信息");
