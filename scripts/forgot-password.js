// 忘记密码页：手机与验证码正确后，跳转到独立的重置密码页面。
(function () {
  const { $, validPhone, bindPhone, bindDigits, openDialog, closeDialog } =
    window.AuthCommon;
  const phone = $("recoverPhone");
  const codeButton = $("recoverCodeButton");
  const message = $("recoverMessage");
  const getCode = bindDigits("recoverDigits", update);
  function update() {
    codeButton.disabled = !validPhone(phone) || codeButton.dataset.wait === "1";
    $("nextButton").disabled = !(
      validPhone(phone) && /^\d{4}$/.test(getCode())
    );
  }
  function setCountdown() {
    let seconds = 59;
    codeButton.disabled = true;
    codeButton.textContent = `再次获取（${seconds}s）`;
    const timer = setInterval(() => {
      seconds--;
      codeButton.textContent = `再次获取（${seconds}s）`;
      if (!seconds) {
        clearInterval(timer);
        codeButton.disabled = false;
        codeButton.textContent = "再次获取";
      }
    }, 1000);
  }
  bindPhone(phone, update);
  codeButton.addEventListener("click", () => {
    if (!validPhone(phone)) return;
    codeButton.dataset.wait = "1";
    setCountdown();
    message.style.color = "var(--blue)";
    message.textContent = "验证码已发送，1分钟内有效。";
    setTimeout(() => {
      codeButton.dataset.wait = "";
      update();
    }, 59000);
  });
  $("nextButton").addEventListener("click", () => {
    if (getCode() === "1535") {
      window.location.href = "reset-password.html";
      return;
    }
    openDialog("提示", "短信验证码错误，请重新输入。", [
      { label: "确定", className: "confirm", run: closeDialog },
    ]);
  });
})();
