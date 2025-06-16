# 🛰️ 空间站追踪器 - React 版本

[English](README.md) | **中文**

一个实时追踪中国空间站（CSS 天宫）和国际空间站（ISS）位置的浏览器扩展程序。

## ✨ 功能特性

-   🌍 **实时位置追踪** - 显示空间站的精确经纬度、海拔高度和运行速度
-   🗺️ **交互式地图** - 基于 Leaflet.js 的地图显示，实时标记空间站位置
-   🛸 **轨道预测** - 显示未来 90 分钟的飞行轨迹
-   🔄 **双星系统** - 支持中国空间站（CSS）和国际空间站（ISS）切换
-   📱 **现代化界面** - 使用 React + Tailwind CSS 构建的美观界面
-   💾 **智能缓存** - 6 小时数据缓存，提升性能减少 API 调用
-   🌐 **浏览器扩展** - 一键安装，随时访问

## 🎯 快速安装

1. **下载扩展包**

    - 前往 Releases 页面
    - 下载最新版本文件
    - 解压到本地文件夹

2. **安装到浏览器**
    - 打开 Chrome 浏览器，进入扩展程序页面（`chrome://extensions/`）
    - 开启右上角的"开发者模式"
    - 点击"加载已解压的扩展程序"
    - 选择刚才解压的文件夹
    - 安装完成！点击浏览器工具栏中的图标即可使用

## 📊 数据说明

项目使用 CelesTrak 提供的 JSON 格式轨道数据，包含以下关键参数：

-   **INCLINATION** - 轨道倾角，决定空间站飞行的南北范围
-   **ECCENTRICITY** - 轨道偏心率，描述轨道形状
-   **MEAN_MOTION** - 平均运动，每天绕地球的圈数
-   **ARG_OF_PERICENTER** - 近地点幅角
-   **RA_OF_ASC_NODE** - 升交点赤经
-   **MEAN_ANOMALY** - 平近点角 Request

## 📄 许可证

本项目采用 **GNU Affero General Public License v3.0 (AGPL-3.0)** - 查看 [LICENSE](LICENSE) 文件了解详情

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

## 🙏 致谢

-   [CelesTrak](https://celestrak.org/) - 提供实时卫星轨道数据
-   [satellite.js](https://github.com/shashwatak/satellite-js) - 卫星轨道计算库
-   [Leaflet](https://leafletjs.com/) - 开源地图库
-   [OpenStreetMap](https://www.openstreetmap.org/) - 自由的地图数据

---

⭐ 如果这个项目对你有帮助，请给个 Star 支持一下！
