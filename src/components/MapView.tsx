import React, { useEffect, useRef } from "react";
import L from "leaflet";
import type { MapViewProps } from "../types";

const MapView: React.FC<MapViewProps> = ({ data, tracker }) => {
	const mapRef = useRef<HTMLDivElement>(null);
	const mapInstanceRef = useRef<L.Map | null>(null);
	const satelliteMarkerRef = useRef<L.Marker | null>(null);
	const orbitPathRef = useRef<L.Polyline | null>(null);

	useEffect(() => {
		if (!mapInstanceRef.current && mapRef.current) {
			// 初始化地图
			mapInstanceRef.current = L.map(mapRef.current, {
				worldCopyJump: true,
			}).setView([0, 0], 2);

			// 添加地图图层
			L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
				attribution: "© OpenStreetMap contributors",
				maxZoom: 18,
				noWrap: true,
			}).addTo(mapInstanceRef.current);

			// 创建空间站图标
			const stationIcon = L.divIcon({
				className: "station-marker",
				html: "🛰️",
				iconSize: [30, 30],
				iconAnchor: [15, 15],
			});

			// 添加空间站标记
			satelliteMarkerRef.current = L.marker([0, 0], {
				icon: stationIcon,
			}).addTo(mapInstanceRef.current);

			// 创建轨道路径
			orbitPathRef.current = L.polyline([], {
				color: "#ff4444",
				weight: 3,
				opacity: 0.8,
			}).addTo(mapInstanceRef.current);
		}

		return () => {
			if (mapInstanceRef.current) {
				mapInstanceRef.current.remove();
				mapInstanceRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		// 更新空间站位置
		if (
			satelliteMarkerRef.current &&
			data.latitude !== "--" &&
			data.longitude !== "--"
		) {
			const lat = parseFloat(data.latitude);
			const lng = parseFloat(data.longitude);

			if (!isNaN(lat) && !isNaN(lng)) {
				satelliteMarkerRef.current.setLatLng([lat, lng]);
				if (mapInstanceRef.current) {
					mapInstanceRef.current.setView(
						[lat, lng],
						mapInstanceRef.current.getZoom()
					);
				}
			}
		}
	}, [data.latitude, data.longitude]);

	useEffect(() => {
		// 更新轨道路径
		if (tracker && orbitPathRef.current && mapInstanceRef.current) {
			tracker.updateOrbitPath(orbitPathRef.current);
		}
	}, [tracker, data]);

	return (
		<div className="h-full flex flex-col">
			<div
				ref={mapRef}
				className="h-[350px] w-full rounded-xl border-2 border-white border-opacity-30 overflow-hidden mb-3"
			/>

			<div className="glass-panel p-3 flex justify-between items-center text-sm">
				<div className="font-mono">
					<span className="font-semibold">{data.longitude}</span>°,{" "}
					<span className="font-semibold">{data.latitude}</span>°
				</div>
				<div>
					速度:{" "}
					<span className="font-semibold font-mono">
						{data.velocity}
					</span>{" "}
					km/s
				</div>
			</div>
		</div>
	);
};

export default MapView;
