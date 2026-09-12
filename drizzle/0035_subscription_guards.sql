CREATE TRIGGER IF NOT EXISTS program_subscription_capacity BEFORE UPDATE OF status ON programs
WHEN NEW.status IN ('ACTIVE','PAUSED') AND OLD.status NOT IN ('ACTIVE','PAUSED')
  AND EXISTS (
    SELECT 1 FROM companies c WHERE c.id = NEW.company_id AND c.subscription_status <> 'LEGACY'
    AND (SELECT count(*) FROM programs p WHERE p.company_id = NEW.company_id AND p.id <> NEW.id AND p.status IN ('ACTIVE','PAUSED')) >=
      CASE c.plan_code WHEN 'STARTER' THEN 1 WHEN 'SCALE' THEN 20 ELSE 5 END
  )
BEGIN
  SELECT RAISE(ABORT, 'PROGRAM_LIMIT_REACHED');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS product_company_created AFTER INSERT ON companies
BEGIN
  INSERT OR IGNORE INTO product_milestones VALUES (NEW.id, 'company_created', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS product_program_published AFTER UPDATE OF status ON programs WHEN NEW.status = 'ACTIVE' AND OLD.status <> 'ACTIVE'
BEGIN
  INSERT OR IGNORE INTO product_milestones VALUES (NEW.company_id, 'first_program_published', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS product_agent_joined AFTER INSERT ON partners
BEGIN
  INSERT OR IGNORE INTO product_milestones VALUES (NEW.company_id, 'first_agent_joined', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS product_submission_created AFTER INSERT ON submissions
BEGIN
  INSERT OR IGNORE INTO product_milestones VALUES (NEW.company_id, 'first_submission', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS product_sale_completed AFTER UPDATE OF sales_status ON submissions WHEN NEW.sales_status = 'WON' AND OLD.sales_status <> 'WON'
BEGIN
  INSERT OR IGNORE INTO product_milestones VALUES (NEW.company_id, 'first_sale', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS product_reward_confirmed AFTER UPDATE OF partner_confirmed_at ON rewards WHEN NEW.partner_confirmed_at IS NOT NULL AND OLD.partner_confirmed_at IS NULL
BEGIN
  INSERT OR IGNORE INTO product_milestones VALUES (NEW.company_id, 'first_reward_confirmed', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS product_subscription_paid AFTER INSERT ON subscription_events WHEN NEW.paid_amount > 0 AND NEW.action IN ('ACTIVATE','EXTEND')
BEGIN
  INSERT OR IGNORE INTO product_milestones VALUES (NEW.company_id, 'first_subscription_paid', NEW.created_at);
  INSERT OR IGNORE INTO product_milestones SELECT NEW.company_id, 'first_renewal', NEW.created_at WHERE NEW.action = 'EXTEND';
END;
