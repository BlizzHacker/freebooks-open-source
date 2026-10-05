export const defaultCreditNoteMailReceiptProps = {
  companyName: 'FreeBooks.dev',
  companyLogoUri: ' ',

  total: '$1,000.00',
  subtotal: '$1,000.00',
  creditNoteNumber: 'CN-0001',
  creditNoteDate: '2 Oct 2024',
  items: [{ label: 'Web development', total: '$1000.00', quantity: 1 }],
  message: `Hi Customer,

Please find your credit note # CN-0001 for $1,000.00 attached to this email.

If you have any questions, please let us know.

Thanks,
FreeBooks`,
};
