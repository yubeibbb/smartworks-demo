// 注册页专属逻辑：验证码和注册结果均为静态演示，不会创建真实账号。
(function () {
  const { $, validPhone, passwordOK, bindPhone, bindDigits } =
    window.AuthCommon;
  const phone = $("registerPhone");
  const codeButton = $("registerCodeButton");
  const message = $("registerMessage");
  const getCode = bindDigits("registerDigits", update);
  function update() {
    codeButton.disabled = !validPhone(phone) || codeButton.dataset.wait === "1";
    $("registerButton").disabled = !(
      validPhone(phone) &&
      /^\d{4}$/.test(getCode()) &&
      $("agreement").checked
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
  $("agreement").addEventListener("change", update);
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
  $("registerButton").addEventListener("click", () => {
    message.style.color = "var(--error)";
    if (!passwordOK($("registerPassword").value))
      message.textContent = "密码格式不符合要求，请按规则设置。";
    else if ($("registerPassword").value !== $("registerConfirm").value)
      message.textContent = "两次密码不一致，请重新输入。";
    else if (getCode() !== "1535")
      message.textContent = "验证码错误或已失效，请重新获取。";
    else {
      message.style.color = "var(--blue)";
      message.textContent = "注册成功，正在进入系统。";
    }
  });
})();
