/* 项目概况为当前项目的公开基础信息，所有项目单位均可查看。 */
// 两个演示项目的公开基础信息，切换项目时更新到看板卡片。
const projectOverviewData = {
  深圳湾综合体项目: {
    建设单位: "XXX有限公司",
    设计单位: "XXX有限公司",
    监理单位: "XXX有限公司",
    施工单位: "XXX有限公司",
    勘察单位: "XXX有限公司",
    计划投资: "12,000 万元",
    计划工期: "720 天",
    建筑面积: "286,500 ㎡",
    占地面积: "68,000 ㎡",
  },
  深圳国际会展中心改扩建项目: {
    建设单位: "XXX有限公司",
    设计单位: "XXX有限公司",
    监理单位: "XXX有限公司",
    施工单位: "XXX有限公司",
    勘察单位: "XXX有限公司",
    计划投资: "36,800 万元",
    计划工期: "960 天",
    建筑面积: "418,000 ㎡",
    占地面积: "125,000 ㎡",
  },
};
const renderProjectOverview = (project) => {
  const overview = projectOverviewData[project];
  if (!overview) return;
  const info = document.querySelector("#projectInfo");
  info.classList.add("project-overview-list");
  info.innerHTML = Object.entries(overview)
    .map(
      ([label, value]) =>
        `<span class="overview-item"><small>${label}</small><b title="${value}">${value}</b></span>`,
    )
    .join("");
};
const dashboardUpdateWithCameras = updateDashboard;
updateDashboard = (project) => {
  dashboardUpdateWithCameras(project);
  renderProjectOverview(project);
};
renderProjectOverview(currentProject);
projectMenu.addEventListener("click", (event) => {
  if (event.target.closest("[data-project]"))
    setTimeout(() => renderProjectOverview(currentProject), 0);
});
