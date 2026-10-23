# The World Takes Shape

一段 **19.3 秒的工业主题动态影像试片**，展示发明如何成为运转中的机器：从蒸汽、独立冷凝器和旋转运动，走向公用传动轴，以及一台被接通的局部机器。

作品以网页为载体，使用代码生成的原创 Three.js 三维模型、动态工程图纸，以及直接按影片时间计算画面的动画时间线。当前版本已替换主分支上的早期无声试片，旧版源码仍保留在 [Git 提交历史](https://github.com/Epsilonmeow/the-world-takes-shape/tree/3b4ae481778d6dec9b27bcbfd988c321e5ea0f10)中。

![18.3 秒处：工人操纵皮带换位，接通局部机器](media/preview.png)

**[版本发布与视频下载](https://github.com/Epsilonmeow/the-world-takes-shape/releases)**

v2.0.0 的 MP4 已导出，尚待手动上传，文件名为 `centuries-first-19p3-seconds.mp4`。网页播放器已准备好：在 GitHub Pages 中选择 `main` 分支和 `/(root)` 根目录并启用后，可使用 [预计的在线播放地址](https://epsilonmeow.github.io/the-world-takes-shape/)。目前可以按下面的步骤在本机播放。

## 在本机播放

安装 [Node.js](https://nodejs.org/) 20 或更新版本，然后在终端运行：

```sh
git clone https://github.com/Epsilonmeow/the-world-takes-shape.git
cd the-world-takes-shape
npm start
```

打开 **http://127.0.0.1:5196/**。仅播放时无需执行 `npm install`。Three.js、字体和音频片段都已包含在仓库中，下载完成后可以断网播放。请使用支持 WebGL2 的现代浏览器。

播放器默认暂停。**空格**播放或暂停，**← / →**前后移动一帧，**Shift + ← / →**前后移动 0.25 秒；也可以重播、静音或拖动进度条。播放控制为中文，影片中的视觉文字为英文。小屏幕上仍保持 16:9 构图；若要仔细阅读工程标注，建议使用电脑屏幕观看。

## 镜头内容

| 时间（秒） | 画面中的变化 |
| --- | --- |
| 0.0–1.6 | 汽缸内的压力推动活塞，形成运动。 |
| 1.6–3.3 | 反复加热与冷却，暴露出需要改良的问题。 |
| 3.3–5.4 | 蒸汽路径被重新设计，图纸上的开口通向独立空间。 |
| 5.4–7.5 | 冷凝器接通，展示新的工作关系。 |
| 7.5–10.0 | 平面图纸展开成立体机构。 |
| 10.0–12.4 | 日轮与行星轮机构将往复运动转化为旋转运动。 |
| 12.4–14.8 | 飞轮接续运动。 |
| 14.8–17.1 | 镜头跟随运动中的皮带，揭示公用传动轴。 |
| 17.1–19.3 | 镜头沿分支皮带下行；工人将皮带从松轮拨向固轮，带动局部传动轴与车床卡盘。 |

每个短段落都安排一次变化或揭示。尺寸、受力关系、运动轨迹和机械标注随动作出现，让知识成为画面中正在发生的事情。当前试片结束于局部机器接通，尚未展开切削动作或整个工厂的生产场景。

## 画面是怎样制作的

- 使用 **Three.js 0.180.0 和 WebGL2** 绘制三维空间；机器的几何形状由代码生成，图纸与文字使用 Canvas 二维画布绘制。
- 动画直接根据影片时间计算位置、转角和显示状态，因此可以暂停、跳转、重复绘制指定时刻，并逐帧导出。
- 渲染目标采用 **4 重采样抗锯齿**，让边缘更平滑；另有画面合成程序、轻微颗粒，以及按节拍安排的运动冲击。
- 网页播放时以音频的播放时间驱动画面；离线导出时，第 `i` 帧对应时间 `i / 60` 秒。
- 导出工具启动一个不显示窗口的独立浏览器，将本地代码、字体等资源嵌入页面，并阻止浏览器发起网络请求。绘制出的 PNG 帧直接送入 FFmpeg，编码成视频。
- 已导出的 MP4 为 **1920 × 1080、每秒 60 帧、19.3 秒、共 1,158 帧**，使用 H.264 / yuv420p / BT.709，音轨为 48 kHz 双声道 AAC。

WAV 音频连续截取自 **Fall Out Boy 的《Centuries》原曲第 61.0–80.3 秒**，保持原速，音量降低 1 dB，片段首尾各做 5 ms 的淡入、淡出。17.1 秒的续接位置没有拼接或淡出，也没有另外生成演唱、歌词或音效。

## 检查与导出（可选）

仅播放不需要安装 npm 依赖。检查与导出工具需要 Playwright（用于自动控制独立浏览器）；渲染还需要 FFmpeg（视频编码工具），MP4 验证需要 Python 3 和 NumPy：

```sh
npm install
npx playwright install chromium
python -m pip install numpy
```

另行安装 [FFmpeg](https://ffmpeg.org/download.html)，并将它加入 PATH，使终端可以直接运行 `ffmpeg`。下面的离线工具不需要先启动本地网页服务：

```sh
npm run check
npm run stills
npm run render
npm run verify
```

这些命令依次用于检查播放器、导出关键静帧、导出完整视频和验证 MP4。视频写入 `deliverables/centuries-first-19p3-seconds.mp4`；生成的渲染文件和本地报告已设置为不纳入 Git 提交。

如果只想先试着导出一小段：

```sh
node tools/render-offline.cjs --from 17.1 --to 19.3 --width 640 --height 360
```

如需更换工具位置或服务端口，可以设置以下环境变量：

| 环境变量 | 用途 |
| --- | --- |
| `CHROME_PATH` | 指定本机 Chrome / Chromium 程序，替代 Playwright 自带的浏览器。 |
| `FFMPEG_PATH` | 指定 FFmpeg 程序路径。 |
| `PLAYWRIGHT_MODULE` | 为可选工具指定已有的 Playwright 或 playwright-core 模块目录。 |
| `PORT` | 修改本地网页服务端口，默认值为 `5196`。 |

[成片验证记录](docs/verification.json)包含完整解码结果、帧数、音频对齐检查和 SHA-256 文件校验值。网页播放器另行检查了播放、暂停、跳转、逐帧、静音、重播、结束，以及手机布局是否横向溢出。离线成片为每秒 60 帧；网页实时播放的流畅程度取决于设备和显卡性能。

## 历史依据与画面处理

- [瓦特 1765 年模型——英国科学博物馆集团](https://collection.sciencemuseumgroup.org.uk/objects/co50928)：将冷凝过程与工作汽缸分开，可以避免反复冷却汽缸。推动活塞的是压力差，冷凝器并不额外产生一种独立的“拉力”。
- [日轮与行星轮机构模型——英国科学博物馆集团](https://collection.sciencemuseumgroup.org.uk/objects/co51167/model-of-sun-and-planet-gearing)：片中的齿轮段落与 1781 年的旋转动力设计相联系。年份指向设计发展的阶段，不代表画面中整套装置都在该年制造。
- [动力大厅展陈研究——英国科学博物馆集团期刊](https://journal.sciencemuseum.ac.uk/article/prototyping-the-power-hall-a-decision-making-process/)：飞轮惯性和皮带传动，为从单个机构转向动力分配的表现提供依据。
- [工厂动力传动——美国国家公园管理局](https://home.nps.gov/lowe/learn/photosmultimedia/mill_power_drives.htm)：后续传动空间参考了十九世纪逐步发展的工厂动力网络，并非某座 1781 年工厂的精确复原。
- [小型螺纹车床](https://collection.sciencemuseumgroup.org.uk/objects/co46352/small-screw-cutting-lathe)与[带松轮、固轮的轴组件](https://collection.sciencemuseumgroup.org.uk/objects/co52286/shaft-with-fast-loose-pulleys)——英国科学博物馆集团：松轮可以自由转动，同时让本地轴保持静止；皮带移到固轮后，才会带动轴转动。这里的“Fast”表示轮与轴固定连接，不是“更快”。键始终连接着固轮与轴，换位的是皮带。

零件尺寸、镜头运动、剖切、图纸和节奏由创作设计决定。画面中的转角和轮径比来自所绘制机构的状态与几何关系，不是历史实测数据。作品结合了工业发展的多个阶段，没有完整复原某一台原始机器。这些制作说明保留在文档中，不进入影片画面。

## 文件结构

```text
index.html         中文播放器界面
player.js          音频时钟、播放控制、跳转与播放状态
src/main.js        时间线与最终画面合成
src/plate.js       开头的压力、冷热循环与图纸修订
src/tunnel.js      进入独立冷凝器空间的转场
src/power-plate.js 冷凝器接通图示
src/formation.js   图纸展开成立体机构
src/rotary.js      齿轮、飞轮与主传动轴
src/branch.js      局部皮带控制与车床响应
vendor/            本地 Three.js 模块及其许可证
assets/            音频片段、Archivo 字体及字体许可证
tools/             可选的离线检查、渲染与验证工具
docs/              成片验证记录
media/             当前影片的预览画面
```

## 制作与第三方说明

由项目作者与 Codex 协作制作。

- [Three.js](https://github.com/mrdoob/three.js) 使用 MIT 许可证，文本见 [vendor/THREE-LICENSE.txt](vendor/THREE-LICENSE.txt)。
- [Archivo](https://github.com/google/fonts/tree/main/ofl/archivo) 字体使用 SIL Open Font License，文本见 [assets/Archivo-OFL.txt](assets/Archivo-OFL.txt)。
- **音乐：《Centuries》——Fall Out Boy。** 音乐权利归各自权利人所有；本仓库不主张拥有录音或词曲的权利，也不授予再利用该音乐的许可。
- [P(doom)](https://github.com/mexicat/pdoom-video) 是动效质量目标和技术研究的参考，本项目没有收录其美术素材、渲染器源码或音乐。

第三方许可证分别适用于对应文件。仓库公开可见，不等于对原创美术或代码另行授予使用许可。
