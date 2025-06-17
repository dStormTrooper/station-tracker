import { createRoot } from "react-dom/client";
import { App as CapacitorApp } from "@capacitor/app";
import { StatusBar } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";
import App from "./components/App";
import "./styles/input.css";

// 初始化Capacitor插件
const initializeApp = async () => {
	if (Capacitor.isNativePlatform()) {
		// 设置状态栏样式
		await StatusBar.setStyle({ style: "DARK" });
		await StatusBar.setBackgroundColor({ color: "#1f2937" });

		// 监听应用状态变化
		CapacitorApp.addListener("appStateChange", ({ isActive }) => {
			console.log("App state changed. Is active?", isActive);
		});
	}
};

const container = document.getElementById("root");
if (!container) {
	throw new Error("Failed to find the root element");
}

const root = createRoot(container);
root.render(<App />);

// 初始化原生功能
initializeApp();
