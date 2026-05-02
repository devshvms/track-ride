# Map Screenshot Offset Fix

## Problem

**Issue**: When saving ride as image, the **route dots (blue GPS points) are shifted to the left** of their correct position. Start marker (green flag) and end marker (red checkmark) are correctly positioned, but the route path is offset.

**Symptoms**:
- Map looks correct in the app
- After creating image/screenshot, route is shifted left
- Markers (start/end) are in correct position
- Only the route polyline/dots are offset

## Root Cause

The issue is caused by **html2canvas** not correctly handling **CSS transforms** used by Leaflet to position map tiles and route elements.

### Technical Details

1. **Leaflet uses CSS transforms** (`translate3d`) to position:
   - Map tiles
   - Polylines (route paths)
   - Markers
   - Overlays

2. **html2canvas** has known issues with CSS transforms:
   - Sometimes renders transformed elements at wrong positions
   - `foreignObjectRendering` can cause additional offset issues
   - Scroll position can affect transform calculations

3. **The offset happens because**:
   - html2canvas clones the DOM
   - CSS transforms aren't always correctly applied in the clone
   - Leaflet's tile positioning gets misaligned

## Solution

### 1. **Force Leaflet Repaint Before Capture** ✅

Force Leaflet to recalculate and reapply all transforms before screenshot.

**Added to `prepareMapForCapture()`**:
```typescript
// Force a repaint to ensure all transforms are applied
const currentCenter = leafletMap.getCenter();
const currentZoom = leafletMap.getZoom();
leafletMap.setView(currentCenter, currentZoom, { animate: false });

// Wait for the map to finish rendering
await new Promise(resolve => setTimeout(resolve, 500));
```

**Why**: This forces Leaflet to recalculate all tile positions and reapply transforms, ensuring everything is correctly positioned before capture.

### 2. **Disable foreignObjectRendering** ✅

Disable `foreignObjectRendering` in html2canvas to avoid additional transform issues.

**Before**:
```typescript
const mapCanvas = await html2canvas(mapEl, {
  useCORS: true,
  allowTaint: true,
  scale: pixelRatio,
  // ... other options
});
```

**After**:
```typescript
const mapCanvas = await html2canvas(mapEl, {
  useCORS: true,
  allowTaint: true,
  scale: pixelRatio,
  x: 0,
  y: 0,
  scrollX: 0,
  scrollY: 0,
  foreignObjectRendering: false, // Disable to avoid transform issues
  // ... other options
});
```

**Why**: `foreignObjectRendering: false` forces html2canvas to use traditional rendering instead of SVG foreignObject, which has better CSS transform support.

### 3. **Reset Scroll Position** ✅

Explicitly set scroll positions to 0 to prevent offset calculations.

**Added**:
```typescript
x: 0,
y: 0,
scrollX: 0,
scrollY: 0,
```

**Why**: Ensures html2canvas doesn't factor in any scroll offsets when calculating element positions.

### 4. **Increased Render Wait Time** ✅

Increased wait time from 300ms to 500ms to ensure all transforms are applied.

**Before**:
```typescript
await new Promise(resolve => setTimeout(resolve, 300));
```

**After**:
```typescript
await new Promise(resolve => setTimeout(resolve, 500));
```

**Why**: Gives Leaflet more time to complete all rendering and transform calculations.

## Files Modified

**`src/app/services/map-image-export.service.ts`**:
- Enhanced `prepareMapForCapture()` with forced repaint
- Added `foreignObjectRendering: false` to both capture methods
- Added explicit scroll position resets (`x`, `y`, `scrollX`, `scrollY`)
- Increased render wait time to 500ms

## How It Works Now

### Capture Flow

```
shareAsImage() called
  ↓
prepareMapForCapture()
  ↓
  - invalidateSize() → Recalculate map dimensions
  - setView(center, zoom) → Force repaint
  - Wait 500ms → Ensure rendering complete
  ↓
waitForTilesToLoad()
  ↓
  - Wait for all tile images to load
  - Additional 500ms delay
  ↓
html2canvas() with fixed options
  ↓
  - foreignObjectRendering: false
  - scrollX/scrollY: 0
  - x/y: 0
  ↓
Draw to final canvas
  ↓
Share image ✅
```

## Testing Checklist

- [ ] Test with short ride (few GPS points)
- [ ] Test with long ride (many GPS points)
- [ ] Test with zoomed in map
- [ ] Test with zoomed out map
- [ ] Verify start marker position
- [ ] Verify end marker position
- [ ] Verify route path alignment
- [ ] Test on different devices
- [ ] Test with different pixel ratios

## Expected Results

### Before Fix
```
In App:        Screenshot:
  ✓ Correct      ✗ Route shifted left
  ✓ Markers OK   ✓ Markers OK
  ✓ Aligned      ✗ Misaligned
```

### After Fix
```
In App:        Screenshot:
  ✓ Correct      ✓ Correct ✅
  ✓ Markers OK   ✓ Markers OK ✅
  ✓ Aligned      ✓ Aligned ✅
```

## Alternative Solutions (If Issue Persists)

### Option 1: Use Leaflet's Built-in Image Export
```typescript
// Use Leaflet's easyPrint plugin
import 'leaflet-easyprint';

L.easyPrint({
  title: 'Export',
  position: 'topleft',
  exportOnly: true
}).addTo(map);
```

### Option 2: Use Canvas-based Rendering
```typescript
// Use Leaflet.Canvas instead of SVG
const map = L.map('map', {
  preferCanvas: true, // Use canvas renderer
  renderer: L.canvas()
});
```

### Option 3: Manual Canvas Drawing
```typescript
// Manually draw route on canvas instead of using html2canvas
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

// Draw map tiles
// Draw route manually
// Draw markers manually
```

## Known Limitations

1. **html2canvas limitations**:
   - May not perfectly capture all CSS effects
   - Performance can be slow on large maps
   - Some browser-specific rendering differences

2. **Leaflet transform complexity**:
   - Uses complex CSS transforms for performance
   - Transforms can be nested (tile → layer → map)
   - Timing-sensitive (must wait for all transforms to apply)

3. **Device differences**:
   - Different pixel ratios may affect rendering
   - Some devices may have slight variations

## Performance Impact

- **Minimal**: Added 200ms to capture time (300ms → 500ms wait)
- **Benefit**: Correct screenshots worth the small delay
- **Trade-off**: Slightly slower but much more accurate

## Debugging

### If Offset Still Occurs

1. **Check console for errors**:
   ```javascript
   console.log('Map center:', map.getCenter());
   console.log('Map zoom:', map.getZoom());
   console.log('Map bounds:', map.getBounds());
   ```

2. **Increase wait time**:
   ```typescript
   await new Promise(resolve => setTimeout(resolve, 1000)); // Try 1 second
   ```

3. **Check Leaflet version**:
   - Ensure using Leaflet 1.9.x
   - Check for any Leaflet plugins that might interfere

4. **Try canvas renderer**:
   ```typescript
   const map = L.map('map', { preferCanvas: true });
   ```

5. **Enable html2canvas logging**:
   ```typescript
   html2canvas(mapEl, {
     logging: true, // Enable to see what's happening
     // ... other options
   });
   ```

## Related Issues

- Leaflet GitHub: Issues with CSS transforms in screenshots
- html2canvas GitHub: Transform rendering bugs
- Similar issues in other mapping libraries (Google Maps, Mapbox)

## Future Improvements

- [ ] Add option to use Leaflet's native export
- [ ] Implement canvas-based route drawing
- [ ] Add image quality settings
- [ ] Support custom image sizes
- [ ] Add watermark/branding options
