import Radius from '@/constants/Radius';
import { useAPI } from '@/contextes/contexteAPI';
import { useMembre } from '@/contextes/contexteMembre';
import { usePalette } from '@/contextes/contextePalette';
import catcher from '@/functions/catcher';
import log from '@/functions/log';
import { Participant } from '@/types/invites';
import { useEffect, useState, } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import { iconeStatutInvitation } from './legendeStatutsInvitation';
import ProfilPic from './pfp';

type Props = {
    participant: Participant;
    height: number;
    peutGererParticipants?: boolean;
    /** Already in the event (saved before this edit), not just added in the form. */
    existant?: boolean;
    /** Picked in the form, invited with its ✓: no invitation yet, so no status icon. */
    aInviter?: boolean;
    onRetirer?: (participant: Participant) => void;
}

/**
 * One participant in an event's participant list: editor badge, profile
 * picture, pseudo, their answer to the invitation (EN ATTENTE / ACCEPTÉ /
 * REFUSÉ — user story 9) and, when allowed, a button to remove them.
 * SUBJECT TO CHANGE: may be revised depending on how teammates implement their own user stories.
 *
 * @author Philip — the X no longer removes on the server: it only changes the form, saved
 *   with its ✓. A participant already in the event asks for a confirmation first; one just
 *   added in the form (no invitation sent yet) goes away at once.
 * @param {Props} props
 * @param {Participant} props.participant - Participant to show (fetched if pseudo/picture are missing).
 * @param {number} props.height - Row height.
 * @param {boolean} [props.peutGererParticipants=false] - Shows the remove button (Nathan: remove a participant).
 * @param {boolean} [props.existant=false] - Already in the event: the X asks for a confirmation.
 * @param {boolean} [props.aInviter=false] - Picked in the form, not invited yet: no status icon.
 * @param {(participant: Participant) => void} [props.onRetirer] - Removes them from the form.
 * @returns {JSX.Element | null}
 */
export default function ParticipantLigne({participant, height, peutGererParticipants = false, existant = false, aInviter = false, onRetirer} : Props){
    const { t } = useTranslation('events')
    const { colors } = usePalette()
    const colorScheme = useColorScheme()
    const {api} = useAPI()
    const {membre} = useMembre()

    const icone = {
        admin: colorScheme === "dark" ? require('@/assets/icones/admin-dark-icon.png'):require('@/assets/icones/admin-light-icon.png'),
        fpDef: colorScheme === "dark" ? require('@/assets/icones/profil-dark-icon.png'):require('@/assets/icones/profil-light-icon.png'),
        croix:colorScheme === "dark" ? require('@/assets/icones/croix-dark-icon.png'):require('@/assets/icones/croix-light-icon.png')
    }

    // Fetched pseudo / picture, when the participant came without them
    const [participantCharge, setParticipantCharge] = useState<Participant>()
    // The participant shown: as given when it has its pseudo, the fetched one otherwise,
    // nothing without a public id. Derived during the render (it used to be copied into
    // a state by an effect, which drew the row once more for nothing).
    const p = !participant.id ? undefined : participant.pseudo ? participant : participantCharge

    /**
     * The X: a participant already in the event is only removed once confirmed (cancel:
     * nothing changes); one just added in the form goes away at once (the member changed
     * their mind, nothing was sent).
     *
     * @returns {void}
     */
    const retirer = () => {
        if (!p) return
        if (!existant) {
            onRetirer?.(p)
            return
        }
        Alert.alert(
            t('participantRemoval.confirmTitle'),
            t('participantRemoval.confirmMessage', { pseudo: p.pseudo }),
            [
                { text: t('participantRemoval.cancel'), style: 'cancel' },
                { text: t('participantRemoval.remove'), style: 'destructive', onPress: () => onRetirer?.(p) },
            ]
        )
    }

    /**
     * Fetches the participant's pseudo and picture from GET /membres/:id when they're
     * missing (the state is only set once the answer is there).
     */
    useEffect(()=>{
        const {fp_url, pseudo} = participant
        if (!participant.id) {
            log('participant sans identifiant public, chargement ignoré', pseudo)
            return
        }
        if (pseudo) return
        let annule = false
        api.get(`membres/${participant.id}`)
            .then((response) => {
                if (annule) return
                const fetchedParticipant: Participant = {
                    ...participant,
                    id: response.data.id_publique ?? participant.id,
                    pseudo: response.data.pseudo,
                    fp_url: response.data.fp_url ?? fp_url ?? null,
                }
                log("fetched participant:", fetchedParticipant)
                setParticipantCharge(fetchedParticipant)
            })
            .catch((error) => {
                if (annule) return
                catcher(error, t('errors.participantLoadFailed', { id: participant.id }))
                setParticipantCharge(undefined)
            })
        return () => { annule = true }
    }, [])

    const peutSupprimer = p ? (peutGererParticipants && p.id !== membre.idPublique) : false

    const s = StyleSheet.create({
        conteneur:{
            marginTop:-1,
            width:'90%',
            paddingVertical:4,
            alignSelf: 'center',
            height: height
        },
        photo:{
            borderRadius: 100,
            overflow: 'hidden',
        },
        pseudo:{
            fontSize: 20,
            flexShrink: 1,
        },
        status: {
            minWidth:"10%",
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
        },
        statutTexte: {
            fontSize: 10,
            fontWeight: 'bold',
            letterSpacing: 0.5,
        },
        userInfo: {
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
            gap: 8,
            minWidth: 0,
        },
        centralPanel: {
            flex: 3,
            flexDirection: 'row',
            alignItems: 'center',
            height: '100%',
            gap: 8,
        },
        leftIcon: {
            flex: 0,
            width: 32,
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
        },
        rightAction: {
            flex: 0,
            width: 32,
            height: '100%',
            alignItems: 'flex-end',
            justifyContent: 'center',
        },
        button: {
            height: '100%',
            width: '100%',
            flexDirection: 'row',
            padding: 8,
            alignItems: 'center',
            justifyContent: 'space-between',     
            borderWidth:1,
            borderColor: colors.border,
            borderRadius: Radius.xl,
        }
    })

    if(!p) return null

    return(
        <View style={s.conteneur}>
            <TouchableOpacity style={s.button}>
                <View style={s.leftIcon}>
                    {participant.privilege === 'editeur' && (
                        <Image
                            style={[s.photo, {height:'100%', width:'100%'}]}
                            source={icone.admin}
                            resizeMode='contain'
                        />
                    )}
                </View>
                <View style={s.centralPanel}>
                    <View style={s.userInfo}>
                        <ProfilPic
                            pfp={participant.fp_url}
                            size={32}
                            style={s.photo}
                        />
                        <Text
                            style={[s.pseudo, { color: colors.text }]}
                            numberOfLines={1}
                            ellipsizeMode='tail'
                        >
                            {p.pseudo ?? 'pseudo'}
                        </Text>
                    </View>
                    {/* User story 9: each participant's answer to the invitation, as an
                        icon + label (PENDING / ACCEPTED / DECLINED). */}
                    <View style={s.status}>
                        {p.statut && !aInviter && (
                            <Image
                                source={iconeStatutInvitation(p.statut, colorScheme)}
                                style={{height:18, width:18}}
                                resizeMode='contain'
                            />
                        )}
                    </View>
                </View>

                <View style={s.rightAction}>
                    {peutSupprimer && (
                        <TouchableOpacity
                            onPress={retirer}
                            accessibilityRole="button"
                            accessibilityLabel={t('participantRemoval.remove')}
                        >
                            <Image
                                source={icone.croix}
                                style={{transform:[{rotate:'45deg'}], height:24, width:24}}
                                resizeMode='contain'
                            />
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
        </View>
    )
}

