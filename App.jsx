import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from './src/screens/LoginScreen';
import CameraScreen from './src/screens/CameraScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import CameraModule from './src/services/CameraModule';

/**
 * RORK - React Native Camera App with Circular Buffer Recording
 * 
 * Core Features:
 * - Circular buffer recording (pre-capture segments)
 * - Trigger-based capture (not traditional record button)
 * - Configurable clip duration (symmetric pre/post)
 * - Local authentication with Android Keystore
 * - Performance telemetry logging
 * 
 * Architecture:
 * - React Native (Bare Workflow)
 * - CameraX for preview and recording
 * - MediaMuxer for no-reencode video assembly
 * - Segmented MP4 temp files as circular buffer
 */

const App = () => {
    // Navigation state
    const [currentScreen, setCurrentScreen] = useState('loading'); // 'loading', 'login', 'camera', 'settings'

    // User state
    const [username, setUsername] = useState(null);

    // Camera settings
    const [clipDuration, setClipDuration] = useState(10); // Default 10 seconds (5 + 5)

    useEffect(() => {
        checkLoginStatus();
    }, []);

    const checkLoginStatus = async () => {
        try {
            const storedUsername = await CameraModule.getUsername();
            if (storedUsername) {
                setUsername(storedUsername);
                setCurrentScreen('camera');
            } else {
                setCurrentScreen('login');
            }
        } catch (error) {
            console.log('No stored login, showing login screen');
            setCurrentScreen('login');
        }
    };

    const handleLoginSuccess = (loggedInUsername) => {
        setUsername(loggedInUsername);
        setCurrentScreen('camera');
    };

    const handleLogout = async () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await CameraModule.stopCamera();
                            await CameraModule.logout();
                            setUsername(null);
                            setCurrentScreen('login');
                        } catch (error) {
                            console.error('Logout error:', error);
                        }
                    },
                },
            ]
        );
    };

    const handleOpenSettings = () => {
        setCurrentScreen('settings');
    };

    const handleCloseSettings = () => {
        setCurrentScreen('camera');
    };

    const handleDurationChange = (newDuration) => {
        setClipDuration(newDuration);
    };

    const renderScreen = () => {
        switch (currentScreen) {
            case 'login':
                return <LoginScreen onLoginSuccess={handleLoginSuccess} />;

            case 'camera':
                return (
                    <CameraScreen
                        username={username}
                        clipDuration={clipDuration}
                        onSettings={handleOpenSettings}
                        onLogout={handleLogout}
                        onDurationChange={handleDurationChange}
                    />
                );

            case 'settings':
                return (
                    <SettingsScreen
                        currentDuration={clipDuration}
                        onDurationChange={handleDurationChange}
                        onClose={handleCloseSettings}
                        username={username}
                    />
                );

            case 'loading':
            default:
                return (
                    <View style={styles.loadingContainer}>
                        {/* Loading state - could add a splash screen here */}
                    </View>
                );
        }
    };

    return (
        <SafeAreaProvider>
            <StatusBar
                barStyle="light-content"
                backgroundColor="transparent"
                translucent
            />
            <View style={styles.container}>
                {renderScreen()}
            </View>
        </SafeAreaProvider>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F1A',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#0F0F1A',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default App;