import ExternalCalendarForm from '@/components/ExternalCalendarForm';
import { useAPI } from '@/contextes/contexteAPI';
import catcher from '@/functions/catcher';
import {
    type CalendrierGoogle,
    chargerCalendriersGoogle,
    chargerComptesGoogle,
    chargerConfigGoogle,
    connecterCompteGoogle,
    deconnecterCompteGoogle,
    modifierCalendriersGoogle,
    resynchroniserCalendrierGoogle,
    selectionnerCalendriersGoogle,
} from '@/functions/googleAgenda';
import { demanderCodeGoogle } from '@/functions/googleOAuth';
import { useAgendaImport } from '@/hooks/useAgendaImport';
import { JSX } from 'react';
import { Platform } from 'react-native';

/** Écran de gestion du compte et des calendriers Google. */
export default function GoogleAgendaScreen(): JSX.Element {
    const { api } = useAPI();
    const agenda = useAgendaImport({
        api,
        prefixe: 'google',
        chargerComptesEtCalendriers: async () => {
            const [comptes, reponse] = await Promise.all([
                chargerComptesGoogle(api),
                chargerCalendriersGoogle(api),
            ]);
            return { comptes, calendriers: reponse.calendriers };
        },
        selectionner: ids => selectionnerCalendriersGoogle(api, ids),
        relancerImport: id => resynchroniserCalendrierGoogle(api, id),
        deconnecterCompte: id => deconnecterCompteGoogle(api, id),
        obtenirCode: async () => {
            const platform = Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web'
                ? Platform.OS
                : undefined;
            const config = await chargerConfigGoogle(api, platform);
            const code = await demanderCodeGoogle(config);
            return code ? { ...code, client_id: config.client_id } : null;
        },
        connecterCompte: (instance, code, { codeVerifier, clientId }) =>
            connecterCompteGoogle(instance, code, codeVerifier, clientId),
    });

    const enregistrerPreferences = async (
        calendrier: CalendrierGoogle,
        modifications: Partial<CalendrierGoogle>,
    ) => {
        if (!calendrier.id_publique) return;
        agenda.mettreAJourCalendrier(calendrier.id_publique, modifications);
        try {
            await modifierCalendriersGoogle(api, calendrier.id_publique, modifications);
        } catch (error) {
            catcher(error, 'Impossible de modifier le calendrier.');
            throw error;
        }
    };

    return (
        <ExternalCalendarForm
            fournisseur="google"
            {...agenda}
            enregistrerPreferences={enregistrerPreferences}
        />
    );
}
