import * as expoHaptics from 'expo-haptics'
import { Platform } from 'react-native'

export default class Haptics {
    /**
     * android: Confirm
     * ios: Success
     */
    static succes(): void {
        if (Platform.OS === 'android') {
            expoHaptics.performAndroidHapticsAsync(expoHaptics.AndroidHaptics.Confirm)
        }
        else if (Platform.OS === 'ios') {
            expoHaptics.notificationAsync(expoHaptics.NotificationFeedbackType.Success)
        }
    }
    /**
     * android: Reject
     * ios: Error
     */
    static erreur(): void {
        if (Platform.OS === 'android') {
            expoHaptics.performAndroidHapticsAsync(expoHaptics.AndroidHaptics.Reject)
        }
        else if (Platform.OS === 'ios') {
            expoHaptics.notificationAsync(expoHaptics.NotificationFeedbackType.Error)
        }
    }
    /**
     * android: Virtual_Key
     * ios: Light
     */
    static click(): void {
        if (Platform.OS === 'android') {
            expoHaptics.performAndroidHapticsAsync(expoHaptics.AndroidHaptics.Virtual_Key)
        }
        else if (Platform.OS === 'ios') {
            expoHaptics.impactAsync(expoHaptics.ImpactFeedbackStyle.Light)
        }
    }
    /**
     * android: Toggle_On
     * ios: Soft
     */
    static clickLeger(): void {
        try {
            if (Platform.OS === 'android') {
                expoHaptics.performAndroidHapticsAsync(expoHaptics.AndroidHaptics.Toggle_On)
            }
            else if (Platform.OS === 'ios') {
                expoHaptics.impactAsync(expoHaptics.ImpactFeedbackStyle.Soft)
            }
        } catch (err) {
            console.error(err)
        }
    }
    /**
     * android: Drag_Start
     * ios: Warning
     */
    static modalDebut(): void {
        if (Platform.OS === 'android') {
            expoHaptics.performAndroidHapticsAsync(expoHaptics.AndroidHaptics.Drag_Start)
        }
        else if (Platform.OS === 'ios') {
            expoHaptics.notificationAsync(expoHaptics.NotificationFeedbackType.Warning)
        }
    }
    /**
     * android: Gesture_End
     * ios: Heavy
     */
    static modalFin(): void {
        if (Platform.OS === 'android') {
            expoHaptics.performAndroidHapticsAsync(expoHaptics.AndroidHaptics.Gesture_End)
        }
        else if (Platform.OS === 'ios') {
            expoHaptics.impactAsync(expoHaptics.ImpactFeedbackStyle.Heavy)
        }
    }
    /**
     * android: Long_Press
     * ios: Heavy
     */
    static longPress(): void {
        if (Platform.OS === 'android') {
            expoHaptics.performAndroidHapticsAsync(expoHaptics.AndroidHaptics.Long_Press)
        }
        else if (Platform.OS === 'ios') {
            // Corrigé : l'original appelait notificationAsync() avec un ImpactFeedbackStyle,
            // ce qui n'est pas le bon type (et ne donnait pas le "Heavy" annoncé).
            expoHaptics.impactAsync(expoHaptics.ImpactFeedbackStyle.Heavy)
        }
    }
    /**
     * android: Gesture_End
     * ios: Soft
     */
    static animationFin(): void {
        if (Platform.OS === 'android') {
            expoHaptics.performAndroidHapticsAsync(expoHaptics.AndroidHaptics.Gesture_End)
        }
        else if (Platform.OS === 'ios') {
            expoHaptics.impactAsync(expoHaptics.ImpactFeedbackStyle.Soft)
        }
    }
    /**
     * android: Virtual_Key_Release
     * ios: Warning
     */
    static avertissement(): void {
        if (Platform.OS === 'android') {
            expoHaptics.performAndroidHapticsAsync(expoHaptics.AndroidHaptics.Virtual_Key_Release)
        }
        else if (Platform.OS === 'ios') {
            expoHaptics.notificationAsync(expoHaptics.NotificationFeedbackType.Warning)
        }
    }
}