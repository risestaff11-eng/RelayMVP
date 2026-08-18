CREATE TRIGGER IF NOT EXISTS `companies_initial_ai_credits`
AFTER INSERT ON `companies`
WHEN NEW.`ai_token_balance` = 5000 AND NEW.`ai_tokens_used` = 0
BEGIN
	UPDATE `companies`
	SET `ai_token_balance` = 50000
	WHERE `id` = NEW.`id`;
END;
