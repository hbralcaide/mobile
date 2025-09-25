import { LinkingOptions } from '@react-navigation/native';
import { RootStackParamList } from './types';
import { getStateFromPath as defaultGetStateFromPath } from '@react-navigation/native';

export const linkingConfig: LinkingOptions<RootStackParamList> = {
  prefixes: [
    'mapalengke://',
    'http://udxoepcssfhljwqbvhbd.supabase.co',
    'https://udxoepcssfhljwqbvhbd.supabase.co'
  ],
  config: {
    screens: {
      VerifyEmail: {
        path: 'auth/callback/verify',
        parse: {
          token_hash: (token: string) => token,
          type: (type: string) => type,
          refresh_token: (token: string) => token,
        },
      },
      ResetPassword: {
        path: 'auth/v1/callback',
        parse: {
          token: (token: string) => token,
        },
      },
      // Add other screen configs here
      Home: 'home',
      Market: 'market',
      Login: 'login',
      Register: 'register',
    },
  },
  // Custom getStateFromPath to ensure query params are parsed
  getStateFromPath: (path, options) => {
    const state = defaultGetStateFromPath(path, options);
    // Remove admin signup deep link handling since it's now handled by web page
    return state;
  },
};
