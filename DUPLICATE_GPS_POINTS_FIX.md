# Duplicate GPS Points Fix

## Problem

**Issue**: Getting **2 GPS points every 10 seconds** instead of 1 when reading interval is set to 10s in settings.

**Expected**: 1 GPS point every 10 seconds
**Actual**: 2 GPS points every 10 seconds

## Root Cause

The location service had **duplicate GPS polling intervals** running simultaneously due to:

1. **Settings subscription firing immediately** on subscribe
2. **No cleanup of existing intervals** before starting new ones
3. **Order of operations**: Settings subscription created before starting tracking

### The Bug Flow

```
startTracking() called
  ↓
Subscribe to settings$ (fires immediately with current settings)
  ↓
Settings callback checks if interval changed
  ↓
Calls restartWithNewSettings() even though we haven't started yet
  ↓
startWithCurrentSettings() called
  ↓
Now we have TWO intervals running!
```

## Solution

### 1. **Skip First Settings Emission** ✅

Start tracking first, then subscribe to settings changes but skip the initial emission.

**Before**:
```typescript
this.settingsSub = this.settings.settings$.subscribe(settings => {
  // This fires immediately, causing duplicate start
  if (newInterval !== this.currentInterval) {
    this.restartWithNewSettings();
  }
});

this.startWithCurrentSettings(); // Called after subscription
```

**After**:
```typescript
// Start with current settings first
this.startWithCurrentSettings();

// Then subscribe to settings changes (skip first emission)
let isFirstEmission = true;
this.settingsSub = this.settings.settings$.subscribe(settings => {
  if (isFirstEmission) {
    isFirstEmission = false;
    return; // Skip first emission to avoid duplicate start
  }
  
  if (newInterval !== this.currentInterval) {
    this.restartWithNewSettings();
  }
});
```

### 2. **Clean Up Existing Intervals** ✅

Always clear existing intervals/subscriptions before starting new ones.

**Added to `startTracking()`**:
```typescript
// Clean up any existing subscriptions/intervals first
if (this.settingsSub) {
  this.settingsSub.unsubscribe();
  this.settingsSub = null;
}
if (this.intervalId !== null) {
  clearInterval(this.intervalId);
  this.intervalId = null;
}
```

**Added to `startWithCurrentSettings()`**:
```typescript
// Clear any existing interval first (safety check)
if (this.intervalId !== null) {
  clearInterval(this.intervalId);
  this.intervalId = null;
}
```

### 3. **Improved Guard Check** ✅

Enhanced the "already tracking" check with better logging.

**Before**:
```typescript
if (this.isTracking) {
  console.warn('Tracking already active');
  return;
}
```

**After**:
```typescript
if (this.isTracking) {
  console.warn('Tracking already active - ignoring duplicate start request');
  return;
}
```

## Files Modified

**`src/app/services/location.service.ts`**:
- Reordered: Start tracking before subscribing to settings
- Skip first settings emission to prevent duplicate start
- Clean up existing intervals/subscriptions before starting
- Added safety checks in `startWithCurrentSettings()`

## How It Works Now

### Correct Flow

```
startTracking() called
  ↓
Check if already tracking (return if yes)
  ↓
Clean up any existing intervals/subscriptions
  ↓
startWithCurrentSettings()
  ↓
  - Clear interval (safety check)
  - Get initial position
  - Start setInterval with configured interval
  ↓
Subscribe to settings$ changes
  ↓
Skip first emission (we already started)
  ↓
Only restart if settings actually change
```

### Result

- **1 GPS point** per configured interval (10s, 30s, etc.)
- No duplicate intervals
- Clean startup and shutdown
- Settings changes properly trigger restart

## Testing

### Before Fix
```
Interval: 10s
Points at 0s:  1 point (initial)
Points at 10s: 2 points (duplicate!)
Points at 20s: 2 points (duplicate!)
Points at 30s: 2 points (duplicate!)
```

### After Fix
```
Interval: 10s
Points at 0s:  1 point (initial)
Points at 10s: 1 point ✅
Points at 20s: 1 point ✅
Points at 30s: 1 point ✅
```

## Console Logs to Watch

### Startup
```
GPS tracking started with 10s interval (normal mode)
Background GPS enabled - ensure battery optimization is disabled
```

### If Duplicate Start Attempted
```
Tracking already active - ignoring duplicate start request
```

### Settings Change
```
Restarting GPS with new settings: 30s interval, high accuracy
GPS tracking started with 30s interval (normal mode)
```

## Edge Cases Handled

1. **Multiple `startTracking()` calls**: Ignored if already tracking
2. **Settings change during tracking**: Properly restarts with new interval
3. **Rapid settings changes**: Each restart clears previous interval
4. **Initial settings emission**: Skipped to prevent duplicate start

## Related Issues Fixed

This also fixes potential issues with:
- Memory leaks from uncleaned intervals
- Battery drain from duplicate GPS polling
- Inaccurate distance calculations (duplicate points)
- Ride statistics being off (double counting points)

## Performance Impact

**Before**: 2x GPS polls = 2x battery drain
**After**: 1x GPS polls = Normal battery usage

**Improvement**: ~50% reduction in GPS polling frequency
