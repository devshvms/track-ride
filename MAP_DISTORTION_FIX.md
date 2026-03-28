# GPS Plot Distortion Fix

## Problem
When sharing the map as an image, GPS plots were slightly distorted with a shift from the actual start/end locations and roads.

## Root Cause
The distortion was caused by:
1. **Fixed scale factor**: Using `scale: 2` in html2canvas didn't account for different device pixel ratios
2. **Missing coordinate transformation**: Leaflet's internal coordinate system wasn't being properly invalidated before capture
3. **Dimension mismatch**: html2canvas wasn't explicitly told the exact dimensions to capture

## Solution Applied

### 1. Dynamic Pixel Ratio (`map-image-export.service.ts`)
- Changed from fixed `scale: 2` to `scale: window.devicePixelRatio || 1`
- This ensures the capture matches the device's actual pixel density

### 2. Map Invalidation Before Capture
- Added `prepareMapForCapture()` method that:
  - Accesses the Leaflet map instance
  - Calls `invalidateSize({ pan: false })` to recalculate coordinates
  - Waits 300ms for the map to finish rendering

### 3. Explicit Dimensions
- Added `width`, `height`, `windowWidth`, and `windowHeight` parameters to html2canvas
- This ensures the capture uses the exact element dimensions

### 4. Map Instance Reference
- Updated `ride-detail.page.ts` and `ride-summary.component.ts` to:
  - Store the Leaflet map instance reference on the DOM element
  - Pass the actual map element (not wrapper containers) to the export service
  - Set `preferCanvas: false` to ensure SVG/DOM rendering for better capture

## Files Modified
1. `/Users/5145666/Desktop/tm/track-ride/ride-tracker/src/app/services/map-image-export.service.ts`
2. `/Users/5145666/Desktop/tm/track-ride/ride-tracker/src/app/history/ride-detail/ride-detail.page.ts`
3. `/Users/5145666/Desktop/tm/track-ride/ride-tracker/src/app/home/ride-summary/ride-summary.component.ts`

## Testing
1. Record a ride with GPS tracking
2. Navigate to the ride detail page
3. Click "Share as Image"
4. Verify that:
   - GPS route aligns perfectly with roads
   - Start and end markers are in correct positions
   - No visible shift or distortion in the route

## Technical Details
The fix ensures that Leaflet's coordinate transformation matrix is properly synchronized with html2canvas's rendering context, preventing the pixel-to-coordinate mapping errors that caused the distortion.
