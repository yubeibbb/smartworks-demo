/* 分屏画面的独立放大入口，避免画面重绘后丢失点击行为。 */
(() => {
  const openTile = (tile) => {
    if (!tile || tile.classList.contains("offline")) return;
    const layer = document.querySelector("#cameraFullscreen"),
      image = layer.querySelector("img"),
      name = layer.querySelector("#cameraFullscreenName"),
      background = tile.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
    if (!background) return;
    name.textContent =
      tile.querySelector(".tile-name")?.textContent.trim() || "工地机位";
    image.src = background[1];
    layer.classList.add("show");
    layer.setAttribute("aria-hidden", "false");
  };
  window.smartWorksOpenCameraFullscreen = (id) =>
    openTile(document.querySelector(`[data-camera-view="${id}"]`));
  document.addEventListener(
    "click",
    (event) => {
      const tile = event.target.closest?.("[data-camera-view]");
      if (tile) openTile(tile);
    },
    true,
  );
  document
    .querySelector("#cameraFullscreenClose")
    ?.addEventListener("click", () => {
      const layer = document.querySelector("#cameraFullscreen");
      layer.classList.remove("show");
      layer.setAttribute("aria-hidden", "true");
    });
})();
