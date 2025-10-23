// history-manager.js
const HISTORY_KEY = 'mayak_multi_history_v10';
const MAX_POINTS_PER_BEACON = 500;

const HistoryManager = {
  load() {
    try {
      const data = localStorage.getItem(HISTORY_KEY);
      return data ? JSON.parse(data) : {};
    } catch(e) {
      console.error("Ошибка загрузки истории:", e);
      return {};
    }
  },

  save(obj) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(obj));
    } catch(e) {
      console.error("Ошибка сохранения истории:", e);
    }
  },

  add(beaconId, lat, lon, speed) {
    const history = this.load();
    const beaconKey = `beacon_${beaconId}`;
    
    if (!history[beaconKey]) {
      history[beaconKey] = [];
    }
    
    history[beaconKey].push({
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      speed: speed ? parseFloat(speed) : null,
      time: Date.now()
    });
    
    // Ограничение размера истории для каждого маяка
    while (history[beaconKey].length > MAX_POINTS_PER_BEACON) {
      history[beaconKey].shift();
    }
    
    this.save(history);
  },

  clear(beaconId = null) {
    try {
      if (beaconId === null) {
        // Очистить всю историю
        localStorage.removeItem(HISTORY_KEY);
      } else {
        // Очистить историю конкретного маяка
        const history = this.load();
        const beaconKey = `beacon_${beaconId}`;
        if (history[beaconKey]) {
          delete history[beaconKey];
          this.save(history);
        }
      }
    } catch(e) {
      console.error("Ошибка очистки истории:", e);
    }
  },

  exportGPX(beaconId = 'all') {
    const history = this.load();
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Многомаяковый Finder" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Трек маяков</name>
    <desc>Трек координат многомаяковой системы</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
`;
    
    if (beaconId === 'all') {
      // Экспорт всех маяков
      for (let i = 0; i < 8; i++) {
        const beaconKey = `beacon_${i}`;
        if (history[beaconKey] && history[beaconKey].length > 0) {
          gpx += this._generateTrackSegment(i, history[beaconKey]);
        }
      }
    } else {
      // Экспорт конкретного маяка
      const beaconKey = `beacon_${beaconId}`;
      if (history[beaconKey] && history[beaconKey].length > 0) {
        gpx += this._generateTrackSegment(beaconId, history[beaconKey]);
      }
    }
    
    gpx += `</gpx>`;
    return gpx;
  },

  _generateTrackSegment(beaconId, points) {
    let segment = `  <trk>
    <name>Маяк ${beaconId}</name>
    <trkseg>
`;
    
    points.forEach(point => {
      const time = new Date(point.time).toISOString();
      segment += `      <trkpt lat="${point.lat}" lon="${point.lon}">\n`;
      if (point.speed) {
        segment += `        <speed>${point.speed}</speed>\n`;
      }
      segment += `        <time>${time}</time>\n`;
      segment += `      </trkpt>\n`;
    });
    
    segment += `    </trkseg>
  </trk>
`;
    return segment;
  },

  exportCSV(beaconId = 'all') {
    const history = this.load();
    let csv = 'beacon_id,lat,lon,speed,timestamp,datetime\n';
    
    if (beaconId === 'all') {
      // Экспорт всех маяков
      for (let i = 0; i < 8; i++) {
        const beaconKey = `beacon_${i}`;
        if (history[beaconKey]) {
          history[beaconKey].forEach(point => {
            const date = new Date(point.time);
            csv += `${i},${point.lat},${point.lon},${point.speed || ''},${point.time},"${date.toISOString()}"\n`;
          });
        }
      }
    } else {
      // Экспорт конкретного маяка
      const beaconKey = `beacon_${beaconId}`;
      if (history[beaconKey]) {
        history[beaconKey].forEach(point => {
          const date = new Date(point.time);
          csv += `${beaconId},${point.lat},${point.lon},${point.speed || ''},${point.time},"${date.toISOString()}"\n`;
        });
      }
    }
    
    return csv;
  },

// В history-manager.js добавьте эту функцию если её нет
getBeaconHistory(beaconId, count = 50) {
  const history = this.load();
  const beaconKey = `beacon_${beaconId}`;
  return history[beaconKey] ? history[beaconKey].slice(-count) : [];
},

// И если нет функции getAllHistory, добавьте:
getAllHistory() {
  const history = this.load();
  const allPoints = [];
  
  for (let i = 0; i < 8; i++) {
    const beaconKey = `beacon_${i}`;
    if (history[beaconKey]) {
      history[beaconKey].forEach(point => {
        allPoints.push({
          ...point,
          beaconId: i
        });
      });
    }
  }
  
  // Сортируем по времени
  return allPoints.sort((a, b) => a.time - b.time);
}
};
