import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Animated,
    Dimensions,
    StatusBar,
    ScrollView,
} from 'react-native';
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
 * LoginScreen - Beautiful and refined authentication UI
 */
const LoginScreen = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isRegistered, setIsRegistered] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [focusedInput, setFocusedInput] = useState(null);

    // Animation values
    const fadeAnim = useState(new Animated.Value(0))[0];
    const slideAnim = useState(new Animated.Value(30))[0];
    const logoScale = useState(new Animated.Value(0.8))[0];
    const buttonScale = useState(new Animated.Value(1))[0];

    useEffect(() => {
        checkRegistration();
        startAnimations();
    }, []);

    const startAnimations = () => {
        Animated.parallel([
            Animated.spring(logoScale, {
                toValue: 1,
                tension: 50,
                friction: 7,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                delay: 300,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 8,
                delay: 300,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const checkRegistration = async () => {
        try {
            if (!CameraModule.isAvailable()) {
                setError('Camera module not available. Please restart the app.');
                setLoading(false);
                return;
            }

            const registered = await CameraModule.isUserRegistered();
            setIsRegistered(registered);
            console.log('User registered:', registered);
        } catch (err) {
            console.error('Error checking registration:', err);
            setError('Failed to check registration status');
        } finally {
            setLoading(false);
        }
    };

    const animateButton = () => {
        Animated.sequence([
            Animated.timing(buttonScale, {
                toValue: 0.95,
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

    const handleSubmit = async () => {
        const trimmedUsername = username.trim();
        const trimmedPassword = password.trim();

        if (!trimmedUsername) {
            setError('Please enter a username');
            return;
        }
        if (trimmedUsername.length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }
        if (!trimmedPassword) {
            setError('Please enter a password');
            return;
        }
        if (trimmedPassword.length < 4) {
            setError('Password must be at least 4 characters');
            return;
        }

        animateButton();
        setError('');
        setSubmitting(true);

        try {
            if (isRegistered) {
                console.log('Attempting login...');
                const result = await CameraModule.login(trimmedUsername, trimmedPassword);
                console.log('Login result:', result);
                if (result.success) {
                    onLoginSuccess(result.username);
                } else {
                    setError(result.message || 'Login failed');
                }
            } else {
                console.log('Attempting registration...');
                const result = await CameraModule.register(trimmedUsername, trimmedPassword);
                console.log('Registration result:', result);
                if (result.success) {
                    onLoginSuccess(result.username);
                } else {
                    setError(result.message || 'Registration failed');
                }
            }
        } catch (err) {
            console.error('Auth error:', err);
            setError(err.message || 'Authentication failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSwitchMode = () => {
        setIsRegistered(!isRegistered);
        setError('');
        setUsername('');
        setPassword('');
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
                <View style={styles.loadingContainer}>
                    <Animated.View style={[styles.logoCircle, { transform: [{ scale: logoScale }] }]}>
                        <View style={styles.logoIconBody}>
                            <View style={styles.logoIconTop} />
                            <View style={styles.logoIconLensOuter}>
                                <View style={styles.logoIconLensInner} />
                            </View>
                            <View style={styles.logoIconFlash} />
                        </View>
                    </Animated.View>
                    <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 24 }} />
                    <Text style={styles.loadingText}>Initializing...</Text>
                </View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

            {/* Background Accents */}
            <View style={styles.backgroundOrb1} />
            <View style={styles.backgroundOrb2} />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Animated.View
                    style={[
                        styles.content,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    {/* Logo */}
                    <View style={styles.header}>
                        <Animated.View
                            style={[
                                styles.logoContainer,
                                { transform: [{ scale: logoScale }] }
                            ]}
                        >
                            <View style={styles.logoGlow} />
                            <View style={styles.logoCircle}>
                                <View style={styles.logoIconBody}>
                                    <View style={styles.logoIconTop} />
                                    <View style={styles.logoIconLensOuter}>
                                        <View style={styles.logoIconLensInner} />
                                    </View>
                                    <View style={styles.logoIconFlash} />
                                </View>
                            </View>
                        </Animated.View>
                        <Text style={styles.title}>RORK</Text>
                        <Text style={styles.subtitle}>Capture moments in time</Text>
                    </View>

                    {/* Form Card */}
                    <View style={styles.formCard}>
                        <View style={styles.formHeader}>
                            <Text style={styles.formTitle}>
                                {isRegistered ? 'Welcome Back' : 'Get Started'}
                            </Text>
                            <Text style={styles.formSubtitle}>
                                {isRegistered ? 'Sign in to continue' : 'Create your account'}
                            </Text>
                        </View>

                        {/* Username Input */}
                        <View style={styles.inputWrapper}>
                            <Text style={styles.inputLabel}>Username</Text>
                            <View style={[
                                styles.inputContainer,
                                focusedInput === 'username' && styles.inputContainerFocused,
                            ]}>
                                <Text style={styles.inputIcon}>👤</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your username"
                                    placeholderTextColor={COLORS.textMuted}
                                    value={username}
                                    onChangeText={setUsername}
                                    onFocus={() => setFocusedInput('username')}
                                    onBlur={() => setFocusedInput(null)}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    editable={!submitting}
                                />
                            </View>
                        </View>

                        {/* Password Input */}
                        <View style={styles.inputWrapper}>
                            <Text style={styles.inputLabel}>Password</Text>
                            <View style={[
                                styles.inputContainer,
                                focusedInput === 'password' && styles.inputContainerFocused,
                            ]}>
                                <Text style={styles.inputIcon}>🔒</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your password"
                                    placeholderTextColor={COLORS.textMuted}
                                    value={password}
                                    onChangeText={setPassword}
                                    onFocus={() => setFocusedInput('password')}
                                    onBlur={() => setFocusedInput(null)}
                                    secureTextEntry
                                    autoCapitalize="none"
                                    editable={!submitting}
                                    onSubmitEditing={handleSubmit}
                                />
                            </View>
                        </View>

                        {/* Error Message */}
                        {error ? (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorIcon}>⚠️</Text>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        ) : null}

                        {/* Submit Button */}
                        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                            <TouchableOpacity
                                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                                onPress={handleSubmit}
                                disabled={submitting}
                                activeOpacity={0.9}
                            >
                                <View style={styles.submitButtonGradient}>
                                    {submitting ? (
                                        <ActivityIndicator color="#000" size="small" />
                                    ) : (
                                        <>
                                            <Text style={styles.submitButtonText}>
                                                {isRegistered ? 'Sign In' : 'Create Account'}
                                            </Text>
                                            <Text style={styles.submitButtonIcon}>→</Text>
                                        </>
                                    )}
                                </View>
                            </TouchableOpacity>
                        </Animated.View>

                        {/* Switch Mode */}
                        <TouchableOpacity
                            style={styles.switchButton}
                            onPress={handleSwitchMode}
                            disabled={submitting}
                        >
                            <Text style={styles.switchText}>
                                {isRegistered ? "Don't have an account? " : 'Already have an account? '}
                                <Text style={styles.switchLink}>
                                    {isRegistered ? 'Register' : 'Sign In'}
                                </Text>
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <View style={styles.securityBadge}>
                            <Text style={styles.securityIcon}>🛡️</Text>
                            <Text style={styles.securityText}>Secured with Android Keystore</Text>
                        </View>
                    </View>
                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        minHeight: SCREEN_HEIGHT,
    },
    backgroundOrb1: {
        position: 'absolute',
        top: -100,
        right: -100,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: COLORS.primary,
        opacity: 0.08,
    },
    backgroundOrb2: {
        position: 'absolute',
        bottom: -50,
        left: -100,
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: COLORS.secondary,
        opacity: 0.06,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: COLORS.textSecondary,
        marginTop: 16,
        fontSize: 16,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
        paddingVertical: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoContainer: {
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoGlow: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: COLORS.primary,
        opacity: 0.25,
    },
    logoCircle: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 15,
    },
    logoIconBody: {
        width: 48,
        height: 36,
        backgroundColor: '#000',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    logoIconTop: {
        position: 'absolute',
        top: -6,
        left: 10,
        width: 14,
        height: 6,
        backgroundColor: '#000',
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
    },
    logoIconLensOuter: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoIconLensInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: COLORS.primary,
    },
    logoIconFlash: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#FFF',
    },
    title: {
        fontSize: 36,
        fontWeight: '800',
        color: COLORS.text,
        letterSpacing: 6,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        letterSpacing: 1,
    },
    formCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 28,
        padding: 28,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    formHeader: {
        marginBottom: 28,
    },
    formTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 6,
    },
    formSubtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    inputWrapper: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: 10,
        letterSpacing: 0.5,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceLight,
        borderRadius: 16,
        paddingHorizontal: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    inputContainerFocused: {
        borderColor: COLORS.primary,
        backgroundColor: 'rgba(0, 217, 255, 0.08)',
    },
    inputIcon: {
        fontSize: 18,
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: COLORS.text,
        paddingVertical: 16,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 82, 82, 0.15)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 82, 82, 0.3)',
    },
    errorIcon: {
        fontSize: 16,
        marginRight: 10,
    },
    errorText: {
        color: COLORS.error,
        fontSize: 14,
        flex: 1,
    },
    submitButton: {
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 8,
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
    submitButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: 18,
        paddingHorizontal: 24,
    },
    submitButtonText: {
        color: '#000',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    submitButtonIcon: {
        color: '#000',
        fontSize: 24,
        marginLeft: 8,
        fontWeight: '300',
    },
    switchButton: {
        marginTop: 24,
        alignItems: 'center',
    },
    switchText: {
        color: COLORS.textSecondary,
        fontSize: 14,
    },
    switchLink: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    footer: {
        marginTop: 32,
        alignItems: 'center',
    },
    securityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    securityIcon: {
        fontSize: 14,
        marginRight: 8,
    },
    securityText: {
        color: COLORS.textMuted,
        fontSize: 12,
    },
});

export default LoginScreen;