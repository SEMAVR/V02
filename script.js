// script.js
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

// Иконки для маяков
const beaconIcons = ['🔴', '🟢', '🔵', '🟡', '🟣', '🟠', '⚫', '⚪'];

// Инициализация приложения
document.addEventListener("DOMContentLoaded", () => {
    initializeMap();
    setupEventListeners();
    loadSettings();
    checkGeolocationSupport();
});

function initializeMap() {
    map = L.map("map").setView([55.7558, 37.6173], 5);
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
    // Кнопки управления
    document.getElementById("connectBtn").addEventListener("click", connectBLE);
    document.getElementById("ledOnBtn").addEventListener("click", setLedOn);
    document.getElementById("ledOffBtn").addEventListener("click", setLedOff);
    document.getElementById("historyBtn").addEventListener("click", showHistory);
    document.getElementById("openBtn").addEventListener("click", () => showModal("openModal"));
    document.getElementById("settingsBtn").addEventListener("click", () => showModal("settingsModal"));
    document.getElementById("clearHistoryBtn").addEventListener("click", clearHistory);

    // Селектор маяка
    document.getElementById("beaconSelect").addEventListener("change", (e) => {
        const beaconId = parseInt(e.target.value);
        switchBeacon(beaconId);
    });

    // Модальные окна
    document.getElementById("closeOpen").addEventListener("click", () => hideModal("openModal"));
    document.getElementById("closeHistory").addEventListener("click", () => hideModal("historyModal"));
    document.getElementById("closeSettings").addEventListener("click", () => hideModal("settingsModal"));
    document.getElementById("modalOverlay").addEventListener("click", hideAllModals);

    // Действия в модальных окнах
    document.getElementById("exportGPX").addEventListener("click", exportGPX);
    document.getElementById("exportCSV").addEventListener("click", exportCSV);
    document.getElementById("historyBeaconSelect").addEventListener("change", showHistory);
    document.getElementById("openGoogle").addEventListener("click", () => openMap("google"));
    document.getElementById("openYandex").addEventListener("click", () => openMap("yandex"));
    document.getElementById("open2gis").addEventListener("click", () => openMap("2gis"));
}

function checkGeolocationSupport() {
    if (!navigator.geolocation) {
        alert("Геолокация не поддерживается вашим браузером");
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        (position) => startTracking(),
        (error) => {
            console.error("Ошибка геолокации:", error);
            alert("Для работы приложения необходимо разрешить доступ к геолокации");
        }
    );
}

function startTracking() {
    const settings = loadSettings();
    
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
    }

    watchId = navigator.geolocation.watchPosition(
        (position) => updateMyLocation(position),
        (error) => console.error("Ошибка отслеживания:", error),
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000
        }
    );
}

function updateMyLocation(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const speed = position.coords.speed;
    const accuracy = position.coords.accuracy;

    // Обновление информации в UI
    document.getElementById("myCoords").textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    
    // Обновление скорости
    const settings = loadSettings();
    let speedText = "N/A";
    if (speed !== null) {
        speedText = settings.units === 'ms' ? `${speed.toFixed(2)} м/с` : `${(speed * 3.6).toFixed(2)} км/ч`;
    }
    document.getElementById("speed").textContent = speedText;

    // Обновление маркера на карте
    if (settings.showMyLocation) {
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

        // Обновление круга точности
        myLocationCircle.setLatLng([lat, lon]);
        myLocationCircle.setRadius(accuracy);

        // Автоматическое слежение
        if (settings.autoFollow) {
            map.setView([lat, lon], map.getZoom());
        }
    } else if (myMarker) {
        map.removeLayer(myMarker);
        myMarker = null;
    }

    // Расчет расстояния до активного маяка
    updateDistanceToBeacon();
}

// Глобальная функция: Обновление маяка (вызывается из BLE менеджера)
function updateBeacon(beaconId, lat, lon, speed = null) {
    // Создаем или обновляем маркер маяка
    if (!beaconMarkers[beaconId]) {
        beaconMarkers[beaconId] = L.marker([lat, lon], {
            icon: L.divIcon({
                html: beaconIcons[beaconId] || '📍',
                iconSize: [24, 24],
                className: 'beacon-marker'
            })
        }).addTo(map).bindPopup(`Маяк ${beaconId}: ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    } else {
        beaconMarkers[beaconId].setLatLng([lat, lon]);
    }
    
    // Добавление в историю
    HistoryManager.add(beaconId, lat, lon, speed);
    
    console.log(`📍 Маяк ${beaconId} обновлен: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
}

// Глобальная функция: Обновление статуса LED (вызывается из BLE менеджера)
function updateLedStatus(beaconId, ledState) {
    // Сохраняем статус LED для маяка
    window.beaconLedStatus[beaconId] = ledState;
    
    // Если это активный маяк, обновляем отображение
    if (beaconId === bleManager.currentBeaconId) {
        updateLedStatusDisplay(ledState);
    }
}

// Функция: Обновление отображения статуса LED
function updateLedStatusDisplay(ledState) {
    const ledStatusElement = document.getElementById("ledStatus");
    if (!ledStatusElement) return;
    
    ledStatusElement.className = 'led-status';
    
    switch(ledState) {
        case 0:
            ledStatusElement.innerHTML = '<span class="led-indicator"></span> 🔴 ВЫКЛ (0)';
            ledStatusElement.classList.add('led-off');
            break;
        case 1:
            ledStatusElement.innerHTML = '<span class="led-indicator"></span> 🟢 ВКЛ (1)';
            ledStatusElement.classList.add('led-on');
            break;
        case 2:
            ledStatusElement.innerHTML = '<span class="led-indicator"></span> 🟡 МИГАНИЕ (2)';
            ledStatusElement.classList.add('led-blink');
            break;
        default:
            ledStatusElement.innerHTML = '<span class="led-indicator"></span> ❓ НЕТ ДАННЫХ';
            ledStatusElement.classList.add('led-unknown');
    }
}

function updateDistanceToBeacon() {
    const lastPoints = HistoryManager.getAllBeaconsLastPoints();
    const currentBeaconId = bleManager.currentBeaconId;
    const currentBeaconData = lastPoints[currentBeaconId];
    
    if (currentBeaconData && myMarker) {
        const myLatLng = myMarker.getLatLng();
        const distance = calculateDistance(myLatLng.lat, myLatLng.lng, currentBeaconData.lat, currentBeaconData.lon);
        document.getElementById("distance").textContent = `${distance.toFixed(2)} км`;
    } else {
        document.getElementById("distance").textContent = "N/A";
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

// Функции истории (оставляем без изменений)
function showHistory() {
    const selectedBeacon = document.getElementById('historyBeaconSelect').value;
    let history;
    
    if (selectedBeacon === 'all') {
        history = [];
        for (let i = 0; i < 8; i++) {
            const beaconHistory = HistoryManager.getBeaconHistory(i, 50);
            beaconHistory.forEach(point => {
                history.push({ ...point, beaconId: i });
            });
        }
        history.sort((a, b) => a.time - b.time);
    } else {
        history = HistoryManager.getBeaconHistory(parseInt(selectedBeacon), 50);
    }
    
    const list = document.getElementById("historyList");
    list.innerHTML = "";

    if (history.length === 0) {
        list.innerHTML = "<li>История пуста</li>";
    } else {
        history.slice(-20).reverse().forEach(point => {
            const li = document.createElement("li");
            const beaconId = point.beaconId !== undefined ? point.beaconId : selectedBeacon;
            li.innerHTML = `
                <small>${new Date(point.time).toLocaleString()}</small><br>
                <strong>Маяк ${beaconId}:</strong> ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}
                ${point.speed ? ` | ${point.speed.toFixed(2)} м/с` : ''}
            `;
            li.style.marginBottom = "8px";
            li.style.padding = "5px";
            li.style.borderBottom = "1px solid #eee";
            list.appendChild(li);
        });
    }
    showModal("historyModal");
}

function exportGPX() {
    const selectedBeacon = document.getElementById('historyBeaconSelect').value;
    const gpx = HistoryManager.exportGPX(selectedBeacon);
    downloadFile(gpx, `beacon_track_${selectedBeacon}.gpx`, 'application/gpx+xml');
}

function exportCSV() {
    const selectedBeacon = document.getElementById('historyBeaconSelect').value;
    const csv = HistoryManager.exportCSV(selectedBeacon);
    downloadFile(csv, `beacon_history_${selectedBeacon}.csv`, 'text/csv');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function clearHistory() {
    if (confirm("Вы уверены, что хотите очистить историю активного маяка?")) {
        HistoryManager.clear(bleManager.currentBeaconId);
        alert(`История маяка ${bleManager.currentBeaconId} очищена`);
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
    const coords = document.getElementById("beaconCoords").textContent;
    if (coords === "N/A") {
        alert("Сначала установите координаты маяка");
        return;
    }

    const [lat, lon] = coords.split(",").map(x => parseFloat(x.trim()));
    let url = "";

    switch (service) {
        case "google":
            url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
            break;
        case "yandex":
            url = `https://yandex.ru/maps/?text=${lat},${lon}&z=15`;
            break;
        case "2gis":
            url = `https://2gis.ru/geo/${lon},${lat}`;
            break;
    }

    window.open(url, "_blank");
}

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
