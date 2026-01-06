package com.videocapture.camera

import android.content.ContentValues
import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.text.SimpleDateFormat
import java.util.*

/**
 * Handles concatenation of video segments into a single MP4 file
 * without re-encoding (using MediaMuxer).
 */
class VideoMuxer(private val context: Context) {

    companion object {
        private const val TAG = "VideoMuxer"
        private const val BUFFER_SIZE = 1024 * 1024 // 1MB buffer
    }

    /**
     * Concatenate multiple MP4 segments into a single output file.
     * Uses MediaMuxer to avoid re-encoding.
     *
     * @param segments List of segment files to concatenate
     * @param username Username for file naming
     * @return Path to the output file in MediaStore
     */
    fun concatenateSegments(segments: List<File>, username: String): String? {
        if (segments.isEmpty()) {
            Log.e(TAG, "No segments to concatenate")
            return null
        }

        Log.d(TAG, "Starting concatenation of ${segments.size} segments")
        
        // Generate output filename
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val outputFileName = "${username}_${timestamp}.mp4"
        
        // Create temp output file
        val tempOutput = File(context.cacheDir, "temp_output_$timestamp.mp4")
        
        try {
            // If only one segment, just copy it
            if (segments.size == 1) {
                segments[0].copyTo(tempOutput, overwrite = true)
            } else {
                // Concatenate multiple segments
                concatenateWithMuxer(segments, tempOutput)
            }
            
            // Save to MediaStore
            val savedPath = saveToMediaStore(tempOutput, outputFileName)
            
            // Clean up temp file
            tempOutput.delete()
            
            Log.d(TAG, "Concatenation complete: $savedPath")
            return savedPath
            
        } catch (e: Exception) {
            Log.e(TAG, "Error concatenating segments", e)
            tempOutput.delete()
            return null
        }
    }

    /**
     * Concatenate segments using MediaMuxer (no re-encoding).
     */
    private fun concatenateWithMuxer(segments: List<File>, output: File) {
        var muxer: MediaMuxer? = null
        var videoTrackIndex = -1
        var audioTrackIndex = -1
        var lastVideoPts = 0L
        var lastAudioPts = 0L
        var muxerStarted = false

        try {
            muxer = MediaMuxer(output.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            
            for ((index, segment) in segments.withIndex()) {
                if (!segment.exists() || segment.length() == 0L) {
                    Log.w(TAG, "Skipping empty or missing segment: ${segment.name}")
                    continue
                }
                
                val extractor = MediaExtractor()
                try {
                    extractor.setDataSource(segment.absolutePath)
                    
                    // On first valid segment, set up tracks
                    if (!muxerStarted) {
                        for (i in 0 until extractor.trackCount) {
                            val format = extractor.getTrackFormat(i)
                            val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
                            
                            when {
                                mime.startsWith("video/") && videoTrackIndex < 0 -> {
                                    videoTrackIndex = muxer.addTrack(format)
                                }
                                mime.startsWith("audio/") && audioTrackIndex < 0 -> {
                                    audioTrackIndex = muxer.addTrack(format)
                                }
                            }
                        }
                        muxer.start()
                        muxerStarted = true
                    }
                    
                    // Copy video track
                    if (videoTrackIndex >= 0) {
                        val videoPtsOffset = lastVideoPts
                        lastVideoPts = copyTrack(extractor, muxer, videoTrackIndex, "video/", videoPtsOffset)
                    }
                    
                    // Reset extractor for audio track
                    extractor.release()
                    val audioExtractor = MediaExtractor()
                    audioExtractor.setDataSource(segment.absolutePath)
                    
                    // Copy audio track
                    if (audioTrackIndex >= 0) {
                        val audioPtsOffset = lastAudioPts
                        lastAudioPts = copyTrack(audioExtractor, muxer, audioTrackIndex, "audio/", audioPtsOffset)
                    }
                    
                    audioExtractor.release()
                    
                    Log.d(TAG, "Processed segment ${index + 1}/${segments.size}")
                    
                } catch (e: Exception) {
                    Log.e(TAG, "Error processing segment: ${segment.name}", e)
                    extractor.release()
                } finally {
                    try {
                        extractor.release()
                    } catch (ignored: Exception) {}
                }
            }
            
        } finally {
            try {
                if (muxerStarted) {
                    muxer?.stop()
                }
                muxer?.release()
            } catch (e: Exception) {
                Log.e(TAG, "Error finalizing muxer", e)
            }
        }
    }

    /**
     * Copy a track from extractor to muxer with PTS offset.
     * @return The maximum PTS value written (for calculating next offset)
     */
    private fun copyTrack(
        extractor: MediaExtractor,
        muxer: MediaMuxer,
        targetTrackIndex: Int,
        mimePrefix: String,
        ptsOffset: Long
    ): Long {
        // Find and select the appropriate track
        for (i in 0 until extractor.trackCount) {
            val format = extractor.getTrackFormat(i)
            val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
            if (mime.startsWith(mimePrefix)) {
                extractor.selectTrack(i)
                break
            }
        }
        
        val buffer = ByteBuffer.allocate(BUFFER_SIZE)
        val bufferInfo = MediaCodec.BufferInfo()
        var maxPts = ptsOffset
        
        while (true) {
            val sampleSize = extractor.readSampleData(buffer, 0)
            if (sampleSize < 0) break
            
            bufferInfo.offset = 0
            bufferInfo.size = sampleSize
            bufferInfo.presentationTimeUs = extractor.sampleTime + ptsOffset
            bufferInfo.flags = extractor.sampleFlags
            
            if (bufferInfo.presentationTimeUs > maxPts) {
                maxPts = bufferInfo.presentationTimeUs
            }
            
            muxer.writeSampleData(targetTrackIndex, buffer, bufferInfo)
            extractor.advance()
        }
        
        extractor.unselectTrack(extractor.trackCount - 1)
        return maxPts + 33333 // Add ~1 frame duration to avoid overlap
    }

    /**
     * Save the concatenated video to MediaStore (visible in gallery).
     */
    private fun saveToMediaStore(tempFile: File, fileName: String): String {
        val contentValues = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
            put(MediaStore.MediaColumns.MIME_TYPE, "video/mp4")
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.MediaColumns.RELATIVE_PATH, "${Environment.DIRECTORY_MOVIES}/RORK")
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
        }
        
        val resolver = context.contentResolver
        val uri = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, contentValues)
            ?: throw Exception("Failed to create MediaStore entry")
        
        resolver.openOutputStream(uri)?.use { output ->
            tempFile.inputStream().use { input ->
                input.copyTo(output)
            }
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            contentValues.clear()
            contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
            resolver.update(uri, contentValues, null, null)
        }
        
        Log.d(TAG, "Saved to MediaStore: $uri")
        return uri.toString()
    }
}
