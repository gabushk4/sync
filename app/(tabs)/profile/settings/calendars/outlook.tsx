import ExternalCalendarForm from '@/components/ExternalCalendarForm';
import { useAPI } from '@/contextes/contexteAPI';
import catcher from '@/functions/catcher';
import {
    chargerCalendriersOutlook,
    chargerComptesOutlook,
    chargerConfigOutlook,
    connecterCompteOutlook,
    deconnecterCompteOutlook,
    modifierPreferencesCalendrier,
    resynchroniserCalendrierOutlook,
    selectionnerCalendriersOutlook,
    type CalendrierOutlook,
} from '@/functions/outlookAgenda';
import { demanderCodeOutlook } from '@/functions/outlookOAuth';
import { useAgendaImport } from '@/hooks/useAgendaImport';
import { JSX } from 'react';
import { Platform } from 'react-native';

/** Écran de gestion du compte et des calendriers Outlook. */
export default function OutlookAgendaScreen(): JSX.Element {
    const { api } = useAPI();
    const agenda = useAgendaImport({
        api,
        prefixe: 'outlook',
        chargerComptesEtCalendriers: async () => {
            const [comptes, reponse] = await Promise.all([
                chargerComptesOutlook(api),
                chargerCalendriersOutlook(api),
            ]);
            return { comptes, calendriers: reponse.calendriers };
        },
        selectionner: ids => selectionnerCalendriersOutlook(api, ids),
        relancerImport: id => resynchroniserCalendrierOutlook(api, id),
        deconnecterCompte: id => deconnecterCompteOutlook(api, id),
        obtenirCode: async () => {
            const platform = Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web'
                ? Platform.OS
                : undefined;
            const config = await chargerConfigOutlook(api, platform);
            const code = await demanderCodeOutlook(config);
            return code ? { ...code, client_id: config.client_id } : null;
        },
        connecterCompte: (instance, code, { codeVerifier, platform }) =>
            connecterCompteOutlook(instance, code, platform, codeVerifier),
    });

    const enregistrerPreferences = async (
        calendrier: CalendrierOutlook,
        modifications: Partial<CalendrierOutlook>,
    ) => {
        if (!calendrier.id_publique) return;
        agenda.mettreAJourCalendrier(calendrier.id_publique, modifications);
        try {
            await modifierPreferencesCalendrier(api, calendrier.id_publique, modifications);
        } catch (error) {
            catcher(error, 'Impossible de modifier le calendrier.');
            throw error;
        }
    };

    return (
        <ExternalCalendarForm
            fournisseur="outlook"
            {...agenda}
            enregistrerPreferences={enregistrerPreferences}
        />
    );
}
