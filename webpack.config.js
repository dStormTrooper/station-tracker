const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

const isMobile = process.env.BUILD_TARGET === "mobile";

module.exports = {
	entry: {
		[isMobile ? "index" : "popup"]: isMobile
			? "./src/mobile.tsx"
			: "./src/popup.tsx",
	},
	output: {
		path: path.resolve(__dirname, "dist"),
		filename: "[name].js",
		clean: true,
	},
	module: {
		rules: [
			{
				test: /\.(ts|tsx)$/,
				exclude: /node_modules/,
				use: [
					{
						loader: "babel-loader",
						options: {
							presets: [
								[
									"@babel/preset-react",
									{
										runtime: "automatic",
									},
								],
								"@babel/preset-typescript",
							],
						},
					},
				],
			},
			{
				test: /\.css$/,
				use: ["style-loader", "css-loader"],
			},
		],
	},
	plugins: [
		new HtmlWebpackPlugin({
			template: isMobile ? "./public/mobile.html" : "./public/popup.html",
			filename: isMobile ? "index.html" : "popup.html",
			chunks: [isMobile ? "index" : "popup"],
		}),
		new CopyWebpackPlugin({
			patterns: [
				...(isMobile
					? []
					: [{ from: "public/manifest.json", to: "manifest.json" }]),
				{ from: "icons", to: "icons" },
				{
					from: "node_modules/leaflet/dist/leaflet.css",
					to: "leaflet.css",
				},
				{ from: "src/styles/styles.css", to: "styles.css" },
			],
		}),
	],
	resolve: {
		extensions: [".ts", ".tsx", ".js", ".jsx"],
	},
	devtool: "source-map",
};
