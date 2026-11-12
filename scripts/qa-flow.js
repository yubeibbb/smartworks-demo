/* ===== 工程答疑详情弹窗的开关逻辑 ===== */
const qaDetailDialog = document.querySelector("#qaDetailDialog");
const showQaDetail = () => {
  qaDetailDialog.classList.add("show");
  qaDetailDialog.setAttribute("aria-hidden", "false");
};
const openQaDetail = () => {
  window.prepareQaForm?.();
  showQaDetail();
};
window.openQaDetailView = (row) => {
  window.prepareQaView?.(row);
  showQaDetail();
};
const closeQaDetail = () => {
  qaDetailDialog.classList.remove("show");
  qaDetailDialog.setAttribute("aria-hidden", "true");
};
document.querySelector("#newQaButton").addEventListener("click", openQaDetail);
document
  .querySelector("#qaDetailClose")
  .addEventListener("click", closeQaDetail);
document
  .querySelector("#qaDetailCancel")
  .addEventListener("click", closeQaDetail);
document.querySelectorAll("[data-qa-panel]").forEach((tab) =>
  tab.addEventListener("click", () => {
    document
      .querySelectorAll("[data-qa-panel]")
      .forEach((item) => item.classList.toggle("active", item === tab));
    document
      .querySelectorAll("[data-qa-content]")
      .forEach(
        (panel) =>
          (panel.hidden = panel.dataset.qaContent !== tab.dataset.qaPanel),
      );
  }),
);
