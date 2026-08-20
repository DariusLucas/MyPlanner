import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.myplanner.app",
  appName: "MyPlanner",
  webDir: "dist-mobile",
  server: {
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#f6f1eb",
  },
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
  },
};

export default config;
