// 空间站数据接口
export interface StationData {
	longitude: string;
	latitude: string;
	altitude: string;
	velocity: string;
	utcTime: string;
	localTime: string;
	period: string;
	inclination: string;
	eccentricity: string;
	tleUpdateTime: string;
}

// 状态类型
export type StatusType = "loading" | "online" | "error" | "";

// 状态接口
export interface Status {
	message: string;
	type: StatusType;
}

// 空间站类型
export type StationType = "css" | "iss";

// 选项卡类型
export type TabType = "data" | "map";

// TLE数据接口
export interface TLEData {
	OBJECT_NAME: string;
	OBJECT_ID: string;
	EPOCH: string;
	MEAN_MOTION: number;
	ECCENTRICITY: number;
	INCLINATION: number;
	RA_OF_ASC_NODE: number;
	ARG_OF_PERICENTER: number;
	MEAN_ANOMALY: number;
	EPHEMERIS_TYPE: number;
	CLASSIFICATION_TYPE: string;
	NORAD_CAT_ID: number;
	ELEMENT_SET_NO: number;
	REV_AT_EPOCH: number;
	BSTAR: number;
	MEAN_MOTION_DOT: number;
	MEAN_MOTION_DDOT: number;
}

// 空间站配置接口
export interface StationConfig {
	name: string;
	apiUrl: string;
	fallbackTLE: TLEData;
}

// 空间站配置映射
export interface StationConfigMap {
	css: StationConfig;
	iss: StationConfig;
}

// Chrome存储结果接口
export interface ChromeStorageResult {
	[key: string]: any;
}

// 缓存数据接口
export interface CachedData {
	tle: TLEData;
	timestamp: number;
}

// 轨道点坐标
export type OrbitPoint = [number, number]; // [latitude, longitude]

// 轨道段
export type OrbitSegment = OrbitPoint[];

// Leaflet多段线
export interface LeafletPolyline {
	setLatLngs(latlngs: OrbitSegment[] | OrbitPoint[]): void;
}

// 组件Props类型
export interface HeaderProps {
	status: Status;
}

export interface StationSelectorProps {
	currentStation: StationType;
	onStationChange: (station: StationType) => void;
}

export interface TabNavigationProps {
	currentTab: TabType;
	onTabChange: (tab: TabType) => void;
}

export interface DataViewProps {
	data: StationData;
}

export interface MapViewProps {
	data: StationData;
	tracker: StationTracker | null;
}

export interface ControlsProps {
	onRefresh: () => void;
}

// 空间站追踪器类型声明
export interface StationTracker {
	onDataUpdate: ((data: StationData) => void) | null;
	onStatusUpdate: ((status: Status) => void) | null;
	initialize(): Promise<void>;
	forceRefresh(): Promise<void>;
	updateOrbitPath(orbitPolyline: LeafletPolyline): void;
	getOrbitEndPoint(): OrbitPoint | null;
	cleanup(): void;
}
