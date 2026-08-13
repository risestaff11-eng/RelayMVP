UPDATE companies
SET ai_token_balance = CASE
  WHEN ai_token_balance < 300000 THEN 300000
  ELSE ai_token_balance
END,
updated_at = CURRENT_TIMESTAMP
WHERE owner_user_id IN (
  SELECT id FROM users WHERE lower(email) = 'rtarzhakayev@gmail.com'
);
