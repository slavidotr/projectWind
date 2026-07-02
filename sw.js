let cancelFn = null

// Closes shown + pending triggered notifications with the given tag.
// Falls back to shown-only if the browser doesn't support includeTriggered.
async function closeTag(tag) {
  try {
    const notes = await self.registration.getNotifications({ tag, includeTriggered: true })
    notes.forEach(n => n.close())
  } catch {
    try {
      const notes = await self.registration.getNotifications({ tag })
      notes.forEach(n => n.close())
    } catch {}
  }
}

async function scheduleNotification(delay, title, body) {
  if (cancelFn) { cancelFn(); cancelFn = null }
  await closeTag('rest-timer')
  await closeTag('rest-countdown')

  if (typeof TimestampTrigger !== 'undefined') {
    try {
      await self.registration.showNotification(title, {
        body,
        tag:                'rest-timer',
        renotify:           true,
        requireInteraction: true,
        vibrate:            [300, 100, 300, 100, 300, 100, 600],
        showTrigger:        new TimestampTrigger(Date.now() + delay),
      })
      return
    } catch {}
  }

  return new Promise(resolve => {
    let cancelled = false
    const timerId = setTimeout(async () => {
      cancelFn = null
      if (!cancelled) {
        try {
          await self.registration.showNotification(title, {
            body,
            tag:                'rest-timer',
            renotify:           true,
            requireInteraction: true,
            vibrate:            [300, 100, 300, 100, 300, 100, 600],
          })
        } catch {}
      }
      resolve()
    }, delay)
    cancelFn = () => {
      cancelled = true
      clearTimeout(timerId)
      cancelFn = null
      resolve()
    }
  })
}

self.addEventListener('message', event => {
  if (!event.data) return

  if (event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { delay, title, body } = event.data
    event.waitUntil(scheduleNotification(delay, title, body))
  }

  // Live countdown — 'rest-countdown' tag, never cancels the 'rest-timer' trigger.
  if (event.data.type === 'SHOW_COUNTDOWN') {
    event.waitUntil(self.registration.showNotification(event.data.title, {
      body:     event.data.body || '',
      tag:      'rest-countdown',
      silent:   true,
      renotify: false,
    }))
  }

  // At rest end (screen on): cancel the pending OS trigger then update countdown in place.
  if (event.data.type === 'FIRE_NOTIFICATION') {
    event.waitUntil((async () => {
      await closeTag('rest-timer')
      await self.registration.showNotification(event.data.title, {
        body:               event.data.body,
        tag:                'rest-countdown',
        renotify:           true,
        requireInteraction: true,
        vibrate:            [300, 100, 300, 100, 300, 100, 600],
      })
    })())
  }

  if (event.data.type === 'CLOSE_COUNTDOWN') {
    event.waitUntil(closeTag('rest-countdown'))
  }

  // Cancel both live countdown and OS-level trigger (skip / finish).
  if (event.data.type === 'CANCEL_NOTIFICATION') {
    event.waitUntil((async () => {
      if (cancelFn) { cancelFn(); cancelFn = null }
      await closeTag('rest-timer')
      await closeTag('rest-countdown')
    })())
  }

  // Cancel only the OS-level trigger (pause — keeps countdown notification visible).
  if (event.data.type === 'CLOSE_TRIGGER') {
    event.waitUntil(closeTag('rest-timer'))
  }

  // PING: keep the SW alive while a rest is running.
  if (event.data.type === 'PING') {
    event.waitUntil(new Promise(resolve => setTimeout(resolve, 20000)))
  }
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  if (event.notification.tag === 'rest-timer') {
    event.waitUntil(closeTag('rest-countdown'))
  }
  event.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    if (list.length) return list[0].focus()
    return clients.openWindow('/')
  }))
})

self.addEventListener('notificationclose', event => {
  if (event.notification.tag === 'rest-timer') closeTag('rest-countdown')
})
