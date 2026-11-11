// contexts/AuthContext.tsx
import { authEvents } from '@/events/authEvents';
import catcher from '@/functions/catcher';
import log from '@/functions/log';
import { retirerPushToken } from '@/functions/notificationsPush';
import { emptyTokens, setToken } from '@/functions/tokenStore';
import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useAPI } from './contexteAPI';
import { useMembre } from './contexteMembre';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextType = {
  state: AuthState;
  signIn: (accessToken: string, refreshToken: string) => Promise<void>;
  signOut: (options?: { retirerPush?: boolean }) => Promise<void>;
  recheckAuth: () => Promise<void>;
};

const AuthContexte = createContext<AuthContextType | undefined>(undefined);

/**
 * Permet de donner le contexte pour l'authetification d'un membre
 * @param param0 ReactNode
 * @returns
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const { getMembre, resetMembre } = useMembre();
    const { api } = useAPI();

    const [state, setState] = useState<AuthState>('loading');

    // Vérifie si le membre est connecté ou non
    const checkAuth = async () => {
        try {
            const refreshToken = await SecureStore.getItemAsync('refresh_token');

            if (!refreshToken) {
                log('AuthContext: aucun refresh token, non authentifié');
                setState('unauthenticated');
                return;
            }
            
            await getMembre(); // fetch les infos du membre connecté
            setState('authenticated');
        } catch (error: any) {
            log('AuthContext: échec de la vérification, déconnexion', error?.message);
            await emptyTokens(); // invalide tous les tokens            
            resetMembre(); // invalide les infos du membre
            setState('unauthenticated');
        }
    }
    

    useEffect(() => {  
        // abonnement à l'évènement Unauthorized
        // session refused by the API: no request to remove the push token (it would get
        // the same 401 and sign out again)
        const unsubscribe = authEvents.onUnauthorized(() => {
            signOut({ retirerPush: false }); 
        });
        return unsubscribe;        
    }, []);

    // au lancement de l'app
    useEffect(() => {
        checkAuth();
    }, [])

    /**
     * permet de lancer la requête pour connecter le membre
     * @param accessToken du membre connecté
     * @param refreshToken du membre connecté
     */
    const signIn = async (accessToken: string, refreshToken: string) => {
        console.log("sign in")
        try {
            setToken(accessToken);
            await SecureStore.setItemAsync('refresh_token', refreshToken);
            await getMembre();
            setState('authenticated');
        } catch (err) {
            catcher(err, 'connexion impossible')
            setState('unauthenticated')
        }
    };

    /**
     * Permet de déconnecter le membre.
     * The state flips first: that unmounts the tabs and stops the pollers
     * (notifications, events) before the tokens disappear. In the old order,
     * a poll firing in between went out without a token, got a 401, and
     * showed a "conflit détecté / Un token est nécessaire" toast.
     * US-52: a sign-out the member chose also removes this device's push token from their
     * account (while still signed in), so its notifications stop coming here.
     *
     * @param {{ retirerPush?: boolean }} [options] - retirerPush: false when the API already
     *   refused the session (no request that would get the same 401).
     * @returns {Promise<void>}
     */
    const signOut = async ({ retirerPush = true }: { retirerPush?: boolean } = {}) => {
        setState('unauthenticated');
        resetMembre();
        if (retirerPush) await retirerPushToken(api);
        await emptyTokens();

    };

    return (
        <AuthContexte.Provider value={{ state, signIn, signOut, recheckAuth: checkAuth }}>
            {children}
        </AuthContexte.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const ctx = useContext(AuthContexte);
    if (!ctx) throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
    return ctx;
};