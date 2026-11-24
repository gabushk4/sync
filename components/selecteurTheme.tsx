import { BlurView } from 'expo-blur'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, useColorScheme, useWindowDimensions, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import ApercuTheme from '@/components/apercuTheme'
import RoueTeinte from '@/components/roueTeinte'
import { DEFAULT_HUE } from '@/constants/Colors'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'

/** Largest wheel (px); smaller on a narrow screen. */
const TAILLE_ROUE_MAX = 220

type Props = {
    /** The theme's hue when opened. */
    teinteInitiale: number
    /** Left (done, tap outside, Android back): the hue to set across the app. */
    onAppliquer: (teinte: number) => void
    /** "Cancel": closed without changing anything. */
    onAnnuler: () => void
}

/**
 * The theme's color picker, in a modal over the settings: a hue wheel (RoueTeinte), and
 * under it a preview of the app in that hue (ApercuTheme), updated while dragging.
 * Leaving the modal — "Done", a tap outside, Android's back button — sets the hue across
 * the app; "Cancel" leaves it as it was. "Reset to default" moves the wheel back to the
 * default hue (applied on leaving, like any other).
 * Rendered by the settings only while open: each opening starts from the current hue.
 * Its own GestureHandlerRootView: a Modal is outside the app's (the wheel's gesture
 * wouldn't work on Android otherwise).
 *
 * @author Philip — user story 49 (theme color wheel)
 * @param {Props} props
 * @returns {JSX.Element}
 */
export default function SelecteurTheme({ teinteInitiale, onAppliquer, onAnnuler }: Props) {
    const { t } = useTranslation('settings')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const colorScheme = useColorScheme()
    const { width } = useWindowDimensions()

    const [teinte, setTeinte] = useState(teinteInitiale)
    // Room for the screen's and the card's margins.
    const tailleRoue = Math.min(TAILLE_ROUE_MAX, width - 96)

    const appliquer = () => onAppliquer(teinte)

    const s = StyleSheet.create({
        ecran: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
        // Dims the blurred settings (on Android the blur is only a tint).
        voile: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.background, opacity: 0.35 },
        carte: {
            width: '100%',
            maxWidth: 420,
            backgroundColor: colors.card,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            gap: 12,
        },
        titre: { color: colors.text, fontFamily: fonts.title, fontSize: 20, textAlign: 'center' },
        lien: { alignSelf: 'center', paddingVertical: 2 },
        texteLien: { color: colors.muted, fontFamily: fonts.body, fontSize: 15, textDecorationLine: 'underline' },
        boutons: { flexDirection: 'row', gap: 8 },
        bouton: {
            flex: 1,
            height: 46,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.secondary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        texteBouton: { color: colors.text, fontFamily: fonts.title, fontSize: 15 },
    })

    return (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={appliquer}>
            <GestureHandlerRootView style={{ flex: 1 }}>
                {/* The settings stay visible behind, blurred; a tap there leaves (applies). */}
                <Pressable style={StyleSheet.absoluteFill} onPress={appliquer} accessibilityRole="button" accessibilityLabel={t('themePicker.done')}>
                    <BlurView intensity={30} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                    <View style={s.voile} />
                </Pressable>
                <View style={s.ecran} pointerEvents="box-none">
                    <View style={s.carte}>
                        <Text style={s.titre}>{t('themePicker.title')}</Text>
                        <RoueTeinte teinte={teinte} onChange={setTeinte} taille={tailleRoue} />
                        <TouchableOpacity style={s.lien} onPress={() => setTeinte(DEFAULT_HUE)} accessibilityRole="button">
                            <Text style={s.texteLien}>{t('setDefault')}</Text>
                        </TouchableOpacity>
                        <ApercuTheme teinte={teinte} />
                        <View style={s.boutons}>
                            <TouchableOpacity style={[s.bouton, { borderColor: colors.border }]} onPress={onAnnuler} accessibilityRole="button">
                                <Text style={[s.texteBouton, { color: colors.muted }]}>{t('themePicker.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.bouton} onPress={appliquer} accessibilityRole="button">
                                <Text style={s.texteBouton}>{t('themePicker.done')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </GestureHandlerRootView>
        </Modal>
    )
}
