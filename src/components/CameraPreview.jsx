import React from 'react';
import { requireNativeComponent, UIManager, Platform, findNodeHandle } from 'react-native';

const COMPONENT_NAME = 'RorkCameraView';

// Check if the native component is available
const CameraViewNative = UIManager.getViewManagerConfig(COMPONENT_NAME)
    ? requireNativeComponent(COMPONENT_NAME)
    : null;

/**
 * CameraPreview component - wraps the native CameraX PreviewView.
 * 
 * @param {Object} props
 * @param {boolean} props.autoStart - Whether to auto-start preview when mounted
 * @param {number} props.clipDuration - Total clip duration in seconds (default: 10)
 * @param {Object} props.style - Style for the camera view container
 * @param {Function} props.onCameraReady - Callback when camera is ready
 */
const CameraPreview = React.forwardRef(({ 
    autoStart = false, 
    clipDuration = 10, 
    style, 
    onCameraReady,
    ...props 
}, ref) => {
    const nativeRef = React.useRef(null);
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
        
        // Give native view time to mount, then start preview if autoStart
        if (autoStart) {
            const timer = setTimeout(() => {
                if (nativeRef.current) {
                    startPreview();
                }
            }, 500);
            
            return () => clearTimeout(timer);
        }
    }, [autoStart]);

    const executeCommand = (commandName, args = []) => {
        if (!nativeRef.current) {
            console.warn(`Cannot execute ${commandName}: ref not available`);
            return;
        }

        try {
            const viewId = findNodeHandle(nativeRef.current);
            if (!viewId) {
                console.warn(`Cannot execute ${commandName}: viewId not found`);
                return;
            }

            const commands = UIManager.getViewManagerConfig(COMPONENT_NAME)?.Commands;
            if (!commands || !commands[commandName]) {
                console.warn(`Command ${commandName} not found in native module`);
                return;
            }

            UIManager.dispatchViewManagerCommand(
                viewId,
                commands[commandName],
                args
            );
        } catch (error) {
            console.error(`Error executing ${commandName}:`, error);
        }
    };

    const startPreview = () => {
        console.log('CameraPreview: Starting preview');
        executeCommand('startPreview');
        if (onCameraReady) {
            // Notify parent that camera preview has started
            setTimeout(() => onCameraReady(), 100);
        }
    };

    const startBuffering = () => {
        console.log('CameraPreview: Starting buffering');
        executeCommand('startBuffering');
    };

    const triggerCapture = () => {
        console.log('CameraPreview: Triggering capture');
        executeCommand('triggerCapture');
    };

    const stop = () => {
        console.log('CameraPreview: Stopping');
        executeCommand('stop');
    };

    React.useImperativeHandle(ref, () => ({
        startPreview,
        startBuffering,
        triggerCapture,
        stop,
    }));

    if (!CameraViewNative) {
        console.warn('RorkCameraView is not available. Check native module registration.');
        return null;
    }

    return (
        <CameraViewNative
            ref={nativeRef}
            autoStart={autoStart}
            clipDuration={clipDuration}
            style={[{ flex: 1 }, style]}
            {...props}
        />
    );
});

CameraPreview.displayName = 'CameraPreview';

export default CameraPreview;