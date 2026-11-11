import { convertUTCToLocal } from '@/functions/convertirUTCenLocal'
import log from '@/functions/log'
import { createContext, useCallback, useContext, useState } from 'react'
import { useAPI } from './contexteAPI'
import { useAccessToken } from './contexteToken'

import ToastAbs from '@/abstractions/toastAbs'
import { FPType } from '@/types/pfp'
import { DateTime } from 'luxon'

//Types

type Membre = {
    idPublique: string | undefined;
    pseudo: string | undefined;
    bio: string | undefined;
    etatAme: string | undefined;
    fp: FPType;
    tempsCreation: DateTime | undefined;
    admin: boolean | false;
    emailConfirme: boolean | false;
    timezone: string;
    email: string | undefined;
    statutDisponibilite: 'disponible' | 'silencieux' | 'indisponible';
};

type MembreContextType = {
    membre: Membre;
    patchProfil: (pseudo?: string | undefined, bio?: string | undefined, fp?: FPType, etatAme?: string) => Promise<void>;
    patchStatutDisponibilite: (statut: Membre['statutDisponibilite']) => Promise<void>;
    getMembre: () => Promise<void>;
    resetMembre: () => void;
    setMockMembre: () => void;
};

const MembreContexte = createContext<MembreContextType | undefined>(undefined);

export const MembreProvider = ({ children }: { children: React.ReactNode }) => {
    const {getToken} = useAccessToken()
    const { api } = useAPI()
    
    const membreInitial: Membre = {
        idPublique: undefined,
        pseudo: undefined,
        bio: undefined,
        etatAme: undefined,
        fp: undefined,
        tempsCreation: undefined,
        admin: false,
        emailConfirme: false,
        timezone: 'local',
        email: undefined,
        statutDisponibilite: 'disponible'
    }

    const [membre, setMembre] = useState<Membre>(membreInitial)

    const getMembre = useCallback(async () => {
            try {
                const response = await api.get('/membres')
                log('get membre', response.data)
                const data = response.data
                setMembre((prev) => ({
                    ...prev,
                    idPublique: data.id_publique ?? null,
                    pseudo: data.pseudo ?? null,
                    bio: data.bio ? data.bio : "cette personne n'a rien à dire",
                    etatAme: data.etat_ame ?? '',
                    fp: data.fp_url ?? null,
                    admin: data.role === 'admin',
                    emailConfirme: data.email_confirme ?? false,
                    email: data.courriel,
                    tempsCreation: convertUTCToLocal(data.temps_creation),
                    statutDisponibilite: data.statut_disponibilite ?? 'disponible'
                }))
            
            } catch (error: any) {
                throw error
            }
        }, [api])

    const setMockMembre = () => {
        setMembre({
            pseudo: 'mocker',
            idPublique: "Mmoc1234",
            bio: "Je ne suis qu'un mock de donnée",
            etatAme: '',
            fp: undefined,
            tempsCreation: DateTime.now(),
            admin: true,
            emailConfirme: true,
            timezone: 'local',
            email:'pereiralevesque.gabriel@gmail.com',
            statutDisponibilite: 'disponible'
        })
    }

    const patchStatutDisponibilite = async (statut: Membre['statutDisponibilite']) => {
        const precedent = membre.statutDisponibilite
        setMembre((prev) => ({ ...prev, statutDisponibilite: statut }))
        try {
            await api.patch('/membres/disponibilite', { statut_disponibilite: statut })
        } catch (error) {
            setMembre((prev) => ({ ...prev, statutDisponibilite: precedent }))
            throw error
        }
    }

    const patchProfil = async (pseudo : string | undefined, bio : string | undefined, fp: FPType = undefined, etatAme?: string ) => {
        const token = await getToken()
        const url = `/membres/profil`

        const formData = new FormData();

        if (pseudo) {
            formData.append("pseudo", pseudo);
            setMembre((prev) => ({ ...prev, pseudo }));
        }

        if (bio) {
            formData.append("bio", bio);
            setMembre((prev) => ({ ...prev, bio }));
        }

        if (etatAme !== undefined) {
            formData.append("etat_ame", etatAme);
            setMembre((prev) => ({ ...prev, etatAme }));
        }

        if (fp) {
            const obj = typeof fp === 'string' ? { uri: fp } : fp as any;
            let type = obj.mimeType ?? obj.type ?? 'image/jpeg';
            if (type === 'image') type = 'image/jpeg';
            const name = obj.fileName ?? obj.uri?.split('/').pop() ?? `${pseudo ?? 'image'}.jpg`;
            if (!obj.uri) throw new Error('uri image manquante');
            formData.append('image', { uri: obj.uri, type, name } as any);
            setMembre((prev) => ({ ...prev, fp }));
        }

        const modifiedFields: string[] = [];
        if (pseudo) modifiedFields.push('pseudo');
        if (bio) modifiedFields.push('bio');
        if (fp) modifiedFields.push('image');
        if (etatAme !== undefined) modifiedFields.push('etat_ame');

        if (modifiedFields.length > 0) {
            try {           
                log("patch", url, formData);

                const response = await api.patch(url, formData, {
                    headers:{
                        'Authorization':`Bearer ${token}`,
                    }
                })                

                if(response.status === 200){
                    ToastAbs.show({
                        type:'persoSucces',
                        text1:'profil modifié',
                        text2:`champs modifiés: ${modifiedFields.join(', ')}`
                    })
                    getMembre()
                }

            } catch (error: any) {
                log('erreur en modifiant le profil', error.message, error.response?.data)  
                throw error
            }
        }
    }

    const resetMembre = () => {
        log("membre reset")
        setMembre(membreInitial);
    };

    return (
        <MembreContexte.Provider value={{ membre, patchProfil, patchStatutDisponibilite, getMembre, resetMembre, setMockMembre }}>
            {children}
        </MembreContexte.Provider>
    );
}

/**
 * Fetch et patch le membre pour le garder en mémoire
 * 
 * @returns {string} idPublique
 * @returns {string} pseudo
 * @returns {string} bio
 * @returns {uri} fp
 * @returns {string} tempsCreation
 * @returns {bool} admin
 * @returns {function} patchProfil() | prend les champs modifiés *  
 * @returns {function} resetMembre() | vide les champs du membre        
 */
export const useMembre = () => {
    const ctx = useContext(MembreContexte)
    if(!ctx) throw new Error('useMembre must be used within a MembreProvider')
    return ctx
}
