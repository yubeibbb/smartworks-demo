/* 项目看板监控：当前项目的所有单位均可查看，仅提供画面选择与查看，不改变项目数据。 */
// 每个项目可选择的模拟摄像头和对应本地图片资源。
const projectCameraCatalog = {
  深圳湾综合体项目: [
    {
      id: "sz-main",
      name: "主施工区",
      main: true,
      online: true,
      image: "素材/现场实时监控-施工鸟瞰图.png",
    },
    {
      id: "sz-north",
      name: "北侧机位",
      online: true,
      image: "网页素材/机位图/深圳湾-北侧机位.png",
    },
    {
      id: "sz-southwest",
      name: "西南入口机位",
      online: true,
      image: "网页素材/机位图/深圳湾-西南机位.png",
    },
    {
      id: "sz-east",
      name: "东侧材料区机位",
      online: true,
      image: "网页素材/机位图/深圳湾-东侧机位.png",
    },
    { id: "sz-offline", name: "南侧出入口机位", online: false },
  ],
  深圳国际会展中心改扩建项目: [
    {
      id: "szicec-main",
      name: "主机位 · 北区场馆",
      main: true,
      online: true,
      image: "素材/会展中心改扩建现场监控.png",
    },
    {
      id: "szicec-north",
      name: "北广场机位",
      online: true,
      image: "网页素材/机位图/会展中心-北广场机位.png",
    },
    {
      id: "szicec-east",
      name: "东侧服务道路机位",
      online: true,
      image: "网页素材/机位图/会展中心-东侧机位.png",
    },
    { id: "szicec-offline", name: "南侧施工区机位", online: false },
  ],
};
const projectCameraSelections = {};
let activeCameraProject = currentProject;
const monitorVisual = document.querySelector("#monitorVisual");
const cameraTime = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
};
const cameraFor = (project, id) =>
  projectCameraCatalog[project]?.find((camera) => camera.id === id);
const cameraTile = (camera) =>
  camera.online
    ? `<button class="camera-tile" type="button" data-camera-view="${camera.id}" onclick="window.smartWorksOpenCameraFullscreen('${camera.id}')" style="background-image:url('${camera.image}')"><span class="tile-name">${camera.name}${camera.main ? '<em class="main-camera-tag">主机位</em>' : ""}</span><span class="tile-status online">● 在线</span><time class="tile-time">${cameraTime()}</time></button>`
    : `<div class="camera-tile offline"><span class="tile-name">${camera.name}</span><span class="tile-status offline">● 离线</span><span class="offline-copy">机位离线<small>暂未获取现场画面</small></span></div>`;
const renderProjectCameras = (project = currentProject) => {
  activeCameraProject = project;
  const catalog = projectCameraCatalog[project] || [];
  if (!projectCameraSelections[project])
    projectCameraSelections[project] = [
      catalog.find((camera) => camera.main)?.id,
    ].filter(Boolean);
  const selected = projectCameraSelections[project]
    .map((id) => cameraFor(project, id))
    .filter(Boolean);
  monitorVisual.classList.add("camera-grid");
  monitorVisual.dataset.count = String(Math.max(selected.length, 1));
  monitorVisual.innerHTML =
    '<span class="camera-id" id="cameraLocation" hidden></span><time class="monitor-time" id="monitorTime" hidden></time>' +
    selected.map(cameraTile).join("");
  document.querySelector("#cameraNumber").textContent =
    selected.length === 1
      ? `${selected[0].online ? "在线" : "离线"} ${selected[0].name}`
      : `已选 ${selected.length} 个机位`;
  monitorVisual
    .querySelectorAll("[data-camera-view]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        openCameraFullscreen(cameraFor(project, button.dataset.cameraView)),
      ),
    );
};
document.body.insertAdjacentHTML(
  "beforeend",
  '<section class="camera-dialog" id="cameraDialog" aria-hidden="true"><div class="camera-dialog-card" role="dialog" aria-modal="true" aria-labelledby="cameraDialogTitle"><header class="camera-dialog-header"><div><h2 id="cameraDialogTitle">选择工地机位</h2><p id="cameraDialogProject"></p></div><button class="camera-close" id="cameraDialogClose" type="button" aria-label="关闭">×</button></header><div class="camera-options" id="cameraOptions"></div><footer class="camera-dialog-footer"><span class="camera-selection-tip" id="cameraSelectionTip">最多选择 4 个机位</span><div class="camera-actions"><button class="camera-cancel" id="cameraDialogCancel" type="button">取消</button><button class="camera-confirm" id="cameraDialogConfirm" type="button">确认选择</button></div></footer></div></section><section class="camera-fullscreen" id="cameraFullscreen" aria-hidden="true"><div class="camera-fullscreen-card"><button class="camera-fullscreen-close" id="cameraFullscreenClose" type="button" aria-label="关闭放大画面">×</button><span class="camera-fullscreen-name" id="cameraFullscreenName"></span><img id="cameraFullscreenImage" alt="放大的工地机位画面"></div></section>',
);
const cameraDialog = document.querySelector("#cameraDialog"),
  cameraOptions = document.querySelector("#cameraOptions"),
  cameraSelectionTip = document.querySelector("#cameraSelectionTip"),
  cameraFullscreen = document.querySelector("#cameraFullscreen");
let pendingCameraSelection = [];
const renderCameraOptions = () => {
  const catalog = projectCameraCatalog[activeCameraProject] || [];
  cameraOptions.innerHTML = catalog
    .map(
      (camera) =>
        `<label class="camera-option"><input type="checkbox" value="${camera.id}" ${pendingCameraSelection.includes(camera.id) ? "checked" : ""}><span><b>${camera.name}${camera.main ? '<em class="main-camera-tag">主机位</em>' : ""}</b><small>${camera.online ? "现场画面可查看" : "当前机位暂无画面"}</small></span><span class="camera-state ${camera.online ? "online" : "offline"}">● ${camera.online ? "在线" : "离线"}</span></label>`,
    )
    .join("");
  cameraOptions.querySelectorAll("input").forEach((input) =>
    input.addEventListener("change", () => {
      const chosen = [...cameraOptions.querySelectorAll("input:checked")].map(
        (item) => item.value,
      );
      if (chosen.length > 4) {
        input.checked = false;
        cameraSelectionTip.textContent = "最多只能选择 4 个机位";
        cameraSelectionTip.classList.add("error");
        return;
      }
      pendingCameraSelection = chosen;
      cameraSelectionTip.textContent = `已选择 ${chosen.length} 个机位，最多 4 个`;
      cameraSelectionTip.classList.remove("error");
    }),
  );
};
const openCameraDialog = () => {
  activeCameraProject = currentProject;
  pendingCameraSelection = [
    ...(projectCameraSelections[activeCameraProject] || []),
  ];
  document.querySelector("#cameraDialogProject").textContent =
    activeCameraProject;
  cameraSelectionTip.textContent = `已选择 ${pendingCameraSelection.length} 个机位，最多 4 个`;
  cameraSelectionTip.classList.remove("error");
  renderCameraOptions();
  cameraDialog.classList.add("show");
  cameraDialog.setAttribute("aria-hidden", "false");
};
const closeCameraDialog = () => {
  cameraDialog.classList.remove("show");
  cameraDialog.setAttribute("aria-hidden", "true");
};
const openCameraFullscreen = (camera) => {
  if (!camera?.online) return;
  document.querySelector("#cameraFullscreenName").textContent = camera.name;
  document.querySelector("#cameraFullscreenImage").src = camera.image;
  cameraFullscreen.classList.add("show");
  cameraFullscreen.setAttribute("aria-hidden", "false");
};
const closeCameraFullscreen = () => {
  cameraFullscreen.classList.remove("show");
  cameraFullscreen.setAttribute("aria-hidden", "true");
};
window.smartWorksOpenCameraFullscreen = (id) =>
  openCameraFullscreen(cameraFor(activeCameraProject, id));
viewAllMonitors.textContent = "选择监控机位";
viewAllMonitors.addEventListener("click", openCameraDialog);
document
  .querySelector("#cameraDialogClose")
  .addEventListener("click", closeCameraDialog);
document
  .querySelector("#cameraDialogCancel")
  .addEventListener("click", closeCameraDialog);
document.querySelector("#cameraDialogConfirm").addEventListener("click", () => {
  if (!pendingCameraSelection.length) {
    cameraSelectionTip.textContent = "请至少选择一个机位";
    cameraSelectionTip.classList.add("error");
    return;
  }
  projectCameraSelections[activeCameraProject] = pendingCameraSelection;
  renderProjectCameras(activeCameraProject);
  closeCameraDialog();
});
document
  .querySelector("#cameraFullscreenClose")
  .addEventListener("click", closeCameraFullscreen);


const originalUpdateDashboard = updateDashboard;
updateDashboard = (project) => {
  originalUpdateDashboard(project);
  renderProjectCameras(project);
};
renderProjectCameras(currentProject);
