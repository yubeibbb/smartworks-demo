(() => {
  const popover = document.querySelector("#userPopover");
  if (!popover) return;
  const backToLogin = () => {
    sessionStorage.removeItem("smartWorksUser");
    window.location.href = "智慧工务管理系统.html";
  };
  popover
    .querySelector('[data-account-action="settings"]')
    ?.addEventListener("click", () => {
      popover.classList.remove("show");
      document.querySelector("#userMenuButton")?.setAttribute("aria-expanded", "false");
      document.dispatchEvent(new CustomEvent("smartworks:settings"));
    });
  popover
    .querySelector('[data-account-action="ai-settings"]')
    ?.addEventListener("click", () => {
      popover.classList.remove("show");
      document.querySelector("#userMenuButton")?.setAttribute("aria-expanded", "false");
      document.dispatchEvent(new CustomEvent("smartworks:ai-settings"));
    });
  popover
    .querySelector('[data-account-action="switch"]')
    ?.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent("smartworks:switch-account"));
    });
  popover
    .querySelector('[data-account-action="logout"]')
    ?.addEventListener("click", () => {
      if (window.confirm("确认退出当前账号吗？")) backToLogin();
    });
})();
