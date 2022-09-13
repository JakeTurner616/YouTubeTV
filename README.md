<div align="center">
<img src="./build/icon.png" width=90px>

# **YouTube TV**
[![Downloads](https://img.shields.io/github/downloads/marcosrg9/YouTubeTV/total.svg?color=FF0000&label=Total%20downloads)](https://github.com/marcosrg9/YouTubeTV/releases/)
[![Downloads](https://img.shields.io/github/downloads/marcosrg9/YouTubeTV/v2.3.2/total.svg?color=blue&label=2.3.2%20Downloads)](https://github.com/marcosrg9/YouTubeTV/releases/2.3.2)

Simple YouTube TV Client for desktop based on [electron](https://www.electronjs.org/). It can connect with a compatible device, like a phone or a computer with Google Chrome and send videos to the application to visualize them.

<img src="./readme/demo_player.png" width="600px">

</div><br>

## 🌎 Languages

This readme is available in the following languages:

- 🇺🇸 English ([alealclag](https://github.com/alealclag))
- 🇪🇸 [Spanish](./README.es-ES.md) (marcosrg9)

It implements a [DIAL](https://en.wikipedia.org/wiki/Discovery_and_Launch) server (based in [SSDP](https://en.wikipedia.org/wiki/Simple_Service_Discovery_Protocol)) to allow connection from devices that use this same protocol (limited to YouTube in this application).

Use the userAgent allowed by YouTube TV:
```
Mozilla/5.0 (X11; Linux i686) AppleWebKit/534.24 (KHTML, like Gecko) Chrome/11.0.696.77 Large Screen Safari/534.24 GoogleTV/092754
```
It can use ```npm start``` or else ```npx electron .``` .
If you already have electron installed globally, you can start the app with ```electron .```

## 📦 Builds
The project can be downloaded already built and ready to use. Available for Linux, macOS and Windows. On x86, x84 and ARM architectures.\
**⚠️ Note: The 32-bit architecture is no longer supported on Linux, and support for Windows is planned to be removed in the future.**

| Platform      |   Architecture   |  Link  |
|---------------|:----------------:|:------:|
| Windows       | x32/x64          | [Download](https://github.com/marcosrg9/YouTubeTV/releases/download/v2.3.2/YouTube.TV.2.3.2.exe) |
| Linux (Deb)   | x64              | [Download](https://github.com/marcosrg9/YouTubeTV/releases/download/v2.3.2/YouTube.TV.2.3.2-amd64.deb) |
| Linux (Deb)   | ARM64            | [Download](https://github.com/marcosrg9/YouTubeTV/releases/download/v2.3.2/YouTube.TV.2.3.2-arm64.deb) |
| Linux (Deb)   | ARMv7l           | [Download](https://github.com/marcosrg9/YouTubeTV/releases/download/v2.3.2/YouTube.TV.2.3.2-armv7l.deb) |
| Linux (RPM)   | x64              | [Download](https://github.com/marcosrg9/YouTubeTV/releases/download/v2.3.2/YouTube.TV.2.3.2-amd64.rpm) |
| Linux (RPM)   | ARM              | [Download](https://github.com/marcosrg9/YouTubeTV/releases/download/v2.3.2/YouTube.TV.2.3.2-armv7l.rpm) |
| macOS         | Intel (x64)      | [Download](https://github.com/marcosrg9/YouTubeTV/releases/download/v2.3.2/YouTube.TV.2.3.2.dmg) |
| macOs         | Apple Chip (ARM) | [Download](https://github.com/marcosrg9/YouTubeTV/releases/download/v2.3.2/YouTube.TV.2.3.2-arm64.dmg) |

[All builds](https://github.com/marcosrg9/YouTubeTV/releases/latest)

## ⌨️ Key shortcuts
- Max. resolution config panel: <kbd>Ctrl</kbd> + <kbd>S</kbd>
- Fullscreen: <kbd>Ctrl</kbd> + <kbd>F</kbd>.
- Developer Tools: <kbd>Ctrl</kbd> + <kbd>D</kbd>.
- Change cursor visibility: <kbd>Ctrl</kbd> + <kbd>A</kbd>.

## ⚙️ Tests

- ✅ Windows 10 x64 - win32_x64/ia32.
- ✅ Ubuntu 19.04 x64 (VM) - linux_x64.
- ✅ macOS 11.4 Big Sur (MacBook Air) - darwin_x64 (Marcos).
- ✅ macOS 11.2.3 Big Sur (MacBook Air) - darwin_x64 (Marcos).
- ✅ macOS 11.1 Big Sur (MacBook Air) - darwin_x64 ([Mateo Fortea](https://github.com/mfortea)).
- ✅ Rasbian 10 Buster (Raspberry Pi 4 B+) - linux_armv7l.

Not tested on Windows and macOS for ARM platforms, except for ARM Linux for Raspberry (armv7l).

## 🔧 Configuration

YouTube TV now includes a window for configuring the maximum playback resolution.

This window can be opened by pressing the keys <kbd>Ctrl</kbd> + <kbd>S</kbd>.
<div align="center">
<img src="./readme/settings.png" width="300">
</div>
Resolution has been limited from the developing environment for the following reason:

Nowadays the mayority of computers are provided with integrated graphics, i.e. they share memory with the rest of the system, different to discrete graphic cards, which include their own memory modules where they have an isolated storage space without external load.

This implies more workload for the processor, and there are cases where resolutions above 2K/4K begin to affect performance at exagereted level.

Obviously the final user can establish the resolution they prefer; nevertheless, YouTube is able to measure bandwith and automatically establish the best resolution available in relation with bandwith, which can be bothering, since frequently hardware capacities aren't enough to reproduce those resolutions that high.