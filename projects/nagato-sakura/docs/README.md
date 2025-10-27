# Nagato-Sakura-Discord-Bot-py

[![GitHub Repo stars](https://img.shields.io/github/stars/AmanoShizukikun/Nagato-Sakura-Discord-Bot-py?style=social)](https://github.com/AmanoShizukikun/Nagato-Sakura-Discord-Bot-py/stargazers)
[![GitHub last commit](https://img.shields.io/github/last-commit/AmanoShizukikun/Nagato-Sakura-Discord-Bot-py)](https://github.com/AmanoShizukikun/Nagato-Sakura-Discord-Bot-py/commits/main)
[![GitHub release](https://img.shields.io/github/v/release/AmanoShizukikun/Nagato-Sakura-Discord-Bot-py)](https://github.com/AmanoShizukikun/Nagato-Sakura-Discord-Bot-py/releases)
[![Discord](https://dcbadge.vercel.app/api/server/dxBcEaFfU2?compact=true&style=flat)](https://discord.gg/dxBcEaFfU2)

\[ 中文 | [English](https://github.com/AmanoShizukikun/Nagato-Sakura-Discord-Bot-py/blob/main/assets/docs/README_en.md) | [日本語](https://github.com/AmanoShizukikun/Nagato-Sakura-Discord-Bot-py/blob/main/assets/docs/README_jp.md) \]

## 簡介
「長門櫻計畫」的目標是打造一個萬能的女僕，你可以透過各種方法不管是語音還是輸入文字甚至是上傳檔案來呼叫女僕「長門櫻」，請她來協助你完成各種任務，而 Nagato-Sakura-Discord-Bot-py 是「長門櫻計畫」的其中一個分支，是以 Python 撰寫的 Discord 機器人作為媒介，來和「長門櫻」溝通的管道之一。

## 公告
- 重新上傳了庫，移除了 2.0.0 以前的版本以及模型檔案，減少倉庫空間提升 git clone 速度。
- 正式實裝「聊天」功能，目前分為 V1(支援 ChatGLM2、ChatGLM3、GLM4)、V2(支援 ChatGLM3、GLM4) 兩個版本。
- 調整了倉庫檔案配置方式，將 models 整合進了 data ， 重新調整了預設 cogs 的內容，只保留了最基礎的功能。

## 近期變動
### 2.1.0 (2025 年 9 月 17 日)
![t2i](https://github.com/AmanoShizukikun/Nagato-Sakura-Discord-Bot-py/blob/main/assets/preview/2.0.1.jpg)
### 重要變更
- 【重大】由於 transformer 的更新，透過 stream_chat 的呼叫方式不再被支援，將 ChatV1 系列移至 old_version。
- 【重大】由於 Youtube_dl 出現問題所以用 Youtube_dlp 來重寫了程式。
### 新增功能
- 【更新】VideoToGif.py - 更新 moviepy 庫的呼叫方式。
### 已知問題
- 【錯誤】Youtube_dl.py 使用/play [網址] 指令時，如果是播放清單會高機率報錯 (處理超時) ，建議使用播放清單時使用 !Play [網址] 來避免程式超時導致的報錯。
- 【錯誤】Youtube_dl.py 異常無法正確撥放音樂。

### 2.0.0 (2024 年 6 月 7 日)
![t2i](https://github.com/AmanoShizukikun/Nagato-Sakura-Discord-Bot-py/blob/main/assets/preview/2.0.0.jpg)
### 重要變更
- 【重大】重新上傳了庫，移除了 2.0.0 以前的版本以及模型檔案，減少倉庫空間提升 git clone 速度。
- 【重大】正式實裝「聊天」功能，目前分為 V1(支援 ChatGLM2、ChatGLM3、GLM4)、V2(支援 ChatGLM3、GLM4) 兩個版本。
- 【重大】調整了倉庫檔案配置方式，將 models 整合進了 data ， 重新調整了預設 cogs 的內容，只保留了最基礎的功能。
- 【重大】添加了 requirements.txt - 現在可以使用 ```pip install -r requirements.txt``` 下載運行所需套件。
### 新增功能
- 【新增】!Chat - 輸入文字和模型聊天，也可以附上錄音檔和模型聊天。
- 【新增】!ChatClear - 清除模型的記憶。
### 已知問題
- 【錯誤】Youtube_dl.py 使用/play [網址] 指令時，如果是播放清單會高機率報錯 (處理超時) ，建議使用播放清單時使用 !Play [網址] 來避免程式超時導致的報錯。

[所有發行版本](https://github.com/AmanoShizukikun/Nagato-Sakura-Discord-Bot-py/blob/main/assets/docs/Changelog.md)

## 快速開始
> [!NOTE]
> 如果沒有用到 Chat 功能或著非 NVIDIA 顯卡可只安裝前三項即可。
### 環境設置
- **Python 3**
  - 下載: https://www.python.org/downloads/windows/
- **FFMPEG**
  - 下載: https://ffmpeg.org/download.html
- **PyTorch**
  - 下載: https://pytorch.org/
- NVIDIA GPU驅動程式
  - 下載: https://www.nvidia.com/zh-tw/geforce/drivers/
- NVIDIA CUDA Toolkit
  - 下載: https://developer.nvidia.com/cuda-toolkit
- NVIDIA cuDNN
  - 下載: https://developer.nvidia.com/cudnn
> [!TIP]
> 請按照當前 PyTorch 支援安裝對應的 CUDA 版本。

### 安裝倉庫
> [!IMPORTANT]
> 此為必要步驟。
```shell
git clone https://github.com/AmanoShizukikun/Nagato-Sakura-Discord-Bot-py.git
cd Nagato-Sakura-Discord-Bot-py
pip install -r requirements.txt
```
> [!IMPORTANT]
> 此為必要步驟。
### 環境修復
<details><summary>Chat環境設定</summary>
由於大語言模型對於環境有不同要求所以在此要添加額外環境
1. 基本環境
```shell
pip install discord.py  
pip install discord.py[voice]
```
2. 適用於 ChatGLM3
```shell
pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cu128
pip install transformers==4.48.3
pip install bitsandbytes  
pip install peft
pip install sentencepiece
```
3. 適用於 Qwen3
```shell
pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cu128
pip install transformers
pip install accelerate
pip install bitsandbytes 
pip install peft 
```
4. 選用功能
```shell
pip install OpenCC
pip install openai-whisper
```

</details>

<details><summary>youtube_dl修復</summary>

1. 尋找youtube-dl中的youtube.py
Microsoft Store 版本路徑
```shell
"C:\Users\使用者名稱\AppData\Local\Packages\PythonSoftwareFoundation.<Python版本>\LocalCache\local-packages\Python310\site-packages\youtube_dl\extractor\youtube.py"
```
一般版本路徑
```shell
"C:\Users\使用者名稱\AppData\Local\Programs\Python\<Python版本>\Lib\site-packages\youtube_dl\extractor\youtube.py"
```
2. 修改youtube.py 修改第1794行 :
```shell
'uploader_id': self._search_regex(r'/(?:channel|user)/([^/?&#]+)', owner_profile_url, 'uploader id') if owner_profile_url else None,
```
直接註釋
```shell
#'uploader_id': self._search_regex(r'/(?:channel|user)/([^/?&#]+)', owner_profile_url, 'uploader id') if owner_profile_url else None,
```
3. 儲存youtube.py

</details>

<details><summary>Translate.py</summary>

1. 尋找googletrans中的client.py
Microsoft Store 版本路徑
```shell
"C:\Users\使用者名稱\AppData\Local\Packages\PythonSoftwareFoundation.<Python版本>\LocalCache\local-packages\Python310\site-packages\googletrans\client.py"
```
一般版本路徑
```shell
"C:\Users\使用者名稱\AppData\Local\Programs\Python\<Python版本>\Lib\site-packages\googletrans\client.py"
```
2. 修改client.py 修改第57行 :
```shell
proxies: typing.Dict[str, httpcore.SyncHTTPTransport] = None,
```
改為
```shell
proxies: typing.Dict[str, httpcore.AsyncHTTPProxy] = None,
```
3. 儲存client.py

</details>

## 待辦事項
- [ ] **高優先度：**
  - [x] 快速安裝指南。
  - [ ] 指令使用指南(wiki)。


- [ ] **功能:**
  - 整合/指令
    - [ ] Game.py
    - [ ] Image.py
    - [ ] Video.py
     
## 致謝
特別感謝以下項目和貢獻者：

### 項目
- [GLM-4](https://github.com/THUDM/GLM-4)
- [ChatGLM3](https://github.com/THUDM/ChatGLM3)
- [discord.py](https://github.com/Rapptz/discord.py)
- [dlib-models](https://github.com/davisking/dlib-models)
- [matplotlib](https://github.com/matplotlib/matplotlib)
- [moviepy](https://github.com/Zulko/moviepy)
- [node-opencv](https://github.com/peterbraden/node-opencv)
- [numexpr](https://github.com/pydata/numexpr)
- [OpenCC](https://github.com/BYVoid/OpenCC)
- [opencv-python](https://github.com/opencv/opencv-python)
- [py-googletrans](https://github.com/ssut/py-googletrans)
- [pydub](https://github.com/jiaaro/pydub)
- [python-qrcode](https://github.com/lincolnloop/python-qrcode)
- [requests](https://github.com/psf/requests)
- [transformers](https://github.com/huggingface/transformers)
- [whisper](https://github.com/openai/whisper)
- [youtube-dl](https://github.com/ytdl-org/youtube-dl)

### 貢獻者
<a href="https://github.com/AmanoShizukikun/Nagato-Sakura-Discord-Bot-py/graphs/contributors" target="_blank">
  <img src="https://contrib.rocks/image?repo=AmanoShizukikun/Nagato-Sakura-Discord-Bot-py" />
</a>
