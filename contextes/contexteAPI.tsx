import { authEvents } from "@/events/authEvents";
import catcher from "@/functions/catcher";
import { emptyTokens, getToken, setToken } from "@/functions/tokenStore";
import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { createContext, useContext } from "react";

import { requestListener } from "@/events/requestEvents";


interface APIContextType {
  api: AxiosInstance;
  APIBaseURL: string;
}

interface AxiosRequestConfigWithRetry extends InternalAxiosRequestConfig {
  _retry?: boolean;
  __requestStartedAt?: number;
}

let inFlight = 0

const track = (delta: number) => {
  inFlight += delta
  requestListener?.setFetching(inFlight > 0)
}

export const APIContexte = createContext<APIContextType | undefined>(undefined);

/** Utilitaire interne seulement. Sert à savoir à quelle url le serveur se base. 
 * Utilise la variable d'environnement EXPO_PUBLIC_USING_REMOTE pour savoir si le client fetch au niveau local ou sur l'internet publique.
 * Utilise la var. d'env. NODE_ENV pour savoir si on fetch sur le serveur de dev ou de prod. 
 * La variable NODE_ENV est manipulé strictement par React.
 *  */
function getApiBaseUrl() {
  // hostUri ressemble à "192.168.1.42:8081"
  const hostUri = Constants.expoConfig?.hostUri
  
  if (hostUri) {
    const ip = hostUri.split(':')[0]; //prendre lip seulement [ip, port]
    return process.env.EXPO_PUBLIC_USING_REMOTE === 'true'
      ? 'https://syncalkemy.ca'
      : `http://${ip}:3100`;
  }
  
  // fallback si jamais hostUri est absent (build de prod, etc.)
  return process.env.NODE_ENV === 'development'
    ? 'https://dev.syncalkemy.ca'
    : 'https://syncalkemy.ca'
}

const APIBaseURL = getApiBaseUrl()  

let refreshPromise: Promise<string> | null = null

const refreshAccessToken = async (): Promise<string> => {
  if (refreshPromise) return refreshPromise // un refresh est déjà en cours, on attend le même

  refreshPromise = (async () => {
    const refreshToken = await SecureStore.getItemAsync('refresh_token')
    if (!refreshToken) throw new Error('Aucun refresh token')

    const res = await axios.post(`${APIBaseURL}/token`, { refresh_token: refreshToken })
    const { access_token } = res.data
    setToken(access_token)
    return access_token
  })()

  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
  }
}

const api = axios.create({
  baseURL: APIBaseURL, // ainsi, pas besoin de spécifier APIBaseURL a chaque requêtes
  timeout: 10000, //pas besoin de spécifier un timeout 
});


//crée une instance d'axios personnalisable pour nos besoins. 

api.interceptors.request.use(
    async (config) => {
      (config as AxiosRequestConfigWithRetry).__requestStartedAt = Date.now()
      track(+1)
      const token = getToken()
      if (token) config.headers.Authorization = `Bearer ${token}`
      return config
    },
    (error) => {
      track(-1)
      catcher(error, "erreur à l'envoie de la requête")
      return Promise.reject(error)
    }
  )

  api.interceptors.response.use(
    (response) => {
      track(-1)
      return response
    },
    async (error) => {
      track(-1)
      const requeteOriginale: AxiosRequestConfigWithRetry = error.config
      if (requeteOriginale?.__requestStartedAt && Date.now() - requeteOriginale.__requestStartedAt >= 5000) {
        error.__requeteLente = true
      }

      if (!error.response) return Promise.reject(error)
      if (requeteOriginale.url?.includes('/token')) return Promise.reject(error)

      if (error.response.status === 401 && !requeteOriginale._retry) {
        requeteOriginale._retry = true
        try {
          const access_token = await refreshAccessToken()
          api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
          if (requeteOriginale.headers) {
            (requeteOriginale.headers as any)['Authorization'] = `Bearer ${access_token}`
          }
          return api(requeteOriginale)
        } catch {
          await SecureStore.deleteItemAsync('refresh_token')
          await emptyTokens()
          authEvents.emitUnauthorized()
          error.deconnecte = true
          return Promise.reject(error)
        }
      }
      return Promise.reject(error)
    }
  )

export const APIProvider = ({ children }: { children: React.ReactNode }) => {
  //log("api provider render")
  const value: APIContextType = {api, APIBaseURL}

  return (
    <APIContexte.Provider value={value}>
      {children}
    </APIContexte.Provider>
  );
};

/**
 * Offre api de type axios avec un interceptor et APIBaseURL de type string
 * @returns {AxiosInstance} api
 * @returns {string} APIBaseURL
 */
export const useAPI = (): APIContextType => {
  const context = useContext(APIContexte);
  if (!context) {
    throw new Error('useAPI doit être utilisé à l\'intérieur d\'un APIProvider');
  }
  return context;
};
