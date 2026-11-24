// Gwangjin-gu streetlight inventory, file dataset 15070592, attachment FILE_000000002511624.
// Local experiment IDs are separate from the district's original inventory identifiers.
export const sites = [
  { id: 'SL-01', road: 'Gunja-ro', asset: '군자로1-1', lat: 37.5536611, lon: 127.0735071 },
  { id: 'SL-02', road: 'Gunja-ro', asset: '군자로1-4', lat: 37.5530965, lon: 127.0723873 },
  { id: 'SL-03', road: 'Gunja-ro', asset: '군자로1-8', lat: 37.5526046, lon: 127.0715977 },
  { id: 'SL-04', road: 'Gunja-ro', asset: '군자로1-12', lat: 37.5516159, lon: 127.0710995 },
  { id: 'SL-05', road: 'Gunja-ro', asset: '군자로1-16', lat: 37.5506014, lon: 127.0709581 },
  { id: 'SL-06', road: 'Gunja-ro', asset: '군자로1-20', lat: 37.5495932, lon: 127.0707205 },
  { id: 'SL-07', road: 'Gunja-ro', asset: '군자로1-24', lat: 37.5485264, lon: 127.0704465 },
  { id: 'SL-08', road: 'Neungdong-ro', asset: '능동로14-3', lat: 37.5537795, lon: 127.0774051 },
  { id: 'SL-09', road: 'Neungdong-ro', asset: '능동로14-7', lat: 37.5529848, lon: 127.0770031 },
  { id: 'SL-10', road: 'Neungdong-ro', asset: '능동로14-11', lat: 37.5520445, lon: 127.0765568 },
  { id: 'SL-11', road: 'Neungdong-ro', asset: '능동로14-15', lat: 37.5511531, lon: 127.0761703 },
  { id: 'SL-12', road: 'Neungdong-ro', asset: '능동로14-19', lat: 37.5501417, lon: 127.0756698 },
  { id: 'SL-13', road: 'Neungdong-ro', asset: '능동로12-5', lat: 37.5487636, lon: 127.0748968 },
  { id: 'SL-14', road: 'Neungdong-ro', asset: '능동로12-10', lat: 37.5475776, lon: 127.0741686 },
  { id: 'SL-15', road: 'Gwangnaru-ro', asset: '광나루로1-5', lat: 37.5481144, lon: 127.069125 },
  { id: 'SL-16', road: 'Gwangnaru-ro', asset: '광나루로1-9', lat: 37.547942, lon: 127.0706684 },
  { id: 'SL-17', road: 'Gwangnaru-ro', asset: '광나루로1-13', lat: 37.5477594, lon: 127.0719034 },
  { id: 'SL-18', road: 'Gwangnaru-ro', asset: '광나루로1-17', lat: 37.5474598, lon: 127.0731816 },
  { id: 'SL-19', road: 'Gwangnaru-ro', asset: '광나루로6-11', lat: 37.547185, lon: 127.0751651 },
  { id: 'SL-20', road: 'Gwangnaru-ro', asset: '광나루로6-7', lat: 37.5465477, lon: 127.0764371 },
];

// Both the canvas and the interactive markers use this north-up schematic extent.
export function mapPoint(site) {
  return { x: (site.lon - 127.0684) / .0100, y: (37.5544 - site.lat) / .0088 };
}
