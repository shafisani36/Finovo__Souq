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
    title: 'Buying',
    items: [
      {
        question: 'What is Finovo Souq?',
        answer: 'Finovo Souq is a classifieds marketplace for Saudi Arabia. People post cars, property, electronics, furniture and local services, and buyers contact them directly through the site.',
      },
      {
        question: 'Do I pay through Finovo Souq?',
        answer: 'No. Finovo Souq connects buyers and sellers but does not take payments for listed items. Agree on the price with the seller and pay only after you have seen the item.',
      },
      {
        question: 'How do I contact a seller?',
        answer: 'Open the ad and choose "Message seller". You need a free account so the seller can reply, and your phone number stays private.',
      },
    ],
  },
  {
    title: 'Selling',
    items: [
      {
        question: 'Does it cost anything to post an ad?',
        answer: 'Posting an ad is free. Create an account, choose a category, add details and photos, and submit it for review.',
      },
      {
        question: 'Why is my ad not live yet?',
        answer: 'Every ad is checked by our team before it appears in search. If something needs fixing, you get a notification with the reason and can edit and resubmit the ad.',
      },
      {
        question: 'How do I mark an item as sold?',
        answer: 'Go to My ads in your dashboard, open the menu next to the ad and choose "Mark as sold" or "Mark as rented". The ad leaves search results straight away.',
      },
    ],
  },
  {
    title: 'Safety and account',
    items: [
      {
        question: 'What should I do if I think an ad is a scam?',
        answer: 'Do not send any money. Use "Report this ad" on the ad page and pick a reason. Our team reviews every report and removes ads that break the rules.',
      },
      {
        question: 'How can I keep my account safe?',
        answer: 'Use a strong password that you do not use anywhere else, and sign out on shared devices. Finovo Souq staff will never ask for your password.',
      },
      {
        question: 'Can I delete my account?',
        answer: 'Yes. Open Profile in your dashboard and choose "Request deletion". Your ads are removed when the request is processed.',
      },
    ],
  },
];
