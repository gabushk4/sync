import { useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from 'react-native';
import Icon from "@react-native-vector-icons/ionicons";

import { useActionFab } from "@/hooks/useActionFAB";
import { usePalette } from "@/contextes/contextePalette";

import CreationEvenement, { CreationHandle } from "@/components/creationEvenement";
import CreationIndisponibilite from "@/components/creationIndisponibilite";
import PagesGlissables from "@/components/pagesGlissables";

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
    const navigation = useNavigation()

    const { page } = useLocalSearchParams<{ page?: string }>()
    const pageInitiale = Math.max(PAGES.indexOf(page as typeof PAGES[number]), 0)
    const [pageCourante, setPageCourante] = useState(pageInitiale)

    const evenementRef = useRef<CreationHandle>(null)
    const indisponibiliteRef = useRef<CreationHandle>(null)
    const refs = [evenementRef, indisponibiliteRef]

    // A distinct owner per page: changing page hands the FAB over to the new one.
    useActionFab(PAGES[pageCourante] === 'evenement' ? "eventCreate" : "unavailabilityCreate", {
        action: () => refs[pageCourante].current?.envoyer(),
        config: {
            visible: true,
            icon: <Icon name="checkmark" color={colors.text} size={28} />
        }
    })

    useEffect(() => {
        navigation.setOptions({
            headerTitle: t(PAGES[pageCourante] === 'evenement' ? 'navigation.create' : 'navigation.unavailability')
        })
    }, [pageCourante, navigation, t])

    return (
        <PagesGlissables
            pageInitiale={pageInitiale}
            onChangerPage={setPageCourante}
            pages={[
                { id: 'evenement', titre: t('creationPages.event'), contenu: <CreationEvenement ref={evenementRef} /> },
                { id: 'indisponibilite', titre: t('creationPages.unavailability'), contenu: <CreationIndisponibilite ref={indisponibiliteRef} /> },
            ]}
        />
    )
}
