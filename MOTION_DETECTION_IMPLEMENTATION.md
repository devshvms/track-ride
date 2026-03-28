# Motion Detection for Background Auto-Resume

## Overview
Implemented accelerometer-based motion detection to enable auto-resume when the ride is paused and the user starts moving again, even when the app is in the background.

## How It Works

### 1. **Motion Detection Service** (`motion-detection.service.ts`)
- Monitors accelerometer data when ride is auto-paused
- Detects significant device movement using a rolling buffer
- Filters out noise by requiring sustained acceleration above threshold (2.0 m/s²)
- Triggers GPS checks with 5-second cooldown to prevent excessive battery drain

### 2. **Smart Auto-Resume Flow**
```
Ride Auto-Paused (stationary detected)
    ↓
Start Motion Monitoring (accelerometer)
    ↓
Detect Significant Movement (device shaking/moving)
    ↓
Trigger GPS Location Check
    ↓
Calculate Distance from Pause Location
    ↓
If Distance > 50m → Auto-Resume Ride
If Distance < 50m → Continue Monitoring
```

### 3. **Key Features**
- ✅ **Works in Background**: Accelerometer continues monitoring even when app is backgrounded
- ✅ **Battery Efficient**: Only checks GPS when motion is detected
- ✅ **No Permission on Android**: Accelerometer works without user permission
- ✅ **iOS Permission**: One-time permission request on iOS (required by Apple)
- ✅ **Distance Verification**: Prevents false positives by requiring 50m movement
- ✅ **Cooldown Protection**: 5-second cooldown between GPS checks

## Technical Details

### Motion Detection Parameters
- **Buffer Size**: 10 readings (smooths out noise)
- **Movement Threshold**: 2.0 m/s² (normalized acceleration)
- **Distance Threshold**: 50 meters
- **Check Cooldown**: 5000ms (5 seconds)

### Integration Points
1. **Auto-Pause Triggered** → Start motion monitoring with pause location
2. **Motion Detected** → Check GPS and calculate distance
3. **Distance Exceeded** → Trigger auto-resume
4. **Manual Resume/Stop** → Stop motion monitoring

## Testing Instructions

### Test Scenario 1: Basic Auto-Resume
1. Start a ride and begin moving
2. Stop moving for configured time (auto-pause triggers)
3. Wait for app to auto-pause
4. Start moving again (walk/bike >50m)
5. **Expected**: Ride should auto-resume without opening the app

### Test Scenario 2: Background Detection
1. Start a ride and auto-pause
2. Background the app (press home button)
3. Start moving significantly (walk >50m)
4. **Expected**: When you return to app, ride should be resumed

### Test Scenario 3: False Positive Prevention
1. Start a ride and auto-pause
2. Make small movements (<50m) like adjusting position
3. **Expected**: Ride should NOT resume (distance threshold not met)

## Configuration

The following parameters can be adjusted in `motion-detection.service.ts`:
- `BUFFER_SIZE`: Number of acceleration readings to average (default: 10)
- `MOVEMENT_THRESHOLD`: Minimum acceleration to trigger check (default: 2.0 m/s²)
- `DISTANCE_THRESHOLD`: Minimum distance to auto-resume (default: 50m)
- `CHECK_COOLDOWN`: Time between GPS checks (default: 5000ms)

## Platform Differences

### Android
- ✅ No permission required for accelerometer
- ✅ Works immediately in background
- ✅ Battery efficient

### iOS
- ⚠️ Requires one-time motion permission
- ⚠️ May have stricter background limitations
- ✅ Still more efficient than continuous GPS polling

## Benefits Over GPS-Only Approach

| Aspect | GPS-Only | Motion + GPS |
|--------|----------|--------------|
| Battery Usage | High (continuous polling) | Low (event-driven) |
| Background Support | Limited/throttled | Better (sensor-based) |
| False Positives | More (GPS drift) | Fewer (distance verification) |
| Latency | Slow (polling interval) | Fast (immediate detection) |

## Next Steps

1. **Test on Real Device**: Motion sensors don't work in emulators
2. **Adjust Thresholds**: Fine-tune based on real-world usage
3. **Add User Settings**: Allow users to configure sensitivity
4. **Monitor Battery Impact**: Track actual battery usage in production
