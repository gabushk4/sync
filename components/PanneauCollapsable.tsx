/**
 * Panneau repliable réutilisable.
 *
 * Affiche un en-tête cliquable (titre + chevron) qui bascule l'affichage du contenu.
 * Utile pour grouper des blocs d'informations dans un écran déjà long (ex: métriques admin).
 */
import React, { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Icon from '@react-native-vector-icons/ionicons'

import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'

type Props = {
    /** Titre affiché dans l'en-tête cliquable. */
    titre: string
    /** Contenu affiché quand le panneau est ouvert. */
    children: React.ReactNode
    /** État initial ouvert ou fermé. Par défaut fermé. */
    ouvertParDefaut?: boolean
    /** Sous-titre optionnel affiché à droite du titre dans l'en-tête. */
    sousTitre?: string
    /** Appelé quand le panneau passe à l'état ouvert (utile pour du chargement paresseux). */
    onOuvert?: () => void
}

export default function PanneauCollapsable({ titre, children, ouvertParDefaut = false, sousTitre, onOuvert }: Props) {
    const { colors } = usePalette()
    const { fonts } = useFont()
    const [ouvert, setOuvert] = useState<boolean>(ouvertParDefaut)

    const s = StyleSheet.create({
        racine: { marginHorizontal: 16, marginBottom: 10, borderRadius: 12, backgroundColor: colors.card, overflow: 'hidden' },
        entete: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 14,
            
        },
        rangTitre: { flexDirection: 'row', alignItems: 'center', flex: 1,},
        titre: { color: colors.text, fontFamily: fonts.title, fontSize: 15 },
        sousTitre: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginLeft: 8 },
        chevron: { color: colors.muted },
        contenu: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,  paddingHorizontal: 14, paddingBottom: 14 },
    })

    return (
        <View style={s.racine}>
            <TouchableOpacity
                onPress={() => {
                    setOuvert((o) => {
                        const prochaine = !o
                        if (prochaine) void onOuvert?.()
                        return prochaine
                    })
                }}
                accessibilityRole="button"
                accessibilityLabel={titre}
                style={s.entete}
            >
                <View style={s.rangTitre}>
                    <Text style={s.titre}>{titre}</Text>
                    {sousTitre && <Text style={s.sousTitre}>{sousTitre}</Text>}
                </View>
                <Icon name={ouvert ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
            </TouchableOpacity>
            {ouvert && <View style={s.contenu}>{children}</View>}
        </View>
    )
}
