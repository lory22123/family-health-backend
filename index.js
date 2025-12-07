require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
app.use(cors()); // 允許跨域請求
app.use(express.json());

// 從環境變數讀取設定
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
// Zeabur 環境變數中存入的 JSON 字串
const SERVICE_ACCOUNT_KEY = JSON.parse(process.env.GOOGLE_CREDENTIALS);

// 設定 Google Sheets API 認證
const auth = new google.auth.GoogleAuth({
  credentials: SERVICE_ACCOUNT_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// 路由：讀取資料
app.get('/api/records', async (req, res) => {
  try {
    const role = req.query.name || '爸爸'; // 預設爸爸
    
    // 讀取該分頁的所有資料
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${role}!A2:D`, // 假設 A:日期, B:時段, C:收縮壓, D:舒張壓，從第二列開始
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json([]);
    }

    // 取最後 10 筆資料回傳前端
    const last10Rows = rows;
    
    // 轉換格式配合前端需求
    const formattedData = last10Rows.map(row => ({
      date: row[0],
      time: row[1],
      sys: row[2],
      dia: row[3]
    }));

    res.json(formattedData);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '讀取 Google Sheet 失敗', details: error.message });
  }
});

// 路由：寫入資料
// 修改後的寫入路由：增加重複檢查功能
app.post('/api/records', async (req, res) => {
  try {
    const { name, date, time, sys, dia } = req.body;

    if (!name || !date || !sys || !dia) {
      return res.status(400).json({ error: '資料不完整' });
    }

    // 1. 先讀取該家人的所有資料，檢查是否重複
    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${name}!A:B`, // 只讀取日期和時段欄位來比對
    });

    const rows = getResponse.data.values || [];
    
    // 檢查是否有「同日期」且「同時段」的紀錄
    // 注意：Google Sheet 讀出來的日期格式可能不一，這裡做簡單字串比對
    const isDuplicate = rows.some(row => {
        // row[0] 是日期, row[1] 是時段
        // 簡單比對：假設後端存入的是 YYYY-MM-DD 字串
        return row[0] === date && row[1] === time;
    });

    if (isDuplicate) {
        // 回傳 409 Conflict 錯誤狀態
        return res.status(409).json({ error: '該時段已經有資料了，請勿重複輸入！' });
    }

    // 2. 若無重複，則進行寫入
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${name}!A:D`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[date, time, sys, dia]],
      },
    });

    res.json({ message: '寫入成功' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '寫入失敗', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});