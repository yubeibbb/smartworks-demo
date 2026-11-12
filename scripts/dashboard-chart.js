/* 机位画面使用事件委托，确保分屏重新渲染后仍可点击放大。 */
monitorVisual.addEventListener("click", (event) => {
  const button = event.target.closest("[data-camera-view]");
  if (button)
    openCameraFullscreen(
      cameraFor(activeCameraProject, button.dataset.cameraView),
    );
});
document.addEventListener(
  "click",
  (event) => {
    const button = event.target.closest?.("[data-camera-view]");
    if (button)
      openCameraFullscreen(
        cameraFor(activeCameraProject, button.dataset.cameraView),
      );
  },
  true,
);
