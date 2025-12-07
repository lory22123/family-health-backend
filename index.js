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
    const last10Rows = rows.slice(-10);
    
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
app.post('/api/records', async (req, res) => {
  try {
    const { name, date, time, sys, dia } = req.body;

    if (!name || !date || !sys || !dia) {
      return res.status(400).json({ error: '資料不完整' });
    }

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
    res.status(500).json({ error: '寫入 Google Sheet 失敗', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});