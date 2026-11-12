// 重置密码页：校验通过后提示用户返回登录页；不修改真实密码。
(function () {
  const { $, passwordOK, openDialog, closeDialog } = window.AuthCommon;
  const password = $("resetPassword");
  const confirm = $("resetConfirm");
  const button = $("resetButton");
  const message = $("resetMessage");
  function update() {
    const a = password.value;
    const b = confirm.value;
    button.disabled = !(passwordOK(a) && a === b);
    if (!a && !b) message.textContent = "";
    else if (a && !passwordOK(a))
      message.textContent = "密码格式不符合要求，请按规则设置。";
    else if (b && a !== b) message.textContent = "两次密码不一致，请重新输入。";
    else message.textContent = "";
  }
  password.addEventListener("input", update);
  confirm.addEventListener("input", update);
  update();
  button.addEventListener("click", () => {
    if (!passwordOK(password.value) || password.value !== confirm.value) return;
    openDialog("重置成功", "重置密码成功，是否返回主界面？", [
      { label: "否", className: "return-choice", run: closeDialog },
      {
        label: "是",
        className: "confirm return-choice",
        run: () => {
          closeDialog();
          window.location.href = "index.html";
        },
      },
    ]);
  });
})();
