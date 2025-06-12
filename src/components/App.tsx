import React, { useState, useEffect } from "react";
import Header from "./Header";
import StationSelector from "./StationSelector";
import TabNavigation from "./TabNavigation";
import DataView from "./DataView";
import MapView from "./MapView";
import Controls from "./Controls";
import Footer from "./Footer";
import { StationTracker } from "../utils/stationTracker";
import type {
	StationType,
	TabType,
	StationData,
	Status,
	StationTracker as IStationTracker,
} from "../types";

const App: React.FC = () => {
	const [currentStation, setCurrentStation] = useState<StationType>("css");
	const [currentTab, setCurrentTab] = useState<TabType>("data");
	const [stationData, setStationData] = useState<StationData>({
		longitude: "--",
		latitude: "--",
		altitude: "--",
		velocity: "--",
		utcTime: "--",
		localTime: "--",
		period: "--",
		inclination: "--",
		eccentricity: "--",
		tleUpdateTime: "--",
	});
	const [status, setStatus] = useState<Status>({
		message: "获取数据中...",
		type: "loading",
	});
	const [tracker, setTracker] = useState<IStationTracker | null>(null);

	useEffect(() => {
		const stationTracker = new StationTracker(currentStation);
		setTracker(stationTracker);

		stationTracker.onDataUpdate = (data: StationData) => {
			setStationData(data);
		};

		stationTracker.onStatusUpdate = (status: Status) => {
			setStatus(status);
		};

		stationTracker.initialize();

		return () => {
			stationTracker.cleanup();
		};
	}, [currentStation]);

	const handleStationChange = (station: StationType): void => {
		setCurrentStation(station);
	};

	const handleTabChange = (tab: TabType): void => {
		setCurrentTab(tab);
	};

	const handleRefresh = (): void => {
		if (tracker) {
			tracker.forceRefresh();
		}
	};

	return (
		<div className="w-[400px] h-[600px] gradient-bg">
			<div className="glass-panel h-full p-5 flex flex-col shadow-xl">
				<Header status={status} />

				<StationSelector
					currentStation={currentStation}
					onStationChange={handleStationChange}
				/>

				<TabNavigation
					currentTab={currentTab}
					onTabChange={handleTabChange}
				/>

				<div className="flex-1 overflow-hidden">
					{currentTab === "data" ? (
						<DataView data={stationData} />
					) : (
						<MapView data={stationData} tracker={tracker} />
					)}
				</div>

				<Controls onRefresh={handleRefresh} />
				<Footer />
			</div>
		</div>
	);
};

export default App;
