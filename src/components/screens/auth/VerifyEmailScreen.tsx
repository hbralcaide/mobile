import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../../../navigation/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../../services/supabase';
import { useTranslation } from 'react-i18next';

type VerifyEmailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'VerifyEmail'>;

const VerifyEmailScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<VerifyEmailScreenNavigationProp>();
  const route = useRoute();
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const { token, type } = route.params as { token: string; type: string };

        if (type === 'signup' || type === 'invite') {
          const result = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'signup'
          });

          if (result.error) throw result.error;

          // Wait a moment to show success message
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Navigate to login
          navigation.replace('Login');
        } else {
          throw new Error('Unsupported verification type');
        }
      } catch (err) {
        console.error('Verification error:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        // Wait a moment to show error message
        await new Promise(resolve => setTimeout(resolve, 2000));
        navigation.replace('Login');
      } finally {
        setVerifying(false);
      }
    };

    verifyEmail();
  }, [navigation, route.params]);

  return (
    <View style={styles.container}>
      {verifying ? (
        <>
          <ActivityIndicator size="large" />
          <Text variant="bodyLarge" style={styles.message}>
            {t('auth.verifyEmail.verifying')}
          </Text>
        </>
      ) : (
        <>
          {error ? (
            <Text variant="bodyLarge" style={[styles.message, styles.error]}>
              {error}
            </Text>
          ) : (
            <Text variant="bodyLarge" style={styles.message}>
              {t('auth.verifyEmail.redirecting')}
            </Text>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  message: {
    marginTop: 16,
    textAlign: 'center',
  },
  error: {
    color: '#B00020',
  },
});

export default VerifyEmailScreen;
