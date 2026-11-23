import { useConversations } from "@/contextes/contexteConversations"
import { useInvites } from "@/contextes/contexteInvites"
import { Participant } from "@/types/invites"
import { router } from "expo-router"


export type FriendListType = 'select' | 'consult' | 'message'

// le modal de la liste d'amis prend ~300 ms à se fermer (voir modalBase)
const DELAI_FERMETURE_MODAL_MS = 350
const attendre = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function useFriendList(type: 'select'): (friends: Participant | Participant[]) => void
export function useFriendList(type: 'consult'): (friend: Participant) => void
export function useFriendList(type: 'message'): (friend: Participant) => Promise<void>
export function useFriendList(type: FriendListType) {
    const {ajouterInvite} = useInvites()
    const {demarrerConversationAvecAmi} = useConversations()

    switch (type) {
        // Added to the form's pending invitations only: sent with its ✓ (Philip).
        case 'select':
            return (friends: Participant | Participant[]) => ajouterInvite(friends)
        case 'consult':
            return (friend: Participant) => router.navigate({ pathname: '/(tabs)/profile/[membreId]', params: { membreId: friend.id } })
        case 'message':
            return async (friend: Participant) => {
                // créer/retrouver la conversation pendant que le modal se ferme
                const [conversationId] = await Promise.all([
                    demarrerConversationAvecAmi(friend.id),
                    attendre(DELAI_FERMETURE_MODAL_MS),
                ])
                if (conversationId) {
                    router.navigate({ pathname: '/(tabs)/inbox/[conversationId]', params: { conversationId } })
                }
            }
    }
}
