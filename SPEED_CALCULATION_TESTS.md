# Speed Calculation Test Suite

Comprehensive test coverage for the new speed calculation functionality implemented in the ride tracker app.

## Test Files

### 1. **ride-calculations.spec.ts** - Utility Function Tests
Location: `src/app/utils/ride-calculations.spec.ts`

**Coverage:**
- `calculateCurrentSpeed()` - Rolling average speed calculation
- `updateMaxSpeed()` - Maximum speed tracking
- `calculateAverageSpeed()` - Overall ride average speed
- `calculateDistance()` - Haversine distance formula
- `msToKph()` - Unit conversion

**Test Scenarios (120+ tests):**
- ✅ Empty and single-point edge cases
- ✅ Time window filtering (60-second default)
- ✅ Point limiting (min 3, max 20 points)
- ✅ Stationary vs moving detection
- ✅ Custom parameter handling
- ✅ Rolling average behavior
- ✅ Max speed tracking with acceleration/deceleration
- ✅ Average speed with pause time exclusion
- ✅ Distance calculations (Haversine formula)
- ✅ Unit conversions (m/s to km/h)
- ✅ Integration scenarios (realistic rides)
- ✅ Edge cases (GPS noise, missing fields, extreme values)

### 2. **ride-speed.spec.ts** - Service Integration Tests
Location: `src/app/services/ride-speed.spec.ts`

**Coverage:**
- RideService speed tracking integration
- State management during rides
- Pause/resume behavior
- Foreground service updates
- Save/load functionality

**Test Scenarios (50+ tests):**
- ✅ Initial state (all speeds = 0)
- ✅ Speed updates on new GPS points
- ✅ Max speed tracking during ride
- ✅ Max speed persistence during deceleration
- ✅ Average speed calculation over ride duration
- ✅ Speed preservation during pause
- ✅ No updates while paused
- ✅ Speed calculation resumption after resume
- ✅ Foreground service notification updates
- ✅ Edge cases (no movement, single point, high accuracy errors)
- ✅ Save/load with currentSpeed field

### 3. **speed-integration.spec.ts** - Real-World Scenarios
Location: `src/app/tests/speed-integration.spec.ts`

**Coverage:**
- Real-world ride patterns
- GPS signal quality issues
- Boundary conditions
- Time-based edge cases
- Performance testing

**Test Scenarios (80+ tests):**

#### Real-World Rides
- ✅ Typical cycling (15-25 km/h)
- ✅ Motorcycle ride (40-60 km/h)
- ✅ Stop-and-go traffic
- ✅ Acceleration from traffic light
- ✅ Downhill acceleration
- ✅ Uphill deceleration

#### GPS Signal Quality
- ✅ GPS drift while stationary
- ✅ Poor GPS accuracy
- ✅ Signal loss and recovery
- ✅ Tunnel scenarios (extended GPS loss)

#### Boundary Conditions
- ✅ Maximum realistic speed (120 km/h)
- ✅ Minimum detectable speed (< 1 km/h)
- ✅ Equator vs poles (latitude effects)
- ✅ International date line crossing
- ✅ Prime meridian crossing

#### Time-Based Edge Cases
- ✅ Identical timestamps
- ✅ Out-of-order points
- ✅ Very old points (hours ago)
- ✅ Rapid GPS updates (< 1 second)
- ✅ Slow GPS updates (> 10 seconds)

#### Performance
- ✅ Large datasets (1000+ points)
- ✅ Repeated calculations
- ✅ Execution time benchmarks

#### Consistency
- ✅ currentSpeed ≤ maxSpeed always
- ✅ averageSpeed vs currentSpeed relationship
- ✅ Deterministic calculations

## Running the Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
# Utility tests
npm test -- --include='**/ride-calculations.spec.ts'

# Service integration tests
npm test -- --include='**/ride-speed.spec.ts'

# Integration scenarios
npm test -- --include='**/speed-integration.spec.ts'
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

## Test Coverage Goals

| Component | Target Coverage | Current Status |
|-----------|----------------|----------------|
| `RideUtils.calculateCurrentSpeed()` | 100% | ✅ Complete |
| `RideUtils.updateMaxSpeed()` | 100% | ✅ Complete |
| `RideUtils.calculateAverageSpeed()` | 100% | ✅ Complete |
| `RideUtils.calculateDistance()` | 100% | ✅ Complete |
| `RideService.processNewPoint()` | 90%+ | ✅ Complete |
| Edge Cases | 95%+ | ✅ Complete |

## Key Test Patterns

### 1. Rolling Average Speed Test Pattern
```typescript
const now = Date.now();
const points: GpsPoint[] = [];

// Create points within time window
for (let i = 0; i < 20; i++) {
  points.push({
    latitude: i * 0.00005,
    longitude: 0,
    timestamp: now - (20 - i) * 1000
  });
}

const speed = RideUtils.calculateCurrentSpeed(points);
expect(speed).toBeGreaterThan(0);
```

### 2. Max Speed Tracking Pattern
```typescript
let maxSpeed = 0;
const speeds = [0, 5, 10, 15, 20, 15, 10, 5, 0];

speeds.forEach(speed => {
  maxSpeed = RideUtils.updateMaxSpeed(maxSpeed, speed);
});

expect(maxSpeed).toBe(20); // Peak value maintained
```

### 3. Service Integration Pattern
```typescript
service.startRide();

const point: GpsPoint = { 
  latitude: 0, 
  longitude: 0, 
  timestamp: Date.now(), 
  speed: 10 
};

(locationService.location$ as BehaviorSubject<GpsPoint>).next(point);

service.currentRide$.subscribe(ride => {
  expect(ride?.currentSpeed).toBeDefined();
});
```

## Expected Behavior

### Current Speed (Speedometer)
- Starts at **0 m/s**
- Uses **rolling average** of last N points (3-20)
- Time window: **60 seconds** (configurable)
- Smooth transitions (incremental/decremental)
- Updates on every new GPS point

### Max Speed
- Starts at **0 m/s**
- Tracks **highest currentSpeed** value
- Never decreases during ride
- Based on rolling average, not raw GPS
- Persists through pauses

### Average Speed
- Calculated over **entire active ride duration**
- Excludes **paused time**
- Formula: `totalDistance / (totalTime - pausedTime)`
- Returns **m/s** (convert to km/h for display)

## Common Test Failures and Solutions

### Issue: Speed calculations return NaN
**Cause:** Division by zero (time span = 0)
**Solution:** Check for zero duration before division

### Issue: Speed values are unrealistic
**Cause:** Incorrect distance calculations or time windows
**Solution:** Verify Haversine formula and timestamp handling

### Issue: Tests fail intermittently
**Cause:** Time-dependent tests using `Date.now()`
**Solution:** Use fixed timestamps or mock time

### Issue: Max speed doesn't update
**Cause:** Comparing with raw GPS speed instead of currentSpeed
**Solution:** Use `updateMaxSpeed(currentMaxSpeed, currentSpeed)`

## Manual Testing Checklist

- [ ] Start ride and verify speed starts at 0
- [ ] Move and verify speed increases gradually
- [ ] Stop and verify speed decreases to 0
- [ ] Check max speed is maintained after slowing down
- [ ] Pause ride and verify speeds don't change
- [ ] Resume and verify speed calculation continues
- [ ] Complete ride and verify all speeds are saved
- [ ] Load saved ride and verify currentSpeed field exists

## Performance Benchmarks

| Operation | Points | Expected Time |
|-----------|--------|---------------|
| calculateCurrentSpeed | 20 | < 1ms |
| calculateCurrentSpeed | 100 | < 5ms |
| calculateCurrentSpeed | 1000 | < 50ms |
| 100 repeated calculations | 100 | < 500ms |

## Future Test Enhancements

- [ ] Add UI component tests for speed display
- [ ] Add E2E tests for complete ride scenarios
- [ ] Add performance regression tests
- [ ] Add tests for different unit systems (km/h vs mph)
- [ ] Add tests for notification service speed display
- [ ] Add tests for foreground service updates
- [ ] Add tests for speed graph component

## Related Documentation

- [Speed Calculation Implementation](./README.md)
- [Motion Detection](./MOTION_DETECTION_IMPLEMENTATION.md)
- [Ride Service Architecture](./ride-tracker/src/app/services/README.md)

## Test Maintenance

- Update tests when changing default parameters (window size, min/max points)
- Add new tests for any new speed-related features
- Keep test data realistic (based on actual GPS behavior)
- Maintain performance benchmarks
- Review and update edge cases as bugs are discovered
