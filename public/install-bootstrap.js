(function () {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" });
  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    window.__relayInstallPrompt = event;
    window.dispatchEvent(new Event("relayinstallready"));
  });
  window.addEventListener("appinstalled", function () {
    localStorage.setItem("relay-app-installed", "true");
    delete window.__relayInstallPrompt;
  });
})();
