package com.videocapture.bridge

import android.util.Log
import android.view.Choreographer
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.camera.view.PreviewView
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

/**
 * React Native View Manager for the CameraX PreviewView.
 * Renders the camera preview inside React Native UI.
 */
class CameraViewManager(private val reactContext: ReactApplicationContext) : SimpleViewManager<FrameLayout>() {

    companion object {
        private const val TAG = "CameraViewManager"
        const val VIEW_NAME = "RorkCameraView"
        
        const val COMMAND_START_PREVIEW = 1
        const val COMMAND_START_BUFFERING = 2
        const val COMMAND_TRIGGER_CAPTURE = 3
        const val COMMAND_STOP = 4
    }

    private var previewView: PreviewView? = null
    private var containerView: FrameLayout? = null

    override fun getName(): String = VIEW_NAME

    override fun createViewInstance(reactContext: ThemedReactContext): FrameLayout {
        Log.d(TAG, "Creating CameraView instance")
        
        val container = FrameLayout(reactContext).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        
        val preview = PreviewView(reactContext).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            implementationMode = PreviewView.ImplementationMode.COMPATIBLE
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }
        
        container.addView(preview)
        previewView = preview
        containerView = container
        
        // Trigger a layout pass to ensure the view is properly measured
        setupLayoutHack(container)
        
        return container
    }

    /**
     * Fix for React Native layout not being applied immediately.
     * Forces a manual layout pass.
     */
    private fun setupLayoutHack(view: FrameLayout) {
        Choreographer.getInstance().postFrameCallback(object : Choreographer.FrameCallback {
            override fun doFrame(frameTimeNanos: Long) {
                manuallyLayoutChildren(view)
                view.viewTreeObserver.dispatchOnGlobalLayout()
                Choreographer.getInstance().postFrameCallback(this)
            }
        })
    }

    private fun manuallyLayoutChildren(view: ViewGroup) {
        for (i in 0 until view.childCount) {
            val child = view.getChildAt(i)
            child.measure(
                View.MeasureSpec.makeMeasureSpec(view.measuredWidth, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(view.measuredHeight, View.MeasureSpec.EXACTLY)
            )
            child.layout(0, 0, child.measuredWidth, child.measuredHeight)
        }
    }

    @ReactProp(name = "autoStart", defaultBoolean = false)
    fun setAutoStart(view: FrameLayout, autoStart: Boolean) {
        if (autoStart) {
            startPreview(view)
        }
    }

    @ReactProp(name = "clipDuration", defaultInt = 10)
    fun setClipDuration(view: FrameLayout, duration: Int) {
        getRecorder()?.setClipDuration(duration)
    }

    override fun getCommandsMap(): Map<String, Int> {
        return MapBuilder.of(
            "startPreview", COMMAND_START_PREVIEW,
            "startBuffering", COMMAND_START_BUFFERING,
            "triggerCapture", COMMAND_TRIGGER_CAPTURE,
            "stop", COMMAND_STOP
        )
    }

    override fun receiveCommand(root: FrameLayout, commandId: String?, args: ReadableArray?) {
        super.receiveCommand(root, commandId, args)
        
        when (commandId?.toIntOrNull()) {
            COMMAND_START_PREVIEW -> startPreview(root)
            COMMAND_START_BUFFERING -> startBuffering()
            COMMAND_TRIGGER_CAPTURE -> triggerCapture()
            COMMAND_STOP -> stopCamera()
        }
    }

    private fun startPreview(view: FrameLayout) {
        Log.d(TAG, "Starting preview")
        
        val activity = reactContext.currentActivity
        if (activity == null || activity !is LifecycleOwner) {
            Log.e(TAG, "Activity is null or not a LifecycleOwner")
            return
        }
        
        val recorder = getRecorder()
        if (recorder == null) {
            Log.e(TAG, "Recorder not initialized. Call initializeCamera first.")
            return
        }
        
        previewView?.let { preview ->
            recorder.startPreview(preview, activity)
        }
    }

    private fun startBuffering() {
        try {
            getRecorder()?.startBuffering()
        } catch (e: Exception) {
            Log.e(TAG, "Error starting buffering", e)
        }
    }

    private fun triggerCapture() {
        try {
            getRecorder()?.triggerCapture()
        } catch (e: Exception) {
            Log.e(TAG, "Error triggering capture", e)
        }
    }

    private fun stopCamera() {
        try {
            getRecorder()?.stopCamera()
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping camera", e)
        }
    }

    private fun getRecorder(): com.videocapture.camera.CircularBufferRecorder? {
        return try {
            reactContext.getNativeModule(CameraModule::class.java)?.getRecorder()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get recorder", e)
            null
        }
    }

    override fun onDropViewInstance(view: FrameLayout) {
        super.onDropViewInstance(view)
        Log.d(TAG, "Dropping CameraView instance")
        previewView = null
        containerView = null
    }
}
