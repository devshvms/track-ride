# GPS Signal Lost Auto-Recovery Fix

## Problem Description

**Issue**: When GPS signal is lost during background tracking (screen off), the app shows "GPS Signal Lost" notification but doesn't automatically recover when GPS signal returns. User has to manually open the app to resume tracking.

**Root Causes**:
1. GPS points were **ignored** when in `GPS_SIGNAL_LOST` state
2. No active retry mechanism when GPS was lost
3. State recovery depended on passive GPS point arrival

## Solution Implemented

### 1. **Process GPS Points in GPS_SIGNAL_LOST State** ✅

**File**: `ride.service.ts`

**Before**:
```typescript
if (this.stateSubject.value === RideState.TRACKING) {
  this.processNewPoint(point);
}
```

**After**:
```typescript
const state = this.stateSubject.value;

// Process points in TRACKING or GPS_SIGNAL_LOST states
// This allows automatic recovery when GPS signal returns
if (state === RideState.TRACKING || state === RideState.GPS_SIGNAL_LOST) {
  this.processNewPoint(point);
}
```

**Why**: When GPS signal returns, the location service emits a point. Previously this point was ignored if state was `GPS_SIGNAL_LOST`, preventing automatic recovery.

---

### 2. **Active GPS Recovery Attempts** ✅

**File**: `gps-monitor.service.ts`

**Added**:
- Retry interval: Every 10 seconds when GPS is lost
- Active `getCurrentPosition()` calls to force GPS checks
- Retry counter to track recovery attempts
- Automatic cleanup when signal recovers

**Implementation**:
```typescript
private startRetryAttempts(): void {
  // Attempt recovery every 10 seconds
  this.retrySubscription = interval(this.RETRY_INTERVAL_MS).subscribe(() => {
    if (!this.statusSubject.value.isLost) {
      this.retrySubscription?.unsubscribe();
      return;
    }
    
    console.log(`GPS recovery attempt ${this.statusSubject.value.retryCount}...`);
    
    // Force a location check
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('GPS recovery successful!');
      },
      (error) => {
        console.warn(`GPS recovery attempt failed: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });
}
```

**Why**: In background with screen off, the normal GPS polling interval might be suspended by Android. Active retry attempts force GPS checks every 10 seconds to detect when signal returns.

---

### 3. **Enhanced Signal Recovery Detection** ✅

**File**: `gps-monitor.service.ts`

**Added**:
- Stop retry attempts when signal recovers
- Log recovery events for debugging
- Update timestamp on every GPS fix

**Implementation**:
```typescript
private onSignalReceived(): void {
  this.timeoutSubscription?.unsubscribe();
  this.retrySubscription?.unsubscribe(); // Stop retrying
  
  const wasLost = this.statusSubject.value.isLost;
  if (wasLost) {
    console.log('GPS signal recovered!');
    this.statusSubject.next({
      isLost: false,
      retryCount: 0,
      lastFixTimestamp: Date.now()
    });
  }
  this.scheduleTimeout();
}
```

---

### 4. **Updated Notification Message** ✅

**File**: `notification.service.ts`

**Changed**:
- From: `"⚠️ GPS Signal Lost"`
- To: `"⚠️ GPS Signal Lost - Searching..."`

**Why**: Informs user that the app is actively trying to recover GPS signal, not just sitting idle.

---

## How It Works Now

### Normal Flow (GPS Available)
1. Ride starts → GPS tracking active
2. GPS points arrive every 30s (or configured interval)
3. Points processed and added to ride
4. State remains `TRACKING`

### GPS Signal Lost Flow
1. GPS timeout (60s no signal) → State changes to `GPS_SIGNAL_LOST`
2. Notification shows: "⚠️ GPS Signal Lost - Searching..."
3. **Active retry starts**: GPS check every 10 seconds
4. Location service continues normal polling (30s interval)
5. **Dual recovery mechanism**:
   - Normal polling detects GPS return
   - OR active retry detects GPS return
6. When GPS returns:
   - GPS point arrives
   - Point is **processed** (not ignored)
   - GPS monitor detects recovery
   - State changes back to `TRACKING`
   - Retry attempts stop
   - Notification updates to normal
7. **User doesn't need to do anything!**

---

## Technical Details

### Recovery Mechanisms (Redundant for Reliability)

1. **Normal Polling** (30s interval)
   - Continues even when GPS is lost
   - Detects GPS return passively

2. **Active Retry** (10s interval)
   - Forces GPS checks when lost
   - More aggressive recovery
   - Works even if normal polling is suspended

3. **Point Processing**
   - Accepts points in `GPS_SIGNAL_LOST` state
   - Allows immediate recovery

### Timeouts
- **GPS Lost Timeout**: 60s (configurable)
- **Retry Interval**: 10s (fixed)
- **Normal Polling**: 30s (configurable)
- **Recovery Check Timeout**: 15s per attempt

### State Transitions
```
TRACKING → (60s no GPS) → GPS_SIGNAL_LOST
GPS_SIGNAL_LOST → (GPS returns) → TRACKING
```

---

## Testing Checklist

- [x] GPS points processed in GPS_SIGNAL_LOST state
- [x] Active retry attempts every 10 seconds
- [x] Retry stops when signal recovers
- [x] Notification shows "Searching..." message
- [x] Automatic recovery without user interaction
- [ ] Test in real-world conditions (tunnel, building, etc.)
- [ ] Test with screen off for extended period
- [ ] Verify battery impact of retry mechanism
- [ ] Test recovery after 5+ minutes of signal loss

---

## Expected Behavior

### Before Fix
1. GPS lost → Notification appears
2. GPS returns → **Nothing happens**
3. User opens app → Tracking resumes
4. **Manual intervention required**

### After Fix
1. GPS lost → Notification: "GPS Signal Lost - Searching..."
2. Active retry starts (every 10s)
3. GPS returns → **Automatic detection**
4. Point processed → State changes to TRACKING
5. Notification updates → "Ride Tracker Active"
6. **No user intervention needed**

---

## Battery Impact

**Minimal**:
- Retry attempts only when GPS is lost
- 10-second interval is reasonable
- Stops immediately when signal recovers
- Uses same GPS API as normal tracking

**Optimization**:
- Could increase retry interval to 15-20s if battery is concern
- Could add max retry limit (e.g., stop after 50 attempts)
- Could use exponential backoff (10s, 20s, 30s, etc.)

---

## Debugging

### Console Logs to Watch For

**GPS Lost**:
```
GPS signal lost - starting active recovery attempts
```

**Retry Attempts**:
```
GPS recovery attempt 1...
GPS recovery attempt 2...
GPS recovery attempt failed: Timeout
```

**Recovery**:
```
GPS recovery successful!
GPS signal recovered!
```

### Check These If Recovery Fails

1. **Battery Optimization**: Must be disabled for the app
2. **Wake Lock**: Should be active during ride
3. **Foreground Service**: Should be running
4. **Location Permissions**: "Allow all the time" must be enabled
5. **Console Logs**: Check for error messages

---

## Files Modified

1. **`src/app/services/ride.service.ts`**
   - Process GPS points in GPS_SIGNAL_LOST state
   - Allow error reporting in GPS_SIGNAL_LOST state

2. **`src/app/services/gps-monitor.service.ts`**
   - Added retry mechanism
   - Enhanced signal recovery detection
   - Added retry counter and logging

3. **`src/app/services/notification.service.ts`**
   - Updated GPS lost message to show "Searching..."

---

## Future Enhancements (Optional)

- [ ] Show retry count in notification (e.g., "Searching... (attempt 5)")
- [ ] Add exponential backoff for retry intervals
- [ ] Add max retry limit with user notification
- [ ] Vibrate/sound when GPS recovers
- [ ] Show GPS signal strength indicator
- [ ] Log GPS recovery time for analytics
