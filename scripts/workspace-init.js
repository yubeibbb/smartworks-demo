/* 当前版本仅展示项目概况与投资完成情况，移除未启用的第三张面板。 */
const chartsStack = document.querySelector(".charts-stack");
const legacyProgressCard = chartsStack.querySelectorAll(".chart-card")[2];
legacyProgressCard?.remove();
