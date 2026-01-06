package com.videocapture.camera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import android.util.Size
import android.view.Surface
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.*
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.*
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Core circular buffer recorder using CameraX.
 * Implements segmented MP4 recording with automatic buffer management.
 */
class CircularBufferRecorder(private val context: Context) {

    companion object {
        private const val TAG = "CircularBufferRecorder"
        private const val SEGMENT_DURATION_MS = 500L
        private const val DEFAULT_BUFFER_SECONDS = 5
        private const val TARGET_RESOLUTION_WIDTH = 1280
        private const val TARGET_RESOLUTION_HEIGHT = 720
    }

    // State
    enum class State {
        IDLE,
        BUFFERING,
        CAPTURING_POST,
        FINALIZING
    }

    private var state = State.IDLE
    private val isRecording = AtomicBoolean(false)
    private val isTriggerActive = AtomicBoolean(false)
    
    // CameraX components
    private var cameraProvider: ProcessCameraProvider? = null
    private var camera: Camera? = null
    private var preview: Preview? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var currentRecording: Recording? = null
    
    // Managers
    val segmentManager = SegmentManager(context)
    private val videoMuxer = VideoMuxer(context)
    val telemetry = TelemetryCollector(context)
    
    // Executors
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
    private var currentSegmentIndex = 0
    private var segmentRecordingJob: Job? = null
    private val preSegments = mutableListOf<File>()
    private val postSegments = mutableListOf<File>()

    /**
     * Initialize camera and start preview.
     */
    fun startPreview(previewView: PreviewView, lifecycleOwner: LifecycleOwner) {
        Log.d(TAG, "Starting camera preview")
        
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            try {
                cameraProvider = cameraProviderFuture.get()
                bindCameraUseCases(previewView, lifecycleOwner)
            } catch (e: Exception) {
                Log.e(TAG, "Camera provider initialization failed", e)
                onError?.invoke("CAMERA_INIT_FAILED", e.message ?: "Unknown error")
            }
        }, ContextCompat.getMainExecutor(context))
    }

    private fun bindCameraUseCases(previewView: PreviewView, lifecycleOwner: LifecycleOwner) {
        val cameraProvider = this.cameraProvider ?: return
        
        // Unbind any existing use cases
        cameraProvider.unbindAll()
        
        // Preview use case
        preview = Preview.Builder()
            .setTargetResolution(Size(TARGET_RESOLUTION_WIDTH, TARGET_RESOLUTION_HEIGHT))
            .build()
            .also { it.setSurfaceProvider(previewView.surfaceProvider) }
        
        // Video capture use case with quality selector for 720p
        val qualitySelector = QualitySelector.from(
            Quality.HD, // 720p
            FallbackStrategy.higherQualityOrLowerThan(Quality.HD)
        )
        
        val recorder = Recorder.Builder()
            .setQualitySelector(qualitySelector)
            .build()
        
        videoCapture = VideoCapture.withOutput(recorder)
        
        // Select back camera
        val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
        
        try {
            camera = cameraProvider.bindToLifecycle(
                lifecycleOwner,
                cameraSelector,
                preview,
                videoCapture
            )
            
            Log.d(TAG, "Camera use cases bound successfully")
            
            // Start telemetry collection
            telemetry.startCollection { snapshot ->
                onTelemetryUpdate?.invoke(snapshot)
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Use case binding failed", e)
            onError?.invoke("CAMERA_BIND_FAILED", e.message ?: "Unknown error")
        }
    }

    /**
     * Set the total clip duration (symmetric split).
     * E.g., 10 seconds = 5s before + 5s after
     */
    fun setClipDuration(totalSeconds: Int) {
        preBufferSeconds = totalSeconds / 2
        postBufferSeconds = totalSeconds - preBufferSeconds
        segmentManager.setBufferDuration(preBufferSeconds)
        Log.d(TAG, "Clip duration set: ${preBufferSeconds}s pre + ${postBufferSeconds}s post")
    }

    /**
     * Set the username for file naming.
     */
    fun setUsername(username: String) {
        currentUsername = username.replace(Regex("[^a-zA-Z0-9_]"), "_")
    }

    /**
     * Start circular buffer recording.
     */
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
        
        // Clean up any orphan files from previous sessions
        segmentManager.cleanupOrphanFiles()
        
        // Start segment recording loop
        startSegmentLoop()
        
        Log.d(TAG, "Buffering started")
        onBufferReady?.invoke()
    }

    /**
     * Start the continuous segment recording loop.
     */
    private fun startSegmentLoop() {
        segmentRecordingJob = recordingScope.launch {
            while (isActive && (state == State.BUFFERING || state == State.CAPTURING_POST)) {
                val segmentFile = segmentManager.createNewSegment()
                recordSegment(segmentFile)
                
                // If we're capturing post-trigger, track the segment
                if (state == State.CAPTURING_POST) {
                    postSegments.add(segmentFile)
                    
                    val postDurationMs = postSegments.size * SEGMENT_DURATION_MS
                    if (postDurationMs >= postBufferSeconds * 1000L) {
                        // Post-capture complete
                        Log.d(TAG, "Post-capture complete")
                        break
                    }
                }
                
                // Update telemetry with buffer info
                val status = segmentManager.getBufferStatus()
                telemetry.updateBufferInfo(status.segmentCount, status.totalSizeBytes / 1024)
            }
            
            // If we were capturing, finalize the video
            if (state == State.CAPTURING_POST) {
                withContext(Dispatchers.Main) {
                    finalizeCapture()
                }
            }
        }
    }

    /**
     * Record a single segment using CameraX VideoCapture.
     */
    private suspend fun recordSegment(segmentFile: File) {
        val videoCapture = this.videoCapture ?: return
        
        val outputOptions = FileOutputOptions.Builder(segmentFile).build()
        
        // Create a completion deferred
        val recordingComplete = CompletableDeferred<Boolean>()
        
        try {
            withContext(Dispatchers.Main) {
                if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) 
                    == PackageManager.PERMISSION_GRANTED) {
                    
                    currentRecording = videoCapture.output
                        .prepareRecording(context, outputOptions)
                        .withAudioEnabled()
                        .start(ContextCompat.getMainExecutor(context)) { event ->
                            when (event) {
                                is VideoRecordEvent.Start -> {
                                    Log.v(TAG, "Segment recording started: ${segmentFile.name}")
                                }
                                is VideoRecordEvent.Finalize -> {
                                    if (event.hasError()) {
                                        Log.e(TAG, "Segment recording error: ${event.error}")
                                    } else {
                                        val duration = SEGMENT_DURATION_MS
                                        segmentManager.onSegmentCompleted(segmentFile.absolutePath, duration)
                                    }
                                    recordingComplete.complete(true)
                                }
                            }
                        }
                }
            }
            
            // Wait for segment duration
            delay(SEGMENT_DURATION_MS)
            
            // Stop recording
            withContext(Dispatchers.Main) {
                currentRecording?.stop()
            }
            
            // Wait for recording to finalize
            withTimeout(2000L) {
                recordingComplete.await()
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Error recording segment", e)
            recordingComplete.complete(false)
        }
    }

    /**
     * Trigger capture - freeze the buffer and record post-trigger.
     */
    fun triggerCapture() {
        if (state != State.BUFFERING) {
            Log.w(TAG, "Cannot trigger capture, current state: $state")
            onError?.invoke("INVALID_STATE", "Camera not in buffering state")
            return
        }
        
        telemetry.onTriggerPressed()
        isTriggerActive.set(true)
        
        // Freeze the buffer and get pre-capture segments
        preSegments.clear()
        preSegments.addAll(segmentManager.freezeBuffer())
        postSegments.clear()
        
        state = State.CAPTURING_POST
        onStateChanged?.invoke(state)
        
        telemetry.onRecordingStarted()
        onCaptureStarted?.invoke()
        
        Log.d(TAG, "Capture triggered. Pre-segments: ${preSegments.size}")
        
        // The segment loop will continue and add to postSegments
    }

    /**
     * Finalize capture by concatenating pre and post segments.
     */
    private fun finalizeCapture() {
        state = State.FINALIZING
        onStateChanged?.invoke(state)
        
        recordingScope.launch {
            try {
                Log.d(TAG, "Finalizing capture: ${preSegments.size} pre + ${postSegments.size} post segments")
                
                val allSegments = preSegments + postSegments
                
                if (allSegments.isEmpty()) {
                    withContext(Dispatchers.Main) {
                        onError?.invoke("NO_SEGMENTS", "No video segments to save")
                        resetToIdle()
                    }
                    return@launch
                }
                
                // Concatenate segments
                val outputPath = videoMuxer.concatenateSegments(allSegments, currentUsername)
                
                withContext(Dispatchers.Main) {
                    if (outputPath != null) {
                        Log.d(TAG, "Capture complete: $outputPath")
                        
                        // Log latency metrics
                        val latency = telemetry.getLatencyMetrics()
                        Log.i(TAG, "Latency - Trigger to Recording: ${latency.triggerToRecordingMs}ms, Total: ${latency.totalCaptureMs}ms")
                        
                        onCaptureCompleted?.invoke(outputPath)
                    } else {
                        onError?.invoke("MUXER_FAILED", "Failed to create final video")
                    }
                    
                    resetToIdle()
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "Error finalizing capture", e)
                withContext(Dispatchers.Main) {
                    onError?.invoke("FINALIZE_FAILED", e.message ?: "Unknown error")
                    resetToIdle()
                }
            }
        }
    }

    /**
     * Reset to idle state and resume buffering.
     */
    private fun resetToIdle() {
        preSegments.clear()
        postSegments.clear()
        isTriggerActive.set(false)
        
        // Clear old segments and restart buffering
        segmentManager.clearBuffer()
        
        state = State.IDLE
        onStateChanged?.invoke(state)
        
        // Optionally restart buffering
        // startBuffering()
    }

    /**
     * Stop camera and release resources.
     */
    fun stopCamera() {
        Log.d(TAG, "Stopping camera")
        
        segmentRecordingJob?.cancel()
        currentRecording?.stop()
        
        telemetry.stopCollection()
        segmentManager.clearBuffer()
        
        cameraProvider?.unbindAll()
        cameraExecutor.shutdown()
        recordingScope.cancel()
        
        state = State.IDLE
    }

    /**
     * Check if required permissions are granted.
     */
    private fun checkPermissions(): Boolean {
        val cameraGranted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
        
        val audioGranted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        
        return cameraGranted && audioGranted
    }

    /**
     * Get current state.
     */
    fun getState(): State = state

    /**
     * Get buffer status.
     */
    fun getBufferStatus(): SegmentManager.BufferStatus = segmentManager.getBufferStatus()

    /**
     * Export telemetry log.
     */
    fun exportTelemetry(): File? = telemetry.exportToFile()
}
