UPDATE `companies`
SET `ai_token_balance` = MAX(0, 5000 - `ai_tokens_used`)
WHERE `ai_token_balance` > 5000;
