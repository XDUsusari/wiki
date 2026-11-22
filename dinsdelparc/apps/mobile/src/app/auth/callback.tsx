import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Loading } from '../../components/ui';
import { exchangeCode } from '../../services/account';

/** E-mail verification deep link: dinsdelparc://auth/callback?code=… */
export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  useEffect(() => {
    const go = () => router.replace('/profile');
    if (code) void exchangeCode(code).finally(go);
    else go();
  }, [code]);
  return <Loading />;
}
