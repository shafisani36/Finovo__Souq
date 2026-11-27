import { useEffect } from 'react';
import { APP_NAME } from '../config/app.config';
import { t } from '../i18n';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title
      ? `${title} | ${APP_NAME}`
      : t('{aPP_NAME} - Classifieds Marketplace', {
          aPP_NAME: APP_NAME,
        });
  }, [title]);
}
