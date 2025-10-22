// script.js
let map;
let beaconMarker;
let myMarker;
let myLocationCircle;
let watchId = null;

// Инициализация приложения
document.addEventListener("DOMContentLoaded", () => {
  initializeMap();
  setupEventListeners();
  loadSettings();
  checkGeolocationSupport();
});

function initializeMap() {
  map = L.map("map").setView([54.977449, 73.470961], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map);

  // Маркер маяка
  beaconMarker = L.marker([54.977449, 73.470961], {
    icon: L.divIcon({
      html: '🔴',
      iconSize: [20, 20],
      className: 'beacon-marker'
    })
  }).addTo(map).bindPopup("Маяк");

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

  // Модальные окна
  document.getElementById("closeOpen").addEventListener("click", () => hideModal("openModal"));
  document.getElementById("closeHistory").addEventListener("click", () => hideModal("historyModal"));
  document.getElementById("closeSettings").addEventListener("click", () => hideModal("settingsModal"));
  document.getElementById("modalOverlay").addEventListener("click", hideAllModals);

  // Действия в модальных окнах
  document.getElementById("exportGPX").addEventListener("click", exportGPX);
  document.getElementById("exportCSV").addEventListener("click", exportCSV);
  document.getElementById("openGoogle").addEventListener("click", () => openMap("google"));
  document.getElementById("openYandex").addEventListener("click", () => openMap("yandex"));
  document.getElementById("open2gis").addEventListener("click", () => openMap("2gis"));
}

function checkGeolocationSupport() {
  if (!navigator.geolocation) {
    alert("Геолокация не поддерживается вашим браузером");
    return;
  }
  
  // Запрос разрешения на геолокацию
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
          html: '🔵',
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

  // Расчет расстояния до маяка
  const beaconLatLng = beaconMarker.getLatLng();
  if (beaconLatLng.lat !== 54.977449 || beaconLatLng.lng !== 73.470961) { // Если не начальная позиция
    const distance = calculateDistance(lat, lon, beaconLatLng.lat, beaconLatLng.lng);
    document.getElementById("distance").textContent = `${distance.toFixed(2)} км`;
  }
}

function updateBeacon(lat, lon, speed = null) {
  beaconMarker.setLatLng([lat, lon])
    .bindPopup(`Маяк: ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
  
  document.getElementById("beaconCoords").textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  
  // Добавление в историю
  HistoryManager.add(lat, lon, speed);
  
  // Обновление расстояния
  if (myMarker) {
    const myLatLng = myMarker.getLatLng();
    const distance = calculateDistance(myLatLng.lat, myLatLng.lng, lat, lon);
    document.getElementById("distance").textContent = `${distance.toFixed(2)} км`;
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Радиус Земли в км
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
  const history = HistoryManager.load();
  const list = document.getElementById("historyList");
  list.innerHTML = "";

  if (history.length === 0) {
    list.innerHTML = "<li>История пуста</li>";
  } else {
    history.slice(-20).reverse().forEach(point => {
      const li = document.createElement("li");
      li.innerHTML = `
        <small>${new Date(point.time).toLocaleString()}</small><br>
        ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}
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

// Экспорт в GPX формате
function exportGPX() {
  const gpx = HistoryManager.exportGPX();
  const blob = new Blob([gpx], { type: "application/gpx+xml;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mayak_track_${new Date().toISOString().slice(0,10)}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Экспорт в CSV формате
function exportCSV() {
  const csv = HistoryManager.exportCSV();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mayak_history_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function clearHistory() {
  if (confirm("Вы уверены, что хотите очистить всю историю?")) {
    HistoryManager.clear();
    alert("История очищена");
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
    // Используйте относительный путь
    navigator.serviceWorker.register('./service-worker.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
