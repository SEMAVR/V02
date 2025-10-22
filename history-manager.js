// history-manager.js
const HISTORY_KEY = 'mayak_history_v10';
const MAX_POINTS = 1000;

const HistoryManager = {
  load() {
    try {
      const data = localStorage.getItem(HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch(e) {
      console.error("Ошибка загрузки истории:", e);
      return [];
    }
  },

  save(arr) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
    } catch(e) {
      console.error("Ошибка сохранения истории:", e);
    }
  },

  add(lat, lon, speed) {
    const arr = this.load();
    arr.push({
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      speed: speed ? parseFloat(speed) : null,
      time: Date.now()
    });
    
    // Ограничение размера истории
    while (arr.length > MAX_POINTS) {
      arr.shift();
    }
    
    this.save(arr);
  },

  clear() {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch(e) {
      console.error("Ошибка очистки истории:", e);
    }
  },

  exportGPX() {
    const arr = this.load();
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Маяк Finder" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Трек маяка</name>
    <desc>Трек координат маяка</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>Трек маяка</name>
    <trkseg>
`;
    
    arr.forEach(point => {
      const time = new Date(point.time).toISOString();
      gpx += `      <trkpt lat="${point.lat}" lon="${point.lon}">\n`;
      if (point.speed) {
        gpx += `        <speed>${point.speed}</speed>\n`;
      }
      gpx += `        <time>${time}</time>\n`;
      gpx += `      </trkpt>\n`;
    });
    
    gpx += `    </trkseg>
  </trk>
</gpx>`;
    
    return gpx;
  },

  exportCSV() {
    const arr = this.load();
    let csv = 'lat,lon,speed,timestamp,datetime\n';
    arr.forEach(point => {
      const date = new Date(point.time);
      csv += `${point.lat},${point.lon},${point.speed || ''},${point.time},"${date.toISOString()}"\n`;
    });
    return csv;
  },

  getLastPoints(count = 10) {
    const arr = this.load();
    return arr.slice(-count);
  }
};
