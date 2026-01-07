package com.videocapture.camera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import androidx.camera.core.CameraSelector
import androidx.camera.video.*
import androidx.camera.view.CameraController
import androidx.camera.view.LifecycleCameraController
import androidx.camera.view.PreviewView
import androidx.camera.view.video.AudioConfig
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.*
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Core circular buffer recorder using CameraX LifecycleCameraController.
 * Refactored to align with standard CameraX patterns while maintaining buffer logic.
 */
class CircularBufferRecorder(private val context: Context) {

    companion object {
        private const val TAG = "CircularBufferRecorder"
        private const val SEGMENT_DURATION_MS = 2000L
        private const val DEFAULT_BUFFER_SECONDS = 5
    }

    // State
    enum class State {
        IDLE,
        BUFFERING,
        CAPTURING_POST,
        FINALIZING
    }

    private var state = State.IDLE
    private val isTriggerActive = AtomicBoolean(false)
    
    // CameraX components
    private var controller: LifecycleCameraController? = null
    private var currentRecording: Recording? = null
    
    // Managers
    val segmentManager = SegmentManager(context)
    private val videoMuxer = VideoMuxer(context)
    val telemetry = TelemetryCollector(context)
    
    // Executors
    private val mainExecutor = ContextCompat.getMainExecutor(context)
    private val cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private val recordingScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    // Configuration
    private var preBufferSeconds = DEFAULT_BUFFER_SECONDS
    private var postBufferSeconds = DEFAULT_BUFFER_SECONDS
    private var currentUsername = "user"
    
    // Callbacks
    var onBufferReady: (() -> Unit)? = null
    var onCaptureStarted: (() -> Unit)? = null
    var onCaptureCompleted: ((String) -> Unit)? = null
    var onError: ((String, String) -> Unit)? = null
    var onTelemetryUpdate: ((TelemetryCollector.TelemetrySnapshot) -> Unit)? = null
    var onStateChanged: ((State) -> Unit)? = null

    // Segment recording state
    private var segmentRecordingJob: Job? = null
    private val preSegments = mutableListOf<File>()
    private val postSegments = mutableListOf<File>()

    /**
     * Initialize camera and start preview using LifecycleCameraController.
     */
    fun startPreview(previewView: PreviewView, lifecycleOwner: LifecycleOwner) {
        Log.d(TAG, "Starting camera preview with LifecycleCameraController")
        
        try {
            // Initialize the controller
            controller = LifecycleCameraController(context).apply {
                setEnabledUseCases(
                    CameraController.IMAGE_CAPTURE or 
                    CameraController.VIDEO_CAPTURE
                )
                
                // Set quality to HD (720p) if possible
                videoCaptureQualitySelector = QualitySelector.from(
                    Quality.HD,
                    FallbackStrategy.higherQualityOrLowerThan(Quality.HD)
                )

                // Select back camera by default
                cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
            }

            // Bind to lifecycle and view
            previewView.controller = controller
            controller?.bindToLifecycle(lifecycleOwner)

            Log.d(TAG, "Camera controller bound successfully")

            // Start telemetry
            telemetry.startCollection { snapshot ->
                onTelemetryUpdate?.invoke(snapshot)
            }

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start camera preview", e)
            onError?.invoke("CAMERA_INIT_FAILED", e.message ?: "Unknown error")
        }
    }

    /**
     * Set the total clip duration (symmetric split).
     */
    fun setClipDuration(totalSeconds: Int) {
        preBufferSeconds = totalSeconds / 2
        postBufferSeconds = totalSeconds - preBufferSeconds
        segmentManager.setBufferDuration(preBufferSeconds)
        Log.d(TAG, "Clip duration set: ${preBufferSeconds}s pre + ${postBufferSeconds}s post")
    }

    fun setUsername(username: String) {
        currentUsername = username.replace(Regex("[^a-zA-Z0-9_]"), "_")
    }

    fun startBuffering() {
        if (state != State.IDLE) {
            Log.w(TAG, "Cannot start buffering, current state: $state")
            return
        }
        
        if (!checkPermissions()) {
            onError?.invoke("PERMISSION_DENIED", "Camera or audio permission not granted")
            return
        }
        
        state = State.BUFFERING
        onStateChanged?.invoke(state)
        
        segmentManager.cleanupOrphanFiles()
        startSegmentLoop()
        
        Log.d(TAG, "Buffering started")
        onBufferReady?.invoke()
    }

    private fun startSegmentLoop() {
        segmentRecordingJob = recordingScope.launch {
            while (isActive && (state == State.BUFFERING || state == State.CAPTURING_POST)) {
                val segmentFile = segmentManager.createNewSegment()
                recordSegment(segmentFile)
                
                if (state == State.CAPTURING_POST) {
                    postSegments.add(segmentFile)
                    val postDurationMs = postSegments.size * SEGMENT_DURATION_MS
                    if (postDurationMs >= postBufferSeconds * 1000L) {
                        break
                    }
                }
                
                val status = segmentManager.getBufferStatus()
                telemetry.updateBufferInfo(status.segmentCount, status.totalSizeBytes / 1024)
            }
            
            if (state == State.CAPTURING_POST) {
                withContext(Dispatchers.Main) {
                    finalizeCapture()
                }
            }
        }
    }

    private suspend fun recordSegment(segmentFile: File) {
        val controller = this.controller
        if (controller == null) {
            Log.e(TAG, "Controller is null, cannot record")
            return
        }

        val outputOptions = FileOutputOptions.Builder(segmentFile).build()
        val recordingComplete = CompletableDeferred<Boolean>()
        val startEventReceived = CompletableDeferred<Unit>()

        withContext(Dispatchers.Main) {
            try {
                if (checkPermissions()) {
                    currentRecording = controller.startRecording(
                        outputOptions,
                        AudioConfig.create(true),
                        mainExecutor
                    ) { event ->
                        when (event) {
                            is VideoRecordEvent.Start -> {
                                Log.v(TAG, "Segment recording started: ${segmentFile.name}")
                                startEventReceived.complete(Unit)
                            }
                            is VideoRecordEvent.Finalize -> {
                                if (event.hasError()) {
                                    Log.e(TAG, "Segment recording error: ${event.error}")
                                    // Don't mark complete false immediately, check logic
                                } else {
                                    segmentManager.onSegmentCompleted(segmentFile.absolutePath, SEGMENT_DURATION_MS)
                                }
                                recordingComplete.complete(!event.hasError())
                            }
                        }
                    }
                } else {
                    recordingComplete.complete(false)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error starting recording", e)
                recordingComplete.complete(false)
            }
        }

        try {
            // Wait for start
            withTimeout(2000L) {
                startEventReceived.await()
            }
            
            // Record
            delay(SEGMENT_DURATION_MS)
            
            // Stop
            withContext(Dispatchers.Main) {
                currentRecording?.stop()
                currentRecording = null
            }
            
            // Wait to finalize
            withTimeout(2000L) {
                recordingComplete.await()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error during recording segment execution", e)
            withContext(Dispatchers.Main) {
                currentRecording?.stop()
                currentRecording = null
            }
        }
    }

    fun triggerCapture() {
        if (state != State.BUFFERING) {
            Log.w(TAG, "Cannot trigger capture, current state: $state")
            onError?.invoke("INVALID_STATE", "Camera not in buffering state")
            return
        }
        
        telemetry.onTriggerPressed()
        isTriggerActive.set(true)
        
        preSegments.clear()
        preSegments.addAll(segmentManager.freezeBuffer())
        postSegments.clear()
        
        state = State.CAPTURING_POST
        onStateChanged?.invoke(state)
        
        telemetry.onRecordingStarted()
        onCaptureStarted?.invoke()
        
        Log.d(TAG, "Capture triggered. Pre-segments: ${preSegments.size}")
    }

    private fun finalizeCapture() {
        state = State.FINALIZING
        onStateChanged?.invoke(state)
        
        recordingScope.launch {
            try {
                Log.d(TAG, "Finalizing capture: ${preSegments.size} pre + ${postSegments.size} post")
                val allSegments = preSegments + postSegments
                
                if (allSegments.isEmpty()) {
                    withContext(Dispatchers.Main) {
                        onError?.invoke("NO_SEGMENTS", "No video segments to save")
                        resetToIdle()
                    }
                    return@launch
                }
                
                val outputPath = videoMuxer.concatenateSegments(allSegments, currentUsername)
                
                withContext(Dispatchers.Main) {
                    if (outputPath != null) {
                        onCaptureCompleted?.invoke(outputPath)
                    } else {
                        onError?.invoke("MUXER_FAILED", "Failed to create final video")
                    }
                    resetToIdle()
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    onError?.invoke("FINALIZE_FAILED", e.message ?: "Unknown error")
                    resetToIdle()
                }
            }
        }
    }

    private fun resetToIdle() {
        preSegments.clear()
        postSegments.clear()
        isTriggerActive.set(false)
        segmentManager.clearBuffer()
        state = State.IDLE
        onStateChanged?.invoke(state)
        // startBuffering()
    }

    fun stopCamera() {
        Log.d(TAG, "Stopping camera")
        segmentRecordingJob?.cancel()
        
        mainExecutor.execute {
            currentRecording?.stop()
            currentRecording = null
            try {
                controller?.unbind()
            } catch (e: Exception) {
                // Ignore unbind errors
            }
        }
        
        telemetry.stopCollection()
        segmentManager.clearBuffer()
        recordingScope.cancel()
        cameraExecutor.shutdown() // Not used much with Controller but good cleanup
        
        state = State.IDLE
    }

    private fun checkPermissions(): Boolean {
        val cameraGranted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
        val audioGranted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        return cameraGranted && audioGranted
    }

    fun getState(): State = state
    fun getBufferStatus(): SegmentManager.BufferStatus = segmentManager.getBufferStatus()
    fun exportTelemetry(): File? = telemetry.exportToFile()
}
