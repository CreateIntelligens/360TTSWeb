# 360 TTS Multiverse Hub

這是一個輕量級、美觀且具備高保真語音合成功能的單網頁應用程式（SPA），可用於本地部署或直接託管至 GitHub Pages 上。它整合了 `talk-dev.aitago.tw` 伺服器上的多個 TTS 服務，提供使用者和團隊進行展示與音色測試。

## 🌟 核心功能
- **多模型即時切換**：
  - **IndexTTS (Main) [Port 8001]**：主模型，支援豐富的中文角色預設與上傳音訊複製。
  - **IndexTTS (TW) [Port 8002]**：針對台灣國語腔調與閩南話特別優化的在地口音模型。
  - **CosyVoice 3 [Port 8003]**：阿里開源最新聲音克隆系統，支援預訓練音色（SFT）與零樣本克隆（Zero-Shot，音色複製）。
  - **Qwen TTS [Port 8005]**：基於 1.7B 參數量的大型語音合成模型，支援中、英、日、韓、法、德等十餘種語言的混讀。
- **極速聲音克隆**：
  - **IndexTTS 克隆 (`/tts_upload`)**：支援透過上傳 3-10 秒參考音訊並調整隨機種子（Seed）進行克隆。
  - **CosyVoice 3 零樣本克隆 (`Zero-Shot`)**：提供音檔上傳與參考文字檔（Prompt Text）欄位，複製效果逼真自然。
- **Canvas 音頻波形圖**：
  - 將二進制音訊資料解碼，透過 `<canvas>` 繪製精美且具備互動性的柱狀音軌。
  - 支援在波形上點擊調整進度（Seek），並隨播放進度呈現漸變紫色與青色的填充狀態。
- **本地合成紀錄**：
  - 基於瀏覽器 **IndexedDB**（資料庫名稱 `360TTSHubDB`）進行本地持久化儲存。
  - 包含生成文字、時間、選用模型、聲音名稱及音訊 Blob。支援重播、單獨下載與管理刪除，安全且不佔用伺服器資源。
- **可配置設定**：
  - 支援在介面中動態設定 API 連線主機（Host）以及自訂各端口的 URL。
  - 提供 CORS 代理欄位，幫助繞過部分網絡與瀏覽器安全阻擋。

## 🚀 部署至 GitHub Pages
此專案沒有任何複雜的打包工具或編譯流程。您只需要：
1. 將此儲存庫 Clone 至您的本地或 Fork 專案。
2. 進入儲存庫的 **Settings** -> **Pages**。
3. 將 Build and deployment 的 Source 設定為 `Deploy from a branch`。
4. 選擇 `main` 分支的 `/ (root)`，並點擊 Save。
5. 稍等片刻，即可透過生成的 `https://<您的 GitHub 帳號>.github.io/360TTSWeb/` 開啟服務！

---

## 🔒 瀏覽器安全限制與 CORS 指引（重要）

由於 GitHub Pages 強制使用 **HTTPS** 安全連接，而後端 API 通常為 **HTTP**，瀏覽器可能會因為以下規範阻擋請求：

1. **混合內容 (Mixed Content)**：
   - 瀏覽器預設不允許 HTTPS 網頁直接發送非加密的 HTTP 請求。
   - **解決方案**：在網址列右側的安全盾牌或網頁安全性設定中，選取 **「允許載入不安全指令碼」**，或者在下載後直接在本地雙擊打開 `index.html` 執行。
2. **CORS（跨來源資源共享）限制**：
   - 目前 `talk-dev.aitago.tw` 上的 `8001`、`8002`、`8003` (CosyVoice已修復) 及 `8005` 均已配備對應的 CORS 跨網域允許標頭，因此跨網域存取運作正常。
   - 若您在使用中遇到 CORS 封鎖，可以在網頁**「設定」**分頁配置 CORS 代理（如 `https://cors-anywhere.herokuapp.com/`）來轉發請求。

## 📄 授權條款
本專案採用 **GNU Affero General Public License v3.0 (AGPL-3.0)** 條款授權開源。
