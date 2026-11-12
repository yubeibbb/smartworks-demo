const viewAllMonitors = document.querySelector("#viewAllMonitors");
/* 未开发的一级业务仍保留三栏骨架，仅在最右侧显示待开发内容。 */
const businessPlaceholder = document.querySelector("#businessPlaceholder");
const businessDashboard = document.querySelector("#projectDashboard");
const businessQa = document.querySelector("#qaStage");
const businessQaAdmin = document.querySelector("#qaAdminStage");
const updateBusinessPlaceholder = () => {
  if (!businessPlaceholder) return;
  businessPlaceholder.hidden =
    !businessDashboard.hidden || !businessQa.hidden || !businessQaAdmin.hidden;
};
new MutationObserver(updateBusinessPlaceholder).observe(businessDashboard, {
  attributes: true,
  attributeFilter: ["hidden"],
});
new MutationObserver(updateBusinessPlaceholder).observe(businessQa, {
  attributes: true,
  attributeFilter: ["hidden"],
});
new MutationObserver(updateBusinessPlaceholder).observe(businessQaAdmin, {
  attributes: true,
  attributeFilter: ["hidden"],
});
updateBusinessPlaceholder();
