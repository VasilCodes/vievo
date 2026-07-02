// Cloudflare Worker - Push Notifications
// Trigger: HTTP POST from client when sending a message
// Requires FCM_SERVER_KEY secret in Cloudflare Worker

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { token, title, body, icon } = await request.json();

      if (!token || !title) {
        return new Response(JSON.stringify({ error: 'Missing required fields: token, title' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const fcmRes = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${env.FCM_SERVER_KEY}`
        },
        body: JSON.stringify({
          to: token,
          notification: {
            title: title,
            body: body || '',
            icon: icon || 'https://vievo-community.pages.dev/favicon.ico',
            click_action: 'https://vievo-community.pages.dev/home/'
          }
        })
      });

      const result = await fcmRes.json();
      return new Response(JSON.stringify(result), {
        status: fcmRes.status,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
