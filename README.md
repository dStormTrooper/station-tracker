# 🛰️ Space Station Tracker - React Edition

**English** | [中文](README_CN.md)

A real-time browser extension for tracking the positions of the Chinese Space Station (CSS Tiangong) and International Space Station (ISS).

## ✨ Features

-   🌍 **Real-time Position Tracking** - Display precise latitude, longitude, altitude, and velocity of space stations
-   🗺️ **Interactive Map** - Leaflet.js-based map display with real-time space station markers
-   🛸 **Orbit Prediction** - Show future 90-minute flight trajectories
-   🔄 **Dual Station System** - Support switching between Chinese Space Station (CSS) and International Space Station (ISS)
-   📱 **Modern Interface** - Beautiful UI built with React + Tailwind CSS
-   💾 **Smart Caching** - 6-hour data caching to improve performance and reduce API calls
-   🌐 **Browser Extension** - One-click installation, access anytime

## 🎯 Quick Installation

1. **Download Extension Package**

    - Go to Releases page
    - Download the latest version file
    - Extract to a local folder

2. **Install to Browser**
    - Open Chrome browser and go to extensions page (`chrome://extensions/`)
    - Enable "Developer mode" in the top right corner
    - Click "Load unpacked" and select the extracted folder
    - Installation complete! Click the icon in browser toolbar to use

## 📊 Data Description

The project uses JSON format orbital data provided by CelesTrak, containing the following key parameters:

-   **INCLINATION** - Orbital inclination, determines the north-south range of space station flight
-   **ECCENTRICITY** - Orbital eccentricity, describes orbital shape
-   **MEAN_MOTION** - Average motion, number of Earth orbits per day
-   **ARG_OF_PERICENTER** - Argument of pericenter
-   **RA_OF_ASC_NODE** - Right ascension of ascending node
-   **MEAN_ANOMALY** - Mean anomaly

## 📄 License

This project is licensed under **GNU Affero General Public License v3.0 (AGPL-3.0)** - see the [LICENSE](LICENSE) file for details

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

## 🙏 Acknowledgments

-   [CelesTrak](https://celestrak.org/) - Provides real-time satellite orbital data
-   [satellite.js](https://github.com/shashwatak/satellite-js) - Satellite orbit calculation library
-   [Leaflet](https://leafletjs.com/) - Open source mapping library
-   [OpenStreetMap](https://www.openstreetmap.org/) - Free map data

---

⭐ If this project helps you, please give it a Star!
