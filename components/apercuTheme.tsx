import Ionicons from '@react-native-vector-icons/ionicons'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, useColorScheme, View } from 'react-native'

import { useFont } from '@/contextes/contexteFont'
import { generateTheme } from '@/themes/generateTheme'

type Props = {
    /** Hue (0-359) to preview. */
    teinte: number
}

/**
 * A small mock screen in the theme a hue would give (generateTheme, in the device's
 * light / dark mode, like the app): the background, an event card with its title, time,
 * a status and a button — what the app would look like before applying it.
 *
 * @author Philip — user story 49 (theme color wheel: preview)
 * @param {Props} props
 * @returns {JSX.Element}
 */
export default function ApercuTheme({ teinte }: Props) {
    const { t } = useTranslation('settings')
    const { fonts } = useFont()
    const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
    const c = generateTheme(teinte, scheme)

    const s = StyleSheet.create({
        ecran: {
            backgroundColor: c.background,
            borderRadius: 16,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: c.border,
            padding: 12,
            gap: 8,
        },
        entete: { color: c.muted, fontFamily: fonts.title, fontSize: 13, textTransform: 'uppercase' },
        carte: {
            backgroundColor: c.card,
            borderRadius: 12,
            padding: 12,
            gap: 4,
        },
        titre: { color: c.text, fontFamily: fonts.title, fontSize: 16 },
        heure: { color: c.muted, fontFamily: fonts.body, fontSize: 13 },
        rangee: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
        statut: {
            backgroundColor: c.primary,
            borderRadius: 100,
            paddingVertical: 4,
            paddingHorizontal: 10,
        },
        texteStatut: { color: c.text, fontFamily: fonts.body, fontSize: 12 },
        bouton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            borderWidth: 1,
            borderColor: c.secondary,
            borderRadius: 8,
            paddingVertical: 4,
            paddingHorizontal: 10,
        },
        texteBouton: { color: c.text, fontFamily: fonts.title, fontSize: 12 },
    })

    return (
        <View style={s.ecran} accessibilityLabel={t('themePicker.preview')}>
            <Text style={s.entete}>{t('themePicker.preview')}</Text>
            <View style={s.carte}>
                <Text style={s.titre} numberOfLines={1}>{t('themePicker.sampleTitle')}</Text>
                <Text style={s.heure} numberOfLines={1}>{t('themePicker.sampleTime')}</Text>
                <View style={s.rangee}>
                    <View style={s.statut}>
                        <Text style={s.texteStatut}>{t('themePicker.sampleStatus')}</Text>
                    </View>
                    <View style={s.bouton}>
                        <Ionicons name="pencil" size={12} color={c.text} />
                        <Text style={s.texteBouton}>{t('themePicker.sampleButton')}</Text>
                    </View>
                </View>
            </View>
        </View>
    )
}
