import { useCallback } from 'react'
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'

import { usePalette } from '@/contextes/contextePalette'
import { useFont } from '@/contextes/contexteFont'
import { useConversations } from '@/contextes/contexteConversations'
import { useRouteAbs } from '@/contextes/contexteRoute'
import { useNavFab } from '@/hooks/useNavFAB'
import Icon from '@react-native-vector-icons/ionicons'

import ConversationItem from '@/components/conversationItem'
import NotificationItem from '@/components/notificationItem'
import { Notification, useNotifications } from '@/contextes/contexteNotifications'
import { useTranslation } from 'react-i18next'
import { Conversation } from '@/types/messaging'
import catcher from '@/functions/catcher'

/**
 * Story #1 (Isma) : "En tant que membre, j'aimerais pouvoir envoyer un
 * message à un ami afin de maintenir le contact."
 *
 * Affiche la liste des conversations,
 * rafraîchie périodiquement en arrière-plan par ConversationsProvider
 * (rafraichissement partiel — voir contexteConversations.tsx / AutoRefresh).
 *
 * Nathan (friend request notification): pending friend requests are shown above
 * the conversations, so they can be answered from the Messages tab too.
 */

export default function Inbox(){
    const {colors} = usePalette()
    const {fonts} = useFont()
    const router = useRouter()
    const {ajouterEcran} = useRouteAbs()

    const {conversations, rafraichirConversations, effacerConversation} = useConversations()
    const { t } = useTranslation('inbox')
    const { notifications } = useNotifications()

    const demandesEnAttente = notifications.filter((notification) =>
        notification.type === 'demande_ami' && notification.statut_metier === 'en_attente'
    )

    // each time the tab gets the focus (only then: ajouterEcran isn't guaranteed stable)
    useFocusEffect(useCallback(()=> {
        ajouterEcran('inbox')
        rafraichirConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []))

    // le bouton "+" au centre de la barre d'onglets ouvre la liste d'amis pour écrire à quelqu'un
    useNavFab("inbox", {
        visible: true,
        href: '/(modals)/listeAmis',
        params: { type: 'message' },
        // a chat bubble with a + inside: "new message"
        icon: (
            <View style={styles.iconeNouveauMessage}>
                <Icon name="chatbubble-outline" size={30} color={colors.text} />
                <Icon name="add" size={18} color={colors.text} style={styles.plusDansBulle} />
            </View>
        ),
    })

    // Erased on my side only, after a confirmation: the others keep it, and it comes back
    // (without its history) at the next message
    const supprimer = (conversation: Conversation) => {
        Alert.alert(t('delete.title'), t('delete.message', { nom: conversation.ami.pseudo }), [
            { text: t('delete.cancel'), style: 'cancel' },
            {
                text: t('delete.confirm'),
                style: 'destructive',
                onPress: () => {
                    effacerConversation(conversation.id).catch((error) => catcher(error, t('delete.failed')))
                },
            },
        ])
    }

    const ouvrir = (conversation: Conversation) => {
        router.navigate({pathname:'/(tabs)/inbox/[conversationId]', params:{conversationId: conversation.id}})
    }

    return (
        // (the stack's header now takes care of the top of the screen)
        <View style={[styles.conteneur,{backgroundColor: colors.background}]}>
            <FlatList
                data={conversations}
                keyExtractor={(item) => item.id}
                renderItem={({item}) => <ConversationItem conversation={item} onPress={ouvrir} onSupprimer={supprimer}/>}
                refreshControl={<RefreshControl refreshing={false} onRefresh={rafraichirConversations} />}
                contentContainerStyle={{ flexGrow: 1 }}
                ListHeaderComponent={demandesEnAttente.length > 0 ? (
                    <View style={styles.demandes}>
                        <Text style={{ color: colors.text, fontFamily: fonts.title, fontSize: 20, marginBottom: 8 }}>
                            {t('requests.title')}
                        </Text>
                        {demandesEnAttente.map((demande: Notification, index: number) => (
                            <NotificationItem key={demande.id} item={demande} index={index} vu={demande.statut_notification} />
                        ))}
                    </View>
                ) : undefined}
                ListEmptyComponent={
                    <View style={styles.vide}>
                        <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 15, textAlign: 'center' }}>
                            {t('list.empty')}
                        </Text>
                    </View>
                }
            />
        </View>
    )
}


const styles = StyleSheet.create({
    iconeNouveauMessage: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
    // centred in the round part of the bubble (its tail is at the bottom)
    plusDansBulle: { position: 'absolute', top: 5 },
    conteneur: {flex:1},
    vide:{ paddingTop: 96, paddingHorizontal:32},
    demandes:{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
})
