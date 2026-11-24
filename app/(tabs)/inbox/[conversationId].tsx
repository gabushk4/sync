import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Dimensions, FlatList, Keyboard, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { useAnimatedKeyboard, useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import { router, Stack, useFocusEffect, useLocalSearchParams, useSegments } from 'expo-router'
import { useTranslation } from 'react-i18next'
import Icon from '@react-native-vector-icons/ionicons'

import { usePalette } from '@/contextes/contextePalette'
import { useFont } from '@/contextes/contexteFont'
import { useConversations } from '@/contextes/contexteConversations'
import { useMembre } from '@/contextes/contexteMembre'

import MessageBubble from '@/components/messageBubble'
import ProfilPic from '@/components/pfp'
import MessageInput from '@/components/messageInput'
import LigneVus from '@/components/ligneVus'
import { Vu } from '@/types/messaging'
import catcher from '@/functions/catcher'

export default function Conversation(){
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { t } = useTranslation('inbox')
    // titre: sent when opened from an event's details (story #21), before the list has it
    const {conversationId, titre } = useLocalSearchParams<{conversationId: string, titre?: string}>()

    const { membre } = useMembre()
    const {messages,vus,conversations,messagesChargesPour,ouvrirConversation,fermerConversation,envoyerMessage} = useConversations()
    // Newest first for the inverted list: it opens at the bottom, with no scroll to animate.
    // Only this conversation's (the previous one's are kept until the new ones arrive).
    const donnees = useMemo(
        () => messages.filter((m) => m.conversationId === conversationId).reverse(),
        [messages, conversationId]
    )
    const charge = messagesChargesPour === conversationId

    const conversation = conversations.find((c) => c.id === conversationId)

    // Group conversation: more than one other member, a title or a linked event. Opened from
    // an event before the list has it, the title param is enough to know it's a group.
    const estGroupe = conversation
        ? (conversation.participants?.length ?? 0) > 1 || !!conversation.titre || !!conversation.evenementId
        : !!titre

    // Tapping the title, in the same stack (this screen is in the inbox stack, or in the
    // home one when opened from an event):
    // the conversation's info, like Messenger: a group's (members, event...) or a one-to-one
    // chat's (the friend's profile, the photos, delete on my side)
    const dansAccueil = (useSegments() as string[]).includes('home')
    const ouvrirInfos = useCallback(() => {
        if (!conversationId) return
        router.push({
            pathname: dansAccueil ? '/(tabs)/home/conversation/infos/[conversationId]' : '/(tabs)/inbox/infos/[conversationId]',
            params: { conversationId },
        } as any)
    }, [conversationId, dansAccueil])
    const titreAffiche = conversation?.ami.pseudo ?? titre ?? ''
    const photoEntete = conversation?.ami.fp_url

    // Tappable header (like Messenger): photo and name with a chevron, opens the
    // conversation's info. Same object between renders, so the header isn't redone on
    // every new message (a new options object made the navigator update the header).
    const optionsEcran = useMemo(() => ({
        headerTitle: () => (
            <TouchableOpacity
                onPress={ouvrirInfos}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('infos.open', { nom: titreAffiche })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 240 }}
            >
                <ProfilPic size={32} pfp={photoEntete} />
                <View style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={{ flexShrink: 1, color: colors.text, fontFamily: fonts.title, fontSize: 16 }} numberOfLines={1}>
                        {titreAffiche}
                    </Text>
                    <Icon name="chevron-forward" size={14} color={colors.muted} />
                </View>
            </TouchableOpacity>
        ),
    }), [ouvrirInfos, t, titreAffiche, photoEntete, colors.text, colors.muted, fonts.title])

    // Tapping someone's avatar in a group opens their profile, in the same stack
    const ouvrirProfil = (membreId: string) => {
        router.push({
            pathname: dansAccueil ? '/(tabs)/home/profil/[membreId]' : '/(tabs)/inbox/profil/[membreId]',
            params: { membreId },
        } as any)
    }

    const listeRef = useRef<FlatList>(null)
    const conteneurRef = useRef<View>(null)

    // The input follows the keyboard frame by frame (on the UI thread), opening and
    // closing, including when it's dragged down. It used to wait for the keyboard
    // events and a measure, then jump with a separate animation.
    // Only the part of the keyboard over this screen pushes it up: the tab bar and the
    // bottom of the phone are already under the screen (distanceBas).
    const clavier = useAnimatedKeyboard()
    const distanceBas = useSharedValue(0)
    const mesurerBas = useCallback(() => {
        conteneurRef.current?.measureInWindow((_x, y, _largeur, hauteur) => {
            distanceBas.set(Math.max(0, Dimensions.get('window').height - (y + hauteur)))
        })
    }, [distanceBas])
    const styleClavier = useAnimatedStyle(() => ({
        paddingBottom: Math.max(0, clavier.height.get() - distanceBas.get()),
    }))

    // useCallback avec conversationId : si on passe d'une conversation à une autre,
    // l'effet se relance avec le bon id (useRef(...).current gardait le premier)
    useFocusEffect(
        useCallback(() => {
            if (conversationId) ouvrirConversation(conversationId)
            return () => fermerConversation()
        }, [conversationId, ouvrirConversation, fermerConversation])
    )

    // A new message (sent or received): back to the newest one
    useEffect(() => {
        if (donnees.length > 0) {
            requestAnimationFrame(() => listeRef.current?.scrollToOffset({ offset: 0, animated: true }))
        }
    }, [donnees.length])

    const envoyerTexte = async (texte: string) => {
        if(!conversationId) return
        try {
            await envoyerMessage(conversationId, {type: 'texte', contenu: texte})
        } catch (error) {
            catcher(error,"erreur d'envoi")
            throw error // MessageInput remet le texte dans le champ
        }
    }
    const envoyerVocal = async (uri:string,dureeSecondes:number) =>{
        if(!conversationId) return
        try{
            await envoyerMessage(conversationId, {type: 'vocal', uri, dureeSecondes})
        } catch (error) {
            catcher(error,"erreur d'envoi du message vocal")
        }
    }
    const envoyerImages = async (photos: { uri: string, mimeType?: string, nomFichier?: string }[]) => {
        if (!conversationId) return
        try {
            await envoyerMessage(conversationId, { type: 'image', photos })
        } catch (error) {
            catcher(error, t('photo.sendFailed'))
            throw error // MessageInput keeps the photos not sent yet
        }
    }

    // Group conversations: who has seen up to each message (avatars under it, like
    // Messenger). Not under their own message: they obviously saw it.
    const lecteursParMessage = useMemo(() => {
        const parMessage = new Map<string, Vu[]>()
        if (!estGroupe) return parMessage
        for (const vu of vus) {
            if (!vu.messageId) continue
            parMessage.set(vu.messageId, [...(parMessage.get(vu.messageId) ?? []), vu])
        }
        return parMessage
    }, [vus, estGroupe])

    return (
        <Animated.View
            ref={conteneurRef}
            onLayout={mesurerBas}
            style={[styles.conteneur, { backgroundColor: colors.background }, styleClavier]}
        >
            <Stack.Screen options={optionsEcran} />
            {/* tapping outside the input closes the keyboard */}
            <Pressable style={styles.conteneur} onPress={Keyboard.dismiss} accessible={false}>
            <FlatList
                ref={listeRef}
                data={donnees}
                // newest at the bottom without scrolling: the chat opens already at its end
                inverted
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingVertical: 12, flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                // drag the messages down to close the keyboard (iOS: it follows the finger)
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                renderItem={({ item, index }) => {
                    const lecteurs = (lecteursParMessage.get(item.id) ?? []).filter((l) => l.membreId !== item.auteurId)
                    return (
                        <>
                            <MessageBubble
                                message={item}
                                estDeMoi={item.auteurId === membre.idPublique}
                                groupe={estGroupe}
                                // avatar and pseudo only on the last message of a run from the same person
                                // (inverted list: the next, newer message is the one before)
                                afficherAuteur={donnees[index - 1]?.auteurId !== item.auteurId}
                                onPressAuteur={() => ouvrirProfil(item.auteurId)}
                            />
                            {lecteurs.length > 0 && <LigneVus lecteurs={lecteurs} />}
                        </>
                    )
                }}
                // nothing while loading (it used to flash "write the first message");
                // flipped back since the list is inverted
                ListEmptyComponent={charge ? (
                    <View style={[styles.vide, styles.retourne]}>
                        <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 15 }}>
                            Écris le premier message.
                        </Text>
                    </View>
                ) : null}
            />
            </Pressable>

            {/* pas de marge en bas : la barre d'onglets tient déjà compte du bas de l'écran */}
            <MessageInput onEnvoyerTexte={envoyerTexte} onEnvoyerVocal={envoyerVocal} onEnvoyerImages={envoyerImages} />
        </Animated.View>

    )
}


const styles = StyleSheet.create({
    conteneur: {flex: 1},
    vide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    retourne: { transform: [{ scaleY: -1 }] },
})
