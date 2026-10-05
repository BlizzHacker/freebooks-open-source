import { Text, Classes, Button, Intent } from '@blueprintjs/core';
import { useEffect, useState } from 'react';
import { css } from '@emotion/css';
import clsx from 'classnames';
import styles from './PaymentPortal.module.scss';
import { usePaymentPortalBoot } from './PaymentPortalBoot';
import { AppToaster, Box, Group, Stack } from '@/components';
import { DRAWERS } from '@/constants/drawers';
import {
  useCreateStripeCheckoutSession,
  useGeneratePaymentLinkInvoicePdf,
} from '@/hooks/query/payment-link';
import { useDrawerActions } from '@/hooks/state';
import { downloadFile } from '@/hooks/useDownloadFile';

export function PaymentPortal() {
  const { openDrawer } = useDrawerActions();
  const { sharableLinkMeta, linkId } = usePaymentPortalBoot();
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const availablePaymentMethods = ((sharableLinkMeta as any)
    ?.availablePaymentMethods || []) as Array<{
    provider: string;
    integrationId: number;
    name: string;
  }>;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get('payment_provider');
    const attempt = params.get('attempt');
    if (!provider || !attempt || !['square', 'paypal'].includes(provider))
      return;
    let cancelled = false;
    setPaymentStatus('Checking payment with ' + provider + '...');
    fetch(
      '/api/payment-links/' +
        encodeURIComponent(linkId) +
        '/' +
        (provider === 'square' ? 'Square' : 'PayPal') +
        '/verify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt,
          orderId: params.get('token') || params.get('orderId') || undefined,
        }),
      },
    )
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            payload?.message || 'Processor payment is not confirmed yet.',
          );
        }
        return payload?.data || payload;
      })
      .then((result) => {
        if (cancelled) return;
        if (result.status === 'recorded') {
          setPaymentStatus(
            'Payment confirmed and recorded. Refresh to see the updated balance.',
          );
        } else {
          setPaymentStatus('Payment is still pending confirmation.');
        }
      })
      .catch((error) => {
        if (!cancelled)
          setPaymentStatus(
            error instanceof Error
              ? error.message
              : 'Payment confirmation is pending.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [linkId]);
  const {
    mutateAsync: createStripeCheckoutSession,
    isPending: isStripeCheckoutLoading,
  } = useCreateStripeCheckoutSession();

  const {
    mutateAsync: generatePaymentLinkInvoice,
    isPending: isInvoiceGenerating,
  } = useGeneratePaymentLinkInvoicePdf();

  const handleProcessorPay = async (
    provider: 'Square' | 'PayPal',
    integrationId: number,
  ) => {
    setActiveProvider(provider);
    try {
      const response = await fetch(
        '/api/payment-links/' +
          encodeURIComponent(linkId) +
          '/' +
          provider +
          '/checkout',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ integrationId }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Checkout could not be started.');
      }
      const checkout = payload?.data || payload;
      if (!checkout?.redirectTo)
        throw new Error('Processor checkout URL is missing.');
      window.location.assign(checkout.redirectTo);
    } catch (error) {
      setActiveProvider(null);
      AppToaster.show({
        intent: Intent.DANGER,
        message:
          error instanceof Error
            ? error.message
            : 'Checkout could not be started.',
      });
    }
  };

  // Handles invoice preview button click.
  const handleInvoicePreviewBtnClick = () => {
    openDrawer(DRAWERS.PAYMENT_INVOICE_PREVIEW);
  };

  // Handles invoice download button click.
  const handleInvoiceDownloadBtnClick = () => {
    generatePaymentLinkInvoice({ paymentLinkId: linkId })
      .then((data) => {
        downloadFile(
          data,
          `Invoice ${sharableLinkMeta?.invoiceNo}`,
          'application/pdf',
        );
      })
      .catch(() => {
        AppToaster.show({
          intent: Intent.DANGER,
          message: 'Something went wrong.',
        });
      });
  };

  // handles the pay button click.
  const handlePayButtonClick = () => {
    createStripeCheckoutSession({ linkId })
      .then((session) => {
        window.location.assign(session.redirectTo);
      })
      .catch((error) => {
        AppToaster.show({
          intent: Intent.DANGER,
          message: 'Something went wrong.',
        });
      });
  };

  return (
    <Box className={styles.root} my={'40px'} mx={'auto'}>
      <Stack spacing={0} className={styles.body}>
        <Stack>
          <Group spacing={10}>
            {sharableLinkMeta?.brandingTemplate?.companyLogoUri && (
              <Box
                className={styles.companyLogoWrap}
                style={{
                  backgroundImage: `url(${sharableLinkMeta?.brandingTemplate?.companyLogoUri})`,
                }}
              ></Box>
            )}
            <Text>{sharableLinkMeta?.organization?.name}</Text>
          </Group>

          <Stack spacing={6}>
            <h1 className={styles.bigTitle}>
              {sharableLinkMeta?.organization?.name} Sent an Invoice for{' '}
              {sharableLinkMeta?.totalFormatted}
            </h1>
            <Group spacing={10}>
              <Text className={clsx(Classes.TEXT_MUTED, styles.invoiceDueDate)}>
                Invoice due {sharableLinkMeta?.dueDateFormatted}{' '}
              </Text>
            </Group>
          </Stack>

          <Stack className={styles.address} spacing={2}>
            <Box className={styles.customerName}>
              {sharableLinkMeta?.customerName}
            </Box>

            {sharableLinkMeta?.formattedCustomerAddress && (
              <Box
                dangerouslySetInnerHTML={{
                  __html: sharableLinkMeta?.formattedCustomerAddress,
                }}
              />
            )}
          </Stack>

          <h2 className={styles.invoiceNumber}>
            Invoice {sharableLinkMeta?.invoiceNo}
          </h2>

          <Stack spacing={0} className={styles.totals}>
            <Group
              position={'apart'}
              className={clsx(styles.totalItem, styles.borderBottomGray)}
            >
              <Text>Sub Total</Text>
              <Text>{sharableLinkMeta?.subtotalFormatted}</Text>
            </Group>

            <Group position={'apart'} className={styles.totalItem}>
              <Text>Total</Text>
              <Text style={{ fontWeight: 500 }}>
                {sharableLinkMeta?.totalFormatted}
              </Text>
            </Group>

            {sharableLinkMeta?.taxes?.map((tax, key) => (
              <Group key={key} position={'apart'} className={styles.totalItem}>
                <Text>{tax?.name}</Text>
                <Text>{tax?.taxRateAmountFormatted}</Text>
              </Group>
            ))}
            <Group
              position={'apart'}
              className={clsx(styles.totalItem, styles.borderBottomGray)}
            >
              <Text>Paid Amount (-)</Text>
              <Text>{sharableLinkMeta?.paymentAmountFormatted}</Text>
            </Group>

            <Group
              position={'apart'}
              className={clsx(styles.totalItem, styles.borderBottomDark)}
            >
              <Text>Due Amount</Text>
              <Text style={{ fontWeight: 500 }}>
                {sharableLinkMeta?.dueAmountFormatted}
              </Text>
            </Group>
          </Stack>
        </Stack>

        <Stack spacing={8} className={styles.footerButtons}>
          <Button
            minimal
            className={clsx(styles.footerButton, styles.downloadInvoiceButton)}
            onClick={handleInvoiceDownloadBtnClick}
            loading={isInvoiceGenerating}
          >
            Download Invoice
          </Button>

          <Button
            onClick={handleInvoicePreviewBtnClick}
            className={clsx(styles.footerButton, styles.viewInvoiceButton)}
          >
            View Invoice
          </Button>

          {sharableLinkMeta?.isReceivable &&
            availablePaymentMethods.map((method) => (
              <Button
                key={method.integrationId}
                intent={Intent.PRIMARY}
                className={clsx(
                  styles.footerButton,
                  styles.buyButton,
                  css`
                    &.bp4-button.bp4-intent-primary {
                      background-color: var(--payment-page-primary-button);

                      &:hover,
                      &:focus {
                        background-color: var(
                          --payment-page-primary-button-hover
                        );
                      }
                    }
                  `,
                )}
                loading={
                  method.provider === 'Stripe'
                    ? isStripeCheckoutLoading
                    : activeProvider === method.provider
                }
                onClick={() =>
                  method.provider === 'Stripe'
                    ? handlePayButtonClick()
                    : handleProcessorPay(
                        method.provider as 'Square' | 'PayPal',
                        method.integrationId,
                      )
                }
              >
                Pay {sharableLinkMeta?.dueAmountFormatted} with{' '}
                {method.provider}
              </Button>
            ))}
        </Stack>

        {paymentStatus && <Text>{paymentStatus}</Text>}

        <Text className={clsx(Classes.TEXT_MUTED, styles.buyNote)}>
          By confirming, you authorize this payment through the selected payment
          provider.
        </Text>
      </Stack>

      <Stack spacing={18} className={styles.footer}>
        <Box
          dangerouslySetInnerHTML={{
            __html: sharableLinkMeta?.organization?.addressTextFormatted || '',
          }}
        ></Box>

        <Stack spacing={0} className={styles.footerText}>
          © 2026 FreeBooks.dev
          <br />
          All rights reserved.
        </Stack>
      </Stack>
    </Box>
  );
}
