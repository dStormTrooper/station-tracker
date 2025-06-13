# 我的铲屎官仰望星空，我用代码为他"摘星"（下）

喵~ 我是利奥，我又回来了！

在上篇中，我们成功拿到了来自 CelesTrak 的"宇宙快递单"——包含了空间站实时轨道信息的 JSON 数据。理论知识已经储备完毕，现在是时候卷起袖子（比喻，我当然没有袖子），开始真正的建造工作了！

准备好见证一只猫如何用代码堆出一个优雅、精确、且充满格调的空间站追踪器了吗？

## 第一步：搭建我们的"观星台" (React + Tailwind)

一个好的追踪器，首先要有一个漂亮的界面。我可不想我的铲屎官每天对着一个丑陋的窗口唉声叹气。

我选择了 **React** 作为"观星台"的骨架，它能将界面拆分成独立的"猫抓板"（组件），让代码逻辑像我码放整齐的毛绒老鼠一样清晰。

至于样式，我用了 **Tailwind CSS**。它让我可以像玩乐高积木一样快速搭建出任何我想要的现代感设计，而不用去写一堆乱糟糟的 CSS 文件。

看看我的主组件 `App.tsx` 是如何将它们结合起来的：

```typescript
// App.tsx
// ...
return (
	<div className="w-[400px] h-[600px] gradient-bg">
		<div className="glass-panel h-full p-5 flex flex-col shadow-xl">
			<Header status={status} />

			<StationSelector
				currentStation={currentStation}
				onStationChange={handleStationChange}
			/>

			<TabNavigation
				currentTab={currentTab}
				onTabChange={handleTabChange}
			/>

			<div className="flex-1 overflow-hidden">
				{currentTab === "data" ? (
					<DataView data={stationData} />
				) : (
					<MapView data={stationData} tracker={tracker} />
				)}
			</div>

			<Controls onRefresh={handleRefresh} />
			<Footer />
		</div>
	</div>
);
```

看到了吗？React 负责搭建清晰的组件结构（`<Header />`, `<DataView />` ...），而 Tailwind 则通过 `className` 里的 `flex`, `p-5`, `shadow-xl` 等工具类，精确地控制每一个元素的样式。优雅，实在是太优雅了。

## 第二步：启动"宇宙引擎" (`satellite.js`)

有了漂亮的界面，我们还需要一个强大的引擎来处理那些来自太空的数据。

将轨道根数转换成实时的经纬度，这背后涉及到相当复杂的轨道动力学计算，如果让我从头开始推导这些公式，恐怕我的猫毛都要算秃了。

但幸运的是，我们不需要重复造轮子。这时，**`satellite.js`** 库就该登场了。

这个库就是我们的"万能翻译官"。我们只需要把从 CelesTrak 获取的 JSON 数据喂给它，它就会施展"数学魔法"，瞬间就算出空间站当前精确的经度、纬度和海拔。所有复杂的轨道动力学计算都被它优雅地封装起来了，我们只管享受结果就行。

简单来说，就是一句话的事：`给我轨道数据，我还你地理坐标`。

```typescript
// 从JSON数据初始化卫星对象
this.satrec = (satellite as any).json2satrec(this.currentTLE);

//...

private updateDisplay(): void {
    if (!this.satrec) return;

    const now = new Date();
    // 关键！计算指定时间的卫星位置
    const positionAndVelocity = satellite.propagate(this.satrec, now);
    // 从结果中获取地理坐标
    const gmst = satellite.gstime(now);
    const geodeticCoordinates = satellite.eciToGeodetic(
        positionAndVelocity.position as satellite.EciVec3<number>,
        gmst
    );

    const longitude = satellite.degreesLong(geodeticCoordinates.longitude);
    const latitude = satellite.degreesLat(geodeticCoordinates.latitude);
    //...
}
```

瞧，有了这个引擎，我们就能在地图上精确地标出空间站的位置了。

## 第三步：安装"上帝之眼" (Leaflet 地图)

数据显示固然重要，但哪有在一张漂亮的地图上亲眼看到一个小点在移动来得直观？

我选择了 **Leaflet.js**，这是一个轻量、简单且强大的开源地图库。配合 **OpenStreetMap** 的免费地图图块，我们就拥有了一张世界地图。

在 React 中使用它也非常简单，我用 `useEffect` 钩子来初始化地图和更新标记物：

```typescript
// ...
useEffect(() => {
	if (mapRef.current && data.latitude !== "--") {
		const lat = parseFloat(data.latitude as string);
		const lon = parseFloat(data.longitude as string);
		const iconUrl = "icons/css.png";

		// 更新地图中心和标记位置
		mapRef.current.setView([lat, lon]);
		if (markerRef.current) {
			markerRef.current.setLatLng([lat, lon]);
			markerRef.current.setIcon(L.icon({ iconUrl, iconSize: [48, 48] }));
		}

		// 更新轨道路径
		if (tracker && orbitPolylineRef.current) {
			tracker.updateOrbitPath(orbitPolylineRef.current);
		}
	}
}, [data.latitude, data.longitude, stationType, tracker]);
```

接下来，我们只需要把 `satellite.js` 计算出的经纬度，变成地图上的一个小图标，并用一条优美的线条画出它未来 90 分钟的轨迹。这样，我的铲屎官就能清楚地看到，那个"天上罐头"下一站会飞过谁家的屋顶。

## 第四步：打包成"便携零食" (浏览器扩展)

程序写好了，怎么让我的铲屎官方便地使用呢？我把它打包成了一个 **Chrome 浏览器扩展**。

这样一来，他不需要运行任何复杂的命令，只需在浏览器右上角轻轻一点，空间站的实时动态就尽收眼底了。这才是猫科动物追求的极致便利。

## 最终优化：让它更"美味"

作为一只追求完美的猫，我还做了一些额外的优化：

-   **数据缓存**：我设置了一个 6 小时的缓存。程序会优先使用本地缓存的数据，只有当数据过期后，才会重新从网络获取。这既能减轻 CelesTrak 服务器的压力，也能在离线时使用，非常高效。
-   **双星系统**：只看一个天宫空间站怎么够？我顺手把国际空间站（ISS）的数据也加了进去。现在，可以一键切换，同时监控两个人类最大的"天上罐头"。

## 成果展示

现在，请看我们的最终成果！一个简洁、美观、功能强大的空间站追踪器。它不仅能实时显示双空间站的经纬度、速度、高度等详细数据，还能在地图上清晰地展示其实时位置和未来轨迹。

![最终效果图](https://raw.githubusercontent.com/Leo-Jo/CSS-Station-Tracker-React/main/screenshots/screenshot-1.png)

怎么样，是不是比我那铲屎官自己捣鼓出来的东西强多了？

通过这个项目，我不仅帮他实现了梦想，也再次证明了，在探索宇宙这件事上，猫的智慧是无穷的。

---

**想亲自上手体验或者看看本喵的优雅代码吗？**

完整的项目源代码和打包好的浏览器扩展，我都放在了 [GitHub](https://github.com/Leo-Jo/CSS-Station-Tracker-React) 上。快去给我的项目点个 Star，然后下载体验吧！

我们下次"猫血来潮"时再见，喵~
