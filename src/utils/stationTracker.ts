import * as satellite from "satellite.js";
import type {
	StationType,
	StationData,
	Status,
	TLEData,
	StationConfig,
	StationConfigMap,
	ChromeStorageResult,
	CachedData,
	OrbitPoint,
	OrbitSegment,
	LeafletPolyline,
} from "../types";

declare global {
	interface Window {
		chrome: {
			storage: {
				local: {
					get(keys: string[]): Promise<ChromeStorageResult>;
					set(items: Record<string, any>): Promise<void>;
				};
			};
		};
	}
}

export class StationTracker {
	private stationType: StationType;
	private autoUpdateInterval: NodeJS.Timeout | null = null;
	private tleUpdateInterval: NodeJS.Timeout | null = null;
	private currentTLE: TLEData | null = null;
	private satrec: satellite.SatRec | null = null;
	private readonly cacheExpiryTime: number = 6 * 60 * 60 * 1000; // 6小时
	private tleTimestamp: number | null = null;
	private timeDisplayInterval: NodeJS.Timeout | null = null;
	private lastOrbitPoints: OrbitPoint[] = [];

	// 空间站配置
	private readonly stationConfig: StationConfigMap = {
		css: {
			name: "天宫空间站",
			apiUrl: "https://celestrak.org/NORAD/elements/gp.php?CATNR=48274&FORMAT=json",
			fallbackTLE: {
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
			},
		},
		iss: {
			name: "国际空间站",
			apiUrl: "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=json",
			fallbackTLE: {
				OBJECT_NAME: "ISS (ZARYA)",
				OBJECT_ID: "1998-067A",
				EPOCH: "2024-01-01T00:00:00.000000",
				MEAN_MOTION: 15.49112426,
				ECCENTRICITY: 0.00055,
				INCLINATION: 51.64,
				RA_OF_ASC_NODE: 123.4567,
				ARG_OF_PERICENTER: 234.5678,
				MEAN_ANOMALY: 345.6789,
				EPHEMERIS_TYPE: 0,
				CLASSIFICATION_TYPE: "U",
				NORAD_CAT_ID: 25544,
				ELEMENT_SET_NO: 999,
				REV_AT_EPOCH: 12345,
				BSTAR: 0.000021906,
				MEAN_MOTION_DOT: 0.00002182,
				MEAN_MOTION_DDOT: 0.0,
			},
		},
	};

	// 回调函数
	public onDataUpdate: ((data: StationData) => void) | null = null;
	public onStatusUpdate: ((status: Status) => void) | null = null;

	constructor(stationType: StationType = "css") {
		this.stationType = stationType;
	}

	private get currentConfig(): StationConfig {
		return this.stationConfig[this.stationType];
	}

	public async initialize(): Promise<void> {
		try {
			this.updateStatus("获取数据中...", "loading");

			// 首先尝试从缓存加载数据
			const cachedData = await this.loadFromCache();
			if (cachedData) {
				console.log("使用缓存的TLE数据");
				this.currentTLE = cachedData.tle;
				this.satrec = (satellite as any).json2satrec(this.currentTLE);
				this.updateDisplay();
				this.updateTleTime(cachedData.timestamp, "缓存");

				const cacheAge = Math.floor(
					(Date.now() - cachedData.timestamp) / (1000 * 60)
				);
				this.updateStatus(
					`${this.currentConfig.name} - 数据已加载 (缓存${cacheAge}分钟前)`,
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
			this.useFallbackData();
		}
	}

	private async loadFromCache(): Promise<CachedData | null> {
		try {
			const cacheKey = `${this.stationType}Tracker`;
			const result = await window.chrome.storage.local.get([
				`${cacheKey}_tle`,
				`${cacheKey}_timestamp`,
			]);

			if (result[`${cacheKey}_tle`] && result[`${cacheKey}_timestamp`]) {
				const cacheAge = Date.now() - result[`${cacheKey}_timestamp`];

				// 检查缓存是否还有效（6小时内）
				if (cacheAge < this.cacheExpiryTime) {
					return {
						tle: result[`${cacheKey}_tle`] as TLEData,
						timestamp: result[`${cacheKey}_timestamp`] as number,
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

	private async saveToCache(tleData: TLEData): Promise<void> {
		try {
			const cacheKey = `${this.stationType}Tracker`;
			await window.chrome.storage.local.set({
				[`${cacheKey}_tle`]: tleData,
				[`${cacheKey}_timestamp`]: Date.now(),
			});
			console.log("TLE数据已缓存");
		} catch (error) {
			console.error("保存缓存失败:", error);
		}
	}

	private async fetchFromNetwork(): Promise<void> {
		// 尝试多个API端点，但增加请求间隔
		const apiUrls = [
			this.currentConfig.apiUrl,
			"https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json",
		];

		let data: TLEData[] | null = null;
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
						"User-Agent": "Station-Tracker-Extension/1.0",
						"Cache-Control": "no-cache",
					},
				});

				if (!response.ok) {
					throw new Error(
						`HTTP ${response.status}: ${response.statusText}`
					);
				}

				const responseData = await response.json();

				if (
					responseData &&
					Array.isArray(responseData) &&
					responseData.length > 0
				) {
					// 如果是空间站组数据，查找目标空间站
					const targetCatId =
						this.currentConfig.fallbackTLE.NORAD_CAT_ID;
					const stationData = responseData.find(
						(sat: any) =>
							sat.OBJECT_NAME &&
							(sat.NORAD_CAT_ID === targetCatId ||
								(this.stationType === "css" &&
									(sat.OBJECT_NAME.includes("CSS") ||
										sat.OBJECT_NAME.includes("TIANHE"))) ||
								(this.stationType === "iss" &&
									sat.OBJECT_NAME.includes("ISS")))
					);
					if (stationData) {
						data = [stationData];
						break;
					} else if (responseData[0].NORAD_CAT_ID === targetCatId) {
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
		this.satrec = (satellite as any).json2satrec(this.currentTLE);

		this.updateDisplay();
		this.updateTleTime(Date.now(), "网络");
		this.updateStatus(`${this.currentConfig.name} - 数据已更新`, "online");

		// 数据获取完成后自动启动功能
		this.startBackgroundUpdates();
	}

	private useFallbackData(): void {
		console.log("使用备用TLE数据");

		try {
			this.currentTLE = this.currentConfig.fallbackTLE;
			this.satrec = (satellite as any).json2satrec(this.currentTLE);
			this.updateDisplay();

			// 使用TLE中的EPOCH作为备用数据的时间
			const epochTime = new Date(
				this.currentConfig.fallbackTLE.EPOCH
			).getTime();
			this.updateTleTime(epochTime, "备用");

			// 计算数据年龄
			const dataAge = Math.floor(
				(Date.now() - epochTime) / (1000 * 60 * 60 * 24)
			);
			this.updateStatus(
				`${this.currentConfig.name} - 使用备用数据 (${dataAge}天前)`,
				"online"
			);

			// 即使使用备用数据也启动自动功能
			this.startBackgroundUpdates();
		} catch (error) {
			console.error("备用数据也失败:", error);
			this.updateStatus("无法获取任何数据", "error");
		}
	}

	private updateDisplay(): void {
		if (!this.satrec || !this.currentTLE) {
			console.error("没有可用的卫星数据");
			return;
		}

		const now = new Date();

		// 使用satellite.js进行轨道传播 - v6.0.0返回null而不是false
		const positionAndVelocity = satellite.propagate(this.satrec, now);

		if (positionAndVelocity === null) {
			console.error("轨道传播失败");
			this.updateStatus("轨道计算失败", "error");
			return;
		}

		// 获取格林威治恒星时
		const gmst = satellite.gstime(now);

		// 转换到地理坐标 - 使用类型断言处理v6.0.0的position类型
		const positionGd = satellite.eciToGeodetic(
			positionAndVelocity.position as any,
			gmst
		);

		// 计算速度大小
		const velocity = positionAndVelocity.velocity;
		let speed = 0;
		if (velocity && typeof velocity === "object") {
			speed = Math.sqrt(
				velocity.x * velocity.x +
					velocity.y * velocity.y +
					velocity.z * velocity.z
			);
		}

		// 将弧度转换为度数并标准化经度
		let longitude = positionGd.longitude * (180 / Math.PI);
		const latitude = positionGd.latitude * (180 / Math.PI);

		// 标准化经度到 -180 到 180 范围
		longitude = ((((longitude + 180) % 360) + 360) % 360) - 180;

		// 计算轨道参数
		const period = (24 * 60) / this.currentTLE.MEAN_MOTION;

		const utcTime = now.toISOString().slice(0, 19).replace("T", " ");
		const localTime = now.toLocaleString("zh-CN");

		const data: StationData = {
			longitude: longitude.toFixed(4),
			latitude: latitude.toFixed(4),
			altitude: positionGd.height.toFixed(2),
			velocity: speed.toFixed(3),
			utcTime,
			localTime,
			period: period.toFixed(2),
			inclination: this.currentTLE.INCLINATION.toFixed(4),
			eccentricity: this.currentTLE.ECCENTRICITY.toFixed(7),
			tleUpdateTime: this.tleTimestamp
				? new Date(this.tleTimestamp).toLocaleString("zh-CN")
				: "--",
		};

		if (this.onDataUpdate) {
			this.onDataUpdate(data);
		}
	}

	public updateOrbitPath(orbitPolyline: LeafletPolyline): void {
		if (!this.satrec || !orbitPolyline) {
			console.log("updateOrbitPath: 地图或卫星数据未准备好");
			return;
		}

		console.log("开始更新轨道路径...");

		// 计算轨道路径（未来90分钟的轨迹）
		const orbitPoints: OrbitPoint[] = [];
		const now = new Date();

		// 每2分钟计算一个点，总共45个点（90分钟）
		for (let i = 0; i <= 45; i++) {
			const futureTime = new Date(now.getTime() + i * 2 * 60 * 1000);
			const positionAndVelocity = satellite.propagate(
				this.satrec,
				futureTime
			);

			// v6.0.0中propagate返回null而不是false
			if (positionAndVelocity !== null && positionAndVelocity.position) {
				const gmstFuture = satellite.gstime(futureTime);
				const positionGd = satellite.eciToGeodetic(
					positionAndVelocity.position as any,
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

		// 更新轨道路径
		orbitPolyline.setLatLngs(orbitSegments);

		// 存储轨道点用于获取终点
		this.lastOrbitPoints = orbitPoints;
	}

	// 获取轨道路径的终点（90分钟后的位置）
	public getOrbitEndPoint(): OrbitPoint | null {
		if (!this.lastOrbitPoints || this.lastOrbitPoints.length === 0) {
			return null;
		}

		// 返回最后一个点
		return this.lastOrbitPoints[this.lastOrbitPoints.length - 1];
	}

	// 分割跨越国际日期线的轨道点
	private splitOrbitAtDateline(points: OrbitPoint[]): OrbitSegment[] {
		if (points.length === 0) return [];

		const segments: OrbitSegment[] = [];
		let currentSegment: OrbitPoint[] = [points[0]];

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

	private updateStatus(message: string, type: Status["type"] = ""): void {
		if (this.onStatusUpdate) {
			this.onStatusUpdate({ message, type });
		}
	}

	private startBackgroundUpdates(): void {
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
			this.initialize();
		}, this.cacheExpiryTime); // 6小时

		// 每分钟更新一次TLE时间显示
		this.timeDisplayInterval = setInterval(() => {
			this.refreshTleTimeDisplay();
		}, 60000); // 1分钟
	}

	private stopBackgroundUpdates(): void {
		if (this.autoUpdateInterval) {
			clearInterval(this.autoUpdateInterval);
			this.autoUpdateInterval = null;
		}

		if (this.tleUpdateInterval) {
			clearInterval(this.tleUpdateInterval);
			this.tleUpdateInterval = null;
		}

		if (this.timeDisplayInterval) {
			clearInterval(this.timeDisplayInterval);
			this.timeDisplayInterval = null;
		}
	}

	// 强制刷新：跳过缓存，直接从网络获取最新数据
	public async forceRefresh(): Promise<void> {
		try {
			this.updateStatus("强制刷新中...", "loading");
			await this.fetchFromNetwork();
		} catch (error) {
			console.error("强制刷新失败:", error);
			this.updateStatus("刷新失败，使用备用数据", "error");
			this.useFallbackData();
		}
	}

	private updateTleTime(timestamp: number, _source: string): void {
		this.tleTimestamp = timestamp;
		this.refreshTleTimeDisplay();
	}

	private refreshTleTimeDisplay(): void {
		if (this.tleTimestamp && this.onDataUpdate) {
			// 触发数据更新以刷新TLE时间显示
			this.updateDisplay();
		}
	}

	public cleanup(): void {
		this.stopBackgroundUpdates();
	}

	public setStationType(stationType: StationType): void {
		if (this.stationType !== stationType) {
			this.stationType = stationType;
			this.cleanup();
			this.initialize();
		}
	}
}
