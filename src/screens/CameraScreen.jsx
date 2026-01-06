import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Animated,
    Dimensions,
    Platform,
    StatusBar,
} from 'react-native';
import CameraPreview from '../components/CameraPreview';
import CameraModule from '../services/CameraModule';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
    primary: '#00D9FF',
    primaryLight: '#5CE1FF',
    primaryDark: '#00B8D9',
    secondary: '#FF6B6B',
    accent: '#FFE66D',
    success: '#00E676',
    error: '#FF5252',
    warning: '#FFB74D',
    background: '#0A0F14',
    surface: '#141B22',
    surfaceLight: '#1E2832',
    text: '#FFFFFF',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    border: 'rgba(255, 255, 255, 0.08)',
};

/**
 * CameraScreen - Simplified one-button capture flow with smart pre-buffer handling
 */
const CameraScreen = ({ username, clipDuration, onSettings, onLogout, onDurationChange }) => {
    const cameraRef = useRef(null);
    const cameraPreviewRef = useRef(null);
    const screenOpenTime = useRef(null);
    const captureInProgress = useRef(false);

    // State
    const [showDurationDropdown, setShowDurationDropdown] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [cameraState, setCameraState] = useState('idle');
    const [telemetry, setTelemetry] = useState(null);
    const [showTelemetry, setShowTelemetry] = useState(false);
    const [isCameraInitialized, setIsCameraInitialized] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Animations
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;
    const captureFlash = useRef(new Animated.Value(0)).current;
    const buttonScale = useRef(new Animated.Value(1)).current;
    const successAnim = useRef(new Animated.Value(0)).current;
    const countdownScale = useRef(new Animated.Value(1)).current;

    const countdownInterval = useRef(null);

    useEffect(() => {
        initializeCamera();
        setupEventListeners();

        return () => {
            cleanup();
            if (countdownInterval.current) {
                clearInterval(countdownInterval.current);
            }
        };
    }, []);

    useEffect(() => {
        if (isReady && !isCapturing) {
            startPulseAnimation();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isReady, isCapturing]);

    // Track when screen is opened for smart pre-buffer handling
    useEffect(() => {
        if (isReady && !screenOpenTime.current) {
            screenOpenTime.current = Date.now();
            console.log('Screen ready - tracking open time');
        }
    }, [isReady]);

    const startPulseAnimation = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 1200,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1200,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    };

    const animateCountdown = () => {
        Animated.sequence([
            Animated.timing(countdownScale, {
                toValue: 1.3,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.spring(countdownScale, {
                toValue: 1,
                tension: 300,
                friction: 10,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const animateCapture = () => {
        Animated.sequence([
            Animated.timing(captureFlash, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(captureFlash, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();

        Animated.sequence([
            Animated.timing(buttonScale, {
                toValue: 0.85,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.spring(buttonScale, {
                toValue: 1,
                tension: 300,
                friction: 10,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const showSuccessMessage = () => {
        Animated.sequence([
            Animated.spring(successAnim, {
                toValue: 1,
                tension: 100,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.delay(2500),
            Animated.timing(successAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const initializeCamera = async () => {
        try {
            console.log('Initializing camera...');
            const perms = await CameraModule.checkPermissions();

            if (!perms.allGranted) {
                console.log('Requesting permissions...');
                const granted = await CameraModule.requestPermissions();
                if (!granted) {
                    Alert.alert('Permission Required', 'Camera and microphone permissions are required.');
                    setErrorMessage('Permissions denied');
                    return;
                }
            }

            setHasPermission(true);
            console.log('Permissions granted, initializing camera module...');
            
            await CameraModule.initializeCamera();
            setIsCameraInitialized(true);

            // Set clip duration first
            await CameraModule.setClipDuration(clipDuration);
            console.log(`Clip duration set to ${clipDuration}s`);

            // Wait for view to mount properly
            setTimeout(async () => {
                try {
                    if (cameraPreviewRef.current) {
                        console.log('Starting camera preview...');
                        cameraPreviewRef.current.startPreview();
                        
                        // Wait for preview to start, then begin buffering
                        setTimeout(async () => {
                            try {
                                console.log('Starting buffering...');
                                await CameraModule.startBuffering();
                                setIsReady(true);
                                setErrorMessage('');
                                console.log('Camera ready!');
                            } catch (e) {
                                console.error('Buffering error:', e);
                                setErrorMessage('Failed to start buffering');
                            }
                        }, 1000);
                    }
                } catch (e) {
                    console.error('Preview startup error:', e);
                    setErrorMessage('Failed to start preview');
                }
            }, 500);

        } catch (error) {
            console.error('Camera initialization error:', error);
            setErrorMessage(error.message || 'Camera initialization failed');
            Alert.alert('Error', 'Failed to initialize camera: ' + error.message);
        }
    };

    const setupEventListeners = () => {
        const subscriptions = [];

        subscriptions.push(CameraModule.onBufferReady(() => {
            console.log('Buffer ready event received');
            setIsReady(true);
            setErrorMessage('');
        }));

        subscriptions.push(CameraModule.onCaptureStarted(() => {
            console.log('Capture started event received');
            animateCapture();
        }));

        subscriptions.push(CameraModule.onCaptureCompleted(({ filePath }) => {
            console.log('Capture completed:', filePath);
            
            if (countdownInterval.current) {
                clearInterval(countdownInterval.current);
                countdownInterval.current = null;
            }
            
            setIsCapturing(false);
            setCountdown(0);
            captureInProgress.current = false;
            showSuccessMessage();
            progressAnim.setValue(0);

            // Reset screen open time and restart buffering
            screenOpenTime.current = null;
            setTimeout(async () => {
                try {
                    await CameraModule.startBuffering();
                    setIsReady(true);
                    screenOpenTime.current = Date.now();
                } catch (e) {
                    console.error('Error restarting buffer:', e);
                    setErrorMessage('Failed to restart buffering');
                }
            }, 1000);
        }));

        subscriptions.push(CameraModule.onError(({ code, message }) => {
            console.error('Camera error:', code, message);
            setIsCapturing(false);
            captureInProgress.current = false;
            setErrorMessage(message);
            Alert.alert('Camera Error', message);
            
            if (countdownInterval.current) {
                clearInterval(countdownInterval.current);
                countdownInterval.current = null;
            }
        }));

        subscriptions.push(CameraModule.onTelemetryUpdate((data) => {
            setTelemetry(data);
        }));

        subscriptions.push(CameraModule.onStateChanged(({ state }) => {
            console.log('State changed:', state);
            setCameraState(state);

            if (state === 'idle') {
                setIsCapturing(false);
                captureInProgress.current = false;
            }
        }));

        cameraRef.current = subscriptions;
    };

    const cleanup = async () => {
        console.log('Cleaning up camera...');
        if (cameraRef.current) {
            cameraRef.current.forEach(sub => sub.remove());
        }
        if (countdownInterval.current) {
            clearInterval(countdownInterval.current);
        }
        try {
            await CameraModule.stopCamera();
        } catch (e) {
            console.error('Cleanup error:', e);
        }
    };

    const durationOptions = [6, 10, 20, 30];

    const handleDurationSelect = async (duration) => {
        try {
            await CameraModule.setClipDuration(duration);
            if (onDurationChange) onDurationChange(duration);
            setShowDurationDropdown(false);
            
            // Reset screen open time with new duration
            if (isReady) {
                screenOpenTime.current = Date.now();
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to update duration: ' + error.message);
        }
    };

    const handleCapture = async () => {
        if (!isReady || isCapturing || captureInProgress.current) {
            console.log('Capture blocked:', { isReady, isCapturing, inProgress: captureInProgress.current });
            return;
        }

        try {
            captureInProgress.current = true;
            setIsCapturing(true);
            setIsReady(false);

            // Calculate actual pre-buffer time based on how long screen was open
            const preDuration = clipDuration / 2;
            const postDuration = clipDuration / 2;
            const screenOpenDuration = screenOpenTime.current 
                ? (Date.now() - screenOpenTime.current) / 1000 
                : 0;
            
            console.log(`Screen was open for ${screenOpenDuration.toFixed(1)}s, pre-buffer target: ${preDuration}s`);
            
            // The native module will handle whatever buffer is available
            // If screen was open < preDuration, it uses what's available
            await CameraModule.triggerCapture();

            // Start countdown for post-capture duration
            setCountdown(postDuration);

            // Animate progress
            progressAnim.setValue(0);
            Animated.timing(progressAnim, {
                toValue: 1,
                duration: postDuration * 1000,
                useNativeDriver: false,
            }).start();

            // Countdown ticker
            countdownInterval.current = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        if (countdownInterval.current) {
                            clearInterval(countdownInterval.current);
                            countdownInterval.current = null;
                        }
                        return 0;
                    }
                    animateCountdown();
                    return prev - 1;
                });
            }, 1000);

            // Safety timeout
            const safetyTimeout = (postDuration + 5) * 1000;
            setTimeout(() => {
                if (captureInProgress.current) {
                    console.log('Safety timeout: Forcing reset');
                    if (countdownInterval.current) {
                        clearInterval(countdownInterval.current);
                        countdownInterval.current = null;
                    }
                    setIsCapturing(false);
                    setCountdown(0);
                    captureInProgress.current = false;
                    progressAnim.setValue(0);
                    
                    // Try to restart buffering
                    setTimeout(async () => {
                        try {
                            await CameraModule.startBuffering();
                            setIsReady(true);
                            screenOpenTime.current = Date.now();
                        } catch (e) {
                            console.error('Error in safety timeout restart:', e);
                        }
                    }, 500);
                }
            }, safetyTimeout);

        } catch (error) {
            console.error('Capture error:', error);
            captureInProgress.current = false;
            setIsCapturing(false);
            setIsReady(true);
            setErrorMessage(error.message);
            Alert.alert('Error', 'Failed to capture: ' + error.message);
            
            if (countdownInterval.current) {
                clearInterval(countdownInterval.current);
                countdownInterval.current = null;
            }
        }
    };

    const handleStop = async () => {
        try {
            if (countdownInterval.current) {
                clearInterval(countdownInterval.current);
                countdownInterval.current = null;
            }
            await CameraModule.stopCamera();
            setIsCapturing(false);
            setIsReady(false);
            setCountdown(0);
            setCameraState('idle');
            captureInProgress.current = false;
            screenOpenTime.current = null;
        } catch (error) {
            console.error('Stop error:', error);
        }
    };

    const toggleTelemetry = () => {
        setShowTelemetry(!showTelemetry);
    };

    const preDuration = clipDuration / 2;
    const postDuration = clipDuration / 2;

    if (!hasPermission) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
                <View style={styles.permissionContainer}>
                    <View style={styles.permissionIconContainer}>
                        <Text style={styles.permissionIcon}>📷</Text>
                    </View>
                    <Text style={styles.permissionTitle}>Camera Access</Text>
                    <Text style={styles.permissionText}>
                        RORK needs access to your camera and microphone to capture moments.
                    </Text>
                    {errorMessage ? (
                        <Text style={styles.errorText}>{errorMessage}</Text>
                    ) : null}
                    <TouchableOpacity
                        style={styles.permissionButton}
                        onPress={initializeCamera}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.permissionButtonText}>Grant Access</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            {/* Camera Preview */}
            <CameraPreview
                ref={cameraPreviewRef}
                style={styles.camera}
                autoStart={false}
                clipDuration={clipDuration}
                onCameraReady={() => console.log('Camera preview ready')}
            />

            {/* Error Overlay */}
            {errorMessage && !isReady ? (
                <View style={styles.errorOverlay}>
                    <Text style={styles.errorOverlayText}>⚠️</Text>
                    <Text style={styles.errorOverlayMessage}>{errorMessage}</Text>
                    <TouchableOpacity
                        style={styles.errorRetryButton}
                        onPress={initializeCamera}
                    >
                        <Text style={styles.errorRetryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {/* Vignette Overlay */}
            <View style={styles.vignette} pointerEvents="none" />

            {/* Top Bar */}
            <View style={styles.topBar}>
                <TouchableOpacity style={styles.userBadge} onPress={onLogout} activeOpacity={0.8}>
                    <View style={styles.userAvatar}>
                        <Text style={styles.userAvatarText}>{username?.charAt(0)?.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.userName}>{username}</Text>
                </TouchableOpacity>

                <View style={[styles.stateContainer, isReady && styles.stateContainerReady]}>
                    <View style={[
                        styles.stateDot,
                        isReady && !isCapturing && styles.stateDotReady,
                        isCapturing && styles.stateDotCapturing,
                    ]} />
                    <Text style={styles.stateText}>
                        {isCapturing ? 'RECORDING' : isReady ? 'READY' : 'LOADING'}
                    </Text>
                </View>

                <TouchableOpacity style={styles.settingsButton} onPress={onSettings} activeOpacity={0.8}>
                    <Text style={styles.settingsIcon}>⋮</Text>
                </TouchableOpacity>
            </View>

            {/* Duration Info & Dropdown */}
            <View style={styles.durationContainer}>
                <TouchableOpacity
                    style={styles.durationInfo}
                    onPress={() => setShowDurationDropdown(!showDurationDropdown)}
                    activeOpacity={0.9}
                >
                    <View style={styles.durationItem}>
                        <Text style={styles.durationValue}>{preDuration}s</Text>
                        <Text style={styles.durationLabel}>BEFORE</Text>
                    </View>
                    <View style={styles.durationDivider}>
                        <Text style={styles.durationPlus}>+</Text>
                    </View>
                    <View style={styles.durationItem}>
                        <Text style={styles.durationValue}>{postDuration}s</Text>
                        <Text style={styles.durationLabel}>AFTER</Text>
                    </View>
                </TouchableOpacity>

                {showDurationDropdown && (
                    <View style={styles.dropdownList}>
                        {durationOptions.map((dur) => (
                            <TouchableOpacity
                                key={dur}
                                style={[
                                    styles.dropdownItem,
                                    clipDuration === dur && styles.dropdownItemSelected
                                ]}
                                onPress={() => handleDurationSelect(dur)}
                            >
                                <Text style={styles.dropdownText}>{dur}s total</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            {/* Telemetry Panel */}
            {showTelemetry && telemetry && (
                <View style={styles.telemetryPanel}>
                    <View style={styles.telemetryHeader}>
                        <Text style={styles.telemetryTitle}>Performance</Text>
                    </View>
                    <View style={styles.telemetryGrid}>
                        <View style={styles.telemetryItem}>
                            <Text style={styles.telemetryValue}>{telemetry.cpuUsage?.toFixed(0) || 0}%</Text>
                            <Text style={styles.telemetryLabel}>CPU</Text>
                        </View>
                        <View style={styles.telemetryItem}>
                            <Text style={styles.telemetryValue}>{telemetry.memoryUsageMb?.toFixed(0) || 0}</Text>
                            <Text style={styles.telemetryLabel}>MB RAM</Text>
                        </View>
                        <View style={styles.telemetryItem}>
                            <Text style={styles.telemetryValue}>{telemetry.bufferSegments || 0}</Text>
                            <Text style={styles.telemetryLabel}>Segments</Text>
                        </View>
                    </View>
                </View>
            )}

            {/* Bottom Controls */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[styles.sideButton, showTelemetry && styles.sideButtonActive]}
                    onPress={toggleTelemetry}
                    activeOpacity={0.8}
                >
                    <Text style={styles.sideButtonIcon}>☰</Text>
                    <Text style={styles.sideButtonLabel}>Stats</Text>
                </TouchableOpacity>

                <View style={styles.mainControlContainer}>
                    <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                        {isReady && !isCapturing && (
                            <Animated.View
                                style={[
                                    styles.pulseRing,
                                    { transform: [{ scale: pulseAnim }] },
                                ]}
                            />
                        )}

                        {isCapturing && (
                            <View style={styles.progressRingContainer}>
                                <Animated.View
                                    style={[
                                        styles.progressRing,
                                        {
                                            transform: [{
                                                rotate: progressAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: ['0deg', '360deg'],
                                                }),
                                            }],
                                        },
                                    ]}
                                />
                            </View>
                        )}

                        <TouchableOpacity
                            style={[
                                styles.captureButton,
                                !isReady && !isCapturing && styles.captureButtonDisabled,
                                isCapturing && styles.captureButtonCapturing,
                            ]}
                            onPress={handleCapture}
                            disabled={!isReady || isCapturing}
                            activeOpacity={0.9}
                        >
                            {isCapturing ? (
                                <Animated.View style={{ transform: [{ scale: countdownScale }] }}>
                                    <Text style={styles.countdownText}>{countdown}</Text>
                                </Animated.View>
                            ) : (
                                <View style={styles.captureButtonInner} />
                            )}
                        </TouchableOpacity>

                        <Text style={styles.captureLabel}>
                            {isCapturing ? 'RECORDING...' : isReady ? 'CAPTURE' : 'LOADING...'}
                        </Text>
                    </Animated.View>
                </View>

                <TouchableOpacity
                    style={styles.sideButton}
                    onPress={handleStop}
                    activeOpacity={0.8}
                >
                    <Text style={styles.stopButtonIcon}>■</Text>
                    <Text style={styles.sideButtonLabel}>Stop</Text>
                </TouchableOpacity>
            </View>

            {/* Success Toast */}
            <Animated.View
                style={[
                    styles.successToast,
                    {
                        opacity: successAnim,
                        transform: [{
                            translateY: successAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [100, 0],
                            }),
                        }],
                    },
                ]}
                pointerEvents="none"
            >
                <View style={styles.successToastContent}>
                    <Text style={styles.successIcon}>✅</Text>
                    <View>
                        <Text style={styles.successText}>Saved to Gallery!</Text>
                        <Text style={styles.successSubtext}>{clipDuration}s clip captured</Text>
                    </View>
                </View>
            </Animated.View>

            {/* Capture Flash */}
            <Animated.View
                style={[
                    styles.flashOverlay,
                    { opacity: captureFlash },
                ]}
                pointerEvents="none"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    camera: {
        ...StyleSheet.absoluteFillObject,
    },
    vignette: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
        borderWidth: 40,
        borderColor: 'rgba(0,0,0,0.25)',
    },
    errorOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        zIndex: 100,
    },
    errorOverlayText: {
        fontSize: 64,
        marginBottom: 20,
    },
    errorOverlayMessage: {
        fontSize: 16,
        color: COLORS.error,
        textAlign: 'center',
        marginBottom: 30,
    },
    errorRetryButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 12,
    },
    errorRetryButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '700',
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        padding: 40,
    },
    permissionIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 28,
    },
    permissionIcon: {
        fontSize: 48,
    },
    permissionTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 12,
    },
    permissionText: {
        fontSize: 16,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: 36,
        lineHeight: 24,
    },
    errorText: {
        fontSize: 14,
        color: COLORS.error,
        textAlign: 'center',
        marginBottom: 20,
    },
    permissionButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 40,
        paddingVertical: 18,
        borderRadius: 16,
    },
    permissionButtonText: {
        color: '#000',
        fontSize: 17,
        fontWeight: '700',
    },
    topBar: {
        position: 'absolute',
        top: Platform.OS === 'android' ? StatusBar.currentHeight + 12 : 50,
        left: 16,
        right: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    userBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingVertical: 8,
        paddingHorizontal: 12,
        paddingRight: 16,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    userAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    userAvatarText: {
        color: '#000',
        fontSize: 14,
        fontWeight: '700',
    },
    userName: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    stateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    stateContainerReady: {
        borderColor: 'rgba(0, 217, 255, 0.3)',
    },
    stateDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.textMuted,
        marginRight: 10,
    },
    stateDotReady: {
        backgroundColor: COLORS.primary,
    },
    stateDotCapturing: {
        backgroundColor: COLORS.error,
    },
    stateText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
    },
    settingsButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    settingsIcon: {
        fontSize: 26,
        color: COLORS.text,
        fontWeight: 'bold',
    },
    durationContainer: {
        position: 'absolute',
        top: Platform.OS === 'android' ? StatusBar.currentHeight + 72 : 110,
        alignSelf: 'center',
        zIndex: 1000,
        alignItems: 'center',
    },
    durationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    dropdownList: {
        position: 'absolute',
        top: '120%',
        width: '100%',
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 4,
        zIndex: 1000,
        elevation: 8,
    },
    dropdownItem: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 12,
    },
    dropdownItemSelected: {
        backgroundColor: 'rgba(0, 217, 255, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(0, 217, 255, 0.3)',
    },
    dropdownText: {
        color: COLORS.text,
        fontSize: 15,
        fontWeight: '700',
    },
    durationItem: {
        alignItems: 'center',
    },
    durationValue: {
        color: COLORS.primary,
        fontSize: 20,
        fontWeight: '800',
    },
    durationLabel: {
        color: COLORS.textSecondary,
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1,
        marginTop: 2,
    },
    durationDivider: {
        marginHorizontal: 20,
    },
    durationPlus: {
        color: COLORS.textMuted,
        fontSize: 18,
        fontWeight: '300',
    },
    telemetryPanel: {
        position: 'absolute',
        top: 170,
        left: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        minWidth: 140,
    },
    telemetryHeader: {
        marginBottom: 12,
    },
    telemetryTitle: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    telemetryGrid: {
        gap: 10,
    },
    telemetryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    telemetryValue: {
        color: COLORS.primary,
        fontSize: 16,
        fontWeight: '700',
    },
    telemetryLabel: {
        color: COLORS.textSecondary,
        fontSize: 12,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 50,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'flex-end',
        paddingHorizontal: 20,
    },
    sideButton: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        minWidth: 70,
    },
    sideButtonActive: {
        backgroundColor: 'rgba(0, 217, 255, 0.2)',
        borderColor: COLORS.primary,
    },
    sideButtonIcon: {
        fontSize: 24,
        marginBottom: 4,
        color: COLORS.text,
    },
    stopButtonIcon: {
        fontSize: 24,
        marginBottom: 4,
        color: COLORS.warning,
    },
    sideButtonLabel: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '600',
    },
    mainControlContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    pulseRing: {
        position: 'absolute',
        width: 110,
        height: 110,
        borderRadius: 55,
        borderWidth: 2,
        borderColor: COLORS.primary,
        opacity: 0.5,
        top: -10,
        left: -10,
    },
    progressRingContainer: {
        position: 'absolute',
        width: 110,
        height: 110,
        top: -10,
        left: -10,
    },
    progressRing: {
        width: 110,
        height: 110,
        borderRadius: 55,
        borderWidth: 4,
        borderColor: 'transparent',
        borderTopColor: COLORS.error,
        borderRightColor: COLORS.error,
    },
    captureButton: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: 'transparent',
        borderWidth: 5,
        borderColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureButtonDisabled: {
        borderColor: COLORS.textMuted,
        opacity: 0.5,
    },
    captureButtonCapturing: {
        borderColor: COLORS.error,
        backgroundColor: 'rgba(255, 82, 82, 0.2)',
    },
    captureButtonInner: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: COLORS.primary,
    },
    countdownText: {
        color: '#FFF',
        fontSize: 36,
        fontWeight: '800',
    },
    captureLabel: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '700',
        marginTop: 12,
        letterSpacing: 1,
        textAlign: 'center',
    },
    successToast: {
        position: 'absolute',
        bottom: 160,
        left: 30,
        right: 30,
    },
    successToastContent: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.success,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
    },
    successIcon: {
        fontSize: 24,
        marginRight: 14,
    },
    successText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '700',
    },
    successSubtext: {
        color: 'rgba(0,0,0,0.6)',
        fontSize: 12,
        marginTop: 2,
    },
    flashOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#FFF',
    },
});

export default CameraScreen;