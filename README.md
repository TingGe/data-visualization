# data-visualization
数据可视化：基于d3.js 或 fabric.js 等

## 市场图表

### 偏展现图表

| 图表                                       | 特点   |
| ---------------------------------------- | ---- |
| [Echarts](http://echarts.baidu.com/index.html) |      |
| [G2](https://antv.alipay.com/index.html) |      |
| [vega](https://vega.github.io/vega/)     |      |
| [Vega-Lite](https://vega.github.io/vega/) |      |

### 偏交互图表

| 图表                                       | 特点                                       |
| ---------------------------------------- | ---------------------------------------- |
| [Fabric.js](http://fabricjs.com/)        |                                          |
| [konva](http://konvajs.github.io/)       |                                          |
| [D3](https://d3js.org/)                  |                                          |
| [JavaScript InfoVis Toolkit](https://github.com/philogb/jit) |                                          |
| [Protovis](http://mbostock.github.io/protovis/ex/) | D3.js 前身，使用SVG的可视化JS。从后续发展看，不建议在新项目中采用。如重新设计新可视化JS，可参考。 |

### 其它

| 图表                                       | 特点                                       |
| ---------------------------------------- | ---------------------------------------- |
| [Deck.gl](https://github.com/uber/deck.gl) | WebGL 大规模数据展现                            |
| [Planck.js](https://github.com/shakiba/planck.js) | 2D 物理引擎                                  |
| [whs.js](https://github.com/WhitestormJS/whs.js) | 基于Three.js，适用于 Web 应用程序与游戏的3D框架          |
| [Embedding Projector](https://www.tensorflow.org/get_started/embedding_viz) | 谷歌开源的高维数据可视化                             |
| [Phaser](https://github.com/photonstorm/phaser) | HTML5 Game Framework                     |
| [AnyPixel.js](http://googlecreativelab.github.io/anypixel) | 谷歌，个人认为比较适合交互式大屏                         |
| [LayerVisualizer](https://github.com/romannurik/LayerVisualizer) | 一个简单的基于Web的3D图层（可用于可视化材质UI和涉及深度/阴影的其他事物） |


## 项目

### 图片标定

calibrationbox：一个 [Fabric](http://fabricjs.com/) 的小插件，可用于标定图片中车辆、人、交通灯标识、区域等。详见，[calibration-box](https://github.com/TingGe/calibration-box) 项目。

![](https://github.com/TingGe/calibration-box/raw/master/assets/calibrationbox.png)

### 网络攻击地图

- norsecorp

![](./assets/norsecorp.png)

- ipviking

  ![](./assets/ipviking.png)

### 访问者流报告

netflow：借鉴 Google Analytics 行为流 ，修改自 [netFlow](https://github.com/jdk137/netFlow/)

![](./assets/netflow.png)

## 运行

1. 依赖 [Node](https://nodejs.org/)、[http-server](https://github.com/indexzero/http-server)
2. 在 data-visualization/server 目录执行 `npm install` 后，运行 `npm start` 启动（默认9999端口）
3. 在 data-visualization 目录执行 `http-server`
4. 根据 `http-server` 中提示的网址，在浏览器（建议 Chrome ）中访问
5. 关闭命令窗口即可退出

## 附录

- [数据可视化工具目录](http://www.datavizcatalogue.com/ZH/index.html)
- [Sankey Diagrams](https://bost.ocks.org/mike/sankey/)
- [读书笔记 - 数据可视化实践](http://blog.lyuehh.com/book/2013/05/25/reading-notes-Interactive-Data-Visualization.html)
- [F1 Championship Points as a d3.js Powered Sankey Diagram](https://blog.ouseful.info/2012/05/24/f1-championship-points-as-a-d3-js-powered-sankey-diagram/)
- [前端模块化开发DEMO之攻击地图](http://fuxiaode.cn/blog/2015/12/05/attack-map-with-amd)：推荐 @[依宁](https://github.com/danislyn) 的一版[攻击地图](http://fuxiaode.cn/demo/AttackMap/index.html)，感觉不错！
- [konva](http://konvajs.github.io/)：呈现能力不错，但与  [Fabric](http://fabricjs.com/) 相比交互较弱。

## 反馈

[https://github.com/TingGe/data-visualization/issues](https://github.com/TingGe/data-visualization/issues)

## 贡献

[https://github.com/TingGe/data-visualization/graphs/contributors](https://github.com/TingGe/data-visualization/graphs/contributors)

## 许可

(The MIT License)

Copyright (c)  Ting Ge [505253293@163.com](mailto:505253293@163.com)


