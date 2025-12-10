-- Row Level Security (RLS) Policies for Workout App
-- Run this in Supabase SQL Editor or via migrations

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_database ENABLE ROW LEVEL SECURITY;
ALTER TABLE install_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_log_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- USERS TABLE POLICIES
-- ===========================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Allow insert during signup (service role handles this)
CREATE POLICY "Allow insert for authenticated users"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ===========================================
-- PROGRAMS TABLE POLICIES
-- ===========================================

-- Users can read their own programs
CREATE POLICY "Users can read own programs"
  ON programs FOR SELECT
  USING (auth.uid() = "userId");

-- Users can create their own programs
CREATE POLICY "Users can create own programs"
  ON programs FOR INSERT
  WITH CHECK (auth.uid() = "userId");

-- Users can update their own programs
CREATE POLICY "Users can update own programs"
  ON programs FOR UPDATE
  USING (auth.uid() = "userId");

-- Users can delete their own programs
CREATE POLICY "Users can delete own programs"
  ON programs FOR DELETE
  USING (auth.uid() = "userId");

-- Coaches can view programs they're coaching (future feature)
CREATE POLICY "Coaches can view coached programs"
  ON programs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'COACH'
    )
  );

-- ===========================================
-- EXERCISE DATABASE POLICIES (Public Read)
-- ===========================================

-- Everyone can read the exercise database
CREATE POLICY "Exercise database is public"
  ON exercise_database FOR SELECT
  TO authenticated
  USING (true);

-- Only admins/service role can modify exercise database
-- (No policy for INSERT/UPDATE/DELETE means only service role can do it)

-- ===========================================
-- USER PROFILES POLICIES
-- ===========================================

-- Users can read their own profile
CREATE POLICY "Users can read own extended profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = "userId");

-- Users can create their own profile
CREATE POLICY "Users can create own extended profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = "userId");

-- Users can update their own profile
CREATE POLICY "Users can update own extended profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = "userId");

-- ===========================================
-- WORKOUT LOGS POLICIES
-- ===========================================

-- Users can read their own workout logs
CREATE POLICY "Users can read own workout logs"
  ON workout_logs FOR SELECT
  USING (auth.uid() = "userId");

-- Users can create their own workout logs
CREATE POLICY "Users can create own workout logs"
  ON workout_logs FOR INSERT
  WITH CHECK (auth.uid() = "userId");

-- Users can update their own workout logs
CREATE POLICY "Users can update own workout logs"
  ON workout_logs FOR UPDATE
  USING (auth.uid() = "userId");

-- Users can delete their own workout logs
CREATE POLICY "Users can delete own workout logs"
  ON workout_logs FOR DELETE
  USING (auth.uid() = "userId");

-- ===========================================
-- WORKOUT LOG EXERCISES POLICIES
-- ===========================================

-- Users can manage exercises in their workout logs
CREATE POLICY "Users can read own workout log exercises"
  ON workout_log_exercises FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workout_logs
      WHERE workout_logs.id = workout_log_exercises."workoutLogId"
      AND workout_logs."userId" = auth.uid()
    )
  );

CREATE POLICY "Users can create own workout log exercises"
  ON workout_log_exercises FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_logs
      WHERE workout_logs.id = "workoutLogId"
      AND workout_logs."userId" = auth.uid()
    )
  );

CREATE POLICY "Users can update own workout log exercises"
  ON workout_log_exercises FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workout_logs
      WHERE workout_logs.id = workout_log_exercises."workoutLogId"
      AND workout_logs."userId" = auth.uid()
    )
  );

CREATE POLICY "Users can delete own workout log exercises"
  ON workout_log_exercises FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workout_logs
      WHERE workout_logs.id = workout_log_exercises."workoutLogId"
      AND workout_logs."userId" = auth.uid()
    )
  );

-- ===========================================
-- ACTIVITIES POLICIES
-- ===========================================

CREATE POLICY "Users can manage own activities"
  ON activities FOR ALL
  USING (auth.uid() = "userId");

-- ===========================================
-- WORKOUT SESSIONS POLICIES
-- ===========================================

CREATE POLICY "Users can manage own sessions"
  ON workout_sessions FOR ALL
  USING (auth.uid() = "userId");

-- ===========================================
-- MEMBERSHIPS POLICIES
-- ===========================================

CREATE POLICY "Users can read own memberships"
  ON memberships FOR SELECT
  USING (auth.uid() = "userId");

-- ===========================================
-- CHALLENGES POLICIES
-- ===========================================

-- Anyone can view public challenges
CREATE POLICY "Public challenges are viewable"
  ON challenges FOR SELECT
  TO authenticated
  USING ("isPublic" = true);

-- Users can view challenges they created
CREATE POLICY "Users can view own challenges"
  ON challenges FOR SELECT
  USING (auth.uid() = "createdById");

-- Users can create challenges
CREATE POLICY "Users can create challenges"
  ON challenges FOR INSERT
  WITH CHECK (auth.uid() = "createdById");

-- Users can update their own challenges
CREATE POLICY "Users can update own challenges"
  ON challenges FOR UPDATE
  USING (auth.uid() = "createdById");

-- Users can delete their own challenges
CREATE POLICY "Users can delete own challenges"
  ON challenges FOR DELETE
  USING (auth.uid() = "createdById");

-- ===========================================
-- CHALLENGE PARTICIPANTS POLICIES
-- ===========================================

-- Users can view their participations
CREATE POLICY "Users can view own participations"
  ON challenge_participants FOR SELECT
  USING (auth.uid() = "userId");

-- Challenge creators can view all participants
CREATE POLICY "Creators can view challenge participants"
  ON challenge_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM challenges
      WHERE challenges.id = challenge_participants."challengeId"
      AND challenges."createdById" = auth.uid()
    )
  );

-- Users can join public challenges
CREATE POLICY "Users can join challenges"
  ON challenge_participants FOR INSERT
  WITH CHECK (
    auth.uid() = "userId" AND
    EXISTS (
      SELECT 1 FROM challenges
      WHERE challenges.id = "challengeId"
      AND (challenges."isPublic" = true OR challenges."createdById" = auth.uid())
    )
  );

-- Users can update their own participation
CREATE POLICY "Users can update own participation"
  ON challenge_participants FOR UPDATE
  USING (auth.uid() = "userId");

-- Users can leave challenges
CREATE POLICY "Users can leave challenges"
  ON challenge_participants FOR DELETE
  USING (auth.uid() = "userId");

-- ===========================================
-- PROGRAM RATINGS POLICIES
-- ===========================================

-- Public ratings are viewable by all
CREATE POLICY "Public ratings are viewable"
  ON program_ratings FOR SELECT
  TO authenticated
  USING ("isPublic" = true);

-- Users can view their own ratings
CREATE POLICY "Users can view own ratings"
  ON program_ratings FOR SELECT
  USING (auth.uid() = "userId");

-- Users can create ratings
CREATE POLICY "Users can create ratings"
  ON program_ratings FOR INSERT
  WITH CHECK (auth.uid() = "userId");

-- Users can update their own ratings
CREATE POLICY "Users can update own ratings"
  ON program_ratings FOR UPDATE
  USING (auth.uid() = "userId");

-- Users can delete their own ratings
CREATE POLICY "Users can delete own ratings"
  ON program_ratings FOR DELETE
  USING (auth.uid() = "userId");

-- ===========================================
-- INSTALL LINKS POLICIES
-- ===========================================

-- Anyone can view install links (they're meant to be shared)
CREATE POLICY "Install links are public"
  ON install_links FOR SELECT
  TO authenticated
  USING (true);

-- Program owners can create install links
CREATE POLICY "Program owners can create install links"
  ON install_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM programs
      WHERE programs.id = "programId"
      AND programs."userId" = auth.uid()
    )
  );

-- Program owners can delete install links
CREATE POLICY "Program owners can delete install links"
  ON install_links FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM programs
      WHERE programs.id = install_links."programId"
      AND programs."userId" = auth.uid()
    )
  );
