import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { RorkCameraModule } = NativeModules;

// Create event emitter for native events
const cameraEventEmitter = RorkCameraModule 
  ? new NativeEventEmitter(RorkCameraModule) 
  : null;

/**
 * Camera Module API - Exposes all camera and auth functionality from native code.
 */
const CameraModule = {
  // ==================== Authentication ====================

  /**
   * Check if a user is already registered.
   * @returns {Promise<boolean>}
   */
  isUserRegistered: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    return RorkCameraModule.isUserRegistered();
  },

  /**
   * Register a new user.
   * @param {string} username 
   * @param {string} password 
   * @returns {Promise<{success: boolean, message: string, username: string}>}
   */
  register: async (username, password) => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    return RorkCameraModule.register(username, password);
  },

  /**
   * Login with credentials.
   * @param {string} username 
   * @param {string} password 
   * @returns {Promise<{success: boolean, message: string, username: string}>}
   */
  login: async (username, password) => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    return RorkCameraModule.login(username, password);
  },

  /**
   * Logout current user.
   * @returns {Promise<boolean>}
   */
  logout: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    return RorkCameraModule.logout();
  },

  /**
   * Get current username.
   * @returns {Promise<string|null>}
   */
  getUsername: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    return RorkCameraModule.getUsername();
  },

  // ==================== Permissions ====================

  /**
   * Check if camera and audio permissions are granted.
   * @returns {Promise<{camera: boolean, audio: boolean, allGranted: boolean}>}
   */
  checkPermissions: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    return RorkCameraModule.checkPermissions();
  },

  /**
   * Request camera and audio permissions.
   * @returns {Promise<boolean>}
   */
  requestPermissions: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    return RorkCameraModule.requestPermissions();
  },

  // ==================== Camera Control ====================

  /**
   * Initialize the camera recorder.
   * Must be called after login.
   * @returns {Promise<boolean>}
   */
  initializeCamera: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    return RorkCameraModule.initializeCamera();
  },

  /**
   * Set the total clip duration (pre + post).
   * @param {number} totalSeconds - Total duration in seconds (e.g., 10 = 5s pre + 5s post)
   * @returns {Promise<boolean>}
   */
  setClipDuration: async (totalSeconds) => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    return RorkCameraModule.setClipDuration(totalSeconds);
  },

  /**
   * Start circular buffer recording.
   * @returns {Promise<boolean>}
   */
  startBuffering: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    return RorkCameraModule.startBuffering();
  },

  /**
   * Trigger capture - saves pre-buffer + records post-buffer.
   * @returns {Promise<boolean>}
   */
  triggerCapture: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    return RorkCameraModule.triggerCapture();
  },

  /**
   * Stop camera and release resources.
   * @returns {Promise<boolean>}
   */
  stopCamera: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    return RorkCameraModule.stopCamera();
  },

  /**
   * Get current buffer status.
   * @returns {Promise<{segmentCount: number, totalDurationMs: number, totalSizeBytes: number, bufferCapacityMs: number}>}
   */
  getBufferStatus: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    return RorkCameraModule.getBufferStatus();
  },

  /**
   * Get current camera state.
   * @returns {Promise<'idle' | 'buffering' | 'capturing' | 'finalizing'>}
   */
  getCameraState: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    return RorkCameraModule.getCameraState();
  },

  /**
   * Export telemetry log to file.
   * @returns {Promise<string>} Path to the log file
   */
  exportTelemetry: async () => {
    if (!RorkCameraModule) throw new Error('CameraModule not available');
    return RorkCameraModule.exportTelemetry();
  },

  // ==================== Event Listeners ====================

  /**
   * Add listener for buffer ready event.
   * @param {Function} callback 
   * @returns {Object} Subscription object (call .remove() to unsubscribe)
   */
  onBufferReady: (callback) => {
    if (!cameraEventEmitter) return { remove: () => {} };
    return cameraEventEmitter.addListener('onBufferReady', callback);
  },

  /**
   * Add listener for capture started event.
   * @param {Function} callback 
   * @returns {Object} Subscription
   */
  onCaptureStarted: (callback) => {
    if (!cameraEventEmitter) return { remove: () => {} };
    return cameraEventEmitter.addListener('onCaptureStarted', callback);
  },

  /**
   * Add listener for capture completed event.
   * @param {Function} callback - Receives { filePath: string }
   * @returns {Object} Subscription
   */
  onCaptureCompleted: (callback) => {
    if (!cameraEventEmitter) return { remove: () => {} };
    return cameraEventEmitter.addListener('onCaptureCompleted', callback);
  },

  /**
   * Add listener for error events.
   * @param {Function} callback - Receives { code: string, message: string }
   * @returns {Object} Subscription
   */
  onError: (callback) => {
    if (!cameraEventEmitter) return { remove: () => {} };
    return cameraEventEmitter.addListener('onError', callback);
  },

  /**
   * Add listener for telemetry updates.
   * @param {Function} callback - Receives { cpuUsage, memoryUsageMb, gpuUsageEstimate, bufferSegments, bufferSizeKb }
   * @returns {Object} Subscription
   */
  onTelemetryUpdate: (callback) => {
    if (!cameraEventEmitter) return { remove: () => {} };
    return cameraEventEmitter.addListener('onTelemetryUpdate', callback);
  },

  /**
   * Add listener for state changes.
   * @param {Function} callback - Receives { state: 'idle' | 'buffering' | 'capturing' | 'finalizing' }
   * @returns {Object} Subscription
   */
  onStateChanged: (callback) => {
    if (!cameraEventEmitter) return { remove: () => {} };
    return cameraEventEmitter.addListener('onStateChanged', callback);
  },

  // ==================== Constants ====================

  STATES: RorkCameraModule?.getConstants?.() || {
    STATE_IDLE: 'idle',
    STATE_BUFFERING: 'buffering',
    STATE_CAPTURING: 'capturing',
    STATE_FINALIZING: 'finalizing',
  },
};

export default CameraModule;
