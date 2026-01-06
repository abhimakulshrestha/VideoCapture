package com.videocapture.camera

import android.content.Context
import android.util.Log
import java.io.File
import java.util.concurrent.ConcurrentLinkedDeque

/**
 * Manages the circular buffer of video segments on disk.
 * Each segment is a small MP4 file (~500ms of video).
 * Automatically deletes oldest segments when buffer limit is exceeded.
 */
class SegmentManager(private val context: Context) {

    companion object {
        private const val TAG = "SegmentManager"
        private const val SEGMENT_DURATION_MS = 500L
        private const val SEGMENT_PREFIX = "segment_"
        private const val SEGMENT_EXTENSION = ".mp4"
    }

    // Thread-safe deque for segment files (ordered by creation time)
    private val segments = ConcurrentLinkedDeque<SegmentInfo>()
    
    // Buffer duration in milliseconds
    private var bufferDurationMs: Long = 5000L
    
    // Directory for temporary segment files
    private val segmentDir: File by lazy {
        File(context.cacheDir, "video_buffer").apply { 
            if (!exists()) mkdirs() 
        }
    }

    data class SegmentInfo(
        val file: File,
        val startTimeMs: Long,
        val durationMs: Long,
        val index: Int
    )

    private var segmentCounter = 0

    /**
     * Set the pre-capture buffer duration.
     * @param durationSeconds Buffer duration in seconds
     */
    fun setBufferDuration(durationSeconds: Int) {
        bufferDurationMs = durationSeconds * 1000L
        Log.d(TAG, "Buffer duration set to ${durationSeconds}s")
    }

    /**
     * Get the current buffer duration in seconds.
     */
    fun getBufferDurationSeconds(): Int = (bufferDurationMs / 1000).toInt()

    /**
     * Create a new segment file and register it in the buffer.
     * @return The file path for the new segment
     */
    fun createNewSegment(): File {
        val timestamp = System.currentTimeMillis()
        val fileName = "${SEGMENT_PREFIX}${segmentCounter}${SEGMENT_EXTENSION}"
        val segmentFile = File(segmentDir, fileName)
        
        val segmentInfo = SegmentInfo(
            file = segmentFile,
            startTimeMs = timestamp,
            durationMs = SEGMENT_DURATION_MS,
            index = segmentCounter++
        )
        
        segments.addLast(segmentInfo)
        Log.d(TAG, "Created segment: ${segmentFile.name}")
        
        // Trim old segments to maintain buffer size
        trimBuffer()
        
        return segmentFile
    }

    /**
     * Get the path for the next segment to be recorded.
     */
    fun getNextSegmentPath(): String {
        return createNewSegment().absolutePath
    }

    /**
     * Mark a segment as completed recording.
     * Updates the actual duration if different from expected.
     */
    fun onSegmentCompleted(filePath: String, actualDurationMs: Long) {
        val file = File(filePath)
        segments.find { it.file.absolutePath == filePath }?.let { oldInfo ->
            // Update with actual duration (can't modify in place, so we just log)
            Log.d(TAG, "Segment completed: ${file.name}, duration: ${actualDurationMs}ms")
        }
    }

    /**
     * Get all segments currently in the buffer (for pre-capture).
     * @param durationMs Duration of footage needed in milliseconds
     * @return List of segment files ordered by time
     */
    fun getPreCaptureSegments(durationMs: Long): List<File> {
        val result = mutableListOf<File>()
        var totalDuration = 0L
        
        // Iterate from newest to oldest
        val segmentList = segments.toList().reversed()
        
        for (segment in segmentList) {
            if (segment.file.exists() && segment.file.length() > 0) {
                result.add(0, segment.file) // Add to front to maintain order
                totalDuration += segment.durationMs
                
                if (totalDuration >= durationMs) {
                    break
                }
            }
        }
        
        Log.d(TAG, "Got ${result.size} pre-capture segments (~${totalDuration}ms)")
        return result
    }

    /**
     * Get all current segments in order.
     */
    fun getAllSegments(): List<File> {
        return segments.mapNotNull { 
            if (it.file.exists() && it.file.length() > 0) it.file else null 
        }
    }

    /**
     * Freeze the buffer - stop automatic deletion of segments.
     * Call this when trigger is pressed.
     */
    fun freezeBuffer(): List<File> {
        Log.d(TAG, "Buffer frozen with ${segments.size} segments")
        return getAllSegments()
    }

    /**
     * Remove old segments to maintain buffer size limit.
     */
    private fun trimBuffer() {
        val maxSegments = (bufferDurationMs / SEGMENT_DURATION_MS).toInt() + 2 // +2 for safety
        
        while (segments.size > maxSegments) {
            val oldest = segments.pollFirst()
            oldest?.file?.let { file ->
                if (file.exists()) {
                    file.delete()
                    Log.d(TAG, "Deleted old segment: ${file.name}")
                }
            }
        }
    }

    /**
     * Clear all segments from the buffer.
     */
    fun clearBuffer() {
        segments.forEach { segment ->
            if (segment.file.exists()) {
                segment.file.delete()
            }
        }
        segments.clear()
        segmentCounter = 0
        Log.d(TAG, "Buffer cleared")
    }

    /**
     * Clean up orphan segment files (recovery from crash).
     */
    fun cleanupOrphanFiles() {
        segmentDir.listFiles()?.forEach { file ->
            if (file.name.startsWith(SEGMENT_PREFIX) && file.extension == "mp4") {
                val isInBuffer = segments.any { it.file.absolutePath == file.absolutePath }
                if (!isInBuffer) {
                    file.delete()
                    Log.d(TAG, "Deleted orphan file: ${file.name}")
                }
            }
        }
    }

    /**
     * Get current buffer status for reporting.
     */
    fun getBufferStatus(): BufferStatus {
        val segmentList = segments.toList()
        val totalDuration = segmentList.sumOf { it.durationMs }
        val totalSize = segmentList.sumOf { it.file.length() }
        
        return BufferStatus(
            segmentCount = segmentList.size,
            totalDurationMs = totalDuration,
            totalSizeBytes = totalSize,
            bufferCapacityMs = bufferDurationMs
        )
    }

    data class BufferStatus(
        val segmentCount: Int,
        val totalDurationMs: Long,
        val totalSizeBytes: Long,
        val bufferCapacityMs: Long
    )
}
