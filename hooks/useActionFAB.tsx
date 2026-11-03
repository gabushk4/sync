import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useEffect } from 'react';
import { FabConfig, useFabActions } from '@/contextes/contexteFAB'; 
import log from '@/functions/log';

export function useActionFab(owner: string, { action, config }: { action: () => void; config: FabConfig }) {
    const { setFabConfig, release } = useFabActions();

    const configRef = useRef(config)

    // L'action locale est toujours à jour, mais n'est enregistrée qu'au focus.
    // The ref is updated in an effect (writing it during render is what ESLint flagged),
    // and the FAB *calls* the latest action. 2ef2141 had `() => action`, which only
    // returned the function: every ✓ (create, unavailability, edit) did nothing.
    // Rectification (Philip).
    const actionLocalRef = useRef(action);
    useEffect(() => {
        actionLocalRef.current = action;
    }, [action])

    const stableAction = useCallback(() => {
        actionLocalRef.current();    
    }, [])

    // Gère l'icône + le montage/démontage lié au focus de l'écran
    useFocusEffect(
        useCallback(() => {
            setFabConfig(owner, configRef.current, stableAction);
            return () => {
                log("action fab cleansed by", owner)
                release(owner)
            };
        },  [owner, setFabConfig, release, stableAction])
    );
}