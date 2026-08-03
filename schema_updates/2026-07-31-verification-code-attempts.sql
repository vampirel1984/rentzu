-- Rate-limit verification code guesses.
--
-- A 6-digit code is only 1,000,000 possibilities, and verify-code previously
-- allowed unlimited attempts against a pending row. Once the API is reachable
-- from the internet that is brute-forceable, so track attempts per code and
-- lock the row after too many failures.

ALTER TABLE email_verification_codes
    ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

-- Existing rows keep the default of 0.
