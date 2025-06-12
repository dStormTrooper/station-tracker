/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/**/*.html"],
	theme: {
		extend: {
			colors: {
				"station-blue": "#667eea",
				"station-purple": "#764ba2",
			},
			fontFamily: {
				mono: ["Monaco", "Menlo", "Consolas", "monospace"],
			},
			backdropBlur: {
				xs: "2px",
			},
		},
	},
	plugins: [],
};
