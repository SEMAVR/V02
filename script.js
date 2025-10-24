// script.js
// Константы
const BEACON_CONFIG = {
    MAX_BEACONS: 8,
    BEACON_ICONS: ['🔴', '🟢', '🔵', '🟡', '🟣', '🟠', '⚫', '⚪'],
    LED_STATES: {
        OFF: 0,
        ON: 1,
        BLINKING: 2,
        UNKNOWN: 'unknown'
    }
};

const GEOLOCATION_CONFIG = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 5000
};

const MAP_CONFIG = {
    DEFAULT_VIEW: [55.7558, 37.6173],
    DEFAULT_ZOOM: 5
};

// Глобальные переменные
let map;
let beaconMarkers = {};
let myMarker;
let myLocationCircle;
let watchId = null;

// Хранилище статусов LED для всех маяков
window.beaconLedStatus = {
    0: 'unknown', 1: 'unknown', 2: 'unknown', 3: 'unknown',
    4: 'unknown', 5: 'unknown', 6: 'unknown', 7: 'unknown'
};

// Инициализация приложения
document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initializeApp();
    } catch (error) {
        console.error("Failed to initialize app:", error);
        showErrorToUser("Ошибка запуска приложения");
    }
});

async function initializeApp() {
    initializeMap();
    setupEventListeners();
    await loadSettings();
    await checkGeolocationSupport();
}

function initializeMap() {
    map = L.map("map").setView(MAP_CONFIG.DEFAULT_VIEW, MAP_CONFIG.DEFAULT_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap"
    }).addTo(map);

    // Круг точности местоположения
    myLocationCircle = L.circle([0, 0], {
        color: 'blue',
        fillColor: '#00f',
        fillOpacity: 0.1,
        radius: 1
    }).addTo(map);
}

function setupEventListeners() {
    // Делегирование событий для лучшей производительности
    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('change', handleGlobalChange);
}

function handleGlobalClick(e) {
    const { target } = e;
    
    switch(target.id) {
        case "connectBtn": connectBLE(); break;
        case "ledOnBtn": setLedOn(); break;
        case "ledOffBtn": setLedOff(); break;
        case "historyBtn": showHistory(); break;
        case "openBtn": showModal("openModal"); break;
        case "settingsBtn": showModal("settingsModal"); break;
        case "clearHistoryBtn": clearHistory(); break;
        case "exportGPX": exportGPX(); break;
        case "exportCSV": exportCSV(); break;
        case "openGoogle": openMap("google"); break;
        case "openYandex": openMap("yandex"); break;
        case "open2gis": openMap("2gis"); break;
        case "closeOpen": hideModal("openModal"); break;
        case "closeHistory": hideModal("historyModal"); break;
        case "closeSettings": hideModal("settingsModal"); break;
    }

    // Закрытие модальных окон
    if (target.id === 'modalOverlay') {
        hideAllModals();
    }
}

function handleGlobalChange(e) {
    const { target } = e;
    
    switch(target.id) {
        case "beaconSelect":
            switchBeacon(parseInt(target.value));
            break;
        case "historyBeaconSelect":
            showHistory();
            break;
    }
}

async function checkGeolocationSupport() {
    if (!navigator.geolocation) {
        showErrorToUser("Геолокация не поддерживается вашим браузером");
        return;
    }
    
    try {
        await requestGeolocationPermission();
        startTracking();
    } catch (error) {
        console.error("Ошибка геолокации:", error);
        showErrorToUser("Для работы приложения необходимо разрешить доступ к геолокации");
    }
}

function requestGeolocationPermission() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
    });
}

function startTracking() {
    const settings = loadSettings();
    
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
    }

    watchId = navigator.geolocation.watchPosition(
        (position) => updateMyLocation(position),
        (error) => console.error("Ошибка отслеживания:", error),
        GEOLOCATION_CONFIG
    );
}

function updateMyLocation(position) {
    try {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const speed = position.coords.speed;
        const accuracy = position.coords.accuracy;

        // Валидация координат
        if (!isValidCoordinates(lat, lon)) {
            console.warn("Invalid coordinates received");
            return;
        }

        updateUILocation(lat, lon, speed);
        updateMapLocation(lat, lon, accuracy);
        updateDistanceToBeacon();

    } catch (error) {
        console.error("Error in updateMyLocation:", error);
    }
}

function isValidCoordinates(lat, lon) {
    return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function updateUILocation(lat, lon, speed) {
    document.getElementById("myCoords").textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    
    const settings = loadSettings();
    let speedText = "N/A";
    if (speed !== null && speed >= 0) {
        speedText = settings.units === 'ms' 
            ? `${speed.toFixed(2)} м/с` 
            : `${(speed * 3.6).toFixed(2)} км/ч`;
    }
    document.getElementById("speed").textContent = speedText;
}

function updateMapLocation(lat, lon, accuracy) {
    const settings = loadSettings();
    
    if (settings.showMyLocation) {
        updateUserMarker(lat, lon);
        updateAccuracyCircle(lat, lon, accuracy);
        
        if (settings.autoFollow) {
            map.setView([lat, lon], map.getZoom());
        }
    } else {
        removeUserMarker();
    }
}

function updateUserMarker(lat, lon) {
    if (!myMarker) {
        myMarker = L.marker([lat, lon], {
            icon: L.divIcon({
                html: '👤',
                iconSize: [20, 20],
                className: 'my-marker'
            })
        }).addTo(map).bindPopup("Моё местоположение");
    } else {
        myMarker.setLatLng([lat, lon]);
    }
}

function removeUserMarker() {
    if (myMarker) {
        map.removeLayer(myMarker);
        myMarker = null;
    }
}

function updateAccuracyCircle(lat, lon, accuracy) {
    myLocationCircle.setLatLng([lat, lon]);
    myLocationCircle.setRadius(accuracy);
}

// Глобальная функция: Обновление маяка (вызывается из BLE менеджера)
function updateBeacon(beaconId, lat, lon, speed = null) {
    try {
        // Валидация входных данных
        if (!isValidBeaconId(beaconId) || !isValidCoordinates(lat, lon)) {
            console.warn(`Invalid beacon data: ID=${beaconId}, lat=${lat}, lon=${lon}`);
            return;
        }

        updateBeaconMarker(beaconId, lat, lon);
        HistoryManager.add(beaconId, lat, lon, speed);
        
        if (beaconId === getCurrentBeaconId()) {
            document.getElementById("beaconCoords").textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        }
        
        console.log(`📍 Маяк ${beaconId} обновлен: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
        
    } catch (error) {
        console.error(`Error updating beacon ${beaconId}:`, error);
    }
}

function isValidBeaconId(beaconId) {
    return Number.isInteger(beaconId) && beaconId >= 0 && beaconId < BEACON_CONFIG.MAX_BEACONS;
}

function getCurrentBeaconId() {
    return bleManager?.currentBeaconId;
}

function updateBeaconMarker(beaconId, lat, lon) {
    if (!beaconMarkers[beaconId]) {
        beaconMarkers[beaconId] = L.marker([lat, lon], {
            icon: L.divIcon({
                html: BEACON_CONFIG.BEACON_ICONS[beaconId] || '📍',
                iconSize: [24, 24],
                className: 'beacon-marker'
            })
        }).addTo(map).bindPopup(`Маяк ${beaconId}: ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    } else {
        beaconMarkers[beaconId].setLatLng([lat, lon]);
        beaconMarkers[beaconId].getPopup().setContent(`Маяк ${beaconId}: ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    }
}

// Глобальная функция: Обновление статуса LED (вызывается из BLE менеджера)
function updateLedStatus(beaconId, ledState) {
    try {
        if (!isValidBeaconId(beaconId)) {
            console.warn(`Invalid beacon ID for LED update: ${beaconId}`);
            return;
        }

        // Сохраняем статус LED для маяка
        window.beaconLedStatus[beaconId] = ledState;
        
        // Если это активный маяк, обновляем отображение
        if (beaconId === getCurrentBeaconId()) {
            updateLedStatusDisplay(ledState);
        }
    } catch (error) {
        console.error(`Error updating LED status for beacon ${beaconId}:`, error);
    }
}

// Функция: Обновление отображения статуса LED
function updateLedStatusDisplay(ledState) {
    const ledStatusElement = document.getElementById("ledStatus");
    if (!ledStatusElement) return;
    
    ledStatusElement.className = 'led-status';
    
    const statusConfig = {
        [BEACON_CONFIG.LED_STATES.OFF]: {
            html: '<span class="led-indicator"></span> 🔴 ВЫКЛ (0)',
            className: 'led-off'
        },
        [BEACON_CONFIG.LED_STATES.ON]: {
            html: '<span class="led-indicator"></span> 🟢 ВКЛ (1)',
            className: 'led-on'
        },
        [BEACON_CONFIG.LED_STATES.BLINKING]: {
            html: '<span class="led-indicator"></span> 🟡 МИГАНИЕ (2)',
            className: 'led-blink'
        }
    };

    const config = statusConfig[ledState] || {
        html: '<span class="led-indicator"></span> ❓ НЕТ ДАННЫХ',
        className: 'led-unknown'
    };

    ledStatusElement.innerHTML = config.html;
    ledStatusElement.classList.add(config.className);
}

function updateDistanceToBeacon() {
    try {
        const currentBeaconId = getCurrentBeaconId();
        if (currentBeaconId === undefined || currentBeaconId === null) {
            document.getElementById("distance").textContent = "N/A";
            return;
        }

        const beaconHistory = HistoryManager.getBeaconHistory(currentBeaconId, 1);
        const lastPoint = beaconHistory[0];
        
        if (!lastPoint || !myMarker) {
            document.getElementById("distance").textContent = "N/A";
            return;
        }

        const myLatLng = myMarker.getLatLng();
        const distance = calculateDistance(
            myLatLng.lat, 
            myLatLng.lng, 
            lastPoint.lat, 
            lastPoint.lon
        );

        document.getElementById("distance").textContent = formatDistance(distance);
        
    } catch (error) {
        console.error("Error in updateDistanceToBeacon:", error);
        document.getElementById("distance").textContent = "Ошибка";
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function formatDistance(km) {
    if (km < 0.001) return "<1 м";
    if (km < 1.0) return `${Math.round(km * 1000)} м`;
    return `${km.toFixed(1)} км`;
}

// Функции истории
function showHistory() {
    try {
        const selectedBeacon = document.getElementById('historyBeaconSelect').value;
        const history = getHistoryData(selectedBeacon);
        renderHistoryList(history);
        showModal("historyModal");
    } catch (error) {
        console.error("Error showing history:", error);
    }
}

function getHistoryData(selectedBeacon) {
    if (selectedBeacon === 'all') {
        return getAllBeaconsHistory();
    } else {
        return HistoryManager.getBeaconHistory(parseInt(selectedBeacon), 50);
    }
}

function getAllBeaconsHistory() {
    const history = [];
    for (let i = 0; i < BEACON_CONFIG.MAX_BEACONS; i++) {
        const beaconHistory = HistoryManager.getBeaconHistory(i, 50);
        beaconHistory.forEach(point => {
            history.push({ ...point, beaconId: i });
        });
    }
    return history.sort((a, b) => a.time - b.time);
}

function renderHistoryList(history) {
    const list = document.getElementById("historyList");
    list.innerHTML = "";

    if (history.length === 0) {
        list.innerHTML = "<li>История пуста</li>";
        return;
    }

    const recentHistory = history.slice(-20).reverse();
    
    recentHistory.forEach(point => {
        const li = createHistoryListItem(point);
        list.appendChild(li);
    });
}

function createHistoryListItem(point) {
    const li = document.createElement("li");
    const beaconId = point.beaconId !== undefined ? point.beaconId : 'unknown';
    
    li.innerHTML = `
        <small>${new Date(point.time).toLocaleString()}</small><br>
        <strong>Маяк ${beaconId}:</strong> ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}
        ${point.speed ? ` | ${point.speed.toFixed(2)} м/с` : ''}
    `;
    
    li.style.marginBottom = "8px";
    li.style.padding = "5px";
    li.style.borderBottom = "1px solid #eee";
    
    return li;
}

function exportGPX() {
    try {
        const selectedBeacon = document.getElementById('historyBeaconSelect').value;
        const gpx = HistoryManager.exportGPX(selectedBeacon);
        downloadFile(gpx, `beacon_track_${selectedBeacon}.gpx`, 'application/gpx+xml');
    } catch (error) {
        console.error("Error exporting GPX:", error);
        showErrorToUser("Ошибка при экспорте GPX");
    }
}

function exportCSV() {
    try {
        const selectedBeacon = document.getElementById('historyBeaconSelect').value;
        const csv = HistoryManager.exportCSV(selectedBeacon);
        downloadFile(csv, `beacon_history_${selectedBeacon}.csv`, 'text/csv');
    } catch (error) {
        console.error("Error exporting CSV:", error);
        showErrorToUser("Ошибка при экспорте CSV");
    }
}

function downloadFile(content, filename, mimeType) {
    try {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Error downloading file:", error);
        showErrorToUser("Ошибка при скачивании файла");
    }
}

function clearHistory() {
    try {
        const currentBeaconId = getCurrentBeaconId();
        if (currentBeaconId === undefined || currentBeaconId === null) {
            showErrorToUser("Не выбран активный маяк");
            return;
        }

        if (confirm("Вы уверены, что хотите очистить историю активного маяка?")) {
            HistoryManager.clear(currentBeaconId);
            alert(`История маяка ${currentBeaconId} очищена`);
        }
    } catch (error) {
        console.error("Error clearing history:", error);
        showErrorToUser("Ошибка при очистке истории");
    }
}

// Функции модальных окон
function showModal(id) {
    document.getElementById("modalOverlay").classList.remove("hidden");
    document.getElementById(id).classList.remove("hidden");
}

function hideModal(id) {
    document.getElementById("modalOverlay").classList.add("hidden");
    document.getElementById(id).classList.add("hidden");
}

function hideAllModals() {
    document.getElementById("modalOverlay").classList.add("hidden");
    document.querySelectorAll(".modal").forEach(modal => {
        modal.classList.add("hidden");
    });
}

function openMap(service) {
    try {
        const coords = document.getElementById("beaconCoords").textContent;
        if (coords === "N/A") {
            showErrorToUser("Сначала установите координаты маяка");
            return;
        }

        const [lat, lon] = coords.split(",").map(x => parseFloat(x.trim()));
        
        if (!isValidCoordinates(lat, lon)) {
            showErrorToUser("Некорректные координаты маяка");
            return;
        }

        const url = getMapServiceUrl(service, lat, lon);
        window.open(url, "_blank");
    } catch (error) {
        console.error("Error opening map:", error);
        showErrorToUser("Ошибка при открытии карты");
    }
}

function getMapServiceUrl(service, lat, lon) {
    const urls = {
        "google": `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
        "yandex": `https://yandex.ru/maps/?text=${lat},${lon}&z=15`,
        "2gis": `https://2gis.ru/geo/${lon},${lat}`
    };
    
    return urls[service] || urls.google;
}

function switchBeacon(beaconId) {
    try {
        if (!isValidBeaconId(beaconId)) {
            console.warn(`Invalid beacon ID for switch: ${beaconId}`);
            return;
        }
        
        // Обновление LED статуса для нового маяка
        const ledStatus = window.beaconLedStatus[beaconId] || BEACON_CONFIG.LED_STATES.UNKNOWN;
        updateLedStatusDisplay(ledStatus);
        
        // Обновление расстояния
        updateDistanceToBeacon();

    } catch (error) {
        console.error(`Error switching to beacon ${beaconId}:`, error);
    }
}

// Утилитарные функции
function showErrorToUser(message) {
    console.error("User error:", message);
    alert(message);
}

// Функция для очистки ресурсов
function cleanup() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    
    // Очистка маркеров
    if (myMarker) {
        map.removeLayer(myMarker);
        myMarker = null;
    }
    
    Object.values(beaconMarkers).forEach(marker => {
        if (marker) map.removeLayer(marker);
    });
    beaconMarkers = {};
}

// Обработчики BLE функций (заглушки - должны быть реализованы в ble-manager.js)
function connectBLE() {
    console.log("Connect BLE called");
    // Реализация в ble-manager.js
}

function setLedOn() {
    console.log("LED On called");
    // Реализация в ble-manager.js
}

function setLedOff() {
    console.log("LED Off called");
    // Реализация в ble-manager.js
}

function loadSettings() {
    // Заглушка - должна быть реализована
    return {
        showMyLocation: true,
        autoFollow: true,
        units: 'ms'
    };
}

// Добавьте обработчик перед закрытием страницы
window.addEventListener('beforeunload', cleanup);

// Регистрация Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
