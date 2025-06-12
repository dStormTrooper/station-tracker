import React from "react";
import type { DataViewProps } from "../types";

interface InfoItem {
	label: string;
	value: string;
	unit?: string;
}

interface InfoSectionProps {
	title?: string;
	items: InfoItem[];
}

const DataView: React.FC<DataViewProps> = ({ data }) => {
	const InfoSection: React.FC<InfoSectionProps> = ({ title, items }) => (
		<div className="glass-panel p-4 mb-4">
			{title && (
				<h3 className="text-base font-semibold text-gray-800 mb-3">
					{title}
				</h3>
			)}
			<div className="space-y-2">
				{items.map((item, index) => (
					<div
						key={index}
						className="flex justify-between items-center py-2 border-b border-gray-200 border-opacity-50 last:border-b-0">
						<label className="font-medium text-gray-600 text-sm">
							{item.label}:
						</label>
						<span className="font-semibold text-gray-800 text-sm font-mono">
							{item.value}
							{item.unit || ""}
						</span>
					</div>
				))}
			</div>
		</div>
	);

	return (
		<div className="overflow-y-auto h-full space-y-0">
			<InfoSection
				items={[
					{ label: "经度", value: data.longitude, unit: "°" },
					{ label: "纬度", value: data.latitude, unit: "°" },
					{ label: "高度", value: data.altitude, unit: " km" },
					{ label: "速度", value: data.velocity, unit: " km/s" },
				]}
			/>

			<InfoSection
				items={[
					{ label: "UTC时间", value: data.utcTime },
					{ label: "本地时间", value: data.localTime },
				]}
			/>

			<InfoSection
				title="TLE数据"
				items={[
					{ label: "轨道周期", value: data.period, unit: " 分钟" },
					{ label: "倾角", value: data.inclination, unit: "°" },
					{ label: "偏心率", value: data.eccentricity },
				]}
			/>

			{data.tleUpdateTime !== "--" && (
				<div className="glass-panel p-3">
					<div className="text-xs text-gray-500">
						TLE更新:{" "}
						<span className="font-mono">{data.tleUpdateTime}</span>
					</div>
				</div>
			)}
		</div>
	);
};

export default DataView;
