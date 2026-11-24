import { useEffect } from 'react';
import { APP_NAME } from '../config/app.config';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${APP_NAME}` : `${APP_NAME} - Classifieds Marketplace`;
  }, [title]);
}
