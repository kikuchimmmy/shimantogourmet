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
        
        // レストランデータ取得
        const restaurantResponse = await axios.get('/api/restaurants');
        restaurants = restaurantResponse.data.restaurants || [];
        
        // 写真スポットデータ取得
        const spotResponse = await axios.get('/api/photo-spots');
        photoSpots = spotResponse.data.spots || [];
        
        console.log(`読み込み完了: レストラン${restaurants.length}件, 写真スポット${photoSpots.length}件`);
        
        // レストランリスト表示
        displayRestaurants(restaurants);
        
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
}

// レストランフィルタリング
function filterRestaurants(genre) {
    console.log('フィルタリング:', genre);
    
    let filteredRestaurants;
    if (genre === 'all') {
        filteredRestaurants = restaurants;
    } else {
        filteredRestaurants = restaurants.filter(restaurant => 
            restaurant.genre === genre
        );
    }
    
    displayRestaurants(filteredRestaurants);
    updateMapMarkers(filteredRestaurants);
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
        
        return `
            <div class="restaurant-card" data-id="${restaurant.id}" onclick="showRestaurantOnMap(${restaurant.id})">
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
    const center = { lat: 33.2180, lng: 132.9360 };
    
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 14,
        center: center,
        styles: [
            {
                featureType: 'poi',
                stylers: [{ visibility: 'off' }]
            }
        ]
    });
    
    // マーカー追加
    addMarkersToMap(restaurants);
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

// Google Maps APIコールバック（グローバル関数として定義）
window.initMap = initMap;