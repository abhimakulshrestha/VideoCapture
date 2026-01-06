import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    Platform,
    StatusBar,
    Animated,
} from 'react-native';
import CameraModule from '../services/CameraModule';

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
 * SettingsScreen - Beautiful and intuitive configuration (ALL BUTTONS FUNCTIONAL)
 */
const SettingsScreen = ({ currentDuration, onDurationChange, onClose, username }) => {
    const [selectedDuration, setSelectedDuration] = useState(currentDuration);
    const [buttonScale] = useState(new Animated.Value(1));
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);

    const durationOptions = [
        { value: 6, pre: 3, post: 3, icon: '⚡', label: 'Quick' },
        { value: 10, pre: 5, post: 5, icon: '🎯', label: 'Standard' },
        { value: 20, pre: 10, post: 10, icon: '🎬', label: 'Extended' },
        { value: 30, pre: 15, post: 15, icon: '🎥', label: 'Maximum' },
    ];

    const handleDurationSelect = (value) => {
        setSelectedDuration(value);
        animateButton();
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

    const handleSave = async () => {
        if (selectedDuration === currentDuration) {
            // No changes, just close
            onClose();
            return;
        }

        animateButton();
        setSaving(true);
        
        try {
            console.log('Saving new duration:', selectedDuration);
            await CameraModule.setClipDuration(selectedDuration);
            
            if (onDurationChange) {
                onDurationChange(selectedDuration);
            }
            
            Alert.alert(
                'Settings Saved', 
                `Clip duration set to ${selectedDuration} seconds`,
                [{ text: 'OK', onPress: onClose }]
            );
        } catch (error) {
            console.error('Save error:', error);
            Alert.alert('Error', 'Failed to update duration: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleExportTelemetry = async () => {
        setExporting(true);
        try {
            console.log('Exporting telemetry...');
            const filePath = await CameraModule.exportTelemetry();
            Alert.alert(
                'Export Successful', 
                `Telemetry log saved to:\n${filePath}`,
                [{ text: 'OK' }]
            );
        } catch (error) {
            console.error('Export error:', error);
            Alert.alert('Export Failed', error.message || 'Could not export telemetry');
        } finally {
            setExporting(false);
        }
    };

    const selectedOption = durationOptions.find(o => o.value === selectedDuration);
    const hasChanges = selectedDuration !== currentDuration;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

            {/* Background Accents */}
            <View style={styles.backgroundAccent1} />
            <View style={styles.backgroundAccent2} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.backButton} 
                    onPress={onClose} 
                    activeOpacity={0.8}
                    disabled={saving}
                >
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={styles.headerPlaceholder} />
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.contentContainer}
            >
                {/* Profile Section */}
                <View style={styles.section}>
                    <View style={styles.profileCard}>
                        <View style={styles.profileAvatar}>
                            <Text style={styles.profileAvatarText}>
                                {username?.charAt(0)?.toUpperCase() || 'U'}
                            </Text>
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={styles.profileName}>{username || 'User'}</Text>
                            <Text style={styles.profileLabel}>Currently logged in</Text>
                        </View>
                        <View style={styles.profileBadge}>
                            <Text style={styles.profileBadgeText}>✓</Text>
                        </View>
                    </View>
                </View>

                {/* Duration Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionIcon}>⏱️</Text>
                        <View>
                            <Text style={styles.sectionTitle}>Clip Duration</Text>
                            <Text style={styles.sectionSubtitle}>Select total capture length</Text>
                        </View>
                    </View>

                    <View style={styles.durationGrid}>
                        {durationOptions.map((option) => (
                            <TouchableOpacity
                                key={option.value}
                                style={[
                                    styles.durationCard,
                                    selectedDuration === option.value && styles.durationCardSelected,
                                ]}
                                onPress={() => handleDurationSelect(option.value)}
                                activeOpacity={0.8}
                                disabled={saving}
                            >
                                <Text style={styles.durationCardIcon}>{option.icon}</Text>
                                <Text style={[
                                    styles.durationCardValue,
                                    selectedDuration === option.value && styles.durationCardValueSelected,
                                ]}>
                                    {option.value}s
                                </Text>
                                <Text style={styles.durationCardLabel}>{option.label}</Text>
                                <Text style={[
                                    styles.durationCardDesc,
                                    selectedDuration === option.value && styles.durationCardDescSelected,
                                ]}>
                                    {option.pre}s + {option.post}s
                                </Text>
                                {selectedDuration === option.value && (
                                    <View style={styles.durationCardCheck}>
                                        <Text style={styles.durationCardCheckText}>✓</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Selected Duration Preview */}
                    {selectedOption && (
                        <View style={styles.durationPreview}>
                            <View style={styles.durationPreviewItem}>
                                <Text style={styles.durationPreviewValue}>{selectedOption.pre}s</Text>
                                <Text style={styles.durationPreviewLabel}>Before tap</Text>
                            </View>
                            <View style={styles.durationPreviewDivider}>
                                <View style={styles.durationPreviewLine} />
                                <Text style={styles.durationPreviewTap}>TAP</Text>
                                <View style={styles.durationPreviewLine} />
                            </View>
                            <View style={styles.durationPreviewItem}>
                                <Text style={styles.durationPreviewValue}>{selectedOption.post}s</Text>
                                <Text style={styles.durationPreviewLabel}>After tap</Text>
                            </View>
                        </View>
                    )}

                    {/* Change Indicator */}
                    {hasChanges && (
                        <View style={styles.changeIndicator}>
                            <Text style={styles.changeIndicatorIcon}>ℹ️</Text>
                            <Text style={styles.changeIndicatorText}>
                                Tap "Save Changes" to apply new duration
                            </Text>
                        </View>
                    )}
                </View>

                {/* How It Works Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionIcon}>💡</Text>
                        <View>
                            <Text style={styles.sectionTitle}>How It Works</Text>
                            <Text style={styles.sectionSubtitle}>Simple one-tap capture</Text>
                        </View>
                    </View>

                    <View style={styles.infoCard}>
                        <View style={styles.infoStep}>
                            <View style={styles.infoStepNumber}>
                                <Text style={styles.infoStepNumberText}>1</Text>
                            </View>
                            <View style={styles.infoStepContent}>
                                <Text style={styles.infoStepTitle}>Camera Always Recording</Text>
                                <Text style={styles.infoStepDesc}>
                                    Buffer keeps last {selectedDuration / 2} seconds in memory
                                </Text>
                            </View>
                        </View>

                        <View style={styles.infoConnector} />

                        <View style={styles.infoStep}>
                            <View style={styles.infoStepNumber}>
                                <Text style={styles.infoStepNumberText}>2</Text>
                            </View>
                            <View style={styles.infoStepContent}>
                                <Text style={styles.infoStepTitle}>Tap Capture Button</Text>
                                <Text style={styles.infoStepDesc}>Freezes what happened before</Text>
                            </View>
                        </View>

                        <View style={styles.infoConnector} />

                        <View style={styles.infoStep}>
                            <View style={styles.infoStepNumber}>
                                <Text style={styles.infoStepNumberText}>3</Text>
                            </View>
                            <View style={styles.infoStepContent}>
                                <Text style={styles.infoStepTitle}>Auto-Records After</Text>
                                <Text style={styles.infoStepDesc}>
                                    Captures next {selectedDuration / 2} seconds
                                </Text>
                            </View>
                        </View>

                        <View style={styles.infoConnector} />

                        <View style={styles.infoStep}>
                            <View style={[styles.infoStepNumber, { backgroundColor: COLORS.success }]}>
                                <Text style={styles.infoStepNumberText}>✓</Text>
                            </View>
                            <View style={styles.infoStepContent}>
                                <Text style={styles.infoStepTitle}>Auto-Saves to Gallery</Text>
                                <Text style={styles.infoStepDesc}>
                                    Combined {selectedDuration}s clip ready
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Diagnostics Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionIcon}>📊</Text>
                        <View>
                            <Text style={styles.sectionTitle}>Diagnostics</Text>
                            <Text style={styles.sectionSubtitle}>Export performance data</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
                        onPress={handleExportTelemetry}
                        activeOpacity={0.8}
                        disabled={exporting}
                    >
                        <Text style={styles.exportButtonIcon}>📥</Text>
                        <Text style={styles.exportButtonText}>
                            {exporting ? 'Exporting...' : 'Export Telemetry Log'}
                        </Text>
                        {!exporting && <Text style={styles.exportButtonArrow}>→</Text>}
                    </TouchableOpacity>
                </View>

                {/* About Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionIcon}>ℹ️</Text>
                        <View>
                            <Text style={styles.sectionTitle}>About RORK</Text>
                            <Text style={styles.sectionSubtitle}>Version 1.0.0</Text>
                        </View>
                    </View>

                    <View style={styles.aboutCard}>
                        <Text style={styles.aboutTagline}>
                            "Capture what just happened"
                        </Text>
                        <Text style={styles.aboutText}>
                            RORK records continuously in the background. When something interesting 
                            happens, just tap - and you've captured both the moment and what led up to it.
                        </Text>
                        <View style={styles.techStack}>
                            <View style={styles.techItem}>
                                <Text style={styles.techIcon}>⚛️</Text>
                                <Text style={styles.techLabel}>React Native</Text>
                            </View>
                            <View style={styles.techItem}>
                                <Text style={styles.techIcon}>📹</Text>
                                <Text style={styles.techLabel}>CameraX</Text>
                            </View>
                            <View style={styles.techItem}>
                                <Text style={styles.techIcon}>🔐</Text>
                                <Text style={styles.techLabel}>Keystore</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Bottom Spacer */}
                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Save Button */}
            <View style={styles.footer}>
                <Animated.View style={{ transform: [{ scale: buttonScale }], flex: 1 }}>
                    <TouchableOpacity
                        style={[
                            styles.saveButton,
                            saving && styles.saveButtonDisabled,
                            !hasChanges && styles.saveButtonNoChanges,
                        ]}
                        onPress={handleSave}
                        activeOpacity={0.9}
                        disabled={saving}
                    >
                        <Text style={styles.saveButtonText}>
                            {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Close'}
                        </Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    backgroundAccent1: {
        position: 'absolute',
        top: -50,
        right: -50,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: COLORS.primary,
        opacity: 0.06,
    },
    backgroundAccent2: {
        position: 'absolute',
        bottom: 100,
        left: -80,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: COLORS.secondary,
        opacity: 0.04,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 16 : 56,
        paddingBottom: 16,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    backIcon: {
        color: COLORS.text,
        fontSize: 24,
        fontWeight: '300',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        letterSpacing: 0.5,
    },
    headerPlaceholder: {
        width: 44,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 20,
    },
    section: {
        marginBottom: 28,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    sectionIcon: {
        fontSize: 22,
        marginRight: 14,
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        padding: 18,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    profileAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileAvatarText: {
        color: '#000',
        fontSize: 22,
        fontWeight: '700',
    },
    profileInfo: {
        flex: 1,
        marginLeft: 16,
    },
    profileName: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
    },
    profileLabel: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    profileBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.success,
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileBadgeText: {
        color: '#000',
        fontSize: 14,
        fontWeight: '700',
    },
    durationGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    durationCard: {
        width: '47%',
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 16,
        borderWidth: 2,
        borderColor: 'transparent',
        position: 'relative',
    },
    durationCardSelected: {
        borderColor: COLORS.primary,
        backgroundColor: 'rgba(0, 217, 255, 0.1)',
    },
    durationCardIcon: {
        fontSize: 24,
        marginBottom: 8,
    },
    durationCardValue: {
        fontSize: 28,
        fontWeight: '800',
        color: COLORS.text,
    },
    durationCardValueSelected: {
        color: COLORS.primary,
    },
    durationCardLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    durationCardDesc: {
        fontSize: 11,
        color: COLORS.textMuted,
        marginTop: 4,
    },
    durationCardDescSelected: {
        color: COLORS.primaryLight,
    },
    durationCardCheck: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    durationCardCheckText: {
        color: '#000',
        fontSize: 12,
        fontWeight: '700',
    },
    durationPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surface,
        padding: 20,
        borderRadius: 16,
        marginTop: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    durationPreviewItem: {
        alignItems: 'center',
        flex: 1,
    },
    durationPreviewValue: {
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.primary,
    },
    durationPreviewLabel: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    durationPreviewDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    durationPreviewLine: {
        width: 20,
        height: 2,
        backgroundColor: COLORS.surfaceLight,
    },
    durationPreviewTap: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.secondary,
        backgroundColor: 'rgba(255, 107, 107, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginHorizontal: 6,
        letterSpacing: 1,
    },
    changeIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 217, 255, 0.15)',
        borderRadius: 12,
        padding: 12,
        marginTop: 12,
        borderWidth: 1,
        borderColor: 'rgba(0, 217, 255, 0.3)',
    },
    changeIndicatorIcon: {
        fontSize: 16,
        marginRight: 10,
    },
    changeIndicatorText: {
        flex: 1,
        fontSize: 13,
        color: COLORS.primary,
        fontWeight: '600',
    },
    infoCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    infoStep: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    infoStepNumber: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    infoStepNumberText: {
        color: '#000',
        fontSize: 14,
        fontWeight: '700',
    },
    infoStepContent: {
        flex: 1,
    },
    infoStepTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 2,
    },
    infoStepDesc: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    infoConnector: {
        width: 2,
        height: 20,
        backgroundColor: COLORS.surfaceLight,
        marginLeft: 15,
        marginVertical: 6,
    },
    exportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        padding: 18,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    exportButtonDisabled: {
        opacity: 0.6,
    },
    exportButtonIcon: {
        fontSize: 20,
        marginRight: 14,
    },
    exportButtonText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.text,
    },
    exportButtonArrow: {
        fontSize: 18,
        color: COLORS.textSecondary,
    },
    aboutCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    aboutTagline: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.primary,
        fontStyle: 'italic',
        marginBottom: 12,
        textAlign: 'center',
    },
    aboutText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        lineHeight: 22,
        marginBottom: 18,
        textAlign: 'center',
    },
    techStack: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    techItem: {
        alignItems: 'center',
    },
    techIcon: {
        fontSize: 24,
        marginBottom: 6,
    },
    techLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        paddingBottom: Platform.OS === 'android' ? 24 : 36,
        backgroundColor: COLORS.background,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    saveButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonNoChanges: {
        backgroundColor: COLORS.surface,
        shadowOpacity: 0,
        elevation: 0,
    },
    saveButtonText: {
        color: '#000',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});

export default SettingsScreen;