import React from "react";
import type { StationSelectorProps, StationType } from "../types";

interface Station {
	id: StationType;
	name: string;
	active: boolean;
}

const StationSelector: React.FC<StationSelectorProps> = ({
	currentStation,
	onStationChange,
}) => {
	const stations: Station[] = [
		{ id: "css", name: "🇨🇳 天宫空间站", active: currentStation === "css" },
		{ id: "iss", name: "🌍 国际空间站", active: currentStation === "iss" },
	];

	return (
		<div className="flex bg-white bg-opacity-50 rounded-xl p-1 mb-4">
			{stations.map((station) => (
				<button
					key={station.id}
					onClick={() => onStationChange(station.id)}
					className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-300 ${
						station.active
							? "bg-white text-gray-800 shadow-md"
							: "text-gray-600 hover:bg-white hover:bg-opacity-30"
					}`}>
					{station.name}
				</button>
			))}
		</div>
	);
};

export default StationSelector;
