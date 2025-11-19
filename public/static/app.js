// 四万十町グルメガイド JavaScript

// アプリケーション状態
let restaurants = [];
let photoSpots = [];
let map = null;
let markers = [];

// 初期化
document.addEventListener('DOMContentLoaded', async function() {
    console.log('四万十町グルメガイド - 初期化開始');
    
    // データ読み込み
    await loadData();
    
    // イベントリスナー設定
    setupEventListeners();
    
    // Google Maps API を動的に読み込み
    await initializeGoogleMaps();
});

// データ読み込み
async function loadData() {
    try {
        console.log('データ読み込み開始...');
        
        // レストランデータと写真スポットデータを並列で取得
        const [restaurantResponse, spotResponse] = await Promise.all([
            axios.get('/api/restaurants'),
            axios.get('/api/photo-spots')
        ]);
        
        restaurants = restaurantResponse.data.restaurants || [];
        photoSpots = spotResponse.data.spots || [];
        
        console.log(`読み込み完了: レストラン${restaurants.length}件, 写真スポット${photoSpots.length}件`);
        
        // レストランリストを即座に表示（ジオコーディング前）
        displayRestaurants(restaurants);
        
        // ジャンルフィルターにスポットカテゴリを追加
        updateGenreFilters();
        
        // ジオコーディングはバックグラウンドで非同期実行
        Promise.all([
            geocodeRestaurants(),
            geocodeSpots()
        ]).then(() => {
            console.log('ジオコーディング完了 - 地図を更新');
            // ジオコーディング完了後、地図があれば更新
            if (map) {
                markers.forEach(m => m.setMap(null));
                markers = [];
                addMarkersToMap(restaurants);
                addSpotsToMap(photoSpots);
            }
        });
        
    } catch (error) {
        console.error('データ読み込みエラー:', error);
        document.getElementById('restaurant-list').innerHTML = 
            '<div class="loading">データの読み込みに失敗しました。しばらく後でお試しください。</div>';
    }
}

// イベントリスナー設定
function setupEventListeners() {
    // ジャンルフィルターボタン
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // アクティブボタン切り替え
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // フィルタリング実行
            const genre = this.dataset.genre;
            filterRestaurants(genre);
        });
    });
    
    // モバイルタブ切り替え
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.dataset.tab;
            switchToTab(targetTab);
        });
    });
    
    // 地図クローズボタン
    const closeBtn = document.querySelector('[data-action="close-map"]');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            switchToTab('list');
        });
    }
}

// レストランフィルタリング
function filterRestaurants(genre) {
    console.log('フィルタリング:', genre);
    
    let filteredRestaurants;
    if (genre === 'all') {
        filteredRestaurants = restaurants;
        
        // 「すべて」の場合は地図上にスポットも表示
        if (map) {
            markers.forEach(m => m.setMap(null));
            markers = [];
            addMarkersToMap(restaurants);
            addSpotsToMap(photoSpots);
        }
    } else {
        filteredRestaurants = restaurants.filter(restaurant => 
            restaurant.genre === genre
        );
        
        // 特定ジャンルの場合はレストランマーカーのみ
        if (map) {
            markers.forEach(m => m.setMap(null));
            markers = [];
            addMarkersToMap(filteredRestaurants);
        }
    }
    
    displayRestaurants(filteredRestaurants);
    updateRestaurantCount(filteredRestaurants.length);
}

// レストランリスト表示
function displayRestaurants(restaurantList) {
    const listElement = document.getElementById('restaurant-list');
    
    if (restaurantList.length === 0) {
        listElement.innerHTML = '<div class="loading">該当するレストランが見つかりません。</div>';
        return;
    }
    
    const html = restaurantList.map(restaurant => {
        // 近くの写真スポット検索
        const nearbySpots = findNearbyPhotoSpots(restaurant);
        
        // ダミー写真のURL（後でスプレッドシートの写真と連動）
        const imageUrl = getRestaurantImage(restaurant);
        
        return `
            <div class="restaurant-card" data-id="${restaurant.id}" onclick="handleRestaurantClick(${restaurant.id})">
                <img src="${imageUrl}" alt="${restaurant.name}" class="restaurant-image" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&h=200&fit=crop&crop=center';" crossorigin="anonymous">
                <div class="restaurant-content">
                    <div class="restaurant-name">${restaurant.name}</div>
                <span class="restaurant-genre">${restaurant.genre}</span>
                <div class="restaurant-price">💰 ${restaurant.price}円</div>
                <div class="restaurant-review">"${restaurant.review}"</div>
                
                ${restaurant.address ? `
                    <div class="restaurant-info" style="margin-bottom: 0.5rem;">
                        <span><i class="fas fa-map-marker-alt"></i> ${restaurant.address}</span>
                    </div>
                ` : ''}
                
                ${nearbySpots.length > 0 ? `
                    <div class="photo-spots">
                        <h5><i class="fas fa-camera"></i> 近くの写真スポット</h5>
                        ${nearbySpots.map(spot => 
                            `<div class="spot-item">📍 ${spot.name} (徒歩${spot.distance}分)</div>`
                        ).join('')}
                    </div>
                ` : ''}
                
                    <div class="restaurant-info">
                        <span><i class="fas fa-phone"></i> ${restaurant.phone}</span>
                        <span><i class="fas fa-map-marker-alt"></i> 地図で見る</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    listElement.innerHTML = html;
}

// 近くの写真スポット検索
function findNearbyPhotoSpots(restaurant) {
    if (!restaurant.lat || !restaurant.lng || photoSpots.length === 0) {
        return [];
    }
    
    const nearby = photoSpots
        .map(spot => {
            if (!spot.lat || !spot.lng) return null;
            
            const distance = calculateDistance(
                restaurant.lat, restaurant.lng,
                spot.lat, spot.lng
            );
            
            return {
                ...spot,
                distance: Math.round(distance * 1000 / 80) // 徒歩時間（分）概算
            };
        })
        .filter(spot => spot && spot.distance <= 8) // 徒歩8分以内
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3); // 最大3個まで
    
    return nearby;
}

// 距離計算（ハーバーサイン公式）
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // 地球の半径（km）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Google Maps 初期化
function initMap() {
    console.log('Google Maps初期化');
    
    // 四万十町中心部
    const center = { lat: 33.212317, lng: 133.1346126 };
    
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 16,
        center: center,
        styles: [
            {
                featureType: 'poi',
                stylers: [{ visibility: 'off' }]
            }
        ]
    });
    
    // レストランマーカー追加
    addMarkersToMap(restaurants);
    
    // スポットマーカー追加（別の色）
    addSpotsToMap(photoSpots);
}

// マップにマーカー追加
function addMarkersToMap(restaurantList) {
    if (!map) return;
    
    // 既存マーカークリア
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    
    restaurantList.forEach(restaurant => {
        if (!restaurant.lat || !restaurant.lng) return;
        
        const marker = new google.maps.Marker({
            position: { lat: restaurant.lat, lng: restaurant.lng },
            map: map,
            title: restaurant.name,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#667eea',
                fillOpacity: 0.8,
                strokeWeight: 2,
                strokeColor: '#ffffff'
            }
        });
        
        // 情報ウィンドウ
        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div style="max-width: 250px;">
                    <h4 style="margin: 0 0 8px 0; color: #333;">${restaurant.name}</h4>
                    <div style="color: #666; font-size: 12px; margin-bottom: 4px;">${restaurant.genre}</div>
                    <div style="color: #059669; font-weight: bold; margin-bottom: 8px;">💰 ${restaurant.price}円</div>
                    <div style="font-size: 13px; line-height: 1.4; margin-bottom: 8px;">"${restaurant.review}"</div>
                    <div style="color: #666; font-size: 12px;">
                        <i class="fas fa-phone"></i> ${restaurant.phone}
                    </div>
                </div>
            `
        });
        
        marker.addListener('click', () => {
            infoWindow.open(map, marker);
        });
        
        markers.push(marker);
    });
}

// スポットマーカーを地図に追加（別の色）
function addSpotsToMap(spotList) {
    // 既存のスポットマーカーを削除
    markers.filter(m => m.spotMarker).forEach(m => m.setMap(null));
    
    spotList.forEach(spot => {
        if (!spot.lat || !spot.lng) {
            console.log('スポットの座標がありません:', spot.name);
            return;
        }
        
        const marker = new google.maps.Marker({
            position: { lat: spot.lat, lng: spot.lng },
            map: map,
            title: spot.name,
            spotMarker: true, // スポットマーカーのフラグ
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#f59e0b', // オレンジ色（スポット用）
                fillOpacity: 0.9,
                strokeWeight: 2,
                strokeColor: '#ffffff'
            }
        });
        
        // 情報ウィンドウ
        const photoHtml = spot.photo ? 
            `<img src="${getSpotImage(spot)}" alt="${spot.name}" style="width: 100%; max-width: 200px; height: 120px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;" onerror="this.style.display='none';" crossorigin="anonymous">` : '';
        
        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div style="max-width: 250px;">
                    ${photoHtml}
                    <h4 style="margin: 0 0 8px 0; color: #333;">📸 ${spot.name}</h4>
                    <div style="color: #666; font-size: 12px; margin-bottom: 4px;">${spot.category || 'おすすめスポット'}</div>
                    ${spot.timeOfDay ? `<div style="color: #f59e0b; font-size: 12px; margin-bottom: 8px;">🕐 ${spot.timeOfDay}</div>` : ''}
                    <div style="font-size: 13px; line-height: 1.4; margin-bottom: 8px;">${spot.description}</div>
                    <div style="color: #666; font-size: 11px;">
                        <i class="fas fa-map-marker-alt"></i> ${spot.address}
                    </div>
                </div>
            `
        });
        
        marker.addListener('click', () => {
            infoWindow.open(map, marker);
        });
        
        markers.push(marker);
    });
}

// マップマーカー更新
function updateMapMarkers(restaurantList) {
    if (map) {
        addMarkersToMap(restaurantList);
    }
}

// レストランを地図で表示
function showRestaurantOnMap(restaurantId) {
    const restaurant = restaurants.find(r => r.id === restaurantId);
    if (!restaurant || !restaurant.lat || !restaurant.lng || !map) {
        console.log('地図機能は現在無効です:', restaurant?.name || restaurantId);
        return;
    }
    
    // 地図中央に移動
    map.setCenter({ lat: restaurant.lat, lng: restaurant.lng });
    map.setZoom(16);
    
    // 該当マーカーの情報ウィンドウを表示
    const marker = markers.find(m => m.getTitle() === restaurant.name);
    if (marker) {
        google.maps.event.trigger(marker, 'click');
    }
}

// Google Maps API を動的に読み込み
async function initializeGoogleMaps() {
    try {
        console.log('Google Maps API 設定を取得中...');
        
        // API設定を取得
        const configResponse = await axios.get('/api/config');
        const apiKey = configResponse.data.googleMapsApiKey;
        
        if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
            console.log('Google Maps API キーが設定されていません');
            showMapPlaceholder();
            return;
        }
        
        console.log('Google Maps API を読み込み中...');
        
        // Google Maps API スクリプトを動的に読み込み
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=ja&region=JP&callback=initMap`;
        script.async = true;
        script.defer = true;
        
        // エラーハンドリング
        script.onerror = function() {
            console.error('Google Maps API の読み込みに失敗しました');
            showMapPlaceholder();
        };
        
        document.head.appendChild(script);
        
    } catch (error) {
        console.error('Google Maps API 設定の取得に失敗:', error);
        showMapPlaceholder();
    }
}

// 地図のプレースホルダーを表示
function showMapPlaceholder() {
    document.getElementById('map').innerHTML = 
        '<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f3f4f6; color: #6b7280; text-align: center; padding: 2rem;">' +
        '<div><i class="fas fa-map-marked-alt" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>' +
        'Google Maps API 設定後に地図が表示されます</div></div>';
}

// タブ切り替え機能
function switchToTab(tabName) {
    // タブボタンのアクティブ状態切り替え
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // パネルの表示切り替え
    const listPanel = document.getElementById('list-panel');
    const mapPanel = document.getElementById('map-panel');
    
    if (tabName === 'list') {
        listPanel.classList.add('active');
        mapPanel.classList.remove('active');
    } else if (tabName === 'map') {
        mapPanel.classList.add('active');
        listPanel.classList.remove('active');
        
        // 地図のリサイズトリガー
        if (map) {
            setTimeout(() => {
                google.maps.event.trigger(map, 'resize');
                map.setCenter({ lat: 33.2180, lng: 132.9360 });
            }, 300);
        }
    }
}

// レストラン件数更新
function updateRestaurantCount(count) {
    const countElement = document.getElementById('restaurant-count');
    if (countElement) {
        countElement.textContent = `${count}件`;
    }
}

// レストラン画像を取得（ダミー画像またはスプレッドシートから）
function getRestaurantImage(restaurant) {
    // スプレッドシートに写真がある場合は後で使用
    if (restaurant.photo && restaurant.photo.includes('drive.google.com')) {
        // Google Drive画像のダイレクトリンクに変換（後で実装）
        return convertGoogleDriveUrl(restaurant.photo);
    }
    
    // ジャンル別のダミー画像を返す
    const genreImages = {
        '定食類': 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200&h=200&fit=crop&crop=center',
        '定食': 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200&h=200&fit=crop&crop=center',
        '麺類': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=200&h=200&fit=crop&crop=center',
        'スイーツ': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=200&h=200&fit=crop&crop=center',
        'テイクアウト': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=200&h=200&fit=crop&crop=center'
    };
    
    return genreImages[restaurant.genre] || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&h=200&fit=crop&crop=center';
}

// Google Drive URLをプロキシ経由のURLに変換（CORS回避）
function convertGoogleDriveUrl(url) {
    try {
        // Google Drive URL形式: https://drive.google.com/file/d/FILE_ID/view?usp=...
        // または: https://drive.google.com/open?id=FILE_ID
        
        let fileId = null;
        
        // /file/d/FILE_ID/view 形式
        const match1 = url.match(/\/file\/d\/([^\/]+)/);
        if (match1) {
            fileId = match1[1];
        }
        
        // ?id=FILE_ID 形式
        const match2 = url.match(/[?&]id=([^&]+)/);
        if (match2) {
            fileId = match2[1];
        }
        
        if (fileId) {
            // バックエンドのプロキシ経由で画像を取得（CORS回避）
            return `/api/image-proxy?id=${fileId}`;
        }
        
        console.warn('Google Drive URLの解析に失敗:', url);
        return 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&h=200&fit=crop&crop=center';
        
    } catch (error) {
        console.error('Google Drive URL変換エラー:', error);
        return 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&h=200&fit=crop&crop=center';
    }
}

// スポット画像取得
function getSpotImage(spot) {
    if (spot.photo && spot.photo.includes('drive.google.com')) {
        return convertGoogleDriveUrl(spot.photo);
    }
    
    // カテゴリ別のダミー画像
    const categoryImages = {
        '橋': 'https://images.unsplash.com/photo-1533577116850-9af94d292f1d?w=200&h=200&fit=crop',
        '建物': 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=200&h=200&fit=crop',
        'イルミネーション': 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=200&h=200&fit=crop',
        '商店街': 'https://images.unsplash.com/photo-1555636222-cae831e670b3?w=200&h=200&fit=crop',
        '道': 'https://images.unsplash.com/photo-1502224562085-639556652f33?w=200&h=200&fit=crop'
    };
    
    return categoryImages[spot.category] || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=200&fit=crop';
}

// ジャンルフィルターを更新（おすすめスポットボタンを追加）
function updateGenreFilters() {
    const filterContainer = document.getElementById('genre-filters');
    if (!filterContainer) return;
    
    // スポットが1件以上ある場合、「おすすめスポット」ボタンを追加
    if (photoSpots.length > 0) {
        const button = document.createElement('button');
        button.className = 'filter-btn';
        button.dataset.genre = 'spots';
        button.textContent = '📸 おすすめスポット';
        button.addEventListener('click', function() {
            // アクティブボタン切り替え
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // スポット一覧を表示
            showAllSpots();
        });
        filterContainer.appendChild(button);
    }
}

// すべてのスポットを表示
function showAllSpots() {
    // 地図上のマーカーを更新
    if (map) {
        // 全マーカーを削除
        markers.forEach(m => m.setMap(null));
        markers = [];
        
        // すべてのスポットマーカーを表示
        addSpotsToMap(photoSpots);
    }
    
    // リスト表示を更新
    displaySpots(photoSpots);
    updateRestaurantCount(photoSpots.length);
}

// スポット一覧表示
function displaySpots(spotList) {
    const listElement = document.getElementById('restaurant-list');
    
    if (spotList.length === 0) {
        listElement.innerHTML = '<div class="loading">該当するスポットがありません</div>';
        return;
    }
    
    const html = spotList.map(spot => {
        const imageUrl = getSpotImage(spot);
        
        return `
            <div class="restaurant-card" onclick="handleSpotClick(${spot.id})">
                <img src="${imageUrl}" alt="${spot.name}" class="restaurant-image" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=200&fit=crop';" crossorigin="anonymous">
                <div class="restaurant-content">
                    <h3 class="restaurant-name">📸 ${spot.name}</h3>
                    <div class="restaurant-genre">${spot.category || 'おすすめスポット'}</div>
                    ${spot.timeOfDay ? `<div class="restaurant-price">🕐 ${spot.timeOfDay}</div>` : ''}
                    <div class="restaurant-review">${spot.description}</div>
                    <div class="restaurant-info">
                        <span><i class="fas fa-map-marker-alt"></i> 地図で見る</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    listElement.innerHTML = html;
}

// スポットクリック処理
function handleSpotClick(spotId) {
    const spot = photoSpots.find(s => s.id === spotId);
    if (!spot || !spot.lat || !spot.lng || !map) return;
    
    // モバイルの場合は地図タブに切り替え
    if (window.innerWidth < 768) {
        switchToTab('map');
        setTimeout(() => {
            showSpotOnMap(spotId);
        }, 300);
    } else {
        // デスクトップの場合は直接地図に表示
        showSpotOnMap(spotId);
    }
}

// スポットを地図で表示
function showSpotOnMap(spotId) {
    const spot = photoSpots.find(s => s.id === spotId);
    if (!spot || !spot.lat || !spot.lng || !map) return;
    
    map.setCenter({ lat: spot.lat, lng: spot.lng });
    map.setZoom(16);
    
    const marker = markers.find(m => m.getTitle() === spot.name);
    if (marker) {
        google.maps.event.trigger(marker, 'click');
    }
}

// レストランクリック処理（レスポンシブ対応）
function handleRestaurantClick(restaurantId) {
    // モバイルの場合は地図タブに切り替え
    if (window.innerWidth < 768) {
        switchToTab('map');
        setTimeout(() => {
            showRestaurantOnMap(restaurantId);
        }, 300);
    } else {
        // デスクトップの場合は直接地図に表示
        showRestaurantOnMap(restaurantId);
    }
}

// 住所から緯度経度を自動取得（ジオコーディング）
async function geocodeRestaurants() {
    const needsGeocodingList = restaurants.filter(r => r.needsGeocoding);
    
    if (needsGeocodingList.length === 0) {
        console.log('ジオコーディング不要: すべてのレストランに座標があります');
        return;
    }
    
    console.log(`ジオコーディング開始: ${needsGeocodingList.length}件のレストラン`);
    
    // 並列処理でジオコーディング（5件ずつバッチ処理）
    const batchSize = 5;
    for (let i = 0; i < needsGeocodingList.length; i += batchSize) {
        const batch = needsGeocodingList.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (restaurant) => {
            try {
                console.log(`ジオコーディング中: ${restaurant.name} (${restaurant.address})`);
                
                const response = await axios.post('/api/geocode', {
                    address: restaurant.address
                });
                
                if (response.data.lat && response.data.lng) {
                    restaurant.lat = response.data.lat;
                    restaurant.lng = response.data.lng;
                    restaurant.needsGeocoding = false;
                    console.log(`✓ ${restaurant.name}: ${restaurant.lat}, ${restaurant.lng}`);
                }
            } catch (error) {
                console.error(`ジオコーディング失敗: ${restaurant.name}`, error);
                // エラーの場合はデフォルト座標のまま
            }
        }));
        
        // バッチ間の短い待機（APIレート制限対策）
        if (i + batchSize < needsGeocodingList.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    console.log('ジオコーディング完了');
}

// スポット用ジオコーディング
async function geocodeSpots() {
    const needsGeocodingList = photoSpots.filter(s => s.needsGeocoding);
    
    if (needsGeocodingList.length === 0) {
        console.log('ジオコーディング不要: すべてのスポットに座標があります');
        return;
    }
    
    console.log(`スポットジオコーディング開始: ${needsGeocodingList.length}件`);
    
    // 並列処理でジオコーディング（5件ずつバッチ処理）
    const batchSize = 5;
    for (let i = 0; i < needsGeocodingList.length; i += batchSize) {
        const batch = needsGeocodingList.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (spot) => {
            try {
                console.log(`ジオコーディング中: ${spot.name} (${spot.address})`);
                
                const response = await axios.post('/api/geocode', {
                    address: spot.address
                });
                
                if (response.data.lat && response.data.lng) {
                    spot.lat = response.data.lat;
                    spot.lng = response.data.lng;
                    spot.needsGeocoding = false;
                    console.log(`✓ ${spot.name}: ${spot.lat}, ${spot.lng}`);
                }
            } catch (error) {
                console.error(`ジオコーディング失敗: ${spot.name}`, error);
            }
        }));
        
        // バッチ間の短い待機（APIレート制限対策）
        if (i + batchSize < needsGeocodingList.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    console.log('スポットジオコーディング完了');
}

// Google Maps APIコールバック（グローバル関数として定義）
window.initMap = initMap;
window.switchToTab = switchToTab;