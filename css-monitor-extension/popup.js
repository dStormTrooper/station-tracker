// 使用satellite.js库进行轨道计算的主应用类
class CSSTracker {
	constructor() {
		this.autoUpdateInterval = null;
		this.tleUpdateInterval = null;
		this.orbitUpdateInterval = null;
		this.currentTLE = null;
		this.satrec = null;
		this.apiUrl =
			"https://celestrak.org/NORAD/elements/gp.php?CATNR=48274&FORMAT=json";

		// 地图相关
		this.map = null;
		this.satelliteMarker = null;
		this.orbitPath = null;
		this.currentTab = "data";

		// 缓存配置：TLE数据有效期为6小时
		this.cacheExpiryTime = 6 * 60 * 60 * 1000; // 6小时

		// TLE时间显示相关
		this.tleTimestamp = null;
		this.tleSource = null;
		this.timeDisplayInterval = null;

		this.initializeElements();
		this.bindEvents();
		this.initializeTabs();
		this.loadData().then(() => {
			// 数据加载完成后自动启动自动更新
			if (this.satrec) {
				this.startBackgroundUpdates();
			}
		});
	}

	initializeElements() {
		this.elements = {
			status: document.getElementById("status"),
			longitude: document.getElementById("longitude"),
			latitude: document.getElementById("latitude"),
			altitude: document.getElementById("altitude"),
			velocity: document.getElementById("velocity"),
			utcTime: document.getElementById("utcTime"),
			localTime: document.getElementById("localTime"),
			period: document.getElementById("period"),
			inclination: document.getElementById("inclination"),
			eccentricity: document.getElementById("eccentricity"),
			tleUpdateTime: document.getElementById("tleUpdateTime"),
			refreshBtn: document.getElementById("refreshBtn"),

			// 地图相关元素
			mapLongitude: document.getElementById("mapLongitude"),
			mapLatitude: document.getElementById("mapLatitude"),
			mapVelocity: document.getElementById("mapVelocity"),

			// 选项卡相关元素
			dataTab: document.getElementById("dataTab"),
			mapTab: document.getElementById("mapTab"),
			dataView: document.getElementById("dataView"),
			mapView: document.getElementById("mapView"),
		};
	}

	bindEvents() {
		this.elements.refreshBtn.addEventListener("click", () =>
			this.forceRefresh()
		);
	}

	initializeTabs() {
		this.elements.dataTab.addEventListener("click", () =>
			this.switchTab("data")
		);
		this.elements.mapTab.addEventListener("click", () =>
			this.switchTab("map")
		);
	}

	switchTab(tabName) {
		this.currentTab = tabName;

		// 更新选项卡按钮状态
		this.elements.dataTab.classList.toggle("active", tabName === "data");
		this.elements.mapTab.classList.toggle("active", tabName === "map");

		// 更新内容视图
		this.elements.dataView.classList.toggle("active", tabName === "data");
		this.elements.mapView.classList.toggle("active", tabName === "map");

		// 初始化地图（如果还没有初始化）
		if (tabName === "map" && !this.map) {
			this.initializeMap();
			// 地图初始化后立即更新轨道路径
			if (this.satrec) {
				setTimeout(() => {
					this.updateOrbitPath();
				}, 100);
			}
		} else if (tabName === "map" && this.map && this.satrec) {
			// 如果地图已存在且有轨道数据，立即更新轨道路径
			this.updateOrbitPath();
		}
	}

	initializeMap() {
		// 创建地图实例，添加跨日期线跳转支持
		this.map = L.map("map", {
			worldCopyJump: true, // 允许跨越国际日期线的平滑跳转
		}).setView([0, 0], 2);

		// 添加地图图层 - 使用OpenStreetMap，防止瓦片重复
		L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution: "© OpenStreetMap contributors",
			maxZoom: 18,
			noWrap: true, // 防止地图瓦片在经度±180°处重复显示
		}).addTo(this.map);

		// 创建空间站图标
		const stationIcon = L.divIcon({
			className: "station-marker",
			html: "🛰️",
			iconSize: [30, 30],
			iconAnchor: [15, 15],
		});

		// 添加空间站标记
		this.satelliteMarker = L.marker([0, 0], { icon: stationIcon }).addTo(
			this.map
		);

		// 创建轨道路径
		this.orbitPath = L.polyline([], {
			color: "#ff4444",
			weight: 3,
			opacity: 0.8,
		}).addTo(this.map);

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
		`;
		document.head.appendChild(style);
	}

	async loadData() {
		try {
			this.updateStatus("获取数据中...", "loading");

			// 首先尝试从缓存加载数据
			const cachedData = await this.loadFromCache();
			if (cachedData) {
				console.log("使用缓存的TLE数据");
				this.currentTLE = cachedData.tle;
				this.satrec = satellite.json2satrec(this.currentTLE);
				this.updateDisplay();
				this.updateOrbitPath();
				this.updateTleTime(cachedData.timestamp, "缓存");

				const cacheAge = Math.floor(
					(Date.now() - cachedData.timestamp) / (1000 * 60)
				);
				this.updateStatus(
					`数据已加载 (缓存${cacheAge}分钟前)`,
					"online"
				);

				// 数据加载完成后自动启动功能
				this.startBackgroundUpdates();
				return;
			}

			// 缓存中没有有效数据，从网络获取
			await this.fetchFromNetwork();
		} catch (error) {
			console.error("获取数据失败:", error);
			this.updateStatus("网络获取失败，使用备用数据", "error");

			// 如果网络请求失败，使用备用的TLE数据
			this.useFallbackData();
		}
	}

	async loadFromCache() {
		try {
			const result = await chrome.storage.local.get([
				"cssTracker_tle",
				"cssTracker_timestamp",
			]);

			if (result.cssTracker_tle && result.cssTracker_timestamp) {
				const cacheAge = Date.now() - result.cssTracker_timestamp;

				// 检查缓存是否还有效（6小时内）
				if (cacheAge < this.cacheExpiryTime) {
					return {
						tle: result.cssTracker_tle,
						timestamp: result.cssTracker_timestamp,
					};
				} else {
					console.log("缓存已过期，需要重新获取数据");
				}
			}

			return null;
		} catch (error) {
			console.error("读取缓存失败:", error);
			return null;
		}
	}

	async saveToCache(tleData) {
		try {
			await chrome.storage.local.set({
				cssTracker_tle: tleData,
				cssTracker_timestamp: Date.now(),
			});
			console.log("TLE数据已缓存");
		} catch (error) {
			console.error("保存缓存失败:", error);
		}
	}

	async fetchFromNetwork() {
		// 尝试多个API端点，但增加请求间隔
		const apiUrls = [
			"https://celestrak.org/NORAD/elements/gp.php?CATNR=48274&FORMAT=json",
			"https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json",
		];

		let data = null;
		let lastError = null;

		for (let i = 0; i < apiUrls.length; i++) {
			const apiUrl = apiUrls[i];
			try {
				console.log("尝试API:", apiUrl);

				// 为避免被反爬虫，添加随机延迟
				if (i > 0) {
					await new Promise((resolve) =>
						setTimeout(resolve, 2000 + Math.random() * 3000)
					);
				}

				const response = await fetch(apiUrl, {
					method: "GET",
					headers: {
						Accept: "application/json",
						"User-Agent": "CSS-Monitor-Extension/1.0",
						"Cache-Control": "no-cache",
					},
				});

				if (!response.ok) {
					throw new Error(
						`HTTP ${response.status}: ${response.statusText}`
					);
				}

				const responseData = await response.json();

				if (responseData && responseData.length > 0) {
					// 如果是空间站组数据，查找天宫空间站
					if (Array.isArray(responseData)) {
						const cssData = responseData.find(
							(sat) =>
								sat.OBJECT_NAME &&
								(sat.OBJECT_NAME.includes("CSS") ||
									sat.OBJECT_NAME.includes("TIANHE") ||
									sat.NORAD_CAT_ID === 48274)
						);
						if (cssData) {
							data = [cssData];
							break;
						} else if (responseData[0].NORAD_CAT_ID === 48274) {
							data = responseData;
							break;
						}
					} else {
						data = responseData;
						break;
					}
				}
			} catch (error) {
				console.log(`API ${apiUrl} 失败:`, error);
				lastError = error;
				continue;
			}
		}

		if (!data || data.length === 0) {
			throw lastError || new Error("所有API端点都无法获取TLE数据");
		}

		this.currentTLE = data[0];

		// 保存到缓存
		await this.saveToCache(this.currentTLE);

		// 使用satellite.js创建卫星记录
		this.satrec = satellite.json2satrec(this.currentTLE);

		this.updateDisplay();
		this.updateOrbitPath();
		this.updateTleTime(Date.now(), "网络");
		this.updateStatus("数据已更新", "online");

		// 数据获取完成后自动启动功能
		this.startBackgroundUpdates();
	}

	useFallbackData() {
		console.log("使用备用TLE数据");

		// 使用最新的备用TLE数据
		const fallbackTLE = {
			OBJECT_NAME: "CSS (TIANHE)",
			OBJECT_ID: "2021-035A",
			EPOCH: "2025-06-11T02:33:23.591520",
			MEAN_MOTION: 15.58613121,
			ECCENTRICITY: 0.0004208,
			INCLINATION: 41.465,
			RA_OF_ASC_NODE: 57.557,
			ARG_OF_PERICENTER: 54.3679,
			MEAN_ANOMALY: 305.755,
			EPHEMERIS_TYPE: 0,
			CLASSIFICATION_TYPE: "U",
			NORAD_CAT_ID: 48274,
			ELEMENT_SET_NO: 999,
			REV_AT_EPOCH: 23520,
			BSTAR: 0.00023814,
			MEAN_MOTION_DOT: 0.00018506,
			MEAN_MOTION_DDOT: 0,
		};

		try {
			this.currentTLE = fallbackTLE;
			this.satrec = satellite.json2satrec(this.currentTLE);
			this.updateDisplay();
			this.updateOrbitPath();

			// 使用TLE中的EPOCH作为备用数据的时间
			const epochTime = new Date(fallbackTLE.EPOCH).getTime();
			this.updateTleTime(epochTime, "备用");

			// 计算数据年龄
			const dataAge = Math.floor(
				(Date.now() - epochTime) / (1000 * 60 * 60 * 24)
			);
			this.updateStatus(`使用备用数据 (${dataAge}天前)`, "online");

			// 即使使用备用数据也启动自动功能
			this.startBackgroundUpdates();
		} catch (error) {
			console.error("备用数据也失败:", error);
			this.updateStatus("无法获取任何数据", "error");
		}
	}

	updateDisplay() {
		if (!this.satrec || !this.currentTLE) return;

		const now = new Date();

		// 使用satellite.js进行轨道传播
		const positionAndVelocity = satellite.propagate(this.satrec, now);

		if (!positionAndVelocity.position) {
			console.error("轨道传播失败");
			this.updateStatus("轨道计算失败", "error");
			return;
		}

		// 获取格林威治恒星时
		const gmst = satellite.gstime(now);

		// 转换到地理坐标
		const positionGd = satellite.eciToGeodetic(
			positionAndVelocity.position,
			gmst
		);

		// 计算速度大小
		const velocity = positionAndVelocity.velocity;
		const speed = Math.sqrt(
			velocity.x * velocity.x +
				velocity.y * velocity.y +
				velocity.z * velocity.z
		);

		// 将弧度转换为度数并标准化经度
		let longitude = positionGd.longitude * (180 / Math.PI);
		const latitude = positionGd.latitude * (180 / Math.PI);

		// 标准化经度到 -180 到 180 范围
		longitude = ((((longitude + 180) % 360) + 360) % 360) - 180;

		// 更新数据视图
		this.elements.longitude.textContent = longitude.toFixed(4);
		this.elements.latitude.textContent = latitude.toFixed(4);
		this.elements.altitude.textContent = positionGd.height.toFixed(1);
		this.elements.velocity.textContent = speed.toFixed(2);

		// 更新地图视图
		this.elements.mapLongitude.textContent = longitude.toFixed(4);
		this.elements.mapLatitude.textContent = latitude.toFixed(4);
		this.elements.mapVelocity.textContent = speed.toFixed(2);

		// 更新时间
		this.elements.utcTime.textContent = now.toISOString().slice(11, 19);
		this.elements.localTime.textContent = now.toLocaleTimeString();

		// 更新轨道参数
		const period = (24 * 60) / this.currentTLE.MEAN_MOTION;
		this.elements.period.textContent = period.toFixed(1);
		this.elements.inclination.textContent =
			this.currentTLE.INCLINATION.toFixed(2);
		this.elements.eccentricity.textContent =
			this.currentTLE.ECCENTRICITY.toFixed(6);

		// 更新地图上的卫星位置
		this.updateMapPosition(latitude, longitude);
	}

	updateMapPosition(latitude, longitude) {
		if (this.map && this.satelliteMarker) {
			this.satelliteMarker.setLatLng([latitude, longitude]);

			// 如果是第一次定位或者用户切换到地图视图，则居中显示
			if (this.currentTab === "map") {
				this.map.setView([latitude, longitude], this.map.getZoom());
			}
		}
	}

	updateOrbitPath() {
		if (!this.map || !this.satrec) {
			console.log("updateOrbitPath: 地图或卫星数据未准备好");
			return;
		}

		console.log("开始更新轨道路径...");

		// 计算轨道路径（未来90分钟的轨迹）
		const orbitPoints = [];
		const now = new Date();

		// 每2分钟计算一个点，总共45个点（90分钟）
		for (let i = 0; i <= 45; i++) {
			const futureTime = new Date(now.getTime() + i * 2 * 60 * 1000);
			const positionAndVelocity = satellite.propagate(
				this.satrec,
				futureTime
			);

			if (positionAndVelocity.position) {
				const gmstFuture = satellite.gstime(futureTime);
				const positionGd = satellite.eciToGeodetic(
					positionAndVelocity.position,
					gmstFuture
				);
				let longitude = positionGd.longitude * (180 / Math.PI);
				const latitude = positionGd.latitude * (180 / Math.PI);

				// 标准化经度到 -180 到 180 范围
				longitude = ((((longitude + 180) % 360) + 360) % 360) - 180;

				orbitPoints.push([latitude, longitude]);
			}
		}

		console.log(`计算得到${orbitPoints.length}个轨道点`);

		// 检测并分割跨越国际日期线的轨道段
		const orbitSegments = this.splitOrbitAtDateline(orbitPoints);
		console.log(`轨道被分割为${orbitSegments.length}段`);

		// 清除旧的轨道路径
		if (this.orbitPath) {
			if (Array.isArray(this.orbitPath)) {
				this.orbitPath.forEach((path) => this.map.removeLayer(path));
			} else {
				this.map.removeLayer(this.orbitPath);
			}
		}

		// 创建新的轨道路径（可能是多段）
		this.orbitPath = [];
		orbitSegments.forEach((segment, index) => {
			if (segment.length > 1) {
				const pathSegment = L.polyline(segment, {
					color: "#ff4444",
					weight: 3,
					opacity: 0.8,
				}).addTo(this.map);
				this.orbitPath.push(pathSegment);
			}
		});

		console.log(`轨道路径已更新，共${this.orbitPath.length}段`);
	}

	// 分割跨越国际日期线的轨道点
	splitOrbitAtDateline(points) {
		if (points.length === 0) return [];

		const segments = [];
		let currentSegment = [points[0]];

		for (let i = 1; i < points.length; i++) {
			const prevLon = points[i - 1][1];
			const currLon = points[i][1];

			// 检测是否跨越国际日期线（经度差超过180度）
			const lonDiff = Math.abs(currLon - prevLon);

			if (lonDiff > 180) {
				// 跨越日期线，结束当前段，开始新段
				segments.push(currentSegment);
				currentSegment = [points[i]];
			} else {
				// 正常情况，添加到当前段
				currentSegment.push(points[i]);
			}
		}

		// 添加最后一段
		if (currentSegment.length > 0) {
			segments.push(currentSegment);
		}

		return segments;
	}

	updateStatus(message, type = "") {
		this.elements.status.textContent = message;
		this.elements.status.className = "status " + type;
	}

	startBackgroundUpdates() {
		// 避免重复启动
		if (this.autoUpdateInterval) {
			return;
		}

		console.log("启动后台自动更新功能");

		// 每1秒更新一次位置（基于已有TLE数据的本地计算）
		this.autoUpdateInterval = setInterval(() => {
			if (this.satrec) {
				this.updateDisplay();
			}
		}, 1000);

		// 每6小时检查并更新TLE数据（只有当缓存过期时才会真正发起网络请求）
		this.tleUpdateInterval = setInterval(() => {
			this.loadData();
		}, this.cacheExpiryTime); // 6小时

		// 每30秒更新一次轨道路径（如果地图已初始化）
		this.orbitUpdateInterval = setInterval(() => {
			if (this.map && this.satrec) {
				this.updateOrbitPath();
			}
		}, 30000); // 30秒
	}

	stopBackgroundUpdates() {
		if (this.autoUpdateInterval) {
			clearInterval(this.autoUpdateInterval);
			this.autoUpdateInterval = null;
		}

		if (this.tleUpdateInterval) {
			clearInterval(this.tleUpdateInterval);
			this.tleUpdateInterval = null;
		}

		if (this.orbitUpdateInterval) {
			clearInterval(this.orbitUpdateInterval);
			this.orbitUpdateInterval = null;
		}

		if (this.timeDisplayInterval) {
			clearInterval(this.timeDisplayInterval);
			this.timeDisplayInterval = null;
		}
	}

	// 强制刷新：跳过缓存，直接从网络获取最新数据
	async forceRefresh() {
		try {
			this.updateStatus("强制刷新中...", "loading");
			await this.fetchFromNetwork();
		} catch (error) {
			console.error("强制刷新失败:", error);
			this.updateStatus("刷新失败，使用备用数据", "error");
			this.useFallbackData();
		}
	}

	updateTleTime(timestamp, source) {
		this.tleTimestamp = timestamp;
		this.tleSource = source;
		this.refreshTleTimeDisplay();

		// 启动定时更新显示（每分钟更新一次相对时间）
		if (this.timeDisplayInterval) {
			clearInterval(this.timeDisplayInterval);
		}
		this.timeDisplayInterval = setInterval(() => {
			this.refreshTleTimeDisplay();
		}, 60000); // 每分钟更新一次
	}

	refreshTleTimeDisplay() {
		if (!this.tleTimestamp || !this.tleSource) return;

		const updateTime = new Date(this.tleTimestamp);
		const now = new Date();

		// 计算时间差
		const timeDiff = now.getTime() - updateTime.getTime();
		const minutes = Math.floor(timeDiff / (1000 * 60));
		const hours = Math.floor(timeDiff / (1000 * 60 * 60));
		const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

		let timeAgoText;
		if (days > 0) {
			timeAgoText = `${days}天前`;
		} else if (hours > 0) {
			timeAgoText = `${hours}小时前`;
		} else if (minutes > 0) {
			timeAgoText = `${minutes}分钟前`;
		} else {
			timeAgoText = "刚刚";
		}

		// 显示完整的更新信息
		const timeString = updateTime.toLocaleString("zh-CN", {
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});

		this.elements.tleUpdateTime.textContent = `${timeString} (${this.tleSource}, ${timeAgoText})`;
	}
}

// 初始化应用
document.addEventListener("DOMContentLoaded", () => {
	new CSSTracker();
});

// 在页面卸载时清理定时器
window.addEventListener("beforeunload", () => {
	if (window.cssTracker) {
		window.cssTracker.stopBackgroundUpdates();
	}
});
