# Background GPS Tracking Fix

## Issues Fixed

### 1. ✅ Notification Ping Every 5 Seconds
**Problem**: Notification was updating every 5 seconds causing annoying sounds/vibrations.

**Solution**: 
- Removed the 5-second interval in `NotificationService`
- Notifications now only update when data actually changes (state, distance, elapsed time)
- Smart content comparison prevents duplicate updates

**Files Modified**:
- `src/app/services/notification.service.ts`

---

### 2. ✅ GPS Signal Lost / App Being Killed in Background
**Problem**: Android kills the app after going to background, causing "GPS Signal Lost" and only 1-2 minutes of tracking.

**Root Causes**:
1. Android battery optimization killing background processes
2. Device entering deep sleep and stopping GPS
3. Short GPS timeout causing failures
4. No wake lock to keep CPU active

**Solutions Implemented**:

#### A. Wake Lock Management
- Created `PowerManagementService` to acquire/release wake locks
- Wake lock prevents device from entering deep sleep during tracking
- Automatically released when ride stops to save battery

#### B. Improved GPS Configuration
- Increased GPS timeout from 15s to 30s for better reliability
- Added `maximumAge: 5000ms` to allow slightly cached locations
- Better error handling - retries on timeout instead of failing
- Continues tracking even on temporary GPS errors

#### C. Foreground Service
- Already configured with `foregroundServiceType="location"` in AndroidManifest
- Persistent notification keeps app alive
- Importance set to LOW to prevent sounds

#### D. Battery Optimization Exemption
- Added `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` permission
- PowerManagementService can request exemption
- User needs to manually disable battery optimization in Android settings

**Files Modified**:
- `src/app/services/power-management.service.ts` (NEW)
- `src/app/services/location.service.ts`
- `src/app/services/ride.service.ts`

---

## Required User Actions

### Critical: Disable Battery Optimization

For the app to work reliably in background, you **MUST** disable battery optimization:

1. Open **Android Settings**
2. Go to **Apps** → **Ride Tracker**
3. Tap **Battery**
4. Select **Unrestricted** (or "Don't optimize")

**Why?** Android's battery optimization will kill background GPS tracking even with a foreground service.

### Optional: Keep Screen On During Ride

For maximum reliability, you can:
- Keep screen on (dimmed) during ride
- Use a phone mount
- The app has `WAKE_LOCK` permission to prevent deep sleep

---

## How It Works Now

### When You Start a Ride:

1. **Wake Lock Acquired** - Prevents device sleep
2. **Foreground Service Started** - Shows persistent notification
3. **GPS Tracking Started** - Polls location at configured interval (30s default)
4. **Notification Shows** - Silent, updates only when data changes

### When Phone Goes to Background/Locked:

1. **Foreground Service Keeps App Alive** - Android won't kill it
2. **Wake Lock Prevents Deep Sleep** - CPU stays active for GPS
3. **GPS Continues Polling** - Every 30s (or configured interval)
4. **Notification Updates** - Only when distance/time/state changes

### When You Stop the Ride:

1. **Wake Lock Released** - Device can sleep normally
2. **Foreground Service Stopped** - Notification removed
3. **GPS Tracking Stopped** - Saves battery

---

## Testing Checklist

- [ ] Disable battery optimization for Ride Tracker app
- [ ] Start a ride
- [ ] Lock phone and put in pocket
- [ ] Drive/ride for 10+ minutes
- [ ] Check that tracking continues (no "GPS Signal Lost")
- [ ] Verify notification doesn't ping every 5 seconds
- [ ] Verify notification shows current stats
- [ ] Test pause/resume buttons on lockscreen notification

---

## Troubleshooting

### Still Getting "GPS Signal Lost"?

1. **Check Battery Optimization**: Settings → Apps → Ride Tracker → Battery → Unrestricted
2. **Check Location Permissions**: Ensure "Allow all the time" is selected
3. **Check GPS Signal**: Test in open area first (not indoors)
4. **Check Interval**: Longer intervals (60s) are more reliable than short ones (10s)

### Notification Still Making Sounds?

1. **Check Channel Settings**: Long-press notification → Settings
2. **Set to Silent**: Disable sound and vibration for "Ride Tracking" channel
3. **Verify Importance**: Should be set to LOW or DEFAULT

### Battery Draining Too Fast?

1. **Use Battery Saver Mode**: Settings → Tracking Mode → Battery Saver (60s interval)
2. **Reduce GPS Accuracy**: Settings → GPS Accuracy → Balanced
3. **Increase Interval**: Settings → Reading Interval → 60s or 5min

---

## Technical Details

### GPS Configuration
```typescript
{
  enableHighAccuracy: true,
  timeout: 30000,        // 30s timeout (was 15s)
  maximumAge: 5000       // Allow 5s cached location
}
```

### Notification Update Triggers
- State change (tracking → paused → tracking)
- Distance change (every meter)
- Elapsed time change (every second)
- Speed change

### Wake Lock
- Acquired: When ride starts
- Released: When ride stops/discarded
- Type: Partial wake lock (CPU stays on, screen can turn off)

---

## Permissions Required

Already configured in `AndroidManifest.xml`:

- ✅ `ACCESS_FINE_LOCATION` - GPS access
- ✅ `ACCESS_BACKGROUND_LOCATION` - Background GPS (Android 10+)
- ✅ `FOREGROUND_SERVICE` - Keep app alive
- ✅ `FOREGROUND_SERVICE_LOCATION` - Location foreground service
- ✅ `WAKE_LOCK` - Prevent deep sleep
- ✅ `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` - Battery exemption
- ✅ `POST_NOTIFICATIONS` - Show notifications

---

## Next Steps

If you still experience issues after disabling battery optimization:

1. Test on different Android versions (some are more aggressive)
2. Consider using a dedicated background geolocation plugin (e.g., `@capacitor-community/background-geolocation`)
3. Add logging to track when GPS stops working
4. Test with different GPS intervals (30s, 60s, 5min)

---

## Files Changed

1. **src/app/services/notification.service.ts**
   - Removed 5-second interval
   - Added smart content comparison
   - Updates only on data changes

2. **src/app/services/power-management.service.ts** (NEW)
   - Wake lock management
   - Battery optimization handling

3. **src/app/services/location.service.ts**
   - Increased GPS timeout to 30s
   - Added maximumAge for reliability
   - Better error handling

4. **src/app/services/ride.service.ts**
   - Integrated PowerManagementService
   - Acquires wake lock on start
   - Releases wake lock on stop

5. **src/app/services/foreground-service.service.ts**
   - Already configured for background location
   - Silent notifications
