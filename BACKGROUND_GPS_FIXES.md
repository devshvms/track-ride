# Background GPS Tracking Fixes

## Issues Fixed

### 1. **Timer Pausing When App Backgrounded**
- **Problem**: Timer would stop when app went to background, even though tracking should continue
- **Solution**: Disabled automatic pause on background in `auto-pause.service.ts`
- **Impact**: Timer now continues running when app is backgrounded during active tracking

### 2. **GPS Signal Loss in Background**
- **Problem**: GPS tracking would stop or become unreliable when app was backgrounded
- **Solution**: 
  - Implemented foreground service with persistent notification
  - Changed to always use `watchPosition` instead of interval-based polling
  - Increased GPS timeout to 15 seconds for better reliability
  - Set `maximumAge: 0` to always get fresh location data

### 3. **Foreground Service Implementation**
- **New Service**: `foreground-service.service.ts`
- **Features**:
  - Creates persistent notification showing ride stats (distance, time, speed)
  - Updates notification every second with current ride data
  - Keeps GPS active even when app is in background
  - Properly configured for Android 10+ with location foreground service type

### 4. **Android Manifest Updates**
- Added `foregroundServiceType="location"` for proper Android 10+ support
- Added `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` permission
- Configured foreground service declaration
- Added GPS as required hardware feature

## New Services Created

### `foreground-service.service.ts`
Manages the foreground notification that keeps the app running in background:
- Shows ongoing notification with ride statistics
- Updates every second with current distance, time, and speed
- Automatically starts when ride begins
- Stops when ride ends

### `background-task.service.ts`
Handles background task management:
- Monitors app state changes (foreground/background)
- Manages iOS background task execution
- Tracks background state for other services

### `battery-exemption.service.ts`
Placeholder for battery optimization exemption:
- Will request user to exempt app from battery optimization
- Ensures GPS can run continuously in background

## Location Service Improvements

### Changes to `location.service.ts`:
1. **Always use watchPosition**: Removed interval-based polling, now exclusively uses `watchPosition` for continuous GPS tracking
2. **Increased timeout**: Changed from 10s to 15s for better reliability
3. **Fresh location data**: Set `maximumAge: 0` to ensure accurate tracking
4. **Better error handling**: Errors no longer stop tracking, GPS monitor handles recovery

## Testing Instructions

### Build and Deploy
```bash
# Rebuild the Android app
cd ride-tracker
npm run build
npx cap sync android
npx cap open android

# Build and install on device
```

### Testing Checklist

1. **Start a Ride**
   - Start tracking a ride
   - Verify notification appears showing "Ride Tracker Active"
   - Check that distance, time, and speed are displayed

2. **Background Test**
   - Press home button to background the app
   - Wait 2-3 minutes while moving
   - Open app again
   - Verify:
     - Timer continued running (not paused)
     - GPS points were collected during background period
     - Distance increased appropriately
     - No gaps in the route

3. **Lock Screen Test**
   - Start a ride
   - Lock the phone screen
   - Keep moving for 5+ minutes
   - Unlock and check app
   - Verify tracking continued

4. **Long Duration Test**
   - Start a ride and background the app
   - Leave it running for 30+ minutes
   - Periodically check notification is still showing
   - Verify GPS tracking remained active

5. **GPS Signal Recovery**
   - Start a ride
   - Go into a building/tunnel (lose GPS)
   - Come back outside
   - Verify GPS reconnects and tracking resumes

## Battery Optimization Settings

For best results, users should:
1. Disable battery optimization for the app
2. Allow background location access
3. Keep notification enabled (required for foreground service)

## Known Limitations

1. **Battery Exemption**: Currently requires manual setup in Android settings
2. **iOS Background**: iOS has stricter background limitations, may need additional configuration
3. **Notification Required**: Users cannot dismiss the notification while tracking (by design for foreground service)

## Configuration

### Notification Channel
- **ID**: `ride-tracking`
- **Name**: Ride Tracking
- **Importance**: Default
- **Sound**: None (silent)
- **Vibration**: Disabled

### GPS Settings
- **Mode**: watchPosition (continuous)
- **Timeout**: 15 seconds
- **Maximum Age**: 0 (fresh data only)
- **High Accuracy**: Based on battery optimizer settings

## Troubleshooting

### If GPS still stops in background:
1. Check notification is showing
2. Verify background location permission granted
3. Check battery optimization is disabled
4. Ensure "Don't kill my app" settings for your device manufacturer
5. Check Android logs for errors

### If timer still pauses:
1. Verify auto-pause settings
2. Check app state logs in console
3. Ensure foreground service started successfully

## Code Changes Summary

**Modified Files:**
- `src/app/services/ride.service.ts` - Added foreground service integration
- `src/app/services/location.service.ts` - Improved GPS tracking reliability
- `src/app/services/auto-pause.service.ts` - Disabled background pause
- `android/app/src/main/AndroidManifest.xml` - Added foreground service config

**New Files:**
- `src/app/services/foreground-service.service.ts`
- `src/app/services/background-task.service.ts`
- `src/app/services/battery-exemption.service.ts`
- `android/app/src/main/res/values/notification_channels.xml`
