# Ride Tracker — Bug & Workflow Gap Report

## CRITICAL COMPILE ERRORS

| File | Bug | Fix |
|------|-----|-----|
| `ride-summary.component.scss` | File starts with literal text `scss` — compile error | Remove `scss` prefix |
| `settings.page.scss` | File starts with literal text `scss` — compile error | Remove `scss` prefix |

## UNIT INCONSISTENCY (Data Layer Bug)

`RideUtils.calculateAverageSpeed()` returns **km/h** (via `msToKph()`).  
`GpsPoint.speed` is stored in **m/s** (raw from GPS).  
`Ride.maxSpeed` is updated from raw `GpsPoint.speed` → stored in **m/s**.  
`Ride.averageSpeed` is stored in **km/h** (via `calculateAverageSpeed`).

**Result:** Mixed units in the same model object — `maxSpeed` (m/s) vs `averageSpeed` (km/h).

**Templates are also inconsistent:**
- `home.page.html`: `ride.averageSpeed * 3.6` → wrong (already km/h, multiplies again)
- `ride-summary.component.html`: `ride.averageSpeed` (no conversion) vs `ride.maxSpeed * 3.6` (converts)

**Fix:** Store `averageSpeed` in m/s. Change `calculateAverageSpeed()` to return m/s. Use `* 3.6` everywhere in templates consistently.

## WORKFLOW VIOLATIONS

### Home Screen
| Missing Feature | Workflow Reference |
|---|---|
| GPS signal strength indicator in IDLE state | Section 3, IDLE state |
| Battery mode badge reads settings, not hardcoded "High" | Section 3, IDLE state |
| Live elapsed time timer | Section 3, TRACKING state |
| Max speed stat card | Section 3, TRACKING state |
| GPS points logged count stat card | Section 3, TRACKING state |
| Mini live map with route drawn during tracking | Section 3, TRACKING state |
| Stop modal missing "Discard Ride" action | Section 3, STOP_CONFIRMATION |
| Ride Summary missing "View in History" button | Section 3, RIDE_SUMMARY |
| Ride Summary missing speed graph preview | Section 3, RIDE_SUMMARY |

### History Screen (Almost entirely missing)
| Missing Feature | Workflow Reference |
|---|---|
| Empty state with illustration + CTA to Home | Section 4, Empty State |
| Date range filter (start → end date) | Section 4, Rides List |
| Minimum distance filter | Section 4, Rides List |
| Minimum average speed filter | Section 4, Rides List |
| Text search bar | Section 4, Rides List |
| Share button on each ride card | Section 4, Rides List |
| Thumbnail map preview on ride cards | Section 4, Rides List |
| Navigation to Ride Detail view | Section 4, Rides List |
| Ride Detail page (entire page missing) | Section 4, Ride Detail View |
| GPX export from detail view | Section 4, Ride Detail View |
| Breaks log in detail view | Section 4, Ride Detail View |
| Delete confirmation modal | Section 4, Delete Confirmation |
| Native share sheet with GPX toggle | Section 4, Native Share Sheet |

### Settings Screen
| Missing Feature | Workflow Reference |
|---|---|
| GPS Accuracy section (High/Balanced/Low) | Section 5, GPS Accuracy |
| Reading interval slider (3s/5s/10s/30s) | Section 5, Reading Interval |
| Auto-pause detailed settings (threshold, min speed, toggles) | Section 5, Auto-Pause Settings |
| Theme preference (Light/Dark/System) | Section 5, Preferences |
| Map type preference (Street/Satellite/Terrain) | Section 5, Preferences |
| Push notifications toggle | Section 5, Preferences |
| Auth section has broken HTML (ion-avatar outside ion-item) | Section 5, Google Account |

## SERVICE BUGS

| Service | Bug | Fix |
|---|---|---|
| `LocationService` | Hardcodes `enableHighAccuracy: true`, ignores settings | Read from `SettingsService` |
| `LocationService` | `watchPosition` runs continuously regardless of interval setting | Implement interval-based polling using `getCurrentPosition` on a timer, or throttle watch |
| `AutoPauseService` | Imports `GpsMonitorService` but never injects or uses it | Remove unused import |
| `RideService` | `averageSpeed` set to km/h, model stores mixed units | Fix to m/s |
| `GpsMonitorService` | `gpsLostTimeout` in settings is `10000` (ms) but compared as seconds | Unify: store seconds in settings, multiply by 1000 in service |

## MODULE ISSUES

| File | Issue |
|---|---|
| `history.module.ts` | Imports `ExploreContainerComponentModule` but history.page.html doesn't use `<app-explore-container>` |
| `history.module.ts` | Imports standalone `HistoryPage` in `imports[]` — should be only in routing |
| `home.module.ts` | Same issue with ExploreContainerComponentModule |

## MISSING FILES TO CREATE
- `src/app/history/history-detail/history-detail.page.ts`
- `src/app/history/history-detail/history-detail.page.html`
- `src/app/history/history-detail/history-detail.page.scss`
- `src/app/pipes/duration.pipe.ts`
- `src/app/utils/gpx-export.util.ts`