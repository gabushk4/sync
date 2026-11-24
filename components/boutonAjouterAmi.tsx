import Icon, { IoniconsIconName } from '@react-native-vector-icons/ionicons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native'

import ToastAbs from '@/abstractions/toastAbs'
import { toastTypes } from '@/constants/toastConfig'
import { useAPI } from '@/contextes/contexteAPI'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import catcher from '@/functions/catcher'

/** Where I stand with a member (GET /membres/:id, GET /conversations/:id) */
export type RelationAmitie = 'moi' | 'ami' | 'envoyee' | 'recue' | 'aucune'

type Props = {
    membreId: string
    relation: RelationAmitie
    /** public id of the request they sent me (relation 'recue'), to accept it */
    demandeId?: string | null
    /** small pill (a member's row) instead of a full-width button (a profile) */
    compact?: boolean
    /** after a request is sent or accepted */
    onRelationChange?: (relation: RelationAmitie) => void
}

/**
 * "Add friend" button for a member who isn't a friend yet: sends a friend request,
 * then shows "request sent". If they already sent me one, it accepts it instead.
 * Shows nothing for a friend or for myself.
 */
export default function BoutonAjouterAmi({ membreId, relation, demandeId, compact = false, onRelationChange }: Props) {
    const { t } = useTranslation('friends')
    const { api } = useAPI()
    const { colors } = usePalette()
    const { fonts } = useFont()
    // what changed here, until the screen reloads its own data
    const [relationLocale, setRelationLocale] = useState<RelationAmitie | null>(null)
    const [envoi, setEnvoi] = useState(false)
    const etat = relationLocale ?? relation

    if (etat === 'ami' || etat === 'moi') return null

    const changer = (nouvelle: RelationAmitie) => {
        setRelationLocale(nouvelle)
        onRelationChange?.(nouvelle)
    }

    const appuyer = async () => {
        if (envoi || etat === 'envoyee') return
        setEnvoi(true)
        try {
            if (etat === 'recue' && demandeId) {
                await api.patch(`/amis/demandes/${encodeURIComponent(demandeId)}`, { statut: 'acceptee' })
                changer('ami')
                ToastAbs.show({ type: toastTypes.success, text2: t('relation.accepted') })
            } else {
                await api.post('/amis/demandes', { id_destinataire: membreId })
                changer('envoyee')
                ToastAbs.show({ type: toastTypes.success, text2: t('relation.sentToast') })
            }
        } catch (error) {
            catcher(error, t('errors.requestFailed'))
        } finally {
            setEnvoi(false)
        }
    }

    const envoyee = etat === 'envoyee'
    const icone: IoniconsIconName = envoyee ? 'checkmark' : etat === 'recue' ? 'person-add' : 'person-add-outline'
    const libelle = envoyee
        ? t(compact ? 'relation.sentShort' : 'relation.sent')
        : etat === 'recue'
            ? t(compact ? 'relation.acceptShort' : 'relation.accept')
            : t(compact ? 'relation.addShort' : 'relation.add')
    const couleurTexte = envoyee ? colors.muted : 'white'

    return (
        <TouchableOpacity
            onPress={appuyer}
            disabled={envoi || envoyee}
            hitSlop={compact ? 8 : 0}
            accessibilityRole="button"
            accessibilityState={{ disabled: envoi || envoyee, busy: envoi }}
            accessibilityLabel={libelle}
            style={[
                compact ? s.pilule : s.large,
                envoyee
                    ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }
                    : { backgroundColor: colors.primary },
            ]}
        >
            {envoi
                ? <ActivityIndicator size="small" color={couleurTexte} />
                : <Icon name={icone} size={compact ? 14 : 18} color={couleurTexte} />}
            <Text style={{ color: couleurTexte, fontFamily: compact ? fonts.body : fonts.title, fontSize: compact ? 13 : 16 }}>
                {libelle}
            </Text>
        </TouchableOpacity>
    )
}

const s = StyleSheet.create({
    large: {
        alignSelf: 'stretch',
        height: 46,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    pilule: {
        height: 30,
        paddingHorizontal: 10,
        borderRadius: 15,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
})
