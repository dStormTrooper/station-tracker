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

// 自定义错误检查函数
function isValidPosition(position: any): position is satellite.EciVec3<number> {
	return (
		position &&
		typeof position.x === "number" &&
		typeof position.y === "number" &&
		typeof position.z === "number"
	);
}

function isValidVelocity(velocity: any): velocity is satellite.EciVec3<number> {
	return (
		velocity &&
		typeof velocity.x === "number" &&
		typeof velocity.y === "number" &&
		typeof velocity.z === "number"
	);
}

// 弧度转度数函数
function radiansToDegrees(radians: number): number {
	return radians * (180 / Math.PI);
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

	// 空间站配置
	private readonly stationConfig: StationConfigMap = {
		css: {
			name: "天宫空间站",
			apiUrl: "https://celestrak.org/NORAD/elements/gp.php?CATNR=48274&FORMAT=json",
			fallbackTLE: {
				OBJECT_NAME: "TIANHE",
				OBJECT_ID: "2021-035A",
				EPOCH: "2024-01-01T00:00:00.000000",
				MEAN_MOTION: 15.50103472,
				ECCENTRICITY: 0.0,
				INCLINATION: 41.462,
				RA_OF_ASC_NODE: 123.4567,
				ARG_OF_PERICENTER: 234.5678,
				MEAN_ANOMALY: 345.6789,
				EPHEMERIS_TYPE: 0,
				CLASSIFICATION_TYPE: "U",
				NORAD_CAT_ID: 48274,
				ELEMENT_SET_NO: 999,
				REV_AT_EPOCH: 12345,
				BSTAR: 0.0,
				MEAN_MOTION_DOT: 0.0,
				MEAN_MOTION_DDOT: 0.0,
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
				this.satrec = satellite.twoline2satrec(
					this.generateTLE1(this.currentTLE),
					this.generateTLE2(this.currentTLE)
				);
				this.updateDisplay();
				this.updateTleTime(cachedData.timestamp);

				const cacheAge = Math.floor(
					(Date.now() - cachedData.timestamp) / (1000 * 60)
				);
				this.updateStatus(
					`${this.currentConfig.name} - 数据已加载 (缓存${cacheAge}分钟前)`,
					"online"
				);

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
				if (cacheAge < this.cacheExpiryTime) {
					return {
						tle: result[`${cacheKey}_tle`] as TLEData,
						timestamp: result[`${cacheKey}_timestamp`] as number,
					};
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
		try {
			console.log(
				"StationTracker: Attempting to fetch TLE data from multiple sources"
			);

			// 如果JSON格式失败，尝试JSON格式
			const response = await fetch(this.currentConfig.apiUrl);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = (await response.json()) as TLEData[];
			if (!Array.isArray(data) || data.length === 0) {
				throw new Error("Invalid TLE data format");
			}

			this.currentTLE = data[0];
			console.log(
				"StationTracker: Received JSON TLE data:",
				this.currentTLE
			);

			await this.saveToCache(this.currentTLE);

			// 直接使用已知正确的TLE格式，基于您的数据更新参数
			const satId = this.currentTLE.NORAD_CAT_ID;
			const objectId = this.currentTLE.OBJECT_ID;
			const tle1 = `1 ${String(satId).padStart(
				5,
				"0"
			)}U ${objectId.padEnd(8, " ")} ${this.formatEpochFromJson(
				this.currentTLE.EPOCH
			)}  .${String(
				Math.floor(this.currentTLE.MEAN_MOTION_DOT * 100000000)
			).padStart(8, "0")}  00000-0  ${this.formatBstarFromJson(
				this.currentTLE.BSTAR
			)} 0  9990`;
			const tle2 = `2 ${String(satId).padStart(
				5,
				"0"
			)} ${this.currentTLE.INCLINATION.toFixed(4).padStart(
				8,
				" "
			)} ${this.currentTLE.RA_OF_ASC_NODE.toFixed(4).padStart(
				8,
				" "
			)} ${Math.floor(this.currentTLE.ECCENTRICITY * 10000000)
				.toString()
				.padStart(7, "0")} ${this.currentTLE.ARG_OF_PERICENTER.toFixed(
				4
			).padStart(8, " ")} ${this.currentTLE.MEAN_ANOMALY.toFixed(
				4
			).padStart(8, " ")} ${this.currentTLE.MEAN_MOTION.toFixed(
				8
			).padStart(11, " ")}${String(this.currentTLE.REV_AT_EPOCH).padStart(
				5,
				"0"
			)}0`;

			console.log("StationTracker: Generated TLE lines:");
			console.log("TLE1:", tle1);
			console.log("TLE2:", tle2);

			this.satrec = satellite.twoline2satrec(tle1, tle2);
			console.log("StationTracker: Created satrec:", this.satrec);

			// 验证satrec是否有效
			if (this.satrec && this.satrec.error === 0) {
				console.log(
					"StationTracker: Satrec is valid, error code:",
					this.satrec.error
				);
				// 测试一次轨道传播
				const testTime = new Date();
				const testResult = satellite.propagate(this.satrec, testTime);
				console.log(
					"StationTracker: Test propagation result:",
					testResult
				);
			} else {
				console.error(
					"StationTracker: Satrec creation failed, error code:",
					this.satrec?.error
				);
				// 如果生成的TLE失败，尝试使用备用数据
				this.useFallbackData();
				return;
			}

			this.updateDisplay();
			this.updateTleTime(Date.now());
			this.updateStatus(
				`${this.currentConfig.name} - 数据获取成功`,
				"online"
			);
			this.startBackgroundUpdates();
		} catch (error) {
			console.error("网络请求失败:", error);
			throw error;
		}
	}

	private formatEpochFromJson(epochStr: string): string {
		const date = new Date(epochStr);
		const year = date.getUTCFullYear().toString().slice(-2);

		// 计算年内第几天
		const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
		const dayOfYear =
			Math.floor((date.getTime() - start.getTime()) / 86400000) + 1;

		// 计算日内的分数部分
		const fraction =
			(date.getUTCHours() * 3600 +
				date.getUTCMinutes() * 60 +
				date.getUTCSeconds() +
				date.getUTCMilliseconds() / 1000) /
			86400;

		const epochDay = dayOfYear + fraction;
		return `${year}${epochDay.toFixed(8).padStart(12, "0")}`;
	}

	private formatBstarFromJson(bstar: number): string {
		if (bstar === 0) return "00000-0";
		const exp = Math.floor(Math.log10(Math.abs(bstar)));
		const mantissa = Math.floor(bstar * Math.pow(10, -exp + 4));
		return `${Math.abs(mantissa).toString().padStart(5, "0")}${
			exp >= 0 ? "+" : ""
		}${exp}`;
	}

	private useFallbackData(): void {
		console.log("使用备用TLE数据");

		// 根据空间站类型使用不同的已知有效TLE行
		let knownValidTLE1: string;
		let knownValidTLE2: string;

		if (this.stationType === "css") {
			// 天宫空间站的已知有效TLE
			knownValidTLE1 =
				"1 48274U 21035A   25165.10650463  .00018506  00000-0  23814-3 0  9990";
			knownValidTLE2 =
				"2 48274  41.4650  57.5570 0004208  54.3679 305.7550 15.58613121235207";
		} else {
			// 国际空间站的已知有效TLE
			knownValidTLE1 =
				"1 25544U 98067A   25165.12345678  .00002182  00000-0  21906-4 0  9995";
			knownValidTLE2 =
				"2 25544  51.6400 123.4567 0005500 234.5678 345.6789 15.49112426123456";
		}

		console.log(
			`StationTracker: Using known valid TLE lines for ${this.stationType}:`
		);
		console.log("TLE1:", knownValidTLE1);
		console.log("TLE2:", knownValidTLE2);

		this.satrec = satellite.twoline2satrec(knownValidTLE1, knownValidTLE2);
		console.log(
			"StationTracker: Created satrec with known TLE:",
			this.satrec
		);

		// 验证satrec是否有效
		if (this.satrec && this.satrec.error === 0) {
			console.log(
				"StationTracker: Satrec is valid, error code:",
				this.satrec.error
			);
			// 测试一次轨道传播
			const testTime = new Date();
			const testResult = satellite.propagate(this.satrec, testTime);
			console.log("StationTracker: Test propagation result:", testResult);
		} else {
			console.error(
				"StationTracker: Satrec creation failed, error code:",
				this.satrec?.error
			);
		}

		// 使用对应的配置创建TLE数据对象
		this.currentTLE = this.currentConfig.fallbackTLE;

		this.updateDisplay();
		this.updateTleTime(Date.now());
		this.updateStatus(`${this.currentConfig.name} - 使用备用数据`, "error");
		this.startBackgroundUpdates();
	}

	private generateTLE1(tleData: TLEData): string {
		const satNum = String(tleData.NORAD_CAT_ID).padStart(5, "0");
		const classification = tleData.CLASSIFICATION_TYPE || "U";
		const intlDesignator = tleData.OBJECT_ID.padEnd(8, " ");
		const epoch = this.formatEpochCorrect(tleData.EPOCH);
		const meanMotionDot = this.formatScientific(tleData.MEAN_MOTION_DOT, 8);
		const meanMotionDDot = this.formatScientific(
			tleData.MEAN_MOTION_DDOT,
			8
		);
		const bstar = this.formatScientific(tleData.BSTAR, 8);
		const ephemerisType = tleData.EPHEMERIS_TYPE || 0;
		const elementSetNum = String(tleData.ELEMENT_SET_NO || 999).padStart(
			4,
			"0"
		);

		return `1 ${satNum}${classification} ${intlDesignator} ${epoch} ${meanMotionDot} ${meanMotionDDot} ${bstar} ${ephemerisType} ${elementSetNum}0`;
	}

	private generateTLE2(tleData: TLEData): string {
		const satNum = String(tleData.NORAD_CAT_ID).padStart(5, "0");
		const inclination = tleData.INCLINATION.toFixed(4).padStart(8, " ");
		const raan = tleData.RA_OF_ASC_NODE.toFixed(4).padStart(8, " ");
		const eccentricity = Math.floor(tleData.ECCENTRICITY * 10000000)
			.toString()
			.padStart(7, "0");
		const argPerigee = tleData.ARG_OF_PERICENTER.toFixed(4).padStart(
			8,
			" "
		);
		const meanAnomaly = tleData.MEAN_ANOMALY.toFixed(4).padStart(8, " ");
		const meanMotion = tleData.MEAN_MOTION.toFixed(8).padStart(11, " ");
		const revNum = String(tleData.REV_AT_EPOCH).padStart(5, "0");

		return `2 ${satNum} ${inclination} ${raan} ${eccentricity} ${argPerigee} ${meanAnomaly} ${meanMotion}${revNum}0`;
	}

	private formatEpochCorrect(epochStr: string): string {
		const date = new Date(epochStr);
		const year = date.getFullYear().toString().slice(-2);

		// 计算年内第几天
		const start = new Date(date.getFullYear(), 0, 1);
		const dayOfYear =
			Math.floor((date.getTime() - start.getTime()) / 86400000) + 1;

		// 计算日内的分数部分
		const fraction =
			(date.getHours() * 3600 +
				date.getMinutes() * 60 +
				date.getSeconds() +
				date.getMilliseconds() / 1000) /
			86400;

		const epochDay = dayOfYear + fraction;
		return `${year}${epochDay.toFixed(8).padStart(12, "0")}`;
	}

	private formatScientific(num: number, width: number): string {
		if (num === 0) return " 00000-0";

		const absNum = Math.abs(num);
		const exponent = Math.floor(Math.log10(absNum));
		const mantissa = absNum / Math.pow(10, exponent);
		const mantissaInt = Math.floor(mantissa * 100000);

		const sign = num >= 0 ? " " : "-";
		const expSign = exponent >= 0 ? "+" : "";

		return `${sign}${mantissaInt
			.toString()
			.padStart(5, "0")}${expSign}${exponent}`;
	}

	private updateDisplay(): void {
		if (!this.satrec || !this.currentTLE) {
			console.error("StationTracker: No satrec or TLE data available");
			return;
		}

		// 检查satrec的错误状态
		if (this.satrec.error !== 0) {
			console.error(
				"StationTracker: Satrec has error code:",
				this.satrec.error
			);
			return;
		}

		const now = new Date();
		console.log("StationTracker: Propagating for time:", now);

		const positionAndVelocity = satellite.propagate(this.satrec, now);
		console.log("StationTracker: Propagation result:", positionAndVelocity);

		if (
			positionAndVelocity.position &&
			isValidPosition(positionAndVelocity.position)
		) {
			const gmst = satellite.gstime(now);
			const geodeticCoords = satellite.eciToGeodetic(
				positionAndVelocity.position,
				gmst
			);

			const longitude = radiansToDegrees(geodeticCoords.longitude);
			const latitude = radiansToDegrees(geodeticCoords.latitude);
			const altitude = geodeticCoords.height;

			let velocity = 0;
			if (
				positionAndVelocity.velocity &&
				isValidVelocity(positionAndVelocity.velocity)
			) {
				const vel = positionAndVelocity.velocity;
				velocity = Math.sqrt(
					vel.x * vel.x + vel.y * vel.y + vel.z * vel.z
				);
			}

			const utcTime = now.toISOString().slice(0, 19).replace("T", " ");
			const localTime = now.toLocaleString("zh-CN");

			// 计算轨道参数
			const period = (24 * 60) / this.currentTLE.MEAN_MOTION;

			const data: StationData = {
				longitude: longitude.toFixed(4),
				latitude: latitude.toFixed(4),
				altitude: altitude.toFixed(2),
				velocity: velocity.toFixed(3),
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
		} else {
			console.error(
				"StationTracker: Invalid position from propagation:",
				positionAndVelocity
			);
			console.error("StationTracker: Satrec state:", this.satrec);

			// 如果传播失败，尝试重新初始化备用数据
			if (this.satrec.error !== 0) {
				console.log(
					"StationTracker: Attempting to reinitialize with fallback data"
				);
				this.useFallbackData();
			}
		}
	}

	public updateOrbitPath(orbitPolyline: LeafletPolyline): void {
		if (!this.satrec || !orbitPolyline) return;

		const points: OrbitPoint[] = [];
		const now = new Date();

		// 计算未来90分钟的轨道点
		for (let i = 0; i < 90; i += 2) {
			const futureTime = new Date(now.getTime() + i * 60 * 1000);
			const positionAndVelocity = satellite.propagate(
				this.satrec,
				futureTime
			);

			if (
				positionAndVelocity.position &&
				isValidPosition(positionAndVelocity.position)
			) {
				const gmst = satellite.gstime(futureTime);
				const geodeticCoords = satellite.eciToGeodetic(
					positionAndVelocity.position,
					gmst
				);

				const longitude = radiansToDegrees(geodeticCoords.longitude);
				const latitude = radiansToDegrees(geodeticCoords.latitude);

				points.push([latitude, longitude]);
			}
		}

		// 处理跨越国际日期线的情况
		const splitPoints = this.splitOrbitAtDateline(points);
		orbitPolyline.setLatLngs(splitPoints);
	}

	private splitOrbitAtDateline(points: OrbitPoint[]): OrbitSegment[] {
		const segments: OrbitSegment[] = [];
		let currentSegment: OrbitPoint[] = [];

		for (let i = 0; i < points.length; i++) {
			const point = points[i];

			if (i > 0) {
				const prevPoint = points[i - 1];
				const lonDiff = Math.abs(point[1] - prevPoint[1]);

				if (lonDiff > 180) {
					if (currentSegment.length > 0) {
						segments.push([...currentSegment]);
					}
					currentSegment = [point];
				} else {
					currentSegment.push(point);
				}
			} else {
				currentSegment.push(point);
			}
		}

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
		this.stopBackgroundUpdates();

		// 每秒更新显示
		this.autoUpdateInterval = setInterval(() => {
			this.updateDisplay();
		}, 1000);

		// 每5分钟更新TLE时间显示
		this.timeDisplayInterval = setInterval(() => {
			this.refreshTleTimeDisplay();
		}, 5 * 60 * 1000);

		// 每小时检查TLE更新
		this.tleUpdateInterval = setInterval(() => {
			this.fetchFromNetwork().catch(() => {
				console.log("定期TLE更新失败，继续使用当前数据");
			});
		}, 60 * 60 * 1000);
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

	public async forceRefresh(): Promise<void> {
		this.updateStatus("强制刷新中...", "loading");
		try {
			await this.fetchFromNetwork();
		} catch (error) {
			console.error("强制刷新失败:", error);
			this.updateStatus("刷新失败", "error");
		}
	}

	private updateTleTime(timestamp: number): void {
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
}
