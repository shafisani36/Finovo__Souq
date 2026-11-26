/** Starting values, written once when the settings document does not exist yet */
export const DEFAULT_SETTINGS = {
  contact: {
    email: 'support@finovosouq.com',
    phone: '',
    hours: 'Sunday to Thursday, 9:00 to 18:00 (Riyadh time)',
    city: 'Riyadh, Saudi Arabia',
  },
  social: { x: '', instagram: '', facebook: '', tiktok: '', youtube: '' },
  announcement: { enabled: false, text: '', tone: 'info', link: '' },
  listings: { maxPhotos: 10, expiryDays: 30 },
  pages: {
    help: {
      title: 'Help centre',
      body: `Answers to the questions we hear most. Still stuck? Our team is one message away on the Contact page.

## Buying
- **Search and filter:** pick a category, then use the filters on the left (city, price and details such as make or bedrooms). Save a search to get a notification when a matching ad goes live.
- **Contact a seller:** open the ad and choose **Message seller**. Your phone number and email stay private.
- **Save ads:** tap the heart on any ad to keep it in Saved ads, and get told when its price drops.

## Selling
- **Become a seller:** choose "I want to sell" when you sign up. Our team approves seller accounts, usually within a working day, and we email you when it is done.
- **Post an ad:** choose the most specific category, fill in the details, add clear photos and submit. Every ad is reviewed before it goes live.
- **Changes required:** if we ask for changes, open the ad from My ads, fix what the note says and submit again.
- **Expiry:** ads stay live for a set number of days. We remind you three days before, and you can renew with one click.
- **Sold or rented:** mark the ad as sold or rented from My ads so buyers stop contacting you.

## Your account
- **Forgot password:** use **Forgot password?** on the sign-in page. We email you a 6-digit code.
- **Profile photo and details:** change them on your Profile page.
- **Suspicious messages:** block the person from the chat and report the ad. Read our safety tips before you meet anyone.`,
    },
    safety: {
      title: 'Stay safe on Finovo Souq',
      body: `Most people on Finovo Souq are honest buyers and sellers. These habits keep it that way and protect you from the few who are not.

## Before you meet
- Keep the conversation in Finovo Souq chat until you are ready to meet. It keeps a record and protects your phone number.
- Check the seller's profile: how long they have been a member and their other live ads.
- Be careful with prices that look far too good to be true.

## Meeting and paying
- Meet in a busy public place during the day, such as a shopping mall or a petrol station with cameras.
- Bring someone with you for expensive items, cars and property viewings.
- **Never pay a deposit or transfer money before you have seen the item.** Finovo Souq never asks you to pay through a link in chat.
- Check the item carefully. For cars, ask for the registration (Istimara) and a recent inspection. For property, confirm ownership documents.

## Protect your account
- Never share your password or a code we send you, not even with someone who says they work for Finovo Souq.
- Do not click links from strangers that ask you to sign in or pay.

## Report anything suspicious
Use **Report this ad** on any ad that looks wrong, and block anyone who pressures or threatens you in chat. Our team reviews every report.`,
    },
    terms: {
      title: 'Terms of use',
      body: `These terms apply when you use Finovo Souq. By creating an account or posting an ad you agree to them.

## What Finovo Souq is
Finovo Souq is a classifieds marketplace that connects buyers and sellers in Saudi Arabia. We do not sell items, take part in deals, hold payments or deliver goods. Any agreement is made directly between the buyer and the seller.

## Your account
- You must give accurate details and keep your password secret.
- Seller accounts are checked by our team before they can post ads.
- We may suspend accounts that break these terms or put other users at risk.

## Posting ads
- Ads must describe a real item, property or service that you are allowed to sell or rent.
- Use your own photos and an honest price in Saudi riyals.
- Every ad is reviewed before it goes live. We may ask for changes, reject or hide an ad at any time.
- Do not post illegal, counterfeit, stolen, dangerous or adult items, and do not post the same ad more than once.

## Messages and conduct
- Use chat only to discuss ads. Spam, harassment, threats and scams are not allowed.
- Do not ask for payment outside a safe, in-person deal.

## Liability
Finovo Souq is provided as it is. We are not responsible for the quality, safety or legality of items, the truth of ads, or the ability of users to complete a deal. Always follow our safety tips.

## Changes
We may update these terms. The date at the top shows the latest version. Continuing to use Finovo Souq means you accept the updated terms.`,
    },
    privacy: {
      title: 'Privacy policy',
      body: `This policy explains what we collect when you use Finovo Souq and how we use it.

## What we collect
- **Account details:** your name, email address, optional phone number and city.
- **Ads:** the text, details and photos you post. Photos are re-encoded on our servers, which removes location data.
- **Messages:** chat messages, photos and voice notes you send to other users.
- **Technical data:** sign-in sessions and basic logs used to keep the service secure.

## How we use it
- To run your account, show your ads and deliver your messages.
- To review ads and reports and to protect users from fraud and abuse.
- To send important emails, such as password reset codes and account approval.

## What other users can see
Buyers see your name, profile photo, city, member-since date and your live ads. **Your email address and phone number are never shown.** Chats are visible only to the two people in them; our team may review a conversation when it is reported.

## Sharing
We do not sell your data. We share it only with service providers that help us run Finovo Souq (such as email delivery and hosting), or when the law requires it.

## Your choices
- You can update your profile at any time.
- You can ask us to delete your account from your profile page.

## Contact
Questions about your privacy? Contact us using the details on our Contact page.`,
    },
  },
}
