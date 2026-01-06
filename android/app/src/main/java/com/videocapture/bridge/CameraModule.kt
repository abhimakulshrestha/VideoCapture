package com.videocapture.bridge

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.videocapture.auth.SecureAuthManager
import com.videocapture.camera.CircularBufferRecorder
import com.videocapture.camera.TelemetryCollector

/**
 * React Native Native Module for camera operations.
 * Exposes Kotlin camera functionality to JavaScript.
 */
class CameraModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "CameraModule"
        private const val MODULE_NAME = "RorkCameraModule"
        private const val PERMISSION_REQUEST_CODE = 1001
    }

    private var recorder: CircularBufferRecorder? = null
    private val authManager: SecureAuthManager by lazy { SecureAuthManager(reactApplicationContext) }

    // Track current username for session
    private var currentUsername: String? = null

    override fun getName(): String = MODULE_NAME

    override fun getConstants(): MutableMap<String, Any> {
        return hashMapOf(
            "STATE_IDLE" to "idle",
            "STATE_BUFFERING" to "buffering",
            "STATE_CAPTURING" to "capturing",
            "STATE_FINALIZING" to "finalizing"
        )
    }

    // ==================== Authentication Methods ====================

    @ReactMethod
    fun isUserRegistered(promise: Promise) {
        try {
            promise.resolve(authManager.isUserRegistered())
        } catch (e: Exception) {
            promise.reject("AUTH_ERROR", e.message)
        }
    }

    @ReactMethod
    fun register(username: String, password: String, promise: Promise) {
        try {
            when (val result = authManager.register(username, password)) {
                is SecureAuthManager.AuthResult.Success -> {
                    currentUsername = result.username
                    promise.resolve(createSuccessMap("Registration successful", result.username))
                }
                is SecureAuthManager.AuthResult.Error -> {
                    promise.reject("REGISTER_FAILED", result.message)
                }
            }
        } catch (e: Exception) {
            promise.reject("AUTH_ERROR", e.message)
        }
    }

    @ReactMethod
    fun login(username: String, password: String, promise: Promise) {
        try {
            when (val result = authManager.login(username, password)) {
                is SecureAuthManager.AuthResult.Success -> {
                    currentUsername = result.username
                    recorder?.setUsername(result.username)
                    promise.resolve(createSuccessMap("Login successful", result.username))
                }
                is SecureAuthManager.AuthResult.Error -> {
                    promise.reject("LOGIN_FAILED", result.message)
                }
            }
        } catch (e: Exception) {
            promise.reject("AUTH_ERROR", e.message)
        }
    }

    @ReactMethod
    fun logout(promise: Promise) {
        try {
            authManager.logout()
            currentUsername = null
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("LOGOUT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getUsername(promise: Promise) {
        // If currentUsername is not set in memory, try to restore it from stored credentials
        if (currentUsername == null) {
            currentUsername = authManager.getUsername()
        }
        promise.resolve(currentUsername)
    }

    // ==================== Permission Methods ====================

    @ReactMethod
    fun checkPermissions(promise: Promise) {
        val cameraGranted = ContextCompat.checkSelfPermission(
            reactApplicationContext, Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED

        val audioGranted = ContextCompat.checkSelfPermission(
            reactApplicationContext, Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED

        val result = Arguments.createMap().apply {
            putBoolean("camera", cameraGranted)
            putBoolean("audio", audioGranted)
            putBoolean("allGranted", cameraGranted && audioGranted)
        }
        promise.resolve(result)
    }

    @ReactMethod
    fun requestPermissions(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No activity available")
            return
        }

        val permissions = arrayOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO
        )

        val notGranted = permissions.filter {
            ContextCompat.checkSelfPermission(reactApplicationContext, it) != PackageManager.PERMISSION_GRANTED
        }

        if (notGranted.isEmpty()) {
            promise.resolve(true)
            return
        }

        ActivityCompat.requestPermissions(
            activity,
            notGranted.toTypedArray(),
            PERMISSION_REQUEST_CODE
        )

        // Note: Actual result handling would need a permission callback listener
        // For now, we resolve after request. The JS side should check permissions again.
        promise.resolve(true)
    }

    // ==================== Camera Methods ====================

    @ReactMethod
    fun initializeCamera(promise: Promise) {
        try {
            if (currentUsername == null) {
                promise.reject("NOT_AUTHENTICATED", "Please login first")
                return
            }

            if (recorder == null) {
                recorder = CircularBufferRecorder(reactApplicationContext).apply {
                    setUsername(currentUsername ?: "user")
                    setupCallbacks(this)
                }
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("INIT_ERROR", e.message)
        }
    }

    private fun setupCallbacks(recorder: CircularBufferRecorder) {
        recorder.onBufferReady = {
            sendEvent("onBufferReady", null)
        }

        recorder.onCaptureStarted = {
            sendEvent("onCaptureStarted", null)
        }

        recorder.onCaptureCompleted = { filePath ->
            val params = Arguments.createMap().apply {
                putString("filePath", filePath)
            }
            sendEvent("onCaptureCompleted", params)
        }

        recorder.onError = { code, message ->
            val params = Arguments.createMap().apply {
                putString("code", code)
                putString("message", message)
            }
            sendEvent("onError", params)
        }

        recorder.onTelemetryUpdate = { snapshot ->
            val params = Arguments.createMap().apply {
                putDouble("cpuUsage", snapshot.cpuUsage.toDouble())
                putDouble("memoryUsageMb", snapshot.memoryUsageMb.toDouble())
                putDouble("gpuUsageEstimate", snapshot.gpuUsageEstimate.toDouble())
                putInt("bufferSegments", snapshot.bufferSegments)
                putDouble("bufferSizeKb", snapshot.bufferSizeKb.toDouble())
            }
            sendEvent("onTelemetryUpdate", params)
        }

        recorder.onStateChanged = { state ->
            val stateString = when (state) {
                CircularBufferRecorder.State.IDLE -> "idle"
                CircularBufferRecorder.State.BUFFERING -> "buffering"
                CircularBufferRecorder.State.CAPTURING_POST -> "capturing"
                CircularBufferRecorder.State.FINALIZING -> "finalizing"
            }
            val params = Arguments.createMap().apply {
                putString("state", stateString)
            }
            sendEvent("onStateChanged", params)
        }
    }

    @ReactMethod
    fun setClipDuration(totalSeconds: Int, promise: Promise) {
        try {
            recorder?.setClipDuration(totalSeconds)
                ?: throw Exception("Camera not initialized")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_DURATION_ERROR", e.message)
        }
    }

    @ReactMethod
    fun startBuffering(promise: Promise) {
        try {
            recorder?.startBuffering()
                ?: throw Exception("Camera not initialized")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("BUFFERING_ERROR", e.message)
        }
    }

    @ReactMethod
    fun triggerCapture(promise: Promise) {
        try {
            recorder?.triggerCapture()
                ?: throw Exception("Camera not initialized")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CAPTURE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopCamera(promise: Promise) {
        try {
            recorder?.stopCamera()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getBufferStatus(promise: Promise) {
        try {
            val status = recorder?.getBufferStatus()
            if (status == null) {
                promise.reject("NOT_INITIALIZED", "Camera not initialized")
                return
            }

            val result = Arguments.createMap().apply {
                putInt("segmentCount", status.segmentCount)
                putDouble("totalDurationMs", status.totalDurationMs.toDouble())
                putDouble("totalSizeBytes", status.totalSizeBytes.toDouble())
                putDouble("bufferCapacityMs", status.bufferCapacityMs.toDouble())
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("STATUS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getCameraState(promise: Promise) {
        val state = recorder?.getState() ?: CircularBufferRecorder.State.IDLE
        val stateString = when (state) {
            CircularBufferRecorder.State.IDLE -> "idle"
            CircularBufferRecorder.State.BUFFERING -> "buffering"
            CircularBufferRecorder.State.CAPTURING_POST -> "capturing"
            CircularBufferRecorder.State.FINALIZING -> "finalizing"
        }
        promise.resolve(stateString)
    }

    @ReactMethod
    fun exportTelemetry(promise: Promise) {
        try {
            val file = recorder?.exportTelemetry()
            if (file != null) {
                promise.resolve(file.absolutePath)
            } else {
                promise.reject("EXPORT_ERROR", "Failed to export telemetry")
            }
        } catch (e: Exception) {
            promise.reject("EXPORT_ERROR", e.message)
        }
    }

    // ==================== Utility Methods ====================

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    private fun createSuccessMap(message: String, username: String): WritableMap {
        return Arguments.createMap().apply {
            putBoolean("success", true)
            putString("message", message)
            putString("username", username)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN built-in Event Emitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN built-in Event Emitter
    }

    /**
     * Get the recorder instance for the CameraViewManager.
     */
    fun getRecorder(): CircularBufferRecorder? = recorder
}
