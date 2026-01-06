import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { RorkCameraModule } = NativeModules;

if (!RorkCameraModule) {
  console.error('RorkCameraModule is not available. Make sure the native module is properly linked.');
}

// Create event emitter for native events
const cameraEventEmitter = RorkCameraModule 
  ? new NativeEventEmitter(RorkCameraModule) 
  : null;

/**
 * Camera Module API - Exposes all camera and auth functionality from native code.
 * 
 * IMPORTANT: The native module handles smart pre-buffer logic:
 * - If screen open time < pre-duration: uses all available buffer + post-duration
 * - If screen open time >= pre-duration: uses full pre-duration + post-duration
 * 
 * This ensures you always get a video, even if the user captures immediately.
 */
const CameraModule = {
  // ==================== Authentication ====================

  /**
   * Check if a user is already registered.
   * @returns {Promise<boolean>}
   */
  isUserRegistered: async () => {
    if (!RorkCameraModule) {
      console.error('CameraModule not available');
      throw new Error('CameraModule not available');
    }
    try {
      return await RorkCameraModule.isUserRegistered();
    } catch (error) {
      console.error('isUserRegistered error:', error);
      throw error;
    }
  },

  /**
   * Register a new user.
   * @param {string} username 
   * @param {string} password 
   * @returns {Promise<{success: boolean, message: string, username: string}>}
   */
  register: async (username, password) => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    if (!username || !password) {
      throw new Error('Username and password are required');
    }
    try {
      return await RorkCameraModule.register(username.trim(), password);
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  },

  /**
   * Login with credentials.
   * @param {string} username 
   * @param {string} password 
   * @returns {Promise<{success: boolean, message: string, username: string}>}
   */
  login: async (username, password) => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    if (!username || !password) {
      throw new Error('Username and password are required');
    }
    try {
      return await RorkCameraModule.login(username.trim(), password);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  /**
   * Logout current user.
   * @returns {Promise<boolean>}
   */
  logout: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    try {
      return await RorkCameraModule.logout();
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  },

  /**
   * Get current username.
   * @returns {Promise<string|null>}
   */
  getUsername: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    try {
      return await RorkCameraModule.getUsername();
    } catch (error) {
      console.error('getUsername error:', error);
      return null;
    }
  },

  // ==================== Permissions ====================

  /**
   * Check if camera and audio permissions are granted.
   * @returns {Promise<{camera: boolean, audio: boolean, allGranted: boolean}>}
   */
  checkPermissions: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    try {
      const result = await RorkCameraModule.checkPermissions();
      console.log('Permissions check result:', result);
      return result;
    } catch (error) {
      console.error('checkPermissions error:', error);
      throw error;
    }
  },

  /**
   * Request camera and audio permissions.
   * @returns {Promise<boolean>}
   */
  requestPermissions: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    try {
      const result = await RorkCameraModule.requestPermissions();
      console.log('Permission request result:', result);
      return result;
    } catch (error) {
      console.error('requestPermissions error:', error);
      throw error;
    }
  },

  // ==================== Camera Control ====================

  /**
   * Initialize the camera recorder.
   * Must be called after login and permissions are granted.
   * @returns {Promise<boolean>}
   */
  initializeCamera: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    try {
      console.log('Initializing camera...');
      const result = await RorkCameraModule.initializeCamera();
      console.log('Camera initialized:', result);
      return result;
    } catch (error) {
      console.error('initializeCamera error:', error);
      throw error;
    }
  },

  /**
   * Set the total clip duration (pre + post).
   * The duration is split equally: half for pre-buffer, half for post-recording.
   * 
   * @param {number} totalSeconds - Total duration in seconds (e.g., 10 = 5s pre + 5s post)
   * @returns {Promise<boolean>}
   */
  setClipDuration: async (totalSeconds) => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    if (typeof totalSeconds !== 'number' || totalSeconds < 2 || totalSeconds > 60) {
      throw new Error('Clip duration must be between 2 and 60 seconds');
    }
    try {
      console.log(`Setting clip duration to ${totalSeconds}s`);
      const result = await RorkCameraModule.setClipDuration(totalSeconds);
      console.log('Clip duration set:', result);
      return result;
    } catch (error) {
      console.error('setClipDuration error:', error);
      throw error;
    }
  },

  /**
   * Start circular buffer recording.
   * The camera continuously records and keeps the most recent pre-duration seconds.
   * 
   * @returns {Promise<boolean>}
   */
  startBuffering: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    try {
      console.log('Starting buffering...');
      const result = await RorkCameraModule.startBuffering();
      console.log('Buffering started:', result);
      return result;
    } catch (error) {
      console.error('startBuffering error:', error);
      throw error;
    }
  },

  /**
   * Trigger capture - saves whatever is in the pre-buffer + records post-buffer.
   * 
   * The native module intelligently handles the pre-buffer:
   * - If enough pre-buffer exists: saves full pre-duration
   * - If not enough exists yet: saves whatever is available
   * 
   * Then records for the full post-duration regardless.
   * This ensures you ALWAYS get a video, even if captured immediately.
   * 
   * @returns {Promise<boolean>}
   */
  triggerCapture: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    try {
      console.log('Triggering capture...');
      const result = await RorkCameraModule.triggerCapture();
      console.log('Capture triggered:', result);
      return result;
    } catch (error) {
      console.error('triggerCapture error:', error);
      throw error;
    }
  },

  /**
   * Stop camera and release all resources.
   * Clears the buffer and stops all recording.
   * 
   * @returns {Promise<boolean>}
   */
  stopCamera: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    try {
      console.log('Stopping camera...');
      const result = await RorkCameraModule.stopCamera();
      console.log('Camera stopped:', result);
      return result;
    } catch (error) {
      console.error('stopCamera error:', error);
      // Don't throw on stop errors, just log them
      return false;
    }
  },

  /**
   * Get current buffer status.
   * Useful for debugging and telemetry.
   * 
   * @returns {Promise<{segmentCount: number, totalDurationMs: number, totalSizeBytes: number, bufferCapacityMs: number}>}
   */
  getBufferStatus: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    try {
      return await RorkCameraModule.getBufferStatus();
    } catch (error) {
      console.error('getBufferStatus error:', error);
      return {
        segmentCount: 0,
        totalDurationMs: 0,
        totalSizeBytes: 0,
        bufferCapacityMs: 0
      };
    }
  },

  /**
   * Get current camera state.
   * @returns {Promise<'idle' | 'buffering' | 'capturing' | 'finalizing'>}
   */
  getCameraState: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    try {
      return await RorkCameraModule.getCameraState();
    } catch (error) {
      console.error('getCameraState error:', error);
      return 'idle';
    }
  },

  /**
   * Export telemetry log to file.
   * Creates a detailed log file with performance metrics and debug info.
   * 
   * @returns {Promise<string>} Path to the log file
   */
  exportTelemetry: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    try {
      const filePath = await RorkCameraModule.exportTelemetry();
      console.log('Telemetry exported to:', filePath);
      return filePath;
    } catch (error) {
      console.error('exportTelemetry error:', error);
      throw error;
    }
  },

  // ==================== Event Listeners ====================

  /**
   * Add listener for buffer ready event.
   * Fired when the circular buffer has enough data and is ready for capture.
   * 
   * @param {Function} callback 
   * @returns {Object} Subscription object (call .remove() to unsubscribe)
   */
  onBufferReady: (callback) => {
    if (!cameraEventEmitter) {
      console.warn('Event emitter not available');
      return { remove: () => {} };
    }
    return cameraEventEmitter.addListener('onBufferReady', (data) => {
      console.log('Event: onBufferReady', data);
      callback(data);
    });
  },

  /**
   * Add listener for capture started event.
   * Fired when capture is triggered and post-recording begins.
   * 
   * @param {Function} callback 
   * @returns {Object} Subscription
   */
  onCaptureStarted: (callback) => {
    if (!cameraEventEmitter) {
      console.warn('Event emitter not available');
      return { remove: () => {} };
    }
    return cameraEventEmitter.addListener('onCaptureStarted', (data) => {
      console.log('Event: onCaptureStarted', data);
      callback(data);
    });
  },

  /**
   * Add listener for capture completed event.
   * Fired when the video has been saved to the gallery.
   * 
   * @param {Function} callback - Receives { filePath: string, durationMs: number, sizeBytes: number }
   * @returns {Object} Subscription
   */
  onCaptureCompleted: (callback) => {
    if (!cameraEventEmitter) {
      console.warn('Event emitter not available');
      return { remove: () => {} };
    }
    return cameraEventEmitter.addListener('onCaptureCompleted', (data) => {
      console.log('Event: onCaptureCompleted', data);
      callback(data);
    });
  },

  /**
   * Add listener for error events.
   * Fired when any error occurs in the camera system.
   * 
   * @param {Function} callback - Receives { code: string, message: string }
   * @returns {Object} Subscription
   */
  onError: (callback) => {
    if (!cameraEventEmitter) {
      console.warn('Event emitter not available');
      return { remove: () => {} };
    }
    return cameraEventEmitter.addListener('onError', (data) => {
      console.log('Event: onError', data);
      callback(data);
    });
  },

  /**
   * Add listener for telemetry updates.
   * Fired periodically with performance metrics.
   * 
   * @param {Function} callback - Receives { cpuUsage, memoryUsageMb, gpuUsageEstimate, bufferSegments, bufferSizeKb }
   * @returns {Object} Subscription
   */
  onTelemetryUpdate: (callback) => {
    if (!cameraEventEmitter) {
      console.warn('Event emitter not available');
      return { remove: () => {} };
    }
    return cameraEventEmitter.addListener('onTelemetryUpdate', (data) => {
      // Don't log telemetry updates as they're frequent
      callback(data);
    });
  },

  /**
   * Add listener for state changes.
   * Fired whenever the camera state transitions.
   * 
   * @param {Function} callback - Receives { state: 'idle' | 'buffering' | 'capturing' | 'finalizing', previousState: string }
   * @returns {Object} Subscription
   */
  onStateChanged: (callback) => {
    if (!cameraEventEmitter) {
      console.warn('Event emitter not available');
      return { remove: () => {} };
    }
    return cameraEventEmitter.addListener('onStateChanged', (data) => {
      console.log('Event: onStateChanged', data);
      callback(data);
    });
  },

  // ==================== Constants ====================

  STATES: RorkCameraModule?.getConstants?.() || {
    STATE_IDLE: 'idle',
    STATE_BUFFERING: 'buffering',
    STATE_CAPTURING: 'capturing',
    STATE_FINALIZING: 'finalizing',
  },

  // ==================== Utility Methods ====================

  /**
   * Check if the native module is available and properly initialized.
   * @returns {boolean}
   */
  isAvailable: () => {
    return !!RorkCameraModule;
  },

  /**
   * Get module info for debugging.
   * @returns {Object}
   */
  getModuleInfo: () => {
    return {
      available: !!RorkCameraModule,
      hasEventEmitter: !!cameraEventEmitter,
      constants: RorkCameraModule?.getConstants?.() || {},
      methods: RorkCameraModule ? Object.keys(RorkCameraModule).filter(k => typeof RorkCameraModule[k] === 'function') : []
    };
  }
};

// Log module availability on import
console.log('CameraModule loaded:', CameraModule.getModuleInfo());

export default CameraModule;