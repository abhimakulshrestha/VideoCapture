# RORK - Implementation Plan

## Project Overview
RORK is a low-latency mobile camera application that captures moments before and after a user action using a circular buffer recording strategy.

## Architecture Summary

### 1. React Native Layer (JavaScript)
```
src/
├── App.jsx                    # Main app with navigation
├── screens/
│   ├── LoginScreen.jsx        # User authentication
│   ├── CameraScreen.jsx       # Main camera interface
│   └── SettingsScreen.jsx     # Clip duration settings
├── components/
│   ├── CameraPreview.jsx      # Native camera view wrapper
│   ├── TriggerButton.jsx      # Capture trigger button
│   ├── DurationSelector.jsx   # Duration selection UI
│   └── TelemetryOverlay.jsx   # Performance metrics display
├── services/
│   ├── AuthService.js         # Local authentication logic
│   └── StorageService.js      # Secure storage operations
└── utils/
    └── helpers.js             # Utility functions
```

### 2. Android Native Layer (Kotlin)
```
android/app/src/main/java/com/videocapture/
├── camera/
│   ├── CircularBufferRecorder.kt    # Core buffer logic
│   ├── SegmentManager.kt            # MP4 segment handling
│   ├── VideoMuxer.kt                # MediaMuxer operations
│   └── TelemetryCollector.kt        # Performance metrics
├── bridge/
│   ├── CameraModule.kt              # React Native module
│   ├── CameraViewManager.kt         # Native UI component
│   └── CameraPackage.kt             # Package registration
└── auth/
    └── SecureAuthManager.kt         # KeyStore authentication
```

## Implementation Phases

### Phase 1: Project Setup & Authentication ✅
1. Update Android dependencies (CameraX, Security)
2. Add required permissions
3. Implement SecureAuthManager with Android KeyStore
4. Create LoginScreen UI
5. Implement AuthService bridge

### Phase 2: Camera Preview Integration
1. Implement CameraX preview setup
2. Create CameraViewManager for React Native
3. Bridge camera preview to React Native
4. Handle camera lifecycle properly

### Phase 3: Circular Buffer Recording (Critical)
1. Implement SegmentManager for temp file handling
2. Create CircularBufferRecorder with CameraX VideoCapture
3. Implement rolling segment deletion
4. Handle buffer state management

### Phase 4: Trigger & Video Assembly
1. Implement trigger event handling
2. Record post-trigger segments
3. Implement VideoMuxer for MP4 concatenation
4. Save to MediaStore with proper naming

### Phase 5: Telemetry & Polish
1. Implement TelemetryCollector
2. Add CPU, memory, GPU metrics
3. Create telemetry logging
4. Performance optimization

### Phase 6: iOS Portability Documentation
1. Document AVFoundation approach
2. Outline Swift Native Module structure
3. Document iOS-specific challenges

## Technical Specifications

### Circular Buffer Strategy
- **Segment Duration**: 500ms per segment
- **Buffer Size**: User configurable (3s, 5s, 10s)
- **Storage Format**: MP4 (H.264 + AAC)
- **Resolution**: 720p default
- **Storage Location**: App cache dir for temp, MediaStore for final

### API Bridge Methods
```kotlin
// CameraModule exposed methods
startPreview()
setClipDuration(seconds: Int)
triggerCapture()
stopCamera()
getBufferStatus(): Promise<BufferStatus>

// Events emitted to JS
onBufferReady
onCaptureStarted
onCaptureCompleted(filePath: String)
onError(errorCode: String, message: String)
onTelemetryUpdate(metrics: TelemetryData)
```

### File Naming Convention
```
<username>_YYYYMMDD_HHMMSS.mp4
```

## Dependencies to Add

### package.json
- react-native-encrypted-storage (secure auth storage)
- @react-navigation/native
- @react-navigation/stack
- react-native-screens
- react-native-gesture-handler

### build.gradle (app level)
```gradle
// CameraX
implementation "androidx.camera:camera-core:1.3.1"
implementation "androidx.camera:camera-camera2:1.3.1"
implementation "androidx.camera:camera-lifecycle:1.3.1"
implementation "androidx.camera:camera-video:1.3.1"
implementation "androidx.camera:camera-view:1.3.1"

// Security
implementation "androidx.security:security-crypto:1.1.0-alpha06"
```

### AndroidManifest.xml Permissions
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
<uses-feature android:name="android.hardware.camera" android:required="true" />
```

## Performance Targets
- **Trigger Latency**: < 100ms
- **Memory Usage**: < 100MB steady state
- **Storage Usage**: buffer_duration + post_duration only
- **CPU Usage**: < 30% during active recording

## Status: ✅ Implementation Complete

### Completed Items:
- ✅ Phase 1: Project Setup & Authentication
- ✅ Phase 2: Camera Preview Integration  
- ✅ Phase 3: Circular Buffer Recording
- ✅ Phase 4: Trigger & Video Assembly
- ✅ Phase 5: Telemetry & Polish
- ✅ Phase 6: iOS Portability Documentation

### Build Status:
- Debug APK Built: `android/app/build/outputs/apk/debug/app-debug.apk`
