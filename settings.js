// settings.js
const SETTINGS_KEY = 'mayak_settings_v10';
const DEFAULTS = {
  theme: 'auto',
  units: 'kmh',
  showMyLocation: true,
  autoFollow: true
};

function loadSettings() {
  try {
    const settings = localStorage.getItem(SETTINGS_KEY);
    return settings ? JSON.parse(settings) : DEFAULTS;
  } catch(e) {
    console.error("Ошибка загрузки настроек:", e);
    return DEFAULTS;
  }
}

function saveSettings(obj) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(obj));
    applySettings(obj);
  } catch(e) {
    console.error("Ошибка сохранения настроек:", e);
  }
}

function resetSettings() {
  try {
    localStorage.removeItem(SETTINGS_KEY);
    applySettings(DEFAULTS);
    updateSettingsForm(DEFAULTS);
  } catch(e) {
    console.error("Ошибка сброса настроек:", e);
  }
}

function applySettings(settings = null) {
  if (!settings) {
    settings = loadSettings();
  }

  const root = document.documentElement;
  
  // Применение темы
  if (settings.theme === 'dark') {
    root.classList.add('dark');
  } else if (settings.theme === 'light') {
    root.classList.remove('dark');
  } else {
    // Автоопределение темы
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }

  // Обновление элементов управления на карте
  updateMapControls(settings);
}

function updateSettingsForm(settings) {
  const themeSelect = document.getElementById('themeSelect');
  const unitsSelect = document.getElementById('unitsSelect');
  const showMyLocation = document.getElementById('showMyLocation');
  const autoFollow = document.getElementById('autoFollow');

  if (themeSelect) themeSelect.value = settings.theme;
  if (unitsSelect) unitsSelect.value = settings.units;
  if (showMyLocation) showMyLocation.checked = settings.showMyLocation;
  if (autoFollow) autoFollow.checked = settings.autoFollow;
}

function updateMapControls(settings) {
  // Перезапуск отслеживания местоположения при изменении настроек
  if (typeof startTracking === 'function') {
    startTracking();
  }
}

// Инициализация настроек при загрузке
document.addEventListener('DOMContentLoaded', () => {
  const settings = loadSettings();
  applySettings(settings);
  updateSettingsForm(settings);

  // Обработчики для формы настроек
  const saveBtn = document.getElementById('saveSettings');
  const resetBtn = document.getElementById('resetSettings');
  const closeBtn = document.getElementById('closeSettings');

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const newSettings = {
        theme: document.getElementById('themeSelect').value,
        units: document.getElementById('unitsSelect').value,
        showMyLocation: document.getElementById('showMyLocation').checked,
        autoFollow: document.getElementById('autoFollow').checked
      };
      saveSettings(newSettings);
      hideModal('settingsModal');
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetSettings();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      hideModal('settingsModal');
    });
  }

  // Слушатель изменения системной темы
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      const settings = loadSettings();
      if (settings.theme === 'auto') {
        applySettings(settings);
      }
    });
  }
});
