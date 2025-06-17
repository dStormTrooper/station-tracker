import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "com.stationtracker.app",
	appName: "空间站追踪器",
	webDir: "dist",
	server: {
		androidScheme: "https",
	},
	plugins: {
		StatusBar: {
			style: "dark",
			backgroundColor: "#1f2937",
		},
		App: {
			backgroundColor: "#1f2937",
		},
	},
};

export default config;
