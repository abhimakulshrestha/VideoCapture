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
 */
const CameraPreview = React.forwardRef(({ autoStart = false, clipDuration = 10, style, ...props }, ref) => {
    const nativeRef = React.useRef(null);

    React.useImperativeHandle(ref, () => ({
        startPreview: () => {
            if (nativeRef.current) {
                UIManager.dispatchViewManagerCommand(
                    findNodeHandle(nativeRef.current),
                    UIManager.getViewManagerConfig(COMPONENT_NAME).Commands.startPreview,
                    []
                );
            }
        },
        startBuffering: () => {
            if (nativeRef.current) {
                UIManager.dispatchViewManagerCommand(
                    findNodeHandle(nativeRef.current),
                    UIManager.getViewManagerConfig(COMPONENT_NAME).Commands.startBuffering,
                    []
                );
            }
        },
        triggerCapture: () => {
            if (nativeRef.current) {
                UIManager.dispatchViewManagerCommand(
                    findNodeHandle(nativeRef.current),
                    UIManager.getViewManagerConfig(COMPONENT_NAME).Commands.triggerCapture,
                    []
                );
            }
        },
        stop: () => {
            if (nativeRef.current) {
                UIManager.dispatchViewManagerCommand(
                    findNodeHandle(nativeRef.current),
                    UIManager.getViewManagerConfig(COMPONENT_NAME).Commands.stop,
                    []
                );
            }
        },
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
