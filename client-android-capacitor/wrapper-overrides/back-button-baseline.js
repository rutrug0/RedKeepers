(function () {
  var appPlugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;

  if (!appPlugin || typeof appPlugin.addListener !== "function") {
    return;
  }

  appPlugin.addListener("backButton", function (event) {
    var canGoBack = Boolean(event && event.canGoBack);
    if (canGoBack && window.history.length > 1) {
      window.history.back();
      return;
    }

    if (typeof appPlugin.exitApp === "function") {
      appPlugin.exitApp();
    }
  });
})();
