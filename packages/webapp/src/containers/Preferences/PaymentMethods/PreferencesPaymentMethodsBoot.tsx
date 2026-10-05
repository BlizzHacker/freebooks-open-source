import { Button, Callout, Intent, Spinner } from '@blueprintjs/core';
import { createContext, ReactNode, useContext } from 'react';
import {
  GetPaymentServicesStateResponse,
  useGetPaymentServicesState,
} from '@/hooks/query/payment-services';

type PaymentMethodsContextType = {
  isPaymentMethodsStateLoading: boolean;
  paymentMethodsState: GetPaymentServicesStateResponse | undefined;
};

const PaymentMethodsContext = createContext<PaymentMethodsContextType>(
  {} as PaymentMethodsContextType,
);

type PaymentMethodsProviderProps = {
  children: ReactNode;
};

const PaymentMethodsBoot = ({ children }: PaymentMethodsProviderProps) => {
  const {
    data: paymentMethodsState,
    isLoading: isPaymentMethodsStateLoading,
    isError,
    refetch,
  } = useGetPaymentServicesState();

  const value = { isPaymentMethodsStateLoading, paymentMethodsState };

  return (
    <PaymentMethodsContext.Provider value={value}>
      {isPaymentMethodsStateLoading && <Spinner size={20} />}
      {isError && (
        <Callout
          intent={Intent.WARNING}
          title="Some payment settings are unavailable"
        >
          FreeBooks could not load Stripe status. Other connection settings
          remain available.{' '}
          <Button minimal small onClick={() => refetch()}>
            Retry
          </Button>
        </Callout>
      )}
      {children}
    </PaymentMethodsContext.Provider>
  );
};

const usePaymentMethodsBoot = () => {
  const context = useContext<PaymentMethodsContextType>(PaymentMethodsContext);
  if (context === undefined) {
    throw new Error(
      'usePaymentMethods must be used within a PaymentMethodsProvider',
    );
  }
  return context;
};

export { PaymentMethodsBoot, usePaymentMethodsBoot };
