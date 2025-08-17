# Discord 評價機器人（輕量版）

一個功能輕量的 Discord 評價機器人，可以輕鬆創建和管理抽獎活動。

## 功能

- 給予商品評價
- 切換匿名顯示設定（頭像/用戶名稱）
- 顯示評價統計（橫向條狀圖 + 平均分）
- 搜尋評論（內容 / 用戶名稱 / 商品名稱）
- 匯出所有評論記錄檔

## 安裝

1. 克隆此倉庫
2. 安裝依賴項：
   ```
   npm i discord.js chart.js chartjs-node-canvas
   ```
3. 在 `config.json` 文件中填入您的機器人令牌和客戶端ID

## 配置

在 `config.json` 文件中編輯以下設置：

```json
{
  "token": "你的BotToken",
  "clientId": "你的ClientID",
  "guildId": "你的GuildID",
  "channelId": "要顯示評價的文字頻道ID"
}
```

- `token`: 您的Discord機器人令牌
- `clientId`: 您的Discord應用程式ID
- `guildId`: 您想要註冊命令的伺服器ID（僅在 `registerGlobally` 為 false 時使用）
- `channelId`: 評價訊息要顯示的頻道

## 使用方法

1. 啟動機器人：
   ```
   node index.js
   ```

2. 使用以下斜線命令：

   - `/review` - 給予商品評價
   - `/toggle_anonymous` - 切換匿名顯示設定（頭像/用戶名稱）
   - `/stats_reviews` - 顯示評價統計（橫向條狀圖 + 平均分）
   - `/search_reviews` - 搜尋評論（內容 / 用戶名稱 / 商品名稱）
   - `/export_reviews` - 匯出所有評論記錄檔

## 注意事項

- 機器人需要 `SEND_MESSAGES`、`EMBED_LINKS` 和 `USE_EXTERNAL_EMOJIS` 權限才能正常運作
- 評價數據存儲在本地 `reviews.log` 數據庫中

## 許可證

MIT

