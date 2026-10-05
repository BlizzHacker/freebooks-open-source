import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthOrganizationId, useAuthToken } from '@/hooks/state';

export interface ProviderAccount {
  id: number;
  provider: string;
  name: string;
  externalAccountId: string | null;
  paymentEnabled: boolean;
  payoutEnabled: boolean;
  active: boolean;
  checkoutReady: boolean;
  historySyncReady: boolean;
  connectionStatus: string;
}

export function usePaymentProviderConnections() {
  const token = useAuthToken();
  const organizationId = useAuthOrganizationId();
  const queryClient = useQueryClient();
  const queryKey = ['payment-provider-connections', organizationId];

  const request = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(organizationId ? { 'organization-id': organizationId } : {}),
        ...init?.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message;
      throw new Error(
        message || `Payment provider request failed (${response.status}).`,
      );
    }
    return data?.data ?? data;
  };

  const accounts = useQuery({
    queryKey,
    enabled: Boolean(token && organizationId),
    queryFn: () => request('/api/payment-services/providers'),
  });
  const connect = useMutation({
    mutationFn: ({
      provider,
      name,
      credentials,
    }: {
      provider: string;
      name: string;
      credentials: Record<string, string>;
    }) =>
      request(
        '/api/payment-services/providers/' +
          encodeURIComponent(provider) +
          '/accounts',
        { method: 'POST', body: JSON.stringify({ name, credentials }) },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const refresh = useMutation({
    mutationFn: (integrationId: number) =>
      request('/api/payment-services/providers/' + integrationId + '/refresh', {
        method: 'POST',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const disconnect = useMutation({
    mutationFn: (integrationId: number) =>
      request('/api/payment-services/providers/' + integrationId, {
        method: 'DELETE',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { accounts, connect, refresh, disconnect };
}
