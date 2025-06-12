import React from "react";
import type { TabNavigationProps, TabType } from "../types";

interface Tab {
	id: TabType;
	name: string;
	active: boolean;
}

const TabNavigation: React.FC<TabNavigationProps> = ({
	currentTab,
	onTabChange,
}) => {
	const tabs: Tab[] = [
		{ id: "data", name: "📊 数据", active: currentTab === "data" },
		{ id: "map", name: "🗺️ 地图", active: currentTab === "map" },
	];

	return (
		<div className="flex bg-white bg-opacity-50 rounded-xl p-1 mb-4">
			{tabs.map((tab) => (
				<button
					key={tab.id}
					onClick={() => onTabChange(tab.id)}
					className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-300 ${
						tab.active
							? "bg-white text-gray-800 shadow-md"
							: "text-gray-600 hover:bg-white hover:bg-opacity-30"
					}`}>
					{tab.name}
				</button>
			))}
		</div>
	);
};

export default TabNavigation;
