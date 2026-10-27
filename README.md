# 🀄 拉密神助手 (Rummikub AI Solver & Calculator)

一個功能完備、具備專業數學整數規劃 (MILP) 演算法與電腦視覺影像辨識的**拉密 (Rummikub) 計算與分析程式**。

---

## ✨ 核心功能

1. **出牌計算與最佳重組 (Optimal Meld Partitioning)**:
   - 基於 `SciPy HiGHS MILP` 整數規劃求解器，在數毫秒內精確計算出最優出牌策略。
   - 支援自由拆解、重組桌面牌組 (順組與群組)。
   - **破冰模式 (首出 &ge; 30 分)**：嚴格依照官方規則，限制首出必須從手牌單獨組成大於等於 30 分的牌組，且不得借用桌面牌。
   - 清晰視覺化標註新桌面的牌組，手牌打出的牌以金光與「手牌」徽章凸顯。

2. **關鍵牌聽牌與獲勝分析 (Key Winning Tiles & Synergies)**:
   - **一進聽 (胡牌關鍵牌)**：自動掃描全部 53 種牌張，精準預測摸進哪一張牌即可直接全出手牌獲勝 (Rummikub)！
   - **出牌突破關鍵牌**：若當前無法直接全出獲勝，列出摸進哪張牌能解鎖打出最多手牌的關鍵突破牌。
   - **手牌搭子分析**：自動分析手牌中的雙向順組搭子、中洞 (嵌張) 搭子、對子群組，並標註所缺牌張。

3. **桌面牌手動設置與圖片辨識 (Board Tiles Input & Vision)**:
   - **手動點選調色盤**：一秒快速點選紅、藍、黃、黑 1~13 與百搭牌。
   - **📷 放置圖片辨識功能**：
     - **⚡ 本機 OpenCV 影像辨識**：100% 離線秒級辨識，自動尋找桌面牌矩形、輪廓及 HSV 顏色分離與數字比對。
     - **✨ Gemini AI 智能辨識**：選配支援 Gemini 2.5 Flash 零樣本視覺模型，能處理傾斜角度、陰影與反光。
     - **即時校對面板**：辨識完成後可一鍵點擊牌面修正或補加漏檢牌，確保 100% 準確率。

---

## 🚀 快速啟動

### 方法一：Windows 一鍵啟動
直接雙擊執行目錄中的：
```text
run.bat
```

### 方法二：命令列啟動
```powershell
cd C:\Users\timch\.gemini\antigravity\scratch\rummikub_solver
python app.py
```

伺服器啟動後，請在瀏覽器打開：
👉 **http://localhost:8080**

---

## 📁 專案架構

```text
rummikub_solver/
├── app.py                  # Web 應用主程式 (REST API + 靜態網頁伺服器)
├── run.bat                 # Windows 一鍵啟動腳本
├── solver/
│   ├── engine.py           # MILP 核心求解器 (合規牌組生成、約束矩陣、最適化求解)
│   ├── key_tiles.py        # 關鍵牌分析 (一進聽計算、突破牌評估、搭子分析)
│   └── test_solver.py      # 求解器單元測試套件
├── vision/
│   ├── detector.py         # OpenCV 影像辨識 (邊界輪廓、HSV 顏色分類、數字模板比對)
│   ├── gemini_vision.py    # Gemini 視覺模型 API 介面 (選填 API Key)
│   └── templates/          # 預產生的 1~13 數字比對模板
├── static/
│   ├── index.html          # 單頁應用前端 (遊戲桌台風格介面)
│   ├── css/
│   │   └── style.css       # 擬真拉密牌樣式、動態高亮光效與響應式排版
│   └── js/
│       ├── tiles.js        # 牌張渲染、顏色對應與排序工具
│       └── app.js          # 前端互動邏輯 (拖曳上傳、校對面板、API 調度)
└── README.md
```
