import React from "react";
import type { HeaderProps, StatusType } from "../types";

const Header: React.FC<HeaderProps> = ({ status }) => {
	const getStatusClass = (type: StatusType): string => {
		const baseClass =
			"px-4 py-2 rounded-full text-sm font-medium transition-all duration-300";
		switch (type) {
			case "loading":
				return `${baseClass} bg-yellow-100 text-yellow-700`;
			case "online":
				return `${baseClass} bg-green-100 text-green-700`;
			case "error":
				return `${baseClass} bg-red-100 text-red-600`;
			default:
				return `${baseClass} bg-gray-100 text-gray-600`;
		}
	};

	return (
		<div className="text-center mb-5">
			<h1 className="text-2xl font-semibold text-gray-800 mb-2">
				🛰️ 空间站追踪
			</h1>
			<div className={getStatusClass(status.type)}>{status.message}</div>
		</div>
	);
};

export default Header;
