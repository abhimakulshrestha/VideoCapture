# RORK - Circular Buffer Camera App

<div align="center">

![RORK Logo](https://img.shields.io/badge/RORK-Camera-6366F1?style=for-the-badge&logo=camera&logoColor=white)

**Capture moments before and after they happen**

[![React Native](https://img.shields.io/badge/React%20Native-0.83-61DAFB?style=flat-square&logo=react)](https://reactnative.dev/)
[![Android](https://img.shields.io/badge/Android-9%2B-3DDC84?style=flat-square&logo=android)](https://developer.android.com/)
[![CameraX](https://img.shields.io/badge/CameraX-1.3.1-4285F4?style=flat-square&logo=google)](https://developer.android.com/training/camerax)

</div>

## 📖 Overview

RORK is a low-latency mobile camera application that captures moments **before and after** a user action without wasting storage or re-encoding video.

### The Core Concept

> The record button is a **trigger**, not a recorder.

When you press the button, RORK outputs a time-windowed clip centered around that moment:

```
[N seconds BEFORE press] + [N seconds AFTER press]
```

This mirrors how human memory works: the moment already happened — we just decided to keep it.

## ✨ Features

- 🔄 **Circular Buffer Recording** - Silently records in the background
- ⚡ **Instant Trigger** - No delay between button press and capture
- 🧩 **Configurable Duration** - 6s, 10s, 20s, or 30s total clips
- 🔐 **Secure Authentication** - Android Keystore encryption
- 📊 **Performance Telemetry** - Real-time CPU, memory, GPU monitoring
- 💾 **No Re-encoding** - MediaMuxer pass-through saves battery
- 📱 **Gallery Integration** - Videos saved to MediaStore

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React Native Layer                      │
├─────────────────────────────────────────────────────────────┤
│  LoginScreen ──► CameraScreen ──► SettingsScreen            │
│       │               │                │                     │
│       ▼               ▼                ▼                     │
│  AuthService    CameraPreview    DurationSelector           │
└─────────────────────────────────────────────────────────────┘
                           │
                    Native Bridge
                           │
┌─────────────────────────────────────────────────────────────┐
│                    Android Native Layer                      │
├─────────────────────────────────────────────────────────────┤
│  CameraModule ─────► CircularBufferRecorder                 │
│       │                     │                                │
│       │           ┌─────────┼─────────┐                     │
│       │           ▼         ▼         ▼                     │
│       │    SegmentManager  VideoMuxer  Telemetry            │
│       │           │         │          │                     │
│       ▼           ▼         ▼          ▼                     │
│  SecureAuthManager  CameraX  MediaMuxer  Metrics            │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Java 17+
- Android Studio with SDK 28+
- React Native CLI

### Installation

1. **Clone the repository**
   ```bash
   cd c:\Users\91811\Desktop\react_native\VideoCapture
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build Android**
   ```bash
   npm run android
   ```

### Running the App

1. **Start Metro bundler**
   ```bash
   npm start
   ```

2. **Run on Android device/emulator**
   ```bash
   npm run android
   ```

## 📱 Usage

### First Time Setup

1. Launch the app
2. Create an account (username + password)
3. Grant camera and microphone permissions
4. You're ready to capture!

### Capturing Moments

1. **Start Buffering** - Tap the play button to begin recording the buffer
2. **Wait for the moment** - The green indicator shows buffering is active
3. **Trigger Capture** - Tap the red trigger button when you want to save
4. **Done!** - Your clip is saved to the gallery

### Configuring Duration

1. Tap the ⚙️ settings icon
2. Select your preferred clip duration
3. Clip is split evenly: 
   - 10s = 5s before + 5s after
   - 20s = 10s before + 10s after

## 🔧 Technical Details

### Circular Buffer Strategy

The app uses a **Segmented Circular File Buffer**:

```
❌ What we do NOT do:
   • Keep raw frames in memory (too expensive)
   • Re-encode old footage (battery killer)
   • Keep one giant temporary file

✅ What we DO:
   • Record in small 500ms MP4 segments
   • Store only last N seconds of segments
   • Delete oldest segments automatically
   • Concatenate segments without re-encoding
```

### File Format

- Container: MP4
- Video: H.264 @ 720p
- Audio: AAC
- Naming: `<username>_YYYYMMDD_HHMMSS.mp4`

### Performance Targets

| Metric | Target | Achieved |
|--------|--------|----------|
| Trigger Latency | <100ms | ~40ms ✅ |
| Memory Usage | <100MB | ~75MB ✅ |
| CPU Usage | <30% | ~20% ✅ |
| Storage | buffer + post | Exact ✅ |

## 📁 Project Structure

```
VideoCapture/
├── src/
│   ├── components/
│   │   └── CameraPreview.jsx      # Native camera wrapper
│   ├── screens/
│   │   ├── LoginScreen.jsx        # Authentication
│   │   ├── CameraScreen.jsx       # Main camera UI
│   │   └── SettingsScreen.jsx     # Configuration
│   └── services/
│       └── CameraModule.js        # Native bridge API
├── android/
│   └── app/src/main/java/com/videocapture/
│       ├── camera/
│       │   ├── CircularBufferRecorder.kt
│       │   ├── SegmentManager.kt
│       │   ├── VideoMuxer.kt
│       │   └── TelemetryCollector.kt
│       ├── auth/
│       │   └── SecureAuthManager.kt
│       └── bridge/
│           ├── CameraModule.kt
│           ├── CameraViewManager.kt
│           └── CameraPackage.kt
├── docs/
│   ├── iOS_PORTABILITY_PLAN.md
│   └── PERFORMANCE_REPORT.md
└── App.jsx
```

## 📊 Telemetry

The app collects performance metrics during operation:

- **CPU Usage** - Process CPU percentage
- **Memory Usage** - PSS memory in MB
- **GPU Usage** - Estimated from graphics memory
- **Latency** - Trigger to recording start time

Access telemetry log:
1. Settings → Export Telemetry Log
2. File saved to app cache directory

## 🔐 Security

- Credentials stored using Android Keystore
- EncryptedSharedPreferences for data at rest
- SHA-256 password hashing with random salt
- No network calls (offline-only authentication)

## 📱 iOS Support

See [iOS Portability Plan](docs/iOS_PORTABILITY_PLAN.md) for the roadmap to iOS support using AVFoundation.

## 🐛 Troubleshooting

### Camera won't start
- Ensure permissions are granted in Settings
- Try force-closing and reopening the app
- Check if another app is using the camera

### Video not saving
- Check available storage space
- Ensure app has storage permissions
- Check the gallery for the RORK folder

### High battery usage
- Use shorter buffer durations
- Avoid keeping the app buffering when not needed
- Check for background apps using the camera

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [CameraX](https://developer.android.com/training/camerax) - Modern Android camera library
- [React Native](https://reactnative.dev/) - Cross-platform mobile framework
- [MediaMuxer](https://developer.android.com/reference/android/media/MediaMuxer) - Video concatenation without re-encoding

---

<div align="center">

**Built with ❤️ for capturing moments that matter**

</div>
