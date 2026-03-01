-- Sprint 5: Authentication & Usage Limits
-- Migration: Create profiles, anonymous_users, and daily_usage tables

-- ============================================
-- TABLES
-- ============================================

-- profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  device_fingerprint TEXT,  -- migrate anonymous usage on signup
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- anonymous_users table (device fingerprint tracking)
CREATE TABLE IF NOT EXISTS anonymous_users (
  device_fingerprint TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- daily_usage table (tracks verifications per user/device per day)
CREATE TABLE IF NOT EXISTS daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT usage_identifier CHECK (
    (user_id IS NOT NULL) OR (device_fingerprint IS NOT NULL)
  ),
  CONSTRAINT unique_user_date UNIQUE (user_id, usage_date),
  CONSTRAINT unique_device_date UNIQUE (device_fingerprint, usage_date)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date
  ON daily_usage(user_id, usage_date);

CREATE INDEX IF NOT EXISTS idx_daily_usage_device_date
  ON daily_usage(device_fingerprint, usage_date);

CREATE INDEX IF NOT EXISTS idx_profiles_device_fingerprint
  ON profiles(device_fingerprint);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE anonymous_users ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Daily usage: users can view own
CREATE POLICY "Users can view own usage"
  ON daily_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Note: Service role bypasses RLS for anonymous tracking

-- ============================================
-- FUNCTIONS
-- ============================================

-- Atomic check-and-increment for usage
CREATE OR REPLACE FUNCTION check_and_increment_usage(
  p_user_id UUID DEFAULT NULL,
  p_device_fingerprint TEXT DEFAULT NULL,
  p_daily_limit INTEGER DEFAULT 10
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_count INTEGER;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Validate input
  IF p_user_id IS NULL AND p_device_fingerprint IS NULL THEN
    RAISE EXCEPTION 'Either user_id or device_fingerprint must be provided';
  END IF;

  -- Get or create today's usage record
  IF p_user_id IS NOT NULL THEN
    INSERT INTO daily_usage (user_id, usage_date, count)
    VALUES (p_user_id, v_today, 0)
    ON CONFLICT (user_id, usage_date) DO NOTHING;

    SELECT count INTO v_current_count
    FROM daily_usage
    WHERE user_id = p_user_id AND usage_date = v_today;
  ELSE
    -- Ensure anonymous user exists
    INSERT INTO anonymous_users (device_fingerprint)
    VALUES (p_device_fingerprint)
    ON CONFLICT (device_fingerprint) DO NOTHING;

    INSERT INTO daily_usage (device_fingerprint, usage_date, count)
    VALUES (p_device_fingerprint, v_today, 0)
    ON CONFLICT (device_fingerprint, usage_date) DO NOTHING;

    SELECT count INTO v_current_count
    FROM daily_usage
    WHERE device_fingerprint = p_device_fingerprint AND usage_date = v_today;
  END IF;

  -- Check limit
  IF v_current_count >= p_daily_limit THEN
    RETURN json_build_object(
      'allowed', false,
      'current', v_current_count,
      'limit', p_daily_limit,
      'remaining', 0
    );
  END IF;

  -- Increment
  IF p_user_id IS NOT NULL THEN
    UPDATE daily_usage
    SET count = count + 1, updated_at = NOW()
    WHERE user_id = p_user_id AND usage_date = v_today;
  ELSE
    UPDATE daily_usage
    SET count = count + 1, updated_at = NOW()
    WHERE device_fingerprint = p_device_fingerprint AND usage_date = v_today;
  END IF;

  RETURN json_build_object(
    'allowed', true,
    'current', v_current_count + 1,
    'limit', p_daily_limit,
    'remaining', p_daily_limit - v_current_count - 1
  );
END;
$$;

-- Get current usage without incrementing
CREATE OR REPLACE FUNCTION get_usage(
  p_user_id UUID DEFAULT NULL,
  p_device_fingerprint TEXT DEFAULT NULL,
  p_daily_limit INTEGER DEFAULT 10
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_count INTEGER := 0;
  v_today DATE := CURRENT_DATE;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT COALESCE(count, 0) INTO v_current_count
    FROM daily_usage
    WHERE user_id = p_user_id AND usage_date = v_today;
  ELSIF p_device_fingerprint IS NOT NULL THEN
    SELECT COALESCE(count, 0) INTO v_current_count
    FROM daily_usage
    WHERE device_fingerprint = p_device_fingerprint AND usage_date = v_today;
  END IF;

  RETURN json_build_object(
    'current', v_current_count,
    'limit', p_daily_limit,
    'remaining', GREATEST(0, p_daily_limit - v_current_count)
  );
END;
$$;

-- Migrate anonymous usage to user account
CREATE OR REPLACE FUNCTION migrate_anonymous_usage(
  p_user_id UUID,
  p_device_fingerprint TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update today's anonymous usage to user (if it exists and user doesn't have usage yet)
  UPDATE daily_usage
  SET user_id = p_user_id, device_fingerprint = NULL, updated_at = NOW()
  WHERE device_fingerprint = p_device_fingerprint
    AND usage_date = CURRENT_DATE
    AND user_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM daily_usage
      WHERE user_id = p_user_id AND usage_date = CURRENT_DATE
    );

  -- If user already had usage today, add the anonymous count to it
  UPDATE daily_usage u1
  SET count = u1.count + COALESCE((
    SELECT count FROM daily_usage
    WHERE device_fingerprint = p_device_fingerprint
    AND usage_date = CURRENT_DATE
    AND user_id IS NULL
  ), 0),
  updated_at = NOW()
  WHERE u1.user_id = p_user_id
    AND u1.usage_date = CURRENT_DATE
    AND EXISTS (
      SELECT 1 FROM daily_usage
      WHERE device_fingerprint = p_device_fingerprint
      AND usage_date = CURRENT_DATE
      AND user_id IS NULL
    );

  -- Delete the now-migrated anonymous usage
  DELETE FROM daily_usage
  WHERE device_fingerprint = p_device_fingerprint
    AND usage_date = CURRENT_DATE
    AND user_id IS NULL;

  -- Store fingerprint in profile for future reference
  UPDATE profiles
  SET device_fingerprint = p_device_fingerprint, updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (id, tier)
  VALUES (NEW.id, 'free')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- CLEANUP FUNCTION (optional, for maintenance)
-- ============================================

-- Function to clean up old usage data (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_usage()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM daily_usage
  WHERE usage_date < CURRENT_DATE - INTERVAL '90 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
