# CRITICAL: Background Tracking Stops After ~1 Minute

## Problem

**Severity**: CRITICAL 🚨

**Issue**: App tracking stops after ~1 minute when screen is locked and phone is in pocket.

**Symptoms**:
- Started ride at 9:05pm
- Locked screen and put phone in pocket
- Opened app at 9:31pm (26 minutes later)
- Elapsed time shows only ~1 minute
- GPS points only recorded for first ~1 minute
- **No "GPS Signal Lost" notification received**
- Opening app makes it start tracking again

## Root Cause

### The Real Problem

**We don't have a true Android Foreground Service!**

The current implementation uses `@capacitor/local-notifications` with `extra: { foregroundService: true }`, but this **DOES NOT** create a real Android foreground service. It's just a persistent notification.

### What's Happening

```
Start Ride
  ↓
Persistent notification shown ✅
  ↓
Screen locked
  ↓
~1 minute later...
  ↓
Android kills the app process ❌
  ↓
  - JavaScript execution stops
  - GPS polling stops
  - Wake lock released
  - All timers stopped
  ↓
App appears "frozen" in background
  ↓
User opens app → Process restarts → Tracking resumes
```

### Why Android Kills It

Without a **true foreground service**, Android treats the app as a normal background app and applies aggressive battery optimization:

1. **Doze Mode** (after screen off for ~1 minute)
   - Restricts network access
   - Defers background work
   - Limits GPS access

2. **App Standby**
   - Restricts background execution
   - Stops JavaScript execution
   - Kills the process

3. **Battery Optimization**
   - Even if user disabled it, without foreground service it's not fully effective
   - Android still applies restrictions

## What We Need

### True Android Foreground Service

A **foreground service** is a special Android service that:
- **Keeps app alive** even in Doze mode
- **Prevents process from being killed**
- **Maintains GPS access** in background
- **Requires persistent notification** (which we already have)
- **Has higher priority** than normal background apps

### Current vs. Required

| Feature | Current (LocalNotifications) | Required (Foreground Service) |
|---------|------------------------------|-------------------------------|
| Persistent notification | ✅ Yes | ✅ Yes |
| Prevents app kill | ❌ No | ✅ Yes |
| GPS in background | ❌ Limited | ✅ Full access |
| Doze mode exemption | ❌ No | ✅ Yes |
| Wake lock support | ⚠️ Partial | ✅ Full |

## Solutions

### Option 1: Use @capacitor-community/background-geolocation (RECOMMENDED)

**Best solution** - Purpose-built for background GPS tracking.

#### Installation
```bash
npm install @capacitor-community/background-geolocation
npx cap sync
```

#### Features
- ✅ True Android foreground service
- ✅ Background GPS tracking
- ✅ Battery efficient
- ✅ Handles Doze mode
- ✅ Motion detection
- ✅ Geofencing support

#### Implementation
```typescript
import BackgroundGeolocation from '@capacitor-community/background-geolocation';

// Configure
await BackgroundGeolocation.addWatcher({
  backgroundMessage: "Tracking your ride",
  backgroundTitle: "Ride Tracker Active",
  requestPermissions: true,
  stale: false,
  distanceFilter: 10 // meters
}, (location, error) => {
  if (location) {
    // Process GPS point
    this.processGPSPoint(location);
  }
});

// Start tracking
await BackgroundGeolocation.openSettings(); // For battery optimization
```

### Option 2: Create Custom Android Foreground Service Plugin

Create a Capacitor plugin with native Android code.

#### Steps
1. Create plugin structure
2. Implement Android Service class
3. Start service from JavaScript
4. Handle GPS in native code
5. Send data back to JavaScript

#### Pros
- Full control
- Custom features
- No external dependencies

#### Cons
- More complex
- Requires Android/Java knowledge
- More maintenance

### Option 3: Use @capacitor/background-runner (NEW in Capacitor 6)

Capacitor's official background execution solution.

#### Installation
```bash
npm install @capacitor/background-runner
npx cap sync
```

#### Features
- ✅ Official Capacitor plugin
- ✅ Background JavaScript execution
- ✅ Works with Doze mode
- ⚠️ Limited API access in background

## Recommended Implementation Plan

### Phase 1: Install Background Geolocation Plugin

```bash
cd ride-tracker
npm install @capacitor-community/background-geolocation
npx cap sync android
```

### Phase 2: Create Background Geolocation Service

Create `src/app/services/background-geolocation.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import BackgroundGeolocation from '@capacitor-community/background-geolocation';

@Injectable({ providedIn: 'root' })
export class BackgroundGeolocationService {
  private watcherId: string | null = null;

  async startTracking(callback: (location: any) => void): Promise<void> {
    this.watcherId = await BackgroundGeolocation.addWatcher({
      backgroundMessage: "Tracking your ride - tap to return",
      backgroundTitle: "Ride Tracker Active",
      requestPermissions: true,
      stale: false,
      distanceFilter: 10 // Update every 10 meters
    }, (location, error) => {
      if (error) {
        console.error('Background GPS error:', error);
        return;
      }
      if (location) {
        callback(location);
      }
    });
  }

  async stopTracking(): Promise<void> {
    if (this.watcherId) {
      await BackgroundGeolocation.removeWatcher({ id: this.watcherId });
      this.watcherId = null;
    }
  }

  async requestBatteryOptimizationExemption(): Promise<void> {
    await BackgroundGeolocation.openSettings();
  }
}
```

### Phase 3: Integrate with RideService

Update `ride.service.ts` to use background geolocation:

```typescript
import { BackgroundGeolocationService } from './background-geolocation.service';

constructor(
  // ... existing services
  private bgGeo: BackgroundGeolocationService
) {}

async startRide(): Promise<void> {
  // ... existing code
  
  // Start background geolocation
  await this.bgGeo.startTracking((location) => {
    const point: GpsPoint = {
      latitude: location.latitude,
      longitude: location.longitude,
      altitude: location.altitude,
      accuracy: location.accuracy,
      speed: location.speed || 0,
      timestamp: location.time
    };
    
    // Process point even if app is in background
    this.processNewPoint(point);
  });
}

async stopAndSaveRide(): Promise<void> {
  // Stop background geolocation
  await this.bgGeo.stopTracking();
  
  // ... existing code
}
```

### Phase 4: Update AndroidManifest.xml

The plugin should handle this automatically, but verify:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
```

### Phase 5: Test Thoroughly

1. Start ride
2. Lock screen
3. Put phone in pocket
4. Wait 30+ minutes
5. Check if tracking continued
6. Verify GPS points recorded throughout

## Alternative Quick Fix (Temporary)

If we can't install new plugins immediately, try these workarounds:

### 1. Use Capacitor App State + Periodic Checks

```typescript
import { App } from '@capacitor/app';

App.addListener('appStateChange', ({ isActive }) => {
  if (!isActive && this.isTracking) {
    // App went to background - try to keep alive
    this.startBackgroundKeepAlive();
  }
});

private startBackgroundKeepAlive(): void {
  // Force GPS checks more frequently
  setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => this.processPosition(pos),
      (err) => console.error(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, 5000); // Every 5 seconds
}
```

### 2. Use Audio Playback Trick (Hacky)

Play silent audio to keep app alive:

```typescript
const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10...');
audio.loop = true;
audio.volume = 0;
audio.play();
```

**Note**: These are **NOT reliable** and may violate Play Store policies.

## Testing Checklist

After implementing foreground service:

- [ ] Start ride and lock screen for 5 minutes
- [ ] Start ride and lock screen for 30 minutes
- [ ] Start ride and lock screen for 1 hour
- [ ] Test with battery saver mode enabled
- [ ] Test with Doze mode (adb shell dumpsys deviceidle force-idle)
- [ ] Test with app in background (other apps open)
- [ ] Verify notification stays visible
- [ ] Verify GPS points recorded continuously
- [ ] Check battery usage is reasonable

## Expected Results After Fix

### Before (Current)
```
Start ride → Lock screen → ~1 min → Android kills app ❌
GPS points: Only first ~1 minute
Elapsed time: Stops at ~1 minute
Notification: Disappears or becomes inactive
```

### After (With Foreground Service)
```
Start ride → Lock screen → 30+ min → App stays alive ✅
GPS points: Continuous throughout ride
Elapsed time: Accurate total time
Notification: Always visible and active
```

## Priority

**CRITICAL** - This must be fixed before app can be used for real rides.

## Estimated Effort

- **Option 1** (Background Geolocation plugin): 2-4 hours
- **Option 2** (Custom plugin): 1-2 days
- **Option 3** (Background Runner): 4-6 hours

## Next Steps

1. **Immediate**: Install `@capacitor-community/background-geolocation`
2. **Create**: Background geolocation service wrapper
3. **Integrate**: Update RideService to use background geolocation
4. **Test**: Thoroughly test background tracking
5. **Document**: Update user guide with battery optimization instructions

## References

- [@capacitor-community/background-geolocation](https://github.com/capacitor-community/background-geolocation)
- [Android Foreground Services](https://developer.android.com/develop/background-work/services/foreground-services)
- [Android Doze Mode](https://developer.android.com/training/monitoring-device-state/doze-standby)
- [Capacitor Background Runner](https://capacitorjs.com/docs/apis/background-runner)
