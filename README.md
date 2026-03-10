# Ride Tracker

A clean, multi-OS mobile and web application optimized for battery efficiency, built using Ionic and the Capacitor framework.

## Overview

Ride Tracker is designed to help users monitor their journeys, providing real-time GPS tracking, detailed ride statistics, and history management. The application follows SOLID principles and utilizes design patterns for a robust and maintainable codebase.

## Features

### 1. Home Screen (Ride Tracking)
*   **Start/Pause/Stop Controls**: Easy-to-use buttons to manage ride tracking.
*   **GPS Tracking**: Reads GPS coordinates at configurable intervals.
*   **Live Timeline**: Maintains a timeline of spotted places.
*   **Speed Calculation**: Calculates average speed between GPS readings based on distance and time.
*   **Pause Reasons**: When pausing, users can select reasons like Break, Refreshment, Traffic, or others.
*   **Ride Summary**: On completion, saves the ride with:
    *   Total time and average speed.
    *   Number of breaks.
    *   Route plot on a map in a shareable image format.
    *   All data saved under a single "Ride" entity.

### 2. History Screen
*   **Ride Listing**: A comprehensive list of all previous rides.
*   **Filtering**: Date range filters and other criteria to find specific rides.
*   **Detailed View**: Select any ride to see full details, including the route map.
*   **Sharing**: Share ride summaries and maps across various platforms.

### 3. Settings Screen
*   **GPS Accuracy**: Configure tracking precision to balance accuracy and battery life.
*   **Google Integration**: Sign in/out with Google to save and sync ride information to Google Storage/Drive.

## Technical Specifications
*   **Framework**: [Ionic Framework](https://ionicframework.com/)
*   **Native Bridge**: [Capacitor](https://capacitorjs.com/)
*   **Design Principles**: SOLID principles, adaptable UI for various screen sizes.
*   **Optimization**: Battery-optimized background tracking.

## Development Plan

### Phase 1: Foundation (Current)
*   [x] Initialize Ionic project with Tabs template.
*   [x] Structure folders and rename default tabs to Home, History, and Settings.
*   [x] Set up basic navigation and routing.

### Phase 2: Core Services
*   [ ] Implement `RideService` for GPS tracking logic.
*   [ ] Implement `HistoryService` for local data persistence.
*   [ ] Implement `AuthService` for Google Sign-in.
*   [ ] Implement `StorageService` for Google Drive/Storage sync.

### Phase 3: Home Screen Implementation
*   [ ] GPS coordinate polling logic.
*   [ ] Timeline and speed calculation algorithms.
*   [ ] Pause/Stop modals and state management.
*   [ ] Map integration and route plotting (static image generation).

### Phase 4: History & Details
*   [ ] List view with filtering capabilities.
*   [ ] Detail view component.
*   [ ] Social sharing integration.

### Phase 5: Settings & Sync
*   [ ] Configuration UI for GPS accuracy.
*   [ ] Google OAuth2 implementation.
*   [ ] Data synchronization logic.

### Phase 6: Refinement
*   [ ] Battery usage optimization.
*   [ ] UI/UX polishing for all screen sizes.
*   [ ] Comprehensive testing on Android, iOS, and Web.
