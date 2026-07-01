const express = require('express');
const router = express.Router();

router.post('/paypal/webhook', (req, res) => {
  const { event_type } = req.body;

  switch (event_type) {
    case 'BILLING.SUBSCRIPTION.CREATED':
      break;
    case 'BILLING.SUBSCRIPTION.ACTIVATED':
      break;
    case 'BILLING.SUBSCRIPTION.CANCELLED':
      break;
    case 'PAYMENT.SALE.COMPLETED':
      break;
    default:
      console.log('Unhandled event type:', event_type);
  }

  res.status(200).send('OK');
});

module.exports = router;
