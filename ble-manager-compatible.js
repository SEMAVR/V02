// ble-manager-compatible.js
class BLEManager {
    constructor() {
        this.device = null;
        this.server = null;
        this.coordCharacteristic = null;
        this.ledCharacteristic = null;
        this.isConnected = false;
        this.lastLedState = null;
    }

    async connect() {
        try {
            console.log('🔍 Поиск BLE устройств...');
            
            let deviceOptions = {
                filters: [{ name: 'ESP32-MultiTracker' }],
                optionalServices: ['12345678-1234-1234-1234-123456789abc']
            };
            
            this.device = await navigator.bluetooth.requestDevice(deviceOptions);

            console.log('📱 Устройство найдено:', this.device.name);
            
            this.device.addEventListener('gattserverdisconnected', () => {
                console.log('🔌 BLE устройство отключено');
                this.onDisconnected();
            });

            console.log('🔄 Подключение к GATT серверу...');
            this.server = await this.device.gatt.connect();
            console.log('✅ Подключено к GATT серверу');

            console.log('🔄 Получение сервиса...');
            const service = await this.server.getPrimaryService('12345678-1234-1234-1234-123456789abc');
            console.log('✅ Сервис найден');

            console.log('🔄 Получение характеристики координат...');
            this.coordCharacteristic = await service.getCharacteristic('12345678-1234-1234-1234-123456789abd');
            await this.coordCharacteristic.startNotifications();
            this.coordCharacteristic.addEventListener('characteristicvaluechanged', 
                (event) => this.handleCoordData(event));
            console.log('✅ Подписка на координаты');

            console.log('🔄 Получение характеристики LED...');
            this.ledCharacteristic = await service.getCharacteristic('12345678-1234-1234-1234-123456789abe');
            console.log('✅ LED характеристика готова');

            this.isConnected = true;
            this.updateUI();
            
            console.log('🎉 BLE подключение установлено!');
            alert('✅ Успешно подключено к многомаяковому устройству!');
            
            return true;

        } catch (error) {
            console.error('❌ Ошибка BLE:', error);
            
            if (error.name === 'NotFoundError') {
                alert('Устройство "ESP32-MultiTracker" не найдено.\n\nПопробуйте:\n1. Перезагрузить ESP32\n2. Проверить что BLE включен');
            } else if (error.name === 'SecurityError') {
                alert('Ошибка безопасности BLE.\n\nРазрешите доступ к Bluetooth в настройках браузера.');
            } else {
                alert('Ошибка подключения: ' + error.message);
            }
            return false;
        }
    }

    handleCoordData(event) {
        const value = event.target.value;
        const decoder = new TextDecoder('utf-8');
        const dataString = decoder.decode(value);
        
        console.log('📊 Получены данные:', dataString);
        
        const parts = dataString.split(',');
        if (parts.length >= 5) {
            const beaconId = parseInt(parts[0]);
            const lat = parseFloat(parts[1]);
            const lon = parseFloat(parts[2]);
            const speed = parseFloat(parts[3]);
            const ledState = parseInt(parts[4]);
            
            // Сохраняем состояние LED
            this.lastLedState = ledState;
            
            if (typeof updateBeacon === 'function') {
                updateBeacon(beaconId, lat, lon, speed);
            }
            
            // Обновляем UI если это активный маяк
            if (beaconId === window.currentBeaconId) {
                document.getElementById("beaconCoords").textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
                document.getElementById("speed").textContent = `${speed.toFixed(2)} км/ч`;
                this.updateLedIndicator(ledState);
            }
        }
    }

    updateLedIndicator(ledState) {
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

    async setLed(beaconId, state) {
    if (!this.ledCharacteristic || !this.isConnected) {
        alert('Сначала подключитесь к устройству');
        return;
    }

    try {
        const command = state ? 1 : 0;
        
        // РАСШИРЕННЫЙ ПРОТОКОЛ: 2 байта [beacon_id, command]
        const value = new Uint8Array([beaconId, command]);
        await this.ledCharacteristic.writeValue(value);
        
        console.log('💡 Команда LED отправлена:', {beaconId, command});
        
        this.updateLedIndicator(command);
        
    } catch (error) {
        console.error('Ошибка управления LED:', error);
    }
}

    disconnect() {
        if (this.device && this.device.gatt.connected) {
            this.device.gatt.disconnect();
        }
        this.onDisconnected();
    }

    onDisconnected() {
        this.isConnected = false;
        this.device = null;
        this.server = null;
        this.coordCharacteristic = null;
        this.ledCharacteristic = null;
        this.lastLedState = null;
        this.updateUI();
        
        const ledStatusElement = document.getElementById("ledStatus");
        if (ledStatusElement) {
            ledStatusElement.innerHTML = '<span class="led-indicator"></span> ❓ ОТКЛЮЧЕНО';
            ledStatusElement.className = 'led-status led-unknown';
        }
        
        console.log('🔌 BLE отключен');
    }

    updateUI() {
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            if (this.isConnected) {
                connectBtn.textContent = '✅ BLE Подключен';
                connectBtn.style.background = '#28a745';
            } else {
                connectBtn.textContent = '🔗 Подключить BLE';
                connectBtn.style.background = '#1976d2';
            }
        }
    }
}

// Глобальный экземпляр
const bleManager = new BLEManager();

// Функции для приложения
function connectBLE() {
    bleManager.connect();
}

function setLedOn() {
    bleManager.setLed(true);
}

function setLedOff() {
    bleManager.setLed(false);
}
