// script.js
let map;
let beaconMarkers = {};
let myMarker;
let myLocationCircle;
let watchId = null;
let currentBeaconId = 0;

// Иконки для разных маяков
const beaconIcons = [
  '🔴', '🟢', '🔵', '🟡', '🟣', '🟠', '⚫', '⚪'
];

// Цвета для маяков
const beaconColors = [
  '#ff4444', '#44ff44', '#4444ff', '#ffff44',
  '#ff44ff', '#44ffff', '#ff8844', '#8844ff'
];

// Хранилище статусов LED для всех маяков
const beaconLedStatus = {
  0: 'unknown', 1: 'unknown', 2: 'unknown', 3: 'unknown',
  4: 'unknown', 5: 'unknown', 6: 'unknown', 7: 'unknown'
};

// Инициализация приложения
document.addEventListener("DOMContentLoaded", () => {
  initializeMap();
  setupEventListeners();
  loadSettings();
  checkGeolocationSupport();
  initializeBeaconsStatus();
});

function initializeMap() {
  map = L.map("map").setView([55.7558, 37.6173], 5); // Центр России

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

function initializeBeaconsStatus() {
  const container = document.getElementById('beaconsStatus');
  if (!container) return;
  
  container.innerHTML = '';
  
  for (let i = 0; i < 8; i++) {
    const beaconElement = document.createElement('div');
    beaconElement.className = 'beacon-status-item';
    beaconElement.dataset.beaconId = i;
    beaconElement.innerHTML = `
      <div class="beacon-indicator beacon-unknown"></div>
      <div>Маяк ${i}</div>
      <small>N/A</small>
    `;
    
    beaconElement.addEventListener('click', () => {
      switchBeacon(i);
    });
    
    container.appendChild(beaconElement);
  }
}

function switchBeacon(beaconId) {
  currentBeaconId = beaconId;
  document.getElementById('beaconSelect').value = beaconId;
  
  // Обновляем активный класс
  document.querySelectorAll('.beacon-status-item').forEach(item => {
    if (parseInt(item.dataset.beaconId) === beaconId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  updateBeaconDisplay();
  updateLedStatusDisplay(); // Обновляем отображение статуса LED
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
    switchBeacon(parseInt(e.target.value));
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
    (position) => {
      startTracking();
    },
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
    (position) => {
      updateMyLocation(position);
    },
    (error) => {
      console.error("Ошибка отслеживания:", error);
    },
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
    if (settings.units === 'ms') {
      speedText = `${speed.toFixed(2)} м/с`;
    } else {
      speedText = `${(speed * 3.6).toFixed(2)} км/ч`;
    }
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
  } else {
    if (myMarker) {
      map.removeLayer(myMarker);
      myMarker = null;
    }
  }

  // Расчет расстояния до активного маяка
  updateDistanceToBeacon();
}

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
  
  // Обновление статуса маяка
  updateBeaconStatus(beaconId, true);
  
  // Если это активный маяк, обновляем отображение
  if (beaconId === currentBeaconId) {
    document.getElementById("beaconCoords").textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    updateDistanceToBeacon();
  }
}

// НОВАЯ ФУНКЦИЯ: Обновление статуса LED на основе данных от маяка
function updateLedStatus(beaconId, ledStatus) {
  // Сохраняем статус LED для маяка
  beaconLedStatus[beaconId] = ledStatus;
  
  // Если это активный маяк, обновляем отображение
  if (beaconId === currentBeaconId) {
    updateLedStatusDisplay();
  }
  
  // Обновляем индикатор статуса маяка
  updateBeaconLedIndicator(beaconId, ledStatus);
}

// НОВАЯ ФУНКЦИЯ: Обновление отображения статуса LED
function updateLedStatusDisplay() {
  const ledStatusElement = document.getElementById("ledStatus");
  if (!ledStatusElement) return;
  
  const status = beaconLedStatus[currentBeaconId] || 'unknown';
  
  ledStatusElement.className = 'led-status';
  
  switch(status) {
    case 0:
    case '0':
    case 'off':
      ledStatusElement.innerHTML = '<span class="led-indicator"></span> 🔴 ВЫКЛ (0)';
      ledStatusElement.classList.add('led-off');
      break;
    case 1:
    case '1':
    case 'on':
      ledStatusElement.innerHTML = '<span class="led-indicator"></span> 🟢 ВКЛ (1)';
      ledStatusElement.classList.add('led-on');
      break;
    case 2:
    case '2':
    case 'blink':
      ledStatusElement.innerHTML = '<span class="led-indicator"></span> 🟡 МИГАНИЕ (2)';
      ledStatusElement.classList.add('led-blink');
      break;
    default:
      ledStatusElement.innerHTML = '<span class="led-indicator"></span> ❓ НЕТ ДАННЫХ';
      ledStatusElement.classList.add('led-unknown');
  }
}

// НОВАЯ ФУНКЦИЯ: Обновление индикатора LED в статусе маяка
function updateBeaconLedIndicator(beaconId, ledStatus) {
  const beaconElement = document.querySelector(`.beacon-status-item[data-beacon-id="${beaconId}"]`);
  if (!beaconElement) return;
  
  const indicator = beaconElement.querySelector('.beacon-indicator');
  if (!indicator) return;
  
  // Обновляем цвет индикатора в зависимости от статуса LED
  switch(ledStatus) {
    case 0:
    case '0':
    case 'off':
      indicator.style.backgroundColor = '#f44336'; // Красный
      break;
    case 1:
    case '1':
    case 'on':
      indicator.style.backgroundColor = '#4caf50'; // Зеленый
      break;
    case 2:
    case '2':
    case 'blink':
      indicator.style.backgroundColor = '#ffc107'; // Желтый
      indicator.style.animation = 'blink 1s infinite';
      break;
    default:
      indicator.style.backgroundColor = '#ff9800'; // Оранжевый
      indicator.style.animation = 'pulse 2s infinite';
  }
}

function updateBeaconStatus(beaconId, isOnline) {
  const statusElement = document.querySelector(`.beacon-status-item[data-beacon-id="${beaconId}"]`);
  if (!statusElement) return;
  
  const indicator = statusElement.querySelector('.beacon-indicator');
  const timeText = statusElement.querySelector('small');
  
  if (isOnline) {
    indicator.className = 'beacon-indicator beacon-online';
    timeText.textContent = 'онлайн';
    statusElement.classList.add(`beacon-${beaconId}`);
  } else {
    indicator.className = 'beacon-indicator beacon-offline';
    timeText.textContent = 'офлайн';
    statusElement.classList.remove(`beacon-${beaconId}`);
  }
}

function updateBeaconDisplay() {
  const lastPoints = HistoryManager.getAllBeaconsLastPoints();
  const currentBeaconData = lastPoints[currentBeaconId];
  
  if (currentBeaconData) {
    document.getElementById("beaconCoords").textContent = 
      `${currentBeaconData.lat.toFixed(5)}, ${currentBeaconData.lon.toFixed(5)}`;
  } else {
    document.getElementById("beaconCoords").textContent = "N/A";
  }
  
  updateDistanceToBeacon();
  updateLedStatusDisplay(); // Обновляем статус LED при переключении маяка
}

function updateDistanceToBeacon() {
  const lastPoints = HistoryManager.getAllBeaconsLastPoints();
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

// Функции истории
function showHistory() {
  const selectedBeacon = document.getElementById('historyBeaconSelect').value;
  const history = selectedBeacon === 'all' 
    ? HistoryManager.getAllHistory() 
    : HistoryManager.getBeaconHistory(parseInt(selectedBeacon), 50);
  
  const list = document.getElementById("historyList");
  list.innerHTML = "";

  if (history.length === 0) {
    list.innerHTML = "<li>История пуста</li>";
  } else {
    history.slice(-20).reverse().forEach(point => {
      const li = document.createElement("li");
      const beaconId = point.beaconId || selectedBeacon;
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
  const blob = new Blob([gpx], { type: "application/gpx+xml;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const filename = selectedBeacon === 'all' 
    ? `all_beacons_track_${new Date().toISOString().slice(0,10)}.gpx`
    : `beacon_${selectedBeacon}_track_${new Date().toISOString().slice(0,10)}.gpx`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCSV() {
  const selectedBeacon = document.getElementById('historyBeaconSelect').value;
  const csv = HistoryManager.exportCSV(selectedBeacon);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const filename = selectedBeacon === 'all' 
    ? `all_beacons_history_${new Date().toISOString().slice(0,10)}.csv`
    : `beacon_${selectedBeacon}_history_${new Date().toISOString().slice(0,10)}.csv`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function clearHistory() {
  if (confirm("Вы уверены, что хотите очистить историю активного маяка?")) {
    HistoryManager.clear(currentBeaconId);
    alert(`История маяка ${currentBeaconId} очищена`);
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
