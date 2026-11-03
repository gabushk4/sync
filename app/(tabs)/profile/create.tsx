import { useRef } from "react";
import Icon from "@react-native-vector-icons/ionicons";

import { useActionFab } from "@/hooks/useActionFAB";
import { usePalette } from "@/contextes/contextePalette";

import CreationEvenement, { CreationHandle } from "@/components/creationEvenement";

/**
 * Event creation opened from a friend's profile (common free slots), in the profile
 * stack: going back (arrow, iOS swipe, Android back) returns straight to that profile.
 * Only the event page of the home tab's creation (no unavailability with a friend).
 *
 * @author Philip — rectification (user story 20)
 * @returns {JSX.Element}
 */
export default function CreateDepuisProfil() {
    const { colors } = usePalette()
    const evenementRef = useRef<CreationHandle>(null)

    useActionFab("eventCreate", {
        action: () => evenementRef.current?.envoyer(),
        config: {
            visible: true,
            icon: <Icon name="checkmark" color={colors.text} size={28} />
        }
    })

    return <CreationEvenement ref={evenementRef} />
}
