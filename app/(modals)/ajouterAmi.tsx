import ModalBase from "@/components/modalBase";
import { useEffect, useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useMembre } from "@/contextes/contexteMembre";

import log from "@/functions/log";

import QRCodeAbs from "@/abstractions/QrCodeAbs";
import AddFriendForm from "@/components/addFriendForm";
import DemandeConfirmerCourriel from "@/components/demandeConfirmerCourriel";
import PagesGlissables from "@/components/pagesGlissables";
import { useLocalSearchParams } from "expo-router";


const PAGES_DEF = [
    {
        id: 'addFriend',
        titleKey: 'addFriend',
        page: <AddFriendForm/>
    },
    {
        id: 'qrCode',
        titleKey: 'qrCode',
        page: <QRCodeAbs/>
    }
]

const s = StyleSheet.create({
    page: {
        flex: 1,
        justifyContent: 'space-evenly',
        alignItems: 'center',
    },
})

/**
 * "Add a friend" modal: the friend request form and the member's QR code, side by
 * side, reached by a swipe or their tab. Opened on the QR code first with
 * `contexte: 'qrCode'`.
 *
 * @author Philip — user story 20 (review): the tabs + swipe are PagesGlissables, shared
 *   with the creation screen (event / unavailability), instead of a copy of their own
 * @returns {JSX.Element}
 */
export default function AjouterAmi() {
    const { t } = useTranslation('friends')
    const { membre, getMembre } = useMembre();

    const { contexte } = useLocalSearchParams()

    // The QR code first when opened for it (a reversed copy: PAGES_DEF stays as is).
    const pages = useMemo(
        () => (contexte === 'qrCode' ? [...PAGES_DEF].reverse() : PAGES_DEF).map((p) => ({
            id: p.id,
            titre: t(`tabs.${p.titleKey}`),
            contenu: <View style={s.page}>{p.page}</View>,
        })),
        [contexte, t]
    )

    useEffect(() => {
        log('email confirme', membre.emailConfirme);
        if (!membre.emailConfirme)
            getMembre()
    }, [membre.emailConfirme, getMembre]);

    return membre.emailConfirme ? (
        <ModalBase>
            <View style={{ flex: 1, gap: 4 }}>
                <PagesGlissables key={String(contexte)} integre pages={pages} />
            </View>
        </ModalBase>
    ) : (
        <ModalBase>
            <DemandeConfirmerCourriel intro={t('emailConfirmation.friendRequestsIntro')} />
        </ModalBase>
    );
}
