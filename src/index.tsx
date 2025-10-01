import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { renderer } from './renderer'

// CSVパーサー関数
function parseRestaurantCSV(csvText: string) {
  const lines = csvText.split('\n');
  const restaurants = [];
  
  // ヘッダーをスキップしてデータ行を処理
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // CSVパーシング（カンマ区切り、ダブルクォート対応）
    const columns = parseCSVLine(line);
    
    if (columns.length >= 8 && columns[1] && columns[2]) { // ジャンルと名前がある場合のみ
      const restaurant = {
        id: parseInt(columns[0]) || restaurants.length + 1,
        genre: columns[1].trim(),
        name: columns[2].trim(),
        address: columns[3]?.trim() || '四万十町',
        coordinates: columns[4]?.trim() || '',
        phone: columns[5]?.trim() || '',
        price: columns[6]?.trim() || '',
        review: columns[7]?.trim() || '',
        photo: columns[8]?.trim() || '',
        photoApp: columns[9]?.trim() || '',
        // 座標は住所が追加されたらジオコーディングで取得予定
        lat: 33.2180 + (Math.random() - 0.5) * 0.01, // 仮の座標（四万十町中心部周辺）
        lng: 132.9360 + (Math.random() - 0.5) * 0.01
      };
      restaurants.push(restaurant);
    }
  }
  
  return restaurants;
}

// CSV行パーサー（カンマとダブルクォート対応）
function parseCSVLine(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // エスケープされたダブルクォート
        current += '"';
        i++; // 次の文字をスキップ
      } else {
        // クォートの開始/終了
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // フィールドの区切り
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current); // 最後のフィールド
  return result;
}

type Bindings = {
  GOOGLE_MAPS_API_KEY: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS設定（API用）
app.use('/api/*', cors())

// 静的ファイルの配信
app.use('/static/*', serveStatic({ root: './public' }))

// レンダラー設定
app.use(renderer)

// メインページ
app.get('/', (c) => {
  return c.render(
    <div id="app">
      <header className="hero-section">
        <div className="hero-content">
          <h1>🚃 四万十町グルメガイド</h1>
          <p>地元高校生おすすめの飲食店 × 写真スポット</p>
          <div className="hero-subtitle">
            <i className="fas fa-train"></i> 汽車で訪れる観光客のためのガイド
          </div>
        </div>
      </header>
      
      <nav className="mobile-tabs" id="mobile-tabs">
        <button className="tab-btn active" data-tab="list">
          <i className="fas fa-list"></i>
          <span>お店一覧</span>
        </button>
        <button className="tab-btn" data-tab="map">
          <i className="fas fa-map"></i>
          <span>地図</span>
        </button>
      </nav>
      
      <div className="container">
        <div className="filter-section">
          <div className="filter-header">
            <h3>ジャンルで探す</h3>
            <div className="restaurant-count" id="restaurant-count">13件</div>
          </div>
          <div id="genre-filters" className="filter-buttons">
            <button className="filter-btn active" data-genre="all">すべて</button>
            <button className="filter-btn" data-genre="定食類">定食類</button>
            <button className="filter-btn" data-genre="麺類">麺類</button>
            <button className="filter-btn" data-genre="スイーツ">スイーツ</button>
            <button className="filter-btn" data-genre="テイクアウト">テイクアウト</button>
          </div>
        </div>

        <div className="main-content">
          <div className="content-panel map-panel" id="map-panel">
            <div className="panel-header">
              <h3><i className="fas fa-map-marked-alt"></i> 地図</h3>
              <button className="close-btn desktop-hidden" data-action="close-map">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div id="map" className="map-container"></div>
          </div>
          
          <div className="content-panel list-panel active" id="list-panel">
            <div className="panel-header">
              <h3><i className="fas fa-utensils"></i> お店一覧</h3>
            </div>
            <div id="restaurant-list" className="restaurant-list">
              <div className="loading">データを読み込み中...</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

// API: レストランデータ取得
app.get('/api/restaurants', async (c) => {
  try {
    console.log('Fetching restaurant data from Google Sheets...');
    
    // Google Sheets CSV URL - 公開シートの場合はこの形式でアクセス
    const sheetId = '1itlpjo95O019S1EZYI3k9dJ0prRivYd9drMH8icTpAI';
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?exportFormat=csv&gid=0`;
    
    console.log('CSV URL:', csvUrl);
    
    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const csvText = await response.text();
    console.log('CSV response (first 500 chars):', csvText.substring(0, 500));
    
    if (csvText.includes('<HTML>')) {
      throw new Error('Received HTML instead of CSV - access denied');
    }
    
    const restaurants = parseRestaurantCSV(csvText);
    console.log('Parsed restaurants:', restaurants.length, 'items');
    console.log('Sample restaurant:', restaurants[0]);
    
    console.log(`Loaded ${restaurants.length} restaurants`);
    return c.json({ restaurants });
    
  } catch (error) {
    console.error('Error fetching restaurant data:', error);
    
    // フォールバックデータ
    const fallbackData = [
      {
        id: 1,
        name: "お祝いキッチン",
        genre: "定食類",
        phone: "0880-22-1080",
        price: "1~1000",
        review: "末広食堂の味を受け継いだ昔ながらの味を再現しています。",
        photo: "https://drive.google.com/file/d/1cmM1zhPvGnAfov7f4UOcftnNS4fvKmH5/view?usp=drive_link",
        lat: 33.2180,
        lng: 132.9360,
        address: "四万十町窄川町中央"
      }
    ];
    
    return c.json({ restaurants: fallbackData });
  }
})

// API: 写真スポットデータ取得
app.get('/api/photo-spots', async (c) => {
  // TODO: 写真スポット用スプレッドシートからデータを取得
  const mockData = []
  
  return c.json({ spots: mockData })
})

// API: Google Maps APIキー取得
app.get('/api/config', async (c) => {
  const { env } = c;
  
  return c.json({
    googleMapsApiKey: env.GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY_HERE'
  });
})

export default app
