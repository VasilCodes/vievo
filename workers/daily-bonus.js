// Cloudflare Worker - Daily Credits & XP Bonus
// Trigger: cron(0 0 * * *) - runs daily at midnight

export default {
  async scheduled(event, env, ctx) {
    // Firebase Admin SDK can't be used directly in Workers without extra setup.
    // Instead, we use the Firebase REST API with the project's API key.
    
    const FIREBASE_API_KEY = 'AIzaSyCa6TTfSKudSpG5N07wOnmyRMrF6BzNb-s';
    const PROJECT_ID = 'vievo-community-zzz';
    
    // Use Firestore REST API to get all users
    // First, we need an access token. For Firestore REST API, we can use the Firebase Auth REST API
    // or use the Firestore REST API directly with an OAuth2 token.
    
    // Since this runs in Cloudflare Workers, we'll use the Firebase Admin approach
    // via a service account. But for simplicity, we'll make direct Firestore REST calls.
    
    const FIREBASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users`;
    
    try {
      // Get all users
      const response = await fetch(FIREBASE_URL, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error('Failed to fetch users:', await response.text());
        return;
      }
      
      const data = await response.json();
      const users = data.documents || [];
      
      const results = [];
      
      for (const user of users) {
        const userId = user.name.split('/').pop();
        const fields = user.fields || {};
        
        // Skip banned users
        if (fields.banned && fields.banned.booleanValue) continue;
        
        // Get current values
        const credits = parseInt(fields.credits?.integerValue || '0');
        const xp = parseInt(fields.xp?.integerValue || '0');
        const level = parseInt(fields.level?.integerValue || '1');
        const subscription = fields.subscription?.stringValue || 'free';
        const dailyStreak = parseInt(fields.dailyStreak?.integerValue || '0');
        const lastDailyBonus = fields.lastDailyBonus?.stringValue || '';
        
        // Calculate daily credits based on subscription
        const dailyCredits = { free: 10, plus: 15, pro: 25, ultra: 40 };
        const bonusCredits = dailyCredits[subscription] || 10;
        
        // Check if already claimed today
        const today = new Date().toISOString().split('T')[0];
        const lastBonusDate = lastDailyBonus ? new Date(lastDailyBonus).toISOString().split('T')[0] : '';
        
        if (lastBonusDate === today) {
          results.push({ userId, status: 'already_claimed' });
          continue;
        }
        
        // Calculate streak
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const newStreak = lastBonusDate === yesterday ? dailyStreak + 1 : 1;
        const streakBonus = Math.min(newStreak, 7) * 2; // Up to 14 bonus XP for 7-day streak
        
        // Calculate XP gain
        const xpGain = 10 + streakBonus;
        const newXp = xp + xpGain;
        const newCredits = credits + bonusCredits;
        
        // Level up calculation (every 100 XP)
        let newLevel = level;
        if (newXp >= level * 100) {
          newLevel = Math.floor(newXp / 100) + 1;
        }
        
        // Update user document via Firestore REST API
        const updateUrl = `${FIREBASE_URL}/${userId}`;
        
        const updateData = {
          fields: {
            credits: { integerValue: String(newCredits) },
            xp: { integerValue: String(newXp) },
            level: { integerValue: String(newLevel) },
            dailyStreak: { integerValue: String(newStreak) },
            lastDailyBonus: { stringValue: new Date().toISOString() }
          }
        };
        
        // Use PATCH to update
        const updateResponse = await fetch(`${updateUrl}?updateMask.fieldPaths=credits&updateMask.fieldPaths=xp&updateMask.fieldPaths=level&updateMask.fieldPaths=dailyStreak&updateMask.fieldPaths=lastDailyBonus`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        });
        
        if (updateResponse.ok) {
          results.push({ 
            userId, 
            status: 'success', 
            creditsGained: bonusCredits, 
            xpGained: xpGain,
            newLevel,
            streak: newStreak
          });
        } else {
          results.push({ userId, status: 'error', error: await updateResponse.text() });
        }
      }
      
      console.log('Daily bonus results:', JSON.stringify(results));
      
    } catch (err) {
      console.error('Daily bonus worker error:', err);
    }
  }
};
