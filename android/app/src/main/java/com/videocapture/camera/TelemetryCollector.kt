package com.videocapture.camera

import android.app.ActivityManager
import android.content.Context
import android.os.Debug
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.util.Log
import java.io.BufferedReader
import java.io.File
import java.io.FileReader
import java.io.RandomAccessFile
import java.text.SimpleDateFormat
import java.util.*

/**
 * Collects performance telemetry during camera operations.
 * Tracks CPU, memory, GPU usage, and latency metrics.
 */
class TelemetryCollector(private val context: Context) {

    companion object {
        private const val TAG = "TelemetryCollector"
        private const val SAMPLE_INTERVAL_MS = 1000L // Sample every second
    }

    private val handler = Handler(Looper.getMainLooper())
    private var isCollecting = false
    private var lastCpuTime = 0L
    private var lastAppCpuTime = 0L
    
    private val metrics = mutableListOf<TelemetrySnapshot>()
    private var triggerPressTime = 0L
    private var recordingStartTime = 0L
    
    private var onMetricsUpdate: ((TelemetrySnapshot) -> Unit)? = null

    data class TelemetrySnapshot(
        val timestamp: Long,
        val cpuUsage: Float,
        val memoryUsageMb: Float,
        val gpuUsageEstimate: Float,
        val bufferSegments: Int,
        val bufferSizeKb: Long
    )

    data class LatencyMetrics(
        val triggerToRecordingMs: Long,
        val recordingToCompletionMs: Long,
        val totalCaptureMs: Long
    )

    private val sampleRunnable = object : Runnable {
        override fun run() {
            if (isCollecting) {
                collectSnapshot()
                handler.postDelayed(this, SAMPLE_INTERVAL_MS)
            }
        }
    }

    /**
     * Start collecting telemetry at regular intervals.
     */
    fun startCollection(onUpdate: ((TelemetrySnapshot) -> Unit)? = null) {
        if (isCollecting) return
        
        isCollecting = true
        onMetricsUpdate = onUpdate
        initializeCpuTracking()
        handler.post(sampleRunnable)
        Log.d(TAG, "Telemetry collection started")
    }

    /**
     * Stop collecting telemetry.
     */
    fun stopCollection() {
        isCollecting = false
        onMetricsUpdate = null
        handler.removeCallbacks(sampleRunnable)
        Log.d(TAG, "Telemetry collection stopped")
    }

    /**
     * Record the moment when trigger button is pressed.
     */
    fun onTriggerPressed() {
        triggerPressTime = System.currentTimeMillis()
        Log.d(TAG, "Trigger pressed at: $triggerPressTime")
    }

    /**
     * Record when recording actually starts after trigger.
     */
    fun onRecordingStarted() {
        recordingStartTime = System.currentTimeMillis()
        val latency = recordingStartTime - triggerPressTime
        Log.d(TAG, "Recording started. Trigger latency: ${latency}ms")
    }

    /**
     * Get latency metrics for the last capture.
     */
    fun getLatencyMetrics(): LatencyMetrics {
        val now = System.currentTimeMillis()
        return LatencyMetrics(
            triggerToRecordingMs = if (recordingStartTime > 0 && triggerPressTime > 0) 
                recordingStartTime - triggerPressTime else 0,
            recordingToCompletionMs = if (recordingStartTime > 0) 
                now - recordingStartTime else 0,
            totalCaptureMs = if (triggerPressTime > 0) 
                now - triggerPressTime else 0
        )
    }

    /**
     * Collect a snapshot of current system metrics.
     */
    private fun collectSnapshot() {
        val cpuUsage = getCpuUsage()
        val memoryUsage = getMemoryUsage()
        val gpuEstimate = estimateGpuUsage()
        
        val snapshot = TelemetrySnapshot(
            timestamp = System.currentTimeMillis(),
            cpuUsage = cpuUsage,
            memoryUsageMb = memoryUsage,
            gpuUsageEstimate = gpuEstimate,
            bufferSegments = 0, // Will be updated by caller
            bufferSizeKb = 0 // Will be updated by caller
        )
        
        metrics.add(snapshot)
        onMetricsUpdate?.invoke(snapshot)
        
        Log.v(TAG, "CPU: ${String.format("%.1f", cpuUsage)}%, " +
                   "Mem: ${String.format("%.1f", memoryUsage)}MB, " +
                   "GPU(est): ${String.format("%.1f", gpuEstimate)}%")
    }

    fun updateBufferInfo(segments: Int, sizeKb: Long) {
        // Update the last snapshot with buffer info
        if (metrics.isNotEmpty()) {
            val last = metrics.last()
            metrics[metrics.size - 1] = last.copy(
                bufferSegments = segments,
                bufferSizeKb = sizeKb
            )
        }
    }

    /**
     * Get CPU usage percentage for this app.
     */
    private fun getCpuUsage(): Float {
        return try {
            val pid = Process.myPid()
            val statFile = File("/proc/$pid/stat")
            
            if (!statFile.exists()) return 0f
            
            val stat = statFile.readText().trim().split(" ")
            if (stat.size < 15) return 0f
            
            val utime = stat[13].toLongOrNull() ?: 0L
            val stime = stat[14].toLongOrNull() ?: 0L
            val currentAppCpuTime = utime + stime
            
            val uptimeFile = File("/proc/uptime")
            val uptime = uptimeFile.readText().split(" ")[0].toDoubleOrNull() ?: 0.0
            val currentTotalTime = (uptime * 100).toLong() // Convert to jiffies
            
            if (lastCpuTime == 0L || lastAppCpuTime == 0L) {
                lastCpuTime = currentTotalTime
                lastAppCpuTime = currentAppCpuTime
                return 0f
            }
            
            val cpuDelta = currentTotalTime - lastCpuTime
            val appDelta = currentAppCpuTime - lastAppCpuTime
            
            lastCpuTime = currentTotalTime
            lastAppCpuTime = currentAppCpuTime
            
            if (cpuDelta > 0) {
                (appDelta.toFloat() / cpuDelta.toFloat() * 100f * Runtime.getRuntime().availableProcessors())
                    .coerceIn(0f, 100f)
            } else {
                0f
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting CPU usage", e)
            0f
        }
    }

    /**
     * Get memory usage in megabytes.
     */
    private fun getMemoryUsage(): Float {
        return try {
            val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val memInfo = Debug.MemoryInfo()
            Debug.getMemoryInfo(memInfo)
            
            // Total PSS (Proportional Set Size) in KB, convert to MB
            memInfo.totalPss / 1024f
        } catch (e: Exception) {
            Log.e(TAG, "Error getting memory usage", e)
            0f
        }
    }

    /**
     * Estimate GPU usage (Android doesn't provide direct API).
     * Uses heuristics based on graphics memory allocation.
     */
    private fun estimateGpuUsage(): Float {
        return try {
            val memInfo = Debug.MemoryInfo()
            Debug.getMemoryInfo(memInfo)
            
            // Graphics private memory as percentage of total app memory
            val graphicsKb = memInfo.getMemoryStat("summary.graphics")?.toIntOrNull() ?: 0
            val totalKb = memInfo.totalPss
            
            if (totalKb > 0) {
                (graphicsKb.toFloat() / totalKb.toFloat() * 100f).coerceIn(0f, 100f)
            } else {
                0f
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error estimating GPU usage", e)
            0f
        }
    }

    private fun initializeCpuTracking() {
        lastCpuTime = 0L
        lastAppCpuTime = 0L
    }

    /**
     * Get all collected metrics.
     */
    fun getAllMetrics(): List<TelemetrySnapshot> = metrics.toList()

    /**
     * Get average metrics from the collection period.
     */
    fun getAverageMetrics(): TelemetrySnapshot {
        if (metrics.isEmpty()) {
            return TelemetrySnapshot(0, 0f, 0f, 0f, 0, 0)
        }
        
        return TelemetrySnapshot(
            timestamp = System.currentTimeMillis(),
            cpuUsage = metrics.map { it.cpuUsage }.average().toFloat(),
            memoryUsageMb = metrics.map { it.memoryUsageMb }.average().toFloat(),
            gpuUsageEstimate = metrics.map { it.gpuUsageEstimate }.average().toFloat(),
            bufferSegments = metrics.map { it.bufferSegments }.average().toInt(),
            bufferSizeKb = metrics.map { it.bufferSizeKb }.average().toLong()
        )
    }

    /**
     * Export metrics to a log file.
     */
    fun exportToFile(): File? {
        return try {
            val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
            val logFile = File(context.cacheDir, "telemetry_$timestamp.log")
            
            logFile.bufferedWriter().use { writer ->
                writer.write("RORK Telemetry Report\n")
                writer.write("Generated: ${Date()}\n")
                writer.write("=" .repeat(50) + "\n\n")
                
                val avg = getAverageMetrics()
                writer.write("AVERAGES:\n")
                writer.write("  CPU Usage: ${String.format("%.1f", avg.cpuUsage)}%\n")
                writer.write("  Memory Usage: ${String.format("%.1f", avg.memoryUsageMb)}MB\n")
                writer.write("  GPU Usage (est): ${String.format("%.1f", avg.gpuUsageEstimate)}%\n\n")
                
                val latency = getLatencyMetrics()
                writer.write("LATENCY:\n")
                writer.write("  Trigger to Recording: ${latency.triggerToRecordingMs}ms\n")
                writer.write("  Recording to Completion: ${latency.recordingToCompletionMs}ms\n")
                writer.write("  Total Capture Time: ${latency.totalCaptureMs}ms\n\n")
                
                writer.write("RAW DATA:\n")
                writer.write("Timestamp,CPU%,MemoryMB,GPU%,Segments,BufferKB\n")
                metrics.forEach { m ->
                    writer.write("${m.timestamp},${m.cpuUsage},${m.memoryUsageMb},${m.gpuUsageEstimate},${m.bufferSegments},${m.bufferSizeKb}\n")
                }
            }
            
            Log.d(TAG, "Telemetry exported to: ${logFile.absolutePath}")
            logFile
        } catch (e: Exception) {
            Log.e(TAG, "Error exporting telemetry", e)
            null
        }
    }

    /**
     * Clear all collected metrics.
     */
    fun clearMetrics() {
        metrics.clear()
        triggerPressTime = 0L
        recordingStartTime = 0L
    }
}
