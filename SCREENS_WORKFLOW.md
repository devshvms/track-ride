# 📱 Ride Tracker — Screen Workflow Documentation

> **Version:** v2.0 (Enhanced with Auto-Pause/Resume)
> **Framework:** Ionic + Capacitor (Angular)
> **Last Updated:** March 2026

---

## Table of Contents

1. [App Launch & Permissions](#1-app-launch--permissions)
2. [Navigation Structure](#2-navigation-structure)
3. [Home Screen — Ride Tracking](#3-home-screen--ride-tracking)
   - [States](#states)
   - [State Transitions](#state-transitions)
   - [Auto-Pause & Auto-Resume Logic](#auto-pause--auto-resume-logic)
   - [GPS Signal Lost Handling](#gps-signal-lost-handling)
4. [History Screen](#4-history-screen)
5. [Settings Screen](#5-settings-screen)
6. [Cross-Screen Flows](#6-cross-screen-flows)
7. [State Machine Summary](#7-state-machine-summary)

---

## 1. App Launch & Permissions

On first launch, the app requests the following permissions before any tracking can begin:

| Permission | Purpose | Behaviour if Denied |
|---|---|---|
| 📍 GPS / Location | Core ride tracking | App launches in limited mode; tracking disabled |
| 🔔 Notifications | Auto-pause/resume alerts | Auto-pause still works, but no push notifications sent |

If permissions are denied, a banner is shown with a deep-link to the device Settings. The user can still browse History and configure Settings.

---

## 2. Navigation Structure

The app uses a **bottom tab bar** with three primary destinations:

```
[ 🏠 Home ] [ 📋 History ] [ ⚙️ Settings ]
```

Default tab on launch: **Home**.

Routing paths (post Phase 1 fix):
- `/tabs/home` → Home Screen
- `/tabs/history` → History Screen
- `/tabs/settings` → Settings Screen

---

## 3. Home Screen — Ride Tracking

### States

The Home screen operates as a state machine with the following states:

---

#### 🟢 IDLE
The default resting state.

- Displays a prominent **Start Ride** button
- Shows current GPS signal strength indicator
- Shows current battery mode badge (High / Balanced / Low)
- No active tracking

**Entry from:** App launch, ride saved, ride discarded

---

#### 🔵 TRACKING
Active ride in progress.

**Displays live:**
- 📏 Total distance (km)
- ⚡ Current speed (km/h)
- 📊 Average speed (km/h)
- 🔝 Max speed (km/h)
- 🔢 GPS points logged count
- ☕ Break count
- ⏱ Elapsed time (live timer)
- 🗺 Mini live map with route drawn

**Actions available:**
- `[⏸ Pause]` → Opens Manual Pause Modal
- `[⏹ Stop & Save]` → Opens Stop Confirmation

**Auto-transitions to:**
- AUTO-PAUSED when stationary / backgrounded / GPS lost
- GPS SIGNAL LOST when GPS signal drops

---

#### 🟠 MANUAL PAUSE MODAL
An overlay modal prompting the user to select a pause reason.

**Reason options:**
- 🛑 Break
- ☕ Refreshment
- 🚦 Traffic
- ⛽ Fuel Stop
- 📸 Photo Stop
- ❓ Other

**Actions:**
- `[Cancel]` → Returns to TRACKING (no pause recorded)
- `[Confirm Pause]` → Transitions to PAUSED STATE, logs reason + timestamp

---

#### 🟡 PAUSED STATE
Manually paused ride. Tracking stopped, timer paused.

**Displays:**
- All accumulated stats (frozen)
- The pause reason that was selected
- A countdown to auto-resume (if configured in Settings)

**Actions:**
- `[▶ Resume]` → Returns to TRACKING, logs break duration
- `[⏹ Stop & Save]` → Opens Stop Confirmation

---

#### 🔶 AUTO-PAUSED
Automatically paused by the system. No user interaction required.

**Triggered by any of:**
- Speed drops to ≈ 0 km/h and remains for threshold duration (configurable)
- Device becomes stationary (accelerometer)
- App is moved to background
- GPS signal is lost (after timeout)

**Behaviour:**
- Tracking stops immediately
- Timer pauses
- A push notification is sent: *"Ride auto-paused. Tap to resume."*
- The reason is logged automatically (e.g. `auto:stationary`, `auto:backgrounded`, `auto:gps_lost`)

**Actions:**
- `[▶ Resume]` → Returns to TRACKING
- `[⏹ Stop & Save]` → Opens Stop Confirmation
- Automatically transitions to AUTO-RESUME when conditions are met

---

#### 🟢 AUTO-RESUME
A transient state — the system has detected resumed motion and automatically restarts tracking.

**Triggered by:**
- Speed exceeds configured minimum threshold
- Device motion detected after stationary period
- App is foregrounded after backgrounding
- GPS signal is restored

**Behaviour:**
- Tracking restarts immediately
- Break duration is calculated and logged automatically
- A silent notification is sent: *"Ride resumed automatically."*
- Immediately transitions back to TRACKING

---

#### 🔴 GPS SIGNAL LOST
A warning state distinct from auto-pause.

**Behaviour:**
- A persistent banner is shown: *"GPS signal lost"*
- Last known location is displayed on mini map
- Auto-pause is triggered
- System retries GPS acquisition every 10 seconds
- After configurable timeout with no signal → transitions to AUTO-PAUSED

**Actions:**
- `[Continue Waiting]` → Stay in this state while retrying
- `[⏹ Stop & Save]` → Opens Stop Confirmation with available data

**Auto-transition:**
- Signal restored → returns to TRACKING

---

#### 🟥 STOP CONFIRMATION
Confirms the user wants to end the ride.

**Behaviour:**
- Generates static map snapshot from collected GPS points
- Calculates all final totals

**Actions:**
- `[Discard Ride]` → All data discarded, returns to IDLE
- `[Cancel]` → Returns to PAUSED STATE (ride preserved)
- `[Save Ride]` → Transitions to RIDE SUMMARY

---

#### 🌟 RIDE SUMMARY
Final summary of the completed ride before saving to history.

**Displays:**
- 🗺 Route map image (shareable static image)
- ⏱ Total time
- 📏 Total distance
- ⚡ Average speed
- 🔝 Max speed
- ☕ Number of breaks (with reasons)
- 📍 Total GPS points
- 📈 Speed graph preview

**Actions:**
- `[Share]` → Opens Native Share Sheet (text summary + map image)
- `[View in History]` → Saves ride and navigates to History Screen

---

### State Transitions

```
IDLE
 └─[Start]──────────────────────────────► TRACKING
                                               │
                                    ┌──────────┴──────────┐
                                    │                     │
                              [Tap Pause]          [Auto-trigger]
                                    │                     │
                            MANUAL PAUSE MODAL     AUTO-PAUSED ◄─── GPS SIGNAL LOST
                                    │                     │               │
                          [Confirm] │           [Movement/Signal]    [Signal Back]
                                    ▼                     ▼               │
                              PAUSED STATE         AUTO-RESUME ──────────►┘
                                    │                     │
                              [Resume]                [Auto]
                                    └──────────┬──────────┘
                                               ▼
                                           TRACKING
                                               │
                              ┌────────────────┴────────────────┐
                         [Stop & Save]                     [Stop & Save]
                              ▼                                  ▼
                       STOP CONFIRMATION ◄──────────────── (from any state)
                              │
                    ┌─────────┼──────────┐
                 [Discard] [Cancel]   [Save]
                    │         │          │
                   IDLE    PAUSED    RIDE SUMMARY
                                         │
                                   [View History]
                                         ▼
                                    HISTORY LIST
```

---

### Auto-Pause & Auto-Resume Logic

The auto-pause/resume feature is configurable in **Settings → Auto-Pause Settings**.

#### Auto-Pause Triggers (all configurable ON/OFF)

| Trigger | Condition | Default |
|---|---|---|
| Stationary detection | Speed = 0 km/h for X seconds | ON, 30s threshold |
| Minimum speed | Speed < Y km/h sustained | ON, 2 km/h |
| App backgrounded | App moved out of foreground | ON |
| GPS signal lost | No GPS fix for Z seconds | ON, 60s timeout |

#### Auto-Resume Triggers

| Trigger | Condition |
|---|---|
| Motion detected | Speed > min speed threshold |
| App foregrounded | User returns to app |
| GPS restored | Valid GPS fix received |

#### Break Logging for Auto-Pauses

Auto-pauses are logged in the ride's break array with prefixed reasons:
- `auto:stationary` — stopped moving
- `auto:backgrounded` — app sent to background
- `auto:gps_lost` — GPS signal lost
- `auto:low_speed` — speed fell below threshold

---

### GPS Signal Lost Handling

```
TRACKING
    │
    ├── GPS fix drops
    │
    ▼
GPS SIGNAL LOST (banner shown, last location held)
    │
    ├── Retry every 10s ──► Signal restored? ──► TRACKING
    │
    └── Timeout (60s) ──► AUTO-PAUSED (reason: auto:gps_lost)
```

---

## 4. History Screen

### Empty State
Shown when no rides have been saved yet.
- Illustration + message: *"No rides yet. Start your first ride!"*
- CTA button links to Home tab

### Rides List
Shown when one or more rides exist.

**Filter options:**
- 📅 Date range picker (start date → end date)
- 📏 Minimum distance filter
- ⚡ Minimum average speed filter
- 🔍 Text search bar

**Ride card displays:**
- Date and start time
- Total distance
- Average speed + Max speed
- Duration
- Break count
- Thumbnail map preview (if available)
- `[Share 🔗]` action button
- `[Delete 🗑]` action button (swipe or long-press)

### Ride Detail View
Full detail screen for a selected ride.

**Displays:**
- 🗺 Full interactive map with route plotted
- 📈 Speed graph over time
- ⏱ Start time → End time
- 📏 Total distance
- ⚡ Average and max speed
- ☕ Breaks log (time, reason, duration each)
- 📍 GPS point timeline (scrollable list)

**Actions:**
- `[Export GPX]` — Exports ride as a `.gpx` file for use in other apps
- `[Share]` — Opens Native Share Sheet
- `[Delete]` — Opens Delete Confirmation modal
- Back navigation → Rides List

### Delete Confirmation
Modal overlay:
> *"Delete this ride? This cannot be undone."*
- `[Cancel]` → Dismiss
- `[Delete]` → Remove from local storage + Google Drive sync queue

### Native Share Sheet
Triggered from either the list or detail view.

**Share payload includes:**
- Text summary (distance, speed, duration, breaks)
- Route map image (static PNG)
- GPX file attachment (optional, user-toggled)

**Platform targets:** WhatsApp, Mail, Messages, Instagram Stories, and any other installed share targets.

---

## 5. Settings Screen

### GPS Accuracy

Controls the Capacitor Geolocation accuracy mode, balancing precision vs. battery consumption.

| Option | Capacitor Mode | Battery Impact |
|---|---|---|
| 🔴 High | `enableHighAccuracy: true` | High |
| 🟡 Balanced | Default | Medium (default) |
| 🟢 Low | `enableHighAccuracy: false` | Low |

### Reading Interval

Configures how frequently GPS coordinates are polled during active tracking.

- Slider: **3s · 5s · 10s · 30s**
- Default: **5 seconds**
- Shorter intervals = higher accuracy + higher battery drain

### Auto-Pause Settings

| Setting | Type | Default |
|---|---|---|
| Enable auto-pause | Toggle | ON |
| Stationary threshold | Slider (10s–120s) | 30s |
| Minimum speed threshold | Number input | 2 km/h |
| Pause when app backgrounded | Toggle | ON |
| Pause on GPS signal loss | Toggle | ON |

### Preferences

| Setting | Options | Default |
|---|---|---|
| Distance units | km / miles | km |
| App theme | Light / Dark / System | System |
| Map type | Street / Satellite / Terrain | Street |
| Push notifications | ON / OFF | ON |

### Google Account & Sync

**Not signed in state:**
- `[Sign In with Google]` button → triggers OAuth2 consent flow

**Signed in state:**
- User avatar + email address
- Auto-sync toggle (ON/OFF)
- Last synced timestamp
- `[Sync Now]` manual trigger button
- `[Sign Out]` button → clears session, disables sync

**Sync states:**
- ⏳ Syncing... (progress indicator)
- ✅ All rides synced (timestamp)
- ❌ Sync failed — `[Retry]` button shown

---

## 6. Cross-Screen Flows

### Ride Save → History
```
Home: RIDE SUMMARY
  └─[View in History]──► History: RIDES LIST (ride appears at top)
```

### Settings → Tracking (indirect)
Changes to GPS accuracy, interval, and auto-pause settings take effect on the **next ride start**. Currently active rides are not affected mid-ride.

### Google Sign-In → Sync
```
Settings: SIGNED IN
  └─[Auto-sync ON]──► All local rides upload to Google Drive on next app foreground
  └─[Sync Now]──► Immediate upload triggered
```

---

## 7. State Machine Summary

| Screen | States | Key Triggers |
|---|---|---|
| **Home** | Idle, Tracking, Manual Pause Modal, Paused, Auto-Paused, Auto-Resume, GPS Lost, Stop Confirm, Ride Summary | User actions + accelerometer + GPS events + app lifecycle |
| **History** | Empty, List, Detail, Share Sheet, Delete Confirm | User navigation + ride save events |
| **Settings** | View (static), Google: Unauthed / OAuth Flow / Authed / Syncing | User toggles + OAuth callbacks |

---

> 📌 **Implementation Note:** The auto-pause state machine should be implemented as a dedicated `AutoPauseService` (Single Responsibility Principle) that emits events consumed by `RideService`. This keeps tracking logic decoupled from pause/resume detection logic, following SOLID principles already established in the codebase.
