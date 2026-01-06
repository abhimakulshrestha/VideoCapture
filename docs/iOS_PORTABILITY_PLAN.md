# iOS Portability Plan for RORK

## Overview

This document outlines the plan for porting RORK's circular buffer camera system from Android (CameraX) to iOS (AVFoundation). The core architecture remains the same, but implementation details differ significantly due to platform differences.

## iOS Technology Stack

### Core Frameworks
- **AVFoundation**: Camera capture, preview, and recording
- **CMSampleBuffer**: Raw video/audio samples
- **AVAssetWriter**: Segment file writing
- **AVAssetExportSession**: Video concatenation
- **Keychain Services**: Secure credential storage (equivalent to Android Keystore)

## Architecture Mapping

| Android Component | iOS Equivalent | Notes |
|-------------------|----------------|-------|
| CameraX | AVFoundation | AVCaptureSession, AVCaptureDevice |
| PreviewView | AVCaptureVideoPreviewLayer | CALayer-based preview |
| VideoCapture | AVCaptureMovieFileOutput | Or AVAssetWriter for more control |
| MediaMuxer | AVAssetExportSession | For concatenation |
| EncryptedSharedPreferences | Keychain Services | SecAccessControl for biometrics |
| MediaStore | Photos Framework | PHPhotoLibrary |

## Swift Native Module Structure

```
ios/VideoCapture/
├── Camera/
│   ├── CircularBufferRecorder.swift     # Main recorder logic
│   ├── SegmentManager.swift             # Segment file handling
│   ├── VideoMuxer.swift                 # Segment concatenation
│   └── TelemetryCollector.swift         # Performance metrics
├── Auth/
│   └── SecureAuthManager.swift          # Keychain-based auth
├── Bridge/
│   ├── CameraModule.swift               # RN Native Module
│   ├── CameraViewManager.swift          # RN Native UI Component
│   └── CameraModule.m                   # Objective-C bridge header
└── Supporting/
    └── VideoCapture-Bridging-Header.h
```

## Key Implementation Differences

### 1. Camera Session Setup

**iOS (AVFoundation)**:
```swift
class CircularBufferRecorder: NSObject {
    private var captureSession: AVCaptureSession!
    private var videoDevice: AVCaptureDevice!
    private var audioDevice: AVCaptureDevice!
    private var movieOutput: AVCaptureMovieFileOutput!
    private var previewLayer: AVCaptureVideoPreviewLayer!
    
    func setupCamera() {
        captureSession = AVCaptureSession()
        captureSession.sessionPreset = .hd1280x720
        
        // Add video input
        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else { return }
        videoDevice = camera
        let videoInput = try! AVCaptureDeviceInput(device: camera)
        captureSession.addInput(videoInput)
        
        // Add audio input
        guard let mic = AVCaptureDevice.default(for: .audio) else { return }
        let audioInput = try! AVCaptureDeviceInput(device: mic)
        captureSession.addInput(audioInput)
        
        // Add movie output
        movieOutput = AVCaptureMovieFileOutput()
        movieOutput.maxRecordedDuration = CMTime(seconds: 0.5, preferredTimescale: 600)
        captureSession.addOutput(movieOutput)
        
        captureSession.startRunning()
    }
}
```

### 2. Circular Buffer Implementation

**Option A: AVCaptureMovieFileOutput with rotation**
- Simpler but less control
- Auto-handles encoding
- Limited to file-based segments

**Option B: AVAssetWriter with CMSampleBuffer queue (Recommended)**
- More control over buffer management
- Can implement true ring buffer in memory
- Better for precise timing

```swift
class SegmentManager {
    private var segments: [SegmentInfo] = []
    private let maxBufferDuration: TimeInterval = 5.0
    private let segmentDuration: TimeInterval = 0.5
    
    struct SegmentInfo {
        let url: URL
        let startTime: CMTime
        let duration: CMTime
    }
    
    func createNewSegment() -> URL {
        let filename = "segment_\(Date().timeIntervalSince1970).mp4"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
        return url
    }
    
    func trimBuffer() {
        let maxSegments = Int(maxBufferDuration / segmentDuration) + 2
        while segments.count > maxSegments {
            let oldest = segments.removeFirst()
            try? FileManager.default.removeItem(at: oldest.url)
        }
    }
}
```

### 3. Video Concatenation

```swift
class VideoMuxer {
    func concatenateSegments(_ segments: [URL], username: String) async throws -> URL {
        let composition = AVMutableComposition()
        
        guard let videoTrack = composition.addMutableTrack(
            withMediaType: .video,
            preferredTrackID: kCMPersistentTrackID_Invalid
        ) else { throw MuxerError.trackCreationFailed }
        
        guard let audioTrack = composition.addMutableTrack(
            withMediaType: .audio,
            preferredTrackID: kCMPersistentTrackID_Invalid
        ) else { throw MuxerError.trackCreationFailed }
        
        var currentTime = CMTime.zero
        
        for segmentURL in segments {
            let asset = AVAsset(url: segmentURL)
            let duration = try await asset.load(.duration)
            
            if let videoAssetTrack = try await asset.loadTracks(withMediaType: .video).first {
                try videoTrack.insertTimeRange(
                    CMTimeRange(start: .zero, duration: duration),
                    of: videoAssetTrack,
                    at: currentTime
                )
            }
            
            if let audioAssetTrack = try await asset.loadTracks(withMediaType: .audio).first {
                try audioTrack.insertTimeRange(
                    CMTimeRange(start: .zero, duration: duration),
                    of: audioAssetTrack,
                    at: currentTime
                )
            }
            
            currentTime = CMTimeAdd(currentTime, duration)
        }
        
        // Export
        let outputURL = generateOutputURL(username: username)
        let exportSession = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough)!
        exportSession.outputURL = outputURL
        exportSession.outputFileType = .mp4
        
        await exportSession.export()
        
        return outputURL
    }
}
```

### 4. Secure Authentication (Keychain)

```swift
class SecureAuthManager {
    private let service = "com.rork.auth"
    
    func register(username: String, password: String) throws {
        let passwordData = password.data(using: .utf8)!
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: username,
            kSecValueData as String: passwordData,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw AuthError.registrationFailed
        }
    }
    
    func login(username: String, password: String) throws -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: username,
            kSecReturnData as String: true
        ]
        
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let data = result as? Data,
              let storedPassword = String(data: data, encoding: .utf8) else {
            throw AuthError.loginFailed
        }
        
        return storedPassword == password
    }
}
```

## iOS-Specific Challenges

### 1. Background Recording Limitations
**Challenge**: iOS aggressively suspends apps in background, stopping camera access.

**Mitigations**:
- Use `UIApplication.shared.beginBackgroundTask` for short extensions
- Consider `voip` or `audio` background modes (may require justification for App Store)
- Implement quick-save on app suspension

```swift
func applicationWillResignActive() {
    // Save current buffer immediately
    if isRecording {
        finalizeCurrentSegment()
    }
}
```

### 2. Memory Pressure
**Challenge**: iOS is more aggressive with memory management.

**Mitigations**:
- Use file-based segments instead of in-memory buffers
- Implement `didReceiveMemoryWarning` handler
- Aggressive segment cleanup

### 3. Privacy Permissions
**Challenge**: iOS requires explicit permission prompts with usage descriptions.

**Required Info.plist entries**:
```xml
<key>NSCameraUsageDescription</key>
<string>RORK needs camera access to record video clips</string>
<key>NSMicrophoneUsageDescription</key>
<string>RORK needs microphone access to record audio with video</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>RORK needs photo library access to save your clips</string>
```

### 4. Segment Timing Precision
**Challenge**: AVAssetWriter timing can be less predictable than CameraX.

**Mitigations**:
- Use `CMSampleBuffer` timestamps directly
- Implement buffer monitoring with completion handlers
- Use `AVAssetWriter.status` polling

### 5. File Size on Disk
**Challenge**: iOS uses APFS which handles small files efficiently, but still need cleanup.

**Mitigations**:
- Implement segment cleanup on `applicationWillTerminate`
- Use temp directory which iOS cleans automatically
- Periodic cleanup check

## React Native Bridge

### Native Module (Swift)

```swift
@objc(RorkCameraModule)
class CameraModule: RCTEventEmitter {
    private var recorder: CircularBufferRecorder?
    
    @objc
    func startPreview(_ resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            self.recorder?.startPreview()
            resolve(true)
        }
    }
    
    @objc
    func triggerCapture(_ resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
        recorder?.triggerCapture { result in
            switch result {
            case .success(let path):
                resolve(["filePath": path])
            case .failure(let error):
                reject("CAPTURE_ERROR", error.localizedDescription, error)
            }
        }
    }
    
    override func supportedEvents() -> [String]! {
        return ["onBufferReady", "onCaptureStarted", "onCaptureCompleted", "onError", "onTelemetryUpdate"]
    }
}
```

### Objective-C Bridge Header

```objc
// CameraModule.m
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(RorkCameraModule, RCTEventEmitter)

RCT_EXTERN_METHOD(startPreview:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(triggerCapture:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setClipDuration:(int)seconds resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(stopCamera:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)

@end
```

## Timeline Estimate

| Phase | Duration | Description |
|-------|----------|-------------|
| 1. Research & Setup | 1 week | AVFoundation exploration, project setup |
| 2. Camera Preview | 1 week | Basic preview with RN bridge |
| 3. Segment Recording | 2 weeks | Core circular buffer implementation |
| 4. Concatenation | 1 week | AVAssetExportSession integration |
| 5. Auth & Polish | 1 week | Keychain, permissions, testing |
| **Total** | **6 weeks** | |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Background recording rejection | High | High | Document use case, consider foreground-only mode |
| Memory pressure crashes | Medium | High | Aggressive cleanup, testing on older devices |
| Timing drift in segments | Medium | Medium | Use hardware timestamps, validate during muxing |
| App Store review issues | Low | High | Clear privacy policy, justified permissions |

## Conclusion

Porting RORK to iOS is feasible with the outlined approach. The primary challenge is iOS's stricter background execution policies, which may require architectural adjustments for certain use cases. The core circular buffer + trigger-based capture concept translates well to AVFoundation, with the main differences being in API patterns rather than capabilities.

The recommended approach is to use AVAssetWriter with file-based segments for maximum reliability and App Store compatibility.
