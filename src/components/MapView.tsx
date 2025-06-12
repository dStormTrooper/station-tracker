import React, { useEffect, useRef } from "react";
import L from "leaflet";
import * as satellite from "satellite.js";
import type { MapViewProps } from "../types";

const MapView: React.FC<MapViewProps> = ({ data, tracker }) => {
	const mapRef = useRef<HTMLDivElement>(null);
	const mapInstanceRef = useRef<L.Map | null>(null);
	const satelliteMarkerRef = useRef<L.Marker | null>(null);
	const orbitPathRef = useRef<L.Polyline | null>(null);
	const orbitEndMarkerRef = useRef<L.Marker | null>(null);

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

			// 创建轨道终点图标
			const orbitEndIcon = L.divIcon({
				className: "orbit-end-marker",
				html: '<div class="orbit-end-pin">📍<div class="orbit-end-tooltip">90分钟后</div></div>',
				iconSize: [24, 24],
				iconAnchor: [12, 24],
			});

			// 添加空间站标记
			satelliteMarkerRef.current = L.marker([0, 0], {
				icon: stationIcon,
			}).addTo(mapInstanceRef.current);

			// 添加轨道终点标记
			orbitEndMarkerRef.current = L.marker([0, 0], {
				icon: orbitEndIcon,
			}).addTo(mapInstanceRef.current);

			// 创建轨道路径
			orbitPathRef.current = L.polyline([], {
				color: "#ff4444",
				weight: 3,
				opacity: 0.8,
			}).addTo(mapInstanceRef.current);

			// 添加自定义CSS样式
			const style = document.createElement("style");
			style.textContent = `
				.station-marker {
					background: none;
					border: none;
					text-align: center;
					font-size: 20px;
					line-height: 30px;
					filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.5));
				}
				
				.orbit-end-marker {
					background: none;
					border: none;
					text-align: center;
				}
				
				.orbit-end-pin {
					position: relative;
					font-size: 18px;
					filter: drop-shadow(1px 1px 3px rgba(0,0,0,0.6));
					cursor: pointer;
				}
				
				.orbit-end-tooltip {
					position: absolute;
					bottom: 25px;
					left: 50%;
					transform: translateX(-50%);
					background: rgba(0,0,0,0.8);
					color: white;
					padding: 4px 8px;
					border-radius: 4px;
					font-size: 11px;
					white-space: nowrap;
					pointer-events: none;
					z-index: 1000;
					opacity: 0;
					visibility: hidden;
					transition: opacity 0.2s ease, visibility 0.2s ease;
				}
				
				.orbit-end-pin:hover .orbit-end-tooltip {
					opacity: 1;
					visibility: visible;
				}
				
				.orbit-end-tooltip::after {
					content: '';
					position: absolute;
					top: 100%;
					left: 50%;
					transform: translateX(-50%);
					border: 4px solid transparent;
					border-top-color: rgba(0,0,0,0.8);
				}
			`;

			if (!document.getElementById("orbit-marker-styles")) {
				style.id = "orbit-marker-styles";
				document.head.appendChild(style);
			}
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

	// 添加单独的useEffect来计算轨道终点位置
	useEffect(() => {
		if (tracker && orbitEndMarkerRef.current) {
			// 计算轨道终点位置的函数
			const updateOrbitEndPosition = () => {
				try {
					// 获取轨道路径的终点
					const endPoint = tracker.getOrbitEndPoint();
					if (endPoint) {
						const [latitude, longitude] = endPoint;
						orbitEndMarkerRef.current?.setLatLng([
							latitude,
							longitude,
						]);
					}
				} catch (error) {
					console.error("计算轨道终点位置失败:", error);
				}
			};

			updateOrbitEndPosition();
		}
	}, [tracker, data]); // 当轨道数据更新时重新计算

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
