import Icon from "@react-native-vector-icons/ionicons";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ParamListBase } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

//hooks / contexts
import { usePalette } from "@/contextes/contextePalette";
import { useActionFab } from "@/hooks/useActionFAB";

//components
import CreationEvenement, { CreationHandle } from "@/components/creationEvenement";
import CreationIndisponibilite from "@/components/creationIndisponibilite";
import PagesGlissables from "@/components/pagesGlissables";
import { measureSpotlightEvents } from "@/events/mesureSpotlightEvents";

//constants
import { eventFormIds } from '@/constants/tutorial';

/** Pages of the screen, in order. */
const PAGES = ['evenement', 'indisponibilite'] as const

/**
 * Creation screen opened by the "+" (home and calendar) and by a range picked on a
 * free stretch of the timeline: the event page first, and a horizontal swipe (or its
 * tab) to the unavailability page, like the "add a friend" modal. Both pages get the
 * same `start` / `end` route params and share the event draft (same dates on both);
 * `page: 'indisponibilite'` opens on the second. The ✓ FAB sends the page shown,
 * and the header title follows it.
 *
 * @author Philip — user story 20: replaces the "what to add?" menu of the "+"
 * @returns {JSX.Element}
 */
export default function Create() {
    const { t } = useTranslation('events')
    const { colors } = usePalette()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

    const { page } = useLocalSearchParams<{ page?: string, depuis_dispo_commune?: string }>()
    const pageInitiale = Math.max(PAGES.indexOf(page as typeof PAGES[number]), 0)
    const [pageCourante, setPageCourante] = useState(pageInitiale)

    const evenementRef = useRef<CreationHandle>(null)
    const indisponibiliteRef = useRef<CreationHandle>(null)
    const refs = [evenementRef, indisponibiliteRef]

    // A distinct owner per page: changing page hands the FAB over to the new one.
    useActionFab(PAGES[pageCourante] === eventFormIds.events ? "eventCreate" : "unavailabilityCreate", {
        action: () => refs[pageCourante].current?.envoyer(),
        config: {
            visible: true,
            icon: <Icon name="checkmark" color={colors.text} size={28} />
        }
    })

    useEffect(() => {
        navigation.setOptions({
            headerTitle: t(PAGES[pageCourante] ===eventFormIds.events ? 'navigation.create' : 'navigation.unavailability')
        })
    }, [pageCourante, navigation, t])

    useEffect(() => navigation.addListener('transitionEnd', ({ data }) => {
        if (!data.closing) measureSpotlightEvents.emitMeasureSpotlight()
    }), [navigation])

    return (
        <PagesGlissables
            pageInitiale={pageInitiale}
            onChangerPage={setPageCourante}
            pages={[
                { id: eventFormIds.events, titre: t('creationPages.event'), contenu: <CreationEvenement ref={evenementRef} /> },
                {
                    id: eventFormIds.dnd,
                    titre: t('creationPages.unavailability'),
                    contenu: <CreationIndisponibilite ref={indisponibiliteRef} />,
                    conditionTutoriel: "onglet_indisponibilite_selectionne",
                },
            ]}
        />
    )
}
