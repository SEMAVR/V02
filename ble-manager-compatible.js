// ble-manager-compatible.js
class BLEManager {
    constructor() {
        this.device = null;
        this.server = null;
        this.coordCharacteristic = null;
        this.ledCharacteristic = null;
        this.isConnected = false;
        this.currentBeaconId = 1; // По умолчанию маяк 1
    }

    async connect() {
        try {
            console.log('🔍 Поиск BLE устройств...');
            
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ name: 'ESP32-MultiTracker' }],
                optionalServices: ['12345678-1234-1234-1234-123456789abc']
            });

            console.log('📱 Устройство найдено:', this.device.name);
            
            this.device.addEventListener('gattserverdisconnected', () => {
                this.onDisconnected();
            });

            this.server = await this.device.gatt.connect();
            const service = await this.server.getPrimaryService('12345678-1234-1234-1234-123456789abc');

            // Характеристика координат
            this.coordCharacteristic = await service.getCharacteristic('12345678-1234-1234-1234-123456789abd');
            await this.coordCharacteristic.startNotifications();
            this.coordCharacteristic.addEventListener('characteristicvaluechanged', 
                (event) => this.handleCoordData(event));

            // Характеристика LED
            this.ledCharacteristic = await service.getCharacteristic('12345678-1234-1234-1234-123456789abe');

            this.isConnected = true;
            this.updateUI();
            
            console.log('🎉 BLE подключение установлено!');
            return true;

        } catch (error) {
            console.error('❌ Ошибка BLE:', error);
            alert('Ошибка подключения: ' + error.message);
            return false;
        }
    }

    handleCoordData(event) {
        try {
            const value = event.target.value;
            const dataString = new TextDecoder('utf-8').decode(value);
            
            console.log('📊 Получены данные:', dataString);
            
            const parts = dataString.split(',');
            if (parts.length >= 5) {
                const beaconId = parseInt(parts[0]);
                const lat = parseFloat(parts[1]);
                const lon = parseFloat(parts[2]);
                const speed = parseFloat(parts[3]);
                const ledState = parseInt(parts[4]);

                // Обновляем данные маяка
                if (typeof updateBeacon === 'function') {
                    updateBeacon(beaconId, lat, lon, speed);
                }

                // Обновляем статус LED
                if (typeof updateLedStatus === 'function') {
                    updateLedStatus(beaconId, ledState);
                }

                // Если это активный маяк, обновляем UI
                if (beaconId === this.currentBeaconId) {
                    document.getElementById("beaconCoords").textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
                    document.getElementById("speed").textContent = `${speed.toFixed(2)} км/ч`;
                    this.updateLedIndicator(ledState);
                }
            }
        } catch (error) {
            console.error('Ошибка обработки данных:', error);
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

    async sendLedCommand(command) {
        if (!this.ledCharacteristic || !this.isConnected) {
            alert('Сначала подключитесь к устройству');
            return;
        }

        try {
            // Отправляем 2 байта: [beaconId, command]
            const beaconId = this.currentBeaconId;
            const value = new Uint8Array([beaconId, command]);
            
            await this.ledCharacteristic.writeValue(value);
            console.log(`✅ Команда отправлена на маяк ${beaconId}: ${command}`);
            
            // Локальное обновление
            this.updateLedIndicator(command);
            
        } catch (error) {
            console.error('❌ Ошибка отправки команды:', error);
            alert('Ошибка отправки команды LED');
        }
    }

    setActiveBeacon(beaconId) {
        this.currentBeaconId = beaconId;
        console.log(`🎯 Активный маяк изменен на: ${beaconId}`);
        
        // Обновляем отображение статуса LED для нового активного маяка
        if (typeof updateLedStatus === 'function') {
            updateLedStatus(beaconId, 'unknown'); // Сбрасываем статус
        }
        this.updateLedIndicator('unknown');
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

// Глобальные функции
function connectBLE() {
    bleManager.connect();
}

function setLedOn() {
    bleManager.sendLedCommand(1);
}

function setLedOff() {
    bleManager.sendLedCommand(0);
}

function switchBeacon(beaconId) {
    bleManager.setActiveBeacon(beaconId);
}
