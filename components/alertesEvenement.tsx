import Icon from '@react-native-vector-icons/ionicons'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'

import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import { MomentAlerte } from '@/types/calendar'
import Spinner from './spinner'

export type { MomentAlerte } from '@/types/calendar'

type Props = {
    moments: MomentAlerte[]
    mode: 'edition' | 'details'
    editable?: boolean
    onChange: (moments: MomentAlerte[]) => void | boolean | Promise<void | boolean>
}

const CHOIX: MomentAlerte[] = ['debut', 'fin']

export default function AlertesEvenement({ moments, mode, editable = true, onChange }: Props) {
    const { t } = useTranslation('events')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const [choixOuverts, setChoixOuverts] = useState(mode === 'edition')
    const [enCours, setEnCours] = useState(false)

    const changer = async (moment: MomentAlerte) => {
        if (!editable || enCours) return
        const actifs = moments.includes(moment)
            ? moments.filter((m) => m !== moment)
            : [...moments, moment]
        if (actifs.length > 2) return
        setEnCours(true)
        try {
            const enregistre = await onChange(actifs)
            if (enregistre === false) return
            if (mode === 'details') setChoixOuverts(false)
        } finally {
            setEnCours(false)
        }
    }

    const boutonMoment = (moment: MomentAlerte) => {
        const actif = moments.includes(moment)
        return (
            <TouchableOpacity
                key={moment}
                onPress={() => void changer(moment)}
                disabled={enCours}
                accessibilityRole="button"
                accessibilityState={{ selected: actif, disabled: enCours }}
                style={{borderWidth:1, borderColor:colors.border, marginVertical:4, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderRadius: 10, backgroundColor: actif ? colors.primary : 'transparent' }}
            >
                <Icon name={moment === 'debut' ? 'play-circle-outline' : 'flag-outline'} size={20} color={colors.secondary} />
                <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 15 }}>{t(`reminders.${moment}`)}</Text>
                {actif && <Icon name="checkmark-circle" size={20} color={colors.secondary} />}
            </TouchableOpacity>
        )
    }

    return (
        <View style={{ width: '100%', padding: 12, gap: 4, borderRadius: 16, backgroundColor: colors.card }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingBottom: 4 }}>
                <Icon name="notifications-outline" size={22} color={colors.secondary} />
                <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.title, fontSize: 17 }}>{t('reminders.title')}</Text>
            </View>
            {mode === 'details' && moments.map((moment) => (
                <View key={moment} style={{ minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 }}>
                    <Icon name={moment === 'debut' ? 'play-circle-outline' : 'flag-outline'} size={20} color={colors.secondary} />
                    <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 15 }}>{t(`reminders.${moment}`)}</Text>
                </View>
            ))}
            {moments.length === 0 && mode === 'details' && (
                <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 14, paddingHorizontal: 8, paddingVertical: 4 }}>{t('reminders.none')}</Text>
            )}
            {editable && moments.length < 2 && mode === 'details' && !choixOuverts && (
                <TouchableOpacity onPress={() => setChoixOuverts(true)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 }} accessibilityRole="button">
                    <Icon name="add-circle-outline" size={22} color={colors.secondary} />
                    <Text style={{ color: colors.secondary, fontFamily: fonts.body, fontSize: 15 }}>{t('reminders.add')}</Text>
                </TouchableOpacity>
            )}
            {editable && (mode === 'edition' || (moments.length < 2 && choixOuverts)) && (
                <View>
                    {(mode === 'edition' ? CHOIX : CHOIX.filter((moment) => !moments.includes(moment))).map(boutonMoment)}
                    {mode === 'details' && <TouchableOpacity onPress={() => setChoixOuverts(false)} style={{ minHeight: 38, justifyContent: 'center', paddingHorizontal: 10 }}><Text style={{ color: colors.muted, fontFamily: fonts.body }}>{t('reminders.cancel')}</Text></TouchableOpacity>}
                </View>
            )}
            {enCours && <Spinner style={{position: 'absolute', left: '48%', top:'48%'}}/>}
        </View>
    )
}
