import { CAMPUS_SCHOOLS } from '@/constants/campus'
import { SEOUL_MAP_BOUNDS, SEOUL_SCHOOL_COORDINATES, projectSeoulCoordinate } from '@/features/campus/seoulSchools'
import { useSchoolIdentity } from '@/features/campus/schoolDirectory'

export function SeoulSchoolMarkers() {
  const identify = useSchoolIdentity()
  return (
    <g data-testid="seoul-school-markers" aria-label="서울 소재 대학 위치">
      {CAMPUS_SCHOOLS.map((school) => {
        const coordinate = SEOUL_SCHOOL_COORDINATES[school.id]
        if (!coordinate) return null
        const { x, y } = projectSeoulCoordinate(coordinate.lat, coordinate.lon)
        if (x < 0 || x > 480 || y < 0 || y > 394) return null
        const identity = identify(school.id)
        return (
          <g key={school.id} transform={`translate(${x} ${y})`}>
            <circle r="5" fill={identity?.color ?? school.primary} stroke="#fff" strokeWidth="2" />
            <title>{`${identity?.displayName ?? school.name} · ${coordinate.lat.toFixed(4)}, ${coordinate.lon.toFixed(4)}`}</title>
          </g>
        )
      })}
      <g transform={`translate(${projectSeoulCoordinate(SEOUL_MAP_BOUNDS.north, SEOUL_MAP_BOUNDS.west).x + 14} 22)`}>
        <rect width="170" height="26" rx="13" fill="#fff" fillOpacity="0.92" />
        <text x="13" y="17" fontSize="12" fontWeight="800" fill="#33415C">● 서울 소재 대학 위치</text>
      </g>
    </g>
  )
}
