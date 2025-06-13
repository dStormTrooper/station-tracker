import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import * as satellite from "satellite.js";
import type { MapViewProps } from "../types";

const MapView: React.FC<MapViewProps> = ({ data, tracker }) => {
	const mapRef = useRef<HTMLDivElement>(null);
	const mapInstanceRef = useRef<L.Map | null>(null);
	const satelliteMarkerRef = useRef<L.Marker | null>(null);
	const orbitPathRef = useRef<L.Polyline | null>(null);
	const orbitEndMarkerRef = useRef<L.Marker | null>(null);
	const [isTracking, setIsTracking] = useState(true); // 默认启用跟踪模式
	const chineseLayerRef = useRef<L.TileLayer | null>(null);
	const osmLayerRef = useRef<L.TileLayer | null>(null);

	useEffect(() => {
		if (!mapInstanceRef.current && mapRef.current) {
			// 初始化地图 - 启用循环地图，优化轨道显示
			mapInstanceRef.current = L.map(mapRef.current, {
				worldCopyJump: true, // 启用跨越日期线的平滑跳转
				maxBounds: undefined, // 移除边界限制
				maxBoundsViscosity: 0, // 边界粘性为0
				zoomControl: false, // 禁用默认的缩放控件
			}).setView([0, 0], 3); // 调整初始缩放级别为3，更适合轨道显示

			// 创建高德中文地图图层（低缩放级别使用）
			chineseLayerRef.current = L.tileLayer(
				"https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}",
				{
					attribution: "© 高德地图",
					maxZoom: 11, // 限制最大缩放级别
					noWrap: false,
					subdomains: ["1", "2", "3", "4"],
				}
			);

			// 创建OSM图层（高缩放级别使用）
			osmLayerRef.current = L.tileLayer(
				"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
				{
					attribution: "© OpenStreetMap contributors",
					maxZoom: 18,
					noWrap: false,
				}
			);

			// 根据初始缩放级别添加合适的图层
			const initialZoom = mapInstanceRef.current.getZoom();
			if (initialZoom >= 3 && initialZoom <= 8) {
				chineseLayerRef.current.addTo(mapInstanceRef.current);
			} else {
				osmLayerRef.current.addTo(mapInstanceRef.current);
			}

			// 监听缩放事件，动态切换图层
			mapInstanceRef.current.on("zoomend", () => {
				if (
					mapInstanceRef.current &&
					chineseLayerRef.current &&
					osmLayerRef.current
				) {
					const currentZoom = mapInstanceRef.current.getZoom();

					if (currentZoom >= 3 && currentZoom <= 8) {
						// 中等缩放级别（3-8级），使用中文地图
						if (
							mapInstanceRef.current.hasLayer(osmLayerRef.current)
						) {
							mapInstanceRef.current.removeLayer(
								osmLayerRef.current
							);
							mapInstanceRef.current.addLayer(
								chineseLayerRef.current
							);
						}
					} else {
						// 极小缩放级别（1-2级）或高缩放级别（>10级），使用OSM
						if (
							mapInstanceRef.current.hasLayer(
								chineseLayerRef.current
							)
						) {
							mapInstanceRef.current.removeLayer(
								chineseLayerRef.current
							);
							mapInstanceRef.current.addLayer(
								osmLayerRef.current
							);
						}
					}
				}
			});

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
				html: `<div class="orbit-end-pin">📍<div class="orbit-end-tooltip">90分钟后</div></div>`,
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
		// 更新空间站位置并根据跟踪模式调整地图视图
		if (
			satelliteMarkerRef.current &&
			data.latitude !== "--" &&
			data.longitude !== "--"
		) {
			const lat = parseFloat(data.latitude);
			const lng = parseFloat(data.longitude);

			if (!isNaN(lat) && !isNaN(lng)) {
				satelliteMarkerRef.current.setLatLng([lat, lng]);

				// 只在跟踪模式下自动调整地图位置
				if (isTracking && mapInstanceRef.current) {
					const map = mapInstanceRef.current;
					const currentZoom = map.getZoom();

					// 获取当前地图边界来计算经度跨度
					const bounds = map.getBounds();
					const lonSpan = bounds.getEast() - bounds.getWest();

					// 计算地图中心位置，使太空站出现在左侧1/6处
					// 太空站在左侧1/6，所以地图中心应该向右偏移1/3个跨度
					const targetCenterLng = lng + lonSpan * 0.33;
					const targetCenterLat = lat;

					// 平滑移动到新的中心位置
					map.setView(
						[targetCenterLat, targetCenterLng],
						currentZoom,
						{
							animate: true,
							duration: 1.0, // 1秒的平滑动画
						}
					);
				}
			}
		}
	}, [data.latitude, data.longitude, isTracking]);

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

	// 居中到太空站的函数
	const centerOnStation = () => {
		if (
			mapInstanceRef.current &&
			data.latitude !== "--" &&
			data.longitude !== "--"
		) {
			const lat = parseFloat(data.latitude);
			const lng = parseFloat(data.longitude);

			if (!isNaN(lat) && !isNaN(lng)) {
				const map = mapInstanceRef.current;
				const currentZoom = map.getZoom();
				const bounds = map.getBounds();
				const lonSpan = bounds.getEast() - bounds.getWest();
				const targetCenterLng = lng + lonSpan * 0.33;

				map.setView([lat, targetCenterLng], currentZoom, {
					animate: true,
					duration: 1.0,
				});
			}
		}
	};

	return (
		<div className="h-full flex flex-col">
			{/* 地图控制面板 */}
			<div className="glass-panel p-2 mb-2 flex items-center justify-between">
				<label className="flex items-center cursor-pointer text-sm">
					<input
						type="checkbox"
						checked={isTracking}
						onChange={(e) => setIsTracking(e.target.checked)}
						className="mr-2 w-4 h-4"
					/>
					<span>自动跟踪太空站</span>
				</label>

				{!isTracking && (
					<button
						onClick={centerOnStation}
						className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors">
						定位太空站
					</button>
				)}
			</div>

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
