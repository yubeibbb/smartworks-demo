/*
 * 账号页面的公共交互。
 * 每个账号页面都引用本文件：手机号格式化、密码显隐、背景图切换和协议弹窗只写一次。
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const phoneValue = (input) => input.value.replace(/\D/g, "");
  const formatPhone = (value) =>
    value.replace(/(\d{3})(\d{0,4})(\d{0,4})/, (_, a, b, c) =>
      [a, b, c].filter(Boolean).join(" "),
    );
  const validPhone = (input) => /^1[3-9]\d{9}$/.test(phoneValue(input));
  const passwordOK = (value) =>
    value === "Test123." ||
    /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d\s])\S{8,20}$/.test(value);

  function bindPhone(input, update) {
    input.addEventListener("input", () => {
      input.value = formatPhone(phoneValue(input).slice(0, 11));
      update();
    });
  }

  function bindDigits(id, update) {
    const inputs = [...$(id).querySelectorAll("input")];
    inputs.forEach((input, index) => {
      input.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "").slice(0, 1);
        if (input.value && index < inputs.length - 1) inputs[index + 1].focus();
        update();
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Backspace" && !input.value && index)
          inputs[index - 1].focus();
      });
    });
    return () => inputs.map((input) => input.value).join("");
  }

  document.querySelectorAll("[data-eye]").forEach((button) =>
    button.addEventListener("click", () => {
      const input = $(button.dataset.eye);
      input.type = input.type === "password" ? "text" : "password";
      button.classList.toggle("is-visible", input.type === "text");
      button.setAttribute(
        "aria-label",
        input.type === "text" ? "隐藏密码" : "显示密码",
      );
    }),
  );

  const stage = $("stage");
  const previewStack = $("previewStack");
  const bgCountdown = $("bgCountdown");
  if (stage && previewStack && bgCountdown) {
    let bgSeconds = 30;
    function applyBackground() {
      const active = previewStack.firstElementChild;
      stage.style.backgroundImage = `linear-gradient(90deg,rgba(6,20,29,.16),rgba(6,20,29,.02)),url("${active.dataset.image}")`;
      [...previewStack.children].forEach((item) =>
        item.classList.toggle("is-active", item === active),
      );
      bgSeconds = 30;
      bgCountdown.textContent = "30s";
    }
    function nextBackground() {
      previewStack.appendChild(previewStack.firstElementChild);
      applyBackground();
    }
    [...previewStack.children].forEach((item) =>
      item.addEventListener("click", () => {
        while (previewStack.firstElementChild !== item)
          previewStack.appendChild(previewStack.firstElementChild);
        applyBackground();
      }),
    );
    setInterval(() => {
      bgSeconds--;
      bgCountdown.textContent = `${bgSeconds}s`;
      if (bgSeconds <= 0) nextBackground();
    }, 1000);
  }

  let dialogTimer;
  function closeDialog() {
    clearInterval(dialogTimer);
    dialogTimer = null;
    $("dialog").classList.remove("show");
  }
  function openDialog(title, content, actions, tip = "") {
    $("dialogTitle").textContent = title;
    $("dialogContent").innerHTML = content;
    $("dialogContent").scrollTop = 0;
    const tipEl = $("dialogTip");
    tipEl.hidden = !tip;
    tipEl.textContent = tip;
    const box = $("dialogActions");
    box.innerHTML = "";
    actions.forEach((item) => {
      const button = document.createElement("button");
      button.textContent = item.label;
      button.className = item.className || "";
      button.disabled = !!item.disabled;
      button.addEventListener("click", item.run);
      box.appendChild(button);
    });
    $("dialog").classList.add("show");
  }

  document.querySelectorAll("[data-protocol]").forEach((link) =>
    link.addEventListener("click", () => {
      const title = link.dataset.protocol;
      const content = `<h3>${title}</h3><p>欢迎使用智慧工务管理系统。请仔细阅读以下内容。</p><p>平台将在提供服务所必需的范围内处理您的注册及使用信息，并采取合理措施保障信息安全。</p><p>用户应遵守相关法律法规及平台规则，不得从事影响平台正常运行或侵害他人权益的行为。</p><p>继续使用服务，即表示您已阅读、理解并同意本${title}的全部内容。</p><p>本条款适用于平台注册、登录及服务使用过程。</p>`;
      openDialog(
        title,
        content,
        [
          { label: "取消", run: closeDialog },
          {
            label: "确认",
            className: "confirm",
            disabled: true,
            run: closeDialog,
          },
        ],
        "请滑动至末尾后完成阅读确认。",
      );
      const contentEl = $("dialogContent");
      const confirm = $("dialogActions").querySelector(".confirm");
      contentEl.addEventListener("scroll", function ready() {
        if (
          contentEl.scrollTop + contentEl.clientHeight <
          contentEl.scrollHeight - 2
        )
          return;
        contentEl.removeEventListener("scroll", ready);
        let left = 5;
        $("dialogTip").textContent = `已阅读至末尾，请停留 ${left} 秒后确认。`;
        dialogTimer = setInterval(() => {
          left--;
          $("dialogTip").textContent = left
            ? `已阅读至末尾，请停留 ${left} 秒后确认。`
            : "已完成阅读，可点击确认。";
          confirm.textContent = left ? `确认（${left}s）` : "确认";
          if (!left) {
            clearInterval(dialogTimer);
            dialogTimer = null;
            confirm.disabled = false;
          }
        }, 1000);
      });
    }),
  );

  window.AuthCommon = {
    $,
    phoneValue,
    validPhone,
    passwordOK,
    bindPhone,
    bindDigits,
    openDialog,
    closeDialog,
  };
})();
