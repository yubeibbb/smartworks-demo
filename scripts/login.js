// 登录页专属逻辑：只校验演示账号，然后进入工作区。
(function () {
  const { $, phoneValue, validPhone, bindPhone } = window.AuthCommon;
  const loginPhone = $("loginPhone");
  const loginPassword = $("loginPassword");
  function updateLogin() {
    $("loginButton").disabled = !(
      validPhone(loginPhone) && loginPassword.value.length >= 6
    );
  }
  bindPhone(loginPhone, updateLogin);
  loginPassword.addEventListener("input", updateLogin);
  $("loginButton").addEventListener("click", () => {
    if (
      phoneValue(loginPhone) === "19923456789" &&
      loginPassword.value === "Test123."
    ) {
      $("loginMessage").style.color = "var(--blue)";
      $("loginMessage").textContent = "登录成功，正在进入系统。";
      window.location.href = "系统工作区.html";
      return;
    }
    $("loginMessage").style.color = "var(--error)";
    $("loginMessage").textContent = "账号或密码不正确，请重新输入。";
  });
})();
