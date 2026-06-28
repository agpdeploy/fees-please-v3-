-- Add recipient_emails column to email_reports
ALTER TABLE email_reports ADD COLUMN recipient_emails text;

-- Add comment
COMMENT ON COLUMN email_reports.recipient_emails IS 'Comma-separated list of additional recipient email addresses for weekly reports';
