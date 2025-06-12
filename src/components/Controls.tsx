import React from "react";
import type { ControlsProps } from "../types";

const Controls: React.FC<ControlsProps> = ({ onRefresh }) => {
	return (
		<div className="mt-4">
			<button
				onClick={onRefresh}
				className="w-full py-3 px-4 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-xl font-medium text-gray-800 transition-all duration-300 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50">
				🔄 刷新数据
			</button>
		</div>
	);
};

export default Controls;
