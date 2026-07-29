'use client'

import { useEffect } from 'react'

/**
 * Обробляє посилання-запрошення Netlify Identity (invite_token, recovery_token тощо):
 * якщо користувач відкрив головну сторінку з таким токеном — перенаправляємо в /admin/,
 * де віджет Identity покаже форму встановлення пароля.
 */
export function NetlifyIdentityRedirect() {
  useEffect(() => {
    const hash = window.location.hash
    if (
      hash.includes('invite_token=') ||
      hash.includes('recovery_token=') ||
      hash.includes('confirmation_token=') ||
      hash.includes('email_change_token=')
    ) {
      // без кінцевого слеша: /admin/ дає зайвий 308-редирект
      window.location.replace('/admin' + hash)
    }
  }, [])

  return null
}
