/** 서울 소재 주요 대학 캠퍼스의 대표 좌표(WGS84). 지도 마커 표시용입니다. */
export const SEOUL_SCHOOL_COORDINATES: Record<string, { lat: number; lon: number }> = {
  snu: { lat: 37.4599, lon: 126.9519 },
  yonsei: { lat: 37.5658, lon: 126.9386 },
  korea: { lat: 37.5894, lon: 127.0322 },
  sogang: { lat: 37.5510, lon: 126.9410 },
  skku: { lat: 37.5870, lon: 126.9940 },
  hanyang: { lat: 37.5572, lon: 127.0453 },
  cau: { lat: 37.5046, lon: 126.9570 },
  khu: { lat: 37.5966, lon: 127.0527 },
  hufs: { lat: 37.5970, lon: 127.0586 },
  uos: { lat: 37.5839, lon: 127.0586 },
  konkuk: { lat: 37.5408, lon: 127.0788 },
  dongguk: { lat: 37.5583, lon: 126.9986 },
  hongik: { lat: 37.5512, lon: 126.9250 },
  ewha: { lat: 37.5619, lon: 126.9466 },
  sookmyung: { lat: 37.5444, lon: 126.9647 },
  kookmin: { lat: 37.6100, lon: 126.9960 },
  soongsil: { lat: 37.4963, lon: 126.9574 },
  kwangwoon: { lat: 37.6195, lon: 127.0585 },
  sejong: { lat: 37.5507, lon: 127.0739 },
  seoultech: { lat: 37.6317, lon: 127.0771 },
  sungshin: { lat: 37.5913, lon: 127.0204 },
  seoulwomens: { lat: 37.6281, lon: 127.0900 },
  dongduk: { lat: 37.6063, lon: 127.0418 },
  sangmyung: { lat: 37.6020, lon: 126.9550 },
}

export const SEOUL_MAP_BOUNDS = {
  north: 37.70,
  south: 37.42,
  west: 126.85,
  east: 127.18,
}

export function projectSeoulCoordinate(lat: number, lon: number, width = 480, height = 394) {
  const x = ((lon - SEOUL_MAP_BOUNDS.west) / (SEOUL_MAP_BOUNDS.east - SEOUL_MAP_BOUNDS.west)) * width
  const y = ((SEOUL_MAP_BOUNDS.north - lat) / (SEOUL_MAP_BOUNDS.north - SEOUL_MAP_BOUNDS.south)) * height
  return { x, y }
}
