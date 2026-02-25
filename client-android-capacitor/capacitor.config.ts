import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.redkeepers.verticalslice",
  appName: "RedKeepers Slice",
  webDir: "www",
  bundledWebRuntime: false,
  android: {
    webContentsDebuggingEnabled: true,
    allowMixedContent: false
  },
  plugins: {
    App: {
      disableBackButtonHandler: false
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 0
    }
  }
};

export default config;
