import { t } from '../i18n';
export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqGroup {
  title: string;
  items: FaqItem[];
}

export const FAQ_GROUPS: FaqGroup[] = [
  {
    title: t('Buying'),
    items: [
      {
        question: t('What is Finovo Souq?'),
        answer: t(
          'Finovo Souq is a classifieds marketplace for Saudi Arabia. People post cars, property, electronics, furniture and local services, and buyers contact them directly through the site.',
        ),
      },
      {
        question: t('Do I pay through Finovo Souq?'),
        answer: t('No. Finovo Souq connects buyers and sellers but does not take payments for listed items. Agree on the price with the seller and pay only after you have seen the item.'),
      },
      {
        question: t('How do I contact a seller?'),
        answer: t('Open the ad and choose "Message seller". You need a free account so the seller can reply, and your phone number stays private.'),
      },
    ],
  },
  {
    title: t('Selling'),
    items: [
      {
        question: t('Does it cost anything to post an ad?'),
        answer: t('No. Personal sellers always post for free, with no commission when the item sells. You only pay if you choose to promote an ad to the top of search, and that is optional.'),
      },
      {
        question: t('What is a verified business store?'),
        answer: t(
          'Shops, showrooms and agencies can open a store page from My store. Our team checks the 10-digit commercial registration first; verified stores show a Verified business badge on every ad. The registration number itself is never shown to buyers.',
        ),
      },
      {
        question: t('Why is my ad not live yet?'),
        answer: t('Every ad is checked by our team before it appears in search. If something needs fixing, you get a notification with the reason and can edit and resubmit the ad.'),
      },
      {
        question: t('How do I mark an item as sold?'),
        answer: t('Go to My ads in your dashboard, open the menu next to the ad and choose "Mark as sold" or "Mark as rented". The ad leaves search results straight away.'),
      },
    ],
  },
  {
    title: t('Safety and account'),
    items: [
      {
        question: t('What should I do if I think an ad is a scam?'),
        answer: t('Do not send any money. Use "Report this ad" on the ad page and pick a reason. Our team reviews every report and removes ads that break the rules.'),
      },
      {
        question: t('How can I keep my account safe?'),
        answer: t('Use a strong password that you do not use anywhere else, and sign out on shared devices. Finovo Souq staff will never ask for your password.'),
      },
      {
        question: t('Can I delete my account?'),
        answer: t('Yes. Open Profile in your dashboard and choose "Request deletion". Your ads are removed when the request is processed.'),
      },
    ],
  },
];
