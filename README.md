# Ride Tracker

A clean, multi-OS mobile and web application optimized for battery efficiency, built using Ionic and the Capacitor framework.

> 📐 **Design Reference:** [Figma — Full Screen Flow](https://www.figma.com/board/rVeytjV3OgTR21XwumnnY7/Ride-Tracker-%E2%80%94-Full-Screen-Flow?node-id=0-1&t=5vblPkksFFwIHH7k-0)
>
> 📄 **Detailed Workflow:** See [SCREENS_WORKFLOW.md](./SCREENS_WORKFLOW.md) for complete state machine documentation.

---

## Overview

Ride Tracker helps users monitor their journeys with real-time GPS tracking, detailed ride statistics, and history management. The application follows SOLID principles and utilizes design patterns for a robust and maintainable codebase.

---

## Features

### 🏠 Home Screen (Ride Tracking)
- **Start/Pause/Stop Controls** — Easy-to-use buttons to manage ride tracking
- **GPS Tracking** — Reads GPS coordinates at configurable intervals
- **Live Stats Dashboard** — Distance, speed (current/avg/max), elapsed time, GPS points, breaks
- **Auto-Pause/Resume** — Automatically pauses when stationary or backgrounded
- **Pause Reasons** — Select reasons like Break, Refreshment, Traffic, Fuel Stop, Photo Stop
- **Ride Summary** — On completion, displays total time, distance, speeds, breaks, and route map

### 📋 History Screen
- **Ride Listing** — Comprehensive list of all previous rides
- **Filtering** — Date range, minimum distance, minimum speed, text search
- **Detailed View** — Full ride details with route map and speed graph
- **Sharing** — Share ride summaries and maps via native share sheet

### ⚙️ Settings Screen
- **GPS Accuracy** — High / Balanced / Low modes for battery optimization
- **Reading Interval** — 3s / 5s / 10s / 30s polling frequency
- **Auto-Pause Settings** — Configurable thresholds and triggers
- **Preferences** — Units (km/miles), theme, map type, notifications
- **Google Integration** — Sign in/out with Google for Drive sync

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| Framework | [Ionic Framework](https://ionicframework.com/) (Angular 20) |
| Native Bridge | [Capacitor](https://capacitorjs.com/) 8.x |
| Maps | [Leaflet](https://leafletjs.com/) |
| State Management | RxJS Observables |
| Design Principles | SOLID, State Machine Pattern |

---

## Project Structure

```
ride-tracker/
├── src/app/
│   ├── home/                 # Home screen + modals
│   │   ├── pause-modal/      # Manual pause reason selection
│   │   ├── stop-modal/       # Stop confirmation dialog
│   │   └── ride-summary/     # Post-ride summary component
│   ├── history/              # History list + detail views
│   ├── settings/             # Settings configuration
│   ├── services/             # Core business logic
│   │   ├── ride.service.ts         # Main ride tracking orchestrator
│   │   ├── location.service.ts     # GPS coordinate acquisition
│   │   ├── history.service.ts      # Local persistence
│   │   ├── auto-pause.service.ts   # Auto-pause/resume detection
│   │   ├── gps-monitor.service.ts  # GPS signal monitoring
│   │   ├── settings.service.ts     # User preferences
│   │   ├── auth.service.ts         # Google OAuth
│   │   └── google-drive.service.ts # Cloud sync
│   ├── models/               # TypeScript interfaces
│   ├── pipes/                # Display formatting pipes
│   └── utils/                # Calculation utilities
```

---

## Development Progress

### ✅ Phase 1: Foundation
- [x] Initialize Ionic project with Tabs template
- [x] Structure folders and rename tabs to Home, History, Settings
- [x] Set up navigation and routing (`/tabs/home`, `/tabs/history`, `/tabs/settings`)

### ✅ Phase 2: Core Services
- [x] Implement `RideService` — GPS tracking orchestrator with state machine
- [x] Implement `LocationService` — Capacitor Geolocation wrapper
- [x] Implement `HistoryService` — Local storage persistence
- [x] Implement `SettingsService` — User preferences management
- [x] Implement `AutoPauseService` — Stationary/background detection
- [x] Implement `GpsMonitorService` — Signal loss handling
- [x] Implement `AuthService` — Google Sign-in (scaffold)
- [x] Implement `GoogleDriveService` — Cloud sync (scaffold)

### ✅ Phase 3: Home Screen Implementation
- [x] Ride state machine (IDLE → TRACKING → PAUSED → SUMMARY)
- [x] Live stats dashboard (distance, speed, elapsed, GPS points, breaks)
- [x] Pause modal with reason selection
- [x] Stop modal with save/discard options
- [x] Ride summary component
- [x] Auto-pause/resume logic
- [x] GPS signal lost handling

### ✅ Phase 4: History & Details
- [x] Rides list with reactive filtering
- [x] Date range, distance, speed filters
- [x] Swipe-to-delete functionality
- [x] Share ride summary
- [x] Detailed ride view with interactive Leaflet map
- [x] GPX export via `GpxExportService`
- [x] Share as image via `MapImageExportService`

### ✅ Phase 5: Settings & Sync
- [x] Settings UI structure
- [x] Units toggle (km/miles)
- [x] Auto-pause enable/disable toggle
- [x] Google Sign-in UI (login/logout buttons)
- [x] Sync status display with manual sync button
- [x] GPS accuracy configuration UI (High/Balanced/Low)
- [x] Reading interval UI (3s/5s/10s/30s)
- [x] Auto-pause threshold settings UI
- [x] Theme selection (Light/Dark/System)
- [x] Map type selection (Street/Satellite/Terrain)
- [x] Push notifications toggle
- [x] Google OAuth2 flow completion
- [x] Data synchronization implementation

### ✅ Phase 6: Refinement
- [x] Map integration (Leaflet route plotting in ride detail)
- [x] Static map image generation for sharing
- [x] Mini live map during tracking
- [x] Speed graph in ride detail view
- [x] Battery usage optimization
- [x] UI/UX polishing for all screen sizes
- [ ] Comprehensive testing on Android, iOS, and Web

---

## Getting Started

```bash
# Install dependencies
cd ride-tracker
npm install

# Run development server
npm start

# Build for production
npm run build
```

---

## Android Build

### Prerequisites

1. **Android Studio** — [Download](https://developer.android.com/studio)
2. **Android SDK** — Install via Android Studio SDK Manager
3. **Java JDK 17+** — Required for Gradle builds

### Step-by-Step Build Commands

```bash
# 1. Navigate to project directory
cd ride-tracker

# 2. Install dependencies (if not already done)
npm install

# 3. Build the web app for production
npm run build

# 4. Install Capacitor Android platform (already included in package.json)
npm install @capacitor/android

# 5. Add Android platform (creates android/ folder)
npx cap add android

# 6. Sync web assets and plugins to Android
npx cap sync android

# 7. Open in Android Studio (recommended for first build)
npx cap open android
```

### Build APK via Command Line

```bash
# Navigate to android folder
cd ride-tracker/android

# Build debug APK
./gradlew assembleDebug

# Build release APK (unsigned)
./gradlew assembleRelease
```

**Output locations:**
- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- Release APK: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

### Run on Connected Device

```bash
# From ride-tracker directory
npx cap run android
```

### After Code Changes

```bash
# Rebuild web app and sync to Android
npm run build && npx cap sync android
```

---

## iOS Build

### Prerequisites

1. **macOS** with Xcode installed
2. **Xcode Command Line Tools** — `xcode-select --install`
3. **CocoaPods** — `sudo gem install cocoapods`

### Step-by-Step Build Commands

```bash
# 1. Navigate to project directory
cd ride-tracker

# 2. Build the web app
npm run build

# 3. Add iOS platform
npx cap add ios

# 4. Sync web assets and plugins
npx cap sync ios

# 5. Open in Xcode
npx cap open ios
```

Build and run from Xcode for device/simulator deployment.

---

## State Machine

The Home screen operates as a state machine with the following states:

```
IDLE → TRACKING → PAUSED/AUTO_PAUSED → TRACKING → STOP_CONFIRMATION → RIDE_SUMMARY → IDLE
                ↘ GPS_SIGNAL_LOST ↗
```

See [SCREENS_WORKFLOW.md](./SCREENS_WORKFLOW.md) for complete state transition documentation.

---

## License

MIT
